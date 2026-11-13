# website

A Vite + TypeScript + Tailwind CSS single-page app, deployed on Netlify.

## Links

- **Live site:** [loomhozer.ca](https://loomhozer.ca) (self-hosted, see below)
- **Netlify mirror:** [liambrown-website.netlify.app](https://liambrown-website.netlify.app)
- **Netlify dashboard:** [app.netlify.com/projects/liambrown-website](https://app.netlify.com/projects/liambrown-website)

## Development

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check + production build into dist/
npm run preview  # preview the production build locally
```

### The Loom engine build

The **Engine** tab runs Loom's own demo projects: the ones `DEMOS` in
`src/engine.ts` lists side by side, then the ones `SHADER_DEMOS` lists, each
beside a code box holding its shader file, coloured as Loom's shader editor
colours it. All are built from `Desktop/Loom/Demo Sources`. The engine lives
outside this repo, and the build output in `Loom Demo Builds/` is git-ignored,
so a fresh clone has to produce it before the tab has anything to load:

```bash
./build-loom.sh   # LOOM=... overrides the engine's folder, OUT=... where the builds go
```

That runs the engine's own Play Web build (`play-web.ps1 -Output`) once with
every demo's scripts, which writes the one player into `Loom Demo Builds/engine/`,
then on each demo for its page, scene and assets in `Loom Demo Builds/<slug>/`.
Each page loads the player from `../engine/player.js`. Vite serves those at
`/engine-build/demos/<slug>` in dev and copies them into `dist/` on build.

The demos are live builds too. `serve-site.cjs` watches what they are built
from, the engine's web sources, its Play Web scripts and `Demo Sources`, and
once a change there settles, rebuilds them in a scratch folder and republishes
them only once they pass the engine tests and load in Chrome without error, so a
change to Loom reaches the site without `npm run build`. Loom's merge runs
`tools/check-loom.mjs` on any branch that changes those files, which builds the
demos from the branch and proves them the same way, so nothing lands that
would break them.

The demos take no input. Their frames are inert, and their scripts never read
Loom's input, which `test/engine-wiring.test.mjs` checks. The only input is
typing in a shader demo's code box: `src/shader-editor.ts` hands each edit to
the running player's `loom_edit_shader`, which compiles it in place of the file,
and shows why it did not compile when it did not.

Without it the site still builds. Vite warns, and the Engine tab shows its
loading state with nothing behind it.

## Stack

- **Vite** — dev server and bundler (no framework, vanilla TS)
- **TypeScript** — type-checked source in `src/`
- **Tailwind CSS v4** — utility styling via the `@tailwindcss/vite` plugin
  (configured in `vite.config.ts`; CSS entry is `src/style.css`)

## Deploying to Netlify

Build settings live in `netlify.toml` (`npm run build` → publish `dist/`).

### Self-hosting at loomhozer.ca

`loomhozer.ca` and `www.loomhozer.ca` are served from the home Windows box, not
Netlify. `serve-site.cjs` serves `dist/` on `:8082` (SPA fallback and the Brotli
headers from `netlify.toml`, so the Unity builds load), and the `loom-tunnel`
Cloudflare tunnel maps both hostnames to it (ingress in
`%USERPROFILE%\.cloudflared\config.yml`). The Draft League watchdog on that box,
`Pokemon Draft League\server\keep-server-up.ps1`, relaunches it within ~5s if it
dies, so nothing here has to be started by hand.

Publishing a change is just `npm run build`: the server reads `dist/` per request
and needs no restart. Editing `serve-site.cjs` does need one (kill the `:8082`
listener and the watchdog picks it back up).

[loomhozer.ca/tno-artist](https://loomhozer.ca/tno-artist/) is Trust No One's
artist build, read straight from `../Brackeys GameJam/Build/Artist`. It is a live
build: `serve-site.cjs` polls that folder and republishes it into `dist/` within a
minute of a new build landing, under content-hashed names so no cache holds the
old one. Netlify never has the folder, so it is self-hosted only.

### Editing the text in the page

Text on the site is editable in place, but only from the machine serving it.
`tools/edit-server.cjs` makes that call at the socket, mounted both by the Vite
dev server and by `serve-site.cjs`: the request has to come off a loopback
socket, carry none of the headers a proxy adds, and name a local Host. All three
matter, because `loomhozer.ca` arrives through the Cloudflare tunnel, so
cloudflared holds the socket and every visitor on the internet would otherwise
look like the host. `SITE_EDIT_LAN=1` widens loopback to this machine's own LAN
addresses. Netlify runs no server, so that deploy is read-only for everyone.

Open <http://localhost:5173> or <http://127.0.0.1:8082> and click any text to
edit it. Enter saves, Escape cancels, Shift+Enter breaks a line, and holding Alt
outlines every editable block and lets a link or a button be edited rather than
followed. Nothing about the page changes for anyone else.

Edits are stored in `public/content-overrides.json`, keyed by where the text
sits in the page and stamped with the markup the code renders, so an edit is
dropped rather than misapplied once that markup moves on. Typing the original
text back removes the entry. The file is committed, so an edit reaches the
Netlify deploy the way any other change does: commit it and push.

### Continuous deploys (recommended)

Push this repo to GitHub/GitLab and connect it in the Netlify dashboard.
Netlify reads `netlify.toml` automatically.

### Manual deploy from the CLI

```bash
npx netlify login          # one-time auth
npx netlify deploy         # draft deploy to a preview URL
npx netlify deploy --prod  # deploy to production
```
