// Loom, described once for the Engine tab in main.ts.
//
// Loom is not a game: it is the C++ engine itself. The tab runs its demo
// projects, which build-loom.sh builds for the web with the engine's own Play
// Web pipeline. Everything else here mirrors how games.ts resolves a build,
// because the serving arrangement is the same: a same-origin folder per demo
// under DEMOS_BASE that Vite streams in dev and copies into dist for prod.

export const ENGINE = {
  slug: "engine",
  title: "Loom",
  tagline:
    "A game engine and editor written from scratch in C++. OpenGL on desktop, WebGL in the browser.",
  features: [
    "Entity-Component System",
    "State machine per object",
    "Per-object threading",
    "Shadow-mapped lighting",
    "Rigidbody physics",
    "Raycasts",
    "UI",
    "Editor",
  ],
  /**
   * Offline fallback for the build version. The build's own version.json wins
   * whenever it is reachable; this only shows if it is not.
   */
  version: "2026-09-01 06:44",
} as const;

/**
 * Loom's own demo projects, which build-loom.sh builds from the engine's Demo
 * Sources, each into a folder of its own served at DEMOS_BASE/<slug>.
 */
export const DEMOS = [
  {
    slug: "physics",
    title: "Physics",
    tagline: "Rigidbodies fall, bounce and pile up on box, sphere and mesh colliders.",
  },
  {
    slug: "raycasts",
    title: "Raycasts",
    tagline: "A turning laser stops at the first collider it hits and draws the surface normal there.",
  },
] as const;

/**
 * Demos of the three kinds of shader Loom compiles, each built like the ones
 * above. The page shows the file at `file` beside each, and recompiles it in
 * the running demo as it is edited.
 */
export const SHADER_DEMOS = [
  {
    slug: "shader-time",
    title: "Vertex and fragment shader",
    tagline: "Each cube takes a hue from its seed and pulses on the game clock.",
    file: "Assets/Pulse.shader",
  },
  {
    slug: "pre-vertex",
    title: "Pre-vertex shader",
    tagline: "Every vertex rolls on a wave before the shader's own vertex stage runs.",
    file: "Assets/Wave.loomprevertex",
  },
  {
    slug: "pixel-pass",
    title: "Pixel shader",
    tagline: "A pass over the finished view inks the edges and softens the distance.",
    file: "Assets/Inked.loompixel",
  },
] as const;

/** Same-origin path the Vite middleware (dev) and the bundler (prod) serve the demos at. */
export const DEMOS_BASE = "/engine-build/demos";

/** Where every demo's page loads the one player from, as build-loom.sh builds it. */
export const ENGINE_BASE = `${DEMOS_BASE}/engine`;

export interface EngineSource {
  url: string;
  /** The size of each file at the top of the build, by name, where known. */
  sizes: Record<string, number>;
}

/**
 * Ask the build's version.json what it is, so the framed URL's `?v=` busts the
 * cache on every rebuild. Falls back to the stamped version above if the file
 * is unreachable, so the frame still loads and can surface its own error.
 */
export async function resolveEngineSource(base: string): Promise<EngineSource> {
  let version: string = ENGINE.version;
  let sizes: Record<string, number> = {};
  try {
    const res = await fetch(`${base}/version.json`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { build?: string; sizes?: Record<string, number> };
      version = data.build ?? version;
      sizes = data.sizes ?? sizes;
    }
  } catch {
    // Unreachable, so fall through to the stamped version.
  }
  return { url: `${base}/index.html?v=${encodeURIComponent(version)}`, sizes };
}
