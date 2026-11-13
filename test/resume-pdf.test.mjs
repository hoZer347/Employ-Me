// Formatting contract for the downloadable resume PDF.
//
// The button in the resume section hands the reader a file that goes straight
// into a recruiter's inbox and, more often, through an applicant tracking
// system's text extractor. Both care about presentation rules the on-page
// resume cannot express: page size, margins, legible type, text that comes
// back out as text, and sections that hold together as blocks.
//
// So this generates the real PDF with the shipped code path and reads the
// bytes back (see pdf-inspect.mjs). Nothing is mocked, so a layout regression
// in src/resume.ts fails here rather than in someone's inbox.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildResumePdf,
  MAX_PAGE_HEIGHT,
  PAGE_MARGIN,
  PAGE_WIDTH,
  RESUME_FILENAME,
  pendingPlaceholders,
  resume,
} from "../src/resume.ts";
import { inspectPdf } from "./pdf-inspect.mjs";

// The PDF is one continuous page: US Letter wide, as tall as its content.
const LETTER_WIDTH_PT = 612;

// Half an inch of clear space on every edge is the floor that print drivers
// and ATS parsers both assume. It is looser than PAGE_MARGIN on purpose:
// baselines sit at the margin, so the tallest line's ascenders reach slightly
// past it, and that is normal typesetting rather than a defect.
const SAFE = 36;

// Helvetica ascends about 0.72 em and descends about 0.21; rounding outwards
// keeps the ink-box checks conservative.
const ASCENT = 0.75;
const DESCENT = 0.25;

// Smallest type a resume should ever be set in. Below this, print quality and
// screen legibility both suffer and some parsers start dropping runs.
const MIN_FONT_PT = 9;

// Anything larger than this reads as a poster rather than a resume.
const MAX_FONT_PT = 24;

// Rounding in the PDF's decimal coordinates, not a fudge factor for layout.
const EPSILON = 0.01;

const pdf = inspectPdf((await buildResumePdf()).output());

// --- Reading the layout back -----------------------------------------------
//
// src/resume.ts distinguishes the parts of the resume by font and size alone,
// so the same signatures identify them here. Each predicate is unique: nothing
// else in the document is bold 11pt, and nothing else is bold 10.5pt.

const SECTION_HEADINGS = ["WORK EXPERIENCE", "PROJECTS", "EDUCATION", "SKILLS", "INTERESTS"];

const isSectionHeading = (run) => run.font === "Helvetica-Bold" && run.size === 11;
const isEntryHeader = (run) =>
  run.font === "Helvetica-Bold" && run.size === 10.5 && run.x === PAGE_MARGIN;
// jsPDF writes the bullet glyph in WinAnsi, where 0x95 is the bullet.
const isBulletMarker = (run) => run.text.length === 1 && run.text.charCodeAt(0) === 0x95;
const isBulletLine = (run) =>
  run.font === "Helvetica" && run.size === 10 && run.x === PAGE_MARGIN + 14;

/** Collapse whitespace so a wrapped line and its source string compare equal. */
const norm = (s) => s.replace(/\s+/g, " ").trim();

/** The text a group of runs reads as once the line wrapping is undone. */
const textOf = (runs) => norm(runs.map((r) => r.text).join(" "));

/** Every text run in the document, in drawing order, which is reading order. */
const runs = pdf.texts;

/** Section name -> the runs under it, heading excluded, up to the next
 *  heading. This is the grouping the whole file is really testing. */
const sections = new Map(
  (() => {
    const starts = runs.flatMap((run, i) => (isSectionHeading(run) ? [i] : []));
    return starts.map((start, n) => {
      const end = starts[n + 1] ?? runs.length;
      return [runs[start].text, runs.slice(start + 1, end)];
    });
  })(),
);

/** Split a section's runs into one chunk per entry, each starting at its own
 *  bold entry header. Anything before the first header is not part of an
 *  entry and is dropped. */
function entriesIn(sectionName) {
  const body = sections.get(sectionName) ?? [];
  const starts = body.flatMap((run, i) => (isEntryHeader(run) ? [i] : []));
  return starts.map((start, n) => body.slice(start, starts[n + 1] ?? body.length));
}

/** The bullets inside one entry: a marker plus the wrapped lines that follow
 *  it, reassembled. Link lines sit at the same indent but a smaller size, so
 *  they do not get swept in. */
function bulletsIn(entry) {
  const bullets = [];
  for (const run of entry) {
    if (isBulletMarker(run)) bullets.push([]);
    else if (isBulletLine(run) && bullets.length) bullets.at(-1).push(run);
  }
  return bullets;
}

/** The ink box a text run occupies, in PDF user space (y grows upwards). */
function inkBox(run) {
  return {
    left: run.x,
    right: run.x + run.width,
    bottom: run.y - run.size * DESCENT,
    top: run.y + run.size * ASCENT,
  };
}

/** A short, quotable label for a run, for assertion messages. */
function label(run) {
  const text = run.text.length > 60 ? `${run.text.slice(0, 57)}...` : run.text;
  return `p${run.page} "${text}" (${run.font} ${run.size}pt at ${run.x}, ${run.y})`;
}

// --- Page geometry ---------------------------------------------------------

test("the PDF is a single continuous page, never split into sheets", () => {
  // This is what makes every "not cut off" guarantee below unconditional:
  // with one page there is no page break for a section to straddle.
  assert.equal(
    pdf.pages.length,
    1,
    `the resume paginated into ${pdf.pages.length} pages; it is built as one ` +
      `continuous page so nothing can be cut in half by a page break`,
  );
});

test("the page is US Letter wide", () => {
  assert.equal(PAGE_WIDTH, LETTER_WIDTH_PT, "the layout width should stay US Letter");
  for (const page of pdf.pages) {
    assert.equal(page.width, LETTER_WIDTH_PT, `page ${page.number} width`);
  }
});

test("the page is exactly as tall as its content", () => {
  const [page] = pdf.pages;
  const bottom = Math.min(...page.texts.map((t) => inkBox(t).bottom));
  assert.ok(
    bottom >= PAGE_MARGIN - EPSILON,
    `the last line's ink sits ${bottom.toFixed(1)}pt from the bottom edge, inside the ` +
      `${PAGE_MARGIN}pt margin; the page is too short and the content is clipped`,
  );
  assert.ok(
    bottom <= PAGE_MARGIN + 4,
    `the page ends ${bottom.toFixed(1)}pt below the last line, leaving a blank slab; ` +
      `the height should be derived from where the content actually stops`,
  );
});

test("the page height stays within what PDF readers honour", () => {
  for (const page of pdf.pages) {
    assert.ok(
      page.height <= MAX_PAGE_HEIGHT,
      `page ${page.number} is ${page.height}pt tall, past the ${MAX_PAGE_HEIGHT}pt ` +
        `ceiling readers respect; the resume has to be cut down instead`,
    );
  }
});

test("every page carries content", () => {
  for (const page of pdf.pages) {
    assert.ok(page.texts.length > 0, `page ${page.number} is blank`);
  }
});

// --- Margins and type ------------------------------------------------------

test("all text stays inside the half-inch printable safe area", () => {
  for (const page of pdf.pages) {
    for (const run of page.texts) {
      const box = inkBox(run);
      assert.ok(box.left >= SAFE - EPSILON, `${label(run)} runs past the left safe area`);
      assert.ok(
        box.right <= page.width - SAFE + EPSILON,
        `${label(run)} runs past the right safe area (ends at ${box.right.toFixed(1)}pt)`,
      );
      assert.ok(
        box.top <= page.height - SAFE + EPSILON,
        `${label(run)} runs past the top safe area`,
      );
      assert.ok(box.bottom >= SAFE - EPSILON, `${label(run)} runs past the bottom safe area`);
    }
  }
});

test("text respects the layout's own left and right margins", () => {
  // Horizontal overflow is the failure mode that actually bites: a long job
  // title or a long URL silently running off the edge of the sheet.
  for (const page of pdf.pages) {
    for (const run of page.texts) {
      const box = inkBox(run);
      assert.ok(
        box.left >= PAGE_MARGIN - EPSILON,
        `${label(run)} starts left of the ${PAGE_MARGIN}pt margin`,
      );
      assert.ok(
        box.right <= page.width - PAGE_MARGIN + EPSILON,
        `${label(run)} overflows the ${PAGE_MARGIN}pt right margin by ` +
          `${(box.right - (page.width - PAGE_MARGIN)).toFixed(1)}pt`,
      );
    }
  }
});

test("rules and dividers respect the margins too", () => {
  for (const page of pdf.pages) {
    for (const rule of page.rules) {
      for (const x of [rule.x1, rule.x2]) {
        assert.ok(
          x >= PAGE_MARGIN - EPSILON && x <= page.width - PAGE_MARGIN + EPSILON,
          `a rule on page ${page.number} ends at x=${x}, outside the margins`,
        );
      }
    }
  }
});

test("no text is set below the legibility floor", () => {
  for (const run of runs) {
    assert.ok(
      run.size >= MIN_FONT_PT,
      `${label(run)} is set at ${run.size}pt, below the ${MIN_FONT_PT}pt floor`,
    );
    assert.ok(run.size <= MAX_FONT_PT, `${label(run)} is set at ${run.size}pt, oversized`);
  }
});

test("the name is the largest thing on the page and comes first", () => {
  const first = runs[0];
  assert.equal(first.text, resume.name, "the first text run should be the name");
  const largest = Math.max(...runs.map((t) => t.size));
  assert.equal(first.size, largest, "the name should be set at the largest size in the document");
});

test("only standard PDF core fonts are used, so any reader renders it", () => {
  // Core Type1 fonts need no embedding and every viewer and parser has them.
  for (const font of new Set(runs.map((t) => t.font))) {
    assert.match(
      font,
      /^Helvetica(-Bold|-Oblique|-BoldOblique)?$/,
      `${font} is not part of the Helvetica core-font family the resume is set in`,
    );
  }
});

test("no text run overlaps another", () => {
  // The date on an entry header is right-aligned against a left-aligned title
  // on the same baseline. Grow either one and they collide, which looks like
  // corruption in a PDF viewer, so it is worth catching mechanically.
  for (const page of pdf.pages) {
    const boxes = page.texts.map((run) => ({ run, box: inkBox(run) }));
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        const A = boxes[a].box;
        const B = boxes[b].box;
        const overlaps =
          A.left < B.right - EPSILON &&
          B.left < A.right - EPSILON &&
          A.bottom < B.top - EPSILON &&
          B.bottom < A.top - EPSILON;
        assert.ok(!overlaps, `${label(boxes[a].run)} overlaps ${label(boxes[b].run)}`);
      }
    }
  }
});

// --- Sections are whole, ordered, and grouped ------------------------------

test("every section is present, once, in order", () => {
  const found = runs.filter(isSectionHeading).map((r) => r.text);
  assert.deepEqual(found, SECTION_HEADINGS, "section headings, in document order");
});

test("no section is split across a page", () => {
  for (const [name, body] of sections) {
    const pages = new Set(body.map((r) => r.page));
    assert.equal(
      pages.size,
      1,
      `the ${name} section is spread over pages ${[...pages].join(" and ")}; ` +
        `a section has to stay whole`,
    );
  }
});

test("a section heading is never left stranded from its content", () => {
  // Bound to what follows it, not to what precedes it: the heading must sit
  // closer to its own first line than to the section that ended above.
  const indices = runs.flatMap((run, i) => (isSectionHeading(run) ? [i] : []));
  for (const i of indices) {
    const heading = runs[i];
    const below = runs[i + 1];
    assert.ok(below, `"${heading.text}" is the last thing in the document, with no content`);
    assert.equal(below.page, heading.page, `"${heading.text}" is orphaned at the foot of a page`);

    const gapBelow = heading.y - below.y;
    assert.ok(gapBelow > 0, `"${heading.text}" does not sit above its own content`);

    const above = runs[i - 1];
    if (above && above.page === heading.page) {
      assert.ok(
        gapBelow < above.y - heading.y,
        `"${heading.text}" sits closer to the section above (${(above.y - heading.y).toFixed(1)}pt) ` +
          `than to its own content (${gapBelow.toFixed(1)}pt), so it reads as belonging to the wrong block`,
      );
    }
  }
});

test("each section holds exactly its own entries", () => {
  const expected = {
    "WORK EXPERIENCE": resume.experience.map((job) => `${job.role} - ${job.org}`),
    PROJECTS: resume.projects.map((proj) => proj.name),
    EDUCATION: resume.education.map((ed) => ed.degree),
  };
  for (const [name, titles] of Object.entries(expected)) {
    const found = entriesIn(name).map((entry) => entry[0].text);
    assert.deepEqual(found, titles, `entries under ${name}, in order`);
  }
});

test("each entry keeps its own header, dates, and bullets together", () => {
  const cases = [
    ["WORK EXPERIENCE", resume.experience, (job) => `${job.role} - ${job.org}`],
    ["PROJECTS", resume.projects, (proj) => proj.name],
  ];
  for (const [section, items, titleOf] of cases) {
    const entries = entriesIn(section);
    items.forEach((item, i) => {
      const entry = entries[i];
      const text = textOf(entry);
      const title = titleOf(item);

      assert.equal(entry[0].text, title, `the ${section} entry ${i + 1} should start with its title`);
      assert.ok(
        text.includes(item.period),
        `"${title}" is separated from its dates (${item.period})`,
      );

      // The bullets, reassembled from their wrapped lines. Comparing the whole
      // list at once catches a missing bullet, a truncated one, one that
      // drifted into a neighbouring entry, and a reordering.
      assert.deepEqual(
        bulletsIn(entry).map(textOf),
        item.points.map(norm),
        `the bullets grouped under "${title}"`,
      );

      const pages = new Set(entry.map((r) => r.page));
      assert.equal(
        pages.size,
        1,
        `"${title}" is broken across pages ${[...pages].join(" and ")}`,
      );
    });
  }
});

test("an entry header is never separated from its first bullet", () => {
  for (const section of ["WORK EXPERIENCE", "PROJECTS"]) {
    for (const entry of entriesIn(section)) {
      const header = entry[0];
      const marker = entry.find(isBulletMarker);
      if (!marker) continue;
      assert.equal(marker.page, header.page, `"${header.text}" is cut off from its bullets`);
      const gap = header.y - marker.y;
      assert.ok(
        gap > 0 && gap <= 20,
        `"${header.text}" sits ${gap.toFixed(1)}pt from its first bullet; ` +
          `the two should read as one block`,
      );
    }
  }
});

test("no bullet is split across a page or truncated", () => {
  for (const section of ["WORK EXPERIENCE", "PROJECTS"]) {
    for (const entry of entriesIn(section)) {
      for (const bullet of bulletsIn(entry)) {
        const pages = new Set(bullet.map((r) => r.page));
        assert.equal(
          pages.size,
          1,
          `a bullet wraps across pages ${[...pages].join(" and ")}: "${textOf(bullet).slice(0, 60)}..."`,
        );
      }
    }
  }
});

test("education, skills and interests keep their content under their heading", () => {
  for (const ed of resume.education) {
    const [entry] = entriesIn("EDUCATION");
    const text = textOf(entry);
    for (const part of [ed.period, ed.org, ed.detail]) {
      assert.ok(text.includes(norm(part)), `"${part}" is not grouped under the education entry`);
    }
  }

  const skills = textOf(sections.get("SKILLS") ?? []);
  for (const [group, items] of Object.entries(resume.skills)) {
    assert.ok(skills.includes(`${group}:`), `the ${group} skills label is missing`);
    assert.ok(skills.includes(norm(items)), `the ${group} skills are not all under SKILLS`);
  }

  const interests = textOf(sections.get("INTERESTS") ?? []);
  assert.ok(interests.includes(norm(resume.interests)), "the interests line is not under INTERESTS");
});

test("content does not leak between sections", () => {
  // A distinctive string from each section, which must appear under that
  // heading and nowhere else.
  const owners = [
    ...resume.experience.map((job) => ["WORK EXPERIENCE", job.org]),
    ...resume.projects.map((proj) => ["PROJECTS", proj.name]),
    ...resume.education.map((ed) => ["EDUCATION", ed.degree]),
    ...Object.keys(resume.skills).map((group) => ["SKILLS", `${group}:`]),
  ];
  for (const [owner, needle] of owners) {
    for (const [name, body] of sections) {
      const present = textOf(body).includes(norm(needle));
      if (name === owner) {
        assert.ok(present, `"${needle}" is missing from ${name}`);
      } else {
        assert.ok(!present, `"${needle}" belongs to ${owner} but also appears under ${name}`);
      }
    }
  }
});

// --- What a parser pulls back out ------------------------------------------

test("contact details survive text extraction", () => {
  // What an ATS pulls out of the file. If any of these is missing the resume
  // is unreachable no matter how it looks.
  const text = pdf.plainText;
  for (const value of [
    resume.name,
    resume.title,
    resume.contact.email,
    resume.contact.phone,
    resume.contact.github,
    resume.contact.linkedin,
  ]) {
    assert.ok(text.includes(value), `"${value}" is missing from the extracted text`);
  }
});

test("every employer and date range is written out", () => {
  const text = norm(pdf.plainText);
  for (const job of resume.experience) {
    assert.ok(text.includes(job.org), `employer "${job.org}" is missing from the PDF`);
    assert.ok(text.includes(job.period), `the dates for "${job.org}" are missing from the PDF`);
  }
});

test("project links are clickable and readable", () => {
  const urls = pdf.pages.flatMap((p) => p.links);
  const text = pdf.plainText;
  for (const link of resume.projects.flatMap((proj) => proj.links)) {
    assert.ok(urls.includes(link.url), `${link.url} has no link annotation in the PDF`);
    // Printed resumes get printed. The URL has to be legible on paper too.
    assert.ok(text.includes(link.url), `${link.url} is not written out as visible text`);
  }
});

test("no unfilled placeholders reach the PDF", () => {
  assert.deepEqual(
    pendingPlaceholders(),
    [],
    "the resume copy still has bracketed placeholders waiting on real numbers",
  );
  assert.doesNotMatch(
    pdf.plainText,
    /\[[^\]]+\]/,
    "a bracketed placeholder made it into the generated PDF",
  );
});

test("the download filename is a sane one to save", () => {
  assert.match(
    RESUME_FILENAME,
    /^[A-Za-z0-9._-]+\.pdf$/,
    "the filename should be plain ASCII with no spaces so it survives every browser and mail client",
  );
  const surname = resume.name.split(" ").at(-1);
  assert.ok(
    RESUME_FILENAME.toLowerCase().includes(surname.toLowerCase()),
    "the filename should carry the candidate's name, not just 'resume'",
  );
});
