// Author: Tommy
const http = require('node:http');
http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/v1/models') return res.end(JSON.stringify({ data: [{ id: 'z-ai/glm-5.3-flash', is_ready: true, supported_features: ['tools'], pricing: { prompt: '0.00000008', completion: '0.0000005', request: '0' } }] }));
  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    // A deliberate quota failure after a successful catalog read.
    res.writeHead(429); return res.end(JSON.stringify({ error: { message: 'Simulated quota exceeded', type: 'rate_limit_error' } }));
  }
  res.writeHead(501); res.end(JSON.stringify({ error: 'Operation not modeled' }));
}).listen(process.env.PORT);
