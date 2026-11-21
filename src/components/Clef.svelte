<script lang="ts">
  import { untrack } from 'svelte';
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

  let isMobile = $state(false);
  let pane = $state(1);
  let dragOffset = $state(0);
  let swiping = $state(false);
  let stripEl = $state<HTMLElement | null>(null);

  // must match the gap of .strip in the mobile media query
  const MOBILE_GAP = 12;

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

  $effect(() => {
    const media = matchMedia('(max-width: 900px)');
    isMobile = media.matches;
    const onChange = (event: MediaQueryListEvent) => (isMobile = event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  });

  function collapseSidebar() {
    if (isMobile) pane = 1;
    else sidebarCollapsed = true;
  }

  let gesture: {
    id: number;
    startX: number;
    startY: number;
    anchorX: number;
    base: number;
    pitch: number;
    active: boolean;
  } | null = null;

  function swipeStart(event: PointerEvent) {
    if (!isMobile || event.pointerType === 'mouse' || gesture || !stripEl) return;
    gesture = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      anchorX: event.clientX,
      base: pane,
      pitch: stripEl.clientWidth + MOBILE_GAP,
      active: false
    };
  }

  function swipeMove(event: PointerEvent) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.active) {
      // finger jitter during vertical scrolling must never move the strip
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        gesture = null;
        return;
      }
      if (Math.abs(dx) < 24 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      gesture.active = true;
      // rebase so the panel follows the finger from zero instead of jumping by the lead-in
      gesture.anchorX = event.clientX;
      swiping = true;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
    const dragDx = event.clientX - gesture.anchorX;
    const raw = gesture.base - dragDx / gesture.pitch;
    const clamped = clamp(raw, 0, maxPane);
    const eased = clamped + (raw - clamped) * 0.25;
    dragOffset = (gesture.base - eased) * gesture.pitch;
  }

  function swipeEnd(event: PointerEvent) {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (gesture.active) {
      const dx = event.clientX - gesture.startX;
      const threshold = Math.min(80, gesture.pitch * 0.18);
      const step = dx <= -threshold ? 1 : dx >= threshold ? -1 : 0;
      pane = clamp(gesture.base + step, 0, maxPane);
    }
    gesture = null;
    swiping = false;
    dragOffset = 0;
  }

  function swipeCancel(event: PointerEvent) {
    if (!gesture || event.pointerId !== gesture.id) return;
    gesture = null;
    swiping = false;
    dragOffset = 0;
  }

  const theme = $derived(
    options.theme === 'dark' || ((options.theme ?? 'auto') === 'auto' && prefersDark) ? 'dark' : 'light'
  );

  // key on content, not identity: replacing the options object wraps sources in
  // fresh $state proxies and would reload the document even when unchanged
  const loadKey = $derived(
    JSON.stringify([options.spec, options.url, options.endpoint, options.transport])
  );

  $effect(() => {
    loadKey;
    const source = untrack(() => ({
      spec: options.spec,
      url: options.url,
      endpoint: options.endpoint,
      transport: options.transport
    }));
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
  const maxPane = $derived(tryItEnabled && selectedMethod ? 2 : 1);

  $effect(() => {
    if (pane > maxPane) pane = maxPane;
  });

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
    <!-- touch swipe surface for the mobile pager: pointer handlers drive gestures, not a widget role -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="layout"
      class:no-try={!tryItEnabled}
      class:collapsed={sidebarCollapsed}
      class:dragging
      class:swiping
      style="--sw: {sidebarWidth}px; --tw: {tryWidth}px; --pane: {pane}; --drag: {dragOffset}px"
      onpointerdown={swipeStart}
      onpointermove={swipeMove}
      onpointerup={swipeEnd}
      onpointercancel={swipeCancel}
    >
      <div class="strip" bind:this={stripEl}>
        <div class="side-cell" inert={isMobile && pane !== 0 ? true : undefined}>
          {#if sidebarCollapsed && !isMobile}
            <div class="rail">
              <button
                type="button"
                class="rail-btn"
                onclick={() => (sidebarCollapsed = false)}
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
                  <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.5" />
                  <path d="M5.75 2.75v10.5" fill="none" stroke="currentColor" stroke-width="1.5" />
                </svg>
              </button>
            </div>
          {:else}
            <Sidebar
              {doc}
              icon={options.icon}
              bind:query
              bind:selected={selectedName}
              oncollapse={collapseSidebar}
              onselect={() => (pane = 1)}
            />
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
        </div>
        <main class="content" bind:this={mainEl} inert={isMobile && pane !== 1 ? true : undefined}>
          {#if isMobile}
            <div class="mobile-bar">
              <button
                type="button"
                class="m-btn"
                onclick={() => (pane = 0)}
                title="Methods"
                aria-label="Show methods"
              >
                <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
                  <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.5" />
                  <path d="M5.75 2.75v10.5" fill="none" stroke="currentColor" stroke-width="1.5" />
                </svg>
              </button>
              {#if tryItEnabled && selectedMethod}
                <button type="button" class="m-btn m-try" onclick={() => (pane = 2)}>
                  Try it
                  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                    <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              {/if}
            </div>
          {/if}
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
          <div class="try" inert={isMobile && pane !== 2 ? true : undefined}>
            {#key selectedMethod.name}
              <TryIt {doc} method={selectedMethod} {options} onback={isMobile ? () => (pane = 1) : undefined} />
            {/key}
          </div>
        {/if}
      </div>
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

  .strip,
  .side-cell {
    display: contents;
  }

  .mobile-bar {
    display: none;
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
      display: block;
      overflow: hidden;
      padding: 12px;
      touch-action: pan-y;
    }

    .layout.swiping {
      user-select: none;
    }

    .strip {
      display: flex;
      gap: 12px;
      height: 100%;
      transform: translateX(calc(var(--pane, 1) * (-100% - 12px) + var(--drag, 0px)));
      transition: transform 320ms var(--clef-ease-out);
    }

    .layout.swiping .strip {
      transition: none;
    }

    .side-cell,
    .content,
    .try {
      flex: 0 0 100%;
      min-width: 0;
    }

    /* display:contents would drop the wrapper's box and let the sidebar shrink to zero inside the strip */
    .side-cell {
      display: block;
    }

    .divider {
      display: none;
    }

    .try {
      max-height: none;
    }

    .content {
      padding: 10px 20px 48px;
    }

    /* no bar/line: two floating chips, same elevation as the sidebar button;
       the row owns its space, content scrolls beneath once stuck.
       24px gap keeps the ambient shadow off the article's first chip */
    .mobile-bar {
      position: sticky;
      top: 10px;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin: 0 0 24px;
    }

    .m-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 34px;
      padding: 0 12px;
      border: 1px solid var(--clef-border);
      border-radius: 8px;
      background: var(--clef-bg);
      color: var(--clef-muted);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow:
        0 1px 2px rgb(0 0 0 / 0.06),
        0 4px 12px rgb(0 0 0 / 0.1);
    }

    :global(.clef[data-theme='dark']) .m-btn {
      box-shadow:
        0 1px 2px rgb(0 0 0 / 0.4),
        0 4px 12px rgb(0 0 0 / 0.35);
    }

    .m-btn:hover {
      color: var(--clef-accent);
      border-color: var(--clef-accent);
      background: var(--clef-accent-soft);
    }

    .m-try {
      color: var(--clef-accent);
      background: var(--clef-accent-soft);
      border-color: color-mix(in srgb, var(--clef-accent) 35%, var(--clef-border));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .strip {
      transition: none;
    }
  }
</style>