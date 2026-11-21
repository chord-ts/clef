import { mount } from './mount.svelte';
import type { ClefHandle, MountOptions, Theme, Transport } from './public';

class ClefDocsElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['spec', 'url', 'endpoint', 'transport', 'transports', 'theme', 'try-it', 'icon'];
  }

  #handle: ClefHandle | null = null;
  #spec: MountOptions['spec'] = undefined;
  #auth: MountOptions['auth'] = undefined;

  connectedCallback(): void {
    this.#handle ??= mount(this, this.#options());
  }

  disconnectedCallback(): void {
    this.#handle?.destroy();
    this.#handle = null;
  }

  attributeChangedCallback(): void {
    this.#handle?.update(this.#options());
  }

  get spec(): MountOptions['spec'] {
    return this.#spec;
  }

  set spec(value: MountOptions['spec']) {
    this.#spec = value;
    this.#handle?.update(this.#options());
  }

  get auth(): MountOptions['auth'] {
    return this.#auth;
  }

  set auth(value: MountOptions['auth']) {
    this.#auth = value;
    this.#handle?.update(this.#options());
  }

  #options(): MountOptions {
    const attr = (name: string): string | null => this.getAttribute(name);
    const specAttr = attr('spec');
    const transportsAttr = attr('transports');
    const transports = transportsAttr
      ? transportsAttr
          .split(',')
          .map((value) => value.trim())
          .filter((value): value is Transport => value === 'http' || value === 'websocket')
      : [];
    return {
      spec: this.#spec ?? (specAttr !== null ? specAttr : undefined),
      url: attr('url') ?? undefined,
      endpoint: attr('endpoint') ?? undefined,
      transport: (attr('transport') as Transport | null) ?? undefined,
      transports: transports.length ? transports : undefined,
      theme: (attr('theme') as Theme | null) ?? undefined,
      tryIt: this.hasAttribute('try-it') ? attr('try-it') !== 'false' : undefined,
      icon: attr('icon') ?? undefined,
      auth: this.#auth
    };
  }
}

export function registerElement(): void {
  if (!customElements.get('clef-docs')) {
    customElements.define('clef-docs', ClefDocsElement);
  }
}