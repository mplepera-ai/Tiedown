// Static file server with an optional server-side PIN gate.
//
//   APP_PIN     if set, every page and script requires the PIN (checked here, not in the browser)
//   APP_SECRET  optional cookie-signing secret (defaults to a hash of APP_PIN)
//   PORT        default 3000
//
// The gate is real access control only because the files are never sent without a valid
// session cookie. A PIN in front-end JavaScript on a static site would not be. Use a long
// PIN (8+ characters); failed attempts are rate limited per client IP.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const PORT = Number(process.env.PORT) || 3000;
const PIN = process.env.APP_PIN || '';
const SECRET = process.env.APP_SECRET || crypto.createHash('sha256').update('tiedown-session:' + PIN).digest('hex');
const SESSION_DAYS = Number(process.env.SESSION_DAYS) || 30;
const COOKIE = 'tiedown_session';
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('hex');

function makeCookie(secure) {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  const v = `${exp}.${sign(String(exp))}`;
  return `${COOKIE}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`;
}

function validSession(req) {
  const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!m) return false;
  const [exp, mac] = m.slice(COOKIE.length + 1).split('.');
  if (!exp || !mac || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const good = sign(exp);
  return mac.length === good.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good));
}

const fails = new Map(); // ip -> { n, until }
const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
const isSecure = (req) => req.headers['x-forwarded-proto'] === 'https' || !!req.socket.encrypted;

function lockPage(message = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Tiedown - locked</title>
<style>body{font-family:system-ui,sans-serif;background:#f4f6f8;color:#17212b;display:grid;place-items:center;min-height:100vh;margin:0}
@media(prefers-color-scheme:dark){body{background:#11171d;color:#e6ecf1}input{background:#19222b;color:#e6ecf1}}
form{background:transparent;border:1px solid #8886;border-radius:10px;padding:1.5rem;width:min(92vw,340px)}
h1{font-size:1.2rem;margin:0 0 .3rem}p{margin:.2rem 0 1rem;font-size:.9rem;opacity:.75}
input{width:100%;padding:.6rem;font:inherit;border:1px solid #8886;border-radius:6px;box-sizing:border-box}
button{margin-top:.8rem;width:100%;padding:.6rem;font:inherit;border:0;border-radius:6px;background:#0b5cad;color:#fff;cursor:pointer}
.err{color:#b3261e;font-size:.85rem;margin-top:.6rem}</style></head><body>
<form method="post" action="/unlock" autocomplete="off"><h1>Tiedown</h1><p>This app is still in development. Enter the access PIN.</p>
<input name="pin" type="password" inputmode="text" autofocus required aria-label="Access PIN">
<button type="submit">Unlock</button>${message ? `<div class="err">${message}</div>` : ''}</form></body></html>`;
}

function baseHeaders(extra = {}) {
  return {
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    ...extra,
  };
}

function readBody(req, limit = 2048) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > limit) {
        reject(new Error('too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function serveFile(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
    res.writeHead(403, baseHeaders()).end('Forbidden');
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, baseHeaders({ 'Content-Type': 'text/plain' })).end('Not found');
      return;
    }
    const type = MIME[path.extname(file)] || 'application/octet-stream';
    res.writeHead(
      200,
      baseHeaders({
        'Content-Type': type,
        'Cache-Control': PIN ? 'private, no-store' : 'no-cache',
        'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      })
    );
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = req.url || '/';
    if (url === '/healthz') return void res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
    if (url === '/robots.txt') return void res.writeHead(200, { 'Content-Type': 'text/plain' }).end('User-agent: *\nDisallow: /\n');

    if (PIN) {
      if (url === '/unlock' && req.method === 'POST') {
        const ip = clientIp(req);
        const rec = fails.get(ip) || { n: 0, until: 0 };
        if (rec.until > Date.now()) {
          return void res.writeHead(429, baseHeaders({ 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '900' })).end(lockPage('Too many attempts. Try again in 15 minutes.'));
        }
        const params = new URLSearchParams(await readBody(req));
        if (safeEqual(params.get('pin') || '', PIN)) {
          fails.delete(ip);
          return void res.writeHead(303, baseHeaders({ 'Set-Cookie': makeCookie(isSecure(req)), Location: '/' })).end();
        }
        rec.n += 1;
        if (rec.n >= MAX_FAILS) {
          rec.n = 0;
          rec.until = Date.now() + LOCK_MS;
        }
        fails.set(ip, rec);
        return void res.writeHead(401, baseHeaders({ 'Content-Type': 'text/html; charset=utf-8' })).end(lockPage('Incorrect PIN.'));
      }
      if (url === '/logout') {
        return void res.writeHead(303, baseHeaders({ 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0`, Location: '/' })).end();
      }
      if (!validSession(req)) {
        return void res.writeHead(401, baseHeaders({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })).end(lockPage());
      }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return void res.writeHead(405, baseHeaders()).end('Method not allowed');
    serveFile(req, res, url);
  } catch {
    res.writeHead(400, baseHeaders()).end('Bad request');
  }
});

server.listen(PORT, () => {
  console.log(`Tiedown on http://localhost:${PORT}  (PIN gate ${PIN ? 'ON' : 'OFF - set APP_PIN to enable'})`);
});
