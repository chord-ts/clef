export type Transport = 'http' | 'websocket';

export interface RpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface RpcOutcome {
  request: RpcRequest;
  result?: unknown;
  error?: RpcError;
  durationMs: number;
}

export const TRANSPORT_ERROR = -32000;

let nextId = 1;

export function buildRequest(method: string, params?: unknown): RpcRequest {
  const request: RpcRequest = { jsonrpc: '2.0', id: nextId++, method };
  if (params !== undefined) request.params = params;
  return request;
}

export async function callRpc(
  endpoint: string,
  method: string,
  params?: unknown,
  transport: Transport = 'http',
  timeoutMs = 15000
): Promise<RpcOutcome> {
  const request = buildRequest(method, params);
  const started = performance.now();
  try {
    const response =
      transport === 'websocket'
        ? await wsCall(endpoint, request, timeoutMs)
        : await httpCall(endpoint, request, timeoutMs);
    return settle(request, response, started);
  } catch (cause) {
    return {
      request,
      error: {
        code: TRANSPORT_ERROR,
        message: cause instanceof Error ? cause.message : String(cause),
        data: { transport }
      },
      durationMs: performance.now() - started
    };
  }
}

function settle(request: RpcRequest, response: unknown, started: number): RpcOutcome {
  const durationMs = performance.now() - started;
  if (typeof response !== 'object' || response === null) {
    return { request, error: { code: TRANSPORT_ERROR, message: 'Invalid JSON-RPC response: not an object' }, durationMs };
  }
  const res = response as { jsonrpc?: unknown; id?: unknown; result?: unknown; error?: RpcError };
  if (res.jsonrpc !== '2.0' || res.id !== request.id) {
    return { request, error: { code: TRANSPORT_ERROR, message: 'Invalid JSON-RPC response: jsonrpc version or id mismatch' }, durationMs };
  }
  if (res.error !== undefined) return { request, error: res.error, durationMs };
  return { request, result: res.result, durationMs };
}

async function httpCall(endpoint: string, request: RpcRequest, timeoutMs: number): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${response.status}: response is not JSON (${text.slice(0, 120)})`);
  }
}

function wsUrl(endpoint: string): string {
  if (endpoint.startsWith('http://')) return 'ws://' + endpoint.slice(7);
  if (endpoint.startsWith('https://')) return 'wss://' + endpoint.slice(8);
  return endpoint;
}

function wsCall(endpoint: string, request: RpcRequest, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl(endpoint));
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`WebSocket timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    const done = (fn: () => void) => {
      clearTimeout(timer);
      socket.close();
      fn();
    };
    socket.addEventListener('open', () => socket.send(JSON.stringify(request)));
    socket.addEventListener('message', (event) => {
      try {
        const parsed = JSON.parse(String(event.data));
        done(() => resolve(parsed));
      } catch {
        done(() => reject(new Error('WebSocket response is not JSON')));
      }
    });
    socket.addEventListener('error', () => {
      done(() => reject(new Error(`WebSocket connection to ${wsUrl(endpoint)} failed`)));
    });
  });
}