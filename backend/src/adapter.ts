/**
 * Next.js Route Handler → Express Adapter
 *
 * Converts Next.js NextRequest/NextResponse API to Express req/res.
 * This lets us reuse the existing route handlers with minimal changes.
 */

import { Request, Response } from 'express';

// Minimal NextRequest shim
export class NextRequest {
  url: string;
  method: string;
  headers: Headers;
  private _body: unknown;
  private _expressReq: Request;

  constructor(req: Request) {
    this._expressReq = req;
    const proto = (req as any).headers['x-forwarded-proto'] || 'http';
    const host = (req as any).headers.host || 'localhost:4000';
    this.url = `${proto}://${host}${(req as any).originalUrl || '/'}`;
    this.method = (req as any).method || 'GET';

    // Build Headers object including Authorization from Express
    const rawHeaders: Record<string, string> = {};
    const expressHeaders = (req as any).headers || {};
    for (const [key, val] of Object.entries(expressHeaders)) {
      if (typeof val === 'string') rawHeaders[key] = val;
      else if (Array.isArray(val)) rawHeaders[key] = (val as string[]).join(', ');
    }
    this.headers = new Headers(rawHeaders);
    this._body = (req as any).body;
  }

  async json() { return this._body; }
  async text() { return JSON.stringify(this._body); }

  get nextUrl() {
    const u = new URL(this.url);
    return { pathname: u.pathname, searchParams: u.searchParams };
  }

  get cookies() {
    const cookies = this._expressReq.cookies || {};
    return {
      get: (name: string) => cookies[name] ? { value: cookies[name] } : undefined,
      getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value: value as string })),
    };
  }
}

// Minimal NextResponse shim
export class NextResponse {
  private _body: unknown;
  private _status: number;
  private _headers: Record<string, string>;

  constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    this._body = body;
    this._status = init?.status || 200;
    this._headers = init?.headers || {};
  }

  static json(data: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    return new NextResponse(data, init);
  }

  static redirect(url: string, status = 302) {
    const r = new NextResponse(null, { status });
    r._headers['Location'] = url;
    return r;
  }

  get status() { return this._status; }

  send(res: Response) {
    Object.entries(this._headers).forEach(([k, v]) => res.setHeader(k, v));
    res.status(this._status).json(this._body);
  }
}

// Wrap a Next.js route handler for Express
type NextHandler = (req: NextRequest, ctx?: { params: Record<string, string> }) => Promise<NextResponse>;

export function adaptRoute(handler: NextHandler, params?: Record<string, string>) {
  return async (req: Request, res: Response) => {
    try {
      const nextReq = new NextRequest(req);
      // Merge Express route params
      const routeParams = { ...req.params, ...(params || {}) };
      const result = await handler(nextReq as any, { params: routeParams });
      if (result && typeof (result as any).send === 'function') {
        (result as any).send(res);
      } else {
        res.status(200).json(result);
      }
    } catch (err: any) {
      console.error('Route error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  };
}
