// api/generate.js — Vercel Serverless Function

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGemini(apiKey, prompt, maxOutputTokens, attempt = 1) {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens, temperature: 0.7 },
    }),
  });

  const data = await res.json();

  // Retry sekali saja dengan delay 1.5 detik (aman untuk Vercel 10s timeout)
  if (res.status === 429 && attempt < 2) {
    console.log(`429 hit, retry after 1.5s...`);
    await sleep(1500);
    return callGemini(apiKey, prompt, maxOutputTokens, attempt + 1);
  }

  return { status: res.status, data };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY tidak dikonfigurasi.' });

  const { prompt, maxOutputTokens = 4000 } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Field "prompt" wajib diisi.' });

  try {
    const { status, data } = await callGemini(apiKey, prompt, maxOutputTokens);

    if (status !== 200) {
      const raw = data?.error?.message || '';
      console.error(`Gemini ${status}:`, raw);

      let errorMsg = raw || 'Gemini API error';
      if (status === 429) errorMsg = 'Rate limit Gemini. Tunggu 30 detik lalu coba lagi.';
      if (status === 403) errorMsg = 'API key ditolak. Periksa key di Vercel env var.';

      return res.status(status).json({ error: errorMsg });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ text });

  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
