# kUSDT documentation site

The public documentation for kUSDT, built with [Astro Starlight](https://starlight.astro.build). The output is
plain static files (HTML, CSS, a little JavaScript, and a Pagefind search index) that any web server or static
host can serve.

The content follows `../SPEC.md` (the protocol), `../PROGRESS.md` (status and decisions) and the contract
sources. When they change, update the matching pages.

## Requirements

- Node.js 22.12 or newer and npm.
- This is a standalone npm project with its own `package.json` and `package-lock.json`; it does not use the
  repository's root workspace.

## Commands

Run from this folder (`docs/`).

| Command | Does |
|---|---|
| `npm ci` | Installs the exact dependencies from the lockfile. If npm fails with an "edgesOut" error, use `npm install --legacy-peer-deps` |
| `npm run dev` | Local preview with live reload at `http://localhost:4321` |
| `npm run build` | Builds the static site into `dist/`. Fails on any broken internal link (`starlight-links-validator`) |
| `npm run preview` | Serves the built `dist/` locally |
| `npm run check:colors` | After a build: fails if any green, teal or mint colour appears in `dist/` (the design rule) |

## Deploying

1. Set the public origin, so the build can write the sitemap and canonical URLs:

   ```sh
   SITE_URL=https://docs.example.org npm run build      # bash
   $env:SITE_URL="https://docs.example.org"; npm run build   # PowerShell
   ```

   Without `SITE_URL` the site still builds; only the sitemap is skipped.
2. Upload the contents of `dist/` to the web root of that origin. The site is built for the **root** of a domain
   or subdomain (internal links start with `/`), not for a sub-path.
3. Serve `404.html` for unknown paths. Most static hosts do this automatically.

Any static host works: nginx, Caddy, an object store with a CDN, GitHub Pages or Cloudflare Pages (build command
`npm run build`, output directory `dist`, root directory `docs`).

## Layout

| Path | What |
|---|---|
| `astro.config.mjs` | Site configuration and the sidebar |
| `src/content/docs/` | The pages (Markdown and MDX). The file path is the URL |
| `src/components/diagrams/` | The diagrams, as inline SVG Astro components (architecture, bridge in, bridge out, pool swap) |
| `src/styles/pearl.css` | The theme: the Pearl palette (ink and pearl tones) for dark and light mode |
| `src/themes/` | Code-block colour themes in the same palette |
| `public/` | Static files copied as is (the favicon) |
| `scripts/check-colors.mjs` | The colour check |

## Writing rules

- Never invent a fact: every number, rule and name comes from the specification or the code.
- Where an address or URL is not known yet, write "to be published".
- Plain, short sentences; define a term before using it; numbers go in tables.
- No green, teal or mint. Use the CSS variables in `pearl.css`, which switch between dark and light mode.
