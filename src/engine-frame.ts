// Puts the Loom scene into an element.
//
// It goes in an iframe rather than straight onto the page, for two reasons the
// games do not have: the engine hard-codes the "#canvas" selector and installs
// its own window-level resize and mouse handlers, both of which would collide
// with the portfolio's own; and a hidden iframe's document is not rendered, so
// the browser stops serving it animation frames and the engine's main loop
// idles whenever the Engine tab is not the one on screen.

import { BUILD_FILES, prefetch, shared } from "./demo-loading";
import { ENGINE_BASE, resolveEngineSource } from "./engine";

/** How often to look again for a player that is still starting. */
const STARTED_POLL_MS = 100;

interface PlayerWindow extends Window {
  Module?: { initialized?: boolean };
}

/** Fetches the player every demo shares, once, for all their bars. */
const fetchPlayer = shared(async (progress) => {
  const { sizes } = await resolveEngineSource(ENGINE_BASE);
  await prefetch(BUILD_FILES.map((file) => ({ url: `${ENGINE_BASE}/${file}`, size: sizes[file] })), progress);
});

export interface MountedEngine {
  iframe: HTMLIFrameElement;
  /** Resolves once the player in the frame has started. */
  loaded: Promise<void>;
}

/**
 * Append the engine's iframe to `stage` (which must be a positioned box; the
 * iframe fills it), running the build at `base`, once the player is fetched
 * with `progress` told how far along that is. The frame is inert, so the demo
 * takes no input or focus. Returns the frame and its load promise, so the
 * caller can reach the player and clear its own placeholder.
 */
export async function mountEngineFrame(
  stage: HTMLElement,
  base: string,
  title: string,
  progress: (fraction: number) => void,
): Promise<MountedEngine> {
  const [{ url }] = await Promise.all([resolveEngineSource(base), fetchPlayer(progress)]);

  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.title = `${title} engine scene`;
  iframe.className = "absolute inset-0 h-full w-full border-0";
  iframe.setAttribute("scrolling", "no");
  iframe.inert = true;

  const loaded = new Promise<void>((resolve) => {
    const poll = () => {
      if ((iframe.contentWindow as PlayerWindow | null)?.Module?.initialized) resolve();
      else window.setTimeout(poll, STARTED_POLL_MS);
    };
    poll();
  });

  stage.appendChild(iframe);

  return { iframe, loaded };
}
