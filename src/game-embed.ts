// The in-page game card: a screenshot gallery beside the game's blurb and
// links. The playable build lives on its own full-bleed page (or on itch.io),
// where it gets the whole window and its real aspect ratio; squeezing it into
// this column would only letterbox or crop it.
//
// The gallery itself is shared with the Draft League card; see gallery.ts.

import { fullPageUrl, type Game } from "./games";
import { PLAY_ICON, galleryHTML, outboundLink } from "./gallery";

/** One game: the gallery on the left, everything written about it on the right. */
export function gameCardHTML(game: Game): string {
  const credit = [game.jam, game.role].filter(Boolean).join(" · ");
  const subtitle = credit
    ? `<p class="text-sm text-slate-400">${credit}</p>`
    : "";

  const theme = game.theme
    ? `<p class="text-sm text-slate-400">
         Theme: <span class="text-slate-300">${game.theme}</span>
       </p>`
    : "";

  const duration = game.duration
    ? `<p class="text-sm text-slate-400">
         Length: <span class="text-slate-300">${game.duration}</span>
       </p>`
    : "";

  const team = game.team
    ? `<p class="text-sm text-slate-400">
         Team: <span class="text-slate-300">${game.team}</span>
       </p>`
    : "";

  const accolade = game.accolade
    ? `<p class="inline-flex rounded-full bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300 ring-1 ring-sky-400/30">
         ${game.accolade}
       </p>`
    : "";

  const links = [
    game.itch ? outboundLink(game.itch, "itch.io page") : "",
    outboundLink(fullPageUrl(game), "Play it here"),
  ]
    .filter(Boolean)
    .join('<span class="text-slate-700">·</span>');

  return `
    <article class="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      ${galleryHTML({
        href: fullPageUrl(game),
        title: game.title,
        shots: game.shots,
        action: "Play",
        actionNote: "Opens the build on its own page",
        icon: PLAY_ICON,
      })}

      <div class="space-y-3">
        <h3 class="text-xl font-semibold text-slate-100">${game.title}</h3>
        ${subtitle}
        ${theme}
        ${duration}
        ${team}
        ${accolade}
        <p class="text-sm text-slate-300">${game.tagline}</p>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">${links}</div>
      </div>
    </article>`;
}
