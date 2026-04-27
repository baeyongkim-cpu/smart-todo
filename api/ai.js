export default async function handler(req, res) {
  // 1. 보안 설정: POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. 환경 변수에서 API 키 로드 (서버 사이드이므로 안전함)
  const API_KEY = process.env.GEMINI_API_KEY;
  
  if (!API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: API Key missing' });
  }

  const { contents, model = 'gemini-flash-latest' } = req.body;

  if (!contents) {
    return res.status(400).json({ error: 'Missing contents in request body' });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contents }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API Error:', data);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Vercel Function Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
