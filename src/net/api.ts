/** Thin client for /api/* (the browser never talks to Turso directly, §12.1). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-TR-Client': 'turbo-rally' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string })?.error ?? `서버 오류 (${res.status})`);
  return data as T;
}
let online: boolean | null = null;
export async function serverAvailable(): Promise<boolean> {
  if (online !== null) return online;
  try {
    const r = await fetch('/api/health', { headers: { 'X-TR-Client': 'turbo-rally' } });
    online = r.ok && (await r.json()).ok === true;
  } catch {
    online = false;
  }
  return online;
}
