// loomhozer.ca#SHIFT and loomhozer.ca#trustnoone are pages only someone told
// about them can find. These pin that: the entry sends each hidden hash to its
// game and everything else to the site as before, nothing else on the site
// points at them, and search engines are told to leave them out.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

const HIDDEN = [
  { hash: "#SHIFT", module: "shift", build: "/shift/", slug: "shift" },
  { hash: "#trustnoone", module: "trustnoone", build: "/trustnoone/", slug: "trustnoone" },
];

const PAGE_FILES = new Set(["entry.ts", "hidden-page.ts", ...HIDDEN.map((page) => `${page.module}.ts`)]);

test("the site loads through the entry that picks the page", () => {
  assert.match(read("index.html"), /<script type="module" src="\/src\/entry\.ts"><\/script>/);
});

test("the entry sends each hidden hash to its game and every other hash to the site", () => {
  const entry = read("src", "entry.ts");
  for (const { hash, module } of HIDDEN) {
    assert.match(entry, new RegExp(String.raw`"${hash}": \(\) => import\("\./${module}"\)`), hash);
  }
  assert.match(entry, /page \? page\(\) : import\("\.\/main"\)/);
});

test("crossing into or out of a hidden page reloads", () => {
  assert.match(read("src", "entry.ts"), /hashchange[\s\S]*hiddenPage\(\) !== page[\s\S]*location\.reload\(\)/);
});

test("the shared page frames the build fullscreen and is marked noindex", () => {
  const page = read("src", "hidden-page.ts");
  assert.match(page, /robots\.content = "noindex, nofollow"/);
  assert.match(page, /frame\.src = buildUrl/);
  assert.match(page, /position: fixed; inset: 0; width: 100%; height: 100%/);
});

test("each hidden page frames its own build", () => {
  for (const { module, build } of HIDDEN) {
    assert.match(read("src", `${module}.ts`), new RegExp(String.raw`frameBuild\("${build}", "[^"]+"\)`), module);
  }
});

test("each hidden build is a live, unwrapped game served at its page's build URL", () => {
  const config = read("vite.config.ts");
  for (const { slug } of HIDDEN) {
    assert.match(config, new RegExp(String.raw`\{ slug: "${slug}", dir: "[^"]+", wrapper: false, live: true \}`), slug);
  }
});

test("Trust No One's hidden build is the game's own WebGL build folder", () => {
  assert.match(read("vite.config.ts"), /slug: "trustnoone", dir: "\.\.\/Brackeys GameJam\/Build\/WebGL"/);
});

test("nothing else on the site links to a hidden page or its build", () => {
  const sources = fs
    .readdirSync(path.join(ROOT, "src"))
    .filter((name) => !PAGE_FILES.has(name))
    .map((name) => [`src/${name}`, read("src", name)]);
  const pub = fs
    .readdirSync(path.join(ROOT, "public"), { recursive: true })
    .filter((name) => /\.(html|json|txt|xml)$/.test(name))
    .map((name) => [`public/${name}`, read("public", name)]);
  for (const [name, text] of [...sources, ...pub, ["index.html", read("index.html")]]) {
    for (const { hash, build } of HIDDEN) {
      assert.doesNotMatch(text, new RegExp(String.raw`${hash}\b|${build}`, "i"), `${name} points at ${hash}`);
    }
  }
});
