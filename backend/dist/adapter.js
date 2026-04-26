"use strict";
/**
 * Next.js Route Handler → Express Adapter
 *
 * Converts Next.js NextRequest/NextResponse API to Express req/res.
 * This lets us reuse the existing route handlers with minimal changes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NextResponse = exports.NextRequest = void 0;
exports.adaptRoute = adaptRoute;
// Minimal NextRequest shim
class NextRequest {
    constructor(req) {
        this._expressReq = req;
        const proto = req.headers['x-forwarded-proto'] || 'http';
        const host = req.headers.host || 'localhost:4000';
        this.url = `${proto}://${host}${req.originalUrl || '/'}`;
        this.method = req.method || 'GET';
        // Build Headers object including Authorization from Express
        const rawHeaders = {};
        const expressHeaders = req.headers || {};
        for (const [key, val] of Object.entries(expressHeaders)) {
            if (typeof val === 'string')
                rawHeaders[key] = val;
            else if (Array.isArray(val))
                rawHeaders[key] = val.join(', ');
        }
        this.headers = new Headers(rawHeaders);
        this._body = req.body;
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
            get: (name) => cookies[name] ? { value: cookies[name] } : undefined,
            getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value: value })),
        };
    }
}
exports.NextRequest = NextRequest;
// Minimal NextResponse shim
class NextResponse {
    constructor(body, init) {
        this._body = body;
        this._status = init?.status || 200;
        this._headers = init?.headers || {};
    }
    static json(data, init) {
        return new NextResponse(data, init);
    }
    static redirect(url, status = 302) {
        const r = new NextResponse(null, { status });
        r._headers['Location'] = url;
        return r;
    }
    get status() { return this._status; }
    send(res) {
        Object.entries(this._headers).forEach(([k, v]) => res.setHeader(k, v));
        res.status(this._status).json(this._body);
    }
}
exports.NextResponse = NextResponse;
function adaptRoute(handler, params) {
    return async (req, res) => {
        try {
            const nextReq = new NextRequest(req);
            // Merge Express route params
            const routeParams = { ...req.params, ...(params || {}) };
            const result = await handler(nextReq, { params: routeParams });
            if (result && typeof result.send === 'function') {
                result.send(res);
            }
            else {
                res.status(200).json(result);
            }
        }
        catch (err) {
            console.error('Route error:', err);
            res.status(500).json({ error: err.message || 'Internal server error' });
        }
    };
}
