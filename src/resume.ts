// Resume content, adapted (not copied verbatim) from Liam Brown's resume, as it
// stood before any edit made on the page. Those edits are saved to
// public/content-overrides.json, and resume-edits.ts folds them in for
// everything built from this data: the downloadable PDF (jsPDF generator
// below), the job pipeline and the LinkedIn sync.

export const resume = {
  name: "Liam Brown",
  // Recruiters search job titles more than any other field, so this leads with
  // the two strings that are actually typed into the search box. See
  // src/keyword-data.ts for the research behind this file's wording.
  title: "Graphics Programmer | C++ Software Engineer",
  location: "Ottawa, Canada",
  contact: {
    email: "liam@browndomain.com",
    phone: "613-601-6567",
    github: "github.com/hoZer347",
    linkedin: "linkedin.com/in/liambrowndev",
  },
  summary:
    "C++ / C# engineer with 3 years in industry on core algorithms, computational geometry, and QA and testing infrastructure. Real-time rendering, multithreaded systems, and networked tools.",
  experience: [
    {
      role: "Core Algorithms Developer",
      org: "Kinaxis",
      period: "Apr 2025 - Jun 2026",
      points: [
        "Built unit and regression test suites for core C++ supply chain planning algorithms.",
        "Debugged memory errors in a large multithreaded C++ codebase with sanitizers and profilers, on a team that shipped zero unforgivable defects for a full year.",
        "Built internal LLM agents for developer tooling that cut defect analysis from a day to an hour.",
      ],
    },
    {
      role: "3D Software Developer",
      org: "iCAD Dental",
      period: "Sep 2023 - Sep 2024",
      points: [
        "Built a cross-platform client-server app in C# on Unity for real-time 3D painting of dental scans.",
        "Wrote computational geometry and mesh generation for crowns and abutments, speeding the design system up from minutes to seconds.",
        "Mentored 3 developers in modern C++ and GPU performance optimization.",
      ],
    },
    {
      role: "Software Developer",
      org: "Corel",
      period: "Apr 2022 - Apr 2023",
      points: [
        "Shipped clipboard and data interchange features in CorelDRAW, a C++ desktop application.",
        "Integrated the WebP codec into the imaging pipeline and designed a non-destructive layer model.",
        "Fixed leaks and crashes with Visual Studio profiling.",
      ],
    },
  ],
  projects: [
    // One entry, not two: the engine and Loom are the same long-running
    // project, and a single seven-year effort reads stronger than a pair of
    // overlapping ones.
    {
      name: "Loom Game Engine",
      period: "2018 - 2025",
      points: [
        "Multithreaded real-time engine in C++ and GLSL on OpenGL: entity component system, custom shader and shadow system, frustum culling, and spatial partitioning physics.",
        "Thread pool scheduling holds interactive frame times on scenes of millions of triangles.",
        "Builds for Windows and for WebAssembly through Emscripten, with a TCP and UDP backend, CMake and CI.",
      ],
      links: [
        { label: "Codebase", url: "https://github.com/hoZer347/Loom" },
      ],
    },
    {
      name: "Game Jams",
      period: "2026",
      points: [
        "Led three Unity jam teams in 2026, shipping on deadline each time, once with eight people in four days.",
        "Trust No One placed 9th overall out of 8000+ entries at Brackeys Game Jam 2026.2.",
        "Top 0.07% in audio design and programming at GMTK 2026. Top 5% overall at the Juniper Dev jam.",
      ],
      links: [{ label: "Play them", url: "https://hozer347.itch.io/" }],
    },
    {
      name: "hoZer's Utilities",
      period: "Ongoing",
      points: [
        "Unity toolkit in C#: networked state machines, a dialogue system, editor tooling and an automated playtest harness.",
      ],
      links: [],
    },
  ],
  education: [
    {
      degree: "Bachelor of Computer Science (Honours)",
      org: "Carleton University, Ottawa",
      period: "2017 - 2022",
      detail: "Computer graphics, C and C++, linear algebra, algorithms, distributed computing.",
    },
  ],
  // The job pipeline scores postings against this list.
  skills: {
    Languages: "C++, C, C#, Python, GLSL, HLSL",
    Graphics: "OpenGL, real-time rendering, shader programming, CUDA, RenderDoc, computational geometry",
    Systems: "Multithreading, memory management, profiling, performance optimization",
    Networking: "TCP / UDP, sockets, client-server, Emscripten / WebAssembly",
    Tools: "Visual Studio, Git, CMake, Unity, CI/CD, unit testing, debugging, LLM agents",
  },
  interests: "LeetCode · music composition · games · D&D",
} as const;

export type Resume = typeof resume;

// --- On-page resume section ------------------------------------------------

// Bullets carry bracketed placeholders like [X]% where a real, measured number
// belongs. Screeners rank quantified bullets highest, but the figures have to
// be Liam's own, so the on-page resume flags any that are still unfilled rather
// than letting them slip into a deploy or a submitted PDF unnoticed.
const PLACEHOLDER = /\[[^\]]+\]/g;

/** Every string in the resume data, however deeply nested. Scanning the values
 *  themselves rather than a JSON dump keeps the structure's own square brackets
 *  out of the placeholder search. */
function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(stringsIn);
  }
  return [];
}

/** Every unfilled placeholder still left in the resume copy, one entry per
 *  occurrence. */
export function pendingPlaceholders(): string[] {
  return stringsIn(resume).flatMap((s) => s.match(PLACEHOLDER) ?? []);
}

function markPlaceholders(text: string): string {
  return text.replace(
    PLACEHOLDER,
    (m) =>
      `<mark class="rounded bg-amber-400/20 px-1 font-medium text-amber-300">${m}</mark>`,
  );
}

function listItems(points: readonly string[]): string {
  return points
    .map((p) => `<li class="text-slate-300">${markPlaceholders(p)}</li>`)
    .join("");
}


/** HTML for the resume panel that fades in below the hero. */
export function resumeSectionHTML(): string {
  const { contact } = resume;

  const experience = resume.experience
    .map(
      (job) => `
      <div>
        <div class="flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 class="font-semibold text-slate-100">${job.role} · <span class="text-sky-400">${job.org}</span></h3>
          <span class="text-sm text-slate-500">${job.period}</span>
        </div>
        <ul class="mt-1 list-disc space-y-1 pl-5 text-sm">${listItems(job.points)}</ul>
      </div>`,
    )
    .join("");

  const projects = resume.projects
    .map((proj) => {
      const links = proj.links
        .map(
          (l) =>
            `<a href="${l.url}" target="_blank" rel="noopener noreferrer" class="text-sky-400 hover:text-sky-300 underline underline-offset-2">${l.label}</a>`,
        )
        .join('<span class="text-slate-600"> · </span>');
      return `
      <div>
        <div class="flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 class="font-semibold text-slate-100">${proj.name}</h3>
          <span class="text-sm text-slate-500">${proj.period}</span>
        </div>
        <ul class="mt-1 list-disc space-y-1 pl-5 text-sm">${listItems(proj.points)}</ul>
        ${links ? `<div class="mt-1 pl-5 text-sm">${links}</div>` : ""}
      </div>`;
    })
    .join("");

  const education = resume.education
    .map(
      (ed) => `
      <div>
        <div class="flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 class="font-semibold text-slate-100">${ed.degree}</h3>
          <span class="text-sm text-slate-500">${ed.period}</span>
        </div>
        <p class="text-sm text-sky-400">${ed.org}</p>
        <p class="mt-1 text-sm text-slate-300">${ed.detail}</p>
      </div>`,
    )
    .join("");

  const skills = Object.entries(resume.skills)
    .map(
      ([group, items]) => `
      <p class="text-sm text-slate-400">
        <span class="font-medium text-slate-200">${group}:</span> ${items}
      </p>`,
    )
    .join("");

  const section = (title: string, body: string) => `
    <section class="space-y-3">
      <h2 class="text-xs font-semibold uppercase tracking-widest text-sky-400">${title}</h2>
      ${body}
    </section>`;

  return `
    <header class="space-y-1 text-center">
      <h1 class="text-3xl font-bold tracking-tight text-slate-100">${resume.name}</h1>
      <p class="text-sky-400">${resume.title}</p>
      <p class="text-sm text-slate-400">${contact.email} · ${contact.phone} · ${contact.github}</p>
    </header>
    <p class="text-center text-slate-300">${resume.summary}</p>
    ${placeholderNotice()}
    <div class="grid gap-x-10 gap-y-6 md:grid-cols-3">
      <div class="space-y-6 md:col-span-2">
        ${section("Work Experience", `<div class="space-y-4">${experience}</div>`)}
        ${section("Projects", `<div class="space-y-4">${projects}</div>`)}
        ${section("Education", education)}
      </div>
      <div class="space-y-6">
        ${section("Skills", `<div class="space-y-2">${skills}</div>`)}
        ${section("Interests", `<p class="text-sm text-slate-300">${resume.interests}</p>`)}
      </div>
    </div>
    <div class="flex justify-center border-t border-white/10 pt-6">
      ${downloadButton()}
    </div>`;
}

/** Warning strip listing any placeholders still waiting on a real number.
 *  Renders nothing once they are all filled in, so it disappears on its own. */
function placeholderNotice(): string {
  const pending = pendingPlaceholders();
  if (pending.length === 0) return "";
  const kinds = [...new Set(pending)];
  return `
    <div class="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-400/30">
      <span class="font-semibold">${pending.length} highlighted placeholder${pending.length === 1 ? "" : "s"} still need real numbers</span>
      before this is sent out or deployed:
      <span class="font-mono text-amber-300">${kinds.join(" ")}</span>.
      Fill them in <span class="font-mono">src/resume.ts</span> and this notice
      disappears. Never guess a figure, an unverifiable number is worse than no
      number at all.
    </div>`;
}

// A Download-PDF button. Marked with `js-download-resume` so main.ts can wire
// up every instance (top and bottom of the resume) at once.
function downloadButton(): string {
  return `
    <button type="button"
      class="js-download-resume inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-sky-300 ring-1 ring-sky-400/50 transition hover:bg-sky-500/10 active:scale-95">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" class="size-5">
        <path d="M12 3v12m0 0 4-4m-4 4-4-4"/>
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
      </svg>
      Download PDF
    </button>`;
}

// --- Downloadable PDF (built from the same data) ---------------------------

const ACCENT: [number, number, number] = [2, 132, 199]; // sky-600
const INK: [number, number, number] = [30, 41, 59]; // slate-800
const MUTED: [number, number, number] = [100, 116, 139]; // slate-500

/** File the browser saves the resume as. Exported so tests can assert the
 *  name without duplicating the string. */
export const RESUME_FILENAME = "Liam-Brown-Resume.pdf";

/** US Letter width. The PDF keeps the familiar page width and grows downwards
 *  instead of breaking, so the sheet is still a normal reading width. */
export const PAGE_WIDTH = 612;

/** Whitespace around the content, on all four sides. */
export const PAGE_MARGIN = 54;

/** Height of the throwaway page the measuring pass lays out onto: tall enough
 *  that nothing can reach the bottom and trigger a page break. */
const PROBE_HEIGHT = 14400;

/** Ceiling on the finished page. PDF readers stop honouring a MediaBox past
 *  200 inches, so a resume that outgrows this cannot be a single page and the
 *  content has to be cut instead. */
export const MAX_PAGE_HEIGHT = PROBE_HEIGHT;

/** Draw the whole resume onto `doc`, top to bottom, and return the baseline of
 *  the last line written. The caller supplies a document tall enough to hold
 *  it; the page-break guard below is a backstop that a correctly sized page
 *  never reaches. */
function layoutResume(doc: import("jspdf").jsPDF, data: Resume): number {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = PAGE_MARGIN;
  const contentW = pageW - margin * 2;
  let y = margin;

  // Break to a new page only if a line set at the current baseline would put
  // ink below the bottom margin. Sized against the descender rather than the
  // line advance so the last line on a page is not pushed off it by the blank
  // space that would have followed. With the two-pass build below the page is
  // always tall enough and this never fires; it stays as a backstop.
  const ensureSpace = (size: number) => {
    if (y + size * 0.25 > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header: name, title and contact.
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(...INK);
  doc.text(data.name, margin, y);
  y += 20;
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(...ACCENT);
  doc.text(data.title, margin, y);
  y += 15;
  doc.setFontSize(9).setTextColor(...MUTED);
  const { contact } = data;
  doc.text(
    `${contact.email}  |  ${contact.phone}  |  ${contact.github}  |  ${contact.linkedin}`,
    margin,
    y,
  );
  y += 16;
  doc.setDrawColor(...ACCENT).setLineWidth(1).line(margin, y, pageW - margin, y);
  y += 18;

  const heading = (title: string) => {
    ensureSpace(11);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...ACCENT);
    doc.text(title.toUpperCase(), margin, y);
    y += 14;
  };

  /** Returns the baseline of the last line it wrote, which is how the caller
   *  learns where the content actually ends. */
  const paragraph = (text: string, size = 10) => {
    doc.setFont("helvetica", "normal").setFontSize(size).setTextColor(...INK);
    const lines = doc.splitTextToSize(text, contentW) as string[];
    let baseline = y;
    for (const line of lines) {
      ensureSpace(size);
      doc.text(line, margin, y);
      baseline = y;
      y += size + 3;
    }
    return baseline;
  };

  const entryHeader = (left: string, right: string) => {
    ensureSpace(10.5);
    doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...INK);
    doc.text(left, margin, y);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    doc.text(right, pageW - margin, y, { align: "right" });
    y += 13;
  };

  const bullets = (points: readonly string[]) => {
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...INK);
    for (const p of points) {
      const lines = doc.splitTextToSize(p, contentW - 14) as string[];
      lines.forEach((line, i) => {
        ensureSpace(10);
        if (i === 0) doc.text("•", margin, y);
        doc.text(line, margin + 14, y);
        y += 13;
      });
    }
  };

  // Summary.
  paragraph(data.summary);
  y += 8;

  // Experience.
  heading("Work Experience");
  data.experience.forEach((job, i) => {
    entryHeader(`${job.role} - ${job.org}`, job.period);
    bullets(job.points);
    if (i < data.experience.length - 1) y += 6;
  });
  y += 8;

  // Projects.
  heading("Projects");
  data.projects.forEach((proj, i) => {
    entryHeader(proj.name, proj.period);
    bullets(proj.points);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...ACCENT);
    proj.links.forEach((l) => {
      ensureSpace(9);
      doc.textWithLink(`${l.label}: ${l.url}`, margin + 14, y, { url: l.url });
      y += 12;
    });
    if (i < data.projects.length - 1) y += 6;
  });
  y += 8;

  // Education.
  heading("Education");
  data.education.forEach((ed) => {
    entryHeader(ed.degree, ed.period);
    doc.setFont("helvetica", "italic").setFontSize(9.5).setTextColor(...MUTED);
    ensureSpace(9.5);
    doc.text(ed.org, margin, y);
    y += 13;
    paragraph(ed.detail);
  });
  y += 8;

  // Skills.
  heading("Skills");
  Object.entries(data.skills).forEach(([group, items]) => {
    ensureSpace(10);
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...INK);
    doc.text(`${group}: `, margin, y);
    const labelW = doc.getTextWidth(`${group}: `);
    doc.setFont("helvetica", "normal").setTextColor(...INK);
    const lines = doc.splitTextToSize(items, contentW - labelW) as string[];
    lines.forEach((line, i) => {
      doc.text(line, margin + (i === 0 ? labelW : 0), y);
      y += 13;
    });
  });
  y += 8;

  // Interests. Kept last deliberately: the page height is derived from the
  // baseline this returns, so whatever ends the resume has to report where it
  // stopped. The "bottom margin matches the top" test fails if that drifts.
  heading("Interests");
  return paragraph(data.interests);
}

/** Lay out the resume PDF and hand back the finished jsPDF document without
 *  saving it. Split out from `downloadResumePdf` so the formatting can be
 *  generated and inspected headlessly (see test/resume-pdf.test.mjs).
 *
 *  The result is one continuous page rather than a stack of Letter sheets: a
 *  measuring pass on an over-tall page finds where the content ends, then the
 *  real document is created at exactly that height and laid out again. Nothing
 *  can then straddle a page break, so no section, entry, or bullet is ever cut
 *  in half. jsPDF is imported lazily so it only loads on click. */
export async function buildResumePdf(data: Resume = resume) {
  const { jsPDF } = await import("jspdf");

  const probe = new jsPDF({ unit: "pt", format: [PAGE_WIDTH, PROBE_HEIGHT] });
  const lastBaseline = layoutResume(probe, data);
  // Helvetica descends about 0.21 em; rounding up to a quarter of the last
  // line keeps descenders clear of the bottom margin.
  const height = Math.ceil(lastBaseline + 10 * 0.25 + PAGE_MARGIN);

  const doc = new jsPDF({ unit: "pt", format: [PAGE_WIDTH, height] });
  layoutResume(doc, data);
  return doc;
}

/** Generate the resume PDF and hand it to the browser as a download. */
export async function downloadResumePdf(data: Resume = resume): Promise<void> {
  const doc = await buildResumePdf(data);
  doc.save(RESUME_FILENAME);
}
