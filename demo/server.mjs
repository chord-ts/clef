import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const root = fileURLToPath(new URL('..', import.meta.url));
const spec = JSON.parse(await readFile(join(root, 'demo', 'openrpc.json'), 'utf8'));

let nextId = 3;
const notes = new Map([
  [
    1,
    {
      id: 1,
      title: 'Welcome to clef',
      body: 'This note lives in the demo server memory.',
      tags: ['demo'],
      createdAt: '2026-11-20T09:00:00.000Z'
    }
  ],
  [
    2,
    {
      id: 2,
      title: 'Try the console',
      body: 'Pick a method on the left and press Execute.',
      tags: ['demo', 'docs'],
      createdAt: '2026-11-20T09:05:00.000Z'
    }
  ]
]);

const invalidParams = (data) => ({ code: -32602, message: 'Invalid params', data });
const notFound = (id) => ({ code: -32001, message: 'Note not found', data: { id } });

function handle(request) {
  const { method, params = {}, id } = request;
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  const fail = (error) => ({ jsonrpc: '2.0', id, error });
  switch (method) {
    case 'rpc.discover':
      return reply(spec);
    case 'echo':
      return typeof params.message === 'string' ? reply(params.message) : fail(invalidParams('message must be a string'));
    case 'notes.list': {
      let list = [...notes.values()].sort((a, b) => b.id - a.id);
      if (typeof params.tag === 'string') list = list.filter((note) => note.tags.includes(params.tag));
      const limit = Number.isInteger(params.limit) ? params.limit : 20;
      return reply(list.slice(0, limit));
    }
    case 'notes.create': {
      if (typeof params.title !== 'string' || params.title.trim() === '') {
        return fail(invalidParams('title must be a non-empty string'));
      }
      const note = {
        id: nextId++,
        title: params.title,
        body: typeof params.body === 'string' ? params.body : null,
        tags: Array.isArray(params.tags) ? params.tags.filter((tag) => typeof tag === 'string') : [],
        createdAt: new Date().toISOString()
      };
      notes.set(note.id, note);
      return reply(note);
    }
    case 'notes.get': {
      const note = notes.get(params.id);
      return note ? reply(note) : fail(notFound(params.id));
    }
    case 'notes.delete': {
      if (!notes.has(params.id)) return fail(notFound(params.id));
      notes.delete(params.id);
      return reply(true);
    }
    case 'notes.export': {
      const list = [...notes.values()].sort((a, b) => a.id - b.id);
      if (params.format === 'markdown') {
        return reply(
          list
            .map((note) => `# ${note.title}\n\n${note.body ?? ''}\n\n_tags: ${note.tags.join(', ') || '—'}_`)
            .join('\n\n---\n\n')
        );
      }
      return reply(list);
    }
    case 'notes.clear': {
      const count = notes.size;
      notes.clear();
      return reply(count);
    }
    default:
      return fail({ code: -32601, message: `Method not found: ${method}` });
  }
}

function dispatch(request) {
  if (Array.isArray(request)) {
    const responses = request.filter((item) => item?.id !== undefined).map(handle);
    return responses.length ? responses : undefined;
  }
  if (request?.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    return { jsonrpc: '2.0', id: request?.id ?? null, error: { code: -32600, message: 'Invalid Request' } };
  }
  if (request.id === undefined) {
    handle(request);
    return undefined;
  }
  return handle(request);
}

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
    const response = dispatch(request);
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
    const response = dispatch(request);
    if (response !== undefined) socket.send(JSON.stringify(response));
  });
});

const port = Number(process.argv[2]) || 4000;
server.listen(port, () => {
  console.log(`clef demo server: http://localhost:${port} (spec: /openrpc.json, rpc: /rpc over HTTP + WS)`);
});