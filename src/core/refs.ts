import type { OpenRPCDocument, ReferenceObject, SchemaObject } from './types';

export function isReference(value: unknown): value is ReferenceObject {
  return typeof value === 'object' && value !== null && typeof (value as ReferenceObject).$ref === 'string';
}

export function refName(ref: string): string {
  const segment = ref.split('/').pop() ?? ref;
  return decodeURIComponent(segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

export function resolveRef(doc: OpenRPCDocument, ref: string): unknown {
  if (!ref.startsWith('#/')) {
    throw new Error(`clef: only internal $ref is supported, got "${ref}"`);
  }
  const segments = ref
    .slice(2)
    .split('/')
    .map((s) => decodeURIComponent(s.replace(/~1/g, '/').replace(/~0/g, '~')));
  let current: unknown = doc;
  for (const segment of segments) {
    if (typeof current !== 'object' || current === null || !(segment in current)) {
      throw new Error(`clef: $ref "${ref}" not found in document`);
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function deref(doc: OpenRPCDocument, schema: SchemaObject | ReferenceObject): SchemaObject {
  let current: SchemaObject | ReferenceObject = schema;
  const seen = new Set<string>();
  while (isReference(current)) {
    const ref = current.$ref;
    if (seen.has(ref)) {
      throw new Error(`clef: circular $ref chain at "${ref}"`);
    }
    seen.add(ref);
    current = resolveRef(doc, ref) as SchemaObject | ReferenceObject;
  }
  return current;
}