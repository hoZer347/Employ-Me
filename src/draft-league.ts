// The Draft League: a self-hosted Pokemon draft league platform, running live
// at zst.loomhozer.ca. It is not a build this site can frame, it is a whole
// server stack on its own host, so this tab is a screenshot tour and a way in
// rather than an embed.

import { OPEN_ICON, galleryHTML, outboundLink } from "./gallery";

export interface Feature {
  heading: string;
  body: string;
}

export const DRAFT_LEAGUE = {
  title: "Pokemon Draft League",
  href: "https://zst.loomhozer.ca",
  tagline:
    "A self-hosted platform that runs a Pokemon draft league end to end: a snake draft on a live clock, a round-robin season, real battles on a private Pokemon Showdown server, and per-mon stats scraped out of every replay.",
  shots: [
    "/draft-league/draft.png",
    "/draft-league/scoreboard.png",
    "/draft-league/teams.png",
    "/draft-league/stats.png",
  ] as const,
  features: [
    {
      heading: "The draft",
      body: "A coach picks a tier, not a Pokemon: the server offers a random sample of what is left in that tier and the coach takes one of those. The sample is cached per turn, so nobody can refresh until they like it. One background clock compares each draft's persisted deadline to the wall clock, so the timer survives a server restart and auto-picks for whoever went quiet.",
    },
    {
      heading: "Season and standings",
      body: "When the draft closes the server lays down a full single round-robin, byes included for an odd roster. Standings, records, KO differentials and weekly MVPs all fall out of the reported results, so nothing is kept by hand.",
    },
    {
      heading: "Real battles",
      body: "Games are played on a private Pokemon Showdown server in a custom format whose validator fetches each coach's drafted roster and rejects anything they do not own. Finished battles POST their log back, which scores the fixture and updates the season.",
    },
    {
      heading: "Stats from the replays",
      body: "A scraper walks every battle log and attributes each effect to a source: direct hits, hazards, status chip, weather, recoil, Destiny Bond, absorb healing. That becomes a sortable per-mon table of KOs, faints, damage, presence and win rate.",
    },
  ] as const satisfies readonly Feature[],
  tags: [
    "C#",
    "ASP.NET Core",
    "EF Core",
    "SignalR",
    "SQLite",
    "Node.js",
    "JavaScript",
    "Cloudflare Tunnel",
  ] as const,
};

/** The Draft League tab's body: the tour, the write-up, and the way in. */
export function draftLeagueSectionHTML(): string {
  const features = DRAFT_LEAGUE.features
    .map(
      (feature) => `
      <div class="space-y-1">
        <h3 class="text-sm font-semibold text-slate-100">${feature.heading}</h3>
        <p class="text-sm text-slate-400">${feature.body}</p>
      </div>`,
    )
    .join("");

  const tags = DRAFT_LEAGUE.tags
    .map(
      (tag) => `
      <span class="rounded-md px-2 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-white/10">${tag}</span>`,
    )
    .join("");

  return `
    <header class="space-y-2">
      <h2 class="text-xs font-semibold uppercase tracking-widest text-sky-400">${DRAFT_LEAGUE.title}</h2>
      <p class="text-slate-300">${DRAFT_LEAGUE.tagline}</p>
    </header>

    ${galleryHTML({
      href: DRAFT_LEAGUE.href,
      title: DRAFT_LEAGUE.title,
      shots: DRAFT_LEAGUE.shots,
      action: "Open",
      actionNote: "Opens the live league in a new tab",
      icon: OPEN_ICON,
    })}
    <div class="grid gap-x-8 gap-y-6 sm:grid-cols-2">${features}</div>

    <div class="flex flex-wrap gap-2">${tags}</div>

    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      ${outboundLink(DRAFT_LEAGUE.href, "Open the live league")}
    </div>`;
}
