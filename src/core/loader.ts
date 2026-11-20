import type { OpenRPCDocument } from './types';
import { callRpc, type Transport } from './jsonrpc';

export interface DocumentSource {
  spec?: OpenRPCDocument | string;
  url?: string;
  endpoint?: string;
  transport?: Transport;
}

export async function loadDocument(source: DocumentSource): Promise<OpenRPCDocument> {
  if (source.spec !== undefined && source.spec !== null) {
    const parsed = typeof source.spec === 'string' ? parseJson(source.spec, 'spec') : source.spec;
    assertDocument(parsed);
    return parsed;
  }
  if (source.url) {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`clef: failed to fetch ${source.url} — HTTP ${response.status}`);
    const parsed = parseJson(await response.text(), source.url);
    assertDocument(parsed);
    return parsed;
  }
  if (source.endpoint) {
    const outcome = await callRpc(source.endpoint, 'rpc.discover', undefined, source.transport ?? 'http');
    if (outcome.error) {
      throw new Error(`clef: rpc.discover at ${source.endpoint} failed — ${outcome.error.message}`);
    }
    assertDocument(outcome.result);
    return outcome.result;
  }
  throw new Error('clef: provide one of options.spec, options.url or options.endpoint');
}

function parseJson(text: string, origin: string): unknown {
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new Error(`clef: ${origin} is not valid JSON — ${cause instanceof Error ? cause.message : cause}`);
  }
}

export function assertDocument(value: unknown): asserts value is OpenRPCDocument {
  const fail = (reason: string) => new Error(`clef: not a valid OpenRPC document — ${reason}`);
  if (typeof value !== 'object' || value === null) throw fail('expected an object');
  const doc = value as Partial<OpenRPCDocument>;
  if (typeof doc.openrpc !== 'string') throw fail('missing "openrpc" version field');
  if (!doc.info || typeof doc.info.title !== 'string') throw fail('missing "info.title"');
  if (!Array.isArray(doc.methods)) throw fail('missing "methods" array');
  for (const method of doc.methods) {
    if (typeof method?.name !== 'string') throw fail('every method must have a string "name"');
  }
}