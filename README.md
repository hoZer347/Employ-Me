# website

A Vite + TypeScript + Tailwind CSS single-page app, deployed on Netlify.

## Links

- **Live site:** [liambrown-website.netlify.app](https://liambrown-website.netlify.app)
- **Netlify dashboard:** [app.netlify.com/projects/liambrown-website](https://app.netlify.com/projects/liambrown-website)

## Development

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check + production build into dist/
npm run preview  # preview the production build locally
```

## Stack

- **Vite** — dev server and bundler (no framework, vanilla TS)
- **TypeScript** — type-checked source in `src/`
- **Tailwind CSS v4** — utility styling via the `@tailwindcss/vite` plugin
  (configured in `vite.config.ts`; CSS entry is `src/style.css`)

## Deploying to Netlify

Build settings live in `netlify.toml` (`npm run build` → publish `dist/`).

### Continuous deploys (recommended)

Push this repo to GitHub/GitLab and connect it in the Netlify dashboard.
Netlify reads `netlify.toml` automatically.

### Manual deploy from the CLI

```bash
npx netlify login          # one-time auth
npx netlify deploy         # draft deploy to a preview URL
npx netlify deploy --prod  # deploy to production
```
