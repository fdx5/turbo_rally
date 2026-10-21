import type { IncomingMessage, ServerResponse } from 'node:http';

export interface Req {
  method: string;
  url: string;
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
  cookies: Record<string, string>;
}
export interface Res {
  status: number;
  json: unknown;
  cookies: string[];
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Handler = (req: Req) => Promise<unknown> | unknown;

function parseCookies(h: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (h ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const cookieJar = new WeakMap<Req, string[]>();
export function setCookie(req: Req, c: string) {
  const arr = cookieJar.get(req) ?? [];
  arr.push(c);
  cookieJar.set(req, arr);
}

/** Wraps a handler as a Vercel Node function (req, res) — also used by the Vite dev middleware. */
export function route(methods: string[], h: Handler) {
  return async (nreq: IncomingMessage & { body?: unknown; query?: Record<string, string> }, nres: ServerResponse) => {
    const url = new URL(nreq.url ?? '/', 'http://x');
    const query: Record<string, string> = { ...Object.fromEntries(url.searchParams), ...(nreq.query ?? {}) };
    let body = nreq.body;
    if (body === undefined && nreq.method !== 'GET') {
      const chunks: Buffer[] = [];
      for await (const c of nreq) chunks.push(c as Buffer);
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = {};
      }
    }
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        /* keep */
      }
    }
    const req: Req = { method: nreq.method ?? 'GET', url: nreq.url ?? '/', query, body: body ?? {}, headers: nreq.headers, cookies: parseCookies(nreq.headers.cookie) };
    let status = 200;
    let payload: unknown;
    try {
      if (!methods.includes(req.method)) throw new HttpError(405, 'method not allowed');
      // CSRF: state-changing requests must carry the custom client header (§12.2)
      if (req.method !== 'GET' && req.headers['x-tr-client'] !== 'turbo-rally') throw new HttpError(403, 'bad client');
      payload = await h(req);
    } catch (e) {
      if (e instanceof HttpError) {
        status = e.status;
        payload = { error: e.message };
      } else {
        console.error('[api]', req.url, e);
        status = 500;
        payload = { error: '서버 오류가 발생했어요' };
      }
    }
    const cookies = cookieJar.get(req);
    if (cookies?.length) nres.setHeader('Set-Cookie', cookies);
    nres.statusCode = status;
    nres.setHeader('Content-Type', 'application/json; charset=utf-8');
    nres.setHeader('Cache-Control', 'no-store');
    nres.end(JSON.stringify(payload ?? null));
  };
}
export const bad = (msg: string) => new HttpError(400, msg);
