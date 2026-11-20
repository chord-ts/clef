function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlightJson(json: string): string {
  return escapeHtml(json).replace(
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'num';
      if (match.startsWith('"')) cls = /:\s*$/.test(match) ? 'key' : 'str';
      else if (match === 'true' || match === 'false') cls = 'bool';
      else if (match === 'null') cls = 'null';
      return `<span class="tok-${cls}">${match}</span>`;
    }
  );
}

export function highlightShell(code: string): string {
  return escapeHtml(code).replace(
    /('(?:[^'\\]|\\.)*')|(\bcurl\b)|(--?[A-Za-z][A-Za-z-]*)/g,
    (match, str: string | undefined, cmd: string | undefined) => {
      const cls = str ? 'str' : cmd ? 'bool' : 'key';
      return `<span class="tok-${cls}">${match}</span>`;
    }
  );
}

export function highlightJs(code: string): string {
  return escapeHtml(code).replace(
    /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|\b(const|let|await|async|new|function|return)\b|\b(true|false|null|undefined)\b|(-?\d+(?:\.\d+)?)/g,
    (match, str: string | undefined, keyword: string | undefined, literal: string | undefined) => {
      const cls = str ? 'str' : keyword ? 'key' : literal ? 'bool' : 'num';
      return `<span class="tok-${cls}">${match}</span>`;
    }
  );
}