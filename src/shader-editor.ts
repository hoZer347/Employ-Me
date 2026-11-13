// The code box beside each shader demo on the Engine tab.
//
// It holds the demo's shader file, fetched from its build, coloured as Loom's
// shader editor colours it by a copy laid under the transparent text, and grows
// to fit the file. It hands every edit to the running player through
// loom_edit_shader, which compiles it in place of the file between frames,
// unless the text is what was last sent. The player answers each edit with a
// "loomshader" event on its window, carrying why it did not compile, if it
// did not. The scene's frame stays inert: this box is the only input.

import { highlight } from "./glsl";

interface LoomModule {
  initialized?: boolean;
  ccall: (name: string, returns: null, args: string[], values: string[]) => void;
}

interface LoomWindow extends Window {
  Module?: LoomModule;
}

interface ShaderEdited {
  path: string;
  error: string;
}

/** How long typing has to pause before the edit is compiled. */
const SETTLE_MS = 300;

/** How often to look again for a player that is still starting. */
const RETRY_MS = 250;

const INDENT = "\t";

/**
 * Fills `code` with the file at `file` under `base`, coloured in `colors`, and
 * from then on compiles each edit to it in the player in `iframe`, writing why
 * one did not compile into `error`.
 */
export async function attachShaderEditor(
  code: HTMLTextAreaElement,
  colors: HTMLElement,
  error: HTMLElement,
  iframe: HTMLIFrameElement,
  base: string,
  file: string,
): Promise<void> {
  const res = await fetch(`${base}/${file}`, { cache: "no-store" });
  code.value = res.ok ? await res.text() : "";
  code.disabled = !res.ok;

  // A trailing newline holds the copy's last line open, as the box does.
  const paint = () => {
    colors.innerHTML = `${highlight(code.value)}\n`;
  };
  paint();

  const player = () => iframe.contentWindow as LoomWindow | null;
  let listening: Window | null = null;
  let settle = 0;
  let sent = code.value;

  const listen = (win: Window) => {
    if (listening === win) return;
    listening = win;
    win.addEventListener("loomshader", (event) => {
      const edited = (event as CustomEvent<ShaderEdited>).detail;
      if (edited.path === file) error.textContent = edited.error;
    });
  };

  const send = () => {
    const win = player();
    if (!win?.Module?.initialized) {
      settle = window.setTimeout(send, RETRY_MS);
      return;
    }
    listen(win);
    if (code.value === sent) return;
    sent = code.value;
    win.Module.ccall("loom_edit_shader", null, ["string", "string"], [file, code.value]);
  };

  code.addEventListener("input", () => {
    paint();
    window.clearTimeout(settle);
    settle = window.setTimeout(send, SETTLE_MS);
  });

  code.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    event.preventDefault();
    code.setRangeText(INDENT, code.selectionStart, code.selectionEnd, "end");
    code.dispatchEvent(new Event("input"));
  });
}
