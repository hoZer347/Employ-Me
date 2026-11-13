import "./style.css";
import { resume } from "./resume";
import {
  GROUPS,
  PIPELINE,
  REWRITES,
  RULES,
  SOURCES,
  type Keyword,
} from "./keyword-data";

// A private working page at /keywords/: what AI resume screeners index in 2026,
// scored against the actual resume data in resume.ts. Coverage is computed at
// runtime, so editing the resume re-scores this page on the next reload.

const root = document.querySelector<HTMLDivElement>("#keywords")!;

// --- Coverage --------------------------------------------------------------

// The whole resume as one lowercase blob. Serializing the object is enough:
// every string field ends up in it, which is exactly what a parser would see.
const CORPUS = JSON.stringify(resume).toLowerCase();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Does this exact spelling appear in the resume?
 *  Boundaries exclude `+` and `#` so "C" does not match "C++" or "C#", and
 *  runs of space, hyphen, and slash are treated as interchangeable so
 *  "TCP / UDP" still matches "TCP" and "client server" matches
 *  "client-server". */
function appears(term: string): boolean {
  const flexible = escapeRe(term.toLowerCase()).replace(
    /(\\?[\s\-/])+/g,
    "[\\s\\-/]+",
  );
  // A trailing plural still counts, so "rendering pipelines" matches
  // "rendering pipeline". Skipped on very short terms, where an accidental
  // "Cs" or "STLs" would be a false positive rather than a real match.
  const plural = term.length >= 4 ? "s?" : "";
  return new RegExp(
    `(^|[^a-z0-9+#])${flexible}${plural}([^a-z0-9+#]|$)`,
  ).test(CORPUS);
}

/** A term counts as covered if the canonical spelling or any alias appears. */
function covered(kw: Keyword): boolean {
  return [kw.term, ...(kw.aliases ?? [])].some(appears);
}

type Status = "covered" | "add" | "stretch";

function statusOf(kw: Keyword): Status {
  if (covered(kw)) return "covered";
  return kw.stretch ? "stretch" : "add";
}

const ALL = GROUPS.flatMap((g) => g.keywords);
const COVERED = ALL.filter((k) => statusOf(k) === "covered");
const TO_ADD = ALL.filter((k) => statusOf(k) === "add");
const STRETCH = ALL.filter((k) => statusOf(k) === "stretch");

// The shortlist: missing, no new skill required, and heavily weighted. These
// are the terms that cost him nothing but a rewrite.
const QUICK_WINS = TO_ADD.filter((k) => k.weight === "core").concat(
  TO_ADD.filter((k) => k.weight === "strong"),
);

// --- Rendering helpers -----------------------------------------------------

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const STATUS_STYLE: Record<Status, string> = {
  covered: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/30",
  add: "bg-sky-500/10 text-sky-300 ring-sky-400/40",
  stretch: "bg-amber-500/10 text-amber-300 ring-amber-400/30",
};

const STATUS_LABEL: Record<Status, string> = {
  covered: "already on the resume",
  add: "missing, add it",
  stretch: "missing, needs backing up",
};

const WEIGHT_DOT: Record<Keyword["weight"], string> = {
  core: "bg-current",
  strong: "bg-current opacity-60",
  adjacent: "bg-current opacity-25",
};

function chipHTML(kw: Keyword): string {
  const status = statusOf(kw);
  return `
    <button type="button" class="js-chip group relative cursor-pointer rounded-full px-3 py-1 text-sm ring-1 transition hover:brightness-125 active:scale-95 ${STATUS_STYLE[status]}"
      data-term="${esc(kw.term)}" data-status="${status}" data-weight="${kw.weight}"
      data-search="${esc((kw.term + " " + (kw.aliases ?? []).join(" ") + " " + kw.note).toLowerCase())}"
      aria-label="${esc(kw.term)}, ${STATUS_LABEL[status]}, ${kw.weight} weight. Click to copy.">
      <span class="mr-1.5 inline-block size-1.5 rounded-full align-middle ${WEIGHT_DOT[kw.weight]}"></span>${esc(kw.term)}
      <span class="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-left text-xs font-normal leading-relaxed text-slate-300 ring-1 ring-white/15 group-hover:block">
        <span class="block font-medium text-slate-100">${esc(kw.term)}</span>
        <span class="mt-0.5 block">${esc(kw.note)}</span>
        ${kw.aliases?.length ? `<span class="mt-1 block text-slate-500">Also: ${esc(kw.aliases.join(", "))}</span>` : ""}
      </span>
    </button>`;
}

const card = (body: string, extra = "") =>
  `<div class="rounded-2xl bg-slate-950/50 p-6 ring-1 ring-white/10 backdrop-blur-xs ${extra}">${body}</div>`;

const sectionHeading = (kicker: string, title: string, blurb: string) => `
  <header class="space-y-2">
    <p class="text-xs font-semibold uppercase tracking-widest text-sky-400">${kicker}</p>
    <h2 class="text-2xl font-bold tracking-tight text-slate-100">${title}</h2>
    <p class="max-w-3xl text-slate-400">${blurb}</p>
  </header>`;

// --- Page ------------------------------------------------------------------

const pct = Math.round((COVERED.length / ALL.length) * 100);

const statTile = (value: string, label: string, tone: string) => `
  <div class="rounded-xl bg-slate-950/60 p-4 ring-1 ring-white/10">
    <p class="text-3xl font-bold ${tone}">${value}</p>
    <p class="mt-1 text-xs leading-snug text-slate-400">${label}</p>
  </div>`;

const groupsHTML = GROUPS.map((group) => {
  const chips = group.keywords.map(chipHTML).join("");
  const hits = group.keywords.filter((k) => statusOf(k) === "covered").length;
  return `
    <div class="js-group space-y-3 border-t border-white/10 pt-6 first:border-0 first:pt-0">
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 class="text-lg font-semibold text-slate-100">${group.name}</h3>
        <span class="js-group-count text-xs text-slate-500">${hits} of ${group.keywords.length} covered</span>
      </div>
      <p class="max-w-3xl text-sm text-slate-400">${group.blurb}</p>
      <div class="js-chips flex flex-wrap gap-2 pt-1">${chips}</div>
      <p class="js-empty hidden text-sm text-slate-600">Nothing in this group matches the filter.</p>
    </div>`;
}).join("");

const rewritesHTML = REWRITES.map(
  (r) => `
  <div class="js-rewrite space-y-3 border-t border-white/10 pt-6 first:border-0 first:pt-0">
    <p class="text-xs font-semibold uppercase tracking-widest text-slate-500">${esc(r.context)}</p>
    <div class="grid gap-3 md:grid-cols-2">
      <div class="rounded-xl bg-slate-900/60 p-4 ring-1 ring-white/5">
        <p class="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">On the resume now</p>
        <p class="text-sm leading-relaxed text-slate-400">${esc(r.before)}</p>
      </div>
      <div class="rounded-xl bg-sky-500/5 p-4 ring-1 ring-sky-400/20">
        <p class="mb-2 text-xs font-medium uppercase tracking-wider text-sky-400">Screener-facing rewrite</p>
        <p class="js-after text-sm leading-relaxed text-slate-200">${esc(r.after)}</p>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="js-copy-after cursor-pointer rounded-lg px-3 py-1 text-xs font-medium text-sky-300 ring-1 ring-sky-400/40 transition hover:bg-sky-500/10 active:scale-95">Copy rewrite</button>
      ${r.adds
        .map(
          (a) =>
            `<span class="rounded-full bg-slate-800/80 px-2 py-0.5 text-xs text-slate-400">${esc(a)}</span>`,
        )
        .join("")}
    </div>
  </div>`,
).join("");

const rulesHTML = (want: boolean) =>
  RULES.filter((r) => r.do === want)
    .map(
      (r) => `
      <li class="flex gap-3">
        <span class="mt-0.5 shrink-0 ${want ? "text-emerald-400" : "text-rose-400"}">${want ? "✓" : "✕"}</span>
        <span>
          <span class="font-medium text-slate-100">${esc(r.title)}.</span>
          <span class="text-slate-400"> ${esc(r.body)}</span>
        </span>
      </li>`,
    )
    .join("");

root.innerHTML = `
  <header class="sticky top-0 z-30 border-b border-white/10 bg-slate-950/90 backdrop-blur">
    <div class="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
      <div class="flex items-baseline gap-3">
        <span class="font-semibold text-slate-100">Screener <span class="text-sky-400">Keywords</span></span>
        <span class="text-xs text-slate-500">researched Sept 2026</span>
      </div>
      <a href="/" class="rounded-lg px-3 py-1.5 text-sm font-medium text-sky-300 ring-1 ring-sky-400/40 transition hover:bg-sky-500/10">Back to portfolio</a>
    </div>
  </header>

  <main class="mx-auto w-full max-w-5xl space-y-10 px-6 py-10 text-slate-100">

    <section class="space-y-6">
      <div class="space-y-3">
        <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">What the hiring machines are reading for</h1>
        <p class="max-w-3xl text-slate-400">
          Roughly 97 percent of tech employers run resumes through an ATS first, and a growing share
          bolt a language model onto the end of it to summarize and rank what survives. This page is the
          keyword surface those systems index, narrowed to the roles you actually want: graphics and
          rendering, C++ systems, and algorithms. Coverage below is computed live against your
          <a href="/#resume" class="text-sky-400 underline underline-offset-2 hover:text-sky-300">resume data</a>,
          so it changes when the resume does.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        ${statTile(`${COVERED.length}<span class="text-xl text-slate-600">/${ALL.length}</span>`, `terms already on the resume, ${pct} percent of the bank`, "text-emerald-400")}
        ${statTile(String(QUICK_WINS.length), "high-weight terms missing that need no new skill, only a rewrite", "text-sky-400")}
        ${statTile(String(STRETCH.length), "terms that need something built or learned first", "text-amber-400")}
        ${statTile("25 to 35", "unique keywords is the target band, over 40 reads as stuffing", "text-slate-200")}
      </div>
    </section>

    ${card(`
      ${sectionHeading("Pipeline", "How the screen actually runs", "Four stages, and each one fails differently. Most rejections happen in the first two, before anything resembling judgment is applied.")}
      <div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        ${PIPELINE.map(
          (p) => `
          <div class="rounded-xl bg-slate-900/50 p-4 ring-1 ring-white/5">
            <p class="text-xs font-semibold text-sky-400">Stage ${p.step}</p>
            <p class="mt-1 font-semibold text-slate-100">${p.title}</p>
            <p class="mt-2 text-sm leading-relaxed text-slate-400">${p.body}</p>
          </div>`,
        ).join("")}
      </div>`)}

    ${card(`
      ${sectionHeading("Shortlist", "Add these first", "Missing, heavily weighted, and already true of you. Every one of these is a wording change rather than a new skill, which makes this the cheapest ranking you will ever buy.")}
      <div class="mt-5 flex flex-wrap gap-2">
        ${QUICK_WINS.map(chipHTML).join("")}
      </div>
      <div class="mt-5 flex flex-wrap items-center gap-3">
        <button id="copy-wins" type="button" class="cursor-pointer rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400 active:scale-95">Copy all ${QUICK_WINS.length}</button>
        <p class="text-sm text-slate-500">Hover any term for why it matters. Click it to copy it on its own.</p>
      </div>`)}

    ${card(`
      ${sectionHeading("Keyword bank", "Every term, scored against your resume", "Green is already covered, blue is missing and free to add, amber is missing and would need a project or a real claim behind it. The dot size marks how hard postings lean on the term.")}
      <div class="mt-5 flex flex-wrap items-center gap-3">
        <input id="search" type="search" placeholder="Filter terms, aliases, and notes"
          class="min-w-56 flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 ring-1 ring-white/10 outline-none focus:ring-sky-400/50" />
        <div class="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
          ${[
            ["all", "All"],
            ["covered", "Covered"],
            ["add", "Add now"],
            ["stretch", "Stretch"],
          ]
            .map(
              ([id, label]) =>
                `<button type="button" data-filter="${id}" class="js-filter cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-slate-400 transition hover:text-sky-300 active:scale-95">${label}</button>`,
            )
            .join("")}
        </div>
      </div>
      <div class="mt-6 space-y-6">${groupsHTML}</div>`)}

    ${card(`
      ${sectionHeading("Rewrite lab", "Your lines, in the shape screeners score", "Same facts, restructured as action verb plus keyword in context plus measured result. Bracketed values are yours to fill in, and inventing numbers is the one thing here that can actually cost you an offer.")}
      <div class="mt-5 space-y-6">${rewritesHTML}</div>`)}

    ${card(`
      ${sectionHeading("Rules", "What helps, and what gets you flagged", "The tactics that survived contact with 2026 screening, and the ones that now backfire.")}
      <div class="mt-5 grid gap-8 md:grid-cols-2">
        <ul class="space-y-4 text-sm">${rulesHTML(true)}</ul>
        <ul class="space-y-4 text-sm">${rulesHTML(false)}</ul>
      </div>`)}

    ${card(`
      ${sectionHeading("Sources", "Where this came from", "Screening guides, ATS vendor writeups, published research, and live 2026 job postings, read Sept 2026.")}
      <ul class="mt-5 grid gap-2 text-sm sm:grid-cols-2">
        ${SOURCES.map(
          (s) =>
            `<li><a href="${s.url}" target="_blank" rel="noopener noreferrer" class="text-slate-400 underline decoration-slate-700 underline-offset-2 transition hover:text-sky-300 hover:decoration-sky-400">${esc(s.label)}</a></li>`,
        ).join("")}
      </ul>`)}
  </main>

  <div id="toast" class="pointer-events-none fixed bottom-5 left-1/2 z-40 -translate-x-1/2 translate-y-3 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 opacity-0 shadow-lg ring-1 ring-white/10 transition-all duration-200">
    Copied
  </div>
`;

// --- Interaction -----------------------------------------------------------

const toast = root.querySelector<HTMLDivElement>("#toast")!;
let toastTimer: number | undefined;

function showToast(message: string) {
  toast.textContent = message;
  toast.classList.remove("opacity-0", "translate-y-3");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-3");
  }, 1600);
}

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(label);
  } catch {
    showToast("Copy blocked by the browser");
  }
}

root.querySelectorAll<HTMLButtonElement>(".js-chip").forEach((chip) =>
  chip.addEventListener("click", () =>
    copy(chip.dataset.term!, `Copied "${chip.dataset.term}"`),
  ),
);

root.querySelector<HTMLButtonElement>("#copy-wins")!.addEventListener(
  "click",
  () =>
    copy(
      QUICK_WINS.map((k) => k.term).join(", "),
      `Copied ${QUICK_WINS.length} terms`,
    ),
);

root.querySelectorAll<HTMLButtonElement>(".js-copy-after").forEach((btn) =>
  btn.addEventListener("click", () => {
    const text =
      btn.closest(".js-rewrite")!.querySelector<HTMLElement>(".js-after")!
        .textContent ?? "";
    copy(text.trim(), "Rewrite copied");
  }),
);

// Filtering: the search box and the status buttons both narrow the same set of
// chips, and a group whose chips all fall out shows a placeholder instead.
let statusFilter = "all";
let query = "";

const filterButtons =
  root.querySelectorAll<HTMLButtonElement>(".js-filter");

function applyFilter() {
  for (const btn of filterButtons) {
    const on = btn.dataset.filter === statusFilter;
    btn.classList.toggle("bg-sky-500/10", on);
    btn.classList.toggle("text-sky-300", on);
    btn.classList.toggle("text-slate-400", !on);
  }

  for (const group of root.querySelectorAll<HTMLElement>(".js-group")) {
    let shown = 0;
    for (const chip of group.querySelectorAll<HTMLElement>(".js-chip")) {
      const ok =
        (statusFilter === "all" || chip.dataset.status === statusFilter) &&
        (query === "" || chip.dataset.search!.includes(query));
      chip.hidden = !ok;
      if (ok) shown++;
    }
    group.querySelector<HTMLElement>(".js-empty")!.hidden = shown > 0;
  }
}

filterButtons.forEach((btn) =>
  btn.addEventListener("click", () => {
    statusFilter = btn.dataset.filter!;
    applyFilter();
  }),
);

root.querySelector<HTMLInputElement>("#search")!.addEventListener("input", (e) => {
  query = (e.target as HTMLInputElement).value.trim().toLowerCase();
  applyFilter();
});

applyFilter();
