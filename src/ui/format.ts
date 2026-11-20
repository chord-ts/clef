import { deref, isReference, refName } from '../core/refs';
import type { OpenRPCDocument, ReferenceObject, SchemaObject } from '../core/types';

export function safeDeref(doc: OpenRPCDocument, schema: SchemaObject | ReferenceObject): SchemaObject {
  try {
    return deref(doc, schema);
  } catch {
    return {};
  }
}

export function typeLabel(doc: OpenRPCDocument, schema: SchemaObject | ReferenceObject): string {
  if (isReference(schema)) return refName(schema.$ref);
  if (schema.oneOf) return 'one of';
  if (schema.anyOf) return 'any of';
  if (schema.allOf) return 'all of';
  const type = Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type;
  if (schema.enum) return type ? `${type} enum` : 'enum';
  if (type) return schema.format ? `${type} · ${schema.format}` : type;
  if (schema.properties) return 'object';
  return 'any';
}