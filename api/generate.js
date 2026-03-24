// api/generate.js — Vercel Serverless Function (CommonJS)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY tidak dikonfigurasi.' });

  const body = req.body || {};
  const prompt = body.prompt;
  if (!prompt) return res.status(400).json({ error: 'Field prompt wajib diisi.' });

  const model = 'gemini-2.5-flash';

  try {
    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4000, temperature: 0.7 },
        }),
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg = (data.error && data.error.message) || ('HTTP ' + geminiRes.status);
      return res.status(geminiRes.status).json({ error: msg });
    }

    const text = data.candidates[0].content.parts[0].text || '';
    return res.status(200).json({ text: text });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
