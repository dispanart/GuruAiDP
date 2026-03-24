module.exports = async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  const r = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey
  );
  const data = await r.json();
  const names = data.models.map(m => m.name);
  res.status(200).json({ models: names });
};
