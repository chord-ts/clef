import type { ContentDescriptorObject, MethodObject, OpenRPCDocument, ReferenceObject, SchemaObject } from './types';
import { deref, isReference } from './refs';

const MAX_DEPTH = 6;

export function exampleValue(doc: OpenRPCDocument, schema: SchemaObject | ReferenceObject, seen: ReadonlySet<string> = new Set()): unknown {
  if (isReference(schema)) {
    if (seen.has(schema.$ref)) return null;
    return exampleValue(doc, deref(doc, schema), new Set([...seen, schema.$ref]));
  }
  if (schema.examples?.length) return schema.examples[0];
  if (schema.default !== undefined) return schema.default;
  if (schema.const !== undefined) return schema.const;
  if (schema.enum?.length) return schema.enum[0];
  if (schema.oneOf?.length) return exampleValue(doc, schema.oneOf[0], seen);
  if (schema.anyOf?.length) return exampleValue(doc, schema.anyOf[0], seen);
  if (schema.allOf?.length) {
    const parts = schema.allOf.map((part) => exampleValue(doc, part, seen));
    if (parts.every((p) => typeof p === 'object' && p !== null && !Array.isArray(p))) {
      return Object.assign({}, ...parts);
    }
    return parts[0];
  }
  if (seen.size >= MAX_DEPTH) return null;

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case 'object':
      return objectExample(doc, schema, seen);
    case 'array': {
      const items = Array.isArray(schema.items) ? schema.items[0] : schema.items;
      return items ? [exampleValue(doc, items, seen)] : [];
    }
    case 'string':
      return stringExample(schema.format);
    case 'integer':
    case 'number':
      return schema.minimum ?? 0;
    case 'boolean':
      return true;
    case 'null':
      return null;
    default:
      if (schema.properties) return objectExample(doc, schema, seen);
      if (schema.items) return exampleValue(doc, { ...schema, type: 'array' }, seen);
      return null;
  }
}

function objectExample(doc: OpenRPCDocument, schema: SchemaObject, seen: ReadonlySet<string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    result[name] = exampleValue(doc, property, seen);
  }
  return result;
}

function stringExample(format?: string): string {
  switch (format) {
    case 'date-time':
      return new Date().toISOString();
    case 'date':
      return new Date().toISOString().slice(0, 10);
    case 'time':
      return '12:00:00Z';
    case 'uuid':
      return '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
    case 'email':
    case 'idn-email':
      return 'user@example.com';
    case 'uri':
    case 'url':
    case 'uri-reference':
      return 'https://example.com';
    case 'hostname':
    case 'idn-hostname':
      return 'example.com';
    case 'ipv4':
      return '127.0.0.1';
    case 'ipv6':
      return '::1';
    case 'byte':
      return 'aGVsbG8=';
    default:
      return 'string';
  }
}

export function paramsByName(method: MethodObject): boolean {
  if (method.paramStructure === 'by-position') return false;
  if (method.paramStructure === 'by-name') return true;
  return (method.params ?? []).every((param) => !isReference(param) && typeof param.name === 'string');
}

export function resolveDescriptor(doc: OpenRPCDocument, descriptor: ContentDescriptorObject | ReferenceObject): ContentDescriptorObject {
  return isReference(descriptor) ? (deref(doc, descriptor) as unknown as ContentDescriptorObject) : descriptor;
}

export function exampleParams(doc: OpenRPCDocument, method: MethodObject): unknown {
  const params = method.params ?? [];
  if (params.length === 0) return undefined;

  const pairing = method.examples?.[0];
  if (pairing && !isReference(pairing) && pairing.params?.length) {
    const values = pairing.params.map((example) => (isReference(example) ? undefined : example.value));
    if (values.every((value) => value !== undefined)) {
      if (paramsByName(method)) {
        return Object.fromEntries(params.map((param, i) => [resolveDescriptor(doc, param).name, values[i]]));
      }
      return values;
    }
  }

  const schemas = params.map((param) => exampleValue(doc, resolveDescriptor(doc, param).schema));
  if (paramsByName(method)) {
    return Object.fromEntries(params.map((param, i) => [resolveDescriptor(doc, param).name, schemas[i]]));
  }
  return schemas;
}

export function exampleResult(doc: OpenRPCDocument, method: MethodObject): unknown {
  const pairing = method.examples?.[0];
  if (pairing && !isReference(pairing) && pairing.result && !isReference(pairing.result)) {
    return pairing.result.value;
  }
  if (!method.result) return undefined;
  return exampleValue(doc, resolveDescriptor(doc, method.result).schema);
}