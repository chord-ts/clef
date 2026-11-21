let nextId = 3;
const notes = new Map([
  [
    1,
    {
      id: 1,
      title: 'Welcome to clef',
      body: 'This note lives in the demo server memory.',
      tags: ['demo'],
      createdAt: '2026-11-20T09:00:00.000Z'
    }
  ],
  [
    2,
    {
      id: 2,
      title: 'Try the console',
      body: 'Pick a method on the left and press Execute.',
      tags: ['demo', 'docs'],
      createdAt: '2026-11-20T09:05:00.000Z'
    }
  ]
]);

const invalidParams = (data) => ({ code: -32602, message: 'Invalid params', data });
const notFound = (id) => ({ code: -32001, message: 'Note not found', data: { id } });

function handle(request, spec) {
  const { method, params = {}, id } = request;
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  const fail = (error) => ({ jsonrpc: '2.0', id, error });
  switch (method) {
    case 'rpc.discover':
      return reply(spec);
    case 'echo':
      return typeof params.message === 'string' ? reply(params.message) : fail(invalidParams('message must be a string'));
    case 'notes.list': {
      let list = [...notes.values()].sort((a, b) => b.id - a.id);
      if (typeof params.tag === 'string') list = list.filter((note) => note.tags.includes(params.tag));
      const limit = Number.isInteger(params.limit) ? params.limit : 20;
      return reply(list.slice(0, limit));
    }
    case 'notes.create': {
      if (typeof params.title !== 'string' || params.title.trim() === '') {
        return fail(invalidParams('title must be a non-empty string'));
      }
      const note = {
        id: nextId++,
        title: params.title,
        body: typeof params.body === 'string' ? params.body : null,
        tags: Array.isArray(params.tags) ? params.tags.filter((tag) => typeof tag === 'string') : [],
        createdAt: new Date().toISOString()
      };
      notes.set(note.id, note);
      return reply(note);
    }
    case 'notes.get': {
      const note = notes.get(params.id);
      return note ? reply(note) : fail(notFound(params.id));
    }
    case 'notes.delete': {
      if (!notes.has(params.id)) return fail(notFound(params.id));
      notes.delete(params.id);
      return reply(true);
    }
    case 'notes.export': {
      const list = [...notes.values()].sort((a, b) => a.id - b.id);
      if (params.format === 'markdown') {
        return reply(
          list
            .map((note) => `# ${note.title}\n\n${note.body ?? ''}\n\n_tags: ${note.tags.join(', ') || '—'}_`)
            .join('\n\n---\n\n')
        );
      }
      return reply(list);
    }
    case 'notes.clear': {
      const count = notes.size;
      notes.clear();
      return reply(count);
    }
    default:
      return fail({ code: -32601, message: `Method not found: ${method}` });
  }
}

export function dispatch(request, spec) {
  if (Array.isArray(request)) {
    const responses = request.filter((item) => item?.id !== undefined).map((item) => handle(item, spec));
    return responses.length ? responses : undefined;
  }
  if (request?.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    return { jsonrpc: '2.0', id: request?.id ?? null, error: { code: -32600, message: 'Invalid Request' } };
  }
  if (request.id === undefined) {
    handle(request, spec);
    return undefined;
  }
  return handle(request, spec);
}