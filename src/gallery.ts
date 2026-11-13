// The screenshot gallery shared by the game cards and the Draft League card:
// one still shown large, the rest as thumbnails under it, the whole frame a
// link to wherever the thing actually lives (its own page, or another site).
//
// The frame is a fixed 16:10 box with the image contained inside, so shots of
// different shapes sit in it without being cropped or stretched.

export const ARROW_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" class="size-4">
    <path d="M7 17 17 7M9 7h8v8"/>
  </svg>`;

export const PLAY_ICON = `
  <svg viewBox="0 0 24 24" fill="currentColor" class="size-5 translate-x-0.5">
    <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11.14-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z"/>
  </svg>`;

export const OPEN_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" class="size-5">
    <path d="M7 17 17 7M9 7h8v8"/>
  </svg>`;

export interface Gallery {
  /** Where the large still, and the placeholder when there are none, links to. */
  href: string;
  /** Named in the link's label. */
  title: string;
  shots: readonly string[];
  /** Verb for the label, e.g. "Play" or "Open". */
  action: string;
  /** One line under the placeholder saying where the link goes. */
  actionNote: string;
  /** The glyph in the hover overlay and in the placeholder. */
  icon: string;
}

/** An inline link with a trailing arrow, the site's standard "goes elsewhere". */
export function outboundLink(href: string, label: string): string {
  return `
    <a href="${href}" target="_blank" rel="noopener noreferrer"
      class="inline-flex items-center gap-1.5 text-sm font-medium text-sky-400 transition hover:text-sky-300">
      ${label}${ARROW_ICON}
    </a>`;
}

export function galleryHTML(gallery: Gallery): string {
  const { href, title, shots, action, actionNote, icon } = gallery;

  const stage = shots.length
    ? `
      <a href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${action} ${title}"
        class="group relative block aspect-[16/10] overflow-hidden rounded-xl bg-slate-950 ring-1 ring-white/10">
        <img class="js-shot absolute inset-0 h-full w-full object-contain"
          src="${shots[0]}" alt="${title} screenshot" loading="lazy">
        <span class="absolute inset-0 flex items-center justify-center bg-slate-950/60 opacity-0 transition group-hover:opacity-100">
          <span class="flex size-14 items-center justify-center rounded-full bg-slate-950/60 text-sky-200 ring-1 ring-sky-300/60 transition group-hover:bg-sky-500/20">
            ${icon}
          </span>
        </span>
      </a>`
    : `
      <a href="${href}" target="_blank" rel="noopener noreferrer"
        class="group flex aspect-[16/10] flex-col items-center justify-center gap-3 rounded-xl bg-slate-950 ring-1 ring-white/10">
        <span class="flex size-14 items-center justify-center rounded-full text-sky-300 ring-1 ring-sky-400/50 transition group-hover:bg-sky-500/10">
          ${icon}
        </span>
        <span class="font-medium text-slate-200">${action} ${title}</span>
        <span class="text-xs text-slate-500">${actionNote}</span>
      </a>`;

  const thumbs =
    shots.length > 1
      ? `
      <div class="flex flex-wrap gap-2">
        ${shots
          .map(
            (src, i) => `
          <button type="button" class="js-thumb aspect-[16/10] w-20 cursor-pointer overflow-hidden rounded-md bg-slate-950 ring-1 transition ${
            i === 0 ? "ring-sky-400/60" : "ring-white/10 hover:ring-sky-400/40"
          }" data-src="${src}" aria-label="Screenshot ${i + 1}">
            <img class="h-full w-full object-contain" src="${src}" alt="" loading="lazy">
          </button>`,
          )
          .join("")}
      </div>`
      : "";

  return `<div class="js-gallery space-y-2">${stage}${thumbs}</div>`;
}

/** Wire every gallery's thumbnails to swap the large image. */
export function wireGalleries(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(".js-gallery").forEach((gallery) => {
    const shot = gallery.querySelector<HTMLImageElement>(".js-shot");
    const thumbs = gallery.querySelectorAll<HTMLButtonElement>(".js-thumb");
    if (!shot) return;

    thumbs.forEach((thumb) =>
      thumb.addEventListener("click", () => {
        const src = thumb.dataset.src;
        if (!src) return;
        shot.src = src;
        thumbs.forEach((other) => {
          const on = other === thumb;
          other.classList.toggle("ring-sky-400/60", on);
          other.classList.toggle("ring-white/10", !on);
          other.classList.toggle("hover:ring-sky-400/40", !on);
        });
      }),
    );
  });
}
