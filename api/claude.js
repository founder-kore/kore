export default async function handler(req, res) {
  // Restrict to your own domain only
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://kore-theapp.vercel.app',
    'http://localhost:8081',
    'http://localhost:19006',
  ];
  // Allow requests with no origin (native mobile apps don't send Origin header)
  // Web browser requests are still restricted to allowedOrigins
  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-kore-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify shared secret — rejects anyone who isn't the Kore app
  const secret = req.headers['x-kore-secret'];
  if (!secret || secret !== process.env.KORE_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'Missing API key' });
  }

  try {
    let body = req.body;

    if (!body) {
      return res.status(400).json({ error: 'Empty request body' });
    }
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    try {
      const data = JSON.parse(text);
      return res.status(response.status).json(data);
    } catch (e) {
      return res.status(500).json({ error: 'Anthropic returned invalid JSON', raw: text.slice(0, 200) });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}