import { describe, expect, it } from 'vitest';
import { exampleParams, exampleResult, exampleValue, paramsByName } from './examples';
import type { MethodObject, OpenRPCDocument } from './types';

const doc = {
  openrpc: '1.3.2',
  info: { title: 'Test', version: '1.0.0' },
  methods: [],
  components: {
    schemas: {
      Note: {
        type: 'object',
        properties: { id: { type: 'integer' }, title: { type: 'string' } }
      }
    }
  }
} as unknown as OpenRPCDocument;

describe('exampleValue', () => {
  it('generates primitives', () => {
    expect(exampleValue(doc, { type: 'string' })).toBe('string');
    expect(exampleValue(doc, { type: 'integer' })).toBe(0);
    expect(exampleValue(doc, { type: 'number', minimum: 3 })).toBe(3);
    expect(exampleValue(doc, { type: 'boolean' })).toBe(true);
    expect(exampleValue(doc, { type: 'null' })).toBeNull();
  });

  it('prefers examples, default, const and enum', () => {
    expect(exampleValue(doc, { type: 'string', examples: ['a'], default: 'b' })).toBe('a');
    expect(exampleValue(doc, { type: 'string', default: 'b', enum: ['c'] })).toBe('b');
    expect(exampleValue(doc, { const: 42 })).toBe(42);
    expect(exampleValue(doc, { enum: ['x', 'y'] })).toBe('x');
  });

  it('handles string formats', () => {
    expect(exampleValue(doc, { type: 'string', format: 'email' })).toBe('user@example.com');
    expect(exampleValue(doc, { type: 'string', format: 'uuid' })).toMatch(/^[0-9a-f-]{36}$/);
    expect(exampleValue(doc, { type: 'string', format: 'date-time' })).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('builds objects and arrays recursively', () => {
    expect(
      exampleValue(doc, {
        type: 'object',
        properties: { title: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }
      })
    ).toEqual({ title: 'string', tags: ['string'] });
    expect(exampleValue(doc, { type: 'array', items: { type: 'integer' } })).toEqual([0]);
  });

  it('resolves $ref and takes the first oneOf/anyOf branch', () => {
    expect(exampleValue(doc, { $ref: '#/components/schemas/Note' })).toEqual({ id: 0, title: 'string' });
    expect(exampleValue(doc, { oneOf: [{ type: 'string' }, { type: 'integer' }] })).toBe('string');
    expect(exampleValue(doc, { anyOf: [{ type: 'boolean' }] })).toBe(true);
  });

  it('merges allOf object branches', () => {
    expect(
      exampleValue(doc, {
        allOf: [
          { type: 'object', properties: { a: { type: 'integer' } } },
          { type: 'object', properties: { b: { type: 'string' } } }
        ]
      })
    ).toEqual({ a: 0, b: 'string' });
  });

  it('survives recursive schemas', () => {
    const recursive = {
      ...doc,
      components: {
        schemas: {
          Node: {
            type: 'object',
            properties: { value: { type: 'integer' }, next: { $ref: '#/components/schemas/Node' } }
          }
        }
      }
    } as OpenRPCDocument;
    const value = exampleValue(recursive, { $ref: '#/components/schemas/Node' }) as Record<string, unknown>;
    expect(value.value).toBe(0);
    expect(value.next).toBeNull();
  });
});

describe('paramsByName', () => {
  const method = (paramStructure?: MethodObject['paramStructure']): MethodObject => ({
    name: 'm',
    paramStructure,
    params: [{ name: 'a', schema: { type: 'string' } }]
  });
  it('defaults to by-name when all params are named', () => {
    expect(paramsByName(method())).toBe(true);
    expect(paramsByName(method('by-position'))).toBe(false);
    expect(paramsByName(method('by-name'))).toBe(true);
  });
});

describe('exampleParams / exampleResult', () => {
  const method: MethodObject = {
    name: 'notes.create',
    params: [
      { name: 'title', schema: { type: 'string' } },
      { name: 'count', schema: { type: 'integer' } }
    ],
    result: { name: 'note', schema: { $ref: '#/components/schemas/Note' } }
  };

  it('builds by-name params from schemas', () => {
    expect(exampleParams(doc, method)).toEqual({ title: 'string', count: 0 });
    expect(exampleResult(doc, method)).toEqual({ id: 0, title: 'string' });
  });

  it('builds by-position params', () => {
    expect(exampleParams(doc, { ...method, paramStructure: 'by-position' })).toEqual(['string', 0]);
  });

  it('prefers method example pairings', () => {
    const withExamples: MethodObject = {
      ...method,
      examples: [
        {
          name: 'demo',
          params: [
            { name: 'title', value: 'Hello' },
            { name: 'count', value: 7 }
          ],
          result: { name: 'note', value: { id: 1, title: 'Hello' } }
        }
      ]
    };
    expect(exampleParams(doc, withExamples)).toEqual({ title: 'Hello', count: 7 });
    expect(exampleResult(doc, withExamples)).toEqual({ id: 1, title: 'Hello' });
  });

  it('returns undefined for parameterless methods', () => {
    expect(exampleParams(doc, { name: 'ping' })).toBeUndefined();
    expect(exampleResult(doc, { name: 'ping' })).toBeUndefined();
  });
});