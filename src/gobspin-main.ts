import "./style.css";
import { resolveGobspinSource, gobspinGameUrl } from "./gobspin";

const root = document.querySelector<HTMLDivElement>("#gobspin")!;

root.innerHTML = `
  <div class="flex min-h-screen flex-col bg-slate-950 text-slate-100">
    <header class="flex items-center justify-between gap-4 px-4 py-3">
      <a href="/" class="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-sky-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" class="size-4">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        Back to portfolio
      </a>
      <span class="text-sm font-medium">
        Gobspin <span id="v-version" class="text-slate-500"></span>
      </span>
    </header>

    <!-- Full-bleed stage: the game fills everything below the header. -->
    <div id="v-stage" class="relative flex-1">
      <div id="v-status" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-400">
        <div class="size-8 animate-spin rounded-full border-2 border-slate-700 border-t-sky-400"></div>
        <p>Loading Gobspin…</p>
      </div>
    </div>
  </div>
`;

const versionLabel = root.querySelector<HTMLSpanElement>("#v-version")!;
const stage = root.querySelector<HTMLDivElement>("#v-stage")!;
const status = root.querySelector<HTMLDivElement>("#v-status")!;

async function boot() {
  const source = await resolveGobspinSource();
  const url = gobspinGameUrl(source);
  versionLabel.textContent = `v${source.version}`;

  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.title = "Gobspin";
  iframe.className = "absolute inset-0 h-full w-full border-0";
  iframe.allow = "autoplay; fullscreen; gamepad";
  iframe.setAttribute("scrolling", "no");
  // Keys the game uses — swallow the browser's default action for them while
  // focused (page scroll on Space, focus change on Tab, the typing "click").
  // preventDefault (not stopPropagation) so the game still receives them.
  const GAME_KEYS = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "Space",
    "Escape",
    "Tab",
  ]);
  const consumeKey = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
  };

  iframe.addEventListener("load", () => {
    status.remove();
    // Hand keyboard focus to the game so WASD/keys register in the iframe.
    iframe.focus();
    try {
      iframe.contentWindow?.focus();
      const doc = iframe.contentDocument;
      doc?.addEventListener("keydown", consumeKey, { capture: true });
      doc?.addEventListener("keyup", consumeKey, { capture: true });
    } catch {
      /* cross-origin (prod): add the same handler in the Unity template */
    }
  });
  // Re-focus the game whenever the user clicks into the stage.
  stage.addEventListener("pointerdown", () => iframe.focus());
  stage.appendChild(iframe);

  // Safety net: if the frame hasn't loaded after a while, offer a direct link.
  window.setTimeout(() => {
    if (root.contains(status)) {
      status.innerHTML = `
        <p class="text-slate-300">Still loading, the host may be slow or unavailable.</p>
        <a href="${url}" class="text-sky-400 underline underline-offset-2 hover:text-sky-300">
          Open the demo directly
        </a>`;
    }
  }, 30000);
}

boot();
