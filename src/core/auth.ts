export type AuthScheme = 'bearer' | 'basic' | 'custom';

export interface AuthSettings {
  scheme: AuthScheme;
  token?: string;
  username?: string;
  password?: string;
  headerName?: string;
  headerValue?: string;
}

export function authHeaders(auth?: AuthSettings): Record<string, string> {
  if (!auth) return {};
  if (auth.scheme === 'bearer' && auth.token) {
    return { Authorization: `Bearer ${auth.token}` };
  }
  if (auth.scheme === 'basic' && (auth.username || auth.password)) {
    return { Authorization: `Basic ${btoa(`${auth.username ?? ''}:${auth.password ?? ''}`)}` };
  }
  if (auth.scheme === 'custom' && auth.headerName && auth.headerValue) {
    return { [auth.headerName]: auth.headerValue };
  }
  return {};
}