export interface OpenRPCDocument {
  openrpc: string;
  info: InfoObject;
  servers?: ServerObject[];
  methods: MethodObject[];
  components?: ComponentsObject;
  externalDocs?: ExternalDocsObject;
  [key: `x-${string}`]: unknown;
}

export interface InfoObject {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: { name?: string; url?: string; email?: string };
  license?: { name: string; url?: string };
}

export interface ServerObject {
  name: string;
  url: string;
  summary?: string;
  description?: string;
  variables?: Record<string, { default: string; description?: string; enum?: string[] }>;
}

export interface ExternalDocsObject {
  url: string;
  description?: string;
}

export interface TagObject {
  name: string;
  summary?: string;
  description?: string;
  externalDocs?: ExternalDocsObject;
}

export interface MethodObject {
  name: string;
  summary?: string;
  description?: string;
  tags?: TagObject[];
  params?: (ContentDescriptorObject | ReferenceObject)[];
  result?: ContentDescriptorObject | ReferenceObject;
  errors?: (ErrorObject | ReferenceObject)[];
  examples?: (ExamplePairingObject | ReferenceObject)[];
  deprecated?: boolean;
  paramStructure?: 'by-name' | 'by-position' | 'either';
  externalDocs?: ExternalDocsObject;
  servers?: ServerObject[];
  [key: `x-${string}`]: unknown;
}

export interface ContentDescriptorObject {
  name: string;
  summary?: string;
  description?: string;
  required?: boolean;
  schema: SchemaObject | ReferenceObject;
  deprecated?: boolean;
}

export interface ReferenceObject {
  $ref: string;
}

export type SchemaObject = {
  $ref?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  properties?: Record<string, SchemaObject | ReferenceObject>;
  required?: string[];
  items?: SchemaObject | ReferenceObject | (SchemaObject | ReferenceObject)[];
  additionalProperties?: boolean | SchemaObject | ReferenceObject;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  examples?: unknown[];
  format?: string;
  oneOf?: (SchemaObject | ReferenceObject)[];
  anyOf?: (SchemaObject | ReferenceObject)[];
  allOf?: (SchemaObject | ReferenceObject)[];
  not?: SchemaObject | ReferenceObject;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  [key: string]: unknown;
};

export interface ErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

export interface ExamplePairingObject {
  name: string;
  summary?: string;
  description?: string;
  params?: (ExampleObject | ReferenceObject)[];
  result?: ExampleObject | ReferenceObject;
}

export interface ExampleObject {
  name: string;
  summary?: string;
  description?: string;
  value: unknown;
}

export interface ComponentsObject {
  schemas?: Record<string, SchemaObject>;
  contentDescriptors?: Record<string, ContentDescriptorObject>;
  errors?: Record<string, ErrorObject>;
  examples?: Record<string, ExampleObject>;
  tags?: Record<string, TagObject>;
}