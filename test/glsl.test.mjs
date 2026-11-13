// The shader demos' code boxes colour GLSL as Loom's shader editor does, so
// glsl.ts's words and colours have to stay the engine's: its keywords are
// TextEditor's GLSL list, its known names ENGINE_SHADER_SYMBOLS, and its
// colours TextEditor's dark palette. The colouring has to keep the text as it
// was, since the box's own text lies over it.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COLORS, ENGINE_NAMES, KEYWORDS, highlight } from "../src/glsl.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const loom = fs.readFileSync(path.join(ROOT, "build-loom.sh"), "utf8").match(/^LOOM="\$\{LOOM:-\/c\/([^}]+)\}"$/m)[1];
const loomDir = process.env.LOOM ?? `C:/${loom}`;
const textEditor = path.join(loomDir, "Loom ImGui", "TextEditor.cpp");
const symbols = path.join(loomDir, "Loom WASM", "ShaderVariables.h");
const engineMissing = !fs.existsSync(textEditor) && "engine not found";

const plain = (html) => html.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const colourOf = (html, text) => html.match(new RegExp(`<span style="color:([^"]+)">${text.replace(/[*+.()[\]]/g, "\\$&")}</span>`))?.[1];

test("each kind of token takes its colour", () => {
  const html = highlight("#version 300 es\nvec3 a = u_color * 1.5; // note\n/* block */ f(\"s\");");
  assert.equal(colourOf(html, "#version 300 es"), COLORS.preprocessor);
  assert.equal(colourOf(html, "vec3"), COLORS.keyword);
  assert.equal(colourOf(html, "a"), COLORS.identifier);
  assert.equal(colourOf(html, "u_color"), COLORS.knownIdentifier);
  assert.equal(colourOf(html, "1.5"), COLORS.number);
  assert.equal(colourOf(html, "*"), COLORS.punctuation);
  assert.equal(colourOf(html, "// note"), COLORS.comment);
  assert.equal(colourOf(html, "/* block */"), COLORS.comment);
  assert.equal(colourOf(html, "\"s\""), COLORS.string);
});

test("a # past a line's start is not a preprocessor line", () => {
  assert.ok(!highlight("a # b").includes(COLORS.preprocessor));
});

test("colouring keeps the text, markup escaped", () => {
  const source = "if (a < b && c > d) { x = 1e-3; }\n\t// <tag> & more\n";
  const html = highlight(source);
  assert.doesNotMatch(html.replace(/<\/?span[^>]*>/g, ""), /[<>]/);
  assert.equal(plain(html), source);
});

for (const name of ["ShaderTime/Assets/Pulse.shader", "PreVertex/Assets/Wave.loomprevertex", "PixelPass/Assets/Inked.loompixel"]) {
  const file = path.join(loomDir, "Demo Sources", name);
  test(`colouring keeps ${name} as it is`, { skip: !fs.existsSync(file) && "engine not found" }, () => {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(plain(highlight(source)), source);
  });
}

test("the keywords are TextEditor's GLSL keywords", { skip: engineMissing }, () => {
  const glsl = fs.readFileSync(textEditor, "utf8").match(/Language::Glsl\(\) \{[\s\S]*?keywords\[\] = \{([\s\S]*?)\};/)[1];
  assert.deepEqual([...KEYWORDS].sort(), [...glsl.matchAll(/"([^"]+)"/g)].map((match) => match[1]).sort());
});

test("the known names are ENGINE_SHADER_SYMBOLS", { skip: engineMissing }, () => {
  const listed = fs.readFileSync(symbols, "utf8").match(/ENGINE_SHADER_SYMBOLS\[\] =\s*\{([\s\S]*?)\n\t\};/)[1];
  assert.deepEqual([...ENGINE_NAMES].sort(), [...listed.matchAll(/^\s*\{ "(\w+)"/gm)].map((match) => match[1]).sort());
});

test("the colours are TextEditor's dark palette", { skip: engineMissing }, () => {
  const palette = fs.readFileSync(textEditor, "utf8").match(/GetDarkPalette\(\) \{([\s\S]*?)\}\};/)[1];
  const named = Object.fromEntries([...palette.matchAll(/IM_COL32\(\s*(\d+),\s*(\d+),\s*(\d+),\s*\d+\),?\s*\/\/ (\w[\w ]*)/g)]
    .map((match) => [match[4].trim().replace(/ (\w)/g, (_, c) => c.toUpperCase()), `rgb(${match[1]} ${match[2]} ${match[3]})`]));
  for (const [kind, colour] of Object.entries(COLORS))
    assert.equal(colour, named[kind], `${kind} is not the editor's`);
});
