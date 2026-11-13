// Every playable thing on the site, described once. The portfolio cards in
// main.ts and the themed full-page loaders under /<slug>/ both read from here.
//
// Every game is a Unity WebGL build served same-origin from /<slug>-build (the
// dev middleware and the prod bundler in vite.config.ts both put it there),
// framed by a loader page at /<slug>/.

export interface Game {
  /** URL slug, and the asset-name prefix the bundler normalizes to. */
  slug: string;
  title: string;
  tagline: string;
  /** Jam the game was made for, if any. */
  jam?: string;
  /** What I did on the team. */
  role?: string;
  /** The jam's theme, which the game had to be built around. */
  theme?: string;
  /** How long the jam ran, from its itch.io submission window. */
  duration?: string;
  /** How many people worked on it, if it was a team. */
  team?: string;
  /** How it placed, as reported by the jam results. */
  accolade?: string;
  /** Public itch.io page. */
  itch?: string;
  /**
   * Stills for the card, whichever leads best first. Pulled from itch.io
   * and served from public/games/<slug>/ so the card owes nothing to itch's
   * CDN. Letterboxed rather than cropped, so a shot keeps its own shape.
   */
  shots: readonly string[];
  /**
   * Offline fallback for the build version. In dev and in prod the build's
   * own version.json wins; this only shows if that is unreachable.
   */
  version: string;
}

// Jam entries, newest first. These are the "Gamejams" section.
export const JAM_GAMES: readonly Game[] = [
  {
    slug: "trust-no-one",
    title: "Trust - No - One",
    tagline:
      "A psychedelic roguelike dungeon crawl played with three buttons, where every encounter is a question of who you trust and who is about to betray you.",
    jam: "Brackeys Game Jam 2026.2",
    theme: "Trust No One",
    duration: "1 week",
    team: "6 people",
    role: "Team lead",
    accolade: "9th overall out of 8000+ entries",
    itch: "https://hozer347.itch.io/trust-no-one",
    shots: [
      "/games/trust-no-one/shot1.png",
      "/games/trust-no-one/shot2.png",
      "/games/trust-no-one/shot3.png",
      "/games/trust-no-one/shot4.png",
    ],
    version: "2026-08-30 03:22",
  },
  {
    slug: "brrreak-it-down",
    title: "Brrreak it Down",
    tagline:
      "Play Count Von Doune, a vampire who fights archers and werewolves with his dance moves. Keep the music going by collecting ketchup bottles and down as many enemies as you can.",
    jam: "GMTK Game Jam 2026",
    theme: "Count Down",
    duration: "4 days",
    team: "8 people",
    role: "Team lead",
    accolade: "Top 0.07% audio design and programming",
    itch: "https://redthepencilmonster.itch.io/brrreak-it-down",
    shots: [
      "/games/brrreak-it-down/cover.png",
      "/games/brrreak-it-down/shot3.png",
      "/games/brrreak-it-down/shot4.png",
      "/games/brrreak-it-down/shot2.png",
    ],
    version: "2026-07-26 18:00",
  },
  {
    slug: "gobspin",
    title: "Gobspin",
    tagline:
      "You are a goblin, and you spin. Pull back to wind up a spin attack, release to launch, then click again to slow down and land a hero pose. Survive thirty seconds for a secret encounter.",
    jam: "The Very Serious Juniper Dev Game Jam",
    theme: "Spin to Win",
    duration: "1 week",
    team: "3 people",
    role: "Team lead",
    accolade: "Top 5% overall",
    itch: "https://hozer347.itch.io/gobspin",
    shots: [
      "/games/gobspin/shot1.png",
      "/games/gobspin/shot2.png",
      "/games/gobspin/shot3.png",
    ],
    version: "2026-06-23 01:00",
  },
];

export const GAMES: readonly Game[] = JAM_GAMES;

export function gameBySlug(slug: string): Game {
  const game = GAMES.find((g) => g.slug === slug);
  if (!game) throw new Error(`Unknown game slug: ${slug}`);
  return game;
}

// --- Where a local build is served from ------------------------------------

export interface ResolvedSource {
  base: string;
  version: string;
}

/** Same-origin path the Vite middleware (dev) and the bundler (prod) serve. */
export function buildBase(game: Game): string {
  return `/${game.slug}-build`;
}

/**
 * Ask a build's `version.json` (synthesized from the build's newest file) what
 * it is, so the framed URL's `?v=` busts the cache on every rebuild. Falls back
 * to the version stamped above if the file is unreachable, so the frame still
 * loads and can surface its own error.
 */
export async function resolveBuildSource(game: Game): Promise<ResolvedSource> {
  const base = buildBase(game);
  const fallback = game.version;
  try {
    const res = await fetch(`${base}/version.json`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { build?: string };
      return { base, version: data.build ?? fallback };
    }
  } catch {
    // Unreachable — fall through to the stamped version.
  }
  return { base, version: fallback };
}

/** The framed game URL. */
export function buildGameUrl({ base, version }: ResolvedSource): string {
  return `${base}/index.html?v=${encodeURIComponent(version)}`;
}

/** The themed page that gives the build the whole window. */
export function fullPageUrl(game: Game): string {
  return `/${game.slug}/`;
}
