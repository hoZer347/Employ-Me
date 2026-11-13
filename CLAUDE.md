# Project guidance for Claude

## Commits

- Do **not** add Claude/Anthropic as a commit author or co-author.
- Do not append `Co-Authored-By: Claude ...` trailers or any
  "Generated with Claude" lines to commit messages.
- Commits should be authored solely by the human developer.

## Copy / text style

- Do **not** use dashes as punctuation in user-facing **body text**
  (the prose strings rendered on the page, e.g. the hero blurb and resume
  summary/bullet points). Use commas, colons, or restructured sentences
  instead. This applies to em-dashes (—), en-dashes (–), and the spaced
  hyphen used as a punctuation break ( - ).
- Write **"Resume"**, never "Résumé" or "resumé". No accents, anywhere:
  tab labels, buttons, headings, prose, comments. The only exceptions are
  quoted titles of other people's articles (see the citation list in
  `src/keyword-data.ts`), which keep whatever spelling the source used.
  This one keeps coming back, so treat an accented spelling as a bug.
- Hyphens are fine where they are not body-text punctuation: compound
  words (e.g. "client-server"), the title/role separators, and the
  date-range separators (e.g. "Apr 2025 - Jun 2026").

## Engine demos

- The Engine tab's Loom demos never take user input: no clicking, dragging,
  keys, scrolling or focus. Their frames are inert, and a demo's scripts
  never read Loom's `Input` or `InputActions`. `test/engine-wiring.test.mjs`
  enforces both. The one input is the code box beside a shader demo, which
  edits that demo's shader and nothing else.
- The demos are live: `tools/live-builds.mjs` rebuilds them when Loom's
  engine sources (`Loom WASM`, `Loom ImGui`), web player, web build scripts
  or `Demo Sources` change, and republishes a build only once it passes the
  engine tests and loads in Chrome without error. Loom's merge runs
  `tools/check-loom.mjs`, the same check, first. A change to how they build
  keeps both working, and passes `node tools/check-loom.mjs <loom>` before
  review.

## Browser testing (Chrome DevTools MCP)

- Open a **new** page for each test run (`new_page`), and record its page
  index/URL so it can be identified later.
- When the run finishes, clean up after yourself: `close_page` on **only**
  the tab(s) this run opened. Do this even if the test failed.
- Never close tabs you did not open, and never close the last remaining
  tab or the browser itself. Other agents may be driving the same Chrome
  instance, and closing their tabs breaks their runs.
- If you navigated an existing tab instead of opening one, leave it open;
  do not try to restore its previous URL.

## Browser automation: one shared browser, off the interactive desktop

There is a single Chrome for every Claude session, and it lives on a Windows
desktop of its own (`WinSta0\ClaudeChrome`). A process started with
`STARTUPINFO.lpDesktop` set is bound to that desktop for its lifetime, so its
windows never reach the interactive desktop and cannot raise themselves, take
focus, or move the caret out from under whatever the human is typing into.

`tools/chrome-desktop.ps1` starts it, on port 9333 against a profile directory
of its own (`C:/Users/3hoze/.chrome-desktop-profile`), and is idempotent: if the
port already answers it returns the existing endpoint. The `chrome-devtools` MCP
server runs that script and then connects with
`--browserUrl http://127.0.0.1:9333`, so it no longer launches a browser itself.

The profile is private to this browser because Chrome's process singleton is per
profile directory and cannot be found across desktops. A second Chrome on the
same directory does not relay its arguments to the first, it aborts with "Failed
to create a ProcessSingleton for your profile directory". Never point anything
else at that directory, and if the launcher reports it, close the Chrome holding
it rather than retrying.

- `powershell -NoProfile -ExecutionPolicy Bypass -File
  "C:\Users\3hoze\Desktop\website\tools\chrome-desktop.ps1" -Show -Url <url>`
  restarts the browser as a normal window on the human's desktop, same profile
  and port, which is how they sign in to a site. `-Hide` closes it cleanly and
  restarts it hidden; run it once the sign-in shows over CDP. Both restart the
  browser other sessions share, so both refuse while it has pages open; pass
  `-Force` only once those are known to be idle, as with `-Hide` straight
  after a sign-in. Never switch the
  display to the browser's desktop: it has no shell, and the human is stranded
  on a black screen. `-Stop` closes only the browser on port 9333.
- `tools/cdp.mjs` drives the same browser over CDP without the MCP server
  (`CDP_PORT` defaults to 9333). Use it when the MCP route is unavailable.
- Do **not** kill that Chrome or an MCP server attached to it. Other live
  sessions share it, and killing it breaks their runs.
- Always work in a **new tab** that this run opened, never an existing one.
  Another agent may own the tab that is already focused, and navigating it away
  clobbers their run.

## LinkedIn (trigger)

`src/resume.ts`, plus the resume tab edits saved in
`public/content-overrides.json`, is the source of truth for both the site and
the LinkedIn profile at <https://www.linkedin.com/in/liambrowndev/>. The two drift apart
easily, so invoke the **`linkedin-sync`** skill whenever any of these happen:

- a job, project, skill, date, or summary line in `src/resume.ts` changes,
- a `#panel-resume/` entry in `public/content-overrides.json` changes,
- the user asks to update, review, or fix their LinkedIn,
- the user mentions a new role, project, jam placement, or credential that
  the profile does not carry yet.

Do not edit LinkedIn ad hoc: the skill carries the auth flow, the pacing
needed to avoid LinkedIn's bot defences, the form URLs and widget quirks,
and the rule that facts absent from the resume are asked about rather
than invented.
