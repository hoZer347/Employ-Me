// The themed full-page loader behind /<slug>/: a thin header with a way back to
// the portfolio, and the game filling everything below it. One implementation
// for every game; the per-game entry modules just name their slug.

import "./style.css";
import { gameBySlug } from "./games";
import { mountGameFrame } from "./game-frame";
import { mountEditor } from "./editable";

export function mountGamePage(slug: string): void {
  const game = gameBySlug(slug);
  const root = document.querySelector<HTMLDivElement>(`#${slug}`);
  if (!root) throw new Error(`Missing mount point #${slug}`);

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
          ${game.title} <span id="g-version" class="text-slate-500"></span>
        </span>
      </header>

      <!-- Full-bleed stage: the game fills everything below the header. -->
      <div id="g-stage" class="relative flex-1">
        <div id="g-status" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-400">
          <div class="size-8 animate-spin rounded-full border-2 border-slate-700 border-t-sky-400"></div>
          <p>Loading ${game.title}…</p>
        </div>
      </div>
    </div>
  `;

  void mountEditor(root);

  const versionLabel = root.querySelector<HTMLSpanElement>("#g-version")!;
  const stage = root.querySelector<HTMLDivElement>("#g-stage")!;
  const status = root.querySelector<HTMLDivElement>("#g-status")!;

  void (async () => {
    const { url, version, loaded } = await mountGameFrame(stage, game);
    versionLabel.textContent = `v${version}`;
    loaded.then(() => status.remove());

    // Safety net: if the frame hasn't loaded after a while, offer a direct link.
    window.setTimeout(() => {
      if (!status.isConnected) return;
      status.innerHTML = `
        <p class="text-slate-300">Still loading, the host may be slow or unavailable.</p>
        <a href="${url}" class="text-sky-400 underline underline-offset-2 hover:text-sky-300">
          Open the game directly
        </a>`;
    }, 30000);
  })();
}
