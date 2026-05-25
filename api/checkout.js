import DodoPayments from 'dodopayments';

const client = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY,
  environment: process.env.NODE_ENV === 'production' && process.env.DODO_PAYMENTS_API_KEY?.includes('live_') ? 'live_mode' : 'test_mode',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { email } = req.body;
    const origin = req.headers.origin || 'http://localhost:5173';

    const session = await client.checkoutSessions.create({
      product_cart: [
        {
          product_id: process.env.VITE_DODO_PRODUCT_ID,
          quantity: 1,
        },
      ],
      return_url: `${origin}?upgraded=true`,
      customer: {
        email: email || '',
      },
    });

    res.status(200).json({ checkout_url: session.checkout_url });
  } catch (error) {
    console.error('Checkout Session error:', error);
    res.status(500).json({ error: error.message });
  }
}
