/* ═══════════════════════════════════════════════
   OwlASO — PanelUI NotFound port
   The 404 is drawn in pixels on a canvas. Cells
   near the pointer scatter, the highlighted digit
   is always lit and a soft band of light travels
   around the code. Reduced motion is respected.
   ═══════════════════════════════════════════════ */

const GLYPH_COLUMNS = 15;
const GLYPH_ROWS = 21;
const SCALE = 3;

const DIGITS = {
  0: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  1: ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '.###.', '#....', '#....', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['#..#.', '#..#.', '#..#.', '#####', '...#.', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '....#', '####.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '....#', '...##', '...#.', '...#.', '...#.'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.']
};

/** Empty cells between two digits: two of a digit's own pixels. */
const GAP = 6;
/** Room round the code, in cells, for scattered cells to fly into. */
const PAD_X = 10;
const PAD_Y = 8;

/** How strong an unlit cell is drawn: three strengths, picked per cell. */
const PLAIN_TONES = [0.22, 0.34, 0.48];
/** How lit the highlighted digit is with nothing else lighting it. */
const HIGHLIGHT_LIGHT = 0.72;
/** How far the pointer's light reaches, in cells. */
const HEAT_RADIUS = 5;
/** How fast a cell lights under the pointer, and how fast it fades after, per second. */
const HEAT_RISE = 22;
const HEAT_FALL = 2.6;
/** How fast the band of light goes round the code, in radians a second. */
const BAND_SPEED = 0.55;
/** How wide the band is, in radians either side of its middle. */
const BAND_WIDTH = 0.7;
/** Steps of opacity the cells are batched into. Each is one fill per frame. */
const ALPHA_STEPS = 12;

/** Cells within this distance of a digit, in cells, make it react. */
const APPROACH = 2.5;
/** And it is put back once the pointer is this far away. */
const RELEASE = 4.5;
/** How long a tapped digit stays apart after the finger lifts, in ms. */
const TOUCH_HOLD = 700;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/** A small fast hash, so a cell's look is the same on every render. */
function seeded(n) {
  let t = (n * 0x9e3779b9) >>> 0;
  t = Math.imul(t ^ (t >>> 16), 0x85ebca6b) >>> 0;
  t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35) >>> 0;
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

function empty() {
  return Array.from({ length: GLYPH_ROWS }, () => Array(GLYPH_COLUMNS).fill(false));
}

/** A digit as a solid grid of cells, or `null` for a character there is no drawing of. */
function glyphFor(character) {
  const rows = DIGITS[character];
  if (!rows) return null;
  const glyph = empty();
  for (let y = 0; y < GLYPH_ROWS; y += 1) {
    for (let x = 0; x < GLYPH_COLUMNS; x += 1) {
      glyph[y][x] = rows[Math.floor(y / SCALE)][Math.floor(x / SCALE)] === '#';
    }
  }
  return glyph;
}

function layoutOf(code) {
  const lefts = [];
  let x = 0;
  for (let i = 0; i < code.length; i += 1) {
    if (i > 0) x += GAP;
    lefts.push(x);
    x += GLYPH_COLUMNS;
  }
  return { columns: Math.max(x, 1), lefts };
}

function makeCell(hx, hy, salt) {
  const seed = seeded(salt);
  const pick = seeded(salt + 7919);
  return {
    hx,
    hy,
    x: hx,
    y: hy,
    vx: 0,
    vy: 0,
    sx: 0,
    sy: 0,
    // Mostly dots, with a square here and there.
    square: pick < 0.28,
    size: 0.56 + seeded(salt + 104729) * 0.34,
    tone: Math.floor(seeded(salt + 1299709) * 3),
    seed,
    pick: seeded(salt + 15485863),
    heat: 0
  };
}

function cellsOf(glyph, left, salt) {
  const cells = [];
  glyph.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) cells.push(makeCell(PAD_X + left + x, PAD_Y + y, salt * 4099 + y * 97 + x));
    })
  );
  return cells;
}

function createEngine({ canvas, code, highlight, ambient }) {
  const context = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const layout = layoutOf(code);
  const columns = layout.columns + PAD_X * 2;

  let pitch = 0;
  let width = 0;
  let height = 0;
  let frame = 0;
  let last = 0;
  let time = 0;
  let destroyed = false;
  let visible = true;
  /** The pointer, in cells, or `null` when it is not over the page. */
  let pointer = null;
  let touchTimer = 0;
  /** 1 while the code is first being drawn in, falling to 0. */
  let intro = reducedMotion.matches ? 0 : 1;
  /** Whether any cell is still lit by the pointer, as of the last frame drawn. */
  let warm = false;
  let lastDraw = 0;
  /** The middle of the code, and half its size, in cells. The band goes round this. */
  const middle = { x: PAD_X + layout.columns / 2, y: PAD_Y + GLYPH_ROWS / 2 };
  const half = { x: layout.columns / 2, y: GLYPH_ROWS / 2 };

  const digits = [...code].map((character, index) => {
    const glyph = glyphFor(character);
    const cells = glyph ? cellsOf(glyph, layout.lefts[index] ?? 0, index + 1) : [];
    return {
      left: layout.lefts[index] ?? 0,
      accent: index === highlight,
      cells,
      active: false
    };
  });
  // The highlighted digit is drawn last, so its debris flies over the others'.
  const order = digits
    .map((_, i) => i)
    .sort((a, b) => Number(digits[a].accent) - Number(digits[b].accent));

  /* -------------------------- starting each effect -------------------------- */

  const centreOf = (digit) => ({
    x: PAD_X + digit.left + GLYPH_COLUMNS / 2,
    y: PAD_Y + GLYPH_ROWS / 2
  });

  const startScatter = (digit) => {
    const from = pointer ?? centreOf(digit);
    for (const cell of digit.cells) {
      // Away from the pointer, spread a little either side, and further for
      // the cells that were nearest it.
      const away = Math.atan2(cell.hy - from.y, cell.hx - from.x);
      const angle = away + (cell.seed - 0.5) * 1.6;
      const near = 1 - clamp(Math.hypot(cell.hx - from.x, cell.hy - from.y) / 16, 0, 1);
      const distance = 3 + seeded(cell.seed * 1e6) * 7 + near * 6;
      cell.sx = Math.cos(angle) * distance;
      cell.sy = Math.sin(angle) * distance;
      // A kick in the same direction, so they burst rather than drift.
      cell.vx += Math.cos(angle) * distance * 5;
      cell.vy += Math.sin(angle) * distance * 5;
    }
  };

  const activate = (index) => {
    digits.forEach((digit, i) => {
      if (i !== index && digit.active) digit.active = false;
    });
    const digit = digits[index];
    if (!digit || digit.active) return;
    digit.active = true;
    startScatter(digit);
    invalidate();
  };

  const releaseAll = () => {
    let changed = false;
    for (const digit of digits) {
      if (digit.active) {
        digit.active = false;
        changed = true;
      }
    }
    if (changed) invalidate();
  };

  /* --------------------------------- motion --------------------------------- */

  /** Steps every digit on by `dt` seconds. True while anything is still moving. */
  const step = (dt) => {
    let moving = false;
    const still = reducedMotion.matches;

    if (intro > 0) {
      intro = still ? 0 : Math.max(0, intro - dt / 0.9);
      moving ||= intro > 0;
    }
    moving ||= warm;

    for (const digit of digits) {
      if (still) {
        for (const cell of digit.cells) {
          cell.x = cell.hx;
          cell.y = cell.hy;
          cell.vx = 0;
          cell.vy = 0;
        }
        continue;
      }
      // Stiffer on the way home than on the way out: the burst should feel
      // loose, the return should snap shut.
      const stiffness = digit.active ? 60 : 150;
      const damping = 2 * Math.sqrt(stiffness) * (digit.active ? 0.7 : 0.92);
      for (const cell of digit.cells) {
        let tx = cell.hx;
        let ty = cell.hy;
        if (digit.active) {
          // Scattered cells keep drifting, so the debris is not a still picture.
          tx += cell.sx + Math.sin(time * 1.4 + cell.seed * 40) * 0.5;
          ty += cell.sy + Math.cos(time * 1.2 + cell.seed * 70) * 0.5;
        }
        // Two half steps keep a stiff spring from overshooting at 30fps.
        for (let s = 0; s < 2; s += 1) {
          const h = dt / 2;
          cell.vx += ((tx - cell.x) * stiffness - cell.vx * damping) * h;
          cell.vy += ((ty - cell.y) * stiffness - cell.vy * damping) * h;
          cell.x += cell.vx * h;
          cell.y += cell.vy * h;
        }
        if (
          !digit.active &&
          Math.abs(cell.x - tx) < 0.004 &&
          Math.abs(cell.y - ty) < 0.004 &&
          Math.abs(cell.vx) + Math.abs(cell.vy) < 0.02
        ) {
          cell.x = tx;
          cell.y = ty;
          cell.vx = 0;
          cell.vy = 0;
        } else {
          moving = true;
        }
      }
    }
    return moving;
  };

  /* --------------------------------- drawing -------------------------------- */

  const draw = (dt = 0) => {
    if (!context || width === 0) return;
    const ratio = window.devicePixelRatio || 1;
    const style = getComputedStyle(canvas);
    const plain = style.color;
    const accent = style.outlineColor || plain;
    const still = reducedMotion.matches;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    // One path per colour, opacity step and shape. A few hundred cells come
    // out as a handful of fills.
    const paths = new Map();
    const add = (isAccent, alpha, square, x, y, r) => {
      if (alpha <= 0.02 || r <= 0.2) return;
      const level = clamp(Math.round(alpha * ALPHA_STEPS), 1, ALPHA_STEPS);
      const key = `${isAccent ? 1 : 0}${square ? 1 : 0}${level}`;
      let path = paths.get(key);
      if (!path) {
        path = new Path2D();
        paths.set(key, path);
      }
      if (square) {
        if (typeof path.roundRect === 'function') path.roundRect(x - r, y - r, r * 2, r * 2, r * 0.35);
        else path.rect(x - r, y - r, r * 2, r * 2);
      } else {
        path.moveTo(x + r, y);
        path.arc(x, y, r, 0, Math.PI * 2);
      }
    };

    // The band of light: where it is now, or held on the left without motion.
    const band = still || !ambient ? Math.PI : time * BAND_SPEED;
    let anyWarm = false;

    for (const index of order) {
      const digit = digits[index];
      for (const cell of digit.cells) {
        if (intro > 0 && cell.seed * 0.7 + index * 0.1 < intro) continue;

        let x = cell.x;
        let y = cell.y;
        let alpha = 1;
        let size = cell.size;
        let isAccent = false;

        if (still && digit.active) {
          // No movement asked for: the digit only dims.
          alpha *= 0.25;
        } else {
          const flown = clamp(Math.hypot(x - cell.hx, y - cell.hy) / 9, 0, 1);
          size *= 1 - flown * 0.35;
          alpha *= 1 - flown * 0.3;
        }

        /*
         * Light. Three things light a cell: being in the highlighted digit,
         * the band going slowly round the code, and the pointer having been
         * near. Each cell turns accent at its own level of light, so a shape
         * half in the light is dithered between the two colours, the way
         * pixel art shades.
         */
        let heat = 0;
        if (pointer && !still) {
          const reach = 1 - Math.hypot(x - pointer.x, y - pointer.y) / HEAT_RADIUS;
          heat = reach > 0 ? reach * reach * (3 - 2 * reach) : 0;
        } else if (pointer) {
          const reach = 1 - Math.hypot(x - pointer.x, y - pointer.y) / HEAT_RADIUS;
          heat = reach > 0 ? 1 : 0;
        }
        if (dt > 0) {
          const rate = heat > cell.heat ? HEAT_RISE : HEAT_FALL;
          cell.heat += (heat - cell.heat) * (1 - Math.exp(-dt * rate));
          if (cell.heat < 0.004) cell.heat = 0;
        }
        if (cell.heat > 0) anyWarm = true;

        const around = Math.atan2((y - middle.y) / half.y, (x - middle.x) / half.x);
        const off = Math.atan2(Math.sin(around - band), Math.cos(around - band));
        const swept = ambient ? Math.exp(-(off * off) / (2 * BAND_WIDTH * BAND_WIDTH)) * 0.85 : 0;
        const light = Math.min(1, Math.max(digit.accent ? HIGHLIGHT_LIGHT : 0, swept, cell.heat));

        if (light > 0.1 + cell.pick * 0.85) {
          isAccent = true;
          alpha *= 0.66 + 0.34 * light;
        } else {
          alpha *= (PLAIN_TONES[cell.tone] ?? 0.34) + 0.18 * light;
        }
        size *= 0.9 + 0.2 * light + 0.35 * cell.heat;

        add(isAccent, alpha, cell.square, (x + 0.5) * pitch, (y + 0.5) * pitch, (size * pitch) / 2);
      }
    }

    warm = anyWarm;

    for (const [key, path] of paths) {
      context.fillStyle = key[0] === '1' ? accent : plain;
      context.globalAlpha = Number(key.slice(2)) / ALPHA_STEPS;
      context.fill(path);
    }
    context.globalAlpha = 1;
  };

  /* ---------------------------------- loop ---------------------------------- */

  const tick = (now) => {
    frame = 0;
    if (destroyed) return;
    const dt = last === 0 ? 1 / 60 : Math.min(1 / 30, (now - last) / 1000);
    last = now;
    time += dt;
    const moving = step(dt);
    const turning = ambient && !reducedMotion.matches;
    // With only the band moving, 30 frames a second is plenty and halves the work.
    if (moving || now - lastDraw >= 32) {
      draw(now - lastDraw > 0 && lastDraw !== 0 ? Math.min(1 / 15, (now - lastDraw) / 1000) : dt);
      lastDraw = now;
    }
    if ((moving || turning) && visible) frame = requestAnimationFrame(tick);
    else {
      last = 0;
      lastDraw = 0;
    }
  };

  function invalidate() {
    if (frame === 0 && !destroyed) frame = requestAnimationFrame(tick);
  }

  /* --------------------------------- pointer -------------------------------- */

  /** Which digit is nearest the pointer, and how far away it is, in cells. */
  const nearest = () => {
    if (!pointer) return { index: -1, distance: Infinity };
    let index = -1;
    let distance = Infinity;
    digits.forEach((digit, i) => {
      if (digit.cells.length === 0) return;
      const left = PAD_X + digit.left;
      const dx = Math.max(left - pointer.x, 0, pointer.x - (left + GLYPH_COLUMNS));
      const dy = Math.max(PAD_Y - pointer.y, 0, pointer.y - (PAD_Y + GLYPH_ROWS));
      const d = Math.hypot(dx, dy);
      if (d < distance) {
        distance = d;
        index = i;
      }
    });
    return { index, distance };
  };

  const track = (event) => {
    if (pitch === 0) return;
    const rect = canvas.getBoundingClientRect();
    pointer = {
      x: (event.clientX - rect.left) / pitch - 0.5,
      y: (event.clientY - rect.top) / pitch - 0.5
    };
  };

  const onMove = (event) => {
    // A finger only counts while it is down, and that is handled below.
    if (event.pointerType === 'touch') return;
    track(event);
    // Anywhere over the canvas the pointer lights cells, so a frame is wanted
    // even when no digit is close enough to react.
    if (
      pointer &&
      pointer.x > -HEAT_RADIUS &&
      pointer.x < columns + HEAT_RADIUS &&
      pointer.y > -HEAT_RADIUS &&
      pointer.y < GLYPH_ROWS + PAD_Y * 2 + HEAT_RADIUS
    ) {
      invalidate();
    }
    const { index, distance } = nearest();
    const current = digits.findIndex((digit) => digit.active);
    if (index !== -1 && distance <= APPROACH) activate(index);
    else if (current !== -1 && (index !== current || distance > RELEASE)) releaseAll();
  };

  const onDown = (event) => {
    if (event.pointerType !== 'touch') return;
    track(event);
    const { index, distance } = nearest();
    if (index === -1 || distance > APPROACH) return;
    window.clearTimeout(touchTimer);
    activate(index);
  };

  const onUp = (event) => {
    if (event.pointerType !== 'touch') return;
    window.clearTimeout(touchTimer);
    touchTimer = window.setTimeout(releaseAll, TOUCH_HOLD);
  };

  const onLeave = () => {
    pointer = null;
    releaseAll();
  };
  const onOut = (event) => {
    if (event.relatedTarget === null) onLeave();
  };

  let listening = false;
  const listen = (on) => {
    if (on === listening) return;
    listening = on;
    const root = document.documentElement;
    if (on) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerdown', onDown, { passive: true });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      root.addEventListener('pointerout', onOut);
      window.addEventListener('blur', onLeave);
    } else {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      root.removeEventListener('pointerout', onOut);
      window.removeEventListener('blur', onLeave);
    }
  };

  /* ------------------------------ observers -------------------------------- */

  const resize = new ResizeObserver(() => {
    const next = canvas.clientWidth;
    if (next === 0) return;
    const ratio = window.devicePixelRatio || 1;
    width = next;
    pitch = width / columns;
    height = pitch * (GLYPH_ROWS + PAD_Y * 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    // Straight away: resizing cleared the canvas, and a frame's wait would
    // show it empty.
    draw();
    invalidate();
  });
  resize.observe(canvas);

  const theme = new MutationObserver(invalidate);
  theme.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-theme']
  });

  // Off screen nothing listens and nothing moves. Coming back finishes
  // whatever was under way.
  const viewport = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    listen(visible);
    if (!visible) releaseAll();
    invalidate();
  });
  viewport.observe(canvas);

  reducedMotion.addEventListener('change', invalidate);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(touchTimer);
      listen(false);
      resize.disconnect();
      theme.disconnect();
      viewport.disconnect();
      reducedMotion.removeEventListener('change', invalidate);
    }
  };
}

/** Turn the `[data-notfound-code]` holder, if present, into the pixel 404. */
export function initNotFound() {
  const holder = document.querySelector('[data-notfound-code]');
  if (!holder) return null;
  const canvas = holder.querySelector('canvas');
  if (!canvas) return null;

  const code = holder.dataset.notfoundCode || '404';
  const layout = layoutOf(code);
  const highlight = code.length > 1 ? Math.floor((code.length - 1) / 2) : null;

  // The box keeps the code's shape before the canvas has drawn anything, and
  // the canvas reaches past it on every side by the padding, given as a share
  // of the box so it scales with it.
  holder.style.aspectRatio = `${layout.columns} / ${GLYPH_ROWS}`;
  canvas.style.left = `${(-PAD_X / layout.columns) * 100}%`;
  canvas.style.top = `${(-PAD_Y / GLYPH_ROWS) * 100}%`;
  canvas.style.width = `${(1 + (2 * PAD_X) / layout.columns) * 100}%`;
  canvas.style.height = `${(1 + (2 * PAD_Y) / GLYPH_ROWS) * 100}%`;

  return createEngine({ canvas, code, highlight, ambient: true });
}
