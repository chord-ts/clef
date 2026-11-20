import { describe, expect, it } from 'vitest';
import { deref, isReference, refName, resolveRef } from './refs';
import type { OpenRPCDocument } from './types';

const doc = {
  openrpc: '1.3.2',
  info: { title: 'Test', version: '1.0.0' },
  methods: [],
  components: {
    schemas: {
      Note: { type: 'object', properties: { id: { type: 'integer' } } },
      'weird/name~tilde': { type: 'string' }
    }
  }
} as unknown as OpenRPCDocument;

describe('isReference', () => {
  it('detects $ref objects', () => {
    expect(isReference({ $ref: '#/components/schemas/Note' })).toBe(true);
    expect(isReference({ type: 'string' })).toBe(false);
    expect(isReference(null)).toBe(false);
    expect(isReference('string')).toBe(false);
  });
});

describe('resolveRef', () => {
  it('resolves internal pointers', () => {
    expect(resolveRef(doc, '#/components/schemas/Note')).toEqual({
      type: 'object',
      properties: { id: { type: 'integer' } }
    });
    expect(resolveRef(doc, '#/info/title')).toBe('Test');
  });

  it('decodes JSON Pointer escapes', () => {
    expect(resolveRef(doc, '#/components/schemas/weird~1name~0tilde')).toEqual({ type: 'string' });
    expect(refName('#/components/schemas/weird~1name~0tilde')).toBe('weird/name~tilde');
  });

  it('throws on missing and external refs', () => {
    expect(() => resolveRef(doc, '#/components/schemas/Missing')).toThrow(/not found/);
    expect(() => resolveRef(doc, 'https://example.com/schema.json')).toThrow(/internal \$ref/);
  });
});

describe('deref', () => {
  it('follows ref chains', () => {
    const chained = {
      ...doc,
      components: { schemas: { ...doc.components!.schemas, Alias: { $ref: '#/components/schemas/Note' } } }
    } as OpenRPCDocument;
    expect(deref(chained, { $ref: '#/components/schemas/Alias' })).toEqual({
      type: 'object',
      properties: { id: { type: 'integer' } }
    });
  });

  it('passes plain schemas through', () => {
    const schema = { type: 'string' };
    expect(deref(doc, schema)).toBe(schema);
  });

  it('throws on circular ref chains', () => {
    const circular = {
      ...doc,
      components: { schemas: { A: { $ref: '#/components/schemas/B' }, B: { $ref: '#/components/schemas/A' } } }
    } as OpenRPCDocument;
    expect(() => deref(circular, { $ref: '#/components/schemas/A' })).toThrow(/circular/);
  });
});