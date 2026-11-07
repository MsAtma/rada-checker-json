module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  try {
    const targetUrl = encodeURI(decodeURI(url));
    
    // Запрашиваем через AllOrigins, чтобы обойти геоблокировку датацентров США со стороны Рады
    const relayUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const response = await fetch(relayUrl);

    if (!response.ok) {
      return res.status(response.status).json({ error: `Gateway error: ${response.status}` });
    }

    const data = await response.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).send(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};