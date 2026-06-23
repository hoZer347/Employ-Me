// Gobspin demo loader config: where to load the Unity WebGL build from and a
// date-based version used as the cache key.

// Bump this when you ship a new build (format: "YYYY-MM-DD HH:MM"). In prod the
// build's version.json (derived from the build timestamp) overrides it; this is
// just the offline fallback.
export const GOBSPIN_VERSION = "2026-06-23 01:00";

// The build is served same-origin from this site under /gobspin-build — by the
// Vite middleware in dev, and from the bundled copy in prod (see vite.config.ts
// + netlify.toml). Same-origin means no CORS. Add more hosts here if the game
// later moves to a separate host.
export const GOBSPIN_SOURCES: readonly string[] = ["/gobspin-build"];

export interface ResolvedSource {
  base: string;
  version: string;
}

/**
 * Try each source's `version.json` in order and return the first reachable
 * one (with the version it reports). If none respond, fall back to the first
 * source and the known version so the iframe can still surface a clear error.
 */
export async function resolveGobspinSource(): Promise<ResolvedSource> {
  for (const base of GOBSPIN_SOURCES) {
    try {
      const res = await fetch(`${base}/version.json`, { cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as { build?: string };
      return { base, version: data.build ?? GOBSPIN_VERSION };
    } catch {
      // Unreachable host — try the next one.
    }
  }
  return { base: GOBSPIN_SOURCES[0], version: GOBSPIN_VERSION };
}

/** The framed game URL. `?v=` busts the page cache when the build changes. */
export function gobspinGameUrl({ base, version }: ResolvedSource): string {
  return `${base}/index.html?v=${encodeURIComponent(version)}`;
}
