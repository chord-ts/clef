<script lang="ts">
  import { untrack } from 'svelte';
  import { callRpc, type RpcOutcome, type Transport } from '../core/jsonrpc';
  import { exampleParams, paramsByName, resolveDescriptor } from '../core/examples';
  import { safeDeref, typeLabel } from '../ui/format';
  import type { MethodObject, OpenRPCDocument, SchemaObject } from '../core/types';
  import type { MountOptions } from '../public';
  import CodeBlock from './CodeBlock.svelte';

  let {
    doc,
    method,
    options,
    onback
  }: {
    doc: OpenRPCDocument;
    method: MethodObject;
    options: MountOptions;
    onback?: () => void;
  } = $props();

  type Kind = 'text' | 'number' | 'boolean' | 'enum' | 'json';

  const byName = $derived(paramsByName(method));
  const descriptors = $derived((method.params ?? []).map((param) => resolveDescriptor(doc, param)));
  const schemas = $derived(descriptors.map((descriptor) => safeDeref(doc, descriptor.schema)));

  function kindOf(schema: SchemaObject): Kind {
    if (schema.enum) return 'enum';
    const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    if (type === 'boolean') return 'boolean';
    if (type === 'integer' || type === 'number') return 'number';
    if (type === 'object' || type === 'array' || schema.properties || schema.items || schema.oneOf || schema.anyOf || schema.allOf) {
      return 'json';
    }
    return 'text';
  }

  const kinds = $derived(schemas.map(kindOf));
  const keyOf = (index: number) => (byName ? descriptors[index].name : String(index));

  function stringifyValue(value: unknown, kind: Kind): string {
    if (value === undefined || value === null) return '';
    if (kind === 'json') return JSON.stringify(value, null, 2);
    if (kind === 'enum') return JSON.stringify(value);
    return String(value);
  }

  let formValues = $state<Record<string, string>>({});
  let jsonText = $state('');
  let mode = $state<'form' | 'json'>('form');
  let endpoint = $state('');
  let transport = $state<Transport>('http');
  let running = $state(false);
  let outcome = $state<RpcOutcome | null>(null);
  let localError = $state<string | null>(null);

  $effect(() => {
    const initial = exampleParams(doc, method);
    const record = (
      byName
        ? (initial ?? {})
        : Object.fromEntries((Array.isArray(initial) ? initial : []).map((value, index) => [String(index), value]))
    ) as Record<string, unknown>;
    formValues = Object.fromEntries(
      descriptors.map((_, index) => [keyOf(index), stringifyValue(record[keyOf(index)], kinds[index])])
    );
    jsonText = JSON.stringify(initial ?? (byName ? {} : []), null, 2);
    outcome = null;
    localError = null;
  });

  $effect(() => {
    endpoint = options.endpoint ?? doc.servers?.[0]?.url ?? untrack(() => endpoint);
    transport = options.transport ?? untrack(() => transport);
  });

  function collectParams(): unknown {
    if (mode === 'json') {
      const text = jsonText.trim();
      if (!text) return undefined;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        throw new Error(`Params JSON is invalid: ${error instanceof Error ? error.message : error}`);
      }
      if (byName && (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))) {
        throw new Error('This method expects params by name — provide a JSON object.');
      }
      if (!byName && !Array.isArray(parsed)) {
        throw new Error('This method expects params by position — provide a JSON array.');
      }
      return parsed;
    }
    const values = descriptors.map((descriptor, index) => {
      const raw = formValues[keyOf(index)] ?? '';
      const kind = kinds[index];
      if (raw === '') {
        if (descriptor.required) throw new Error(`Parameter "${descriptor.name}" is required.`);
        return undefined;
      }
      if (kind === 'boolean') return raw === 'true';
      if (kind === 'number') {
        const value = Number(raw);
        if (Number.isNaN(value)) throw new Error(`Parameter "${descriptor.name}" must be a number.`);
        return value;
      }
      if (kind === 'enum' || kind === 'json') {
        try {
          return JSON.parse(raw);
        } catch {
          throw new Error(`Parameter "${descriptor.name}" contains invalid JSON.`);
        }
      }
      return raw;
    });
    if (byName) {
      const record: Record<string, unknown> = {};
      values.forEach((value, index) => {
        if (value !== undefined) record[descriptors[index].name] = value;
      });
      return Object.keys(record).length ? record : undefined;
    }
    return values.map((value) => value ?? null);
  }

  const preview = $derived.by(() => {
    try {
      const params = collectParams();
      return {
        jsonrpc: '2.0' as const,
        id: 1,
        method: method.name,
        ...(params !== undefined ? { params } : {})
      };
    } catch {
      return null;
    }
  });

  let previewMode = $state<'json' | 'curl' | 'js'>('json');

  $effect(() => {
    if (transport === 'websocket' && previewMode === 'curl') previewMode = 'js';
  });

  const shellQuote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";

  const curlSnippet = $derived.by(() => {
    if (!preview) return '';
    const url = endpoint.trim() || '<endpoint>';
    return `curl -X POST ${shellQuote(url)} \\\n  -H 'Content-Type: application/json' \\\n  -d ${shellQuote(JSON.stringify(preview))}`;
  });

  const jsSnippet = $derived.by(() => {
    if (!preview) return '';
    const url = endpoint.trim() || '<endpoint>';
    const request = JSON.stringify(preview);
    if (transport === 'websocket') {
      const wsUrl = url.replace(/^http/, 'ws');
      return `const socket = new WebSocket(${JSON.stringify(wsUrl)});\nsocket.onopen = () => socket.send(JSON.stringify(${request}));\nsocket.onmessage = (event) => {\n  const { result, error } = JSON.parse(event.data);\n  socket.close();\n};`;
    }
    return `const response = await fetch(${JSON.stringify(url)}, {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify(${request})\n});\nconst { result, error } = await response.json();`;
  });

  async function execute() {
    localError = null;
    if (!endpoint.trim()) {
      localError = 'Set the endpoint URL first.';
      return;
    }
    let params: unknown;
    try {
      params = collectParams();
    } catch (error) {
      localError = error instanceof Error ? error.message : String(error);
      return;
    }
    running = true;
    outcome = null;
    outcome = await callRpc(endpoint.trim(), method.name, params, transport, options.requestTimeoutMs);
    running = false;
  }
</script>

<div class="tryit">
  <div class="head">
    {#if onback}
      <button type="button" class="back" onclick={onback} aria-label="Back to method documentation">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Docs
      </button>
    {/if}
    <h3>Try it</h3>
    <span class="hint">JSON-RPC 2.0</span>
  </div>

  <label class="field">
    <span class="label">Endpoint</span>
    <input type="text" bind:value={endpoint} placeholder="https://api.example.com/rpc" spellcheck="false" />
  </label>

  <div class="row">
    <label class="field">
      <span class="label">Transport</span>
      <select bind:value={transport}>
        <option value="http">HTTP</option>
        <option value="websocket">WebSocket</option>
      </select>
    </label>
    <div class="field">
      <span class="label">Params as</span>
      <div class="toggle">
        <button type="button" class:active={mode === 'form'} onclick={() => (mode = 'form')}>Form</button>
        <button type="button" class:active={mode === 'json'} onclick={() => (mode = 'json')}>JSON</button>
      </div>
    </div>
  </div>

  {#if mode === 'form'}
    {#if descriptors.length === 0}
      <p class="hint">This method takes no parameters.</p>
    {:else}
      {#each descriptors as descriptor, index (descriptor.name)}
        {@const key = keyOf(index)}
        {@const kind = kinds[index]}
        <label class="field">
          <span class="label">
            {descriptor.name}
            {#if descriptor.required}<b class="req">*</b>{/if}
            <i class="kind">{typeLabel(doc, descriptor.schema)}</i>
          </span>
          {#if kind === 'boolean'}
            <span class="check">
              <input
                type="checkbox"
                checked={formValues[key] === 'true'}
                onchange={(event) => (formValues[key] = event.currentTarget.checked ? 'true' : 'false')}
              />
              <span>{formValues[key] === 'true' ? 'true' : 'false'}</span>
            </span>
          {:else if kind === 'enum'}
            <select bind:value={formValues[key]}>
              {#if !descriptor.required}<option value="">—</option>{/if}
              {#each schemas[index].enum ?? [] as value}
                <option value={JSON.stringify(value)}>{JSON.stringify(value)}</option>
              {/each}
            </select>
          {:else if kind === 'json'}
            <textarea rows="4" bind:value={formValues[key]} spellcheck="false"></textarea>
          {:else}
            <input type={kind === 'number' ? 'number' : 'text'} bind:value={formValues[key]} spellcheck="false" />
          {/if}
        </label>
      {/each}
    {/if}
  {:else}
    <label class="field">
      <span class="label">Params ({byName ? 'by name — object' : 'by position — array'})</span>
      <textarea class="editor" rows="8" bind:value={jsonText} spellcheck="false"></textarea>
    </label>
  {/if}

  {#if localError}<p class="local-error">{localError}</p>{/if}

  <div class="preview">
    <div class="preview-head">
      <span class="label">Request</span>
      <div class="toggle small">
        <button type="button" class:active={previewMode === 'json'} onclick={() => (previewMode = 'json')}>JSON</button>
        <button
          type="button"
          class:active={previewMode === 'curl'}
          disabled={transport === 'websocket'}
          title={transport === 'websocket' ? 'curl does not support WebSocket' : undefined}
          onclick={() => (previewMode = 'curl')}
        >curl</button>
        <button type="button" class:active={previewMode === 'js'} onclick={() => (previewMode = 'js')}>JS</button>
      </div>
    </div>
    {#if preview}
      {#if previewMode === 'json'}
        <CodeBlock value={preview} />
      {:else if previewMode === 'curl'}
        <CodeBlock lang="shell" label="shell" value={curlSnippet} />
      {:else}
        <CodeBlock lang="js" label="javascript" value={jsSnippet} />
      {/if}
    {:else}
      <p class="hint">Fix the params to see the request preview.</p>
    {/if}
  </div>

  <button type="button" class="execute" onclick={execute} disabled={running}>
    {running ? 'Executing…' : 'Execute'}
  </button>

  {#if outcome}
    <div class="outcome" class:is-error={!!outcome.error}>
      <div class="outcome-head">
        <span class="status">{outcome.error ? `Error ${outcome.error.code}` : 'Result'}</span>
        <span class="duration">{Math.round(outcome.durationMs)} ms</span>
      </div>
      {#if outcome.error}
        <p class="error-message">{outcome.error.message}</p>
        {#if outcome.error.data !== undefined}
          <CodeBlock label="Error data" value={outcome.error.data} />
        {/if}
      {:else}
        <CodeBlock value={outcome.result} />
      {/if}
    </div>
  {/if}
</div>

<style>
  .tryit {
    display: flex;
    flex-direction: column;
    gap: 12px;
    border: 1px solid var(--clef-border);
    border-radius: var(--clef-radius);
    background: var(--clef-bg-soft);
    padding: 16px;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .back {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 12px;
    flex-shrink: 0;
    border: 1px solid var(--clef-border);
    border-radius: 8px;
    background: var(--clef-bg-soft);
    color: var(--clef-muted);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow:
      0 1px 2px rgb(0 0 0 / 0.06),
      0 4px 12px rgb(0 0 0 / 0.1);
  }

  :global(.clef[data-theme='dark']) .back {
    box-shadow:
      0 1px 2px rgb(0 0 0 / 0.4),
      0 4px 12px rgb(0 0 0 / 0.35);
  }

  .back:hover {
    color: var(--clef-accent);
    border-color: var(--clef-accent);
    background: var(--clef-accent-soft);
  }

  h3 {
    margin: 0;
    font-size: 12.5px;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--clef-muted);
  }

  .hint {
    margin: 0;
    margin-left: auto;
    font-size: 12.5px;
    color: var(--clef-muted);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .label {
    display: flex;
    align-items: baseline;
    gap: 5px;
    font-size: 12px;
    font-weight: 550;
    color: var(--clef-muted);
  }

  .req {
    color: var(--clef-danger);
  }

  .kind {
    margin-left: auto;
    font-family: var(--clef-mono);
    font-style: normal;
    font-size: 11px;
    color: var(--clef-muted);
  }

  input,
  select,
  textarea {
    width: 100%;
    padding: 7px 10px;
    border: 1px solid var(--clef-border);
    border-radius: 8px;
    background: var(--clef-bg);
    font-size: 13.5px;
  }

  input:focus,
  select:focus,
  textarea:focus {
    outline: none;
    border-color: var(--clef-accent);
    box-shadow: 0 0 0 3px var(--clef-accent-soft);
  }

  textarea {
    font-family: var(--clef-mono);
    font-size: 12.5px;
    resize: vertical;
  }

  input[type='checkbox'] {
    width: auto;
    accent-color: var(--clef-accent);
  }

  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--clef-mono);
    font-size: 12.5px;
    color: var(--clef-muted);
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .toggle {
    display: flex;
    border: 1px solid var(--clef-border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--clef-bg);
  }

  .toggle button {
    flex: 1;
    padding: 7px 6px;
    border: none;
    background: transparent;
    font-size: 12.5px;
    color: var(--clef-muted);
    cursor: pointer;
  }

  .toggle button.active {
    background: var(--clef-accent-soft);
    color: var(--clef-accent);
    font-weight: 650;
  }

  .local-error {
    margin: 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--clef-danger-soft);
    color: var(--clef-danger);
    font-size: 13px;
  }

  .preview {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .preview-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .toggle.small button {
    padding: 3px 9px;
    font-size: 11.5px;
  }

  .toggle button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .execute {
    padding: 9px;
    border: none;
    border-radius: 8px;
    background: var(--clef-accent);
    color: var(--clef-on-accent);
    font-weight: 650;
    font-size: 14px;
    cursor: pointer;
  }

  .execute:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  .execute:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .outcome {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border: 1px solid color-mix(in srgb, var(--clef-ok) 40%, var(--clef-border));
    border-radius: var(--clef-radius);
    background: var(--clef-bg);
    padding: 12px;
  }

  .outcome.is-error {
    border-color: color-mix(in srgb, var(--clef-danger) 40%, var(--clef-border));
  }

  .outcome-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .status {
    font-size: 13px;
    font-weight: 650;
    color: var(--clef-ok);
  }

  .is-error .status {
    color: var(--clef-danger);
  }

  .duration {
    font-family: var(--clef-mono);
    font-size: 11.5px;
    color: var(--clef-muted);
  }

  .error-message {
    margin: 0;
    font-size: 13px;
    color: var(--clef-danger);
    word-break: break-word;
  }

  @media (max-width: 900px) {
    /* the Docs chip floats over the form like the other pane controls;
       the pane's own title is what confused people, so it goes away */
    .head {
      position: sticky;
      top: 10px;
      z-index: 2;
    }

    h3,
    .hint {
      display: none;
    }
  }
</style>