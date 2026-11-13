// hoZer's Utilities: the Unity toolkit that rides along in every project on
// this site. Described once here and rendered by the Tools tab in main.ts.
//
// The canonical copy lives in the newest jam project (currently Brackeys Game
// Jam 2026.2, the Trust - No - One repo), so anything written here should be
// checked against that folder rather than an older game's copy.

export interface Tool {
  name: string;
  /** One line on what it is. */
  tagline: string;
  /** The parts worth knowing about, one idea each. */
  points: readonly string[];
  /** Language, framework or subsystem labels for the chip row. */
  tags: readonly string[];
}

export const TOOLS: readonly Tool[] = [
  {
    name: "State Machine",
    tagline:
      "The spine of the toolkit. States are plain serialized objects, and one pump runs all of them.",
    points: [
      "A state is a plain class with its own fields, not a scriptable object or a graph node. The inspector configures it inline, on whichever machine runs it.",
      "One core pump, three bases: a MonoBehaviour machine, a FishNet networked twin, and a static one that boots itself into DontDestroyOnLoad before the first scene.",
      "Editor side: a Create menu that writes new states from a template, a shared inspector, and a monitor window listing every live machine with its state, its queue and its history.",
    ],
    tags: ["C#", "Unity", "Editor tooling", "FishNet"],
  },
  {
    name: "Dialogue Manager",
    tagline:
      "A text script compiles into a queue of states, streamed a character at a time.",
    points: [
      "Written as a plain text asset. Rich text, pauses and speed changes are commands in the body, and each one compiles to a state the machine runs in order.",
      "Any method tagged [DialogueBinding] is callable from the script by name, with arguments, so a line can open a shop or start a fight without its own parser.",
      "Banjo-Kazooie style voice: a short blip pitched at random, thinned to every Nth character, routed through whatever volume dial the game hands it.",
    ],
    tags: ["C#", "Unity", "TextMeshPro"],
  },
  {
    name: "Sprite Manager",
    tagline:
      "A SpriteRenderer replacement that animates in the shader and measures the sheet itself.",
    points: [
      "Frames come off a shared clock in the fragment shader. Two sprites at the same rate stay in phase, and the CPU ticks nothing.",
      "A scanner reads the sheet's pixels for clip lengths and for the box the art actually fills, so pivots land on the feet and padding never lifts a character off the floor.",
      "Camera-facing quads with a real projected shadow and a single-pass outline. One mesh, one material, per-sprite values riding in a MaterialPropertyBlock.",
    ],
    tags: ["C#", "HLSL", "Unity", "Rendering"],
  },
  {
    name: "Attributes",
    tagline: "A stat is a base value plus a stack of modifiers that can explain itself.",
    points: [
      "Modifiers are serializable objects applied in order, so a buff, a piece of gear and a difficulty setting stack without anyone writing the arithmetic twice.",
      "Recalculates either on read or on change, whichever suits how often the stat gets asked for.",
      "A drawer puts the base, the stack and the result on one inspector line. A reflection helper lists every stat on an object, so a readout picks up new ones with no second list to maintain.",
    ],
    tags: ["C#", "Unity", "Editor tooling"],
  },
  {
    name: "Playtest Harness",
    tagline:
      "Runs the game against a throwaway copy of the project, on a Windows desktop of its own.",
    points: [
      "Every run gets its own numbered copy, so a playtest never touches the working tree and two runs never fight over Unity's project lock.",
      "The editor opens on a separate Win32 desktop, where a window has no foreground to steal and can't take the keyboard away.",
      "A batchmode compile runs first, so a broken tree comes back as error lines instead of a modal dialog nobody is there to answer.",
    ],
    tags: ["Bash", "PowerShell", "Unity", "Automation"],
  },
  {
    name: "General Helpers",
    tagline: "The small pieces every project ends up wanting.",
    points: [
      "Duration: a struct timer that ticks on delta time and reports when it has run out, optionally at a multiple of real time.",
      "Gait and SpeedManager: a gait is one movement style, a max speed and an acceleration. The manager moves a transform toward it, and applies friction on the way back down.",
    ],
    tags: ["C#", "Unity"],
  },
];

/** One tool: what it is, then the parts worth knowing about. */
export function toolCardHTML(tool: Tool): string {
  const points = tool.points
    .map(
      (point) => `
      <li class="flex gap-2">
        <span class="mt-2 size-1 shrink-0 rounded-full bg-sky-400/70"></span>
        <span>${point}</span>
      </li>`,
    )
    .join("");

  const tags = tool.tags
    .map(
      (tag) => `
      <span class="rounded-md px-2 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-white/10">${tag}</span>`,
    )
    .join("");

  return `
    <article class="space-y-3">
      <header class="space-y-1">
        <h3 class="text-lg font-semibold text-slate-100">${tool.name}</h3>
        <p class="text-sm text-sky-400">${tool.tagline}</p>
      </header>
      <ul class="space-y-2 text-sm text-slate-300">${points}</ul>
      <div class="flex flex-wrap gap-2">${tags}</div>
    </article>`;
}
