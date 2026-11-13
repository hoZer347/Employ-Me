// Puts a game into an element: resolves where the build lives, drops in the
// iframe, and keeps the keyboard pointed at it. Used by the themed full-page
// loaders under /<slug>/.

import { buildGameUrl, resolveBuildSource, type Game } from "./games";

// Keys the games use. While the frame has focus we swallow the browser's
// default action for them (page scroll on Space, focus change on Tab) with
// preventDefault, not stopPropagation, so the game still receives the key.
const GAME_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "Space",
  "Escape",
  "Tab",
]);

function consumeKey(e: KeyboardEvent) {
  if (GAME_KEYS.has(e.code)) e.preventDefault();
}

export interface MountedFrame {
  iframe: HTMLIFrameElement;
  /** The URL the frame was pointed at, for a "open it directly" fallback. */
  url: string;
  /** The build version the frame was pointed at. */
  version: string;
  /** Resolves once the frame reports loaded. */
  loaded: Promise<void>;
}

/**
 * Append the game's iframe to `stage` (which must be a positioned box; the
 * iframe fills it). Returns the frame plus its load promise so the caller can
 * clear its own placeholder.
 */
export async function mountGameFrame(
  stage: HTMLElement,
  game: Game,
): Promise<MountedFrame> {
  const source = await resolveBuildSource(game);
  const url = buildGameUrl(source);

  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.title = game.title;
  iframe.className = "absolute inset-0 h-full w-full border-0";
  iframe.allow = "autoplay; fullscreen; gamepad";
  iframe.setAttribute("scrolling", "no");

  let resolveLoaded: () => void;
  const loaded = new Promise<void>((r) => (resolveLoaded = r));

  iframe.addEventListener("load", () => {
    // Hand keyboard focus to the game so WASD and the rest register inside it.
    iframe.focus();
    try {
      iframe.contentWindow?.focus();
      const doc = iframe.contentDocument;
      doc?.addEventListener("keydown", consumeKey, { capture: true });
      doc?.addEventListener("keyup", consumeKey, { capture: true });
    } catch {
      // Same-origin in practice; ignore anything the browser refuses.
    }
    resolveLoaded();
  });

  // Re-focus the game whenever the user clicks back into the stage.
  stage.addEventListener("pointerdown", () => iframe.focus());
  stage.appendChild(iframe);

  return {
    iframe,
    url,
    version: source.version,
    loaded,
  };
}
