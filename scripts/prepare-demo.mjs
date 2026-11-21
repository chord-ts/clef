import { cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'demo-dist');

mkdirSync(join(out, 'dist'), { recursive: true });
cpSync(join(root, 'demo', 'preview.html'), join(out, 'index.html'));
cpSync(join(root, 'dist', 'clef.iife.js'), join(out, 'dist', 'clef.iife.js'));
cpSync(join(root, 'demo', 'openrpc.json'), join(out, 'openrpc.json'));
console.log('demo-dist ready');