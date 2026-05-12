// Vite dev-server plugin that exposes /api/analyze and forwards to
// Anthropic. Keeps the API key out of the browser. Phase 7 will move
// this same logic to a Vercel Edge Function; the request/response
// contract should stay identical so the client doesn't need to change.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin, type ConfigEnv } from 'vite';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const PROXIED_PATHS = new Set(['/api/analyze', '/api/converse']);

export function anthropicProxy(): Plugin {
  let apiKey: string | undefined;

  return {
    name: 'anthropic-proxy',

    config(_config, env: ConfigEnv) {
      // Vite only auto-loads VITE_-prefixed vars; we need the bare
      // ANTHROPIC_API_KEY for server-side use.
      const loaded = loadEnv(env.mode, process.cwd(), '');
      apiKey = loaded.ANTHROPIC_API_KEY;
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (!url || !PROXIED_PATHS.has(url)) return next();
        await handle(req, res, apiKey);
      });
    },
  };
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  apiKey: string | undefined,
): Promise<void> {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }
  if (!apiKey) {
    return sendJson(res, 500, {
      error:
        'ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.example).',
    });
  }

  const body = await readBody(req);
  if (!body.trim()) {
    return sendJson(res, 400, { error: 'Empty request body' });
  }

  try {
    JSON.parse(body);
  } catch {
    return sendJson(res, 400, { error: 'Request body is not valid JSON' });
  }

  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'application/json',
    );
    res.end(text);
  } catch (err) {
    sendJson(res, 502, {
      error: 'Upstream request to Anthropic failed',
      details: err instanceof Error ? err.message : String(err),
    });
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}
