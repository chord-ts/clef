import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { buildRequest, callRpc, TRANSPORT_ERROR } from './jsonrpc';

let server: Server | undefined;
let wss: WebSocketServer | undefined;

afterEach(async () => {
  wss?.close();
  wss = undefined;
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

function listen(handler: (body: any, res: import('node:http').ServerResponse) => void): Promise<string> {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => handler(JSON.parse(raw), res));
  });
  return new Promise((resolve) => {
    server!.listen(0, '127.0.0.1', () => {
      const address = server!.address();
      resolve(typeof address === 'object' && address ? `http://127.0.0.1:${address.port}/rpc` : '');
    });
  });
}

describe('buildRequest', () => {
  it('builds a 2.0 request with incrementing ids', () => {
    const a = buildRequest('echo', { message: 'hi' });
    const b = buildRequest('ping');
    expect(a.jsonrpc).toBe('2.0');
    expect(a.method).toBe('echo');
    expect(a.params).toEqual({ message: 'hi' });
    expect(b.id).toBe(a.id + 1);
    expect('params' in b).toBe(false);
  });
});

describe('callRpc over HTTP', () => {
  it('returns a result with timing', async () => {
    const url = await listen((body, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { echoed: body.params } }));
    });
    const outcome = await callRpc(url, 'echo', { message: 'hi' });
    expect(outcome.error).toBeUndefined();
    expect(outcome.result).toEqual({ echoed: { message: 'hi' } });
    expect(outcome.durationMs).toBeGreaterThanOrEqual(0);
    expect(outcome.request.method).toBe('echo');
  });

  it('returns a JSON-RPC error', async () => {
    const url = await listen((body, res) => {
      res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } }));
    });
    const outcome = await callRpc(url, 'missing');
    expect(outcome.result).toBeUndefined();
    expect(outcome.error).toEqual({ code: -32601, message: 'Method not found' });
  });

  it('wraps non-JSON responses as transport errors', async () => {
    const url = await listen((_body, res) => {
      res.statusCode = 502;
      res.end('<html>bad gateway</html>');
    });
    const outcome = await callRpc(url, 'echo');
    expect(outcome.error?.code).toBe(TRANSPORT_ERROR);
    expect(outcome.error?.message).toMatch(/HTTP 502/);
  });

  it('wraps connection failures as transport errors', async () => {
    const outcome = await callRpc('http://127.0.0.1:1/rpc', 'echo', undefined, 'http', 500);
    expect(outcome.error?.code).toBe(TRANSPORT_ERROR);
  });

  it('rejects id mismatches', async () => {
    const url = await listen((_body, res) => {
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 999999, result: 'wrong' }));
    });
    const outcome = await callRpc(url, 'echo');
    expect(outcome.error?.message).toMatch(/id mismatch/);
  });
});

describe('callRpc over WebSocket', () => {
  it('sends and receives over ws, converting http URLs', async () => {
    const url = await listen((_body, res) => res.end());
    wss = new WebSocketServer({ server: server! });
    wss.on('connection', (socket) => {
      socket.on('message', (data) => {
        const request = JSON.parse(String(data));
        socket.send(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: 'pong' }));
      });
    });
    const outcome = await callRpc(url, 'ping', undefined, 'websocket', 3000);
    expect(outcome.error).toBeUndefined();
    expect(outcome.result).toBe('pong');
  });

  it('times out when the server stays silent', async () => {
    const url = await listen((_body, res) => res.end());
    wss = new WebSocketServer({ server: server! });
    const outcome = await callRpc(url, 'ping', undefined, 'websocket', 200);
    expect(outcome.error?.code).toBe(TRANSPORT_ERROR);
    expect(outcome.error?.message).toMatch(/timeout/i);
  });
});