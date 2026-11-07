export default async function handler(req, res) {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).send('Параметр url обов’язковий');
  }

  try {
    // Сервер Vercel сам делает запрос к Раде или Будстандарту
    const response = await fetch(decodeURI(url), {
      headers: {
        'User-Agent': 'OpenData',
        'Accept': '*/*'
      }
    });

    const data = await response.text();

    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8');
    return res.status(response.status).send(data);
  } catch (error) {
    return res.status(500).send(error.message);
  }
}