/* ═══════════════════════════════════════════════
   OwlASO — 404 page scripts
   ═══════════════════════════════════════════════ */

import { initTheme, initNav, initLangDropdown, initCookieConsent } from './common.js';
import { initI18n } from './i18n.js';
import { initNotFound } from './notfound.js';

initTheme();
initNav();
initLangDropdown();
initCookieConsent();
initI18n();
initNotFound();

// ─── Show the address that led here ───
// GitHub Pages serves this file for every missing route, so location.pathname
// is the path the visitor actually asked for.
const pathValue = document.querySelector('[data-404-path]');
if (pathValue) {
  let requested = location.pathname + location.search;
  try {
    requested = decodeURIComponent(requested);
  } catch {
    // Malformed escapes: show the path exactly as the browser reported it.
  }
  pathValue.textContent = requested || '/';
  pathValue.title = requested || '/';
}
