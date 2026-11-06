/* ═══════════════════════════════════════════════
   OwlASO — Landing Page Scripts
   ═══════════════════════════════════════════════ */

import { initTheme, initNav, initCopyButtons, initLangDropdown, initCookieConsent } from './common.js';
import { initI18n } from './i18n.js';
import { initStats } from './stats.js';
import { initPanelUI } from './panelui.js';

initTheme();
initNav();
initCopyButtons();
initLangDropdown();
initCookieConsent();
initI18n();
initPanelUI();
initStats();

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

// ─── Screen tabs (roving tabindex, automatic activation + sliding chip) ───
document.querySelectorAll('[data-tabs]').forEach((container) => {
  const tabs = [...container.querySelectorAll('[role="tab"]')];
  const track = container.querySelector('.shot-tabs');
  const indicator = track?.querySelector('.shot-tab-indicator');

  // PanelUI tabs: one chip travels between the measured trigger positions.
  const moveIndicator = (tab) => {
    if (!indicator || !tab || !track) return;
    indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
    indicator.style.width = `${tab.offsetWidth}px`;
    indicator.style.opacity = '1';
  };

  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls'))?.classList.toggle('active', on);
    });
    moveIndicator(tab);
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

  // First measurement has nowhere to animate from; re-measure if the row
  // shifts (fonts loading, viewport changes).
  const initial = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
  if (indicator && initial) {
    requestAnimationFrame(() => moveIndicator(initial));
    window.addEventListener('load', () => moveIndicator(initial));
    window.addEventListener('resize', () => {
      const current = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
      if (current) moveIndicator(current);
    });
  }
});

// ─── Demo video: play overlay ───
const demo = document.querySelector('[data-demo]');
const video = demo?.querySelector('video');

if (demo && video) {
  // Native controls stay for no-JS visitors; here they appear once playback starts.
  video.controls = false;

  const play = () => {
    demo.classList.add('started');
    video.controls = true;
    video.play().catch(() => {
      // Autoplay refused (rare after a click): leave the native controls to the visitor.
    });
  };

  demo.querySelector('[data-demo-play]')?.addEventListener('click', () => {
    play();
    video.focus();
  });
  video.addEventListener('play', () => {
    demo.classList.add('started');
    video.controls = true;
  });

  // Hero "Watch the demo" button: bring the player into view and start it.
  document.querySelectorAll('[data-demo-start]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('demo')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      play();
    });
  });
}

// ─── Nav: highlight the section currently in view ───
const navLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];
const navTargets = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);

if ('IntersectionObserver' in window && navTargets.length) {
  const visible = new Set();
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => (entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target)));
      const current = navTargets.find((t) => visible.has(t));
      navLinks.forEach((a) => a.classList.toggle('active', !!current && a.getAttribute('href') === '#' + current.id));
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  navTargets.forEach((t) => sectionObserver.observe(t));
}
