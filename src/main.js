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

// ─── Screen tabs (roving tabindex, automatic activation) ───
document.querySelectorAll('[data-tabs]').forEach((container) => {
  const tabs = [...container.querySelectorAll('[role="tab"]')];

  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls'))?.classList.toggle('active', on);
    });
    if (focus) tab.focus();
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab, false));
    tab.addEventListener('keydown', (e) => {
      const target = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (target === undefined) return;
      e.preventDefault();
      select(tabs[(target + tabs.length) % tabs.length], true);
    });
  });
});
