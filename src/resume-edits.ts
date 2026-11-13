// Edits made on the site's own resume tab, folded back into the resume data.
//
// The in-page editor (editable.ts) saves text changes to
// public/content-overrides.json, not to resume.ts, so resume.ts alone is the
// resume as it stood before them. The page applies the edits to its markup;
// everything built from the data instead applies them here: the PDF, the job
// pipeline, and the LinkedIn sync (tools/resume-json.mjs).
//
// An edit is keyed by where it sat on the page, which does not say what field
// it was, so it is matched on the text it replaced. That is editable.ts's rule
// too: an edit whose original no longer matches is stale and is dropped.
//
// Imported by Node directly as well as by Vite, so it imports nothing.

/** One saved edit, as editable.ts writes it. */
export interface SiteEdit {
  /** The markup the owner left behind. */
  html: string;
  /** What the page's own code renders, so a stale edit can be spotted. */
  original: string;
}

export type SiteEdits = Record<string, SiteEdit>;

/** What applying the edits changed, and the edits that are still current but
 *  that no field could take. */
export interface EditResult {
  applied: { from: string; to: string }[];
  unplaced: { key: string; to: string }[];
}

type Fields = Record<string, unknown>;

const RESUME_PANEL = "#panel-resume/";
// How the page joins the fields it renders on one line.
const FIELD_SEPARATOR = " · ";
// Tags that start a text block of their own. The editor edits a whole block,
// and inline tags (span, a) stay inside it.
const BLOCK_TAG = /<\/?(?:p|li|h[1-6]|div|ul|section|header|button)\b[^>]*>/gi;
const TAG = /<[^>]*>/g;
// One pass, so "&amp;lt;" decodes to "&lt;" and is not read again as "<".
const ENTITY = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const MAX_CODE_POINT = 0x10ffff;
const HEX = 16;

function decodeEntity(match: string, name: string): string {
  if (name[0] !== "#") return NAMED[name.toLowerCase()] ?? match;
  const n = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), HEX) : Number(name.slice(1));
  return n <= MAX_CODE_POINT ? String.fromCodePoint(n) : match;
}

/** Markup as the words a reader sees: tags dropped, entities decoded, and the
 *  page's source indentation collapsed. */
export function plainText(html: string): string {
  return html.replace(TAG, " ").replace(ENTITY, decodeEntity).replace(/\s+/g, " ").trim();
}

/** The edits to the resume tab, out of everything the editor saved. */
export function resumePanelEdits(edits: SiteEdits): SiteEdits {
  return Object.fromEntries(Object.entries(edits).filter(([key]) => key.startsWith(RESUME_PANEL)));
}

/** Every line the page renders from the resume, as the fields it was built
 *  from and how they are joined. A skills row reads "Group: items", and an edit
 *  that renames the group is not taken. */
function lines(resume: Fields) {
  const out: { node: Fields; keys: string[]; sep: string; label: string }[] = [];
  const skills = resume.skills;
  const walk = (node: Fields) => {
    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === "object") walk(value as Fields);
      else if (typeof value === "string") {
        out.push({ node, keys: [key], sep: "", label: node === skills ? `${key}: ` : "" });
      }
    }
  };
  walk(resume);
  for (const job of resume.experience as Fields[]) {
    out.push({ node: job, keys: ["role", "org"], sep: FIELD_SEPARATOR, label: "" });
  }
  out.push({ node: resume.contact as Fields, keys: ["email", "phone", "github"], sep: FIELD_SEPARATOR, label: "" });
  return out;
}

/** Rewrite in place every resume field an edit to the resume tab replaced.
 *
 *  An edit counts as unplaced when its original is a whole text block of
 *  `rendered` (the tab as resumeSectionHTML draws it now) and yet no field took
 *  it: a change the site shows that anything built from the data would miss. */
export function applySiteEdits(resume: object, edits: SiteEdits, rendered = ""): EditResult {
  const pending = new Map(Object.entries(resumePanelEdits(edits))
    .map(([key, e]) => [plainText(e.original), { key, to: plainText(e.html) }]));
  const applied: EditResult["applied"] = [];
  for (const { node, keys, sep, label } of lines(resume as Fields)) {
    const from = plainText(label + keys.map((k) => node[k]).join(sep));
    const edit = pending.get(from);
    if (!edit || !edit.to.startsWith(label)) continue;
    const text = edit.to.slice(label.length);
    const parts = sep ? text.split(sep) : [text];
    if (parts.length !== keys.length) continue;
    pending.delete(from);
    keys.forEach((k, i) => {
      if (parts[i] === node[k]) return;
      applied.push({ from: node[k] as string, to: parts[i] });
      node[k] = parts[i];
    });
  }
  const blocks = new Set(rendered.split(BLOCK_TAG).map(plainText));
  const unplaced = [...pending].filter(([original]) => blocks.has(original)).map(([, e]) => e);
  return { applied, unplaced };
}

/** A copy of `resume` with the edits applied, leaving the original alone. */
export function withSiteEdits<T extends object>(resume: T, edits: SiteEdits): T {
  const copy = structuredClone(resume);
  applySiteEdits(copy, edits);
  return copy;
}
