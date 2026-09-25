# OwlASO — Website & Docs

Landing page and documentation for **OwlASO**, the free, open-source desktop app for ASO keyword research, rank tracking and app store review analytics.

- **Live site:** <https://owlaso.github.io> — docs at <https://owlaso.github.io/docs/>
- **App repo:** <https://github.com/owlaso/owlaso>

## Stack

- [Vite](https://vitejs.dev) multi-page build, vanilla JS/CSS — no framework
- Light/dark theme: follows the OS until the visitor toggles it; applied before first paint (no flash)
- Theme-aware product screenshots (`aso.png` / `aso-light.png`, `reviews.png` / `reviews-light.png`)
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
| `public/` | Static files copied as-is: screenshots, icons, `og-image.png`, `robots.txt`, `sitemap.xml` |

Reference static files with a root path (`/aso.png`); Vite rewrites them to relative URLs per page, so the site works from any sub-path.

## Develop

```bash
npm install
npm run dev      # dev server on :3000
npm run build    # production build -> dist/
npm run preview  # preview the production build
```

## Deploy

Push to `main`. The GitHub Actions workflow (`.github/workflows/deploy.yml`) builds the site and publishes `dist/` to GitHub Pages. `dist/` and `node_modules/` are gitignored.

## Keeping content accurate

The site describes the app, so update it together with app releases:

- **Version** — hero badge, install card and JSON-LD `softwareVersion` in `index.html`; eyebrow and changelog in `docs/index.html`
- **Facts** — storefronts (20), review languages (16), history (180 days), limits and formulas come from the app source (`public/app.js`, `src/providers.js`, `src/aso.js`)
- **Screenshots** — replace the four PNGs in `public/` (keep the dark/light pairs), then update the `width`/`height` attributes in `index.html`
- **Sitemap** — bump `lastmod` in `public/sitemap.xml`

## Optional: Vercel

`vercel.json` pins the build/output for Vercel and adds security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) if you prefer to serve it there instead.
