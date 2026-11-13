// Research-backed keyword bank for ATS and LLM resume screeners, scoped to the
// roles Liam actually targets (graphics, engines, C++ systems, algorithms).
// Sourced Sept 2026 from ATS/screening guides and live job postings; SOURCES at
// the bottom is rendered as citations on the page.
//
// Nothing here asserts what the resume says. `present()` in keywords-main.ts
// scans the real resume.ts data for each term, so the "already covered" vs
// "missing" split is computed rather than hand-maintained.

export interface Keyword {
  /** Canonical spelling, matched against the resume and shown on the chip. */
  term: string;
  /** Other spellings that should count as coverage (case-insensitive). */
  aliases?: string[];
  /** One line on why a screener cares. */
  note: string;
  /** How hard a screener leans on it for his target roles. */
  weight: "core" | "strong" | "adjacent";
  /** True when he would have to build or substantiate it before claiming it. */
  stretch?: boolean;
}

export interface KeywordGroup {
  name: string;
  blurb: string;
  keywords: Keyword[];
}

export const GROUPS: KeywordGroup[] = [
  {
    name: "Languages & standards",
    blurb:
      "Screeners match language names literally, and a version marker separates people who wrote C++ in 2012 from people writing it now.",
    keywords: [
      { term: "C++", note: "The single highest-weight token on your resume. Belongs in the title line, the skills block, and at least three bullets.", weight: "core" },
      { term: "C", note: "A distinct token from C++ in most parsers. Worth spelling out as 'C and C++'.", weight: "strong" },
      { term: "Modern C++", aliases: ["C++17", "C++20", "C++11", "C++14", "C++23"], note: "Naming a standard (C++17, C++20) is a common posting requirement and proves the experience is current.", weight: "core" },
      { term: "STL", aliases: ["Standard Template Library"], note: "Appears in a large share of C++ postings as an explicit requirement line.", weight: "strong" },
      { term: "RAII", note: "Reads as real C++ fluency to a human, and matches senior C++ postings.", weight: "adjacent" },
      { term: "Template metaprogramming", aliases: ["templates"], note: "Common in engine and library postings. Only claim it where you genuinely used it.", weight: "adjacent" },
      { term: "C#", note: "Carried by the iCAD and Unity work. Keep it prominent for engine and tools roles.", weight: "strong" },
      { term: "Python", note: "Almost always a listed secondary language, including on graphics teams for tooling.", weight: "strong" },
      { term: "GLSL", note: "The shader language token. Pairs with OpenGL in nearly every rendering posting.", weight: "core" },
      { term: "HLSL", note: "The DirectX shader language. Adds coverage of Windows and console rendering postings.", weight: "adjacent", stretch: true },
      { term: "Rust", note: "Rising fast in 2026 systems postings. One side project would unlock a wide band of listings.", weight: "adjacent", stretch: true },
    ],
  },
  {
    name: "Graphics & GPU",
    blurb:
      "Your differentiator, and also the group where postings use the most literal, unforgiving vocabulary. Semantic matching will not invent 'Vulkan' for you.",
    keywords: [
      { term: "OpenGL", note: "Already covered. Anchor it to a shipped result instead of leaving it in a list.", weight: "core" },
      { term: "Real-time rendering", aliases: ["real time rendering"], note: "The phrase postings use for the discipline itself. Say it outright.", weight: "core" },
      { term: "Rendering pipeline", note: "Covered by the engine project. Repeat it in the summary line too.", weight: "core" },
      { term: "Shader programming", aliases: ["shaders", "shader"], note: "A distinct token from GLSL. Both should appear.", weight: "core" },
      { term: "Vulkan", note: "The biggest single gap. It heads the requirement list on most 2026 graphics postings and pays the most to add.", weight: "core", stretch: true },
      { term: "DirectX", aliases: ["Direct3D", "DX12"], note: "Second biggest gap, especially for Windows, console, and CAD employers.", weight: "strong", stretch: true },
      { term: "Metal", note: "Only matters for Apple-platform postings. Low priority.", weight: "adjacent", stretch: true },
      { term: "CUDA", note: "Already covered, and a high-value token for GPGPU, simulation, and ML infrastructure roles.", weight: "core" },
      { term: "Compute shaders", aliases: ["compute shader", "GPGPU"], note: "Bridges the graphics and CUDA halves of your profile into one story.", weight: "strong" },
      { term: "Linear algebra", note: "Named explicitly in graphics postings, and absent from most engineers' resumes.", weight: "core" },
      { term: "Blinn-Phong", aliases: ["Blinn Phong", "Phong"], note: "Already covered. Fine as a detail, but not what recruiters search for.", weight: "adjacent" },
      { term: "PBR", aliases: ["physically based rendering"], note: "The modern shading model postings ask for. Blinn-Phong on its own reads as dated.", weight: "strong", stretch: true },
      { term: "RenderDoc", note: "The standard graphics debugger. Naming it proves hands-on pipeline debugging.", weight: "strong" },
      { term: "Nsight", aliases: ["PIX"], note: "GPU profiling tools. Pair with a measured frame time win.", weight: "adjacent" },
      { term: "Frustum culling", aliases: ["culling"], note: "Concrete optimization vocabulary a rendering lead scans for.", weight: "strong" },
      { term: "Level of detail", aliases: ["LOD"], note: "Standard scene optimization token in engine postings.", weight: "adjacent" },
      { term: "Scene graph", note: "Architecture vocabulary for engine roles.", weight: "adjacent" },
      { term: "Collision detection", aliases: ["collision"], note: "Already covered by the engine project. Keep the full phrase intact.", weight: "strong" },
      { term: "Spatial partitioning", aliases: ["BVH", "octree", "quadtree"], note: "Shows the collision work was structural, not a brute-force loop.", weight: "strong" },
      { term: "Frame time", aliases: ["frame rate", "framerate", "FPS"], note: "The unit graphics teams measure in. Use it to quantify a bullet.", weight: "strong" },
      { term: "3D mathematics", aliases: ["3D math", "quaternion", "matrix math"], note: "A direct lift from posting requirement lines.", weight: "strong" },
      { term: "Computational geometry", aliases: ["mesh generation", "mesh processing"], note: "Describes the iCAD crown and abutment work far better than the current wording.", weight: "strong" },
    ],
  },
  {
    name: "Systems & performance",
    blurb:
      "The vocabulary separating a C++ user from a C++ engineer. Systems-adjacent and hardware-vendor postings weight this group heavily.",
    keywords: [
      { term: "Multithreading", aliases: ["multithreaded", "multi-threaded"], note: "Already covered, and one of the most searched C++ tokens overall.", weight: "core" },
      { term: "Concurrency", note: "Ranked alongside memory management as an essential C++ resume keyword. You have the substance but not the word.", weight: "core" },
      { term: "Thread pool", aliases: ["task scheduler", "job system"], note: "Names the mechanism behind 'fully utilizing every CPU thread'.", weight: "strong" },
      { term: "Lock-free", aliases: ["lock free", "atomics", "std::atomic"], note: "A strong senior signal. Only claim it if the engine actually does this.", weight: "adjacent" },
      { term: "Memory management", note: "Listed as a core C++ keyword in essentially every guide, and missing today.", weight: "core" },
      { term: "Cache locality", aliases: ["cache-friendly", "data locality", "false sharing"], note: "Precise performance vocabulary that reads as genuine low-level experience.", weight: "strong" },
      { term: "SIMD", aliases: ["vectorization", "AVX", "SSE"], note: "High-signal token for performance-focused C++ postings.", weight: "adjacent", stretch: true },
      { term: "Performance optimization", aliases: ["performance tuning"], note: "The plain-language phrase recruiters actually type into the search box.", weight: "core" },
      { term: "Profiling", aliases: ["profiler", "VTune"], note: "Postings ask for 'proven experience profiling and optimizing real-time systems' almost verbatim.", weight: "core" },
      { term: "Low-level programming", aliases: ["low level"], note: "On both your degree line and the postings. Keep it.", weight: "strong" },
      { term: "Data-oriented design", aliases: ["data oriented"], note: "Pairs naturally with the entity component system you already built.", weight: "strong" },
      { term: "Entity component system", aliases: ["ECS", "entity-component"], note: "Already covered. Spell out both the phrase and the acronym, since parsers treat them as different tokens.", weight: "strong" },
      { term: "Latency", note: "One of the two units screeners look for in a quantified systems bullet.", weight: "strong" },
      { term: "Throughput", note: "The other one. Use whichever the work genuinely moved.", weight: "adjacent" },
      { term: "Valgrind", note: "Named in C++ guides as the keyword for leak and memory-error work.", weight: "adjacent" },
      { term: "GDB", aliases: ["LLDB", "debugger"], note: "Signals Linux-side comfort, which your resume does not currently show.", weight: "adjacent" },
      { term: "Sanitizers", aliases: ["AddressSanitizer", "ASan", "ThreadSanitizer", "TSan"], note: "The modern answer to 'how did you find the memory errors'. Very strong on a bug-hunting bullet.", weight: "strong" },
    ],
  },
  {
    name: "Networking & web",
    blurb:
      "The half of your profile that unlocks backend and tools postings, currently compressed into one skills line.",
    keywords: [
      { term: "TCP", aliases: ["TCP/IP"], note: "Already covered. Move it into a bullet so it carries weight.", weight: "strong" },
      { term: "UDP", note: "Already covered, and a real differentiator for multiplayer and simulation roles.", weight: "strong" },
      { term: "WebSockets", aliases: ["WebSocket"], note: "Already covered. Common in real-time tooling postings.", weight: "strong" },
      { term: "Client-server architecture", aliases: ["client-server", "client server"], note: "The iCAD work is exactly this. Say the full phrase, not just 'interface'.", weight: "core" },
      { term: "Socket programming", aliases: ["sockets", "Winsock", "Berkeley sockets"], note: "The literal token networking postings use.", weight: "strong" },
      { term: "Boost", aliases: ["Boost.Asio", "Asio"], note: "Already covered. Naming Boost.Asio specifically is much stronger than 'Boost'.", weight: "adjacent" },
      { term: "WebAssembly", aliases: ["WASM"], note: "Already covered, and a rising 2026 keyword in both frontend and systems postings.", weight: "strong" },
      { term: "Emscripten", note: "Already covered. The concrete toolchain behind the WebAssembly claim.", weight: "strong" },
      { term: "Serialization", aliases: ["serialisation", "protobuf", "protocol buffers"], note: "Describes both the Corel clipboard work and the networking layer.", weight: "strong" },
      { term: "REST API", aliases: ["RESTful", "HTTP API"], note: "Named as a filter term that drops even senior engineers below threshold when missing.", weight: "adjacent", stretch: true },
      { term: "gRPC", note: "Increasingly common in C++ service postings.", weight: "adjacent", stretch: true },
    ],
  },
  {
    name: "Engines, build & tooling",
    blurb:
      "Tool names raise machine scores more than almost anything else, and these are the cheapest gaps to close because you already use most of them daily.",
    keywords: [
      { term: "Unity", note: "Already covered. Keep it near the top for engine and simulation roles.", weight: "strong" },
      { term: "Unreal Engine", aliases: ["Unreal", "UE5"], note: "Paired with Unity in most game and simulation postings. One jam project would cover it.", weight: "adjacent", stretch: true },
      { term: "Git", note: "Already covered. A baseline expectation, cheap to keep.", weight: "strong" },
      { term: "CMake", note: "The default C++ build system in postings, and currently missing entirely.", weight: "core" },
      { term: "Visual Studio", aliases: ["MSVC"], note: "Already covered. Add MSVC as the compiler token as well.", weight: "strong" },
      { term: "Cross-platform", aliases: ["cross platform"], note: "Windows plus a WebAssembly browser target already qualifies. Say so.", weight: "strong" },
      { term: "Linux", note: "Requested constantly, absent from your resume. Even 'built and tested on Linux' closes it.", weight: "core", stretch: true },
      { term: "CI/CD", aliases: ["continuous integration", "GitHub Actions", "Jenkins"], note: "Already covered. Naming the actual system beats the acronym alone.", weight: "strong" },
      { term: "Docker", aliases: ["containerization", "containers"], note: "A broad filter term across backend and tooling postings.", weight: "adjacent", stretch: true },
      { term: "Agile", aliases: ["Scrum", "Kanban", "sprint"], note: "Ranks in the top ten most-matched software skills overall, and you have three jobs of it undeclared.", weight: "core" },
      { term: "Code review", note: "Concrete collaboration evidence, and it substantiates the mentoring bullet.", weight: "strong" },
      { term: "Technical documentation", aliases: ["documentation"], note: "Frequently a listed responsibility, rarely on candidate resumes.", weight: "adjacent" },
    ],
  },
  {
    name: "Algorithms & correctness",
    blurb:
      "The Kinaxis half of your profile. Right now it is written as duties, which is the exact shape the ranking layer scores lowest.",
    keywords: [
      { term: "Algorithm design", aliases: ["algorithms", "algorithm"], note: "Already covered by the title. Reinforce it inside bullets.", weight: "core" },
      { term: "Data structures", note: "The standard pairing with algorithms in every posting and search.", weight: "core" },
      { term: "Computational complexity", aliases: ["time complexity", "Big-O", "big o"], note: "Backs the LeetCode interest with professional vocabulary.", weight: "strong" },
      { term: "Optimization algorithms", aliases: ["heuristics", "constraint solving", "solver"], note: "The precise description of core planning algorithm work.", weight: "strong" },
      { term: "Supply chain planning", aliases: ["supply chain"], note: "A domain keyword. It matters to any employer adjacent to that industry and costs nothing.", weight: "adjacent" },
      { term: "Unit testing", aliases: ["unit test"], note: "'Automated tests' does not match this token. Spell it out.", weight: "core" },
      { term: "Regression testing", aliases: ["regression test"], note: "You literally did this. The word 'regressions' alone may not match the phrase.", weight: "core" },
      { term: "Test automation", aliases: ["automated testing", "automated tests"], note: "Already partly covered. Standardize on the phrase postings use.", weight: "strong" },
      { term: "Test-driven development", aliases: ["TDD"], note: "Listed in the testing section of most engineering keyword sets.", weight: "adjacent" },
      { term: "Root cause analysis", note: "The hiring-side phrase for 'investigated and resolved complex bugs'. A straight swap, large gain.", weight: "core" },
      { term: "Debugging", note: "A plain, high-frequency token that your current wording dances around.", weight: "strong" },
      { term: "Code coverage", note: "Gives the testing bullet a number to attach to.", weight: "adjacent" },
      { term: "Numerical stability", aliases: ["floating point", "determinism", "deterministic"], note: "A strong signal for both graphics and planning algorithm work.", weight: "adjacent" },
    ],
  },
  {
    name: "AI & LLM tooling",
    blurb:
      "The fastest-growing keyword group of 2026, and you have genuine production experience that your resume currently spends four words on. Claim only what you built.",
    keywords: [
      { term: "AI agents", aliases: ["AI agent", "agentic"], note: "Already covered, barely. This is the term hiring teams are searching hardest for right now.", weight: "core" },
      { term: "LLM", aliases: ["large language model"], note: "The token that actually gets indexed. 'AI agents' alone does not imply it to a parser.", weight: "core" },
      { term: "Prompt engineering", note: "A standard listed skill across 2026 engineering postings, not just AI-specialist ones.", weight: "strong" },
      { term: "Tool calling", aliases: ["function calling"], note: "Names the actual mechanism, which reads as implementation rather than API usage.", weight: "strong" },
      { term: "Model Context Protocol", aliases: ["MCP"], note: "Current, specific, and rare on resumes. High differentiation if the agent work used it.", weight: "strong" },
      { term: "Agentic workflows", aliases: ["multi-step agent", "agent workflow", "multi-agent"], note: "Guides advise this phrasing over 'LLM app' because it implies system boundaries.", weight: "strong" },
      { term: "Structured outputs", aliases: ["structured output", "JSON schema"], note: "Production-readiness vocabulary that separates builders from demo writers.", weight: "adjacent" },
      { term: "Guardrails", aliases: ["evaluation", "evals", "human-in-the-loop"], note: "Hiring teams sort on whether an agent stays governable outside a demo.", weight: "strong" },
      { term: "Developer tooling", aliases: ["internal tooling", "developer productivity"], note: "Frames the agent work as engineering impact rather than a hobby.", weight: "strong" },
      { term: "RAG", aliases: ["retrieval-augmented generation", "retrieval augmented"], note: "A top-listed AI keyword for 2026. Include it only if retrieval was genuinely part of the system.", weight: "adjacent", stretch: true },
    ],
  },
  {
    name: "Titles & framing",
    blurb:
      "Recruiters search job titles more than any other field, and a title nobody types is a title nobody finds. These are the strings worth mirroring from the postings you want.",
    keywords: [
      { term: "Graphics Programmer", note: "The most-searched title for the work you do, and your current title does not match it.", weight: "core" },
      { term: "Rendering Engineer", note: "The other half of the same market, common at engine and hardware companies.", weight: "core" },
      { term: "C++ Software Engineer", aliases: ["C++ Developer"], note: "The widest net by volume. Worth being the literal title on one resume variant.", weight: "core" },
      { term: "Game Engine Programmer", aliases: ["engine programmer"], note: "Matches studios and middleware employers.", weight: "strong" },
      { term: "Software Engineer", note: "Plain and boring, and it matches thousands of postings your current title misses.", weight: "core" },
      { term: "Mentorship", aliases: ["mentored", "mentoring"], note: "Already covered. One of the few soft skills that reliably lifts a ranking.", weight: "strong" },
      { term: "Cross-functional collaboration", aliases: ["cross-functional", "collaborated"], note: "Graphics postings explicitly ask for working with artists and designers.", weight: "strong" },
      { term: "Stakeholder communication", note: "Among the most common 2026 keywords across all resumes studied. Cheap coverage.", weight: "adjacent" },
      { term: "Ownership", aliases: ["owned", "led", "spearheaded"], note: "Action verbs the ranking layer reads as seniority.", weight: "strong" },
    ],
  },
];

// --- Rewrite lab -----------------------------------------------------------
// Each pair takes a line that is actually on his resume today and rewrites it
// in the shape screeners score highest: action verb, keywords in context,
// measured result. Bracketed placeholders are his to fill with real numbers.

export interface Rewrite {
  context: string;
  before: string;
  after: string;
  adds: string[];
}

export const REWRITES: Rewrite[] = [
  {
    context: "Summary",
    before:
      "Software developer with a deep background in C++ and a love for computer graphics, systems, and networking.",
    after:
      "C++ software engineer with 7 years across real-time rendering, high-performance systems, and networked applications. Builds OpenGL and GLSL rendering pipelines, multithreaded engines profiled to the frame, and client-server tooling in C++, C#, and Python.",
    adds: ["C++ Software Engineer", "Real-time rendering", "OpenGL", "GLSL", "Rendering pipeline", "Multithreading", "Profiling", "Client-server architecture"],
  },
  {
    context: "Kinaxis, testing",
    before:
      "Wrote thorough automated tests to verify algorithm correctness and guard against regressions.",
    after:
      "Built unit and regression test suites for core planning algorithms in C++, raising code coverage on the module from [X]% to [Y]% and catching [N] correctness defects before release.",
    adds: ["Unit testing", "Regression testing", "Algorithm design", "Code coverage", "C++"],
  },
  {
    context: "Kinaxis, debugging",
    before:
      "Investigated and resolved complex, hard-to-reproduce bugs across the codebase.",
    after:
      "Debugged memory errors in a large multithreaded C++ codebase with sanitizers, profilers, and debuggers, on a team that shipped zero unforgivable defects for a full year.",
    adds: ["Root cause analysis", "Multithreading", "Sanitizers", "Profiling", "Memory management", "Debugging"],
  },
  {
    context: "Kinaxis, AI work",
    before: "Created and maintained efficient AI agents, skills, etc.",
    after:
      "Designed and maintained internal LLM agents for developer tooling, defining tool calling interfaces, structured outputs, and evaluation guardrails, cutting [task] turnaround from [X] hours to [Y] minutes for a team of [N].",
    adds: ["LLM", "AI agents", "Developer tooling", "Tool calling", "Structured outputs", "Guardrails", "Agentic workflows"],
  },
  {
    context: "iCAD Dental, product",
    before:
      "Built a client-server interface for displaying and painting teeth for dental technicians, in C# on the Unity engine.",
    after:
      "Developed a cross-platform client-server application in C# on Unity for real-time 3D visualization and vertex painting of dental scans, holding interactive frame times on meshes of [N] triangles for [N] technicians.",
    adds: ["Client-server architecture", "Cross-platform", "Unity", "C#", "Real-time rendering", "Frame time"],
  },
  {
    context: "iCAD Dental, geometry",
    before: "Helped develop techniques for generating dental abutments and crowns.",
    after:
      "Implemented computational geometry and mesh generation algorithms for dental abutments and crowns, speeding the design system up from minutes to seconds.",
    adds: ["Computational geometry", "Algorithm design", "3D mathematics"],
  },
  {
    context: "iCAD Dental, mentoring",
    before: "Mentored other developers in C++ and graphics optimization.",
    after:
      "Mentored [N] developers in modern C++ and GPU performance optimization through code review and pair programming, establishing profiling practices the team still runs.",
    adds: ["Mentorship", "Modern C++", "Performance optimization", "Code review", "Profiling"],
  },
  {
    context: "Corel, features",
    before: "Wrote new features for CorelDRAW's copy-paste functionality.",
    after:
      "Shipped clipboard and data-interchange features in a C++ desktop application with [N] million users, covering cross-application serialization of vector and raster content.",
    adds: ["C++", "Serialization", "Ownership"],
  },
  {
    context: "Corel, imaging",
    before:
      "Integrated WebP into the software stack and built a Photoshop-style layer hierarchy.",
    after:
      "Integrated the WebP codec into a production C++ imaging pipeline and designed a hierarchical layer model with non-destructive compositing, cutting exported asset size by [X]%.",
    adds: ["C++", "Data structures", "Performance optimization"],
  },
  {
    context: "Corel, diagnosis",
    before:
      "Leveraged Visual Studio Enterprise's full toolset to diagnose and resolve issues.",
    after:
      "Diagnosed memory leaks, performance regressions, and crashes with Visual Studio profiling and static analysis, reducing crash reports in the affected module by [X]%.",
    adds: ["Visual Studio", "Memory management", "Profiling", "Root cause analysis", "Debugging"],
  },
  {
    context: "Graphics Engine v4",
    before:
      "A rendering pipeline written from scratch, with a custom entity-component system, Blinn-Phong shading, and efficient object collision. Heavy emphasis on multithreading, fully utilizing every CPU thread.",
    after:
      "Authored a real-time rendering engine in modern C++ and GLSL on OpenGL: custom entity component system, Blinn-Phong shading, frustum culling, and broad-phase collision detection over a spatial partition. Parallelized update and render across a thread pool sized to the machine, improving frame time by [X]% on [N]-core hardware.",
    adds: ["Real-time rendering", "Modern C++", "Entity component system", "Frustum culling", "Spatial partitioning", "Thread pool", "Frame time", "Concurrency"],
  },
  {
    context: "Loom",
    before:
      "A consolidated codebase unifying all of my C++ projects: graphics engine, website backend, and a WebAssembly build.",
    after:
      "Unified C++ monorepo spanning a graphics engine, a TCP and UDP backend, and an Emscripten build targeting WebAssembly in the browser, built with CMake and validated by CI on every commit.",
    adds: ["C++", "TCP", "UDP", "Emscripten", "WebAssembly", "CMake", "CI/CD", "Cross-platform"],
  },
];

// --- Rules -----------------------------------------------------------------

export interface Rule {
  do: boolean;
  title: string;
  body: string;
}

export const RULES: Rule[] = [
  { do: true, title: "Aim for 25 to 35 unique keywords", body: "That is the band optimization guides converge on. Past roughly 40 distinct terms, common ATS platforms begin scoring the document as stuffed." },
  { do: true, title: "Repeat the top terms 3 to 4 times", body: "For you that means C++, graphics or OpenGL, multithreading, and performance each appear in the title line, the summary, the skills block, and inside a bullet." },
  { do: true, title: "Put keywords inside bullets, not only in a list", body: "Contextualized keywords in achievement bullets rank measurably higher than the same words sitting alone in a skills section." },
  { do: true, title: "Write action verb plus measured result", body: "A bullet that ends in a number outranks the same bullet without one. Frame time, percent, count, and hours all work." },
  { do: true, title: "Use the boring section headings", body: "Work Experience, Skills, Education. Parsers route content by these labels, and a clever heading can drop an entire section on the floor." },
  { do: true, title: "Keep one column and no graphics", body: "Tables, text boxes, sidebars, and icons are the most common reason a resume is rejected before any model reads it. Text-based PDF or Word only." },
  { do: true, title: "Keep two variants", body: "One graphics and rendering resume, one C++ systems and algorithms resume. The title line and top three bullets change, the rest mostly does not." },
  { do: false, title: "Do not hide text or inject prompts", body: "Duke researchers found injected instructions in about 1 percent of 200,000 real resumes, and one large staffing firm reports hidden text in roughly 10 percent of what it scans. Screeners flatten documents to plain text, so it surfaces as a manipulation flag rather than a boost." },
  { do: false, title: "Do not paste the job description back", body: "Near-verbatim overlap with the posting is detected and read as gaming. Mirror the specific terms you genuinely have, and write the rest in your own words." },
  { do: false, title: "Do not rely on synonyms for tools and titles", body: "Semantic matching handles 'developer' against 'engineer' fine. It will not turn OpenGL into Vulkan, or an unnamed engine into Unreal. Tool names and titles have to match literally." },
  { do: false, title: "Do not leave dead weight on the page", body: "Legacy technology nobody asked for competes for the same keyword budget as the terms that would actually rank you." },
];

// --- How the pipeline works ------------------------------------------------

export const PIPELINE: { step: string; title: string; body: string }[] = [
  {
    step: "1",
    title: "Parse",
    body: "The document is flattened to plain text and routed into fields by its headings. Columns, tables, and text boxes scramble this, and a scrambled resume is rejected before anything intelligent runs.",
  },
  {
    step: "2",
    title: "Knockout & keyword filter",
    body: "Screening questions and hard requirements cut first. Recruiters then search the database by job title, tool name, and years of experience, so a resume missing those literal strings never surfaces.",
  },
  {
    step: "3",
    title: "Semantic match",
    body: "Modern screeners embed the resume and the posting into the same space and measure alignment, so 'developer' matches 'engineer' and experience can imply a skill. Exact synonyms matter less than they did, but tool names and titles still have to be there.",
  },
  {
    step: "4",
    title: "LLM rank",
    body: "A model summarizes and scores each surviving candidate, often on a numeric or letter scale, and the recruiter reads from the top down. This is a ranked queue, not a pass mark, so being adequate is the same as being invisible.",
  },
];

// --- Sources ---------------------------------------------------------------

export const SOURCES: { label: string; url: string }[] = [
  { label: "Jobscan, How AI Résumé Screening Works in 2026", url: "https://www.jobscan.co/blog/blog-ai-resume-screening/" },
  { label: "QuickApply, 2026 Software Engineer Resume Keywords", url: "https://blog.quickapply.dev/post/2026-software-engineer-resume-keywords-the-ultimate-ai-ready-optimization-guide" },
  { label: "ResumeAdapter, Software Engineer Resume Keywords (2026 ATS data)", url: "https://www.resumeadapter.com/blog/software-engineer-resume-keywords" },
  { label: "Resume Worded, Software Engineering Skills and Keywords", url: "https://resumeworded.com/skills-and-keywords/software-engineering-skills-group" },
  { label: "ATS Verification, AI Resume Screening in 2026", url: "https://atsverification.com/blog/ai-resume-screening-2026/" },
  { label: "StylingCV, Resume Keywords 2026", url: "https://stylingcv.com/blog/resume-keywords-2026-ultimate-guide-ats/" },
  { label: "Underdog.io, Showcasing Agentic AI Development on Your Resume", url: "https://underdog.io/blog/agentic-ai-development-on-your-resume" },
  { label: "ResumeAdapter, AI Engineer Resume Keywords (2026)", url: "https://www.resumeadapter.com/blog/ai-engineer-resume-keywords" },
  { label: "Duke Pratt School of Engineering, Thwarting Hidden Resume Hacks Targeting AI Hiring Tools", url: "https://pratt.duke.edu/news/thwarting-prompt-injection/" },
  { label: "Hiration, The White-Text Resume Hack Will Get You Rejected", url: "https://www.hiration.com/blog/white-text-resume-hack/" },
  { label: "ZipRecruiter, Vulkan / OpenGL / DirectX job listings", url: "https://www.ziprecruiter.com/Jobs/Vulkan-Opengl-Directx" },
  { label: "DigiPen Online, Game Developer Skills Employers Want in 2026", url: "https://online.digipen.edu/blog/in-demand-game-developer-skills" },
  { label: "VisualCV, Top C++ Skills on a Résumé", url: "https://www.visualcv.com/resume-skills/c-plus-plus/" },
];
