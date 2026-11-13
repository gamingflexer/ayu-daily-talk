// Adapter: Vercel Node function (req, res) → handleApi.
import { handleApi } from './api.js';
import { clientIp } from './guard.js';

async function readBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body;
  }
  // Fallback when the runtime did not parse the body.
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 32 * 1024) return {};
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return {};
  }
}

export function vercelHandler(route) {
  return async function handler(req, res) {
    const body = req.method === 'POST' ? await readBody(req) : undefined;
    const out = await handleApi(route, {
      method: req.method,
      headers: req.headers,
      body,
      ip: clientIp(req.headers, req.socket?.remoteAddress),
    });
    res.statusCode = out.status;
    for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
    if (out.body == null) return res.end();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(out.body));
  };
}
