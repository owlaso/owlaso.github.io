/* ═══════════════════════════════════════════════
   OwlASO — Hero stats (GitHub stars & site visits)
   ═══════════════════════════════════════════════ */

const GH_ORG = 'owlaso';                       // org holding all public OwlASO repos
const STARS_CACHE_KEY = 'owlaso-stars';        // last known star total, for instant paint
const VISITS_CACHE_KEY = 'owlaso-visits';      // last known visit count (localStorage)
const VISITS_SESSION_FLAG = 'owlaso-visit-this-session';
const HIT_SLUG = 'owlaso-landing';             // public counter: abacus.jasoncameron.dev/stats/owlaso-landing
const STARS_CACHE_TTL = 2 * 60 * 60 * 1000;    // refetch stars at most every 2h (GitHub rate limit is 60/h per IP)

const starsEl = document.querySelector('[data-stat="stars"]');
const visitsEl = document.querySelector('[data-stat="visits"]');

// ─── Helpers ───
async function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function formatCount(n) {
  if (n < 1000) return String(n);
  const lang = document.documentElement.lang === 'tr' ? 'tr-TR' : 'en-US';
  return new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

function setCount(el, n) {
  if (el && Number.isFinite(n)) el.textContent = formatCount(n);
}

// ─── GitHub stars: sum `stargazers_count` across all public repos in the org ───
async function loadStars() {
  if (!starsEl) return;

  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(STARS_CACHE_KEY) || 'null'); } catch { /* ignore */ }

  if (cached && Number.isFinite(cached.n)) setCount(starsEl, cached.n);

  if (cached && cached.t && Date.now() - cached.t < STARS_CACHE_TTL) return;

  try {
    const res = await fetchWithTimeout(
      `https://api.github.com/orgs/${GH_ORG}/repos?per_page=100`,
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) return;
    const repos = await res.json();
    const total = repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
    setCount(starsEl, total);
    try { localStorage.setItem(STARS_CACHE_KEY, JSON.stringify({ n: total, t: Date.now() })); } catch { /* ignore */ }
  } catch {
    // Offline / rate limited: keep the cached value (or the dash placeholder).
  }
}

// ─── Site visits: Abacus counter, one bump per browser session ───
// Every call to the slug's endpoints counts server-side, so a session should
// call exactly once (with /incr). Reloads within the same session render the
// locally cached number without touching the counter.
async function loadVisits() {
  if (!visitsEl) return;

  try {
    if (sessionStorage.getItem(VISITS_SESSION_FLAG) === '1') {
      const cached = JSON.parse(localStorage.getItem(VISITS_CACHE_KEY) || 'null');
      if (cached && Number.isFinite(cached.n)) setCount(visitsEl, cached.n);
      return;
    }
    sessionStorage.setItem(VISITS_SESSION_FLAG, '1');
  } catch {
    // Storage disabled (e.g. private mode): just count the visit normally.
  }

  try {
    const res = await fetchWithTimeout(`https://abacus.jasoncameron.dev/hit/${HIT_SLUG}/incr`);
    if (!res.ok) return;
    const data = await res.json();
    if (Number.isFinite(data.value)) {
      setCount(visitsEl, data.value);
      try { localStorage.setItem(VISITS_CACHE_KEY, JSON.stringify({ n: data.value, t: Date.now() })); } catch { /* ignore */ }
    }
  } catch {
    // Offline / service unreachable: dash placeholder stays until the next visit.
  }
}

export function initStats() {
  loadStars();
  loadVisits();
}
