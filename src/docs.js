/* ═══════════════════════════════════════════════
   OwlASO — Docs Page Scripts
   ═══════════════════════════════════════════════ */

import { initTheme, initNav, initCopyButtons } from './common.js';

initTheme();
initNav();
initCopyButtons();

// ─── Heading anchors ───
document.querySelectorAll('.docs-content section h2[id], .docs-content section h3[id]').forEach((heading) => {
  // h2 ids are "h-<section>"; link to the section so the sidebar highlight matches.
  const target = heading.tagName === 'H2' ? heading.closest('section[id]')?.id || heading.id : heading.id;
  const anchor = document.createElement('a');
  anchor.className = 'anchor';
  anchor.href = `#${target}`;
  anchor.textContent = '#';
  anchor.setAttribute('aria-label', `Link to “${heading.textContent.trim()}”`);
  heading.append(anchor);
});

// ─── Sidebar: scrollspy + mobile table of contents ───
const tocToggle = document.querySelector('[data-toc-toggle]');
const tocNav = document.getElementById('docsNav');
const tocCurrent = document.querySelector('[data-toc-current]');
const navLinks = new Map();
document.querySelectorAll('.docs-nav a[href^="#"]').forEach((link) => {
  navLinks.set(link.getAttribute('href').slice(1), link);
});
const sections = [...navLinks.keys()].map((id) => document.getElementById(id)).filter(Boolean);

function setTocOpen(open) {
  if (!tocToggle || !tocNav) return;
  tocNav.classList.toggle('open', open);
  tocToggle.setAttribute('aria-expanded', String(open));
}

tocToggle?.addEventListener('click', () => setTocOpen(!tocNav.classList.contains('open')));
tocNav?.addEventListener('click', (e) => {
  if (e.target.closest('a')) setTocOpen(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && tocNav?.classList.contains('open')) {
    setTocOpen(false);
    tocToggle.focus();
  }
});

let currentId = null;

function setCurrent(id) {
  if (!id || id === currentId) return;
  currentId = id;
  navLinks.forEach((link, key) => {
    if (key === id) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  const active = navLinks.get(id);
  if (tocCurrent && active) tocCurrent.textContent = active.textContent;
  // Keep the highlighted entry visible in a scrollable desktop sidebar.
  if (active && tocNav && window.getComputedStyle(tocNav).display !== 'none') {
    const sidebar = tocNav.closest('.docs-sidebar');
    if (sidebar && sidebar.scrollHeight > sidebar.clientHeight) {
      const linkTop = active.offsetTop;
      if (linkTop < sidebar.scrollTop || linkTop > sidebar.scrollTop + sidebar.clientHeight - 40) {
        sidebar.scrollTop = linkTop - sidebar.clientHeight / 2;
      }
    }
  }
}

function updateCurrent() {
  if (!sections.length) return;
  const offset = window.innerHeight * 0.3;
  let active = sections[0].id;
  for (const section of sections) {
    if (section.getBoundingClientRect().top - offset <= 0) active = section.id;
    else break;
  }
  const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
  if (atBottom) active = sections[sections.length - 1].id;
  setCurrent(active);
}

let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    updateCurrent();
    ticking = false;
  });
}, { passive: true });
window.addEventListener('resize', updateCurrent);
updateCurrent();
