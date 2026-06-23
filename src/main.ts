import "./style.css";
import { resumeSectionHTML, downloadResumePdf, siteMenuHTML } from "./resume";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <canvas id="matrix" class="pointer-events-none fixed inset-0 -z-10 h-full w-full"></canvas>

  <main class="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center gap-12 px-6 pb-24 text-slate-100">
    <div id="hero" class="flex min-h-screen flex-col items-center justify-center">
      <div class="flex flex-col items-center gap-6 rounded-2xl bg-slate-950/40 px-8 py-10 text-center ring-1 ring-white/10 backdrop-blur-xs">
        <h1 class="text-4xl sm:text-6xl font-bold tracking-tight">
          Liam <span class="text-sky-400">Brown</span>
        </h1>
        <p class="text-lg text-slate-300">Graphics &amp; Algorithms Developer</p>
        <p class="max-w-md text-slate-400">
          I write clear, concise, efficient C++: rendering engines, graphics
          pipelines, and the systems behind them. I build for work and for fun.
        </p>
        <div class="flex flex-wrap items-center justify-center gap-3">
          <button id="view-resume" type="button"
            class="rounded-lg bg-sky-500 px-5 py-2.5 font-medium text-white transition hover:bg-sky-400 active:scale-95">
            View Résumé
          </button>
          <a href="/vanguards/" target="_blank" rel="noopener noreferrer"
            class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-medium text-sky-300 ring-1 ring-sky-400/50 transition hover:bg-sky-500/10 active:scale-95">
            Play Vanguards
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" class="size-4">
              <path d="M7 17 17 7M9 7h8v8"/>
            </svg>
          </a>
          <a href="/gobspin/" target="_blank" rel="noopener noreferrer"
            class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-medium text-sky-300 ring-1 ring-sky-400/50 transition hover:bg-sky-500/10 active:scale-95">
            Play Gobspin
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" class="size-4">
              <path d="M7 17 17 7M9 7h8v8"/>
            </svg>
          </a>
        </div>
      </div>
    </div>

    <section id="resume"
      class="w-full space-y-6 rounded-2xl bg-slate-950/40 px-8 py-10 ring-1 ring-white/10 backdrop-blur-xs">
      ${resumeSectionHTML()}
    </section>
  </main>

  ${siteMenuHTML()}

  <nav aria-label="Social links"
    class="fixed top-5 left-5 flex items-center gap-4 text-slate-400">
    <a href="https://github.com/hoZer347" target="_blank" rel="noopener noreferrer"
      aria-label="GitHub" title="GitHub" class="transition hover:text-sky-400">
      <svg viewBox="0 0 24 24" fill="currentColor" class="size-6">
        <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.87.12 3.18.77.84 1.23 1.92 1.23 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22 0 1.61-.01 2.9-.01 3.29 0 .32.21.7.82.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z"/>
      </svg>
    </a>
    <a href="https://www.linkedin.com/in/liam-brown-6256b9257/" target="_blank" rel="noopener noreferrer"
      aria-label="LinkedIn" title="LinkedIn" class="transition hover:text-sky-400">
      <svg viewBox="0 0 24 24" fill="currentColor" class="size-6">
        <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"/>
      </svg>
    </a>
    <button id="copy-email" type="button" aria-label="Copy email address" title="liam@browndomain.com"
      class="transition hover:text-sky-400 cursor-pointer">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" class="size-6">
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <path d="m2 7 10 6 10-6"/>
      </svg>
    </button>
  </nav>

  <div id="toast"
    class="pointer-events-none fixed bottom-5 left-1/2 -translate-x-1/2 translate-y-3 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 opacity-0 shadow-lg ring-1 ring-white/10 transition-all duration-200">
    Email copied!
  </div>
`;

// Résumé is always on the page; the buttons just scroll between the hero and
// the résumé section.
const viewResume = app.querySelector<HTMLButtonElement>("#view-resume")!;
const resumeSection = app.querySelector<HTMLElement>("#resume")!;

viewResume.addEventListener("click", () => {
  resumeSection.scrollIntoView({ behavior: "smooth", block: "start" });
});

// Bottom menu buttons scroll to the site section named by their data-target.
app
  .querySelectorAll<HTMLButtonElement>(".js-scroll-to")
  .forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.target;
      if (id) {
        document
          .getElementById(id)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }),
  );

// Both the top and bottom résumé Download buttons share this class.
app
  .querySelectorAll<HTMLButtonElement>(".js-download-resume")
  .forEach((btn) => btn.addEventListener("click", () => downloadResumePdf()));

const EMAIL = "liam@browndomain.com";
const toast = app.querySelector<HTMLDivElement>("#toast")!;
const copyEmail = app.querySelector<HTMLButtonElement>("#copy-email")!;
let toastTimer: number | undefined;

function showToast(message: string) {
  toast.textContent = message;
  toast.classList.remove("opacity-0", "translate-y-3");
  toast.classList.add("opacity-100", "translate-y-0");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-3");
    toast.classList.remove("opacity-100", "translate-y-0");
  }, 2000);
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts / older browsers
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

copyEmail.addEventListener("click", async () => {
  const ok = await copyToClipboard(EMAIL);
  showToast(ok ? "Email copied!" : EMAIL);
});

// --- Matrix-style digital rain (blue scheme: gray glyphs on blue-black) ---
const canvas = app.querySelector<HTMLCanvasElement>("#matrix")!;
const ctx = canvas.getContext("2d")!;
const GLYPHS =
  "アァカサタナハマヤャラワガザダバパ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const FONT_SIZE = 16;
const TRAIL = 22; // glyphs drawn behind each head, fading out
const TRAIL_GAP = FONT_SIZE; // spacing between trail glyphs (keeps trails long when slow)
const BASE_VY = 1.0; // base fall speed in px/frame — gentle, like the original

type TrailPoint = { x: number; y: number; c: string };
interface Particle {
  x: number;
  y: number;
  vy: number;
  trail: TrailPoint[];
}

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

let particles: Particle[] = [];

function randomFallSpeed() {
  return BASE_VY * (0.7 + Math.random() * 0.8);
}

// Send a particle back to the top. `seed` spreads them over the whole height
// on first fill so the screen isn't empty at the start.
function respawn(p: Particle, seed = false) {
  p.x = Math.random() * canvas.width;
  p.y = seed ? Math.random() * canvas.height : -Math.random() * 200 - FONT_SIZE;
  p.vy = randomFallSpeed();
  p.trail = [];
}

function resizeMatrix() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const count = Math.floor(canvas.width / 12);
  particles = Array.from({ length: count }, () => {
    const p: Particle = { x: 0, y: 0, vy: 0, trail: [] };
    respawn(p, true);
    return p;
  });
}

function drawMatrix() {
  // Fully transparent layer so the page background shows between glyphs.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${FONT_SIZE}px monospace`;

  for (const p of particles) {
    p.y += p.vy; // straight-down fall, behind the content

    if (p.y > canvas.height + FONT_SIZE) respawn(p);

    // Lay down a trail glyph only once the head has travelled a full gap,
    // so the trail stays long and evenly spaced regardless of fall speed.
    const lastPt = p.trail[p.trail.length - 1];
    if (!lastPt || Math.hypot(p.x - lastPt.x, p.y - lastPt.y) >= TRAIL_GAP) {
      p.trail.push({ x: p.x, y: p.y, c: randomGlyph() });
      if (p.trail.length > TRAIL) p.trail.shift();
    }

    // Fading gray-blue tail (oldest = dimmest)...
    for (let k = 0; k < p.trail.length; k++) {
      const pt = p.trail[k];
      const alpha = ((k + 1) / (TRAIL + 1)) * 0.8;
      ctx.fillStyle = `rgba(100, 116, 139, ${alpha})`;
      ctx.fillText(pt.c, pt.x, pt.y);
    }
    // ...and a bright sky-blue head drawn on top at the live position.
    ctx.fillStyle = "#7dd3fc";
    ctx.fillText(randomGlyph(), p.x, p.y);
  }
}

resizeMatrix();
window.addEventListener("resize", resizeMatrix);
const loop = () => {
  requestAnimationFrame(loop);
  drawMatrix();
};
requestAnimationFrame(loop);
