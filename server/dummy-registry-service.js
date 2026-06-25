const http = require('http');
const port = 3001;

const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, operation-key, user, originator, x-correlator, trace-indicator, customer-journey'
    });
    return res.end();
  }

  if (req.url === '/v2/register-application' && req.method === 'POST') {
    console.log('Received /v2/register-application');
    res.writeHead(204);
    return res.end();
  }

  if (req.url === '/v1/deregister-application' && req.method === 'POST') {
    console.log('Received /v1/deregister-application');
    res.writeHead(204);
    return res.end();
  }

  // Simple health
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Not found' }));
});

server.listen(port, () => {
  console.log(`Dummy registry server listening on http://127.0.0.1:${port}`);
});
