import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { assertDocument, loadDocument } from './loader';
import type { OpenRPCDocument } from './types';

const doc: OpenRPCDocument = {
  openrpc: '1.3.2',
  info: { title: 'Test', version: '1.0.0' },
  methods: [{ name: 'ping' }]
};

let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

function listen(handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, body: string) => void): Promise<string> {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => handler(req, res, raw));
  });
  return new Promise((resolve) => {
    server!.listen(0, '127.0.0.1', () => {
      const address = server!.address();
      resolve(typeof address === 'object' && address ? `http://127.0.0.1:${address.port}` : '');
    });
  });
}

describe('assertDocument', () => {
  it('accepts a minimal document', () => {
    expect(() => assertDocument(doc)).not.toThrow();
  });

  it('rejects malformed documents with a reason', () => {
    expect(() => assertDocument(null)).toThrow(/expected an object/);
    expect(() => assertDocument({})).toThrow(/openrpc/);
    expect(() => assertDocument({ openrpc: '1.3.2' })).toThrow(/info\.title/);
    expect(() => assertDocument({ openrpc: '1.3.2', info: { title: 'x' } })).toThrow(/methods/);
    expect(() => assertDocument({ openrpc: '1.3.2', info: { title: 'x' }, methods: [{}] })).toThrow(/name/);
  });
});

describe('loadDocument', () => {
  it('loads an inline object', async () => {
    expect(await loadDocument({ spec: doc })).toBe(doc);
  });

  it('loads an inline JSON string', async () => {
    expect(await loadDocument({ spec: JSON.stringify(doc) })).toEqual(doc);
  });

  it('rejects an invalid inline spec', async () => {
    await expect(loadDocument({ spec: '{ nope' })).rejects.toThrow(/not valid JSON/);
    await expect(loadDocument({ spec: '{}' })).rejects.toThrow(/not a valid OpenRPC document/);
  });

  it('fetches a document from url', async () => {
    const base = await listen((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(doc));
    });
    expect(await loadDocument({ url: `${base}/openrpc.json` })).toEqual(doc);
  });

  it('reports HTTP failures on url', async () => {
    const base = await listen((_req, res) => {
      res.statusCode = 404;
      res.end('nope');
    });
    await expect(loadDocument({ url: `${base}/openrpc.json` })).rejects.toThrow(/HTTP 404/);
  });

  it('discovers a document via rpc.discover on the endpoint', async () => {
    const base = await listen((_req, res, body) => {
      const request = JSON.parse(body);
      expect(request.method).toBe('rpc.discover');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: doc }));
    });
    expect(await loadDocument({ endpoint: `${base}/rpc` })).toEqual(doc);
  });

  it('requires at least one source', async () => {
    await expect(loadDocument({})).rejects.toThrow(/spec, options\.url or options\.endpoint/);
  });
});