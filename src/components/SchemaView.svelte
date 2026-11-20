<script lang="ts">
  import SchemaView from './SchemaView.svelte';
  import { isReference, refName } from '../core/refs';
  import { safeDeref } from '../ui/format';
  import type { OpenRPCDocument, ReferenceObject, SchemaObject } from '../core/types';

  let {
    doc,
    schema,
    chain = [],
    depth = 0
  }: {
    doc: OpenRPCDocument;
    schema: SchemaObject | ReferenceObject;
    chain?: string[];
    depth?: number;
  } = $props();

  const ref = $derived(isReference(schema) ? schema.$ref : null);
  const recursive = $derived(ref !== null && chain.includes(ref));
  const resolved = $derived(recursive ? null : safeDeref(doc, schema));
  const nextChain = $derived(ref !== null ? [...chain, ref] : chain);
  const type = $derived(
    resolved ? (Array.isArray(resolved.type) ? resolved.type.join(' | ') : resolved.type) : undefined
  );
  const branches = $derived(resolved?.oneOf ?? resolved?.anyOf ?? resolved?.allOf ?? null);
  const branchKind = $derived(
    resolved?.oneOf ? 'one of' : resolved?.anyOf ? 'any of' : resolved?.allOf ? 'all of' : null
  );
  const properties = $derived(resolved?.properties ? Object.entries(resolved.properties) : []);
  const additional = $derived(
    resolved?.additionalProperties && typeof resolved.additionalProperties === 'object'
      ? resolved.additionalProperties
      : null
  );
  const constraints = $derived.by(() => {
    if (!resolved) return [];
    const parts: string[] = [];
    if (resolved.minimum !== undefined) parts.push(`min ${resolved.minimum}`);
    if (resolved.maximum !== undefined) parts.push(`max ${resolved.maximum}`);
    if (resolved.minLength !== undefined) parts.push(`minLength ${resolved.minLength}`);
    if (resolved.maxLength !== undefined) parts.push(`maxLength ${resolved.maxLength}`);
    if (resolved.pattern) parts.push(`pattern ${resolved.pattern}`);
    if (resolved.minItems !== undefined) parts.push(`minItems ${resolved.minItems}`);
    if (resolved.maxItems !== undefined) parts.push(`maxItems ${resolved.maxItems}`);
    return parts;
  });
</script>

{#if recursive}
  <span class="recursive" title="Recursive reference">↺ {refName(ref!)}</span>
{:else if depth > 8}
  <span class="muted">…</span>
{:else if resolved}
  <div class="schema">
    {#if ref !== null}<span class="ref-name">{refName(ref)}</span>{/if}
    {#if resolved.description}<p class="desc">{resolved.description}</p>{/if}
    {#if type || resolved.format || resolved.enum || resolved.default !== undefined || constraints.length}
      <div class="meta">
        {#if type}<span class="type">{type}</span>{/if}
        {#if resolved.format}<span class="chip">{resolved.format}</span>{/if}
        {#if resolved.enum}
          <span class="chip">enum: {resolved.enum.map((value) => JSON.stringify(value)).join(' · ')}</span>
        {/if}
        {#if resolved.default !== undefined}
          <span class="chip">default: {JSON.stringify(resolved.default)}</span>
        {/if}
        {#each constraints as constraint (constraint)}
          <span class="chip">{constraint}</span>
        {/each}
      </div>
    {/if}

    {#if branches && branchKind}
      <div class="branches">
        <span class="branch-kind">{branchKind}</span>
        {#each branches as branch, index (index)}
          <div class="branch">
            <SchemaView {doc} schema={branch} chain={nextChain} depth={depth + 1} />
          </div>
        {/each}
      </div>
    {:else if properties.length || additional}
      <div class="properties">
        {#each properties as [name, property] (name)}
          <div class="property">
            <div class="prop-head">
              <code class="prop-name">{name}</code>
              {#if resolved.required?.includes(name)}<span class="req" title="required">*</span>{/if}
            </div>
            <SchemaView {doc} schema={property} chain={nextChain} depth={depth + 1} />
          </div>
        {/each}
        {#if additional}
          <div class="property">
            <div class="prop-head"><code class="prop-name">[additionalProperties]</code></div>
            <SchemaView {doc} schema={additional} chain={nextChain} depth={depth + 1} />
          </div>
        {/if}
      </div>
    {:else if type === 'array' && resolved.items}
      <div class="items">
        <span class="items-label">items</span>
        {#if Array.isArray(resolved.items)}
          {#each resolved.items as item, index (index)}
            <SchemaView {doc} schema={item} chain={nextChain} depth={depth + 1} />
          {/each}
        {:else}
          <SchemaView {doc} schema={resolved.items} chain={nextChain} depth={depth + 1} />
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .schema {
    font-size: 13.5px;
    min-width: 0;
  }

  .desc {
    margin: 2px 0 6px;
    font-size: 13px;
    color: var(--clef-muted);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 2px 0 6px;
  }

  .type {
    font-family: var(--clef-mono);
    font-size: 12.5px;
    font-weight: 650;
    color: var(--clef-accent);
  }

  .chip {
    font-family: var(--clef-mono);
    font-size: 11.5px;
    color: var(--clef-muted);
    background: var(--clef-bg-inset);
    border-radius: 6px;
    padding: 1px 7px;
    word-break: break-word;
  }

  .ref-name {
    font-family: var(--clef-mono);
    font-size: 11.5px;
    font-weight: 650;
    color: var(--clef-accent);
    background: var(--clef-accent-soft);
    border-radius: 6px;
    padding: 1px 7px;
  }

  .recursive {
    font-family: var(--clef-mono);
    font-size: 12px;
    color: var(--clef-accent);
    background: var(--clef-accent-soft);
    border-radius: 6px;
    padding: 1px 7px;
  }

  .muted {
    color: var(--clef-muted);
  }

  .properties {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 6px 0;
    padding-left: 12px;
    border-left: 2px solid var(--clef-border);
  }

  .prop-head {
    display: flex;
    align-items: baseline;
    gap: 5px;
  }

  .prop-name {
    font-family: var(--clef-mono);
    font-size: 13px;
    font-weight: 600;
  }

  .req {
    color: var(--clef-danger);
    font-weight: 700;
  }

  .branches {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 6px 0;
  }

  .branch-kind {
    font-size: 11px;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--clef-muted);
  }

  .branch {
    padding: 2px 0 2px 12px;
    border-left: 2px solid var(--clef-border);
  }

  .items {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 6px 0;
    padding-left: 12px;
    border-left: 2px solid var(--clef-border);
  }

  .items-label {
    font-size: 11px;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--clef-muted);
  }
</style>