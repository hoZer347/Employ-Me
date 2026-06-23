import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";

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
  dir: string; // build folder name in the repo root
  wrapper: boolean;
}
const GAMES: Game[] = [
  { slug: "vanguards", dir: "Vanguards Build", wrapper: true },
  { slug: "gobspin", dir: "Gobspin Build", wrapper: true },
];
const gameDir = (game: Game) => path.resolve(import.meta.dirname, game.dir);
// Where the build is served/emitted: a sibling /<slug>-build for wrapper games
// (so /<slug>/ is free for the loader page), or /<slug> itself for direct ones.
const gameBase = (game: Game) =>
  game.wrapper ? `${game.slug}-build` : game.slug;

// Precompressed Unity assets → the encoding the browser should decompress.
const ENCODING: Record<string, string> = { ".br": "br", ".gz": "gzip" };

// Content types for the underlying file once the encoding is stripped.
const CONTENT_TYPE: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".data": "application/octet-stream",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

// version.json drives the loader's cache-busting ?v=; derive it from the newest
// file in the build so it tracks the actual game assets. (Keying off index.html
// is unreliable — Unity often doesn't rewrite it on a rebuild, so the version
// would read stale even though Build/*.br changed.)
function buildVersion(dir: string): string {
  let newest = 0;
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else newest = Math.max(newest, fs.statSync(p).mtimeMs);
    }
  };
  walk(dir);
  const d = new Date(newest);
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
//
// Either way the Unity product-name prefix (e.g. "Vanguards Build", "Gobspin
// Build") is normalized to the slug so deployed URLs (and the netlify.toml
// header globs) stay simple, lowercase, and space-free.
function deployName(
  file: string,
  prefix: string,
  slug: string,
): { deployed: string; decode: (() => zlib.Gunzip) | null } {
  const ext = path.extname(file);
  // Only .gz is decoded (extension dropped); .br and everything else ship as-is.
  const decode = ext === ".gz" ? () => zlib.createGunzip() : null;
  const base = decode ? file.slice(0, -ext.length) : file;
  return { deployed: base.split(prefix).join(slug), decode };
}

// PRODUCTION: copy a game's build into dist so the site serves it same-origin
// (no CORS). The dev middleware handles the same path during `vite dev`; this
// handles `vite build`.
function bundleGame(game: Game): Plugin {
  const dir = gameDir(game);
  return {
    name: `bundle-${game.slug}-webgl`,
    apply: "build",
    async writeBundle(options) {
      const outDir = options.dir ?? path.resolve(import.meta.dirname, "dist");
      const dest = path.join(outDir, gameBase(game));

      if (!fs.existsSync(dir)) {
        this.warn(
          `Build "${game.dir}" not found — skipping. ` +
            `The deployed /${game.slug} page will have nothing to load.`,
        );
        return;
      }

      // The asset filenames are prefixed with the Unity product name; derive it
      // from the one *.loader.js so renames work for any game.
      const loader = fs
        .readdirSync(path.join(dir, "Build"))
        .find((f) => f.endsWith(".loader.js"));
      const prefix = loader ? loader.slice(0, -".loader.js".length) : game.dir;

      // Recursively copy, decoding .gz assets and normalizing names. Collect the
      // source→deployed renames to patch the references in index.html.
      const renames: Record<string, string> = {};
      const copyDir = async (from: string, to: string) => {
        fs.mkdirSync(to, { recursive: true });
        for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
          const src = path.join(from, entry.name);
          if (entry.isDirectory()) {
            await copyDir(src, path.join(to, entry.name));
            continue;
          }
          const { deployed, decode } = deployName(entry.name, prefix, game.slug);
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
    },
  };
}

export default defineConfig({
  // Multi-page app: serve real HTML files (e.g. /vanguards/) instead of
  // falling every route back to the main index.html like an SPA would.
  appType: "mpa",
  plugins: [
    tailwindcss(),
    ...GAMES.flatMap((game) => [serveGame(game), bundleGame(game)]),
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
