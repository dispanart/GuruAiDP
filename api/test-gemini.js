export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Halo, jawab dengan satu kata saja.' }] }],
      }),
    }
  );

  const data = await geminiRes.json();
  res.status(200).json({ httpStatus: geminiRes.status, response: data });
}
