const http = require('http');
const port = 3033;

const server = http.createServer((req, res) => {
  if (req.url === '/v1/record-service-request' && req.method === 'POST') {
    console.log(`Received record-service-request`);
    res.writeHead(204);
    return res.end();
  }

  if (req.url === '/v1/record-service-request' && req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, operation-key, user, originator, x-correlator, trace-indicator, customer-journey'
    });
    return res.end();
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Not found' }));
});

server.listen(port, () => {
  console.log(`Dummy record-service server listening on http://127.0.0.1:${port}`);
});
