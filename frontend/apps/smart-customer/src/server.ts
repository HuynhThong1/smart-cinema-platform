import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const app = express();
const browser = resolve(dirname(fileURLToPath(import.meta.url)), '../browser');
const allowedHosts = (
  process.env['SSR_ALLOWED_HOSTS'] ||
  ['localhost', '127.0.0.1', process.env['RENDER_EXTERNAL_HOSTNAME']].filter(Boolean).join(',')
).split(',');
const apiUrl = (process.env['API_INTERNAL_URL'] || 'http://127.0.0.1:8080').replace(/\/$/, '');
const angular = new AngularNodeAppEngine({
  allowedHosts,
});
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});
app.get('/healthz', (_req, res) => res.status(200).type('text/plain').send('ok'));
app.use('/api/v1/public', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  try {
    const upstream = await fetch(apiUrl + req.originalUrl, {
      method: req.method,
      headers: {
        'content-type': req.get('content-type') || 'application/json',
        'X-Forwarded-For': req.socket.remoteAddress || '',
      },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
      signal: AbortSignal.timeout(15000),
    });
    res.status(upstream.status);
    for (const key of ['content-type', 'x-request-id', 'retry-after']) {
      const value = upstream.headers.get(key);
      if (value) res.setHeader(key, value);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(503).json({ error: 'Service unavailable', code: 'UNAVAILABLE' });
  }
});
app.use(express.static(browser, { maxAge: '1y', index: false, redirect: false }));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.vary('Cookie');
  angular
    .handle(req, { clientIP: req.socket.remoteAddress || '' })
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});
if (isMainModule(import.meta.url))
  app.listen(Number(process.env['PORT'] || 4201), process.env['HOST'] || '127.0.0.1');
export const reqHandler = createNodeRequestHandler(app);
