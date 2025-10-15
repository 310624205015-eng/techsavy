import type { IncomingMessage, ServerResponse } from 'http';
// No Supabase client required in this middleware (frontend calls Apps Script directly)

// Dev middleware that proxies /api/sheets requests to a deployed Apps Script web app
// and handles CORS preflight (OPTIONS). Reads the target URL from VITE_APPS_SCRIPT_URL.
// Also syncs all data to sheets on startup
// Middleware proxies /api/sheets requests to the configured Apps Script URL (Vite frontend uses Apps Script directly).

export default function sheetsMiddleware(
  req: IncomingMessage & { url?: string; method?: string; headers?: any },
  res: ServerResponse & { statusCode?: number; end?: (data?: any) => void; setHeader?: (k: string, v: string) => void },
  next: () => void
) {
  try {
    if (!req.url?.startsWith('/api/sheets')) return next();

    // No server-side startup sync here; frontend will call Apps Script directly

    const appsScriptUrl = process.env.VITE_APPS_SCRIPT_URL;
    const origin = (req.headers && (req.headers.origin || req.headers.Origin)) || '*';

    const setCors = () => {
      res.setHeader?.('Access-Control-Allow-Origin', origin as string);
      res.setHeader?.('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader?.('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      res.setHeader?.('Access-Control-Allow-Credentials', 'true');
    };

    // Handle preflight
    if (req.method === 'OPTIONS') {
      setCors();
      res.statusCode = 204;
      res.end();
      return;
    }

    if (!appsScriptUrl) {
      setCors();
      res.statusCode = 410;
      res.setHeader?.('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'VITE_APPS_SCRIPT_URL not configured. Set it in your .env.' }));
      return;
    }

    // Read incoming request body
    const readBody = async () => new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
      req.on('error', reject);
    });

    (async () => {
      const body = await readBody();

      // Forward request to Apps Script
      const fetchHeaders: Record<string, string> = {};
      if (req.headers) {
        for (const [k, v] of Object.entries(req.headers)) {
          if (!v) continue;
          const key = k.toLowerCase();
          if (key === 'host' || key === 'content-length') continue;
          // Basic forwarding of content-type/authorization
          fetchHeaders[key] = Array.isArray(v) ? v.join(',') : String(v);
        }
      }

      const fetchOpts: any = {
        method: req.method as string,
        headers: fetchHeaders,
      };
      if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
        fetchOpts.body = body || undefined;
      }

      // Use global fetch (Node 18+) if available
      const fetchFn = (globalThis as any).fetch;
      if (typeof fetchFn !== 'function') {
        setCors();
        res.statusCode = 500;
        res.setHeader?.('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Server runtime does not have fetch. Upgrade Node or run a proxy server.' }));
        return;
      }

      try {
  const target = appsScriptUrl;
  const r = await fetchFn(target, fetchOpts);
  const text = await r.text();

  // Print the response from Apps Script to the terminal for debugging
  // eslint-disable-next-line no-console
  console.log('[Sheets Proxy] Response from Apps Script:', text);

  setCors();
  res.statusCode = r.status;
  const contentType = r.headers.get('content-type');
  if (contentType) res.setHeader?.('Content-Type', contentType);
  res.end(text);
      } catch (err: any) {
        setCors();
        res.statusCode = 502;
        res.setHeader?.('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err?.message || String(err) }));
      }
    })();
  } catch (err) {
    // On unexpected error, log and continue
    // eslint-disable-next-line no-console
    console.error('sheetsMiddleware proxy error:', err);
    try {
      return next();
    } catch (_) {
      return;
    }
  }
}

// Note: server-side startup sync removed. Frontend will call Apps Script directly using VITE_APPS_SCRIPT_URL.
