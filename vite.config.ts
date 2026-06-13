import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";

// TEMPORARY: the Vanguards Unity WebGL build lives in the repo folder but is
// git-ignored (~100 MB) and served by this dev middleware under
// /vanguards-build (the themed /vanguards loader page frames it). Later it
// moves to a real host (Netlify game site / GitHub Pages) and this can go.
const VANGUARDS_DIR = path.resolve(import.meta.dirname, "Vanguards Build");

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

function serveVanguards(): Plugin {
  return {
    name: "serve-vanguards-webgl",
    configureServer(server) {
      // connect strips the "/vanguards-build" mount prefix from req.url here.
      server.middlewares.use("/vanguards-build", (req, res, next) => {
        try {
          let rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
          if (rel === "/" || rel === "") rel = "/index.html";

          // Synthesize version.json from the build's own timestamp so the
          // loader's version check works locally (date = build date).
          if (rel === "/version.json") {
            const d = fs.statSync(path.join(VANGUARDS_DIR, "index.html")).mtime;
            const pad = (n: number) => String(n).padStart(2, "0");
            const build =
              `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
              `${pad(d.getHours())}:${pad(d.getMinutes())}`;
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end(JSON.stringify({ build }));
            return;
          }

          const filePath = path.join(VANGUARDS_DIR, rel);
          // Guard against path traversal outside the build folder.
          if (!filePath.startsWith(VANGUARDS_DIR)) return next();
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
//         browser decompresses it. (See the [[headers]] block in netlify.toml.)
//   .gz → DECODE at build to plain bytes. Netlify auto-decompresses .gz at its
//         edge and ignores a manual Content-Encoding header, so a .gz can't be
//         served intact; we gunzip it and ship the uncompressed file.
//
// Either way the spaced product name "Vanguards Build" is normalized to
// "vanguards" so deployed URLs (and the netlify.toml header globs) stay simple.
function vanguardsDeploy(name: string): {
  deployed: string;
  decode: (() => zlib.Gunzip) | null;
} {
  const ext = path.extname(name);
  // Only .gz is decoded (extension dropped); .br and everything else ship as-is.
  const decode = ext === ".gz" ? () => zlib.createGunzip() : null;
  const base = decode ? name.slice(0, -ext.length) : name;
  return { deployed: base.replace("Vanguards Build", "vanguards"), decode };
}

// PRODUCTION: copy the Unity WebGL build into dist/vanguards-build so the site
// serves it same-origin (no CORS). The dev middleware above handles the same
// path during `vite dev`; this handles `vite build`.
function bundleVanguardsBuild(): Plugin {
  return {
    name: "bundle-vanguards-webgl",
    apply: "build",
    async writeBundle(options) {
      const outDir = options.dir ?? path.resolve(import.meta.dirname, "dist");
      const dest = path.join(outDir, "vanguards-build");

      if (!fs.existsSync(VANGUARDS_DIR)) {
        this.warn(
          `Vanguards build not found at "${VANGUARDS_DIR}" — skipping copy. ` +
            "The deployed /vanguards page will have nothing to load.",
        );
        return;
      }

      // Recursively copy, decoding the compressed Unity assets and normalizing
      // their names. Collect the source→deployed renames to patch index.html.
      const renames: Record<string, string> = {};
      const copyDir = async (from: string, to: string) => {
        fs.mkdirSync(to, { recursive: true });
        for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
          const src = path.join(from, entry.name);
          if (entry.isDirectory()) {
            await copyDir(src, path.join(to, entry.name));
            continue;
          }
          const { deployed, decode } = vanguardsDeploy(entry.name);
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
      await copyDir(VANGUARDS_DIR, dest);

      // Rewrite the Unity template's asset references to the deployed names.
      const indexPath = path.join(dest, "index.html");
      let html = fs.readFileSync(indexPath, "utf8");
      for (const [from, to] of Object.entries(renames)) {
        html = html.split(from).join(to);
      }
      fs.writeFileSync(indexPath, html);

      // version.json drives the loader's cache-busting ?v=; derive it from the
      // build's timestamp, matching the dev middleware's synthesized value.
      const d = fs.statSync(path.join(VANGUARDS_DIR, "index.html")).mtime;
      const pad = (n: number) => String(n).padStart(2, "0");
      const build =
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      fs.writeFileSync(path.join(dest, "version.json"), JSON.stringify({ build }));
    },
  };
}

export default defineConfig({
  // Multi-page app: serve real HTML files (e.g. /vanguards/) instead of
  // falling every route back to the main index.html like an SPA would.
  appType: "mpa",
  plugins: [tailwindcss(), serveVanguards(), bundleVanguardsBuild()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, "index.html"),
        vanguards: path.resolve(import.meta.dirname, "vanguards/index.html"),
      },
    },
  },
});
