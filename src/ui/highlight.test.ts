import { describe, expect, it } from 'vitest';
import { highlightJson, highlightJs, highlightShell } from './highlight';

describe('highlightJson', () => {
  it('escapes HTML before highlighting', () => {
    const html = highlightJson('{"x": "<script>&"}');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('marks keys, strings, numbers, booleans and null', () => {
    const html = highlightJson('{"a": "text", "b": 1.5, "c": true, "d": null}');
    expect(html).toContain('<span class="tok-key">"a":</span>');
    expect(html).toContain('<span class="tok-str">"text"</span>');
    expect(html).toContain('<span class="tok-num">1.5</span>');
    expect(html).toContain('<span class="tok-bool">true</span>');
    expect(html).toContain('<span class="tok-null">null</span>');
  });

  it('handles escaped quotes inside strings', () => {
    const html = highlightJson('{"a": "say \\"hi\\""}');
    expect(html).toContain('tok-str');
    expect(html).not.toContain('tok-key">"hi');
  });
});

describe('highlightShell', () => {
  it('marks the command, flags and quoted strings', () => {
    const html = highlightShell("curl -X POST 'http://x/rpc' -d '{\"a\":1}'");
    expect(html).toContain('<span class="tok-bool">curl</span>');
    expect(html).toContain('<span class="tok-key">-X</span>');
    expect(html).toContain(`<span class="tok-str">'http://x/rpc'</span>`);
    expect(html).toContain(`<span class="tok-str">'{"a":1}'</span>`);
  });

  it('escapes HTML', () => {
    expect(highlightShell("curl '<script>'")).toContain('&lt;script&gt;');
  });
});

describe('highlightJs', () => {
  it('marks keywords, strings, literals and numbers', () => {
    const html = highlightJs("const x = await fetch('http://x'); true null 42");
    expect(html).toContain('<span class="tok-key">const</span>');
    expect(html).toContain('<span class="tok-key">await</span>');
    expect(html).toContain(`<span class="tok-str">'http://x'</span>`);
    expect(html).toContain('<span class="tok-bool">true</span>');
    expect(html).toContain('<span class="tok-bool">null</span>');
    expect(html).toContain('<span class="tok-num">42</span>');
  });

  it('escapes HTML', () => {
    expect(highlightJs("const s = '<script>';")).toContain('&lt;script&gt;');
  });
});