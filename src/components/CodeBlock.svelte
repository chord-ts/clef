<script lang="ts">
  import { highlightJson, highlightJs, highlightShell } from '../ui/highlight';

  let {
    value,
    label,
    lang = 'json'
  }: {
    value: unknown;
    label?: string;
    lang?: 'json' | 'shell' | 'js';
  } = $props();

  const text = $derived(typeof value === 'string' ? value : (JSON.stringify(value, null, 2) ?? String(value)));
  const html = $derived(
    lang === 'shell' ? highlightShell(text) : lang === 'js' ? highlightJs(text) : highlightJson(text)
  );
  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    copied = true;
    clearTimeout(timer);
    timer = setTimeout(() => (copied = false), 1200);
  }
</script>

<div class="codeblock">
  <div class="bar">
    <span class="label">{label ?? (lang === 'json' ? 'JSON' : lang)}</span>
    <button type="button" class="copy" onclick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
  </div>
  <pre><code>{@html html}</code></pre>
</div>

<style>
  .codeblock {
    border: 1px solid var(--clef-border);
    border-radius: var(--clef-radius);
    background: var(--clef-bg);
    overflow: hidden;
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 12px;
    border-bottom: 1px solid var(--clef-border);
    background: var(--clef-bg-soft);
  }

  .label {
    font-size: 11px;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--clef-muted);
  }

  .copy {
    border: none;
    background: transparent;
    color: var(--clef-muted);
    font-size: 11.5px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 6px;
  }

  .copy:hover {
    color: var(--clef-accent);
    background: var(--clef-accent-soft);
  }

  pre {
    margin: 0;
    padding: 12px 14px;
    overflow-x: auto;
    font-family: var(--clef-mono);
    font-size: 12.5px;
    line-height: 1.6;
  }
</style>