const http = require('http');

const proxy = http.createServer((req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: 3001,
    path: req.url,
    method: req.method,
    headers: req.headers
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
    proxyRes.on('error', (e) => {
      console.error('proxyRes error:', e.message);
    });
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
    }
    res.end('Proxy error: ' + err.message);
  });

  req.on('error', (err) => {
    console.error('Client req error:', err.message);
    proxyReq.destroy();
  });

  req.pipe(proxyReq, { end: true });
});

proxy.on('clientError', (err, socket) => {
  if (err.code === 'ECONNRESET' || !socket.writable) return;
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

process.on('uncaughtException', (err) => {
  console.error('Proxy caught exception:', err.message);
});

proxy.listen(3000, '0.0.0.0', () => {
  console.log('Port proxy active: http://localhost:3000 -> http://localhost:3001');
});
