// Single source of truth for résumé content — adapted (not copied verbatim)
// from Liam Brown's résumé. Consumed by both the on-page section (resume
// section HTML) and the downloadable PDF (jsPDF generator) below.

export const resume = {
  name: "Liam Brown",
  title: "Graphics & Algorithms Developer",
  location: "Ottawa, Canada",
  contact: {
    email: "liam@browndomain.com",
    phone: "613-601-6567",
    github: "github.com/hoZer347",
    linkedin: "linkedin.com/in/liam-brown-6256b9257",
  },
  summary:
    "Software developer with a deep background in C++ and a love for computer graphics, systems, and networking. I write clear, concise, efficient code, from rendering pipelines and engines to client-server tooling, and I build for work and for fun.",
  experience: [
    {
      role: "Core Algorithms Developer",
      org: "Kinaxis",
      period: "Apr 2025 - Jun 2026",
      points: [
        "Wrote thorough automated tests to verify algorithm correctness and guard against regressions.",
        "Investigated and resolved complex, hard-to-reproduce bugs across the codebase.",
        "Created and maintained efficient AI agents, skills, etc.",
      ],
    },
    {
      role: "3D Software Developer",
      org: "iCAD Dental",
      period: "Sep 2023 - Sep 2024",
      points: [
        "Built a client-server interface for displaying and painting teeth for dental technicians, in C# on the Unity engine.",
        "Helped develop techniques for generating dental abutments and crowns.",
        "Mentored other developers in C++ and graphics optimization.",
      ],
    },
    {
      role: "Software Developer",
      org: "Corel",
      period: "Apr 2022 - Apr 2023",
      points: [
        "Wrote new features for CorelDRAW's copy-paste functionality.",
        "Integrated WebP into the software stack and built a Photoshop-style layer hierarchy.",
        "Leveraged Visual Studio Enterprise's full toolset to diagnose and resolve issues.",
      ],
    },
  ],
  projects: [
    {
      name: "Loom",
      period: "2024 - 2025",
      points: [
        "A consolidated codebase unifying all of my C++ projects: graphics engine, website backend, and a WebAssembly build.",
      ],
      links: [
        { label: "Codebase", url: "https://github.com/hoZer347/Loom" },
        {
          label: "Website",
          url: "https://hozer347.github.io/Loom-Website/",
        },
      ],
    },
    {
      name: "Graphics Engine v4",
      period: "2018 - 2024",
      points: [
        "A rendering pipeline written from scratch, with a custom entity-component system, Blinn-Phong shading, and efficient object collision.",
        "Heavy emphasis on multithreading, fully utilizing every CPU thread. Built in C/C++ and GLSL on OpenGL.",
      ],
      links: [
        {
          label: "Source",
          url: "https://github.com/hoZer347/Game-Engine-v4",
        },
      ],
    },
  ],
  education: [
    {
      degree: "Bachelor of Computer Science (Honours)",
      org: "Carleton University, Ottawa",
      period: "2017 - 2022",
      detail:
        "Low-level C/C++, OpenGL, computer graphics, and distributed computing.",
    },
  ],
  skills: {
    Languages: "C / C++ (7 yrs), C# (3 yrs), Python (3 yrs)",
    Graphics: "OpenGL, GLSL, Blinn-Phong shading, CUDA",
    "Systems & Web": "TCP / UDP, WebSockets, Emscripten / WASM, Boost, multithreading",
    Tools: "Visual Studio, Git, Unity, CI/CD",
  },
  interests:
    "LeetCode with friends · ambient music composition in FL Studio · games · D&D",
} as const;

// --- On-page résumé section ------------------------------------------------

function listItems(points: readonly string[]): string {
  return points
    .map((p) => `<li class="text-slate-300">${p}</li>`)
    .join("");
}


/** HTML for the résumé panel that fades in below the hero. */
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
        <div class="mt-1 pl-5 text-sm">${links}</div>
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
      <div>
        <span class="block font-medium text-slate-200">${group}</span>
        <span class="text-sm text-slate-400">${items}</span>
      </div>`,
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
    <div class="grid gap-x-10 gap-y-6 md:grid-cols-3">
      <div class="space-y-6 md:col-span-2">
        ${section("Experience", `<div class="space-y-4">${experience}</div>`)}
        ${section("Projects", `<div class="space-y-4">${projects}</div>`)}
        ${section("Education", education)}
      </div>
      <div class="space-y-6">
        ${section("Skills", `<div class="space-y-3">${skills}</div>`)}
        ${section("Interests", `<p class="text-sm text-slate-300">${resume.interests}</p>`)}
      </div>
    </div>
    <div class="flex justify-center border-t border-white/10 pt-6">
      ${downloadButton()}
    </div>`;
}

// Top-level page elements the bottom menu links to — same targets the hero's
// "View Résumé" button uses ("hero" = main view, "resume" = résumé section).
const NAV_ITEMS: readonly { label: string; target: string }[] = [
  { label: "Main", target: "hero" },
  { label: "Résumé", target: "resume" },
];

/** A fixed, fully opaque bottom menu that scrolls to the page's sections. */
export function siteMenuHTML(): string {
  const items = NAV_ITEMS.map(
    (item) => `
      <button type="button" data-target="${item.target}"
        class="js-scroll-to text-sm font-medium text-slate-300 transition hover:text-sky-300 active:scale-95">
        ${item.label}
      </button>`,
  ).join("");

  return `
    <footer class="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-slate-950">
      <div class="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-4">
        ${items}
      </div>
    </footer>`;
}

// A Download-PDF button. Marked with `js-download-resume` so main.ts can wire
// up every instance (top and bottom of the résumé) at once.
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

/** Generate and download a clean, print-friendly résumé PDF.
 *  jsPDF is imported lazily so it only loads when the user clicks Download. */
export async function downloadResumePdf(): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 54;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header — name + title + contact.
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(...INK);
  doc.text(resume.name, margin, y);
  y += 20;
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(...ACCENT);
  doc.text(resume.title, margin, y);
  y += 15;
  doc.setFontSize(9).setTextColor(...MUTED);
  const { contact } = resume;
  doc.text(
    `${contact.email}  ·  ${contact.phone}  ·  ${contact.github}  ·  ${contact.linkedin}`,
    margin,
    y,
  );
  y += 16;
  doc.setDrawColor(...ACCENT).setLineWidth(1).line(margin, y, pageW - margin, y);
  y += 18;

  const heading = (title: string) => {
    ensureSpace(30);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...ACCENT);
    doc.text(title.toUpperCase(), margin, y);
    y += 14;
  };

  const paragraph = (text: string, size = 10) => {
    doc.setFont("helvetica", "normal").setFontSize(size).setTextColor(...INK);
    const lines = doc.splitTextToSize(text, contentW) as string[];
    for (const line of lines) {
      ensureSpace(size + 3);
      doc.text(line, margin, y);
      y += size + 3;
    }
  };

  const entryHeader = (left: string, right: string) => {
    ensureSpace(16);
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
        ensureSpace(13);
        if (i === 0) doc.text("•", margin, y);
        doc.text(line, margin + 14, y);
        y += 13;
      });
    }
  };

  // Summary.
  paragraph(resume.summary);
  y += 8;

  // Experience.
  heading("Experience");
  resume.experience.forEach((job, i) => {
    entryHeader(`${job.role} - ${job.org}`, job.period);
    bullets(job.points);
    if (i < resume.experience.length - 1) y += 6;
  });
  y += 8;

  // Projects.
  heading("Projects");
  resume.projects.forEach((proj, i) => {
    entryHeader(proj.name, proj.period);
    bullets(proj.points);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...ACCENT);
    proj.links.forEach((l) => {
      ensureSpace(12);
      doc.textWithLink(`${l.label}: ${l.url}`, margin + 14, y, { url: l.url });
      y += 12;
    });
    if (i < resume.projects.length - 1) y += 6;
  });
  y += 8;

  // Education.
  heading("Education");
  resume.education.forEach((ed) => {
    entryHeader(ed.degree, ed.period);
    doc.setFont("helvetica", "italic").setFontSize(9.5).setTextColor(...MUTED);
    ensureSpace(12);
    doc.text(ed.org, margin, y);
    y += 13;
    paragraph(ed.detail);
  });
  y += 8;

  // Skills.
  heading("Skills");
  Object.entries(resume.skills).forEach(([group, items]) => {
    ensureSpace(13);
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

  // Interests.
  heading("Interests");
  paragraph(resume.interests);

  doc.save("Liam-Brown-Resume.pdf");
}
