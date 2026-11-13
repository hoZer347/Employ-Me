// The Engine tab's demos are named in four places: the folders build-loom.sh
// writes, the folder vite.config.ts serves, and the path the page and
// serve-site.cjs address them at. The page Loom writes must load from wherever
// it is put, so every URL in it has to stay relative. And the demos take no
// input: their frames are inert and their scripts never read Loom's Input.
// The one input is a shader demo's code box, which edits its shader through
// the player's loom_edit_shader.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

const viteConfig = read("vite.config.ts");
const demosDir = viteConfig.match(/const DEMOS_DIR = "([^"]+)"/)[1];
const demosBase = viteConfig.match(/const DEMOS_BASE = "([^"]+)"/)[1];
const engineTs = read("src/engine.ts");
const listed = (name) => engineTs.match(new RegExp(String.raw`export const ${name} = \[([\s\S]*?)\] as const`))[1];
const shaderDemos = [...listed("SHADER_DEMOS").matchAll(/slug: "([^"]+)",[\s\S]*?file: "([^"]+)"/g)]
  .map((match) => ({ slug: match[1], file: match[2] }));
const demoSlugs = [...listed("DEMOS").matchAll(/slug: "([^"]+)"/g)].map((match) => match[1])
  .concat(shaderDemos.map((demo) => demo.slug));
const buildScript = read("build-loom.sh");
const builtFrom = Object.fromEntries([...buildScript.match(/^DEMOS=\(([^)]*)\)$/m)[1].matchAll(/^\s*(\S+):(\S+)$/gm)]
  .map((match) => [match[2], match[1]]));
const demoSources = Object.values(builtFrom);
const engineFolder = viteConfig.match(/const LOOM_ENGINE = "([^"]+)"/)[1];
const loom = buildScript.match(/^LOOM="\$\{LOOM:-\/c\/([^}]+)\}"$/m)[1];
const loomDir = process.env.LOOM ?? `C:/${loom}`;
const builtDir = process.env.LOOM_DEMOS ?? path.join(ROOT, demosDir);

test("the page and serve-site.cjs address the demos where Vite serves them", () => {
  assert.equal(engineTs.match(/export const DEMOS_BASE = "([^"]+)"/)[1], `/${demosBase}`);
  const servedUncached = read("serve-site.cjs").match(/const ENGINE_DIR = path\.join\(ROOT, '([^']+)'\)/)[1];
  assert.ok(demosBase.startsWith(`${servedUncached}/`), "serve-site.cjs would cache the demos as immutable");
});

test("build-loom.sh builds every demo into its slug's folder", () => {
  assert.ok(buildScript.includes(`OUT="\${OUT:-$HERE/${demosDir}}"`), "build-loom.sh builds outside the demos' folder");
  assert.ok(buildScript.includes('mv "$copy/web" "$OUT/$2"'), "build_demo writes outside OUT");
  assert.ok(demoSlugs.length > 0, "src/engine.ts lists no demos");
  assert.deepEqual(Object.keys(builtFrom).sort(), [...demoSlugs].sort());
});

test("the demos' pages, the page and the deploy agree where the shared player is", () => {
  assert.equal(buildScript.match(/^ENGINE=(\S+)$/m)[1], engineFolder);
  assert.equal(engineTs.match(/export const ENGINE_BASE = `\$\{DEMOS_BASE\}\/([^`]+)`;/)[1], engineFolder);
});

test("the Engine tab mounts every demo at once, inert so it takes no input", () => {
  const main = read("src", "main.ts");
  assert.ok(main.includes('id="demo-stage-${demo.slug}"'), "a demo has no stage on the Engine tab");
  assert.ok(main.includes("DEMO_FRAMES.forEach((frame) => frame(shown))"), "the demos do not start with the Engine tab");
  assert.match(read("src", "engine-frame.ts"), /iframe\.inert = true;/, "a demo's frame takes input");
});

for (const name of demoSources) {
  const project = path.join(loomDir, "Demo Sources", name);
  const scripts = path.join(project, "Scripts");
  test(`the ${name} demo's scripts read no input`, { skip: !fs.existsSync(project) && "engine not found" }, () => {
    const files = fs.existsSync(scripts) ? fs.readdirSync(scripts, { recursive: true }) : [];
    for (const file of files.filter((file) => /\.(h|hpp|cpp)$/.test(file)))
      assert.doesNotMatch(fs.readFileSync(path.join(scripts, file), "utf8"), /\bInput(Actions)?\b/, `${name}/Scripts/${file} reads input`);
  });
}

test("each shader demo's code box edits its shader through the player", () => {
  assert.ok(shaderDemos.length > 0, "src/engine.ts lists no shader demos");
  const main = read("src", "main.ts");
  assert.ok(main.includes('id="shader-code-${demo.slug}"'), "a shader demo has no code box");
  assert.ok(main.includes('id="shader-colors-${demo.slug}"'), "a shader demo's code is not coloured");
  assert.match(read("src", "shader-editor.ts"), /ccall\("loom_edit_shader"/, "the code box does not reach the player");
});

const player = path.join(loomDir, "Loom Web", "Player.cpp");
test("the web player exports loom_edit_shader", { skip: !fs.existsSync(player) && "engine not found" }, () => {
  assert.match(fs.readFileSync(player, "utf8"), /EMSCRIPTEN_KEEPALIVE void loom_edit_shader\(/);
  assert.match(fs.readFileSync(path.join(loomDir, "play-web.ps1"), "utf8"), /EXPORTED_RUNTIME_METHODS=[^']*\bccall\b/);
});

for (const demo of shaderDemos) {
  const sources = path.join(loomDir, "Demo Sources");
  test(`the ${demo.slug} demo has its shader at ${demo.file}`, { skip: !fs.existsSync(sources) && "engine not found" }, () => {
    const name = builtFrom[demo.slug];
    assert.ok(name, `build-loom.sh does not build ${demo.slug}`);
    assert.ok(fs.existsSync(path.join(sources, name, demo.file)), `${name}/${demo.file} does not exist`);
  });

  const build = path.join(builtDir, demo.slug);
  test(`the ${demo.slug} build says when it can be called into, and carries ${demo.file}`,
    { skip: !fs.existsSync(path.join(build, "index.html")) && "not built" }, () => {
      assert.match(fs.readFileSync(path.join(build, "index.html"), "utf8"), /Module\.initialized = true;/);
      assert.ok(fs.existsSync(path.join(build, demo.file)), `${demo.file} is not in the build`);
    });
}

function checkBuiltPage(dir) {
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  const scene = html.match(/createPreloadedFile\("\/", "scene\.loomscene", "([^"]+)"/)[1];
  const files = JSON.parse(html.match(/for \(const file of (\[[^\]]*\])\)/)[1]);
  const urls = [
    html.match(/<base href="([^"]+)"/)[1],
    html.match(/<script async src="([^"]+)"/)[1],
    scene,
    ...files,
  ];

  for (const url of urls)
    assert.ok(!/^(\/|[a-z]+:)/i.test(url), `${url} is not relative`);

  assert.equal(urls[1], `../${engineFolder}/player.js`, "the page does not load the shared player");
  assert.ok(fs.existsSync(path.join(dir, urls[1])), "the shared player is not built");

  for (const file of [scene, ...files])
    assert.ok(fs.existsSync(path.join(dir, file)), `${file} is not in the build`);
}

for (const slug of demoSlugs) {
  const dir = path.join(builtDir, slug);
  test(`the ${slug} build loads only relative URLs that are in it`,
    { skip: !fs.existsSync(path.join(dir, "index.html")) && "not built" },
    () => checkBuiltPage(dir));
}
