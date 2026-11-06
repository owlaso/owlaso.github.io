/* ═══════════════════════════════════════════════
   OwlASO — PanelUI component ports
   Vanilla versions of the PanelUI web collection:
   Planet, RollingNumber, TiltCard, RangeMeter,
   CommandDock, Toast and the copy actions.
   ═══════════════════════════════════════════════ */

import { LAND, LAND_COLUMNS, LAND_ROWS } from './land.js';
import { t, getLang } from './i18n.js';

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/* ═══════════════════════════════════════════════
   RollingNumber — each digit is a column of ten
   ═══════════════════════════════════════════════ */

function rollingMarkup(value, prefix, suffix) {
  const formatted = new Intl.NumberFormat(getLang() === 'tr' ? 'tr-TR' : 'en-US').format(value);
  const root = document.createElement('span');
  root.className = 'p-roll';
  root.setAttribute('role', 'text');
  root.setAttribute('aria-label', `${prefix}${formatted}${suffix}`);

  if (prefix) {
    const pre = document.createElement('span');
    pre.className = 'p-roll-static';
    pre.setAttribute('aria-hidden', 'true');
    pre.textContent = prefix;
    root.append(pre);
  }

  let column = 0;
  for (const character of formatted) {
    if (character >= '0' && character <= '9') {
      const digit = Number(character);
      const col = document.createElement('span');
      col.className = 'p-roll-col';
      col.setAttribute('aria-hidden', 'true');

      const ghost = document.createElement('span');
      ghost.className = 'p-roll-ghost';
      ghost.textContent = '0';

      const windowEl = document.createElement('span');
      windowEl.className = 'p-roll-window';

      const strip = document.createElement('span');
      strip.className = 'p-roll-strip';
      strip.dataset.digit = String(digit);
      strip.style.transitionDelay = `${column * 45}ms`;
      for (let n = 0; n <= 9; n += 1) {
        const cell = document.createElement('span');
        cell.className = 'p-roll-digit';
        cell.textContent = String(n);
        strip.append(cell);
      }

      windowEl.append(strip);
      col.append(ghost, windowEl);
      root.append(col);
      column += 1;
    } else {
      const staticEl = document.createElement('span');
      staticEl.className = 'p-roll-static';
      staticEl.setAttribute('aria-hidden', 'true');
      staticEl.textContent = character;
      root.append(staticEl);
    }
  }

  if (suffix) {
    const post = document.createElement('span');
    post.className = 'p-roll-static';
    post.setAttribute('aria-hidden', 'true');
    post.textContent = suffix;
    root.append(post);
  }

  return root;
}

export function initRollingNumbers() {
  document.querySelectorAll('[data-roll]').forEach((el) => {
    const value = Number(el.dataset.roll);
    if (!Number.isFinite(value)) return;
    const prefix = el.dataset.rollPrefix || '';
    const suffix = el.dataset.rollSuffix || '';
    const root = rollingMarkup(value, prefix, suffix);
    el.replaceChildren(root);

    const strips = [...root.querySelectorAll('.p-roll-strip')];
    const settle = () => {
      strips.forEach((strip) => {
        const digit = Number(strip.dataset.digit || 0);
        strip.style.transform = `translateY(${-digit * 10}%)`;
      });
      root.classList.add('is-settled');
    };

    if (reduceMotion() || !('IntersectionObserver' in window)) {
      requestAnimationFrame(settle);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          settle();
          observer.disconnect();
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(root);
  });
}

/* ═══════════════════════════════════════════════
   Planet — dotted globe with DOM markers
   ═══════════════════════════════════════════════ */

const RADIANS = Math.PI / 180;
const SPHERE = 0.9;
const MAX_TILT = 60;
const DOT_SPACING = 4.4;
const LIGHT = { x: -0.3, y: 0.42, z: 0.86 };
const ALPHA_STEPS = 8;
const KEY_STEP = 15;

let landBits = null;

function isLand(latitude, longitude) {
  if (!landBits) {
    const decoded = atob(LAND);
    landBits = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i += 1) landBits[i] = decoded.charCodeAt(i);
  }
  const row = Math.min(LAND_ROWS - 1, Math.max(0, Math.floor(((90 - latitude) / 180) * LAND_ROWS)));
  const column = Math.min(
    LAND_COLUMNS - 1,
    Math.max(0, Math.floor(((longitude + 180) / 360) * LAND_COLUMNS))
  );
  const cell = row * LAND_COLUMNS + column;
  return ((landBits[cell >> 3] ?? 0) & (1 << (cell & 7))) !== 0;
}

const dotCache = new Map();

function dotsFor(step) {
  const cached = dotCache.get(step);
  if (cached) return cached;

  const xs = [];
  const ys = [];
  const zs = [];
  const rows = Math.round(180 / step);
  for (let row = 0; row < rows; row += 1) {
    const latitude = 90 - (row + 0.5) * (180 / rows);
    const cos = Math.cos(latitude * RADIANS);
    const sin = Math.sin(latitude * RADIANS);
    const columns = Math.max(1, Math.round((360 / step) * cos));
    for (let column = 0; column < columns; column += 1) {
      const longitude = -180 + (column + 0.5) * (360 / columns);
      if (!isLand(latitude, longitude)) continue;
      xs.push(cos * Math.sin(longitude * RADIANS));
      ys.push(sin);
      zs.push(cos * Math.cos(longitude * RADIANS));
    }
  }

  const dots = {
    x: Float32Array.from(xs),
    y: Float32Array.from(ys),
    z: Float32Array.from(zs),
    count: xs.length,
  };
  dotCache.set(step, dots);
  return dots;
}

const wrap = (longitude) => ((((longitude + 180) % 360) + 360) % 360) - 180;
const shortest = (from, to) => wrap(to - from);

function createPlanet(canvas, options) {
  const context = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const { listeners, onFrame } = options;

  let longitude = wrap(options.rotation[0]);
  let latitude = clamp(options.rotation[1], -MAX_TILT, MAX_TILT);
  let target = null;
  let velocity = 0;
  let spin = options.autoRotate;
  let dragging = false;
  let hovering = false;
  let visible = true;
  let frame = 0;
  let last = 0;
  let size = 0;
  let destroyed = false;
  let samples = [];

  const draw = () => {
    if (!context || size === 0) return;
    const ratio = window.devicePixelRatio || 1;
    const centre = size / 2;
    const radius = (size / 2) * SPHERE;
    const style = getComputedStyle(canvas);
    const color = style.color;
    const glow = style.outlineColor || color;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size, size);

    const halo = context.createRadialGradient(centre, centre, radius * 0.98, centre, centre, size / 2);
    halo.addColorStop(0, glow);
    halo.addColorStop(1, 'transparent');
    context.fillStyle = halo;
    context.globalAlpha = 0.14;
    context.beginPath();
    context.arc(centre, centre, size / 2, 0, Math.PI * 2);
    context.arc(centre, centre, radius, 0, Math.PI * 2, true);
    context.fill('evenodd');
    context.globalAlpha = 1;

    context.save();
    context.beginPath();
    context.arc(centre, centre, radius, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = color;
    context.globalAlpha = 0.035;
    context.fillRect(0, 0, size, size);
    const lit = context.createRadialGradient(
      centre - radius * 0.42,
      centre - radius * 0.48,
      radius * 0.05,
      centre - radius * 0.2,
      centre - radius * 0.2,
      radius * 1.15
    );
    lit.addColorStop(0, color);
    lit.addColorStop(1, 'transparent');
    context.fillStyle = lit;
    context.globalAlpha = 0.11;
    context.fillRect(0, 0, size, size);
    context.restore();

    const sinLongitude = Math.sin(longitude * RADIANS);
    const cosLongitude = Math.cos(longitude * RADIANS);
    const sinLatitude = Math.sin(latitude * RADIANS);
    const cosLatitude = Math.cos(latitude * RADIANS);

    const step = clamp(Math.round((DOT_SPACING / (radius * RADIANS)) * 10) / 10, 1, 6);
    const dots = dotsFor(step);
    const dotRadius = Math.max(0.6, radius * 0.0062);

    const paths = Array.from({ length: ALPHA_STEPS }, () => new Path2D());
    for (let i = 0; i < dots.count; i += 1) {
      const dx = dots.x[i] ?? 0;
      const dy = dots.y[i] ?? 0;
      const dz = dots.z[i] ?? 0;
      const x = dx * cosLongitude - dz * sinLongitude;
      const forward = dx * sinLongitude + dz * cosLongitude;
      const depth = dy * sinLatitude + forward * cosLatitude;
      if (depth <= 0) continue;
      const y = dy * cosLatitude - forward * sinLatitude;

      const light = Math.max(0, x * LIGHT.x + y * LIGHT.y + depth * LIGHT.z);
      const turned = Math.min(1, depth / 0.55);
      const edge = turned * turned * (3 - 2 * turned);
      const alpha = (0.22 + 0.78 * light) * edge;
      const level = Math.min(ALPHA_STEPS - 1, Math.floor(alpha * ALPHA_STEPS));
      const path = paths[level];
      if (!path) continue;
      const px = centre + x * radius;
      const py = centre - y * radius;
      const r = dotRadius * (0.72 + 0.42 * depth);
      path.moveTo(px + r, py);
      path.arc(px, py, r, 0, Math.PI * 2);
    }
    context.fillStyle = color;
    paths.forEach((path, level) => {
      context.globalAlpha = (level + 0.5) / ALPHA_STEPS;
      context.fill(path);
    });
    context.globalAlpha = 1;

    const project = (markerLatitude, markerLongitude) => {
      const cos = Math.cos(markerLatitude * RADIANS);
      const sin = Math.sin(markerLatitude * RADIANS);
      const dx = cos * Math.sin(markerLongitude * RADIANS);
      const dz = cos * Math.cos(markerLongitude * RADIANS);
      const x = dx * cosLongitude - dz * sinLongitude;
      const forward = dx * sinLongitude + dz * cosLongitude;
      return {
        x: centre + x * radius,
        y: centre - (sin * cosLatitude - forward * sinLatitude) * radius,
        depth: sin * sinLatitude + forward * cosLatitude,
      };
    };

    for (const listener of listeners) listener(project);
    onFrame?.({ longitude, latitude, project });
  };

  const resting = () => {
    const turning = spin !== 0 && !hovering && !dragging && visible && !reducedMotion.matches;
    return !dragging && target === null && Math.abs(velocity) < 1 && !turning;
  };

  const tick = (now) => {
    frame = 0;
    if (destroyed) return;
    const elapsed = last === 0 ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;

    if (target) {
      const ease = reducedMotion.matches ? 1 : 1 - Math.exp(-elapsed * 6);
      const remaining = shortest(longitude, target.longitude);
      longitude = wrap(longitude + remaining * ease);
      latitude += (target.latitude - latitude) * ease;
      if (Math.abs(remaining) < 0.05 && Math.abs(target.latitude - latitude) < 0.05) {
        longitude = target.longitude;
        latitude = target.latitude;
        target = null;
      }
    } else if (!dragging && Math.abs(velocity) >= 1) {
      longitude = wrap(longitude + velocity * elapsed);
      velocity *= Math.exp(-elapsed * 3.2);
    } else if (!dragging && !hovering && visible && spin !== 0 && !reducedMotion.matches) {
      longitude = wrap(longitude + spin * elapsed);
    }

    draw();

    if (resting()) {
      velocity = 0;
      last = 0;
      options.onSettle?.([longitude, latitude]);
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  const invalidate = () => {
    if (frame === 0 && !destroyed) frame = requestAnimationFrame(tick);
  };

  const resize = new ResizeObserver(() => {
    const next = Math.round(canvas.clientWidth);
    if (next === 0) return;
    const ratio = window.devicePixelRatio || 1;
    size = next;
    canvas.width = Math.round(next * ratio);
    canvas.height = Math.round(next * ratio);
    draw();
    invalidate();
  });
  resize.observe(canvas);

  const theme = new MutationObserver(invalidate);
  theme.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-theme'],
  });

  const viewport = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    if (visible) invalidate();
  });
  viewport.observe(canvas);

  const onMotionPreference = () => invalidate();
  reducedMotion.addEventListener('change', onMotionPreference);

  return {
    rotateBy(byLongitude, byLatitude = 0) {
      const from = target ?? { longitude, latitude };
      target = {
        longitude: wrap(from.longitude + byLongitude),
        latitude: clamp(from.latitude + byLatitude, -MAX_TILT, MAX_TILT),
      };
      velocity = 0;
      invalidate();
    },
    rotateTo([toLongitude, toLatitude]) {
      target = {
        longitude: wrap(toLongitude),
        latitude: clamp(toLatitude, -MAX_TILT, MAX_TILT),
      };
      velocity = 0;
      invalidate();
    },
    getRotation: () => [longitude, latitude],
    setAutoRotate(speed) {
      spin = speed;
      invalidate();
    },
    dragStart() {
      dragging = true;
      target = null;
      velocity = 0;
      samples = [];
      invalidate();
    },
    dragMove(dx, dy, vertical) {
      if (!dragging || size === 0) return;
      const degrees = 1 / ((size / 2) * RADIANS);
      longitude = wrap(longitude - dx * degrees);
      if (vertical) latitude = clamp(latitude + dy * degrees, -MAX_TILT, MAX_TILT);
      const now = performance.now();
      samples.push({ time: now, dx: -dx * degrees });
      samples = samples.filter((sample) => now - sample.time < 120);
      invalidate();
    },
    dragEnd() {
      if (!dragging) return;
      dragging = false;
      const now = performance.now();
      const recent = samples.filter((sample) => now - sample.time < 120);
      const first = recent[0];
      if (first && recent.length > 1 && !reduceMotion()) {
        const span = Math.max(16, now - first.time) / 1000;
        velocity = clamp(
          recent.reduce((sum, sample) => sum + sample.dx, 0) / span,
          -540,
          540
        );
      }
      invalidate();
    },
    setHover(next) {
      hovering = next;
      invalidate();
    },
    invalidate,
    destroy() {
      destroyed = true;
      if (frame !== 0) cancelAnimationFrame(frame);
      resize.disconnect();
      theme.disconnect();
      viewport.disconnect();
      reducedMotion.removeEventListener('change', onMotionPreference);
    },
  };
}

export function initPlanet(root) {
  if (!root) return;
  const globe = root.querySelector('[data-planet-globe]');
  const canvas = root.querySelector('[data-planet-canvas]');
  if (!globe || !canvas) return;

  const markerEls = [...root.querySelectorAll('[data-planet-marker]')];
  const listeners = new Set();
  const initial = (root.dataset.rotation || '78,18')
    .split(',')
    .map((part) => Number(part.trim()));
  const autoSpeed = reduceMotion() ? 0 : Number(root.dataset.autoRotate || 4);
  let spin = autoSpeed;
  let selected = null;
  let toggleButton = root.querySelector('[data-planet-toggle]');

  const syncToggle = () => {
    if (!toggleButton) return;
    const paused = spin === 0;
    root.classList.toggle('is-paused', paused);
    toggleButton.setAttribute('aria-pressed', String(paused));
    toggleButton.setAttribute('aria-label', t(paused ? 'hero.planet.play' : 'hero.planet.pause'));
    toggleButton.setAttribute('title', t(paused ? 'hero.planet.play' : 'hero.planet.pause'));
    const playIcon = toggleButton.querySelector('.p-planet-icon-play');
    const pauseIcon = toggleButton.querySelector('.p-planet-icon-pause');
    if (playIcon) playIcon.hidden = !paused;
    if (pauseIcon) pauseIcon.hidden = paused;
  };

  const selectMarker = (id) => {
    selected = id;
    root.querySelectorAll('[data-planet-marker]').forEach((marker) => {
      const on = marker.dataset.marker === id;
      marker.classList.toggle('is-selected', on);
      const button = marker.querySelector('button');
      if (button) button.setAttribute('aria-pressed', String(on));
    });
    root.querySelectorAll('[data-planet-target]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.planetTarget === id));
    });
  };

  // Each marker moves to where its coordinate now is on the globe.
  const placeMarkers = (project) => {
    markerEls.forEach((marker) => {
      const { x, y, depth } = project(Number(marker.dataset.lat), Number(marker.dataset.lng));
      const shown = clamp((depth - 0.06) / (0.28 - 0.06), 0, 1);
      marker.style.left = `${x.toFixed(2)}px`;
      marker.style.top = `${y.toFixed(2)}px`;
      marker.style.opacity = shown.toFixed(3);
      marker.style.pointerEvents = shown > 0.5 ? '' : 'none';
      marker.toggleAttribute('inert', shown <= 0.5);
      marker.style.zIndex = String(Math.round(depth * 100));
    });
  };
  listeners.add(placeMarkers);

  const engine = createPlanet(canvas, {
    rotation: Number.isFinite(initial[0]) ? initial : [78, 18],
    autoRotate: spin,
    listeners,
    onFrame: ({ longitude }) => {
      globe.setAttribute('aria-valuenow', String(Math.round(longitude)));
    },
    onSettle: ([longitude]) => {
      globe.setAttribute('aria-valuenow', String(Math.round(longitude)));
    },
  });

  // The globe can be dragged; a finger still scrolls the page vertically.
  const pointer = { id: null, x: 0, y: 0, vertical: false };
  globe.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('[data-planet-marker]')) return;
    globe.setPointerCapture(event.pointerId);
    pointer.id = event.pointerId;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.vertical = event.pointerType !== 'touch';
    engine.dragStart();
  });
  globe.addEventListener('pointermove', (event) => {
    if (pointer.id !== event.pointerId) return;
    engine.dragMove(event.clientX - pointer.x, event.clientY - pointer.y, pointer.vertical);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  const endDrag = (event) => {
    if (pointer.id !== event.pointerId) return;
    pointer.id = null;
    engine.dragEnd();
  };
  globe.addEventListener('pointerup', endDrag);
  globe.addEventListener('pointercancel', endDrag);
  globe.addEventListener('pointerenter', () => engine.setHover(true));
  globe.addEventListener('pointerleave', () => engine.setHover(false));
  globe.addEventListener('keydown', (event) => {
    const turn = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, KEY_STEP],
      ArrowDown: [0, -KEY_STEP],
    }[event.key];
    if (!turn) return;
    event.preventDefault();
    engine.rotateBy(turn[0], turn[1]);
  });

  root.querySelectorAll('[data-planet-rotate]').forEach((button) => {
    button.addEventListener('click', () => engine.rotateBy(Number(button.dataset.planetRotate)));
  });

  toggleButton?.addEventListener('click', () => {
    spin = spin === 0 ? autoSpeed || 4 : 0;
    engine.setAutoRotate(spin);
    syncToggle();
  });

  root.querySelector('[data-planet-reset]')?.addEventListener('click', () => {
    engine.rotateTo(Number.isFinite(initial[0]) ? initial : [78, 18]);
    selectMarker(null);
  });

  markerEls.forEach((marker) => {
    const id = marker.dataset.marker;
    const button = marker.querySelector('button');
    if (button) {
      button.addEventListener('click', () => {
        selectMarker(id);
        engine.rotateTo([Number(marker.dataset.lng), Number(marker.dataset.lat) * 0.6]);
      });
    }
  });

  root.querySelectorAll('[data-planet-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.planetTarget;
      const marker = markerEls.find((item) => item.dataset.marker === id);
      if (!marker) return;
      selectMarker(id);
      engine.rotateTo([Number(marker.dataset.lng), Number(marker.dataset.lat) * 0.6]);
    });
  });

  const onLanguage = () => syncToggle();
  document.addEventListener('owlaso:langchange', onLanguage);
  syncToggle();

  // A theme change is handled by the engine's own observer. Clean up if the
  // globe ever leaves the page.
  window.addEventListener('pagehide', () => {
    document.removeEventListener('owlaso:langchange', onLanguage);
    engine.destroy();
  });
}

/* ═══════════════════════════════════════════════
   TiltCard — the card leans towards the pointer
   ═══════════════════════════════════════════════ */

export function initTiltCards() {
  if (reduceMotion()) return;
  document.querySelectorAll('[data-tilt]').forEach((root) => {
    const card = root.querySelector('.p-tilt-card') || root;
    const tilt = Number(root.dataset.tiltAmount || 7);
    let frame = 0;
    let active = false;

    const lean = (event) => {
      if (event.pointerType === 'touch') return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = root.getBoundingClientRect();
        if (!box.width || !box.height) return;
        const x = ((event.clientX - box.left) / box.width) * 2 - 1;
        const y = ((event.clientY - box.top) / box.height) * 2 - 1;
        if (!active) {
          root.dataset.tilting = '';
          active = true;
        }
        card.style.setProperty('--pu-rx', `${(-y * tilt).toFixed(2)}deg`);
        card.style.setProperty('--pu-ry', `${(x * tilt).toFixed(2)}deg`);
        card.style.setProperty('--pu-px', x.toFixed(3));
        card.style.setProperty('--pu-py', y.toFixed(3));
        card.style.setProperty('--pu-gx', `${(((x + 1) / 2) * 100).toFixed(1)}%`);
        card.style.setProperty('--pu-gy', `${(((y + 1) / 2) * 100).toFixed(1)}%`);
      });
    };

    const settle = () => {
      cancelAnimationFrame(frame);
      active = false;
      delete root.dataset.tilting;
      for (const name of ['--pu-rx', '--pu-ry', '--pu-px', '--pu-py']) {
        card.style.removeProperty(name);
      }
    };

    root.addEventListener('pointermove', lean);
    root.addEventListener('pointerleave', settle);
    root.addEventListener('blur', settle, true);
  });
}

/* ═══════════════════════════════════════════════
   RangeMeter — a ruler that rises under the value
   ═══════════════════════════════════════════════ */

const METER_SPREAD = 2.6;
const METER_REST = 0.34;

export function initRangeMeters() {
  document.querySelectorAll('[data-meter]').forEach((meter) => {
    if (meter.dataset.meterReady === '1') return;
    meter.dataset.meterReady = '1';

    const min = Number(meter.dataset.meterMin || 0);
    const max = Number(meter.dataset.meterMax || 100);
    const value = Number(meter.dataset.meterValue || 0);
    const count = Math.max(2, Number(meter.dataset.meterTicks || 41));
    const span = max - min || 1;
    const share = clamp((value - min) / span, 0, 1);
    const at = share * (count - 1);
    const crest = Math.round(at);

    const tag = document.createElement('span');
    tag.className = 'p-meter-tag';
    tag.textContent = String(value);
    tag.style.insetInlineStart = `${(share * 100).toFixed(2)}%`;
    tag.style.translate = `${(-share * 100).toFixed(2)}% 0`;

    const ruler = document.createElement('div');
    ruler.className = 'p-meter-ruler';
    ruler.setAttribute('aria-hidden', 'true');

    for (let index = 0; index < count; index += 1) {
      const distance = (index - at) / METER_SPREAD;
      const rise = Math.exp(-distance * distance);
      const lit = index <= at + 0.001;
      const tick = document.createElement('span');
      tick.className = 'p-meter-tick';
      if (lit) tick.classList.add('is-lit');
      if (index === crest) tick.classList.add('is-crest');
      tick.style.height = `${((METER_REST + (1 - METER_REST) * rise) * 100).toFixed(1)}%`;
      if (lit && crest > 0) {
        tick.style.opacity = (0.35 + 0.65 * Math.min(1, index / crest)).toFixed(3);
      }
      ruler.append(tick);
    }

    meter.replaceChildren(tag, ruler);
    const description = meter.dataset.meterDescription;
    if (description) meter.setAttribute('aria-valuetext', description);
  });
}

/* ═══════════════════════════════════════════════
   Toast — small cards that arrive from the edge
   ═══════════════════════════════════════════════ */

let toastViewport = null;

function ensureToastViewport() {
  if (toastViewport?.isConnected) return toastViewport;
  toastViewport = document.createElement('div');
  toastViewport.className = 'p-toasts';
  toastViewport.dataset.toasts = '';
  toastViewport.setAttribute('aria-live', 'polite');
  toastViewport.setAttribute('aria-relevant', 'additions');
  document.body.append(toastViewport);
  return toastViewport;
}

export function showToast({ title, description = '', type = 'success', duration = 4600 }) {
  const viewport = ensureToastViewport();
  const toast = document.createElement('div');
  toast.className = 'p-toast';
  toast.dataset.type = type;
  toast.setAttribute('role', type === 'destructive' ? 'alert' : 'status');

  const mark = document.createElement('span');
  mark.className = 'p-toast-mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML = '<i></i><i></i><i></i><i></i>';

  const body = document.createElement('div');
  body.className = 'p-toast-body';
  const titleEl = document.createElement('p');
  titleEl.className = 'p-toast-title';
  titleEl.textContent = title;
  body.append(titleEl);
  if (description) {
    const desc = document.createElement('p');
    desc.className = 'p-toast-desc';
    desc.textContent = description;
    body.append(desc);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'p-toast-close';
  close.setAttribute('aria-label', 'Dismiss notification');
  close.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  toast.append(mark, body, close);
  viewport.append(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));

  let timer = window.setTimeout(dismiss, duration);

  function dismiss() {
    window.clearTimeout(timer);
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 320);
  }

  close.addEventListener('click', dismiss);
  toast.addEventListener('pointerenter', () => window.clearTimeout(timer));
  toast.addEventListener('pointerleave', () => {
    timer = window.setTimeout(dismiss, 1800);
  });

  return dismiss;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

/* ═══════════════════════════════════════════════
   CommandDock — a keyword preview of the model
   ═══════════════════════════════════════════════ */

function hashKeyword(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function scoresFor(keyword) {
  if (keyword.trim().toLowerCase() === 'habit tracker') {
    return { popularity: 78, difficulty: 64, opportunity: 28 };
  }
  const seed = hashKeyword(keyword.toLowerCase());
  const popularity = 42 + (seed % 54);
  const difficulty = 18 + ((seed >>> 5) % 62);
  return {
    popularity,
    difficulty,
    opportunity: Math.round((popularity * (100 - difficulty)) / 100),
  };
}

const scoreMeta = ({ popularity, difficulty, opportunity }) =>
  `P ${popularity} · D ${difficulty} · O ${opportunity}`;

export function initCommandDock(root) {
  if (!root) return;
  const surface = root.querySelector('[data-dock-surface]');
  const trigger = root.querySelector('[data-dock-trigger]');
  const panel = root.querySelector('[data-dock-panel]');
  const form = root.querySelector('[data-dock-form]');
  const input = root.querySelector('[data-dock-input]');
  const results = root.querySelector('[data-dock-results]');
  if (!surface || !trigger || !panel || !form || !input || !results) return;

  let open = false;
  let busy = false;

  const setInert = () => {
    panel.toggleAttribute('inert', !open);
    trigger.toggleAttribute('inert', open);
  };

  const setOpen = (next) => {
    if (open === next) return;
    open = next;
    if (open) root.setAttribute('data-open', '');
    else root.removeAttribute('data-open');
    trigger.setAttribute('aria-expanded', String(open));
    setInert();
    if (open) {
      window.setTimeout(() => input.focus({ preventScroll: true }), 160);
    }
  };

  const close = () => {
    setOpen(false);
    trigger.focus({ preventScroll: true });
  };

  const addRow = (title, meta) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'p-dock-row';
    row.setAttribute('role', 'listitem');

    const label = document.createElement('span');
    label.className = 'p-dock-row-title';
    label.textContent = title;
    const value = document.createElement('span');
    value.className = 'p-dock-row-meta';
    value.textContent = meta;

    row.append(label, value);
    row.addEventListener('click', () => {
      showToast({ title: t('try.rowToast.title'), description: t('try.rowToast.desc'), type: 'info' });
    });
    results.append(row);
  };

  const render = (keyword) => {
    results.replaceChildren();
    results.classList.remove('is-filled');

    if (!keyword) {
      const empty = document.createElement('div');
      empty.className = 'p-dock-status';
      empty.textContent = t('try.noResults');
      results.append(empty);
      results.classList.add('is-filled');
      return;
    }

    busy = true;
    input.disabled = true;
    const looking = document.createElement('div');
    looking.className = 'p-dock-status';
    looking.innerHTML = '<span class="p-dock-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
    const words = document.createElement('span');
    words.textContent = t('try.searching');
    looking.append(words);
    results.append(looking);
    results.classList.add('is-filled');

    window.setTimeout(() => {
      busy = false;
      input.disabled = false;
      results.replaceChildren();
      addRow(keyword, scoreMeta(scoresFor(keyword)));
      addRow(t('try.results.similar'), scoreMeta(scoresFor(`${keyword} app`)));
      addRow(t('try.results.stores'), scoreMeta(scoresFor(`${keyword} store`)));
      addRow(t('try.results.competitors'), scoreMeta(scoresFor(`${keyword} 2026`)));
      results.classList.add('is-filled');
    }, 720);
  };

  trigger.addEventListener('click', () => {
    setOpen(true);
    trigger.setAttribute('aria-expanded', 'true');
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (busy) return;
    const value = input.value.trim().slice(0, 64);
    render(value);
  });

  document.addEventListener('pointerdown', (event) => {
    if (open && !root.contains(event.target)) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !open) return;
    if (!root.contains(document.activeElement)) return;
    close();
  });

  // Keep the panel reachable while it is closed but still visible in the
  // layout: the trigger is the only tab stop then.
  setInert();

  // A language change while the dock holds generated rows: regenerate the
  // labels in the new language without losing the keyword.
  document.addEventListener('owlaso:langchange', () => {
    const current = input.value.trim();
    if (!open || !current) return;
    const value = current.slice(0, 64);
    render(value);
  });
}

/* ═══════════════════════════════════════════════
   Copy buttons — install commands + toast
   ═══════════════════════════════════════════════ */

export function initCopyActions() {
  document.querySelectorAll('[data-copy-install]').forEach((button) => {
    button.addEventListener('click', async () => {
      const commands =
        'git clone https://github.com/owlaso/owlaso.git\n' +
        'cd owlaso\n' +
        'npm install\n' +
        'npm run electron';
      const ok = await copyText(commands);
      if (!ok) return;
      button.classList.add('is-copied');
      window.setTimeout(() => button.classList.remove('is-copied'), 1600);
      showToast({
        title: t('install.copyToast.title'),
        description: t('install.copyToast.desc'),
        type: 'success',
      });
    });
  });
}

/* ═══════════════════════════════════════════════
   Boot
   ═══════════════════════════════════════════════ */

export function initPanelUI() {
  initRollingNumbers();
  document.querySelectorAll('[data-planet]').forEach(initPlanet);
  initTiltCards();
  initRangeMeters();
  document.querySelectorAll('[data-dock]').forEach(initCommandDock);
  initCopyActions();
}
