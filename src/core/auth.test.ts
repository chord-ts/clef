import { describe, expect, it } from 'vitest';
import { authHeaders } from './auth';

describe('authHeaders', () => {
  it('returns empty without settings or with incomplete values', () => {
    expect(authHeaders()).toEqual({});
    expect(authHeaders({ scheme: 'bearer' })).toEqual({});
    expect(authHeaders({ scheme: 'basic' })).toEqual({});
    expect(authHeaders({ scheme: 'custom', headerName: 'X-Key' })).toEqual({});
  });

  it('builds bearer, basic and custom headers', () => {
    expect(authHeaders({ scheme: 'bearer', token: 'tok' })).toEqual({ Authorization: 'Bearer tok' });
    expect(authHeaders({ scheme: 'basic', username: 'u', password: 'p' })).toEqual({
      Authorization: `Basic ${btoa('u:p')}`
    });
    expect(authHeaders({ scheme: 'custom', headerName: 'X-Key', headerValue: 'v' })).toEqual({ 'X-Key': 'v' });
  });
});