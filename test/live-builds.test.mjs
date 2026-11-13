// A live build is republished over itself while people may be loading it, so
// what matters is that its asset names change with its content, that the page
// always names assets that exist, and that the old assets go once nobody can still be loading them.

import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { deployGame } from "../vite.config.ts";
import { due, publish } from "../tools/live-builds.mjs";

const PAGE = `<script src="Build/Fixture.loader.js"></script>
<script>dataUrl: "Build/Fixture.wasm.unityweb"</script>`;

const made = [];
const temp = (prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(dir);
  return dir;
};
after(() => made.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

function fixture(wasm) {
  const dir = temp("live-fixture-");
  fs.mkdirSync(path.join(dir, "Build"));
  fs.writeFileSync(path.join(dir, "index.html"), PAGE);
  fs.writeFileSync(path.join(dir, "Build", "Fixture.loader.js"), "loader");
  fs.writeFileSync(path.join(dir, "Build", "Fixture.wasm.unityweb"), zlib.gzipSync(wasm));
  return { slug: "fx", dir, wrapper: false, live: true };
}

const scratch = () => temp("live-out-");
const assets = (root) => fs.readdirSync(path.join(root, "fx", "Build")).sort();

test("a live build ships its gzip intact under content-hashed names the page names", async () => {
  const out = scratch();
  assert.ok(await deployGame(fixture("one"), out));
  const names = assets(out);
  assert.equal(names.length, 2);
  const wasm = names.find((n) => n.endsWith(".wasm.gz"));
  assert.match(wasm, /^fx\.[0-9a-f]{10}\.wasm\.gz$/);
  assert.equal(zlib.gunzipSync(fs.readFileSync(path.join(out, "fx", "Build", wasm))).toString(), "one");
  const page = fs.readFileSync(path.join(out, "fx", "index.html"), "utf8");
  for (const name of names) assert.ok(page.includes(`Build/${name}`), `page does not name ${name}`);
  assert.ok(!page.includes("Fixture"));
});

test("a rebuilt live build gets new names for what changed and keeps the rest", async () => {
  const [a, b] = [scratch(), scratch()];
  await deployGame(fixture("one"), a);
  await deployGame(fixture("two"), b);
  const wasm = (root) => assets(root).find((n) => n.endsWith(".wasm.gz"));
  const loader = (root) => assets(root).find((n) => n.endsWith(".loader.js"));
  assert.notEqual(wasm(a), wasm(b));
  assert.equal(loader(a), loader(b));
});

test("publishing keeps the assets of the last two pages and no older ones", async () => {
  const root = scratch();
  const pages = [];
  for (const wasm of ["one", "two", "three"]) {
    await publish(fixture(wasm), root);
    pages.push(fs.readFileSync(path.join(root, "fx", "index.html"), "utf8"));
  }
  const [first, second, third] = pages;
  const names = assets(root);
  for (const name of names) {
    assert.ok(second.includes(`Build/${name}`) || third.includes(`Build/${name}`), `${name} is stale`);
  }
  const named = (page) => [...page.matchAll(/Build\/([^"]+)/g)].map(([, name]) => name);
  for (const name of [...named(second), ...named(third)]) assert.ok(names.includes(name), `${name} is gone`);
  assert.ok(named(first).some((name) => !names.includes(name)), "nothing from the first build went");
  assert.ok(!fs.existsSync(path.join(root, "fx", "index.html.new")));
});

test("a build folder is published once it has sat still and differs from what is published", () => {
  assert.equal(due(undefined, 5, "b", "a"), false, "seen for the first time");
  assert.equal(due(5, 5, "b", "a"), true, "unchanged since the last poll");
  assert.equal(due(5, 5, "b", "b"), false, "already published");
  assert.equal(due(4, 5, "b", "a"), false, "still being written");
});

test("a live build whose folder is missing publishes nothing", async () => {
  const root = scratch();
  const game = { slug: "fx", dir: path.join(root, "absent"), wrapper: false, live: true };
  assert.equal(await publish(game, root), false);
  assert.ok(!fs.existsSync(path.join(root, "fx")));
});
