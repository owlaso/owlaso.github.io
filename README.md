# OwlASO — Website & Docs

Landing page and documentation for **OwlASO**, the free, open-source desktop app for ASO keyword research, rank tracking and app store review analytics.

- **Live site:** <https://owlaso.github.io> — docs at <https://owlaso.github.io/docs/>
- **App repo:** <https://github.com/owlaso/owlaso>

## Stack

- [Vite](https://vitejs.dev) multi-page build, vanilla JS/CSS — no framework
- Light/dark theme: follows the OS until the visitor toggles it; applied before first paint (no flash)
- Theme-aware product screenshots: WebP pairs in `public/screenshots/` (`<screen>-dark.webp` / `<screen>-light.webp`)
- Accessible by default: skip link, keyboard-friendly nav, `prefers-reduced-motion` support, AA-contrast buttons

## Structure

| Path | What it is |
|---|---|
| `index.html` | Landing page |
| `docs/index.html` | Documentation (single page, sidebar with scrollspy) |
| `src/style.css` | Shared styles and theme tokens |
| `src/docs.css` | Docs-only layout and typography |
| `src/common.js` | Shared scripts: theme, nav menu, copy buttons |
| `src/main.js` / `src/docs.js` | Page scripts |
| `public/` | Static files copied as-is: `screenshots/`, icons, `og-image.png`, `robots.txt`, `sitemap.xml` |

Reference static files with a root path (`/screenshots/keywords-dark.webp`); Vite rewrites them to relative URLs per page, so the site works from any sub-path.

## Develop

```bash
npm install
npm run dev      # dev server on :3000
npm run build    # production build -> dist/
npm run preview  # preview the production build
```

## Deploy

Push to `main`. The GitHub Actions workflow (`.github/workflows/deploy.yml`) builds the site and publishes `dist/` to GitHub Pages. `dist/` and `node_modules/` are gitignored.

> **Pages source must be "GitHub Actions"** (Settings → Pages → Build and deployment → Source).
> With "Deploy from a branch", GitHub also publishes the unbuilt repo on every push; whichever deploy
> finishes last wins, and the unbuilt repo has no images or icons at the web root. The workflow's first
> step checks this and fails with an error if the source is wrong.

## Keeping content accurate

The site describes the app, so update it together with app releases:

- **Version** — hero badge, install card and JSON-LD `softwareVersion` in `index.html`; eyebrow and changelog in `docs/index.html`
- **Facts** — storefronts (20), review languages (16), history (180 days), limits and formulas come from the app source (`public/app.js`, `src/providers.js`, `src/aso.js`)
- **Screenshots** — `public/screenshots/` holds dark/light WebP pairs at 1920×1200 (captured at 2880×1800, downscaled, WebP quality ≈ 0.84). Replace a pair with the same file names; if the size changes, update the `width`/`height` attributes in `index.html` and `docs/index.html`. `og-image.png` embeds `keywords-dark.webp`
- **Sitemap** — bump `lastmod` in `public/sitemap.xml`

## Optional: Vercel

`vercel.json` pins the build/output for Vercel and adds security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) if you prefer to serve it there instead.
