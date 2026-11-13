// The live builds in vite.config.ts are served straight out of their game's own
// build folder, so a new build should reach the site without anyone running
// `npm run build`. serve-site.cjs starts the watch; this republishes a live
// build into dist/ once its folder has changed and then stopped changing.
//
// The Loom demos are live the same way, from what they are built from: once
// Loom's inputs change and settle, tools/loom-demos.mjs rebuilds and proves
// them, and only a proven build is republished. One that fails is not retried
// until the inputs change again.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEMOS_BASE,
  DEMOS_DIR,
  GAMES,
  buildVersion,
  deployGame,
  deployLoom,
  gameBase,
  gameDir,
  newestMtime,
} from "../vite.config.ts";
import { loomRebuildDue, loomStamp, newestLoomInput, provenLoomDemos, replaceLoomDemos } from "./loom-demos.mjs";

// Also how long a build folder must sit unchanged before it is taken as finished.
const POLL_MS = 30_000;

const HERE = path.join(import.meta.dirname, "..");

/** The engine the demos are built from, as build-loom.sh defaults it. */
const LOOM = process.env.LOOM ?? path.join(HERE, "..", "Loom");

/** Inside the demos' folder: what they were last built from. */
const LOOM_STAMP = "source.json";

const readOr = (file, fallback) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : fallback);

/**
 * Deploys `game` to a scratch folder and moves it over its folder in `root`:
 * the content-hashed assets first, then the page that names them, then the
 * assets neither it nor the page before it names, then version.json, so a
 * failed publish is retried. False if the build folder is missing.
 */
export async function publish(game, root) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), `${game.slug}-`));
  try {
    if (!(await deployGame(game, scratch))) return false;
    const from = path.join(scratch, gameBase(game));
    const to = path.join(root, gameBase(game));
    const fromPage = path.join(from, "index.html");
    const fromVersion = path.join(from, "version.json");
    fs.cpSync(from, to, {
      recursive: true,
      filter: (src) => src !== fromPage && src !== fromVersion,
    });

    // A visitor still loading the previous page needs its assets until they finish.
    const page = path.join(to, "index.html");
    const previous = readOr(page, "");
    fs.copyFileSync(fromPage, `${page}.new`);
    fs.renameSync(`${page}.new`, page);

    const html = fs.readFileSync(page, "utf8");
    const assets = path.join(to, "Build");
    for (const name of fs.readdirSync(assets)) {
      if (!html.includes(name) && !previous.includes(name)) fs.rmSync(path.join(assets, name));
    }
    fs.copyFileSync(fromVersion, path.join(to, "version.json"));
    return true;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

/** The version.json `root` holds for `game`, or null if it holds none. */
function publishedVersion(game, root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, gameBase(game), "version.json"), "utf8")).build;
  } catch {
    return null;
  }
}

/**
 * Whether a build folder is ready to publish: unchanged since the last poll,
 * and a different version from the one already published.
 */
export function due(previousMtime, newestMtime, sourceVersion, publishedVersion) {
  return previousMtime === newestMtime && sourceVersion !== publishedVersion;
}

/**
 * Polls every live build and republishes the ones that differ from what `root`
 * holds, and rebuilds the Loom demos in `demos` from `loom` as it changes.
 */
export function watch(root, demos = path.join(HERE, DEMOS_DIR), loom = LOOM) {
  const lastSeen = new Map();
  const stampFile = path.join(demos, LOOM_STAMP);
  let loomSeen = null;
  let loomFailed = null;
  let busy = false;
  const tickLoom = async () => {
    if (!fs.existsSync(loom)) return;
    let newest = null;
    try {
      newest = newestLoomInput(loom);
      const previous = loomSeen;
      loomSeen = newest;

      const stamp = JSON.parse(readOr(stampFile, "null"));
      if (!loomRebuildDue({ previous, newest, stamp, loom, failed: loomFailed })) return;
      await provenLoomDemos(loom, (out) => replaceLoomDemos(out, demos));
      fs.writeFileSync(stampFile, JSON.stringify(loomStamp(loom, newest)));
      deployLoom(demos, path.join(root, DEMOS_BASE));
    } catch (err) {
      loomFailed = newest;
      console.error(`Loom demos were not republished: ${err.message}`);
    }
  };

  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      for (const game of GAMES.filter((g) => g.live)) {
        if (!fs.existsSync(gameDir(game))) continue;
        const newest = newestMtime(gameDir(game));
        const previous = lastSeen.get(game.slug);
        lastSeen.set(game.slug, newest);

        const version = buildVersion(gameDir(game));
        if (due(previous, newest, version, publishedVersion(game, root))) await publish(game, root);
      }
    } catch (err) {
      // A failed publish leaves the old version.json, so the next poll retries it.
      console.error(`live build publish failed: ${err.message}`);
    }
    try {
      await tickLoom();
    } finally {
      busy = false;
    }
  };
  tick();
  return setInterval(tick, POLL_MS);
}
