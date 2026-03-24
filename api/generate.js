// api/generate.js — Vercel Serverless Function
// Proxy ke Gemini API dengan retry logic untuk handle rate limit (429)

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // tunggu 2 detik sebelum retry

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGemini(apiKey, prompt, maxOutputTokens, attempt = 1) {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens,
        temperature: 0.7,
      },
    }),
  });

  const data = await res.json();

  // Jika 429 dan masih ada sisa retry, tunggu lalu coba lagi
  if (res.status === 429 && attempt < MAX_RETRIES) {
    console.log(`Rate limit hit, retry ${attempt}/${MAX_RETRIES} after ${RETRY_DELAY_MS * attempt}ms...`);
    await sleep(RETRY_DELAY_MS * attempt); // backoff: 2s, 4s, 6s
    return callGemini(apiKey, prompt, maxOutputTokens, attempt + 1);
  }

  return { status: res.status, data };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY tidak dikonfigurasi di server.' });
  }

  const { prompt, maxOutputTokens = 4000 } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Field "prompt" wajib diisi.' });
  }

  try {
    const { status, data } = await callGemini(apiKey, prompt, maxOutputTokens);

    if (status !== 200) {
      console.error(`Gemini error ${status}:`, JSON.stringify(data));

      // Pesan error yang lebih jelas
      let errorMsg = data?.error?.message || 'Gemini API error';
      if (status === 429) errorMsg = 'Quota Gemini habis atau terlalu banyak request. Coba lagi dalam 1 menit.';
      if (status === 403) errorMsg = 'API key tidak valid atau tidak punya akses ke Gemini.';
      if (status === 400) errorMsg = 'Request tidak valid. Periksa prompt yang dikirim.';

      return res.status(status).json({ error: errorMsg });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ text });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
