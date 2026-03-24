// api/generate.js — Vercel Serverless Function (CommonJS)

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGemini(apiKey, prompt, maxOutputTokens, attempt) {
  attempt = attempt || 1;

  const res = await fetch(GEMINI_URL + '?key=' + apiKey, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxOutputTokens, temperature: 0.7 },
    }),
  });

  const data = await res.json();

  if (res.status === 429 && attempt < 2) {
    await sleep(1500);
    return callGemini(apiKey, prompt, maxOutputTokens, attempt + 1);
  }

  return { status: res.status, data: data };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY tidak dikonfigurasi.' });

  const body = req.body || {};
  const prompt = body.prompt;
  const maxOutputTokens = body.maxOutputTokens || 4000;

  if (!prompt) return res.status(400).json({ error: 'Field prompt wajib diisi.' });

  try {
    const result = await callGemini(apiKey, prompt, maxOutputTokens);

    if (result.status !== 200) {
      const raw = (result.data && result.data.error && result.data.error.message) || '';
      let errorMsg = raw || 'Gemini API error';
      if (result.status === 429) errorMsg = 'Rate limit Gemini. Tunggu 30 detik lalu coba lagi.';
      if (result.status === 403) errorMsg = 'API key ditolak. Periksa key di Vercel env var.';
      return res.status(result.status).json({ error: errorMsg });
    }

    const text = result.data.candidates &&
                 result.data.candidates[0] &&
                 result.data.candidates[0].content &&
                 result.data.candidates[0].content.parts &&
                 result.data.candidates[0].content.parts[0] &&
                 result.data.candidates[0].content.parts[0].text || '';

    return res.status(200).json({ text: text });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
