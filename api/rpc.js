import { Hono } from 'hono';
import { handle } from '@hono/vercel';
import spec from '../demo/openrpc.json' with { type: 'json' };
import { dispatch } from '../demo/mock.mjs';

// hono/vercel passes the original URL including the /api prefix of the function path
const app = new Hono().basePath('/api');

app.post('/rpc', async (c) => {
  let request;
  try {
    request = await c.req.json();
  } catch {
    return c.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  const response = dispatch(request, spec);
  if (response === undefined) return c.body(null, 204);
  return c.json(response);
});

app.get('/rpc', (c) => c.body(null, 405));

export const GET = handle(app);
export const POST = handle(app);