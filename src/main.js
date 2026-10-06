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

// ─── Demo video: play overlay + chapters that follow playback ───
const demo = document.querySelector('[data-demo]');
const video = demo?.querySelector('video');

if (demo && video) {
  const chapters = [...document.querySelectorAll('.demo-chapter')];
  const starts = chapters.map((c) => Number(c.dataset.time));

  // Native controls stay for no-JS visitors; here they appear once playback starts.
  video.controls = false;

  const play = () => {
    demo.classList.add('started');
    video.controls = true;
    video.play().catch(() => {
      // Autoplay refused (rare after a click): leave the native controls to the visitor.
    });
  };

  const seek = (time) => {
    // With preload="none" the start position must wait for metadata.
    if (video.readyState >= 1) video.currentTime = time;
    else video.addEventListener('loadedmetadata', () => { video.currentTime = time; }, { once: true });
    play();
  };

  demo.querySelector('[data-demo-play]')?.addEventListener('click', () => {
    play();
    video.focus();
  });
  video.addEventListener('play', () => {
    demo.classList.add('started');
    video.controls = true;
  });

  chapters.forEach((chapter, i) => chapter.addEventListener('click', () => seek(starts[i])));

  const updateChapters = () => {
    const t = video.currentTime;
    const duration = video.duration || 94;
    chapters.forEach((chapter, i) => {
      const start = starts[i];
      const end = starts[i + 1] ?? duration;
      const active = t >= start && (t < end || (i === chapters.length - 1));
      const progress = t >= end ? 1 : active ? (t - start) / (end - start) : 0;
      chapter.style.setProperty('--progress', progress.toFixed(3));
      if (active && video.currentTime > 0) chapter.setAttribute('aria-current', 'true');
      else chapter.removeAttribute('aria-current');
    });
  };
  video.addEventListener('timeupdate', updateChapters);
  video.addEventListener('seeked', updateChapters);

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
