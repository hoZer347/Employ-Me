// Editing the site's text in the page itself, for whoever is hosting it.
//
// Two halves, running for different people. Overrides are applied for everyone,
// so a saved edit is what the world reads. The editor is armed only when the
// server says the request came off a local socket; the browser is never asked
// to decide that, and the deployed Netlify copy answers no such question, so it
// stays read-only. See tools/edit-server.cjs for how the call is made.
//
// Nothing is added to the page for a visitor: no attributes, no styles, no
// listeners. For the owner nothing changes either until Alt is held, which
// outlines what can be edited, or a text block is clicked.

import type { SiteEdits } from "./resume-edits";

const OVERRIDES_URL = "/content-overrides.json";
const SESSION_URL = "/__edit/session";
const SAVE_URL = "/__edit/save";

/** A text block, keyed by where it sits in the page. */
interface Host {
  el: HTMLElement;
  original: string;
}

// Containers whose contents are not prose, and which must not be walked into.
// Tag names come back lowercase for SVG, hence the case fold.
const OPAQUE = new Set([
  "SCRIPT",
  "STYLE",
  "CANVAS",
  "IFRAME",
  "SVG",
  "NOSCRIPT",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "OPTION",
  "PRE",
]);

// Clicking one of these does something, so it takes Alt to edit instead.
const INTERACTIVE = "a,button,input,select,textarea,label,summary";

// Only a request to one of these can be granted editing, so anywhere else the
// page can skip asking. The server is still the one that decides; this only
// keeps a visitor from paying for a round trip whose answer is already known.
const LOCAL_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

const hosts = new Map<string, Host>();

// Started at module load, which import order puts before any page renders, so
// the request is in flight while the markup is being built rather than starting
// after it. An edit still lands a beat behind the first paint.
const overridesReady = loadOverrides();

/**
 * A path down to `el` from the nearest ancestor carrying an id. Ids are unique
 * in a document, so the path is too, and anchoring at the closest one keeps a
 * change to one panel from shifting every key in the next.
 */
function keyFor(el: Element): string | null {
  const parts: string[] = [];
  let node: Element | null = el;

  while (node) {
    if (node.id) return [`#${node.id}`, ...parts].join("/");
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) return null;
    const index = Array.prototype.indexOf.call(parent.children, node);
    parts.unshift(`${node.tagName.toLowerCase()}:${index}`);
    node = parent;
  }
  return null;
}

/** True if the element renders text of its own rather than only through children. */
function hasOwnText(el: Element): boolean {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) return true;
  }
  return false;
}

/**
 * Register every text block under `root`. The outermost element holding text
 * wins and its children are left alone, so "Liam Brown" is one edit even though
 * the surname sits in its own coloured span.
 */
function collect(root: HTMLElement): void {
  const walk = (el: Element) => {
    if (OPAQUE.has(el.tagName.toUpperCase())) return;
    if (hasOwnText(el)) {
      const key = keyFor(el);
      if (key) hosts.set(key, { el: el as HTMLElement, original: el.innerHTML });
      return;
    }
    for (const child of el.children) walk(child);
  };
  for (const child of root.children) walk(child);
}

/** The edits saved now. Fetched fresh each call, so one made since the page
 *  loaded counts. */
export async function loadOverrides(): Promise<SiteEdits> {
  try {
    const res = await fetch(OVERRIDES_URL, { cache: "no-store" });
    // A missing file is not always a 404: both this site's servers fall an
    // unmatched route back to index.html, so the type is what settles it.
    if (!res.ok) return {};
    if (!(res.headers.get("content-type") ?? "").includes("json")) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * The tags in `html`, bar line breaks, or null if some "<" in it opens no tag.
 * The same rule the server enforces on the way in (tools/edit-server.cjs), kept
 * here as well because this is the point where a stored string becomes live DOM
 * and the file it came from is also written by hand and by git.
 */
function tagsOf(html: string): string[] | null {
  const found = html.match(/<[^>]*>/g) ?? [];
  if (found.length !== (html.match(/</g) ?? []).length) return null;
  return found.filter((tag) => !/^<br\s*\/?>$/i.test(tag));
}

function sameMarkup(edited: string, rendered: string): boolean {
  const a = tagsOf(edited);
  const b = tagsOf(rendered);
  if (!a || !b || a.length !== b.length) return false;
  return a.every((tag, i) => tag === b[i]);
}

function applyOverrides(overrides: SiteEdits): void {
  for (const [key, override] of Object.entries(overrides)) {
    const host = hosts.get(key);
    if (!host) continue;
    // The page's own markup is the anchor, twice over. If it has moved on since
    // the edit was saved the edit belongs to text that is no longer here, and
    // an edit that carries any other tags is not an edit to the words, so both
    // are dropped rather than pasted over whatever took their place.
    if (host.original !== override.original) continue;
    if (!sameMarkup(override.html, host.original)) continue;
    host.el.innerHTML = override.html;
  }
}

async function isOwner(): Promise<boolean> {
  try {
    const res = await fetch(SESSION_URL, { cache: "no-store" });
    if (!res.ok) return false;
    if (!(res.headers.get("content-type") ?? "").includes("json")) return false;
    return (await res.json()).editable === true;
  } catch {
    return false;
  }
}

// --- The editor, owner only -------------------------------------------------

function armStyles(): void {
  const style = document.createElement("style");
  style.textContent = `
    body.site-alt [data-edit]:hover {
      outline: 1px dashed rgba(125, 211, 252, 0.5);
      outline-offset: 3px;
      cursor: text;
    }
    [data-edit][contenteditable="true"] {
      outline: 1px solid rgb(56, 189, 248);
      outline-offset: 3px;
      border-radius: 2px;
    }
    #site-edit-toast {
      position: fixed;
      inset-inline-end: 1rem;
      inset-block-end: 1rem;
      z-index: 100;
      border-radius: 0.5rem;
      background: rgb(30, 41, 59);
      padding: 0.4rem 0.75rem;
      font: 500 0.8rem/1.4 ui-sans-serif, system-ui, sans-serif;
      color: rgb(226, 232, 240);
      box-shadow: 0 4px 16px rgb(2 6 23 / 0.5);
      opacity: 0;
      transition: opacity 150ms;
      pointer-events: none;
    }
    #site-edit-toast.on { opacity: 1; }`;
  document.head.append(style);
}

let toastEl: HTMLDivElement | null = null;
let toastTimer = 0;

function toast(message: string): void {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.id = "site-edit-toast";
    document.body.append(toastEl);
  }
  toastEl.textContent = message;
  toastEl.classList.add("on");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl?.classList.remove("on"), 1800);
}

let editing: HTMLElement | null = null;
/** What the block held when editing began, for Escape and for the no-op test. */
let openedWith = "";

function begin(el: HTMLElement): void {
  if (editing === el) return;
  commit();
  editing = el;
  openedWith = el.innerHTML;
  el.contentEditable = "true";
  el.spellcheck = true;
}

function end(): HTMLElement | null {
  const el = editing;
  if (!el) return null;
  editing = null;
  el.removeAttribute("contenteditable");
  el.removeAttribute("spellcheck");
  el.blur();
  return el;
}

function cancel(): void {
  if (!editing) return;
  editing.innerHTML = openedWith;
  end();
}

function commit(): void {
  const el = end();
  if (!el) return;

  const html = el.innerHTML;
  if (html === openedWith) return;

  // An empty block cannot be clicked again, so there would be no way back to it.
  if (!el.textContent?.trim()) {
    el.innerHTML = openedWith;
    toast("Text cannot be empty");
    return;
  }

  const key = el.dataset.edit!;
  const original = hosts.get(key)!.original;
  void fetch(SAVE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, html, original }),
    // commit also runs on the way out of the page, where a plain fetch is
    // cancelled with the document and the edit would go quietly missing.
    keepalive: true,
  })
    .then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      toast(body.cleared ? "Reverted" : "Saved");
    })
    .catch((err: Error) => toast(`Not saved: ${err.message}`));
}

function onMouseDown(event: MouseEvent): void {
  const target = event.target as Element | null;
  if (!target) return;
  if (editing?.contains(target)) return; // moving the caret inside the open block

  const el = target.closest<HTMLElement>("[data-edit]");
  if (!el) {
    commit();
    return;
  }
  // A link or a button still does its job on a plain click; Alt says to edit it.
  if (!event.altKey && (target.closest(INTERACTIVE) ?? el.closest(INTERACTIVE))) {
    commit();
    return;
  }
  // Left to run: the browser's own handling of this mousedown is what puts the
  // caret where the click landed.
  begin(el);
}

function onClick(event: MouseEvent): void {
  // Swallow the click that opened or landed inside the editor, so a tab button
  // does not switch tabs and a link does not navigate away mid-edit.
  if (editing?.contains(event.target as Node)) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === "Alt") document.body.classList.add("site-alt");
  if (!editing?.contains(event.target as Node)) return;

  if (event.key === "Escape") {
    event.preventDefault();
    cancel();
  } else if (event.key === "Enter" && !event.shiftKey) {
    // Shift+Enter is the way to get a line break; plain Enter finishes.
    event.preventDefault();
    commit();
  }
}

function onPaste(event: ClipboardEvent): void {
  if (!editing?.contains(event.target as Node)) return;
  // Plain text only: what is pasted here ends up in the committed override.
  event.preventDefault();
  const text = event.clipboardData?.getData("text/plain") ?? "";
  document.execCommand("insertText", false, text);
}

function arm(): void {
  armStyles();
  for (const [key, host] of hosts) host.el.dataset.edit = key;

  document.addEventListener("mousedown", onMouseDown, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("paste", onPaste, true);
  document.addEventListener("keyup", (event) => {
    if (event.key === "Alt") document.body.classList.remove("site-alt");
  });
  window.addEventListener("blur", () => {
    document.body.classList.remove("site-alt");
  });
  window.addEventListener("beforeunload", commit);

  toast("Editing on: click text, Alt+click a link, Alt to outline");
}

/**
 * Apply saved edits to the text under `root`, and hand the owner an editor for
 * it. Call once, after the page has rendered its markup.
 */
export async function mountEditor(root: HTMLElement): Promise<void> {
  const overrides = await overridesReady;
  const local = LOCAL_HOST.test(location.hostname);
  // Nothing to apply and nobody who could be granted an editor: a visitor to
  // an unedited page should not pay for the DOM walk or the session request.
  if (!local && !Object.keys(overrides).length) return;

  collect(root);
  applyOverrides(overrides);

  if (local && (await isOwner())) arm();
  // The originals are only held for the editor's benefit; let them go otherwise.
  else hosts.clear();
}
