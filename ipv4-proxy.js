const http = require('http');
const httpProxy = require('http-proxy');
const proxy = httpProxy.createProxyServer({});
http.createServer((req, res) => {
  proxy.web(req, res, { target: 'http://[::1]:8082' }, (err) => {
    res.writeHead(502); res.end(err.message);
  });
}).listen(8081, '0.0.0.0', () => {
  console.log('IPv4 proxy on 0.0.0.0:8081 -> [::1]:8082');
});
