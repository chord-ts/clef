import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { dispatch } from './mock.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const spec = JSON.parse(await readFile(join(root, 'demo', 'openrpc.json'), 'utf8'));

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (url.pathname === '/rpc' && req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let request;
    try {
      request = JSON.parse(raw);
    } catch {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
      return;
    }
    const response = dispatch(request, spec);
    if (response === undefined) {
      res.statusCode = 204;
      res.end();
      return;
    }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(response));
    return;
  }
  if (req.method === 'GET') {
    if (url.pathname === '/openrpc.json') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(spec, null, 2));
      return;
    }
    const path = url.pathname === '/' ? '/demo/preview.html' : url.pathname;
    if (!path.startsWith('/demo/') && !path.startsWith('/dist/') && !path.startsWith('/examples/')) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    try {
      const data = await readFile(file);
      res.setHeader('content-type', mime[extname(file)] ?? 'application/octet-stream');
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
    return;
  }
  res.statusCode = 405;
  res.end();
});

const wss = new WebSocketServer({ server, path: '/rpc' });
wss.on('connection', (socket) => {
  socket.on('message', (data) => {
    let request;
    try {
      request = JSON.parse(String(data));
    } catch {
      socket.send(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
      return;
    }
    const response = dispatch(request, spec);
    if (response !== undefined) socket.send(JSON.stringify(response));
  });
});

const port = Number(process.argv[2]) || 4000;
server.listen(port, () => {
  console.log(`clef demo server: http://localhost:${port} (spec: /openrpc.json, rpc: /rpc over HTTP + WS)`);
});