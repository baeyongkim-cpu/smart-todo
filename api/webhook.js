import DodoPayments from 'dodopayments';
import { createClient } from '@supabase/supabase-js';

// Vercel에서 raw body를 받기 위한 설정
export const config = {
  api: {
    bodyParser: false,
  },
};

// Stream helper to read raw body
async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.DODO_WEBHOOK_SECRET;
  if (!secret) {
    console.error('Missing DODO_WEBHOOK_SECRET in environment variables');
    return res.status(500).json({ error: 'Webhook secret is not configured' });
  }

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    console.error('Failed to read raw body:', err);
    return res.status(500).json({ error: 'Failed to read request payload' });
  }

  let event;
  try {
    // DodoPayments 클라이언트를 초기화하여 SDK 내장 웹훅 검증 사용
    const client = new DodoPayments({ bearerToken: process.env.DODO_PAYMENTS_API_KEY || 'dummy_token' });
    event = client.webhooks.unwrap(rawBody, { headers: req.headers, key: secret });
  } catch (err) {
    console.warn('Webhook verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid signature or payload' });
  }

  const eventType = event.type;
  const payloadData = event.data;
  if (!payloadData) {
    return res.status(400).json({ error: 'Missing data in event body' });
  }

  // Dodo Payments webhook structures customer info inside data.customer or data.object.customer
  const customerEmail = payloadData.customer?.email || payloadData.customer_email;
  if (!customerEmail) {
    return res.status(200).json({ success: true, message: 'No customer email found in payload. Ignored.' });
  }

  // Supabase 클라이언트 초기화
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  // service_role이 권장되지만, 없을 경우를 위해 anon_key를 fallback으로 지정
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase configuration missing (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)');
    return res.status(500).json({ error: 'Supabase environment variables missing' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let userId = payloadData.metadata?.user_id;

    if (!userId) {
      console.log('No metadata user_id found. Falling back to email search.');
      // 1. auth.users 테이블에서 이메일로 user id 조회
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        console.error('Failed to list users from admin API:', listError.message);
        return res.status(500).json({ 
          error: 'Failed to access authentication service. Make sure SUPABASE_SERVICE_ROLE_KEY is configured in Vercel.',
          details: listError.message 
        });
      }

      const users = listData.users || [];
      const targetUser = users.find(u => u.email?.toLowerCase() === customerEmail.toLowerCase());
      if (!targetUser) {
        console.warn(`User with email ${customerEmail} not found in Supabase Auth`);
        return res.status(404).json({ error: `User with email ${customerEmail} not found` });
      }

      userId = targetUser.id;
    } else {
      console.log(`Using metadata user_id for upgrade: ${userId}`);
    }

    // 2. 이벤트 유형에 따른 처리
    // 구독 활성화, 생성, 혹은 일반 결제 성공
    if (
      eventType === 'payment.succeeded' || 
      eventType === 'subscription.active' || 
      eventType === 'subscription.created'
    ) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_premium: true })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to upgrade user profile to premium:', updateError.message);
        return res.status(500).json({ error: 'Failed to update user profile' });
      }

      console.log(`Successfully upgraded user ${customerEmail} (ID: ${userId}) to Premium/Pro`);
      return res.status(200).json({ success: true, message: `Upgraded user ${customerEmail} to Premium` });
    }

    // 구독 취소 또는 실패
    if (
      eventType === 'subscription.cancelled' || 
      eventType === 'subscription.failed'
    ) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_premium: false })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to downgrade user profile to free:', updateError.message);
        return res.status(500).json({ error: 'Failed to update user profile' });
      }

      console.log(`Successfully downgraded user ${customerEmail} (ID: ${userId}) to Free`);
      return res.status(200).json({ success: true, message: `Downgraded user ${customerEmail} to Free` });
    }

    // 기타 이벤트
    return res.status(200).json({ success: true, message: `Event ${eventType} received but no action required` });

  } catch (error) {
    console.error('Webhook execution error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
