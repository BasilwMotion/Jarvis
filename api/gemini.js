const GEMINI_MODEL = "gemini-2.0-flash";

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });

  try {
    const { messages = [], systemPrompt = '' } = req.body || {};

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.8, topK: 40, topP: 0.95, maxOutputTokens: 2048 },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generate?key=${apiKey}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);

    const text = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ text, raw: j });
  } catch (e) {
    console.error('Error in /api/gemini:', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
};
