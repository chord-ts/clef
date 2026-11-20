<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { MethodObject, OpenRPCDocument } from '../core/types';

  let {
    doc,
    query = $bindable(''),
    selected = $bindable<string | null>(null),
    oncollapse
  }: {
    doc: OpenRPCDocument;
    query?: string;
    selected?: string | null;
    oncollapse: () => void;
  } = $props();

  let collapsed = $state<Set<string>>(new Set());

  function toggle(tag: string) {
    const next = new Set(collapsed);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    collapsed = next;
  }

  const searching = $derived(query.trim().length > 0);

  const groups = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const matches = (method: MethodObject) =>
      !q ||
      method.name.toLowerCase().includes(q) ||
      (method.summary ?? '').toLowerCase().includes(q) ||
      (method.description ?? '').toLowerCase().includes(q);
    const map = new Map<string, MethodObject[]>();
    for (const method of doc.methods) {
      if (!matches(method)) continue;
      const tag = method.tags?.[0]?.name ?? 'Methods';
      const list = map.get(tag) ?? [];
      list.push(method);
      map.set(tag, list);
    }
    return [...map.entries()];
  });

  const total = $derived(groups.reduce((sum, [, methods]) => sum + methods.length, 0));
</script>

<aside class="sidebar">
  <header class="head">
    <div class="title-row">
      <h1>{doc.info.title}</h1>
      <span class="version">v{doc.info.version}</span>
    </div>
    <button
      type="button"
      class="collapse"
      onclick={oncollapse}
      title="Collapse sidebar"
      aria-label="Collapse sidebar"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M8.5 3.5L4 8l4.5 4.5M12.5 3.5L8 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    {#if doc.info.description}<p class="desc">{doc.info.description}</p>{/if}
  </header>

  <div class="search">
    <input type="search" placeholder="Search methods…" bind:value={query} spellcheck="false" />
  </div>

  <nav class="nav">
    {#each groups as [tag, methods] (tag)}
      {@const isCollapsed = !searching && collapsed.has(tag)}
      <div class="group">
        <button
          type="button"
          class="group-name"
          aria-expanded={!isCollapsed}
          onclick={() => toggle(tag)}
        >
          <svg class="chevron" class:collapsed={isCollapsed} viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="group-title">{tag}</span>
          <span class="count">{methods.length}</span>
        </button>
        {#if !isCollapsed}
          <div class="group-items" transition:slide={{ duration: 150, axis: 'y' }}>
            {#each methods as method (method.name)}
              <button
                type="button"
                class="item"
                class:active={selected === method.name}
                onclick={() => (selected = method.name)}
              >
                <span class="name" class:deprecated={method.deprecated}>{method.name}</span>
                {#if method.summary}<span class="summary">{method.summary}</span>{/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
    {#if total === 0}<p class="empty">Nothing found for “{query}”.</p>{/if}
  </nav>

  <footer class="foot">OpenRPC {doc.openrpc} · rendered by <span class="brand">clef</span></footer>
</aside>

<style>
  .sidebar {
    grid-area: sidebar;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--clef-bg-soft);
    border: 1px solid var(--clef-border);
    border-radius: var(--clef-radius);
    overflow: hidden;
  }

  .head {
    position: relative;
    padding: 20px 48px 12px 20px;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  h1 {
    margin: 0;
    font-size: 17px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .version {
    font-family: var(--clef-mono);
    font-size: 11px;
    color: var(--clef-muted);
    border: 1px solid var(--clef-border);
    border-radius: 999px;
    padding: 1px 8px;
    background: var(--clef-bg);
  }

  .collapse {
    position: absolute;
    top: 16px;
    right: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--clef-muted);
    cursor: pointer;
  }

  .collapse:hover {
    background: var(--clef-accent-soft);
    color: var(--clef-accent);
  }

  .desc {
    margin: 8px 0 0;
    font-size: 12.5px;
    color: var(--clef-muted);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .search {
    padding: 0 16px 12px;
  }

  .search input {
    width: 100%;
    padding: 7px 12px;
    border: 1px solid var(--clef-border);
    border-radius: 8px;
    background: var(--clef-bg);
    font-size: 13.5px;
  }

  .search input:focus {
    outline: none;
    border-color: var(--clef-accent);
    box-shadow: 0 0 0 3px var(--clef-accent-soft);
  }

  .nav {
    flex: 1;
    overflow-y: auto;
    padding: 0 12px 16px;
  }

  .group {
    margin-bottom: 14px;
  }

  .group-name {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    font-size: 11px;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--clef-muted);
    text-align: left;
  }

  .group-name:hover {
    color: var(--clef-text);
    background: var(--clef-bg-inset);
  }

  .chevron {
    flex-shrink: 0;
    transition: transform 0.15s ease;
  }

  .chevron.collapsed {
    transform: rotate(-90deg);
  }

  .group-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    margin-left: auto;
    font-family: var(--clef-mono);
    font-weight: 400;
    background: var(--clef-bg-inset);
    border-radius: 999px;
    padding: 0 7px;
    font-size: 10.5px;
  }

  .group-items {
    display: flex;
    flex-direction: column;
  }

  .item {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
    text-align: left;
    padding: 7px 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
  }

  .item:hover {
    background: var(--clef-bg-inset);
  }

  .item.active {
    background: var(--clef-accent-soft);
  }

  .item.active .name {
    color: var(--clef-accent);
  }

  .name {
    font-family: var(--clef-mono);
    font-size: 13px;
    font-weight: 550;
    word-break: break-all;
  }

  .name.deprecated {
    text-decoration: line-through;
    opacity: 0.7;
  }

  .summary {
    font-size: 11.5px;
    color: var(--clef-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty {
    padding: 8px;
    font-size: 13px;
    color: var(--clef-muted);
  }

  .foot {
    padding: 10px 20px;
    border-top: 1px solid var(--clef-border);
    font-size: 11.5px;
    color: var(--clef-muted);
  }

  .brand {
    font-weight: 650;
    color: var(--clef-accent);
  }

  @media (max-width: 900px) {
    .sidebar {
      max-height: 42vh;
    }

    .desc {
      display: none;
    }
  }
</style>