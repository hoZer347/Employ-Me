// Server half of the in-place text editing policy: it decides who may edit, and
// stores what they wrote.
//
// The decision is made at the socket, never in the browser, because a browser
// cannot be asked to prove where it is. The awkward case is loomhozer.ca: it
// reaches serve-site.cjs through the Cloudflare tunnel, so cloudflared is the
// one holding the socket and *every* visitor on the internet arrives from
// 127.0.0.1. A remote-address test on its own would publish the editor. Four
// things have to hold together:
//
//   1. the socket address is loopback (or, with SITE_EDIT_LAN=1, an address
//      this machine actually holds),
//   2. none of the headers a proxy adds are present — cloudflared always sets
//      them and a client on the far side cannot strip them,
//   3. the Host is a local one, so a request for loomhozer.ca is out even if it
//      somehow arrived on a local socket,
//   4. the request is same-site, because any page the host happens to have open
//      in a tab reaches this server over loopback exactly like the site does.
//
// Netlify runs no server, so /__edit/* is answered nowhere near it and the
// deployed copy is read-only for everyone, the owner included.

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// The committed source of truth, copied into dist/ by Vite's public dir. Saves
// also land in a built dist/ so the :8082 server shows them without a rebuild.
const SOURCE = path.join(ROOT, 'public', 'content-overrides.json');
const PUBLISHED = path.join(ROOT, 'dist', 'content-overrides.json');

const PROXY_HEADERS = [
  'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip',
  'forwarded', 'cf-connecting-ip', 'cf-ray', 'cf-ipcountry', 'cdn-loop', 'via',
];

const MAX_BODY = 64 * 1024;
const MAX_HTML = 8 * 1024;
const MAX_FILE = 1024 * 1024;

// "#panel-resume/div:0/section:2/p:1" — an id to anchor to, then a child index
// per level. Built by src/editable.ts; anything else is not ours.
const KEY = /^#[A-Za-z0-9_.:-]{1,64}(?:\/[a-z0-9-]{1,32}:\d{1,4}){0,32}$/;

// Only the words may change. An edit has to carry the very tags the page's own
// code renders, byte for byte and in the same order, bar the line breaks that
// Shift+Enter puts in. An edit can then never introduce markup the site was not
// already serving, which is what makes it safe to hand back to innerHTML for
// every visitor. It beats a reject list, which has to guess at the tricks:
// <img/onerror=x> carries no space before its attribute and no <script>.
const BR = /^<br\s*\/?>$/i;

/** The tags in `html`, or null if some "<" in it opens no tag. */
function tagsOf(html) {
  const found = html.match(/<[^>]*>/g) || [];
  // An unterminated tag is dropped by the HTML parser rather than rendered, so
  // it would never reach the comparison below. Refuse the edit, don't ignore it.
  if (found.length !== (html.match(/</g) || []).length) return null;
  return found.filter((tag) => !BR.test(tag));
}

function sameMarkup(edited, rendered) {
  const a = tagsOf(edited);
  const b = tagsOf(rendered);
  if (!a || !b || a.length !== b.length) return false;
  return a.every((tag, i) => tag === b[i]);
}

/** Strip the IPv4-mapped IPv6 prefix so ::ffff:127.0.0.1 reads as 127.0.0.1. */
function normalize(addr) {
  return String(addr || '').replace(/^::ffff:/i, '').toLowerCase();
}

/** For a socket address, where the whole of 127.0.0.0/8 is loopback. */
function isLoopbackAddress(addr) {
  return addr === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(addr);
}

/** Every address this machine currently holds, for the SITE_EDIT_LAN case. */
function ownAddresses() {
  const out = new Set();
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) out.add(normalize(ni.address));
  }
  return out;
}

/**
 * For a hostname, where the same prefix test would be a hole: "127.evil.example"
 * is a name someone else owns, and one A record makes it resolve to this server.
 */
function isLocalHostname(name) {
  if (name === 'localhost' || name === '127.0.0.1' || name === '::1') return true;
  return process.env.SITE_EDIT_LAN === '1' && ownAddresses().has(name);
}

/** Hostname out of a Host header, minus the port and any IPv6 brackets. */
function hostname(header) {
  const value = String(header || '').trim().toLowerCase();
  if (value.startsWith('[')) return value.slice(1, value.indexOf(']'));
  return value.split(':')[0];
}

function isOwner(req) {
  for (const header of PROXY_HEADERS) {
    if (req.headers[header] !== undefined) return false;
  }

  const lan = process.env.SITE_EDIT_LAN === '1';
  const addr = normalize(req.socket.remoteAddress);
  if (!isLoopbackAddress(addr) && !(lan && ownAddresses().has(addr))) return false;

  return isLocalHostname(hostname(req.headers.host));
}

/**
 * True unless the request came from somewhere else. A page on any site the host
 * has open in a tab reaches this server over loopback like the site itself, so
 * without this the socket test would let whatever they are browsing rewrite
 * their text. A cross-site request either says so in Origin or Sec-Fetch-Site,
 * or is forced into a preflight by the content type save() insists on, and no
 * response here carries a CORS header, so that preflight fails.
 */
function isSameSite(req) {
  const origin = req.headers.origin;
  if (origin !== undefined) {
    let name;
    try {
      name = new URL(origin).hostname;
    } catch {
      return false;
    }
    if (!isLocalHostname(name.replace(/^\[|\]$/g, ''))) return false;
  }
  // "none" is a typed-in address bar, which cannot be a cross-site POST anyway.
  const site = req.headers['sec-fetch-site'];
  return site === undefined || site === 'same-origin' || site === 'none';
}

function readOverrides() {
  try {
    const parsed = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Write via a temp file so a crash mid-write cannot leave a half-parsed file. */
function writeOverrides(overrides) {
  const json = JSON.stringify(overrides, null, 2) + '\n';
  if (Buffer.byteLength(json) > MAX_FILE) throw new Error('overrides file too large');

  fs.mkdirSync(path.dirname(SOURCE), { recursive: true });
  const tmp = SOURCE + '.tmp';
  fs.writeFileSync(tmp, json);
  fs.renameSync(tmp, SOURCE);

  // Only if the site has been built: the server reads dist/ per request, so
  // mirroring here is what makes a save visible on a reload of :8082.
  if (fs.existsSync(path.dirname(PUBLISHED))) fs.writeFileSync(PUBLISHED, json);
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function save(req, res) {
  void readBody(req).then(
    (raw) => {
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return json(res, 400, { error: 'malformed JSON' });
      }

      const { key, html, original } = body || {};
      if (typeof key !== 'string' || !KEY.test(key)) {
        return json(res, 400, { error: 'bad key' });
      }
      if (typeof html !== 'string' || typeof original !== 'string') {
        return json(res, 400, { error: 'bad payload' });
      }
      if (html.length > MAX_HTML) return json(res, 413, { error: 'text too long' });
      if (!sameMarkup(html, original)) return json(res, 400, { error: 'markup changed' });

      const overrides = readOverrides();
      // Typing the original text back is how an edit is undone: the entry goes
      // rather than being stored as a no-op.
      if (html === original) delete overrides[key];
      else overrides[key] = { html, original };

      try {
        writeOverrides(overrides);
      } catch (err) {
        return json(res, 500, { error: String(err.message || err) });
      }
      json(res, 200, { saved: true, cleared: html === original });
    },
    (err) => json(res, 413, { error: String(err.message || err) }),
  );
}

/** Answer an /__edit/* request. Returns false so the caller can carry on. */
function handle(req, res) {
  const url = (req.url || '').split('?')[0];
  if (!url.startsWith('/__edit/')) return false;

  const owner = isOwner(req) && isSameSite(req);

  if (url === '/__edit/session' && req.method === 'GET') {
    json(res, 200, { editable: owner });
    return true;
  }
  if (url === '/__edit/save' && req.method === 'POST') {
    // Insisted on so a cross-origin caller cannot arrive as a simple request:
    // text/plain and the form encodings are exempt from preflight, JSON is not.
    const type = String(req.headers['content-type'] || '').split(';')[0].trim();
    if (!owner) json(res, 403, { error: 'not the host' });
    else if (type.toLowerCase() !== 'application/json') {
      json(res, 415, { error: 'expected application/json' });
    } else save(req, res);
    return true;
  }

  json(res, 404, { error: 'no such endpoint' });
  return true;
}

module.exports = { handle };
