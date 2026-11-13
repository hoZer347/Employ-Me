// The Loom demos rebuild only for a change to what they are built from, once,
// and a proven build replaces the demos the site serves whole.

import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { deployLoom, LOOM_ENGINE } from "../vite.config.ts";
import {
  isLoomInput,
  loadLoomDemos,
  loomRebuildDue,
  loomStamp,
  newestLoomInput,
  replaceLoomDemos,
} from "../tools/loom-demos.mjs";

const made = [];
const temp = (prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(dir);
  return dir;
};
after(() => made.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

const write = (root, rel, text = "x") => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
};

/** Sets every folder under `root` back to `at`, so only what a test touches is new. */
const age = (root, at) => {
  for (const entry of fs.readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (entry.isDirectory()) fs.utimesSync(path.join(entry.parentPath, entry.name), at, at);
  }
  fs.utimesSync(root, at, at);
};

const LOOM = "C:/Loom";
const NEWEST = 2000;

test("the demos are built from engine sources, the web player and Demo Sources, and nothing they build", () => {
  for (const file of [
    "Loom WASM/Shaders.cpp",
    "Loom ImGui/imgui.h",
    "Loom Web/Player.html",
    "Demo Sources/Physics/Scenes/Main.loomscene",
    "WebBuild.ps1",
    "play-web.ps1",
  ]) assert.ok(isLoomInput(file), file);

  for (const file of [
    "Loom WASM/x64/Release/Shaders.obj",
    "Loom WASM/x64/WebPlayer/Shaders.cpp",
    "Loom WASM/Shaders.vcxproj",
    "Demo Sources/Physics/Build/RTSScripts.dll",
    "Demo Sources/Physics/Intermediate/Main.cpp",
    "Demo SourcesX/Main.loomscene",
    "Loom Editor/Editor.cpp",
    "play-web.ps1.bak",
  ]) assert.ok(!isLoomInput(file), file);
});

test("the newest input ignores files outside the inputs and what the build writes", () => {
  const loom = temp("loom-inputs-");
  const touch = (rel, at) => fs.utimesSync(write(loom, rel), at, at);
  touch("Loom WASM/Shaders.cpp", 1000);
  touch("play-web.ps1", 2000);
  touch("Loom Editor/Editor.cpp", 9000);
  touch("Loom WASM/x64/WebPlayer/Shaders.tlog", 9000);
  touch("Demo Sources/Physics/Build/Scripts.dll", 9000);
  touch("Demo Sources/Physics/Scenes/Main.loomscene", 1500);
  age(loom, 1000);
  assert.equal(newestLoomInput(loom), 2000 * 1000);

  touch("Demo Sources/Physics/Scenes/Main.loomscene", 3000);
  assert.equal(newestLoomInput(loom), 3000 * 1000);
});

test("deleting an input makes the inputs newer", () => {
  const loom = temp("loom-inputs-");
  const removed = write(loom, "Demo Sources/Physics/Assets/Pulse.shader");
  const kept = write(loom, "Demo Sources/Physics/Assets/Lit.shader");
  fs.utimesSync(removed, 1000, 1000);
  fs.utimesSync(kept, 2000, 2000);
  age(loom, 1000);
  assert.equal(newestLoomInput(loom), 2000 * 1000);

  fs.rmSync(removed);
  assert.ok(newestLoomInput(loom) > 2000 * 1000);
});

test("a rebuild is due once the inputs settle at something the demos were not built from", () => {
  const stamp = loomStamp(LOOM, NEWEST);
  const due = (overrides) =>
    loomRebuildDue({ previous: NEWEST, newest: NEWEST, stamp: null, loom: LOOM, failed: null, ...overrides });

  assert.ok(due({}));
  assert.ok(!due({ previous: NEWEST - 1 }));
  assert.ok(!due({ stamp }));
  assert.ok(due({ stamp: loomStamp("C:/Loom 1", NEWEST) }));
  assert.ok(due({ stamp: loomStamp(LOOM, NEWEST - 1) }));
  assert.ok(!due({ failed: NEWEST }));
  assert.ok(due({ failed: NEWEST - 1 }));
  assert.ok(!due({ stamp: loomStamp("C:\\Loom", NEWEST) }));
});

test("a proven build replaces each demo whole and leaves the rest of the folder", () => {
  const from = temp("loom-proven-");
  const to = temp("loom-served-");
  write(from, "physics/index.html", "new");
  write(to, "physics/index.html", "old");
  write(to, "physics/stale.js");
  write(to, "raycasts/index.html", "kept");
  write(to, "source.json", "{}");

  replaceLoomDemos(from, to);
  assert.deepEqual(fs.readdirSync(path.join(to, "physics")), ["index.html"]);
  assert.equal(fs.readFileSync(path.join(to, "physics", "index.html"), "utf8"), "new");
  assert.equal(fs.readFileSync(path.join(to, "raycasts", "index.html"), "utf8"), "kept");
  assert.ok(fs.existsSync(path.join(to, "source.json")));
});

test("the Loom demos deploy with a version.json each, giving its version and file sizes, and nothing beside them", () => {
  const builds = temp("loom-demos-");
  write(builds, "physics/index.html", "page");
  write(builds, "source.json", "{}");
  const out = temp("loom-out-");
  deployLoom(builds, out);
  assert.deepEqual(fs.readdirSync(out), ["physics"]);
  assert.equal(fs.readFileSync(path.join(out, "physics", "index.html"), "utf8"), "page");
  const version = JSON.parse(fs.readFileSync(path.join(out, "physics", "version.json"), "utf8"));
  assert.ok(version.build);
  assert.deepEqual(version.sizes, { "index.html": "page".length });
});

const SHORT = { start: 2_000, run: 200, answer: 1_000 };

/** A folder of demo pages, each `slug` running `script`, as the load serves them. */
const pages = (scripts) => {
  const dir = temp("loom-pages-");
  for (const [slug, script] of Object.entries(scripts)) write(dir, `${slug}/index.html`, `<script>${script}</script>`);
  return dir;
};

test("a demo that starts and runs clean loads", async () => {
  await loadLoomDemos(pages({ clean: "window.Module = { initialized: true };" }), SHORT);
});

test("the shared player's folder is not loaded as a demo", async () => {
  const dir = pages({ clean: "window.Module = { initialized: true };" });
  write(dir, `${LOOM_ENGINE}/player.js`, "");
  await loadLoomDemos(dir, SHORT);
});

test("a demo fails on an error it logs, an exception, never starting, or hanging", async () => {
  const dir = pages({
    logged: "console.error('Shader compile error'); window.Module = { initialized: true };",
    thrown: "window.Module = { initialized: true }; setTimeout(() => { throw new Error('boom'); });",
    idle: "",
    hung: "window.Module = { initialized: true }; setTimeout(() => { for (;;); }, 50);",
  });
  await assert.rejects(loadLoomDemos(dir, SHORT), (err) => {
    assert.match(err.message, /logged: Shader compile error/);
    assert.match(err.message, /thrown: .*boom/);
    assert.match(err.message, /idle: it never set Module.initialized/);
    assert.match(err.message, /hung: it stopped answering/);
    return true;
  });
});
