// Static server for the production build in dist/, so the site can be served
// from this machine through the Cloudflare tunnel (loomhozer.ca) alongside the
// Netlify deploy. Node built-ins only, apart from tools/live-builds.mjs, which
// republishes the live builds through vite.config.ts.
//
// It mirrors netlify.toml: the Unity builds ship Brotli-precompressed (.br)
// assets that must go out with Content-Encoding: br and the *decoded* content
// type, and every unmatched route falls back to index.html so client-side
// routing survives a direct load or refresh.
//
// Run: node serve-site.cjs  (PORT env overrides 8082; .cjs because the package
// is type:module and this file is plain CommonJS)
// The build must exist first: npm run build

const http = require('http');
const fs = require('fs');
const path = require('path');
const edit = require('./tools/edit-server.cjs');

const PORT = Number(process.env.PORT) || 8082;
const ROOT = path.join(__dirname, 'dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.shader': 'text/plain; charset=utf-8',
  '.data': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

// A .br file is served as-is with the encoding declared; the type comes from
// the extension underneath (foo.wasm.br -> application/wasm).
// Loom runs on pthreads, which need a cross-origin isolated page; see the "/*"
// block in netlify.toml.
function headersFor(file) {
  const h = {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  };
  let name = file;
  if (name.endsWith('.br')) {
    h['Content-Encoding'] = 'br';
    name = name.slice(0, -3);
  } else if (name.endsWith('.gz')) {
    h['Content-Encoding'] = 'gzip';
    name = name.slice(0, -3);
  }
  h['Content-Type'] = TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream';
  return h;
}

function resolve(urlPath) {
  let rel;
  try {
    rel = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const abs = path.join(ROOT, path.normalize(rel).replace(/^([/\\])+/, ''));
  // Refuse anything that escapes dist/.
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
  try {
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      const idx = path.join(abs, 'index.html');
      return fs.existsSync(idx) ? idx : null;
    }
    return abs;
  } catch {
    return null;
  }
}

// Loom's WebAssembly build. Unlike Vite's output its filenames carry no content
// hash (the player, the scene and its assets are rebuilt in place), so it must not
// be cached as immutable or a rebuilt scene would never reach anyone who had
// already loaded the old one.
const ENGINE_DIR = path.join(ROOT, 'engine-build') + path.sep;

function send(res, file, status = 200) {
  const h = headersFor(file);
  h['Content-Length'] = fs.statSync(file).size;
  // Hashed assets are immutable; HTML must revalidate so a redeploy is picked up.
  // Every .json here is state that is rewritten in place under a fixed name:
  // content-overrides.json whenever the host edits some text, and each build's
  // version.json whenever it is rebuilt. They revalidate as index.html does.
  h['Cache-Control'] = file.endsWith('.html') || file.endsWith('.json')
    ? 'no-cache'
    : file.startsWith(ENGINE_DIR)
      ? 'public, max-age=300, must-revalidate'
      : 'public, max-age=31536000, immutable';
  res.writeHead(status, h);
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  // In-place text editing, answered only for a request off a local socket.
  if (edit.handle(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    return res.end('Method Not Allowed');
  }
  const file = resolve(req.url || '/');
  if (file) return send(res, file);

  // SPA fallback, matching netlify.toml's /* -> /index.html 200 rewrite.
  const index = path.join(ROOT, 'index.html');
  if (fs.existsSync(index)) return send(res, index);

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found (is dist/ built? run: npm run build)');
});

server.listen(PORT, () => {
  console.log(`site server listening on http://127.0.0.1:${PORT} (root: ${ROOT})`);
  import('./tools/live-builds.mjs')
    .then((live) => live.watch(ROOT))
    // Without it the live builds stay as last published, and serving carries on.
    .catch((err) => console.error(`live builds are not watched: ${err.message}`));
});
