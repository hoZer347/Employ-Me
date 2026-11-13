// Edits made on the site are saved beside resume.ts, not in it, and are keyed
// by where they sat on the page. These pin down that each one lands on the
// field it changed, and that one belonging to old text or another panel does not.

import test from "node:test";
import assert from "node:assert/strict";
import { applySiteEdits, plainText, withSiteEdits } from "../src/resume-edits.ts";
import { buildResumePdf, resume as realResume } from "../src/resume.ts";

const sample = () => ({
  summary: "C++ engineer on core algorithms.",
  contact: { email: "a@b.ca", phone: "613-555-0100", github: "github.com/a" },
  experience: [{ role: "Developer", org: "Corel", points: ["Shipped [X]% faster builds.", "Fixed leaks."] }],
  skills: { Languages: "C++, C#", Tools: "Git, CMake" },
});

test("an edit to the summary replaces the summary", () => {
  const resume = sample();
  const { applied } = applySiteEdits(resume, {
    "#panel-resume/div:0/p:1": { html: "C++ engineer, algorithms first.", original: "C++ engineer on core algorithms." },
  });
  assert.equal(resume.summary, "C++ engineer, algorithms first.");
  assert.deepEqual(applied, [{ from: "C++ engineer on core algorithms.", to: "C++ engineer, algorithms first." }]);
});

test("a bullet is matched through the page's markup and indentation", () => {
  const resume = sample();
  applySiteEdits(resume, {
    "#panel-resume/div:2/ul:0/li:0": {
      html: "\n  Shipped <span class=\"ph\">[X]%</span> faster builds &amp; tests.",
      original: "\n  Shipped <span class=\"ph\">[X]%</span> faster builds.\n",
    },
  });
  assert.equal(resume.experience[0].points[0], "Shipped [X]% faster builds & tests.");
  assert.equal(resume.experience[0].points[1], "Fixed leaks.");
});

test("a skills row is matched with its group label, which stays the same", () => {
  const resume = sample();
  applySiteEdits(resume, {
    "#panel-resume/div:3/p:0": {
      html: "<span class=\"g\">Languages:</span> C++, C#, Python",
      original: "<span class=\"g\">Languages:</span> C++, C#",
    },
    "#panel-resume/div:3/p:1": { html: "<span>Kit:</span> Git", original: "<span>Tools:</span> Git, CMake" },
  });
  assert.deepEqual(resume.skills, { Languages: "C++, C#, Python", Tools: "Git, CMake" });
});

test("a job heading and the contact line split back into their fields", () => {
  const resume = sample();
  applySiteEdits(resume, {
    "#panel-resume/div:2/h3:0": {
      html: "Senior Developer · <span class=\"o\">Corel</span>",
      original: "Developer · <span class=\"o\">Corel</span>",
    },
    "#panel-resume/header:0/p:2": {
      html: "a@b.ca · 613-555-0199 · github.com/a",
      original: "a@b.ca · 613-555-0100 · github.com/a",
    },
  });
  assert.equal(resume.experience[0].role, "Senior Developer");
  assert.equal(resume.experience[0].org, "Corel");
  assert.equal(resume.contact.phone, "613-555-0199");
});

test("an edit to old text, or to another panel, changes nothing", () => {
  const resume = sample();
  const { applied, unplaced } = applySiteEdits(resume, {
    "#panel-resume/div:0/p:1": { html: "New.", original: "A summary resume.ts no longer has." },
    "#panel-projects/div:0/p:1": { html: "New.", original: "C++ engineer on core algorithms." },
  }, "<p>C++ engineer on core algorithms.</p>");
  assert.deepEqual(resume, sample());
  assert.deepEqual(applied, []);
  assert.deepEqual(unplaced, []);
});

test("an edit whose text a longer current bullet starts with is stale, not unplaced", () => {
  const { unplaced } = applySiteEdits(sample(), {
    "#panel-resume/div:2/ul:0/li:1": { html: "Fixed every leak.", original: "Fixed leaks." },
  }, "<ul><li>Fixed leaks. Cut memory use.</li></ul>");
  assert.deepEqual(unplaced, []);
});

test("a current edit no field can take is reported, not dropped", () => {
  const resume = sample();
  const { unplaced } = applySiteEdits(resume, {
    "#panel-resume/div:1/h3:0": { html: "Developer and Lead · Corel · 2022", original: "Developer · Corel" },
    "#panel-resume/div:4/h2:0": { html: "Experience", original: "Work Experience" },
  }, "<h3>Developer · <span>Corel</span></h3><h2>Work Experience</h2>");
  assert.deepEqual(resume, sample());
  assert.deepEqual(unplaced.map((e) => e.to), ["Developer and Lead · Corel · 2022", "Experience"]);
});

test("plain text drops tags, decodes entities and collapses whitespace", () => {
  assert.equal(plainText("\n  a<br>b &lt;c&gt;&nbsp;&#39;d&#39; C&#x2B;&#43;\n"), "a b <c> 'd' C++");
});

test("an escaped entity decodes once, not twice", () => {
  assert.equal(plainText("&amp;lt;div&amp;gt;"), "&lt;div&gt;");
});

test("the downloadable PDF carries a site edit and the resume data is left alone", async () => {
  const before = realResume.summary;
  const edited = withSiteEdits(realResume, {
    "#panel-resume/div:0/p:1": { html: "Zebra summary.", original: before },
  });
  const pdf = (await buildResumePdf(edited)).output();
  assert.ok(pdf.includes("Zebra summary."));
  assert.equal(realResume.summary, before);
});
