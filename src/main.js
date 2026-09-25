/* ═══════════════════════════════════════════════
   OwlASO — Landing Page Scripts
   ═══════════════════════════════════════════════ */

import { initTheme, initNav, initCopyButtons } from './common.js';

initTheme();
initNav();
initCopyButtons();

// ─── Scroll Reveal (Intersection Observer) ───
const reveals = document.querySelectorAll('.reveal');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if ('IntersectionObserver' in window && !reduceMotion) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  reveals.forEach((el) => revealObserver.observe(el));
} else {
  reveals.forEach((el) => el.classList.add('visible'));
}
