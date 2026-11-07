const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Для Рады
  app.use(
    '/rada-api',
    createProxyMiddleware({
      target: 'https://data.rada.gov.ua',
      changeOrigin: true,
      pathRewrite: { '^/rada-api': '' },
      headers: { 'User-Agent': 'OpenData' }
    })
  );

  // ДЛЯ БУДСТАНДАРТА (чтобы не было CORS ошибки)
  app.use(
    '/budstandart-api',
    createProxyMiddleware({
      target: 'https://online.budstandart.com',
      changeOrigin: true,
      pathRewrite: { '^/budstandart-api': '' }
    })
  );
};