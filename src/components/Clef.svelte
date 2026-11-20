<script lang="ts">
  import { loadDocument } from '../core/loader';
  import type { OpenRPCDocument } from '../core/types';
  import type { MountOptions } from '../public';
  import Sidebar from './Sidebar.svelte';
  import MethodView from './MethodView.svelte';
  import TryIt from './TryIt.svelte';

  let { options }: { options: MountOptions } = $props();

  let doc = $state<OpenRPCDocument | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let selectedName = $state<string | null>(null);
  let query = $state('');
  let mainEl = $state<HTMLElement | null>(null);
  let prefersDark = $state(false);
  let loadToken = 0;

  const DEFAULT_SIDEBAR_WIDTH = 280;
  const DEFAULT_TRY_WIDTH = 500;
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  function readLayout(): { sidebarWidth?: unknown; tryWidth?: unknown } {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem('clef:layout') ?? '{}');
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  const saved = readLayout();
  let sidebarWidth = $state(
    typeof saved.sidebarWidth === 'number' ? clamp(saved.sidebarWidth, 180, 480) : DEFAULT_SIDEBAR_WIDTH
  );
  let tryWidth = $state(typeof saved.tryWidth === 'number' ? clamp(saved.tryWidth, 320, 720) : DEFAULT_TRY_WIDTH);
  let sidebarCollapsed = $state(false);
  let dragging = $state(false);

  function saveLayout() {
    try {
      localStorage.setItem('clef:layout', JSON.stringify({ sidebarWidth, tryWidth }));
    } catch {
      // host page may block storage — resizing still works in memory
    }
  }

  function startDrag(event: PointerEvent, which: 'sidebar' | 'try') {
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = which === 'sidebar' ? sidebarWidth : tryWidth;
    dragging = true;
    const move = (e: PointerEvent) => {
      const delta = e.clientX - startX;
      if (which === 'sidebar') sidebarWidth = clamp(startWidth + delta, 180, 480);
      else tryWidth = clamp(startWidth - delta, 320, 720);
    };
    const up = () => {
      dragging = false;
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      saveLayout();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  function resizeKey(event: KeyboardEvent, which: 'sidebar' | 'try') {
    const step = event.key === 'ArrowRight' ? 16 : event.key === 'ArrowLeft' ? -16 : 0;
    if (step === 0) return;
    event.preventDefault();
    if (which === 'sidebar') sidebarWidth = clamp(sidebarWidth + step, 180, 480);
    else tryWidth = clamp(tryWidth - step, 320, 720);
    saveLayout();
  }

  $effect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    prefersDark = media.matches;
    const onChange = (event: MediaQueryListEvent) => (prefersDark = event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  });

  const theme = $derived(
    options.theme === 'dark' || ((options.theme ?? 'auto') === 'auto' && prefersDark) ? 'dark' : 'light'
  );

  $effect(() => {
    const source = options;
    const token = ++loadToken;
    loading = true;
    loadError = null;
    loadDocument(source)
      .then((loaded) => {
        if (token !== loadToken) return;
        doc = loaded;
        selectedName = loaded.methods[0]?.name ?? null;
        query = '';
        loading = false;
      })
      .catch((error: unknown) => {
        if (token !== loadToken) return;
        loadError = error instanceof Error ? error.message : String(error);
        loading = false;
      });
  });

  const selectedMethod = $derived(doc?.methods.find((method) => method.name === selectedName) ?? null);
  const tryItEnabled = $derived(options.tryIt !== false);

  $effect(() => {
    selectedName;
    mainEl?.scrollTo({ top: 0 });
  });
</script>

<div class="clef" data-theme={theme}>
  {#if loading}
    <div class="state">
      <div class="spinner"></div>
      <p>Loading OpenRPC document…</p>
    </div>
  {:else if loadError}
    <div class="state">
      <div class="error-card">
        <h2>Failed to load document</h2>
        <p class="error-message">{loadError}</p>
        <p class="hint">Pass a spec inline, a url to the document, or an endpoint supporting rpc.discover.</p>
      </div>
    </div>
  {:else if doc}
    <div
      class="layout"
      class:no-try={!tryItEnabled}
      class:collapsed={sidebarCollapsed}
      class:dragging
      style="--sw: {sidebarWidth}px; --tw: {tryWidth}px"
    >
      {#if sidebarCollapsed}
        <div class="rail">
          <button
            type="button"
            class="rail-btn"
            onclick={() => (sidebarCollapsed = false)}
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M7.5 3.5L12 8l-4.5 4.5M3.5 3.5L8 8l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      {:else}
        <Sidebar {doc} bind:query bind:selected={selectedName} oncollapse={() => (sidebarCollapsed = true)} />
        <!-- WAI-ARIA window splitter: a focusable separator is interactive, but Svelte's a11y checker doesn't model this exception -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
        <div
          class="divider d1"
          role="separator"
          tabindex="0"
          aria-label="Resize sidebar"
          aria-valuenow={sidebarWidth}
          aria-valuemin={180}
          aria-valuemax={480}
          onpointerdown={(event) => startDrag(event, 'sidebar')}
          onkeydown={(event) => resizeKey(event, 'sidebar')}
          ondblclick={() => {
            sidebarWidth = DEFAULT_SIDEBAR_WIDTH;
            saveLayout();
          }}
        ></div>
      {/if}
      <main class="content" bind:this={mainEl}>
        {#if selectedMethod}
          {#key selectedMethod.name}
            <MethodView {doc} method={selectedMethod} />
          {/key}
        {:else}
          <div class="state"><p>This document declares no methods.</p></div>
        {/if}
      </main>
      {#if tryItEnabled && selectedMethod}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
        <div
          class="divider d2"
          role="separator"
          tabindex="0"
          aria-label="Resize try it"
          aria-valuenow={tryWidth}
          aria-valuemin={320}
          aria-valuemax={720}
          onpointerdown={(event) => startDrag(event, 'try')}
          onkeydown={(event) => resizeKey(event, 'try')}
          ondblclick={() => {
            tryWidth = DEFAULT_TRY_WIDTH;
            saveLayout();
          }}
        ></div>
        <div class="try">
          {#key selectedMethod.name}
            <TryIt {doc} method={selectedMethod} {options} />
          {/key}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .clef {
    height: 100%;
    min-height: 480px;
    display: flex;
    flex-direction: column;
  }

  .layout {
    --sidebar-w: var(--sw, 280px);
    --try-w: var(--tw, 500px);
    flex: 1;
    display: grid;
    grid-template-columns: var(--sidebar-w) 0 minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    grid-template-areas: 'sidebar d1 content' 'sidebar d1 try';
    gap: 8px;
    padding: 16px;
    min-height: 0;
  }

  .layout.collapsed {
    --sidebar-w: 44px;
  }

  .layout.no-try {
    grid-template-rows: minmax(0, 1fr);
    grid-template-areas: 'sidebar d1 content';
  }

  .layout.dragging {
    user-select: none;
    cursor: col-resize;
  }

  .content {
    grid-area: content;
    overflow-y: auto;
    padding: 32px 40px 64px;
    min-width: 0;
    background: var(--clef-bg);
    border: 1px solid var(--clef-border);
    border-radius: var(--clef-radius);
  }

  .try {
    grid-area: try;
    min-height: 0;
    max-height: 45vh;
    overflow-y: auto;
  }

  .rail {
    grid-area: sidebar;
    display: flex;
    justify-content: center;
    padding-top: 12px;
    min-height: 0;
    background: var(--clef-bg-soft);
    border: 1px solid var(--clef-border);
    border-radius: var(--clef-radius);
  }

  .rail-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--clef-muted);
    cursor: pointer;
  }

  .rail-btn:hover {
    background: var(--clef-accent-soft);
    color: var(--clef-accent);
  }

  .divider {
    width: 16px;
    justify-self: center;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    cursor: col-resize;
    touch-action: none;
    border-radius: 4px;
  }

  .divider::after {
    content: '';
    width: 2px;
    height: 32px;
    border-radius: 1px;
    background: var(--clef-border);
    transition: background 0.15s ease;
  }

  .divider:hover::after,
  .divider:focus-visible::after {
    background: var(--clef-accent);
  }

  .divider:focus-visible {
    outline: none;
    background: var(--clef-accent-soft);
  }

  .d1 {
    grid-area: d1;
  }

  .d2 {
    grid-area: d2;
    display: none;
  }

  .state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 48px;
    color: var(--clef-muted);
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--clef-border);
    border-top-color: var(--clef-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-card {
    max-width: 560px;
    border: 1px solid color-mix(in srgb, var(--clef-danger) 35%, var(--clef-border));
    background: var(--clef-danger-soft);
    border-radius: var(--clef-radius);
    padding: 20px 24px;
    text-align: left;
  }

  .error-card h2 {
    margin: 0 0 8px;
    font-size: 16px;
    color: var(--clef-danger);
  }

  .error-message {
    margin: 0 0 8px;
    font-family: var(--clef-mono);
    font-size: 13px;
    word-break: break-word;
  }

  .hint {
    margin: 0;
    font-size: 13px;
  }

  @media (min-width: 1200px) {
    .layout {
      grid-template-columns: var(--sidebar-w) 0 minmax(0, 1fr) 0 var(--try-w);
      grid-template-rows: minmax(0, 1fr);
      grid-template-areas: 'sidebar d1 content d2 try';
    }

    .layout.no-try {
      grid-template-columns: var(--sidebar-w) 0 minmax(0, 1fr);
      grid-template-areas: 'sidebar d1 content';
    }

    .d2 {
      display: flex;
    }

    .try {
      max-height: none;
    }
  }

  @media (max-width: 900px) {
    .layout,
    .layout.no-try {
      grid-template-columns: 1fr;
      grid-template-rows: auto minmax(0, 1fr) auto;
      grid-template-areas: 'sidebar' 'content' 'try';
      gap: 12px;
      padding: 12px;
    }

    .layout.no-try {
      grid-template-rows: auto minmax(0, 1fr);
      grid-template-areas: 'sidebar' 'content';
    }

    .divider {
      display: none;
    }

    .try {
      max-height: 50vh;
    }

    .content {
      padding: 24px 20px 48px;
    }
  }
</style>