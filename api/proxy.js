// Отключаем строгую проверку сертификатов для украинских госсерверов
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

module.exports = async function handler(req, res) {
  // Разрешаем CORS
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
    const targetUrl = encodeURI(decodeURI(url));

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'OpenData',
        'Accept': '*/*'
      }
    });

    const textData = await response.text();
    const contentType = response.headers.get('content-type') || 'text/plain; charset=utf-8';

    res.setHeader('Content-Type', contentType);
    return res.status(response.status).send(textData);
  } catch (err) {
    console.error('Помилка проксі:', err);
    return res.status(500).json({ error: err.message });
  }
};