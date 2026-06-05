import DodoPayments from 'dodopayments';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    if (!apiKey) {
      throw new Error("DODO_PAYMENTS_API_KEY is not configured on the server.");
    }

    const client = new DodoPayments({
      bearerToken: apiKey,
      environment: process.env.NODE_ENV === 'production' ? 'live_mode' : 'test_mode',
    });

    const { email, userId } = req.body;
    const origin = req.headers.origin || 'http://localhost:5173';

    const sessionConfig = {
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
    };

    if (userId) {
      sessionConfig.metadata = { user_id: userId };
    }

    const session = await client.checkoutSessions.create(sessionConfig);

    res.status(200).json({ checkout_url: session.checkout_url });
  } catch (error) {
    console.error('Checkout Session error:', error);
    res.status(500).json({ error: error.message });
  }
}
