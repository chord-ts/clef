<script lang="ts">
  import type { ErrorObject, ExamplePairingObject, MethodObject, OpenRPCDocument } from '../core/types';
  import { paramsByName, resolveDescriptor } from '../core/examples';
  import { isReference, resolveRef } from '../core/refs';
  import { typeLabel } from '../ui/format';
  import SchemaView from './SchemaView.svelte';
  import CodeBlock from './CodeBlock.svelte';

  let {
    doc,
    method
  }: {
    doc: OpenRPCDocument;
    method: MethodObject;
  } = $props();

  const params = $derived((method.params ?? []).map((param) => resolveDescriptor(doc, param)));
  const result = $derived(method.result ? resolveDescriptor(doc, method.result) : null);
  const errors = $derived(
    (method.errors ?? []).map((error): ErrorObject =>
      isReference(error) ? (resolveRef(doc, error.$ref) as ErrorObject) : error
    )
  );
  const examples = $derived(
    (method.examples ?? []).map((example) =>
      isReference(example) ? (resolveRef(doc, example.$ref) as ExamplePairingObject) : example
    )
  );
  const structure = $derived(
    method.paramStructure === 'by-position' ? 'by position' : method.paramStructure === 'by-name' ? 'by name' : null
  );
  const tags = $derived(method.tags ?? []);

  function pairingRequest(example: ExamplePairingObject) {
    const values = (example.params ?? []).map((param) => (isReference(param) ? undefined : param.value));
    const paramsValue = paramsByName(method)
      ? Object.fromEntries(params.map((param, index) => [param.name, values[index]]))
      : values;
    return {
      jsonrpc: '2.0' as const,
      id: 1,
      method: method.name,
      ...(values.length ? { params: paramsValue } : {})
    };
  }
</script>

<article class="method">
  <header class="head">
    {#if tags.length}
      <div class="tags">
        {#each tags as tag (tag.name)}
          <span class="tag">{tag.name}</span>
        {/each}
      </div>
    {/if}
    <h2 class="title">
      <code>{method.name}</code>
      {#if method.deprecated}<span class="badge warn">deprecated</span>{/if}
    </h2>
    {#if method.summary}<p class="summary">{method.summary}</p>{/if}
    {#if method.description}<p class="description">{method.description}</p>{/if}
  </header>

  <div class="columns">
    <div class="doc-col">
      {#if params.length}
        <section class="section">
          <h3>Parameters{#if structure}<span class="structure">{structure}</span>{/if}</h3>
          <div class="params">
            {#each params as param (param.name)}
              <div class="param">
                <div class="param-head">
                  <code class="param-name">{param.name}</code>
                  <span class="param-type">{typeLabel(doc, param.schema)}</span>
                  {#if param.required}<span class="badge required">required</span>{/if}
                </div>
                {#if param.description}<p class="param-desc">{param.description}</p>{/if}
                <SchemaView {doc} schema={param.schema} />
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if result}
        <section class="section">
          <h3>Result</h3>
          {#if result.description}<p class="param-desc">{result.description}</p>{/if}
          <SchemaView {doc} schema={result.schema} />
        </section>
      {/if}

      {#if errors.length}
        <section class="section">
          <h3>Errors</h3>
          <div class="errors">
            {#each errors as error (error.code)}
              <div class="error-row">
                <code class="error-code">{error.code}</code>
                <span>{error.message}</span>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if examples.length}
        <section class="section">
          <h3>Examples</h3>
          {#each examples as example (example.name)}
            <div class="example">
              <div class="example-head">
                <span class="example-name">{example.name}</span>
                {#if example.summary}<span class="example-summary">{example.summary}</span>{/if}
              </div>
              <CodeBlock label="Request" value={pairingRequest(example)} />
              {#if example.result && !isReference(example.result)}
                <CodeBlock
                  label="Response"
                  value={{ jsonrpc: '2.0', id: 1, result: example.result.value }}
                />
              {/if}
            </div>
          {/each}
        </section>
      {/if}
    </div>
  </div>
</article>

<style>
  .method {
    max-width: 1280px;
    margin: 0 auto;
  }

  .head {
    margin-bottom: 26px;
  }

  .tags {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }

  .tag {
    font-size: 11px;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--clef-accent);
    background: var(--clef-accent-soft);
    border-radius: 999px;
    padding: 2px 10px;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin: 0;
  }

  .title code {
    font-family: var(--clef-mono);
    font-size: 22px;
    font-weight: 650;
    letter-spacing: -0.01em;
    word-break: break-all;
  }

  .badge {
    font-size: 11px;
    font-weight: 650;
    border-radius: 999px;
    padding: 2px 9px;
  }

  .badge.warn {
    color: var(--clef-warn);
    background: var(--clef-warn-soft);
  }

  .badge.required {
    color: var(--clef-danger);
    background: var(--clef-danger-soft);
  }

  .summary {
    margin: 8px 0 0;
    font-size: 16px;
  }

  .description {
    margin: 8px 0 0;
    color: var(--clef-muted);
    white-space: pre-line;
  }

  .columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 28px;
    align-items: start;
  }

  .section {
    margin-bottom: 28px;
  }

  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 10px;
    font-size: 12.5px;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--clef-muted);
  }

  .structure {
    font-size: 10.5px;
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
    color: var(--clef-muted);
    background: var(--clef-bg-inset);
    border-radius: 999px;
    padding: 1px 8px;
  }

  .params {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .param {
    border: 1px solid var(--clef-border);
    border-radius: var(--clef-radius);
    padding: 12px 14px;
    background: var(--clef-bg);
  }

  .param-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }

  .param-name {
    font-family: var(--clef-mono);
    font-size: 14px;
    font-weight: 600;
  }

  .param-type {
    font-family: var(--clef-mono);
    font-size: 12px;
    color: var(--clef-muted);
  }

  .param-desc {
    margin: 0 0 6px;
    font-size: 13.5px;
    color: var(--clef-muted);
  }

  .errors {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .error-row {
    display: flex;
    align-items: baseline;
    gap: 12px;
    border: 1px solid var(--clef-border);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 13.5px;
  }

  .error-code {
    font-family: var(--clef-mono);
    font-weight: 650;
    color: var(--clef-danger);
  }

  .example {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 18px;
  }

  .example-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }

  .example-name {
    font-weight: 650;
    font-size: 14px;
  }

  .example-summary {
    font-size: 13px;
    color: var(--clef-muted);
  }
</style>