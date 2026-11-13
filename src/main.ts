import "./style.css";
import { resume, resumeSectionHTML, downloadResumePdf } from "./resume";
import { withSiteEdits } from "./resume-edits";
import { gameCardHTML } from "./game-embed";
import { wireGalleries } from "./gallery";
import { draftLeagueSectionHTML } from "./draft-league";
import { JAM_GAMES, PERSONAL_PROJECTS } from "./games";
import { TOOLS, toolCardHTML } from "./tools";
import { DEMOS, DEMOS_BASE, ENGINE, SHADER_DEMOS } from "./engine";
import { mountEngineFrame } from "./engine-frame";
import { COLORS } from "./glsl";
import { attachShaderEditor } from "./shader-editor";
import { loadOverrides, mountEditor } from "./editable";

// The site is seven tabs over one page. The toolbar swaps which panel is shown
// and the hash records it, so a reload or a shared link lands on the same tab.
const TABS = [
  { id: "main", label: "Main" },
  // "Resume", never "Résumé": the accents are deliberately not used anywhere
  // in the site's copy. This has been reverted more than once, so if you find
  // an accented spelling here again it is a regression, not the intent.
  { id: "resume", label: "Resume" },
  { id: "engine", label: "Engine" },
  { id: "gamejams", label: "Game Jams" },
  { id: "projects", label: "Personal Projects" },
  { id: "tools", label: "Tools" },
  { id: "draftleague", label: "Draft League" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// Over each demo until it starts: a bar filled as its files come in, which
// pulses once they are in and the player is starting.
const FRAME_STATUS = `
  <div class="js-frame-status absolute inset-0 flex items-center justify-center">
    <div class="h-1.5 w-1/2 overflow-hidden rounded-full bg-slate-800">
      <div class="js-frame-progress h-full w-0 rounded-full bg-sky-400 transition-[width] duration-200"></div>
    </div>
  </div>`;

const app = document.querySelector<HTMLDivElement>("#app")!;
// Page column: the main area grows so the footer lands on the bottom edge of
// the viewport instead of below the fold.
app.className = "flex min-h-screen flex-col";

// Seven tabs no longer fit a row at the old size, and a toolbar that wraps
// pushes the page down by a line, so the row stays one row: tighter buttons,
// and a scroll rather than a second line on a screen too narrow for all seven.
const toolbarTabs = TABS.map(
  (tab) => `
    <button type="button" data-tab="${tab.id}"
      class="js-tab js-toolbar-tab shrink-0 cursor-pointer whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition hover:text-sky-300 active:scale-95">
      ${tab.label}
    </button>`,
).join("");

const panel = (id: TabId, body: string) => `
  <section id="panel-${id}" role="tabpanel" class="w-full">${body}</section>`;

app.innerHTML = `
  <canvas id="matrix" class="pointer-events-none fixed inset-0 -z-10 h-full w-full"></canvas>

  <header class="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-slate-950/85 backdrop-blur">
    <div class="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4">
      <nav aria-label="Sections" class="flex items-center gap-1 overflow-x-auto">
        ${toolbarTabs}
      </nav>
    </div>
  </header>

  <main class="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-6 pt-24 pb-16 text-slate-100">
    ${panel(
      "main",
      `
      <div class="flex w-full flex-col items-center justify-center">
        <div class="flex w-full max-w-xl flex-col items-center gap-6 rounded-2xl bg-slate-950/40 px-8 py-12 text-center ring-1 ring-white/10 backdrop-blur-xs">
          <h1 class="text-4xl font-bold tracking-tight sm:text-6xl">
            Liam <span class="text-sky-400">Brown</span>
          </h1>
          <figure>
            <span aria-hidden="true" class="block select-none font-serif text-5xl leading-none text-sky-400/25">&ldquo;</span>
            <!-- One block per clause, so each half of the aphorism starts its own line. -->
            <blockquote class="-mt-3 font-serif text-lg italic leading-relaxed text-slate-300 sm:text-xl">
              <span class="block">An idiot admires <span class="text-slate-400">complexity</span>,</span>
              <span class="block">a genius admires <span class="font-medium not-italic text-sky-300">simplicity</span>.</span>
            </blockquote>
            <figcaption class="mt-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Terry A. Davis
            </figcaption>
          </figure>

          <div class="flex flex-wrap items-center justify-center gap-3">
            <button type="button" data-tab="resume"
              class="js-tab cursor-pointer rounded-lg bg-sky-500 px-5 py-2.5 font-medium text-white transition hover:bg-sky-400 active:scale-95">
              View Resume
            </button>
          </div>
        </div>
      </div>`,
    )}

    ${panel(
      "resume",
      `
      <div class="space-y-6 rounded-2xl bg-slate-950/40 px-8 py-10 ring-1 ring-white/10 backdrop-blur-xs">
        ${resumeSectionHTML()}
      </div>`,
    )}

    ${panel(
      "gamejams",
      `
      <div class="space-y-8 rounded-2xl bg-slate-950/40 px-8 py-10 ring-1 ring-white/10 backdrop-blur-xs">
        <header class="space-y-2">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-sky-400">Game Jams</h2>
          <p class="text-slate-300">
            Games built to a deadline, usually a weekend, usually with a team.
            Each one is playable, on itch.io or right from here.
          </p>
        </header>
        ${JAM_GAMES.map(gameCardHTML).join('<hr class="border-white/10">')}
      </div>`,
    )}

    ${panel(
      "projects",
      `
      <div class="space-y-8 rounded-2xl bg-slate-950/40 px-8 py-10 ring-1 ring-white/10 backdrop-blur-xs">
        <header class="space-y-2">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-sky-400">Personal Projects</h2>
          <p class="text-slate-300">
            The bigger builds, worked on outside of jams.
          </p>
        </header>
        ${PERSONAL_PROJECTS.map(gameCardHTML).join('<hr class="border-white/10">')}
      </div>`,
    )}

    ${panel(
      "tools",
      `
      <div class="space-y-8 rounded-2xl bg-slate-950/40 px-8 py-10 ring-1 ring-white/10 backdrop-blur-xs">
        <header class="space-y-2">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-sky-400">hoZer's Utilities</h2>
          <p class="text-slate-300">
            The Unity toolkit I carry between projects. Every game here runs on
            some version of it.
          </p>
        </header>
        ${TOOLS.map(toolCardHTML).join('<hr class="border-white/10">')}
      </div>`,
    )}

    ${panel(
      "draftleague",
      `
      <div class="space-y-8 rounded-2xl bg-slate-950/40 px-8 py-10 ring-1 ring-white/10 backdrop-blur-xs">
        ${draftLeagueSectionHTML()}
      </div>`,
    )}
    ${panel(
      "engine",
      `
      <div class="relative left-1/2 w-[min(96rem,calc(100vw-2rem))] -translate-x-1/2 space-y-8 rounded-2xl bg-slate-950/40 px-8 py-10 ring-1 ring-white/10 backdrop-blur-xs">
        <header class="space-y-2">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-sky-400">${ENGINE.title}</h2>
          <p class="text-slate-300">${ENGINE.tagline}</p>
        </header>

        <ul class="grid gap-6 sm:grid-cols-2">
          ${DEMOS.map(
            (demo) => `
            <li class="space-y-2">
              <div id="demo-stage-${demo.slug}" class="relative aspect-[16/9] overflow-hidden rounded-xl bg-slate-950 ring-1 ring-white/10">
                ${FRAME_STATUS}
              </div>
              <p class="text-sm font-medium text-sky-400">${demo.title}</p>
              <p class="text-sm text-slate-400">${demo.tagline}</p>
            </li>`,
          ).join("")}
        </ul>

        <ul class="space-y-8">
          ${SHADER_DEMOS.map(
            (demo) => `
            <li class="grid items-start gap-4 lg:grid-cols-2">
              <div class="space-y-2 lg:sticky lg:top-24">
                <div id="demo-stage-${demo.slug}" class="relative aspect-[16/9] overflow-hidden rounded-xl bg-slate-950 ring-1 ring-white/10">
                  ${FRAME_STATUS}
                </div>
                <p class="text-sm font-medium text-sky-400">${demo.title}</p>
                <p class="text-sm text-slate-400">${demo.tagline}</p>
              </div>
              <div class="space-y-2">
                <div style="background:${COLORS.background}" class="relative rounded-xl font-mono text-sm leading-5 ring-1 ring-white/10 [tab-size:4] focus-within:ring-sky-400/60">
                  <pre id="shader-colors-${demo.slug}" aria-hidden="true" class="m-0 whitespace-pre-wrap break-words p-4 font-[inherit]" style="color:${COLORS.text}"></pre>
                  <textarea id="shader-code-${demo.slug}" aria-label="${demo.file}" spellcheck="false" autocomplete="off" class="absolute inset-0 block h-full w-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent p-4 font-[inherit] text-transparent caret-white selection:bg-sky-500/40 focus:outline-none"></textarea>
                </div>
                <p class="text-xs text-slate-500">${demo.file}</p>
                <p id="shader-error-${demo.slug}" class="whitespace-pre-wrap font-mono text-xs text-rose-400"></p>
              </div>
            </li>`,
          ).join("")}
        </ul>

        <ul class="flex flex-wrap gap-2">
          ${ENGINE.features
            .map(
              (feature) =>
                `<li class="rounded-full bg-slate-800/80 px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10">${feature}</li>`,
            )
            .join("")}
        </ul>
      </div>`,
    )}
  </main>


  <!-- Socials live here, at the foot of every tab; the toolbar above stays
       purely navigation. -->
  <footer class="relative z-10 border-t border-white/10 bg-slate-950/60 backdrop-blur">
    <div class="mx-auto flex w-full max-w-4xl flex-col items-center gap-3 px-6 py-8 sm:flex-row sm:justify-between">
      <p class="text-sm text-slate-500">&copy; ${new Date().getFullYear()} Liam Brown</p>
      <nav aria-label="Social links" class="flex items-center gap-4 text-slate-400">
        <a href="https://github.com/hoZer347" target="_blank" rel="noopener noreferrer"
          aria-label="GitHub" title="GitHub" class="transition hover:text-sky-400">
          <svg viewBox="0 0 24 24" fill="currentColor" class="size-5">
            <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.87.12 3.18.77.84 1.23 1.92 1.23 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22 0 1.61-.01 2.9-.01 3.29 0 .32.21.7.82.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z"/>
          </svg>
        </a>
        <a href="https://www.linkedin.com/in/liambrowndev/" target="_blank" rel="noopener noreferrer"
          aria-label="LinkedIn" title="LinkedIn" class="transition hover:text-sky-400">
          <svg viewBox="0 0 24 24" fill="currentColor" class="size-5">
            <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"/>
          </svg>
        </a>
        <a href="https://hozer347.itch.io/" target="_blank" rel="noopener noreferrer"
          aria-label="itch.io" title="itch.io" class="transition hover:text-sky-400">
          <svg viewBox="0 0 24 24" fill="currentColor" class="size-5">
            <path d="M3.13 1.338C2.08 1.96.02 4.328 0 4.95v1.03c0 1.303 1.22 2.45 2.325 2.45 1.33 0 2.436-1.102 2.436-2.41 0 1.308 1.07 2.41 2.4 2.41 1.328 0 2.362-1.102 2.362-2.41 0 1.308 1.137 2.41 2.466 2.41h.024c1.33 0 2.466-1.102 2.466-2.41 0 1.308 1.034 2.41 2.363 2.41 1.33 0 2.4-1.102 2.4-2.41 0 1.308 1.106 2.41 2.435 2.41C22.78 8.43 24 7.282 24 5.98V4.95c-.02-.62-2.082-2.99-3.13-3.612-3.253-.114-5.508-.134-8.87-.133-3.362 0-7.945.053-8.87.133zm6.376 6.477a2.74 2.74 0 0 1-.468.602c-.5.49-1.19.795-1.947.795a2.786 2.786 0 0 1-1.95-.795c-.182-.178-.32-.37-.446-.59-.127.222-.303.412-.486.59a2.788 2.788 0 0 1-1.95.795c-.092 0-.187-.025-.264-.052-.107 1.113-.152 2.176-.168 2.95v.005l-.006 1.167c.02 2.334-.23 7.564 1.03 8.85 1.952.454 5.545.662 9.15.663 3.605 0 7.198-.21 9.15-.664 1.26-1.284 1.01-6.514 1.03-8.848l-.006-1.167v-.004c-.016-.775-.06-1.838-.168-2.95-.077.026-.172.052-.263.052a2.788 2.788 0 0 1-1.95-.795c-.184-.178-.36-.368-.486-.59-.127.22-.265.412-.447.59a2.786 2.786 0 0 1-1.95.794c-.76 0-1.446-.303-1.948-.793a2.74 2.74 0 0 1-.468-.602 2.738 2.738 0 0 1-.463.602 2.787 2.787 0 0 1-1.95.794h-.16a2.787 2.787 0 0 1-1.95-.793 2.738 2.738 0 0 1-.464-.602zm-2.004 2.59v.002c.795.002 1.5 0 2.373.953.687-.072 1.406-.108 2.125-.107.72 0 1.438.035 2.125.107.873-.953 1.578-.95 2.372-.953.376 0 1.876 0 2.92 2.934l1.123 4.028c.832 2.995-.266 3.068-1.636 3.07-2.03-.075-3.156-1.55-3.156-3.025-1.124.184-2.436.276-3.748.277-1.312 0-2.624-.093-3.748-.277 0 1.475-1.125 2.95-3.156 3.026-1.37-.004-2.468-.077-1.636-3.072l1.122-4.027c1.045-2.934 2.545-2.934 2.92-2.934zM12 12.714c-.002.002-2.14 1.964-2.523 2.662l1.4-.056v1.22c0 .056.56.033 1.123.007.562.026 1.124.05 1.124-.008v-1.22l1.4.055C14.138 14.677 12 12.713 12 12.713z"/>
          </svg>
        </a>
        <button id="copy-email" type="button" aria-label="Copy email address" title="liam@browndomain.com"
          class="cursor-pointer transition hover:text-sky-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" class="size-5">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="m2 7 10 6 10-6"/>
          </svg>
        </button>
      </nav>
    </div>
  </footer>

  <div id="toast"
    class="pointer-events-none fixed bottom-5 left-1/2 -translate-x-1/2 translate-y-3 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 opacity-0 shadow-lg ring-1 ring-white/10 transition-all duration-200">
    Email copied!
  </div>
`;

// --- Framed builds ----------------------------------------------------------

// Each Loom demo runs a loop of its own, so none is loaded until the Engine tab
// is opened. Once loaded they stay: a hidden panel means their iframes'
// documents are not rendered, and a document that is not rendered is served no
// animation frames, so each loop idles by itself and picks up again when the
// tab comes back.
interface FramedBuild {
  loaded: Promise<void>;
}

/**
 * Loads the build into `#<stageId>` the first time its tab is shown, and
 * follows the tab from then on.
 */
function lazyFrame(
  stageId: string,
  mount: (stage: HTMLElement, progress: (fraction: number) => void) => Promise<FramedBuild>,
): (shown: boolean) => void {
  let started = false;

  return (shown) => {
    if (!shown || started) return;
    started = true;

    const stage = app.querySelector<HTMLDivElement>(`#${stageId}`)!;
    const status = stage.querySelector<HTMLDivElement>(".js-frame-status")!;
    const bar = status.querySelector<HTMLDivElement>(".js-frame-progress")!;
    const progress = (fraction: number) => {
      bar.style.width = `${fraction * 100}%`;
      bar.classList.toggle("animate-pulse", fraction >= 1);
    };

    void (async () => {
      const { loaded } = await mount(stage, progress);
      loaded.then(() => status.remove());

      // Safety net: if it hasn't come up after a while, say so.
      window.setTimeout(() => {
        if (!status.isConnected) return;
        status.innerHTML = `<p class="text-sm text-slate-300">Still starting up.</p>`;
      }, 30000);
    })();
  };
}

const DEMO_FRAMES = [
  ...DEMOS.map((demo) =>
    lazyFrame(`demo-stage-${demo.slug}`, (stage, progress) =>
      mountEngineFrame(stage, `${DEMOS_BASE}/${demo.slug}`, demo.title, progress),
    ),
  ),
  ...SHADER_DEMOS.map((demo) =>
    lazyFrame(`demo-stage-${demo.slug}`, async (stage, progress) => {
      const base = `${DEMOS_BASE}/${demo.slug}`;
      const mounted = await mountEngineFrame(stage, base, demo.title, progress);
      void attachShaderEditor(
        app.querySelector<HTMLTextAreaElement>(`#shader-code-${demo.slug}`)!,
        app.querySelector<HTMLElement>(`#shader-colors-${demo.slug}`)!,
        app.querySelector<HTMLElement>(`#shader-error-${demo.slug}`)!,
        mounted.iframe,
        base,
        demo.file,
      );
      return mounted;
    }),
  ),
];

const TAB_FRAMES: Partial<Record<TabId, (shown: boolean) => void>> = {
  engine: (shown) => DEMO_FRAMES.forEach((frame) => frame(shown)),
};

// --- Tabs ------------------------------------------------------------------

function isTabId(value: string): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

function tabFromHash(): TabId {
  const id = decodeURIComponent(location.hash.slice(1));
  return isTabId(id) ? id : "main";
}

let currentTab: TabId | null = null;

function showTab(id: TabId, { push = true } = {}) {
  if (currentTab === id) return;
  currentTab = id;

  for (const tab of TABS) {
    const on = tab.id === id;
    app.querySelector<HTMLElement>(`#panel-${tab.id}`)!.hidden = !on;

    const btn = app.querySelector<HTMLButtonElement>(
      `.js-toolbar-tab[data-tab="${tab.id}"]`,
    )!;
    btn.setAttribute("aria-current", on ? "page" : "false");
    btn.classList.toggle("bg-sky-500/10", on);
    btn.classList.toggle("text-sky-300", on);
    btn.classList.toggle("text-slate-400", !on);

    TAB_FRAMES[tab.id]?.(on);
  }

  if (push && tabFromHash() !== id) history.pushState(null, "", `#${id}`);
  window.scrollTo({ top: 0 });
}

app.querySelectorAll<HTMLButtonElement>(".js-tab").forEach((btn) =>
  btn.addEventListener("click", () => {
    const id = btn.dataset.tab;
    if (id && isTabId(id)) showTab(id);
  }),
);

// Back / forward, and a hand-edited hash, both land on the right tab.
window.addEventListener("popstate", () =>
  showTab(tabFromHash(), { push: false }),
);
window.addEventListener("hashchange", () =>
  showTab(tabFromHash(), { push: false }),
);
showTab(tabFromHash(), { push: false });

wireGalleries(app);

// Saved text edits for everyone, and the editor itself for the host.
void mountEditor(app);

// Both the top and bottom resume Download buttons share this class. The PDF is
// laid out from the data, not the page, so it takes the saved edits itself.
app
  .querySelectorAll<HTMLButtonElement>(".js-download-resume")
  .forEach((btn) =>
    btn.addEventListener("click", async () => downloadResumePdf(withSiteEdits(resume, await loadOverrides()))),
  );

const EMAIL = "liam@browndomain.com";
const toast = app.querySelector<HTMLDivElement>("#toast")!;
const copyEmail = app.querySelector<HTMLButtonElement>("#copy-email")!;
let toastTimer: number | undefined;

function showToast(message: string) {
  toast.textContent = message;
  toast.classList.remove("opacity-0", "translate-y-3");
  toast.classList.add("opacity-100", "translate-y-0");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-3");
    toast.classList.remove("opacity-100", "translate-y-0");
  }, 2000);
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts / older browsers
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

copyEmail.addEventListener("click", async () => {
  const ok = await copyToClipboard(EMAIL);
  showToast(ok ? "Email copied!" : EMAIL);
});

// --- Matrix-style digital rain (blue scheme: gray glyphs on blue-black) ---
const canvas = app.querySelector<HTMLCanvasElement>("#matrix")!;
const ctx = canvas.getContext("2d")!;
const GLYPHS =
  "アァカサタナハマヤャラワガザダバパ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const FONT_SIZE = 16;
const TRAIL = 22; // glyphs drawn behind each head, fading out
const TRAIL_GAP = FONT_SIZE; // spacing between trail glyphs (keeps trails long when slow)
const BASE_VY = 1.0; // base fall speed in px/frame — gentle, like the original

type TrailPoint = { x: number; y: number; c: string };
interface Particle {
  x: number;
  y: number;
  vy: number;
  trail: TrailPoint[];
  // The trail drawn once each time it gains a glyph, with its top's y.
  strip: HTMLCanvasElement;
  stripTop: number;
}

const TRAIL_COLOR = "rgb(100, 116, 139)";
const HEAD_COLOR = "#7dd3fc";
const TRAIL_ALPHA = 0.8;

// Each glyph is drawn once in each colour, and each trail once as it grows, so
// a frame copies a strip and a head per particle: drawing every glyph of every
// trail each frame held the page's main thread.
const GLYPH_HEIGHT = Math.ceil(FONT_SIZE * 1.5);
const GLYPH_BASELINE = Math.ceil(FONT_SIZE * 1.2);

interface Sprite {
  x: number;
  width: number;
}

interface Atlas {
  image: HTMLCanvasElement;
  sprites: Map<string, Sprite>;
}

function glyphAtlas(color: string): Atlas {
  const image = document.createElement("canvas");
  const pen = image.getContext("2d")!;
  pen.font = `${FONT_SIZE}px monospace`;
  const sprites = new Map<string, Sprite>();
  let x = 0;
  for (const glyph of GLYPHS) {
    const width = Math.ceil(pen.measureText(glyph).width);
    sprites.set(glyph, { x, width });
    x += width;
  }
  image.width = x;
  image.height = GLYPH_HEIGHT;
  pen.font = `${FONT_SIZE}px monospace`;
  pen.fillStyle = color;
  for (const [glyph, sprite] of sprites) pen.fillText(glyph, sprite.x, GLYPH_BASELINE);
  return { image, sprites };
}

const trailGlyphs = glyphAtlas(TRAIL_COLOR);
const headGlyphs = glyphAtlas(HEAD_COLOR);
const STRIP_WIDTH = Math.max(...[...trailGlyphs.sprites.values()].map((sprite) => sprite.width));

/** Draws `glyph` from `atlas` into `pen` with its baseline's left end at x, y. */
function drawGlyph(pen: CanvasRenderingContext2D, atlas: Atlas, glyph: string, x: number, y: number) {
  const sprite = atlas.sprites.get(glyph)!;
  pen.drawImage(
    atlas.image, sprite.x, 0, sprite.width, GLYPH_HEIGHT,
    Math.round(x), Math.round(y) - GLYPH_BASELINE, sprite.width, GLYPH_HEIGHT,
  );
}

// Fading gray-blue tail, oldest dimmest.
function paintTrail(p: Particle) {
  const top = Math.round(p.trail[0].y) - GLYPH_BASELINE;
  const height = Math.round(p.trail[p.trail.length - 1].y) - GLYPH_BASELINE - top + GLYPH_HEIGHT;
  if (p.strip.height < height) p.strip.height = height;
  const pen = p.strip.getContext("2d")!;
  pen.clearRect(0, 0, p.strip.width, p.strip.height);
  p.trail.forEach((pt, k) => {
    pen.globalAlpha = ((k + 1) / (TRAIL + 1)) * TRAIL_ALPHA;
    drawGlyph(pen, trailGlyphs, pt.c, 0, pt.y - top);
  });
  p.stripTop = top;
}

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

let particles: Particle[] = [];

function randomFallSpeed() {
  return BASE_VY * (0.7 + Math.random() * 0.8);
}

// Send a particle back to the top. `seed` spreads them over the whole height
// on first fill so the screen isn't empty at the start.
function respawn(p: Particle, seed = false) {
  p.x = Math.random() * canvas.width;
  p.y = seed ? Math.random() * canvas.height : -Math.random() * 200 - FONT_SIZE;
  p.vy = randomFallSpeed();
  p.trail = [];
}

function resizeMatrix() {
  // Its own box, not window.innerWidth: the scrollbar gutter is outside the
  // canvas, so innerWidth would give a backing store wider than the element,
  // scaled down to fit it, and the glyphs would come out narrow.
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  const count = Math.floor(canvas.width / 12);
  particles = Array.from({ length: count }, () => {
    const strip = document.createElement("canvas");
    strip.width = STRIP_WIDTH;
    const p: Particle = { x: 0, y: 0, vy: 0, trail: [], strip, stripTop: 0 };
    respawn(p, true);
    return p;
  });
}

function drawMatrix() {
  // Fully transparent layer so the page background shows between glyphs.
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const p of particles) {
    p.y += p.vy; // straight-down fall, behind the content

    if (p.y > canvas.height + FONT_SIZE) respawn(p);

    // Lay down a trail glyph only once the head has travelled a full gap,
    // so the trail stays long and evenly spaced regardless of fall speed.
    const lastPt = p.trail[p.trail.length - 1];
    if (!lastPt || Math.hypot(p.x - lastPt.x, p.y - lastPt.y) >= TRAIL_GAP) {
      p.trail.push({ x: p.x, y: p.y, c: randomGlyph() });
      if (p.trail.length > TRAIL) p.trail.shift();
      paintTrail(p);
    }

    ctx.drawImage(p.strip, Math.round(p.x), p.stripTop);
    // A bright sky-blue head drawn on top at the live position.
    drawGlyph(ctx, headGlyphs, randomGlyph(), p.x, p.y);
  }
}

// Watching the canvas rather than the window: on a browser without
// scrollbar-gutter the scrollbar still comes and goes as tabs are switched,
// resizing the canvas with no resize event to hear.
new ResizeObserver(resizeMatrix).observe(canvas);
const loop = () => {
  requestAnimationFrame(loop);
  drawMatrix();
};
requestAnimationFrame(loop);
