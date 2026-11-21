<script lang="ts">
  import type { AuthScheme, AuthSettings, Theme } from '../public';
  import { authHeaders } from '../core/auth';
  import { version } from '../version';

  let {
    theme,
    ontheme,
    auth,
    onauth
  }: {
    theme: Theme;
    ontheme: (theme: Theme) => void;
    auth?: AuthSettings;
    onauth: (auth: AuthSettings | undefined) => void;
  } = $props();

  const modes: Theme[] = ['auto', 'light', 'dark'];
  // mask ids must stay unique when several widgets share one page
  const uid = Math.random().toString(36).slice(2, 8);
  const nextTheme = $derived(modes[(modes.indexOf(theme) + 1) % modes.length]);
  const configured = $derived(Object.keys(authHeaders(auth)).length > 0);
  const scheme = $derived(auth?.scheme ?? 'bearer');

  let authOpen = $state(false);
  let wrapEl = $state<HTMLElement | null>(null);
  let lockEl = $state<HTMLButtonElement | null>(null);

  function patch(fields: Partial<AuthSettings>) {
    onauth({ scheme, ...auth, ...fields });
  }

  function outside(event: PointerEvent) {
    if (authOpen && wrapEl && !wrapEl.contains(event.target as Node)) authOpen = false;
  }

  function keys(event: KeyboardEvent) {
    if (event.key === 'Escape' && authOpen) {
      authOpen = false;
      lockEl?.focus();
    }
  }
</script>

<svelte:document onpointerdown={outside} onkeydown={keys} />

<header class="toolbar">
  <a class="brand" href="https://github.com/chord-ts/clef" target="_blank" rel="noopener noreferrer">
    <svg class="mark" viewBox="0 0 256 256" width="20" height="20" aria-hidden="true">
      <polygon points="56.0,20.5 185.0,94.98 199.74,86.47 70.74,11.99" fill="#2DD4BF" />
      <polygon points="185.0,94.98 185.0,120.52 199.74,112.01 199.74,86.47" fill="#0F766E" />
      <polygon points="78.11,58.8 78.11,156.69 92.85,148.18 92.85,50.29" fill="#0F766E" />
      <polygon points="78.11,156.69 185.0,218.4 199.74,209.89 92.85,148.18" fill="#2DD4BF" />
      <polygon points="185.0,218.4 185.0,243.94 199.74,235.43 199.74,209.89" fill="#0F766E" />
      <polygon points="56.0,20.5 185.0,94.98 185.0,120.52 78.11,58.8 78.11,156.69 185.0,218.4 185.0,243.94 56.0,169.46" fill="#0D9488" />
      <polygon points="95.62,88.6 120.96,132.49 95.62,147.12 115.89,158.82 141.23,144.19 115.89,100.3" fill="#F59E0B" />
      <polygon points="151.83,155.63 188.69,176.91 188.69,200.32 151.83,179.04" fill="#F59E0B" />
    </svg>
    <strong>clef</strong>
  </a>
  <span class="version">v{version}</span>
  <span class="spacer"></span>
  <button
    type="button"
    class="icon-btn"
    data-mode={theme}
    onclick={() => ontheme(nextTheme)}
    title="Theme: {theme} — switch to {nextTheme}"
    aria-label="Theme: {theme}. Switch to {nextTheme}"
  >
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <mask id="tm-{uid}">
        <rect width="24" height="24" fill="white" />
        <circle class="moon-cut" cx="24" cy="10" r="6" fill="black" />
      </mask>
      <mask id="am-{uid}">
        <rect width="24" height="24" fill="white" />
        <circle cx="9.5" cy="9.5" r="4.5" fill="black" />
      </mask>
      <circle class="sun-core" cx="12" cy="12" r="6" fill="currentColor" mask="url(#tm-{uid})" />
      <g class="auto-glyph">
        <g transform="translate(24 0) scale(-1 1)">
          <g transform="translate(-0.7 0.7)">
            <path d="M7.76 7.76A6 6 0 0 0 16.24 16.24Z" fill="currentColor" />
            <g stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="4" y1="12" x2="2" y2="12" />
              <line x1="12" y1="20" x2="12" y2="22" />
              <line x1="6.34" y1="17.66" x2="4.93" y2="19.07" />
            </g>
          </g>
          <path
            d="M6.7 6.7A7.5 7.5 0 0 1 17.3 17.3Z"
            transform="translate(0.7 -0.7)"
            fill="currentColor"
            mask="url(#am-{uid})"
          />
        </g>
      </g>
      <g class="beams" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </g>
    </svg>
  </button>
  <div class="auth" bind:this={wrapEl}>
    <button
      type="button"
      class="icon-btn"
      class:configured
      bind:this={lockEl}
      onclick={() => (authOpen = !authOpen)}
      aria-expanded={authOpen}
      aria-label="Authorization settings"
      title="Authorization settings"
    >
      {#if configured}
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <rect x="3" y="7" width="10" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.5" />
          <circle cx="8" cy="10.5" r="1.2" fill="currentColor" />
        </svg>
      {:else}
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <rect x="3" y="7" width="10" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 4.9-.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      {/if}
    </button>
    {#if authOpen}
      <div class="menu" role="dialog" aria-label="Authorization">
        <label>
          Scheme
          <select value={scheme} onchange={(event) => patch({ scheme: event.currentTarget.value as AuthScheme })}>
            <option value="bearer">Bearer token</option>
            <option value="basic">Basic (user + password)</option>
            <option value="custom">Custom header</option>
          </select>
        </label>
        {#if scheme === 'bearer'}
          <label>
            Token
            <input
              type="password"
              value={auth?.token ?? ''}
              oninput={(event) => patch({ token: event.currentTarget.value })}
              placeholder="eyJhbGciOi…"
              autocomplete="off"
            />
          </label>
        {:else if scheme === 'basic'}
          <label>
            Username
            <input
              value={auth?.username ?? ''}
              oninput={(event) => patch({ username: event.currentTarget.value })}
              autocomplete="off"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={auth?.password ?? ''}
              oninput={(event) => patch({ password: event.currentTarget.value })}
              autocomplete="off"
            />
          </label>
        {:else}
          <label>
            Header name
            <input
              value={auth?.headerName ?? ''}
              oninput={(event) => patch({ headerName: event.currentTarget.value })}
              placeholder="X-API-Key"
              autocomplete="off"
            />
          </label>
          <label>
            Header value
            <input
              type="password"
              value={auth?.headerValue ?? ''}
              oninput={(event) => patch({ headerValue: event.currentTarget.value })}
              autocomplete="off"
            />
          </label>
        {/if}
        <div class="menu-foot">
          <span class="hint">{configured ? 'Sent with spec fetch and HTTP calls' : 'No authorization'}</span>
          <button type="button" class="clear" onclick={() => onauth(undefined)}>Clear</button>
        </div>
      </div>
    {/if}
  </div>
</header>

<style>
  .toolbar {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    background: var(--clef-bg-soft);
    border-bottom: 1px solid var(--clef-border);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--clef-text);
    text-decoration: none;
  }

  .brand strong {
    font-size: 14px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .brand:hover strong {
    color: var(--clef-accent);
  }

  .mark {
    display: block;
  }

  .version {
    font-family: var(--clef-mono);
    font-size: 11px;
    color: var(--clef-muted);
    background: var(--clef-bg-inset);
    border: 1px solid var(--clef-border);
    border-radius: 999px;
    padding: 2px 9px;
  }

  .spacer {
    flex: 1;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 7px;
    border: 1px solid var(--clef-border);
    background: var(--clef-bg);
    color: var(--clef-muted);
    cursor: pointer;
  }

  .icon-btn:hover {
    color: var(--clef-accent);
    border-color: var(--clef-accent);
    background: var(--clef-accent-soft);
  }

  .icon-btn:focus-visible {
    outline: none;
    border-color: var(--clef-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--clef-accent) 18%, transparent);
  }

  .icon-btn.configured {
    color: var(--clef-accent);
    border-color: color-mix(in srgb, var(--clef-accent) 35%, var(--clef-border));
    background: var(--clef-accent-soft);
  }

  .auth {
    position: relative;
    display: flex;
  }

  .menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    min-width: 260px;
    background: var(--clef-bg);
    border: 1px solid var(--clef-border);
    border-radius: 10px;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.25);
  }

  .menu label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--clef-muted);
  }

  .menu input,
  .menu select {
    font-size: 13px;
    padding: 6px 8px;
    border-radius: 7px;
    border: 1px solid var(--clef-border);
    background: var(--clef-bg-inset);
    color: var(--clef-text);
  }

  .menu input:focus-visible,
  .menu select:focus-visible {
    outline: none;
    border-color: var(--clef-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--clef-accent) 18%, transparent);
  }

  .menu-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .hint {
    font-size: 11px;
    color: var(--clef-muted);
  }

  .clear {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 7px;
    border: 1px solid var(--clef-border);
    background: transparent;
    color: var(--clef-muted);
    cursor: pointer;
  }

  .clear:hover {
    color: var(--clef-danger);
    border-color: var(--clef-danger);
  }

  .sun-core,
  .beams {
    transform-box: fill-box;
    transform-origin: center;
  }

  .sun-core,
  .moon-cut {
    transition:
      transform 300ms var(--clef-ease-out),
      opacity 200ms ease;
  }

  .auto-glyph {
    transform-box: fill-box;
    transform-origin: center;
    opacity: 0;
    transform: rotate(-45deg);
    transition:
      transform 300ms var(--clef-ease-out),
      opacity 200ms ease;
  }

  .beams {
    transition:
      transform 300ms var(--clef-ease-out),
      opacity 200ms ease;
  }

  .icon-btn[data-mode='dark'] .sun-core {
    transform: scale(1.5);
  }

  .icon-btn[data-mode='dark'] .moon-cut {
    transform: translateX(-7px);
  }

  .icon-btn[data-mode='dark'] .beams {
    transform: rotate(-25deg);
    opacity: 0;
  }

  .icon-btn[data-mode='auto'] .sun-core {
    opacity: 0;
  }

  .icon-btn[data-mode='auto'] .auto-glyph {
    opacity: 1;
    transform: rotate(0deg);
  }

  .icon-btn[data-mode='auto'] .beams {
    transform: rotate(-25deg);
    opacity: 0;
  }

  @media (max-width: 900px) {
    .toolbar {
      padding: 8px 12px;
    }

    .version {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sun-core,
    .moon-cut,
    .auto-glyph,
    .beams {
      transition: none;
    }
  }
</style>