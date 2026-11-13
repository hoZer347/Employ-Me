// Minimal Chrome DevTools Protocol driver: no dependencies, no install.
//
// Drives the shared Chrome that chrome-desktop.ps1 puts on its own Windows
// desktop (see CLAUDE.md, "Browser automation"), for when the MCP route is
// unavailable. Uses Node's built-in global WebSocket (Node 22+), so it runs
// from any directory without a node_modules nearby.
//
//   node cdp.mjs open <url>          open a NEW tab and make it the target
//   node cdp.mjs use <targetId>      re-target an existing tab
//   node cdp.mjs tabs                list tabs
//   node cdp.mjs goto <url>          navigate the current target
//   node cdp.mjs eval '<js>'         evaluate js in the target, print result
//   node cdp.mjs evalfile <path>     same, but read the js from a file
//   node cdp.mjs click <selector>    trusted mouse click at the element centre
//   node cdp.mjs clicktext <sel> <text>   click the match whose text is <text>
//   node cdp.mjs type <sel> <text>   insert text (survives + and # characters)
//   node cdp.mjs keytype <sel> <text>     clear, then type with real key events
//   node cdp.mjs press <Enter|Escape|Backspace|Tab>
//   node cdp.mjs upload <sel> <file>      set an <input type=file>
//   node cdp.mjs shot <path>         screenshot the target
//
// CDP_PORT overrides the debugging port (default 9333). CDP_WITHIN scopes
// clicktext to one container. The target tab id is remembered per-port under
// the user's home directory, so every command stays pinned to the tab this run
// opened rather than whatever tab happens to have focus.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

const PORT = process.env.CDP_PORT || "9333";
const BASE = `http://127.0.0.1:${PORT}`;
const STATE =
  process.env.CDP_STATE || join(homedir(), ".claude", `.cdp-target-${PORT}`);

async function http(path) {
  const res = await fetch(BASE + path);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function saveTarget(id) {
  mkdirSync(dirname(STATE), { recursive: true });
  writeFileSync(STATE, id, "utf8");
}

function loadTarget() {
  if (!existsSync(STATE)) throw new Error("no target tab; run `open` first");
  return readFileSync(STATE, "utf8").trim();
}

async function wsUrlFor(targetId) {
  const tabs = await http("/json/list");
  const tab = tabs.find((t) => t.id === targetId);
  if (!tab) throw new Error(`tab ${targetId} is gone`);
  return tab.webSocketDebuggerUrl;
}

/** Open one socket to a tab and run `fn(call)` over it, where `call(method,
 *  params)` is a promise-returning CDP request. One socket per command matters
 *  for input synthesis: a trusted click is a mousePressed and a mouseReleased
 *  that have to arrive in order on the same connection. */
function withSocket(wsUrl, fn) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let nextId = 1;
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("cdp call timed out"));
    }, 60000);
    const finish = (err, out) => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch {}
      if (err) reject(err);
      else resolve(out);
    };

    const call = (method, params = {}) =>
      new Promise((res, rej) => {
        const id = nextId++;
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params }));
      });

    ws.addEventListener("open", async () => {
      try {
        finish(null, await fn(call));
      } catch (err) {
        finish(err);
      }
    });
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.error) p.rej(new Error(JSON.stringify(msg.error)));
      else p.res(msg.result);
    });
    ws.addEventListener("error", () => finish(new Error("websocket error")));
  });
}

const onTarget = async (fn) => withSocket(await wsUrlFor(loadTarget()), fn);

async function evalOn(call, expression) {
  const result = await call("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
    allowUnsafeEvalBlockedByCSP: true,
  });
  if (result.exceptionDetails) {
    const e = result.exceptionDetails;
    throw new Error(e.exception?.description || e.text);
  }
  return result.result.value;
}

const evaluate = (expression) => onTarget((call) => evalOn(call, expression));

/** A real, trusted click at the centre of whatever the selector matches.
 *  Workday's widgets ignore a synthetic el.click() in plenty of places, so
 *  everything interactive goes through here instead. */
async function realClick(selector) {
  return onTarget(async (call) => {
    const box = await evalOn(
      call,
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        el.scrollIntoView({block: 'center', inline: 'center'});
        const r = el.getBoundingClientRect();
        return {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height};
      })()`,
    );
    if (!box) throw new Error(`no element for ${selector}`);
    if (box.w === 0 || box.h === 0) throw new Error(`${selector} has zero size`);
    const base = { x: box.x, y: box.y, button: "left", clickCount: 1 };
    await call("Input.dispatchMouseEvent", { ...base, type: "mouseMoved", button: "none" });
    await call("Input.dispatchMouseEvent", { ...base, type: "mousePressed" });
    await call("Input.dispatchMouseEvent", { ...base, type: "mouseReleased" });
    return box;
  });
}

/** Most of Workday's real targets (dropdown options, pill delete charms, "Add"
 *  links) have no stable id, only visible text. Tag the match with a throwaway
 *  attribute, then click that. `within` scopes the search, which matters
 *  because already-selected pills are also role=option. */
async function clickText(selector, text, within) {
  const found = await evaluate(`(() => {
    document.querySelectorAll('[data-cdp-pick]').forEach(e => e.removeAttribute('data-cdp-pick'));
    const scope = ${within ? `document.querySelector(${JSON.stringify(within)})` : "document"};
    if (!scope) return false;
    const want = ${JSON.stringify(text)};
    const el = [...scope.querySelectorAll(${JSON.stringify(selector)})]
      .find(e => e.innerText.trim() === want);
    if (!el) return false;
    el.setAttribute('data-cdp-pick', '1');
    return true;
  })()`);
  if (!found) throw new Error(`no ${selector} with text ${JSON.stringify(text)}`);
  return realClick("[data-cdp-pick]");
}

/** Insert text wholesale. Survives characters that key synthesis mangles, so
 *  this is the one to reach for when the value contains + or #. */
async function insertText(selector, text) {
  return onTarget(async (call) => {
    const ok = await evalOn(
      call,
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        el.scrollIntoView({block: 'center'});
        el.focus();
        return document.activeElement === el;
      })()`,
    );
    if (!ok) throw new Error(`could not focus ${selector}`);
    await call("Input.insertText", { text });
    return true;
  });
}

/** Clear, then type character by character with real key events. Workday's
 *  `selectinput` typeahead widgets listen for keydown and ignore insertText,
 *  so anything with a search-as-you-type prompt needs this. */
async function keyType(selector, text) {
  return onTarget(async (call) => {
    const ok = await evalOn(
      call,
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        el.scrollIntoView({block: 'center'});
        el.focus();
        const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
        d.set.call(el, '');
        el.dispatchEvent(new Event('input', {bubbles: true}));
        return document.activeElement === el;
      })()`,
    );
    if (!ok) throw new Error(`could not focus ${selector}`);
    for (const ch of text) {
      await call("Input.dispatchKeyEvent", {
        type: "keyDown",
        text: ch,
        unmodifiedText: ch,
        key: ch,
      });
      await call("Input.dispatchKeyEvent", { type: "keyUp", key: ch });
    }
    return true;
  });
}

/** Press a named key on whatever has focus. Some Workday prompts only run
 *  their search on Enter, and Enter also commits a free-text entry. */
async function pressKey(key) {
  const codes = { Enter: 13, Escape: 27, Backspace: 8, Tab: 9 };
  const code = codes[key];
  if (!code) throw new Error(`unsupported key ${key}`);
  return onTarget(async (call) => {
    const base = { key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code };
    await call("Input.dispatchKeyEvent", { ...base, type: "rawKeyDown" });
    await call("Input.dispatchKeyEvent", { ...base, type: "keyUp" });
    return true;
  });
}

/** Hand a real file to an <input type=file> without going near the OS file
 *  chooser, which CDP cannot drive. */
async function uploadFile(selector, filePath) {
  return onTarget(async (call) => {
    await call("DOM.enable");
    const { result } = await call("Runtime.evaluate", {
      expression: `document.querySelector(${JSON.stringify(selector)})`,
    });
    if (!result.objectId) throw new Error(`no file input for ${selector}`);
    await call("DOM.setFileInputFiles", { objectId: result.objectId, files: [filePath] });
    return true;
  });
}

const print = (v) =>
  console.log(typeof v === "string" ? v : JSON.stringify(v, null, 2));

const [cmd, ...rest] = process.argv.slice(2);
const arg = rest.join(" ");

switch (cmd) {
  case "open": {
    // PUT /json/new is what current Chrome wants. The tab is always new, so
    // nothing another agent opened gets navigated away.
    const res = await fetch(`${BASE}/json/new?${encodeURIComponent(arg)}`, {
      method: "PUT",
    });
    const tab = await res.json();
    saveTarget(tab.id);
    print({ id: tab.id, url: tab.url });
    break;
  }
  case "use":
    saveTarget(arg);
    console.log(`target = ${arg}`);
    break;
  case "tabs":
    print(
      (await http("/json/list")).map((t) => ({ id: t.id, title: t.title, url: t.url })),
    );
    break;
  case "goto":
    await onTarget((call) => call("Page.navigate", { url: arg }));
    console.log("ok");
    break;
  case "eval":
    print(await evaluate(arg));
    break;
  case "evalfile":
    print(await evaluate(readFileSync(arg, "utf8")));
    break;
  case "click":
    print(await realClick(arg));
    break;
  case "clicktext":
    print(await clickText(rest[0], rest.slice(1).join(" "), process.env.CDP_WITHIN));
    break;
  case "type":
    await insertText(rest[0], rest.slice(1).join(" "));
    console.log("typed");
    break;
  case "keytype":
    await keyType(rest[0], rest.slice(1).join(" "));
    console.log("typed");
    break;
  case "press":
    await pressKey(arg);
    console.log(`pressed ${arg}`);
    break;
  case "upload":
    await uploadFile(rest[0], rest.slice(1).join(" "));
    console.log("uploaded");
    break;
  case "shot": {
    const { data } = await onTarget((call) =>
      call("Page.captureScreenshot", { format: "png" }),
    );
    writeFileSync(arg, Buffer.from(data, "base64"));
    console.log(`wrote ${arg}`);
    break;
  }
  default:
    console.error(
      "usage: open|use|tabs|goto|eval|evalfile|click|clicktext|type|keytype|press|upload|shot",
    );
    process.exit(1);
}
