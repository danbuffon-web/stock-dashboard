module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { summary } = body;

    if (!summary) {
      return res.status(400).json({ error: 'Missing summary' });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    }

    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input:
  'You are a stock market educator helping adults understand investment decisions. Based only on the stock data below, write a concise educational analysis.\n\n' +
  'Instructions:\n' +
  '- Use plain English.\n' +
  '- Explain whether each stock fits the selected strategy.\n' +
  '- Mention trend, momentum, and any caution flags.\n' +
  '- Do not give personalized financial advice.\n' +
  '- Keep the tone analytical and educational.\n' +
  '- Format the response in short sections.\n\n' +
  'For each stock, use this structure:\n' +
  '1. Ticker name\n' +
  '2. Strategy fit: Strong / Moderate / Weak\n' +
  '3. Trend and momentum explanation\n' +
  '4. Risk or caution\n' +
  '5. Educational takeaway\n\n' +
  summary,
      }),
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      return res.status(openaiRes.status).json({
        error: data?.error?.message || 'OpenAI request failed',
        details: data,
      });
    }

    let analysis = data.output_text;

if (!analysis && data.output) {
  try {
    analysis = data.output
      .map(o => o.content?.map(c => c.text).join(''))
      .join('\n');
  } catch {
    analysis = null;
  }
}

if (!analysis) {
  analysis = 'Analysis unavailable.';
}

    return res.status(200).json({ analysis });
  } catch (err) {
    return res.status(500).json({
      error: 'Server error while generating analysis',
      details: err.message,
    });
  }
};
