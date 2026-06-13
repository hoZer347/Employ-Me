// Vanguards demo loader config: which host to load the Unity WebGL build
// from (primary → fallback) and a date-based version used as the cache key.

// Bump this when you ship a new build (format: "YYYY-MM-DD HH:MM"). Stamp the
// same value as the Unity `productVersion` (and append it to the asset URLs in
// the WebGL template) so a returning visitor's cached copy is invalidated only
// when it changes — the time component lets multiple builds land on one day.
export const VANGUARDS_VERSION = "2026-06-11 19:21";

// Ordered list of hosts to try. The first that responds wins; if it fails
// the loader falls through to the next. The build is served same-origin from
// this site under /vanguards-build — by the Vite middleware in dev, and from
// the bundled copy in prod (see vite.config.ts + netlify.toml). Same-origin
// means no CORS, so this works in both modes with a single relative source.
// Add more hosts here if the game later moves to a separate host.
export const VANGUARDS_SOURCES: readonly string[] = ["/vanguards-build"];

export interface ResolvedSource {
  base: string;
  version: string;
}

/**
 * Try each source's `version.json` in order and return the first reachable
 * one (with the version it reports). If none respond, fall back to the first
 * source and the known version so the iframe can still surface a clear error.
 */
export async function resolveVanguardsSource(): Promise<ResolvedSource> {
  for (const base of VANGUARDS_SOURCES) {
    try {
      const res = await fetch(`${base}/version.json`, { cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as { build?: string };
      return { base, version: data.build ?? VANGUARDS_VERSION };
    } catch {
      // Unreachable host — try the next one.
    }
  }
  return { base: VANGUARDS_SOURCES[0], version: VANGUARDS_VERSION };
}

/** The framed game URL. `?v=` busts the page cache when the build changes. */
export function vanguardsGameUrl({ base, version }: ResolvedSource): string {
  return `${base}/index.html?v=${encodeURIComponent(version)}`;
}
