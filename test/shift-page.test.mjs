// loomhozer.ca#SHIFT is a page only someone told about it can find. These pin
// that: the entry sends that one hash to the game and everything else to the
// site as before, nothing else on the site points at it, and search engines
// are told to leave it out.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

const PAGE_FILES = new Set(["entry.ts", "shift.ts"]);

test("the site loads through the entry that picks the page", () => {
  assert.match(read("index.html"), /<script type="module" src="\/src\/entry\.ts"><\/script>/);
});

test("the entry sends #SHIFT to the game and every other hash to the site", () => {
  const entry = read("src", "entry.ts");
  assert.match(entry, /SECRET_HASH = "#SHIFT"/);
  assert.match(entry, /secret \? import\("\.\/shift"\) : import\("\.\/main"\)/);
});

test("crossing into or out of #SHIFT reloads the page", () => {
  assert.match(read("src", "entry.ts"), /hashchange[\s\S]*location\.reload\(\)/);
});

test("the SHIFT page frames the build and is marked noindex", () => {
  const page = read("src", "shift.ts");
  assert.match(page, /BUILD_URL = "\/shift\/"/);
  assert.match(page, /robots\.content = "noindex, nofollow"/);
});

test("nothing else on the site links to the SHIFT page or its build", () => {
  const sources = fs
    .readdirSync(path.join(ROOT, "src"))
    .filter((name) => !PAGE_FILES.has(name))
    .map((name) => [`src/${name}`, read("src", name)]);
  const pub = fs
    .readdirSync(path.join(ROOT, "public"), { recursive: true })
    .filter((name) => /\.(html|json|txt|xml)$/.test(name))
    .map((name) => [`public/${name}`, read("public", name)]);
  for (const [name, text] of [...sources, ...pub, ["index.html", read("index.html")]]) {
    assert.doesNotMatch(text, /#SHIFT|\/shift\//i, `${name} points at the SHIFT page`);
  }
});
