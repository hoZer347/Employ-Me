// A small, dependency-free reader for the PDFs jsPDF produces.
//
// jsPDF writes uncompressed content streams with one operator per line, so the
// laid-out page can be recovered exactly: every text run with its position,
// font and size. That is what lets the resume test assert on the real output
// bytes instead of on a mock of the drawing calls.

import { jsPDF } from "jspdf";

/** Map a PDF core font name onto the (family, style) pair jsPDF measures with. */
const STYLE_OF = {
  Helvetica: ["helvetica", "normal"],
  "Helvetica-Bold": ["helvetica", "bold"],
  "Helvetica-Oblique": ["helvetica", "italic"],
  "Helvetica-BoldOblique": ["helvetica", "bolditalic"],
  Courier: ["courier", "normal"],
  "Courier-Bold": ["courier", "bold"],
  "Courier-Oblique": ["courier", "italic"],
  "Courier-BoldOblique": ["courier", "bolditalic"],
  "Times-Roman": ["times", "normal"],
  "Times-Bold": ["times", "bold"],
  "Times-Italic": ["times", "italic"],
  "Times-BoldItalic": ["times", "bolditalic"],
  Symbol: ["symbol", "normal"],
  ZapfDingbats: ["zapfdingbats", "normal"],
};

const SIMPLE_ESCAPES = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };

/** Undo the escaping PDF applies inside a literal `(...)` string. */
function unescapePdfString(s) {
  return s.replace(/\\(n|r|t|b|f|\(|\)|\\|[0-7]{1,3})/g, (_, esc) => {
    if (esc in SIMPLE_ESCAPES) return SIMPLE_ESCAPES[esc];
    if (/^[0-7]+$/.test(esc)) return String.fromCharCode(parseInt(esc, 8));
    return esc;
  });
}

/** Split the raw file into `N 0 obj ... endobj` bodies, keyed by object number. */
function indirectObjects(raw) {
  const objects = new Map();
  for (const m of raw.matchAll(/(\d+) 0 obj\b([\s\S]*?)\bendobj/g)) {
    objects.set(Number(m[1]), m[2]);
  }
  return objects;
}

/** Walk one page's content stream, returning its text runs and vector lines. */
function readContentStream(stream, fonts, measure) {
  const texts = [];
  const rules = [];
  let font = null;
  let size = 0;
  let x = 0;
  let y = 0;

  for (const raw of stream.split("\n")) {
    const line = raw.trim();

    let m = line.match(/^\/(F\d+) ([\d.]+) Tf$/);
    if (m) {
      font = fonts.get(m[1]) ?? m[1];
      size = Number(m[2]);
      continue;
    }
    // jsPDF opens a fresh BT/ET block per text() call, so this offset is the
    // absolute position of the run that follows.
    m = line.match(/^(-?[\d.]+) (-?[\d.]+) Td$/);
    if (m) {
      x = Number(m[1]);
      y = Number(m[2]);
      continue;
    }
    m = line.match(/^\((.*)\) Tj$/);
    if (m) {
      const text = unescapePdfString(m[1]);
      texts.push({ text, x, y, font, size, width: measure(text, font, size) });
      continue;
    }
    m = line.match(/^(-?[\d.]+) (-?[\d.]+) m$/);
    if (m) {
      rules.push({ x1: Number(m[1]), y1: Number(m[2]), x2: null, y2: null });
      continue;
    }
    m = line.match(/^(-?[\d.]+) (-?[\d.]+) l$/);
    if (m && rules.length) {
      const last = rules[rules.length - 1];
      last.x2 = Number(m[1]);
      last.y2 = Number(m[2]);
    }
  }

  return { texts, rules };
}

/**
 * Parse a jsPDF-produced PDF into a page-by-page description.
 *
 * Coordinates are PDF user space: points, origin at the bottom-left of the
 * page, y growing upwards. Each text run carries the measured width of its own
 * string, so a caller can reason about the box the ink actually occupies.
 */
export function inspectPdf(raw) {
  const objects = indirectObjects(raw);

  // A throwaway document, in the same units, used purely as a font-metrics
  // oracle: jsPDF measures with the very tables it wrote the PDF from.
  const ruler = new jsPDF({ unit: "pt", format: "letter" });
  const measure = (text, baseFont, size) => {
    const style = STYLE_OF[baseFont];
    if (!style) return NaN;
    ruler.setFont(style[0], style[1]).setFontSize(size);
    return ruler.getTextWidth(text);
  };

  // Resource dictionaries name fonts /F1, /F2, ...; resolve each to its
  // BaseFont so the rest of the reader talks in real font names.
  const fonts = new Map();
  for (const body of objects.values()) {
    const dict = body.match(/\/Font <<([\s\S]*?)>>/);
    if (!dict) continue;
    for (const m of dict[1].matchAll(/\/(F\d+) (\d+) 0 R/g)) {
      const base = (objects.get(Number(m[2])) ?? "").match(
        /\/BaseFont \/([^\s/]+)/,
      );
      if (base) fonts.set(m[1], base[1]);
    }
  }

  // /Kids gives page order; the page objects are not laid out in file order.
  const pagesObj = [...objects.values()].find((b) => /\/Type \/Pages\b/.test(b));
  const kids = [...(pagesObj ?? "").matchAll(/(\d+) 0 R/g)].map((m) =>
    Number(m[1]),
  );

  const pages = kids.map((num, index) => {
    const body = objects.get(num) ?? "";
    const box = body.match(/\/MediaBox \[([-\d.\s]+)\]/);
    const [x0, y0, x1, y1] = box
      ? box[1].trim().split(/\s+/).map(Number)
      : [0, 0, 0, 0];
    const contentsRef = body.match(/\/Contents (\d+) 0 R/);
    const contents = objects.get(Number(contentsRef?.[1])) ?? "";
    const stream = contents.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
    const { texts, rules } = readContentStream(stream?.[1] ?? "", fonts, measure);
    for (const run of texts) run.page = index + 1;
    const links = [...body.matchAll(/\/URI \(([^)]*)\)/g)].map((m) => m[1]);
    return { number: index + 1, width: x1 - x0, height: y1 - y0, texts, rules, links };
  });

  return {
    pages,
    /** Distinct BaseFont names referenced by the document's resources. */
    fonts: [...new Set(fonts.values())],
    /** Every text run on every page, in drawing order. */
    texts: pages.flatMap((p) => p.texts),
    /** All page text joined, a stand-in for what a text extractor would pull. */
    plainText: pages.map((p) => p.texts.map((t) => t.text).join("\n")).join("\n"),
  };
}
