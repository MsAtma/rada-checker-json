export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Параметр url обов’язковий' });
  }

  try {
    // Безпечне кодування кирилиці для Node.js fetch
    const targetUrl = encodeURI(decodeURI(url));

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'OpenData',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    const contentType = response.headers.get('content-type') || '';
    const textData = await response.text();

    if (contentType.includes('application/json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    } else {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }

    return res.status(response.status).send(textData);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}