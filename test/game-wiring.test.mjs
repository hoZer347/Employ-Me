// Every playable build is declared in four places that nothing checks against
// each other: the Game in src/games.ts, the build folder in vite.config.ts, the
// loader page at <slug>/index.html, and the entry module that page loads. A
// slug that agrees in three of them and not the fourth still compiles and still
// builds; it fails in the browser, on a blank page. So the agreement is pinned
// here instead.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

const viteConfig = read("vite.config.ts");
const gamesModule = read("src/games.ts");

// The GAMES list in vite.config.ts, which is the list of builds that are served
// in dev and copied into dist for prod. A live build has no page in the gallery.
const builds = [
  ...viteConfig
    .slice(viteConfig.indexOf("const GAMES: Game[] = ["))
    .split("];")[0]
    .matchAll(/\{([^}]*)\}/g),
]
  .map(([, entry]) => ({
    slug: entry.match(/slug:\s*"([^"]+)"/)[1],
    wrapper: /wrapper:\s*true/.test(entry),
    live: /live:\s*true/.test(entry),
  }))
  .filter((b) => !b.live);

const declaredSlugs = [...gamesModule.matchAll(/^\s+slug: "([^"]+)",$/gm)].map(
  ([, slug]) => slug,
);

test("vite.config.ts serves a build for every game, and no others", () => {
  assert.ok(builds.length > 0, "no GAMES parsed out of vite.config.ts");
  assert.deepEqual(
    builds.map((b) => b.slug).sort(),
    [...declaredSlugs].sort(),
  );
});

for (const { slug } of builds.filter((b) => b.wrapper)) {
  test(`${slug} has a loader page wired to its own entry module`, () => {
    const page = read(slug, "index.html");
    assert.ok(page.includes(`id="${slug}"`), "missing mount point");
    assert.ok(
      page.includes(`src="/src/${slug}-main.ts"`),
      "page does not load its entry module",
    );
    assert.ok(
      read("src", `${slug}-main.ts`).includes(`mountGamePage("${slug}")`),
      "entry module mounts a different slug",
    );
  });
}
