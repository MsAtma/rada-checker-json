// Отключаем строгую проверку SSL-сертификатов (частая проблема с *.gov.ua в Node.js)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

  const targetUrl = encodeURI(decodeURI(url));

  // 1. Попытка запросить напрямую с таймаутом 6 секунд
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'OpenData',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    clearTimeout(timeoutId);

    const textData = await response.text();
    const contentType = response.headers.get('content-type') || 'text/plain; charset=utf-8';

    res.setHeader('Content-Type', contentType);
    return res.status(response.status).send(textData);
  } catch (directError) {
    console.warn('Прямий запит не вдався, пробуємо резервний шлях:', directError.message);

    // 2. Если прямой запрос заблокирован файрволом Рады (таймаут/геоблок),
    // запрашиваем через резервный европейский шлюз
    try {
      const fallbackUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
      const fallbackRes = await fetch(fallbackUrl);

      if (!fallbackRes.ok) {
        throw new Error(`Fallback HTTP ${fallbackRes.status}`);
      }

      const fallbackText = await fallbackRes.text();
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(fallbackText);
    } catch (fallbackError) {
      return res.status(500).json({
        error: `Прямий запит: ${directError.message}; Резервний: ${fallbackError.message}`
      });
    }
  }
}