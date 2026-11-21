import type { Transport } from './core/jsonrpc';
import type { AuthSettings } from './core/auth';
import type { OpenRPCDocument } from './core/types';

export type { Transport, AuthSettings };
export type { AuthScheme } from './core/auth';

export type Theme = 'light' | 'dark' | 'auto';

export interface MountOptions {
  spec?: OpenRPCDocument | string;
  url?: string;
  endpoint?: string;
  transport?: Transport;
  theme?: Theme;
  tryIt?: boolean;
  requestTimeoutMs?: number;
  icon?: string;
  auth?: AuthSettings;
}

export interface ClefHandle {
  update(options: MountOptions): void;
  destroy(): void;
}

export type {
  OpenRPCDocument,
  InfoObject,
  ServerObject,
  MethodObject,
  ContentDescriptorObject,
  SchemaObject,
  ReferenceObject,
  ErrorObject,
  ExamplePairingObject,
  ExampleObject,
  ComponentsObject,
  TagObject,
  ExternalDocsObject
} from './core/types';