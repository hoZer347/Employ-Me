// Print the resume as the site shows it: src/resume.ts with the edits saved from
// the site's resume tab. Anything that copies the resume somewhere else (the
// LinkedIn sync, a job application) reads this, never resume.ts alone.
//
// An edit the site shows but no resume field could take is printed to stderr
// and the exit code is 1, since whatever reads this would silently miss it.
//
// Run: node tools/resume-json.mjs

import { existsSync, readFileSync } from "node:fs";
import { resume, resumeSectionHTML } from "../src/resume.ts";
import { applySiteEdits } from "../src/resume-edits.ts";

const EDITS = new URL("../public/content-overrides.json", import.meta.url);
const INDENT = 2;

const rendered = resumeSectionHTML();
const data = structuredClone(resume);
const edits = existsSync(EDITS) ? JSON.parse(readFileSync(EDITS, "utf8")) : {};
const { unplaced } = applySiteEdits(data, edits, rendered);

console.log(JSON.stringify(data, null, INDENT));
for (const { key, to } of unplaced) console.error(`edit on the site that no resume field holds (${key}): "${to}"`);
if (unplaced.length) process.exitCode = 1;
