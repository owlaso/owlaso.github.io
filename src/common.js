/* ═══════════════════════════════════════════════
   OwlASO — Shared site scripts (landing page + docs)
   ═══════════════════════════════════════════════ */

const root = document.documentElement;
const THEME_KEY = 'theme';
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

// ─── Theme ───
// The inline <head> script applies the theme before first paint; this keeps it
// in sync afterwards. Only an explicit toggle is persisted, so visitors who never
// pick a theme keep following their OS setting.
function storedTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(theme === 'dark'));
  });
}

export function initTheme() {
  applyTheme(storedTheme() || (darkQuery.matches ? 'dark' : 'light'));

  darkQuery.addEventListener('change', (e) => {
    if (!storedTheme()) applyTheme(e.matches ? 'dark' : 'light');
  });

  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // Storage blocked (private mode): the choice lasts for this page view.
      }
    });
  });
}

// ─── Nav: scroll shadow + mobile menu ───
export function initNav() {
  const nav = document.querySelector('.site-nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  const toggle = document.querySelector('[data-nav-toggle]');
  const links = toggle && document.getElementById(toggle.getAttribute('aria-controls'));
  if (!toggle || !links) return;

  const setOpen = (open) => {
    links.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };

  toggle.addEventListener('click', () => setOpen(!links.classList.contains('open')));
  links.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('click', (e) => {
    if (links.classList.contains('open') && !links.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && links.classList.contains('open')) {
      setOpen(false);
      toggle.focus();
    }
  });
}

// ─── Copy buttons on code blocks ───
// Prompt markers (<span class="p">) are not copied.
function codeText(code) {
  const clone = code.cloneNode(true);
  clone.querySelectorAll('.p').forEach((el) => el.remove());
  return clone.textContent.replace(/\s+$/u, '');
}

export function initCopyButtons() {
  document.querySelectorAll('.code-block').forEach((block) => {
    const code = block.querySelector('pre code');
    const head = block.querySelector('.code-block-head');
    if (!code || !head) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-live', 'polite');
    let timer;

    btn.addEventListener('click', async () => {
      let label = 'Copied';
      try {
        await navigator.clipboard.writeText(codeText(code));
        btn.classList.add('copied');
      } catch {
        // Clipboard API unavailable (e.g. insecure context): select the text instead.
        const range = document.createRange();
        range.selectNodeContents(code);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        label = 'Press Ctrl+C';
      }
      btn.textContent = label;
      clearTimeout(timer);
      timer = setTimeout(() => {
        btn.textContent = 'Copy';
        btn.classList.remove('copied');
      }, 1800);
    });

    head.append(btn);
  });
}
