/* ══════════════════════════════════════════════
   OwlASO — Shared site scripts (landing page + docs)
   ═══════════════════════════════════════════════ */

const root = document.documentElement;
const THEME_KEY = 'theme';
const LANG_KEY = 'lang';
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

// Language metadata
const LANGUAGES = [
  { code: 'en', flag: '/flags/us.svg', name: 'English', native: 'English', ogLocale: 'en_US' },
  { code: 'tr', flag: '/flags/tr.svg', name: 'Turkish', native: 'Türkçe', ogLocale: 'tr_TR' },
  { code: 'es', flag: '/flags/es.svg', name: 'Spanish', native: 'Español', ogLocale: 'es_ES' },
  { code: 'fr', flag: '/flags/fr.svg', name: 'French', native: 'Français', ogLocale: 'fr_FR' },
  { code: 'de', flag: '/flags/de.svg', name: 'German', native: 'Deutsch', ogLocale: 'de_DE' },
  { code: 'ja', flag: '/flags/jp.svg', name: 'Japanese', native: '日本語', ogLocale: 'ja_JP' },
  { code: 'ko', flag: '/flags/kr.svg', name: 'Korean', native: '한국어', ogLocale: 'ko_KR' },
  { code: 'pt', flag: '/flags/pt.svg', name: 'Portuguese', native: 'Português', ogLocale: 'pt_PT' },
  { code: 'zh', flag: '/flags/cn.svg', name: 'Chinese', native: '中文', ogLocale: 'zh_CN' },
  { code: 'ru', flag: '/flags/ru.svg', name: 'Russian', native: 'Русский', ogLocale: 'ru_RU' },
  { code: 'it', flag: '/flags/it.svg', name: 'Italian', native: 'Italiano', ogLocale: 'it_IT' },
];

function getLangMeta(code) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}

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

// ─── Language dropdown ───
function storedLang() {
  try {
    const value = localStorage.getItem(LANG_KEY);
    return LANGUAGES.some((l) => l.code === value) ? value : null;
  } catch {
    return null;
  }
}

function applyLang(lang) {
  const meta = getLangMeta(lang);
  root.setAttribute('lang', lang);
  // Update the toggle button
  const toggle = document.querySelector('[data-lang-toggle]');
  if (toggle) {
    const flagEl = toggle.querySelector('[data-lang-flag]');
    const codeEl = toggle.querySelector('[data-lang-code]');
    if (flagEl) {
      if (flagEl.tagName === 'IMG') flagEl.src = meta.flag;
      else flagEl.textContent = meta.flag;
    }
    if (codeEl) codeEl.textContent = meta.code;
    toggle.setAttribute('aria-label', `Current language: ${meta.native}`);
  }
  // Update menu selection
  document.querySelectorAll('[data-lang-menu] [role="option"]').forEach((opt) => {
    const selected = opt.dataset.lang === lang;
    opt.setAttribute('aria-selected', String(selected));
  });
  // Update og:locale
  const og = document.querySelector('meta[property="og:locale"]');
  const tw = document.querySelector('meta[name="twitter:locale"]');
  if (og) og.setAttribute('content', meta.ogLocale);
  if (tw) tw.setAttribute('content', meta.ogLocale);
}

export function initLangDropdown() {
  const dropdown = document.querySelector('[data-lang-dropdown]');
  if (!dropdown) return;

  const toggle = dropdown.querySelector('[data-lang-toggle]');
  const menu = dropdown.querySelector('[data-lang-menu]');
  if (!toggle || !menu) return;

  // Initialize with stored or default language
  const initialLang = storedLang() || 'en';
  applyLang(initialLang);

  // Toggle menu
  const setOpen = (open) => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };

  toggle.addEventListener('click', () => setOpen(menu.hidden));

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (menu.hidden) return;
    if (!dropdown.contains(e.target)) setOpen(false);
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });

  // Handle language selection
  menu.addEventListener('click', (e) => {
    const option = e.target.closest('[role="option"][data-lang]');
    if (!option) return;
    const lang = option.dataset.lang;
    if (lang === initialLang) { setOpen(false); return; }
    try { localStorage.setItem(LANG_KEY, lang); } catch {}
    applyLang(lang);
    setOpen(false);
    // Dispatch event for i18n system
    document.dispatchEvent(new CustomEvent('owlaso:langchange', { detail: { lang } }));
    // Reload page to apply translations (simpler for static site)
    location.reload();
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

// ─── Cookie consent (privacy-first: no analytics, no tracking cookies) ───
const COOKIE_KEY = 'cookie-consent';

export function initCookieConsent() {
  const banner = document.getElementById('cookieBanner');
  const acceptBtn = document.getElementById('cookieAccept');
  const manageBtn = document.getElementById('cookieManage');
  if (!banner || !acceptBtn) return;

  // If already consented, hide banner
  if (localStorage.getItem(COOKIE_KEY) === 'accepted') {
    banner.classList.add('hidden');
    return;
  }

  // Show banner after a short delay
  setTimeout(() => {
    banner.classList.remove('hidden');
  }, 500);

  acceptBtn.addEventListener('click', () => {
    localStorage.setItem(COOKIE_KEY, 'accepted');
    banner.classList.add('hidden');
  });

  manageBtn.addEventListener('click', () => {
    // For now, just accept - no complex preferences needed since we don't use cookies
    localStorage.setItem(COOKIE_KEY, 'accepted');
    banner.classList.add('hidden');
  });
}
