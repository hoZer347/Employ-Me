// The Engine tab's Loom demos, built and proven before they go anywhere.
//
// A build lands in a scratch folder first. It passes once the engine tests
// here pass on it and every demo loads in a tab of the shared Chrome: its
// player sets Module.initialized, runs a while, and logs no error or warning,
// which is where a shader that fails to compile shows. Only then is it moved
// over the demos the site serves. tools/live-builds.mjs does this whenever
// Loom changes, and tools/check-loom.mjs before a Loom branch lands.

import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { CONTENT_TYPE, ISOLATION_HEADERS, LOOM_ENGINE } from "../vite.config.ts";

const HERE = path.join(import.meta.dirname, "..");
const run = promisify(execFile);

// --- Inputs ------------------------------------------------------------------

const SOURCE = /\.(cpp|h|hpp)$/;

/** What the demos are built from, inside Loom, and which of its files count. */
export const LOOM_INPUTS = [
  { at: "Loom WASM", files: SOURCE },
  { at: "Loom ImGui", files: SOURCE },
  { at: "Loom Web" },
  { at: "Demo Sources" },
  { at: "WebBuild.ps1" },
  { at: "play-web.ps1" },
];

/** Folders that builds write, inside any input. */
const BUILD_OUTPUT = new Set(["x64", "Build", "Intermediate"]);

/** Whether `file`, relative to Loom with forward slashes, is one the demos are built from. */
export function isLoomInput(file) {
  const parts = file.split("/");
  if (parts.slice(0, -1).some((part) => BUILD_OUTPUT.has(part))) return false;
  return LOOM_INPUTS.some(({ at, files }) =>
    (file === at || file.startsWith(`${at}/`)) && (!files || files.test(file)));
}

/**
 * The newest modification time among the inputs in `loom`, and the folders
 * holding them, which change when a file is added, removed or renamed.
 */
export function newestLoomInput(loom) {
  let newest = 0;
  const walk = (rel) => {
    const full = path.join(loom, rel);
    if (!fs.existsSync(full)) return;
    if (fs.statSync(full).isDirectory()) {
      if (BUILD_OUTPUT.has(path.basename(rel))) return;
      newest = Math.max(newest, fs.statSync(full).mtimeMs);
      for (const name of fs.readdirSync(full)) walk(`${rel}/${name}`);
    } else if (isLoomInput(rel)) {
      newest = Math.max(newest, fs.statSync(full).mtimeMs);
    }
  };
  for (const { at } of LOOM_INPUTS) walk(at);
  return newest;
}

// --- Building and proving ----------------------------------------------------

/** Git's own bash, which build-loom.sh needs for cygpath. */
const BASH = "C:/Program Files/Git/bin/bash.exe";

const ENGINE_TESTS = ["test/engine-wiring.test.mjs", "test/glsl.test.mjs"];

/**
 * How long a demo may take to start, how long it then has to run clean, and
 * how long Chrome may take to answer once it has.
 */
export const TIMING = { start: 60_000, run: 3_000, answer: 10_000 };
const POLL_MS = 250;

const CHROME = "http://127.0.0.1:9333";
const CHROME_SCRIPT = path.join(HERE, "tools", "chrome-desktop.ps1");

const slash = (p) => p.replaceAll("\\", "/");

/** Builds every demo from `loom` into `out` with build-loom.sh. */
export async function buildLoomDemos(loom, out) {
  const env = { ...process.env, LOOM: slash(loom), OUT: slash(out) };
  await run(BASH, [path.join(HERE, "build-loom.sh")], { env, maxBuffer: Infinity });
}

/** Runs the engine tests on `loom` and the demos built from it in `out`. */
export async function testLoomDemos(loom, out) {
  await run(process.execPath, ["--test", ...ENGINE_TESTS], {
    cwd: HERE,
    env: { ...process.env, LOOM: loom, LOOM_DEMOS: out },
    maxBuffer: Infinity,
  });
}

/** Serves `dir` on a free local port, isolated as the site serves it. */
function serve(dir) {
  const server = http.createServer((req, res) => {
    const file = path.join(dir, decodeURIComponent(req.url.split("?")[0]));
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      ...ISOLATION_HEADERS,
      "Content-Type": CONTENT_TYPE[path.extname(file)] ?? "application/octet-stream",
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function chromeUp() {
  try {
    await fetch(`${CHROME}/json/version`, { signal: AbortSignal.timeout(TIMING.answer) });
  } catch {
    await run("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", CHROME_SCRIPT]);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Opens `url` in a new tab of the shared Chrome; resolves to what went wrong, or null. */
async function loadInTab(url, timing) {
  const chrome = (route, method = "GET") =>
    fetch(`${CHROME}${route}`, { method, signal: AbortSignal.timeout(timing.answer) });
  const tab = await (await chrome("/json/new?about:blank", "PUT")).json();
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  const problems = [];
  let nextId = 1;
  const pending = new Map();
  const call = (method, params = {}) => new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) pending.get(message.id)?.(message.result);
    else if (message.method === "Runtime.consoleAPICalled" && ["error", "warning", "assert"].includes(message.params.type))
      problems.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
    else if (message.method === "Runtime.exceptionThrown")
      problems.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  });

  // A page whose main thread never yields never answers, so every wait races the deadline.
  let deadline = Date.now() + timing.start;
  const inTime = (promise) => {
    let timer;
    const late = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("it stopped answering")),
        Math.max(0, deadline - Date.now()) + timing.answer);
    });
    return Promise.race([promise, late]).finally(() => clearTimeout(timer));
  };
  const report = () => [...new Set(problems)].join("\n");
  const evaluate = async (expression) =>
    (await inTime(call("Runtime.evaluate", { expression, returnByValue: true })))?.result?.value;

  try {
    await inTime(new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve);
      socket.addEventListener("error", reject);
    }));
    await inTime(call("Runtime.enable"));
    await inTime(call("Page.navigate", { url }));

    while (!(await evaluate("Boolean(window.Module && Module.initialized)"))) {
      if (problems.length) return report();
      if (Date.now() > deadline) return "it never set Module.initialized";
      await sleep(POLL_MS);
    }
    await sleep(timing.run);
    deadline = Date.now();
    await evaluate("true");
    return problems.length ? report() : null;
  } catch (err) {
    return problems.length ? report() : err.message;
  } finally {
    socket.close();
    await chrome(`/json/close/${tab.id}`).catch((err) => console.error(`tab ${tab.id} did not close: ${err.message}`));
  }
}

/** Loads every demo in `out` in the shared Chrome, throwing what failed. */
export async function loadLoomDemos(out, timing = TIMING) {
  await chromeUp();
  const server = await serve(path.resolve(out));
  try {
    const failed = [];
    for (const slug of fs.readdirSync(out).filter((name) => name !== LOOM_ENGINE)) {
      const problem = await loadInTab(`http://127.0.0.1:${server.address().port}/${slug}/index.html`, timing);
      if (problem) failed.push(`${slug}: ${problem}`);
    }
    if (failed.length) throw new Error(failed.join("\n"));
  } finally {
    server.close();
    server.closeAllConnections();
  }
}

/** Builds the demos from `loom` into a scratch folder and proves them, then hands it to `use`. */
export async function provenLoomDemos(loom, use) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "loom-demos-"));
  try {
    await buildLoomDemos(loom, out);
    await testLoomDemos(loom, out);
    await loadLoomDemos(out);
    await use(out);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
}

/** Puts each demo in `from` in place of the one in `to`. */
export function replaceLoomDemos(from, to) {
  for (const slug of fs.readdirSync(from)) {
    fs.rmSync(path.join(to, slug), { recursive: true, force: true });
    fs.cpSync(path.join(from, slug), path.join(to, slug), { recursive: true });
  }
}

// --- Rebuild schedule --------------------------------------------------------

/**
 * Whether the demos should be rebuilt from `loom`: its inputs have settled at
 * `newest` since the last poll, the demos were last built from something else,
 * and that is not what last failed.
 */
export function loomRebuildDue({ previous, newest, stamp, loom, failed }) {
  if (previous !== newest || newest === failed) return false;
  return stamp?.loom !== slash(loom) || stamp?.newest !== newest;
}

/** The stamp that marks demos as built from `loom` at `newest`. */
export const loomStamp = (loom, newest) => ({ loom: slash(loom), newest });
