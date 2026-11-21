import { defineConfig, type Connect, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";
import { createRequire } from "node:module";

// Each game is a Unity WebGL build served same-origin from this site. In dev a
// middleware streams it straight from its repo folder; in prod the bundler
// copies it into dist. The builds are git-ignored (large binaries), so this
// list is the single source of truth. Two shapes:
//
//   wrapper: true  → a themed loader page at /<slug>/ frames the build (served
//                    from /<slug>-build) in an iframe with a Back-to-portfolio
//                    header. Needs a <slug>/index.html loader page + src entry.
//   wrapper: false → the build IS the page at /<slug>/ (no themed chrome). Use
//                    this when the build folder is itself named <slug>.
interface Game {
  slug: string; // URL slug and deployed asset-name prefix
  dir: string; // build folder, relative to the repo root
  wrapper: boolean;
  // Off the gallery and off Netlify: shipped as Unity's gzip under content-hashed
  // names, and republished by tools/live-builds.mjs whenever its folder changes.
  live?: boolean;
}
export const GAMES: Game[] = [
  { slug: "gobspin", dir: "Gobspin Build", wrapper: true },
  { slug: "trust-no-one", dir: "Trust No One Build", wrapper: true },
  { slug: "brrreak-it-down", dir: "Brrreak it Down Build", wrapper: true },
  // Trust No One with the artist kit on, straight out of the game's own build folder.
  { slug: "tno-artist", dir: "../Brackeys GameJam/Build/Artist", wrapper: false, live: true },
  // SHIFT, framed by the unlinked loomhozer.ca#SHIFT page in src/shift.ts.
  { slug: "shift", dir: "SHIFT Build", wrapper: false, live: true },
];
export const gameDir = (game: Game) => path.resolve(import.meta.dirname, game.dir);
// Where the build is served/emitted: a sibling /<slug>-build for wrapper games
// (so /<slug>/ is free for the loader page), or /<slug> itself for direct ones.
export const gameBase = (game: Game) =>
  game.wrapper ? `${game.slug}-build` : game.slug;

// Precompressed Unity assets → the encoding the browser should decompress.
// Unity names gzip output either ".gz" or, with the default WebGL naming,
// ".unityweb"; both are gzip on the wire.
const ENCODING: Record<string, string> = {
  ".br": "br",
  ".gz": "gzip",
  ".unityweb": "gzip",
};

// Content types for the underlying file once the encoding is stripped.
export const CONTENT_TYPE: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".data": "application/octet-stream",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".shader": "text/plain", // Loom's combined vertex/fragment source
};

// version.json drives the loader's cache-busting ?v=; derive it from the newest
// file in the build so it tracks the actual game assets. (Keying off index.html
// is unreliable — Unity often doesn't rewrite it on a rebuild, so the version
// would read stale even though Build/*.br changed.)
export function newestMtime(dir: string): number {
  let newest = 0;
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else newest = Math.max(newest, fs.statSync(p).mtimeMs);
    }
  };
  walk(dir);
  return newest;
}

export function buildVersion(dir: string): string {
  const d = new Date(newestMtime(dir));
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// DEV: stream a game's build straight from its repo folder, so the page (themed
// wrapper or the build itself) can load it without a separate host.
function serveGame(game: Game): Plugin {
  const dir = gameDir(game);
  return {
    name: `serve-${game.slug}-webgl`,
    configureServer(server) {
      // connect strips this mount prefix from req.url below.
      server.middlewares.use(`/${gameBase(game)}`, (req, res, next) => {
        try {
          let rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
          if (rel === "/" || rel === "") rel = "/index.html";

          // Synthesize version.json from the build's timestamp (no file on disk).
          if (rel === "/version.json") {
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end(JSON.stringify({ build: buildVersion(dir) }));
            return;
          }

          const filePath = path.join(dir, rel);
          // Guard against path traversal outside the build folder.
          if (!filePath.startsWith(dir)) return next();
          if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            return next();
          }

          const ext = path.extname(filePath);
          if (ENCODING[ext]) {
            // Unity's pre-compressed assets (.br / .gz): declare the encoding so
            // the browser transparently decompresses, and type the inner file.
            res.setHeader("Content-Encoding", ENCODING[ext]);
            const innerExt = path.extname(filePath.slice(0, -ext.length));
            res.setHeader(
              "Content-Type",
              CONTENT_TYPE[innerExt] ?? "application/octet-stream",
            );
          } else if (CONTENT_TYPE[ext]) {
            res.setHeader("Content-Type", CONTENT_TYPE[ext]);
          }

          fs.createReadStream(filePath).pipe(res);
        } catch {
          next();
        }
      });
    },
  };
}

// Unity emits the three big assets (.data / .framework.js / .wasm) pre-compressed
// as .gz or .br depending on the build's WebGL "Compression Format" Player
// Setting. This player has no in-browser decompression fallback, so each asset
// must reach the browser either already-decoded or with a matching
// Content-Encoding header. The two formats need opposite handling on Netlify:
//
//   .br → ship AS-IS and declare `Content-Encoding: br` in netlify.toml. Netlify
//         passes .br through untouched, so this is the smallest transfer and the
//         browser decompresses it. (See the [[headers]] blocks in netlify.toml.)
//   .gz → DECODE at build to plain bytes. Netlify auto-decompresses .gz at its
//         edge and ignores a manual Content-Encoding header, so a .gz can't be
//         served intact; we gunzip it and ship the uncompressed file.
//         A live build skips that: only serve-site.cjs serves it, and Netlify
//         never has its folder.
//
// Either way the Unity product-name prefix (e.g. "Gobspin Build", "Trust
// No One Build") is normalized to the slug so deployed URLs (and the netlify.toml
// header globs) stay simple, lowercase, and space-free.
// Extensions Unity uses for compressed output. ".unityweb" is the default WebGL
// asset naming and ".gz" comes from the decompression-fallback-off variant. A
// Brotli build can also land on ".unityweb", so the caller sniffs the file
// rather than trusting the extension (see isGzip).
const MAYBE_GZIP = new Set([".gz", ".unityweb"]);

/** True if the file starts with the gzip magic number (1f 8b). */
function isGzip(file: string): boolean {
  const fd = fs.openSync(file, "r");
  try {
    const head = Buffer.alloc(2);
    return (
      fs.readSync(fd, head, 0, 2, 0) === 2 && head[0] === 0x1f && head[1] === 0x8b
    );
  } finally {
    fs.closeSync(fd);
  }
}

function deployName(
  file: string,
  prefix: string,
  slug: string,
  gzip: boolean,
  hash: string | null,
): { deployed: string; decode: (() => zlib.Gunzip) | null } {
  const ext = path.extname(file);
  // gzip is decoded and its extension dropped, unless a live build (hashed)
  // renames it .gz; .br and everything else ship as-is.
  const decode = gzip && !hash ? () => zlib.createGunzip() : null;
  const base = gzip ? file.slice(0, -ext.length) : file;
  const deployed = base.split(prefix).join(hash ? `${slug}.${hash}` : slug);
  return { deployed: gzip && hash ? `${deployed}.gz` : deployed, decode };
}

const HASH_LENGTH = 10;

function contentHash(file: string): string {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex")
    .slice(0, HASH_LENGTH);
}

/**
 * Copies a game's build into `outDir`, decoding or renaming its assets and
 * patching index.html to match. False if the build folder does not exist.
 */
export async function deployGame(game: Game, outDir: string): Promise<boolean> {
  const dir = gameDir(game);
  if (!fs.existsSync(dir)) return false;
  const dest = path.join(outDir, gameBase(game));

  // The asset filenames are prefixed with the Unity product name; derive it
  // from the one *.loader.js so renames work for any game.
  const loader = fs
    .readdirSync(path.join(dir, "Build"))
    .find((f) => f.endsWith(".loader.js"));
  const prefix = loader ? loader.slice(0, -".loader.js".length) : game.dir;

  // Recursively copy, decoding .gz assets unless live, and normalizing names.
  // Collect the source→deployed renames to patch the references in index.html.
  const renames: Record<string, string> = {};
  const copyDir = async (from: string, to: string) => {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const src = path.join(from, entry.name);
      if (entry.isDirectory()) {
        await copyDir(src, path.join(to, entry.name));
        continue;
      }
      const gzip = MAYBE_GZIP.has(path.extname(entry.name)) && isGzip(src);
      const { deployed, decode } = deployName(
        entry.name,
        prefix,
        game.slug,
        gzip,
        game.live ? contentHash(src) : null,
      );
      const out = path.join(to, deployed);
      if (decode) {
        await pipeline(
          fs.createReadStream(src),
          decode(),
          fs.createWriteStream(out),
        );
      } else fs.copyFileSync(src, out);
      if (deployed !== entry.name) renames[entry.name] = deployed;
    }
  };
  await copyDir(dir, dest);

  // Rewrite the Unity template's asset references to the deployed names.
  const indexPath = path.join(dest, "index.html");
  let html = fs.readFileSync(indexPath, "utf8");
  for (const [from, to] of Object.entries(renames)) {
    html = html.split(from).join(to);
  }
  fs.writeFileSync(indexPath, html);

  fs.writeFileSync(
    path.join(dest, "version.json"),
    JSON.stringify({ build: buildVersion(dir) }),
  );
  return true;
}

// PRODUCTION: copy a game's build into dist so the site serves it same-origin
// (no CORS). The dev middleware handles the same path during `vite dev`; this
// handles `vite build`.
function bundleGame(game: Game): Plugin {
  return {
    name: `bundle-${game.slug}-webgl`,
    apply: "build",
    async writeBundle(options) {
      const outDir = options.dir ?? path.resolve(import.meta.dirname, "dist");
      if (!(await deployGame(game, outDir))) {
        this.warn(
          `Build "${game.dir}" not found — skipping. ` +
            `The deployed /${game.slug} page will have nothing to load.`,
        );
      }
    },
  };
}

// --- Loom -------------------------------------------------------------------
//
// Loom's demo projects, built for the web by build-loom.sh with Loom's own Play
// Web pipeline, one folder per demo. They are served the same way as the games
// (a same-origin folder, streamed in dev and copied into dist for prod) but
// need none of the Unity handling above: nothing is pre-compressed and every
// URL in them is relative, so a plain copy is the whole job. Served under
// engine-build, which serve-site.cjs keeps from caching as immutable.
export const DEMOS_DIR = "Loom Demo Builds";
export const DEMOS_BASE = "engine-build/demos";
/** The folder beside the demos that holds the one player they all load. */
export const LOOM_ENGINE = "engine";

// DEV: stream a Loom build folder straight from disk. A version.json is
// answered for the build folder it is asked of.
function serveLoom(dirName: string, base: string): Plugin {
  return {
    name: `serve-loom-${base}`,
    configureServer(server) {
      server.middlewares.use(`/${base}`, (req, res, next) => {
        const dir = path.resolve(import.meta.dirname, dirName);
        try {
          let rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
          if (rel === "" || rel.endsWith("/")) rel += "index.html";

          const filePath = path.join(dir, rel);
          if (!filePath.startsWith(dir)) return next();

          if (path.basename(filePath) === "version.json") {
            const build = path.dirname(filePath);
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify(fs.existsSync(build) ? loomVersion(build) : { build: "missing" }),
            );
            return;
          }

          if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            return next();
          }

          const type = CONTENT_TYPE[path.extname(filePath)];
          if (type) res.setHeader("Content-Type", type);
          // As serve-site.cjs serves them, so the frame takes what the loading bar fetched.
          res.setHeader(
            "Cache-Control",
            filePath.endsWith(".html") ? "no-cache" : "public, max-age=300, must-revalidate",
          );

          fs.createReadStream(filePath).pipe(res);
        } catch {
          next();
        }
      });
    },
  };
}

// PRODUCTION: copy a Loom build folder into dist so it is served same-origin,
// with a version.json in each build inside it.
function bundleLoom(dirName: string, base: string): Plugin {
  return {
    name: `bundle-loom-${base}`,
    apply: "build",
    writeBundle(options) {
      const dir = path.resolve(import.meta.dirname, dirName);
      const outDir = options.dir ?? path.resolve(import.meta.dirname, "dist");
      const dest = path.join(outDir, base);

      if (!fs.existsSync(dir)) {
        this.warn(
          `Loom build "${dirName}" not found — skipping. ` +
            `Run ./build-loom.sh to produce it; the deployed /${base} ` +
            `will have nothing to load until then.`,
        );
        return;
      }

      deployLoom(dir, dest);
    },
  };
}

/**
 * What a Loom build's version.json says: its version, and the size of each
 * file at its top, which the page's loading bar counts against.
 */
export function loomVersion(dir: string) {
  const sizes: Record<string, number> = {};
  for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
    if (file.isFile()) sizes[file.name] = fs.statSync(path.join(dir, file.name)).size;
  }
  return { build: buildVersion(dir), sizes };
}

/** Copies the Loom builds in `dir` to `dest`, each with its version.json. */
export function deployLoom(dir: string, dest: string) {
  for (const build of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!build.isDirectory()) continue;
    fs.cpSync(path.join(dir, build.name), path.join(dest, build.name), { recursive: true });
    fs.writeFileSync(
      path.join(dest, build.name, "version.json"),
      JSON.stringify(loomVersion(path.join(dir, build.name))),
    );
  }
}

// --- In-place text editing --------------------------------------------------
//
// The host of the site can edit its text in the page; tools/edit-server.cjs
// decides who that is and stores what they write. serve-site.cjs mounts the
// same handler for the production build, so this is only about `npm run dev`
// being editable too. It is CommonJS, and shared rather than reimplemented
// precisely because a second copy of the "may this client edit" test is the
// last thing this should grow.
function serveEdits(): Plugin {
  const edit = createRequire(import.meta.url)("./tools/edit-server.cjs");
  return {
    name: "serve-content-edits",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!edit.handle(req, res)) next();
      });
    },
  };
}

// --- Cross-origin isolation -------------------------------------------------
//
// Loom's web build runs on pthreads, which need SharedArrayBuffer, which the
// browser only hands to a cross-origin isolated page. The engine is framed, and
// isolation only reaches a frame whose parent is isolated too, so every page
// gets the headers. netlify.toml and serve-site.cjs send the same pair.
export const ISOLATION_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

function isolate(): Plugin {
  const apply: Connect.NextHandleFunction = (_req, res, next) => {
    for (const [name, value] of Object.entries(ISOLATION_HEADERS))
      res.setHeader(name, value);
    next();
  };
  return {
    name: "cross-origin-isolation",
    configureServer(server) {
      server.middlewares.use(apply);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apply);
    },
  };
}

export default defineConfig({
  // Multi-page app: serve real HTML files (e.g. /gobspin/) instead of
  // falling every route back to the main index.html like an SPA would.
  appType: "mpa",
  plugins: [
    isolate(),
    tailwindcss(),
    ...GAMES.flatMap((game) => [serveGame(game), bundleGame(game)]),
    serveLoom(DEMOS_DIR, DEMOS_BASE),
    bundleLoom(DEMOS_DIR, DEMOS_BASE),
    serveEdits(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, "index.html"),
        // Only wrapper games have a Vite-processed loader page; direct games'
        // index.html is the Unity build, copied verbatim by bundleGame.
        ...Object.fromEntries(
          GAMES.filter((game) => game.wrapper).map((game) => [
            game.slug,
            path.resolve(import.meta.dirname, `${game.slug}/index.html`),
          ]),
        ),
      },
    },
  },
});
