// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { flushSync, mount as svelteMount, unmount } from 'svelte';
import { Clef } from './svelte';
import type { MountOptions } from './public';
import type { OpenRPCDocument } from './core/types';

const spec: OpenRPCDocument = {
  openrpc: '1.3.2',
  info: { title: 'Component Test API', version: '0.0.1' },
  methods: [
    { name: 'echo', summary: 'Echo a message', result: { name: 'echoed', schema: { type: 'string' } } },
    { name: 'ping', summary: 'No params', result: { name: 'pong', schema: { type: 'string' } } }
  ]
};

let target: HTMLDivElement | undefined;

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

afterEach(() => {
  target?.remove();
  target = undefined;
});

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
const click = (element: Element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

describe('<Clef> svelte component', () => {
  it('applies replaced and mutated options without reloading the document', async () => {
    target = document.createElement('div');
    document.body.appendChild(target);
    const props = $state<{ options: MountOptions }>({ options: { spec } });
    const component = svelteMount(Clef, { target, props });
    await tick();
    flushSync();
    expect(target.textContent).toContain('Component Test API');

    const ping = [...target.querySelectorAll<HTMLButtonElement>('nav .item')].find((button) =>
      button.textContent?.includes('ping')
    )!;
    click(ping);
    await tick();
    flushSync();
    expect(target.querySelector('.content h2 code')?.textContent).toBe('ping');

    props.options = { spec, theme: 'dark' };
    await tick();
    flushSync();
    expect(target.querySelector('.clef')?.getAttribute('data-theme')).toBe('dark');
    expect(target.querySelector('.content h2 code')?.textContent).toBe('ping');
    expect(target.querySelector('.spinner')).toBeNull();

    props.options.theme = 'light';
    await tick();
    flushSync();
    expect(target.querySelector('.clef')?.getAttribute('data-theme')).toBe('light');
    expect(target.querySelector('.content h2 code')?.textContent).toBe('ping');
    expect(target.querySelector('.spinner')).toBeNull();

    unmount(component);
  });
});
