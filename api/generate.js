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

  // Coba model satu per satu sampai berhasil
  const models = [
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-pro',
  ];

  let lastError = '';

  for (const model of models) {
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

      if (geminiRes.ok) {
        const text = data.candidates &&
                     data.candidates[0] &&
                     data.candidates[0].content &&
                     data.candidates[0].content.parts &&
                     data.candidates[0].content.parts[0].text || '';
        return res.status(200).json({ text: text, model: model });
      }

      lastError = (data.error && data.error.message) || ('HTTP ' + geminiRes.status);
      // Kalau 404 (model tidak ada) atau 429 (quota), coba model berikutnya
      if (geminiRes.status === 404 || geminiRes.status === 429) continue;

      // Error lain langsung return
      return res.status(geminiRes.status).json({ error: lastError });

    } catch (err) {
      lastError = err.message;
      continue;
    }
  }

  return res.status(500).json({ error: 'Semua model gagal. Error terakhir: ' + lastError });
};
