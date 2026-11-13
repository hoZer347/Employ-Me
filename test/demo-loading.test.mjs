// The bar over a Loom demo follows the bytes of its build's files as they come
// in, and reaches the end even when a file cannot be fetched.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { prefetch, shared } from "../src/demo-loading.ts";

const realFetch = globalThis.fetch;
afterEach(() => (globalThis.fetch = realFetch));

const CHUNKS = 4;

/**
 * A fetch that answers each URL in `files` with that many bytes, in pieces,
 * saying how long it is only when `withLength` is set.
 */
const serve = (files, withLength = true) => {
  globalThis.fetch = async (url) => {
    if (!(url in files)) return new Response(null, { status: 404 });
    const size = files[url];
    const body = new ReadableStream({
      start(controller) {
        for (let i = 0; i < CHUNKS; i++) controller.enqueue(new Uint8Array(size / CHUNKS));
        controller.close();
      },
    });
    return new Response(body, { headers: withLength ? { "Content-Length": String(size) } : {} });
  };
};

test("the bar climbs with the bytes of every file and ends full", async () => {
  serve({ "a/player.wasm": 3000, "a/player.js": 1000 });
  const seen = [];
  await prefetch([{ url: "a/player.wasm" }, { url: "a/player.js" }], (fraction) => seen.push(fraction));
  assert.ok(seen.length > 2);
  assert.deepEqual([...seen].sort((x, y) => x - y), seen);
  assert.equal(seen.at(-1), 1);
  assert.ok(seen[0] < 1);
});

test("sizes from version.json drive the bar when the response does not say its length", async () => {
  serve({ "a/player.wasm": 3000, "a/player.js": 1000 }, false);
  const seen = [];
  await prefetch(
    [{ url: "a/player.wasm", size: 3000 }, { url: "a/player.js", size: 1000 }],
    (fraction) => seen.push(fraction),
  );
  assert.ok(seen.filter((fraction) => fraction < 1).length >= 2 * CHUNKS - 1);
  assert.equal(seen.at(-1), 1);
});

test("a file that fails leaves the bar to the rest and still ends full", async () => {
  serve({ "a/player.js": 1000 });
  const seen = [];
  await prefetch([{ url: "a/player.wasm" }, { url: "a/player.js" }], (fraction) => seen.push(fraction));
  assert.equal(seen.at(-1), 1);
  assert.ok(seen.some((fraction) => fraction > 0 && fraction < 1));
});

test("an unreachable host still ends the bar full", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("offline");
  };
  const seen = [];
  await prefetch([{ url: "a/player.wasm" }], (fraction) => seen.push(fraction));
  assert.deepEqual(seen, [1]);
});

test("a shared load runs once, and each caller hears its progress from when it asked", async () => {
  let runs = 0;
  let step;
  let finish;
  const load = shared(async (progress) => {
    runs++;
    step = progress;
    await new Promise((resolve) => (finish = resolve));
  });
  const first = [];
  const second = [];
  const firstDone = load((fraction) => first.push(fraction));
  step(0.5);
  const secondDone = load((fraction) => second.push(fraction));
  step(1);
  finish();
  await Promise.all([firstDone, secondDone]);
  assert.equal(runs, 1);
  assert.deepEqual(first, [0, 0.5, 1]);
  assert.deepEqual(second, [0.5, 1]);
});
