const http = require('http');
const httpProxy = require('http-proxy');
const fs = require('fs');

const proxy = httpProxy.createProxyServer({});
const TARGET = 'http://localhost:8082';

const server = http.createServer((req, res) => {
  const logLine = `${new Date().toISOString()} ${req.method} ${req.url}`;
  console.log(logLine);
  fs.appendFileSync('/tmp/proxy.log', logLine + '\n');

  if (req.url.includes('index.bundle') || req.url.includes('bundle')) {
    console.log('  → bundle request to', TARGET + req.url);
    const chunks = [];
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    res.write = function(chunk, ...args) {
      if (chunk) chunks.push(Buffer.from(chunk));
      return originalWrite(chunk, ...args);
    };
    res.end = function(chunk, ...args) {
      if (chunk) chunks.push(Buffer.from(chunk));
      if (chunks.length > 0) {
        const filename = `/tmp/device-bundle-${Date.now()}.js`;
        fs.writeFileSync(filename, Buffer.concat(chunks));
        console.log('  → saved', filename, `(${Buffer.concat(chunks).length} bytes)`);
      }
      return originalEnd(chunk, ...args);
    };

    proxy.web(req, res, { target: TARGET }, (err) => {
      console.error('  → proxy error:', err.message);
      res.writeHead(502);
      res.end('Proxy error: ' + err.message);
    });
    return;
  }

  proxy.web(req, res, { target: TARGET }, (err) => {
    console.error('  → proxy error:', err.message);
    res.writeHead(502);
    res.end('Proxy error: ' + err.message);
  });
});

server.listen(8081, '0.0.0.0', () => {
  console.log('Proxy 0.0.0.0:8081 →', TARGET);
});
