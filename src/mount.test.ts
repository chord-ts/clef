// @vitest-environment jsdom
import { createServer, type Server } from 'node:http';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { mount } from './mount.svelte';
import { registerElement } from './element';
import type { OpenRPCDocument } from './core/types';

const spec: OpenRPCDocument = {
  openrpc: '1.3.2',
  info: { title: 'Mount Test API', version: '0.0.1' },
  methods: [
    {
      name: 'echo',
      summary: 'Echo a message',
      tags: [{ name: 'util' }],
      params: [{ name: 'message', required: true, schema: { type: 'string', examples: ['hello'] } }],
      result: { name: 'echoed', schema: { type: 'string' } }
    },
    { name: 'ping', summary: 'No params', result: { name: 'pong', schema: { type: 'string' } } }
  ]
};

let server: Server | undefined;
let container: HTMLDivElement | undefined;

beforeAll(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
  Element.prototype.scrollTo = () => {};
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: () => {
      const animation = { onfinish: null as (() => void) | null, oncancel: null as (() => void) | null, cancel: () => {} };
      setTimeout(() => animation.onfinish?.(), 0);
      return animation;
    }
  });
});

afterEach(async () => {
  container?.remove();
  container = undefined;
  localStorage.clear();
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

function host(): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

function listen(): Promise<string> {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const request = JSON.parse(raw);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: request.params?.message ?? 'pong' }));
    });
  });
  return new Promise((resolve) => {
    server!.listen(0, '127.0.0.1', () => {
      const address = server!.address();
      resolve(typeof address === 'object' && address ? `http://127.0.0.1:${address.port}/rpc` : '');
    });
  });
}

describe('mount', () => {
  it('renders an inline spec with sidebar and try-it panel, then destroys cleanly', async () => {
    const handle = mount(host(), { spec });
    await tick();
    flushSync();
    expect(container!.textContent).toContain('Mount Test API');
    expect(container!.textContent).toContain('echo');
    expect(container!.textContent).toContain('Try it');
    handle.destroy();
    flushSync();
    expect(container!.innerHTML).toBe('');
  });

  it('executes a request against a live endpoint', async () => {
    const url = await listen();
    const handle = mount(host(), { spec, endpoint: url });
    await tick();
    flushSync();
    const execute = [...container!.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Execute'
    );
    expect(execute).toBeDefined();
    execute!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(150);
    flushSync();
    expect(container!.textContent).toContain('Result');
    expect(container!.textContent).toMatch(/\d+ ms/);
    handle.destroy();
  });

  it('update() swaps the document', async () => {
    const handle = mount(host(), { spec });
    await tick();
    flushSync();
    handle.update({ spec: { ...spec, info: { ...spec.info, title: 'Updated API' } } });
    await tick();
    flushSync();
    expect(container!.textContent).toContain('Updated API');
    handle.destroy();
  });

  it('throws on a missing target', () => {
    expect(() => mount('#does-not-exist', { spec })).toThrow(/not found/);
  });

  it('renders try-it as a sibling island and switches JSON/curl/JS previews', async () => {
    const handle = mount(host(), { spec, endpoint: 'http://localhost:9/rpc' });
    await tick();
    flushSync();

    expect(container!.querySelector('.layout > .try')).toBeTruthy();
    const previewText = () => container!.querySelector('.preview')?.textContent ?? '';
    const previewButton = (text: string) =>
      [...container!.querySelectorAll<HTMLButtonElement>('.preview .toggle button')].find(
        (button) => button.textContent?.trim() === text
      )!;
    const click = (button: HTMLButtonElement) => button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(previewText()).toContain('"jsonrpc"');
    click(previewButton('curl'));
    await tick();
    flushSync();
    expect(previewText()).toContain('curl -X POST');
    expect(previewText()).toContain('http://localhost:9/rpc');

    const transportSelect = container!.querySelector<HTMLSelectElement>('.try select')!;
    transportSelect.value = 'websocket';
    transportSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    flushSync();
    expect(previewButton('curl').disabled).toBe(true);
    expect(previewText()).toContain('new WebSocket(');
    expect(previewText()).toContain('ws://localhost:9/rpc');

    transportSelect.value = 'http';
    transportSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    flushSync();
    click(previewButton('JS'));
    await tick();
    flushSync();
    expect(previewText()).toContain('await fetch(');
    handle.destroy();
  });

  it('collapses the sidebar to a rail and expands it back', async () => {
    const handle = mount(host(), { spec });
    await tick();
    flushSync();
    expect(container!.querySelector('.sidebar')).toBeTruthy();

    container!.querySelector<HTMLButtonElement>('.collapse')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick();
    flushSync();
    expect(container!.querySelector('.sidebar')).toBeNull();
    expect(container!.querySelector('.rail')).toBeTruthy();

    container!.querySelector<HTMLButtonElement>('.rail-btn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick();
    flushSync();
    expect(container!.querySelector('.sidebar')).toBeTruthy();
    expect(container!.querySelector('.rail')).toBeNull();
    handle.destroy();
  });

  it('resizes columns via divider keys and persists widths', async () => {
    const handle = mount(host(), { spec });
    await tick();
    flushSync();
    const layout = container!.querySelector<HTMLElement>('.layout')!;
    expect(layout.style.getPropertyValue('--sw')).toBe('280px');
    expect(layout.style.getPropertyValue('--tw')).toBe('500px');

    container!.querySelector<HTMLElement>('.d1')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    await tick();
    flushSync();
    expect(layout.style.getPropertyValue('--sw')).toBe('296px');

    container!.querySelector<HTMLElement>('.d2')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
    );
    await tick();
    flushSync();
    expect(layout.style.getPropertyValue('--tw')).toBe('516px');
    expect(JSON.parse(localStorage.getItem('clef:layout')!)).toEqual({ sidebarWidth: 296, tryWidth: 516 });
    handle.destroy();
  });

  it('collapses and expands tag groups, auto-expanding while searching', async () => {
    const handle = mount(host(), { spec });
    await tick();
    flushSync();

    const groupButton = () =>
      [...container!.querySelectorAll<HTMLButtonElement>('.group-name')].find((button) =>
        button.textContent?.includes('util')
      )!;
    const itemCount = () => container!.querySelectorAll('nav .item').length;

    expect(itemCount()).toBe(2);
    groupButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(250);
    flushSync();
    expect(itemCount()).toBe(1);
    expect(groupButton().getAttribute('aria-expanded')).toBe('false');

    const search = container!.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'echo';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    flushSync();
    expect(itemCount()).toBe(1);
    expect(container!.querySelector('nav .item')?.textContent).toContain('echo');

    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await tick(250);
    flushSync();
    expect(itemCount()).toBe(1);

    groupButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick(250);
    flushSync();
    expect(itemCount()).toBe(2);
    handle.destroy();
  });
});

describe('<clef-docs>', () => {
  it('renders from the spec property', async () => {
    registerElement();
    const element = document.createElement('clef-docs');
    host().appendChild(element);
    (element as HTMLElement & { spec: unknown }).spec = spec;
    await tick();
    flushSync();
    expect(element.textContent).toContain('Mount Test API');
    expect(element.textContent).toContain('echo');
  });

  it('renders from the spec attribute as a JSON string', async () => {
    registerElement();
    const element = document.createElement('clef-docs');
    element.setAttribute('spec', JSON.stringify(spec));
    host().appendChild(element);
    await tick();
    flushSync();
    expect(element.textContent).toContain('Mount Test API');
  });
});