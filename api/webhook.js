import crypto from 'crypto';
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

function verifyWebhook(payloadRaw, headers, secret) {
  const webhookId = headers['webhook-id'];
  const timestamp = headers['webhook-timestamp'];
  const signatureHeader = headers['webhook-signature'];

  if (!webhookId || !timestamp || !signatureHeader) {
    return false;
  }

  const signedContent = `${webhookId}.${timestamp}.${rawBodyPayloadCleanup(payloadRaw)}`;

  const signatures = signatureHeader.split(' ').map(sig => {
    const parts = sig.split(',');
    if (parts.length === 2 && parts[0] === 'v1') {
      return parts[1];
    }
    return null;
  }).filter(Boolean);

  if (signatures.length === 0) {
    return false;
  }

  const expectedHex = crypto
    .createHmac('sha256', secret)
    .update(signedContent)
    .digest('hex');

  const expectedBase64 = crypto
    .createHmac('sha256', secret)
    .update(signedContent)
    .digest('base64');

  for (const sig of signatures) {
    try {
      const sigBuffer = Buffer.from(sig);
      const hexBuffer = Buffer.from(expectedHex);
      const base64Buffer = Buffer.from(expectedBase64);

      if (sigBuffer.length === hexBuffer.length && crypto.timingSafeEqual(sigBuffer, hexBuffer)) {
        return true;
      }
      if (sigBuffer.length === base64Buffer.length && crypto.timingSafeEqual(sigBuffer, base64Buffer)) {
        return true;
      }
    } catch (e) {
      // ignore
    }
  }

  return false;
}

// Helper to ensure payload raw bytes are clean
function rawBodyPayloadCleanup(payload) {
  // standard-webhooks signatures verify the exact string payload as received
  return payload;
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

  // Webhook signature verification
  const isValid = verifyWebhook(rawBody, req.headers, secret);
  if (!isValid) {
    console.warn('Invalid signature for webhook event');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
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
    // 1. auth.users 테이블에서 이메일로 user id 조회
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('Failed to list users from admin API:', listError.message);
      
      // Fallback: 만약 service_role_key가 유효하지 않아 listUsers가 실패한다면,
      // 프로필 테이블에 email이 없으므로 수동 매칭이 어렵습니다. 
      // 이 경우 사용자는 SUPABASE_SERVICE_ROLE_KEY를 환경변수로 추가해주어야 합니다.
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

    const userId = targetUser.id;

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
