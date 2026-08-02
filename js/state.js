const SVG_NS = "http://www.w3.org/2000/svg";

/* ============================================================
   AUTHOR
   ============================================================ */
// Change these two lines if the handle ever changes. Everything else,
// the header link, the export credits and the metadata, reads from here.
const AUTHOR_HANDLE = "teramike_";
const AUTHOR_URL = "https://x.com/" + AUTHOR_HANDLE;

/* ============================================================
   CURATED PALETTES — bg + up to 4 inks each
   ============================================================ */
/* Each palette is a background plus four inks ordered dark to light.
   Hues inside a palette sit on a controlled arc, so interpolating between
   any two of them travels through a colour that belongs to the set. That,
   plus perceptual mixing in the shader, is what keeps the middle of a
   gradient vivid instead of grey. */
const PALETTES = [
  // deep and moody
  { name: "midnight oil",  bg: "#05070D", inks: ["#16305C", "#2F6FB5", "#6FB3E8", "#CFE6FA"] },
  { name: "deep forest",   bg: "#04100C", inks: ["#0E3A2A", "#1E7A55", "#5FBF8A", "#CFEBD6"] },
  { name: "ember",         bg: "#140604", inks: ["#4A1208", "#A82C0C", "#F2701E", "#FFC98A"] },
  { name: "plum smoke",    bg: "#0C0714", inks: ["#2E1745", "#5C2E78", "#9B62B8", "#E4C8F0"] },
  { name: "teal ink",      bg: "#04100F", inks: ["#0B3B3C", "#14706E", "#35B7A8", "#BFF0E4"] },
  { name: "oxblood",       bg: "#120507", inks: ["#3D0E17", "#8A1F2E", "#D14A54", "#F5B8AE"] },
  // light and editorial
  { name: "porcelain",     bg: "#F6F2EA", inks: ["#E6DCCB", "#C9A87C", "#96603A", "#2B211A"] },
  { name: "sea glass",     bg: "#EFF5F3", inks: ["#CFE3DC", "#8FBFB0", "#47867A", "#16332E"] },
  { name: "paper sky",     bg: "#F2F5FA", inks: ["#D8E4F2", "#9FBEE0", "#4F7FB5", "#1B3350"] },
  { name: "dune",          bg: "#FAF4E8", inks: ["#EDDCBE", "#D8B276", "#A9713C", "#402A18"] },
  { name: "blush",         bg: "#FBF0EF", inks: ["#F5D5D2", "#E5A19E", "#C05F60", "#4A2223"] },
  // vivid
  { name: "citrus",        bg: "#170C02", inks: ["#6B2A05", "#D4630D", "#F7A81B", "#FFE9A3"] },
  { name: "electric",      bg: "#050318", inks: ["#1B1B7A", "#4040E0", "#8A6BFF", "#D9CBFF"] },
  { name: "flamingo",      bg: "#1A0714", inks: ["#63104A", "#C22E7E", "#FF6FA8", "#FFD0DE"] },
  { name: "lime soda",     bg: "#06140A", inks: ["#14501F", "#35A03A", "#86D944", "#E3F7B8"] },
  { name: "cyan burn",     bg: "#02101A", inks: ["#06405C", "#0E86A8", "#35D0DC", "#C9F5F7"] },
  // earth and organic
  { name: "clay",          bg: "#17110D", inks: ["#45312A", "#7E5946", "#B78A6A", "#E8D6C0"] },
  { name: "moss stone",    bg: "#0D120E", inks: ["#2A3A2C", "#52704F", "#8CA87C", "#DCE6CE"] },
  { name: "rust field",    bg: "#150C08", inks: ["#4A2317", "#8E4526", "#C87843", "#F0D2A8"] },
  { name: "slate",         bg: "#0A0C0F", inks: ["#212932", "#3E4B5A", "#74879B", "#CBD6E2"] },
  // sky and sunset
  { name: "gulf sunset",   bg: "#10061A", inks: ["#4B1250", "#A32C5C", "#F0704A", "#FFD48A"] },
  { name: "alpenglow",     bg: "#0B0A1E", inks: ["#2B2160", "#6A4396", "#C2679E", "#FFC6A8"] },
  { name: "monsoon",       bg: "#070E14", inks: ["#14303F", "#2C6076", "#6FA8B0", "#E0EFE4"] },
  // restrained
  { name: "graphite",      bg: "#0A0A0B", inks: ["#232327", "#4A4A52", "#8E8E99", "#EDEDF0"] },
  { name: "ink and gold",  bg: "#08080A", inks: ["#1C1C22", "#3A3A44", "#B08A3C", "#F5E3B0"] },
  { name: "bone",          bg: "#F7F5F0", inks: ["#DEDAD0", "#A9A398", "#5C574E", "#16150F"] },
  // jewel
  { name: "peacock",       bg: "#04121A", inks: ["#0A3B4A", "#12727E", "#C9A227", "#F2E2A8"] },
  { name: "velvet",        bg: "#10040E", inks: ["#37103A", "#6B1E62", "#B23E7C", "#F0A9B8"] },
];

/* ============================================================
   SCENES — the pattern generators the shader implements
   ============================================================ */
const SCENES = [
  { key: "liquid",   idx: 0,  name: "Liquid",  desc: "stirred paint · the classic" },
  { key: "aurora",   idx: 5,  name: "Aurora",  desc: "dancing light curtains" },
  { key: "vortex",   idx: 6,  name: "Vortex",  desc: "arms of paint, stirred" },
  { key: "drops",    idx: 7,  name: "Drops",   desc: "ink blooming in water" },
  { key: "caustics", idx: 8,  name: "Reef",    desc: "underwater light webs" },
  { key: "current",  idx: 9,  name: "Current", desc: "a river of flowing ink" },
  { key: "glass",    idx: 10, name: "Glass",   desc: "sun through frosted glass" },
  { key: "silk",     idx: 1,  name: "Silk",    desc: "flowing woven waves" },
  { key: "marble",   idx: 2,  name: "Marble",  desc: "ink veins · marbling" },
  { key: "clouds",   idx: 3,  name: "Clouds",  desc: "soft airy nebula" },
  { key: "lava",     idx: 4,  name: "Cutout",  desc: "layered organic shapes" },
];
const SCENE_BY_KEY = Object.fromEntries(SCENES.map(s => [s.key, s]));
// How each scene consumes the palette:
//  alternate — inks alternated with bg (liquid's classic recipe)
//  cycle     — inks as bands in authored order (marble, vortex arms, drops)
//  ramp      — bg→inks sorted by luminance so ramps stay clean (no neon fringes)
const SCENE_PALETTE_LAYOUT = {
  liquid: "alternate", marble: "cycle", vortex: "cycle", drops: "cycle",
  silk: "ramp", clouds: "ramp", lava: "ramp", aurora: "ramp",
  caustics: "ramp", current: "ramp", glass: "ramp",
};

// Params applied when switching into a scene (only look-shaping params —
// palette, grade, texture and view survive scene hops).
const SCENE_DEFAULTS = {
  liquid: {
    speed: 0.5, gradientSize: 0.5, gradientCount: 12,
    warpAmount: 1.3, warpFreq: 1.9, highlight: 0.25,
    blendMode: 0.55, paintSharpness: 7,
    centerWander: 0.15, factorPulse: 0.1, flowRate: 0.35,
  },
  silk: {
    speed: 0.5, patScale: 1.0, complexity: 0.55, definition: 0.35,
    direction: 24, bands: 5, warpAmount: 1.1, highlight: 0.25, flowRate: 0.5,
  },
  marble: {
    speed: 0.4, patScale: 1.0, complexity: 0.7, definition: 0.8,
    direction: 65, bands: 5, warpAmount: 1.25, highlight: 0.12, flowRate: 0.35,
  },
  clouds: {
    speed: 0.5, patScale: 1.0, complexity: 0.6, definition: 0.45,
    bands: 5, warpAmount: 0.6, highlight: 0.3, flowRate: 0.5,
  },
  lava: {
    speed: 0.6, patScale: 1.0, complexity: 0.5, definition: 0.75,
    bands: 5, gradientSize: 0.55, gradientCount: 10,
    warpAmount: 0.8, highlight: 0.1, flowRate: 0.5,
  },
  aurora: {
    speed: 0.5, patScale: 1.0, complexity: 0.55, definition: 0.5,
    bands: 5, warpAmount: 0.8, highlight: 0.5, flowRate: 0.55,
  },
  vortex: {
    speed: 0.5, patScale: 1.0, complexity: 0.55, definition: 0.6,
    direction: 35, bands: 5, gradientCount: 4,   // four arms
    warpAmount: 0.9, highlight: 0.4, flowRate: 0.5,
  },
  drops: {
    speed: 0.5, patScale: 1.0, complexity: 0.55, definition: 0.55,
    bands: 5, highlight: 0.5, flowRate: 0.4, warpAmount: 0.6,
  },
  caustics: {
    speed: 0.5, patScale: 1.0, complexity: 0.6, definition: 0.55,
    bands: 5, highlight: 0.55, flowRate: 0.5, warpAmount: 0.8, balance: -0.15,
  },
  current: {
    speed: 0.55, patScale: 1.0, complexity: 0.5, definition: 0.6,
    direction: 10, bands: 5, highlight: 0.45, flowRate: 0.5, balance: 0,
  },
  glass: {
    speed: 0.45, patScale: 1.0, complexity: 0.08, definition: 0.4,
    bands: 5, highlight: 0.6, flowRate: 0.4, warpAmount: 1.0, balance: 0.2,
  },
};
// Every field a scene hop may touch — snapshotted per scene so hopping
// back restores your tweaks instead of resetting to defaults.
const SCENE_TUNABLES = [
  "speed", "gradientSize", "gradientCount", "warpAmount", "warpFreq", "highlight",
  "blendMode", "paintSharpness", "centerWander", "factorPulse", "flowRate",
  "patScale", "complexity", "definition", "direction", "bands", "balance",
];

/* ============================================================
   STATE
   ============================================================ */
function defaultState() {
  return {
    canvas: { w: 1600, h: 900, radius: 0, baseColor: "#10061A" },
    shader: {
      scene: "liquid",
      seed: 0,                // 0 = classic composition; any other = fresh layout
      // Slot layout depends on scene (see paletteToSlots). Opens on gulf
      // sunset in liquid's alternating recipe: rose, coral and gold over
      // deep aubergine. Chosen because it reads well the instant you land.
      colors: ["#A32C5C", "#10061A", "#F0704A", "#10061A", "#FFD48A", "#10061A"],
      baseColor: "#10061A",
      speed: 0.5,
      intensity: 1.6,
      grainIntensity: 0.05,
      zoom: 1.0,
      panX: 0,
      panY: 0,
      rotation: 0,            // radians; rotates the view around canvas center
      gradientSize: 0.5,
      gradientCount: 12,
      color1Weight: 0.9,      // odd slots (C1/C3/C5)
      color2Weight: 1.3,      // even slots (C2/C4/C6)
      centerSizes: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      saturation: 1.2,
      timeShift: 0.0,
      overlayMix: 0.15,
      warpAmount: 1.4,        // domain warp — 0 = blobby circles, 1+ = liquid paint flow
      warpFreq: 1.9,
      highlight: 0.3,         // bright wisps · sheen · core glow
      blendMode: 0.55,        // 0 = additive plasma, 1 = pure mesh
      paintSharpness: 7,      // 1 = blend (mesh), higher = paint-like
      centerWander: 0.15,
      factorPulse: 0.1,
      flowRate: 0.5,
      vibrance: 1.2,
      contrast: 1.02,
      lightness: 1.05,
      // — new-scene macro params —
      patScale: 1.0,          // pattern scale for silk/marble/clouds/lava/aurora/vibeflow
      complexity: 0.55,       // detail octaves 0..1
      definition: 0.6,        // soft ↔ sharp 0..1
      direction: 35,          // degrees — silk/marble flow direction · vibeflow twist
      bands: 5,               // palette stops used by ramp scenes (2..6)
      balance: 0,             // −1..1 — background ↔ ink dominance in ramp scenes
      // — finish —
      vignette: 0,        // stays 0 by default so legacy saved looks render unchanged
      textureType: "none",    // none|paper|canvas|petals|halftone|topo|image
      textureAmount: 0.5,
      textureScale: 1.0,
      textureImage: null,     // dataURL of an uploaded/library image texture
      textureBlend: "softlight",  // multiply|softlight|overlay|screen (image only)
      textureMono: true,      // desaturate the image before blending
      // texture mask — where the texture is allowed to live
      maskKind: "none",       // none|artwork|radial|linear|noise
      maskCover: 0.5,
      maskSoft: 0.35,
      maskInvert: false,
      maskAngle: 90,          // degrees, linear mask
      maskScale: 1.0,         // noise mask scale
      dither: 1,              // 1 = banding-killer on (leave on)
      oklab: true,            // perceptual color ramps for the non-liquid scenes
      animate: true,
      touchEnabled: true,     // move the mouse over the canvas to stir the paint
      freezeRipples: false,
      time: 8,
    },
    // Which palette the strips last applied (drives re-layout on scene hop).
    palette: { bg: "#10061A", inks: ["#4B1250", "#A32C5C", "#F0704A", "#FFD48A"] },
    // Per-scene tweak snapshots (SCENE_TUNABLES) — filled as you hop scenes.
    sceneMemory: {},
    overlay: {
      mode: "none",           // none | mark | wordmark | lockup
      color: "#ffffff",
      x: 50, y: 50,           // % of canvas
      scale: 1.0,
      heroMock: false,        // dummy hero copy to judge text contrast
      heroTitle: "Your headline goes here.",
      heroSub: "A second line, to check how small text holds up.",
      heroCta: "Get started",
      logoSrc: null,
      logoAspect: 1,
      heroColor: "#ffffff",
    },
  };
}

const CUSTOM_DEFAULT_KEY = "flow-lab-custom-default";

// Deep-merge: fill missing keys from `defaults` into `loaded` so presets
// saved before new fields were added still work correctly.
function deepMerge(loaded, defaults) {
  if (!loaded) return defaults;
  const result = { ...defaults };
  for (const key in loaded) {
    if (loaded[key] !== null && typeof loaded[key] === 'object' && !Array.isArray(loaded[key])
        && defaults[key] && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
      result[key] = { ...defaults[key], ...loaded[key] };
    } else {
      result[key] = loaded[key];
    }
  }
  return result;
}

// Legacy states (logo-lab era) carried `logo`/`type` blocks. Map them onto
// the new overlay so an old default/preset doesn't silently lose its lockup.
function migrateLegacyState(s) {
  if (!s) return s;
  if (!s.overlay && (s.logo || s.type)) {
    const d = defaultState().overlay;
    s.overlay = { ...d, mode: "lockup" };
    if (s.logo && typeof s.logo.x === "number" && s.type && typeof s.type.x === "number") {
      s.overlay.x = (s.logo.x + s.type.x) / 2;
      s.overlay.y = (s.logo.y + s.type.y) / 2;
    }
    if (s.type && typeof s.type.size === "number") s.overlay.scale = s.type.size / 124;
    if (s.type && s.type.color) s.overlay.color = s.type.color;
  }
  if (s.shader && !s.palette) {
    // Derive a palette from the 6 slots: unique non-base colors become inks.
    const base = (s.shader.baseColor || "#10061A").toLowerCase();
    const inks = [];
    for (const c of (s.shader.colors || [])) {
      if (!c) continue;
      const lc = c.toLowerCase();
      if (lc !== base && !inks.includes(lc)) inks.push(lc);
    }
    if (inks.length) s.palette = { bg: s.shader.baseColor, inks: inks.slice(0, 4) };
  }
  return s;
}

function loadCustomDefault() {
  try {
    const raw = localStorage.getItem(CUSTOM_DEFAULT_KEY);
    if (raw) {
      const loaded = JSON.parse(raw);
      if (loaded && loaded.shader) {
        return deepMerge(migrateLegacyState(loaded), defaultState());
      }
    }
  } catch {}
  return null;
}
let state = loadCustomDefault() || defaultState();

/* ============================================================
   UTILS
   ============================================================ */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rand = (a, b) => Math.random() * (b - a) + a;
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[randInt(0, arr.length - 1)];

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (k === "class") e.className = attrs[k];
    else if (k === "html") e.innerHTML = attrs[k];
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]);
  }
  const arr = Array.isArray(children) ? children : [children];
  for (const c of arr) {
    if (c == null || c === false) continue;
    e.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

function escapeXML(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", "'":"&apos;", '"':"&quot;" }[c]));
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ---------- color helpers ---------- */
// HSL → hex. h in [0,360), s/l in [0,100].
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1)      { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else             { r = c; b = x; }
  const m = l - c / 2;
  const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}
function hexToHsl(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { h: 0, s: 0, l: 0 };
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else                h = ((r - g) / d + 4) * 60;
  return { h, s: s * 100, l: l * 100 };
}
function spinHex(hex, deg) {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h + deg, s, l);
}
function isLightHex(hex) { return hexToHsl(hex).l > 55; }

/* ============================================================
   PALETTE → SHADER SLOT LAYOUTS
   ============================================================ */
// How the inks + bg fill the 6 shader color slots, per scene family.
//  alternate → ink/base alternated (liquid's classic fluid recipe)
//  cycle     → authored ink order as repeating bands (marble, vibeflow)
//  ramp      → inks sorted by luminance away from the bg, so the bg→ink ramp
//              is monotonic and colors land where you expect (no neon fringes)
function paletteToSlots(pal, sceneKey) {
  const inks = pal.inks.filter(Boolean);
  const layout = SCENE_PALETTE_LAYOUT[sceneKey] || "ramp";
  const out = new Array(6);
  if (layout === "alternate") {
    for (let i = 0; i < 6; i++) {
      out[i] = (i % 2 === 0) ? inks[(i / 2) % inks.length] : pal.bg;
    }
  } else if (layout === "cycle") {
    for (let i = 0; i < 6; i++) out[i] = inks[Math.min(i, inks.length - 1)];
  } else {
    const sorted = inks.slice().sort((a, b) =>
      isLightHex(pal.bg) ? hexToHsl(b).l - hexToHsl(a).l : hexToHsl(a).l - hexToHsl(b).l
    );
    for (let i = 0; i < 6; i++) out[i] = sorted[Math.min(i, sorted.length - 1)];
  }
  return out;
}

function applyPalette(pal, opts = {}) {
  state.palette = { bg: pal.bg, inks: pal.inks.slice() };
  state.shader.baseColor = pal.bg;
  state.canvas.baseColor = pal.bg;
  state.shader.colors = paletteToSlots(pal, state.shader.scene);
  if (!opts.keepBands) {
    state.shader.bands = clamp(pal.inks.length + 1, 2, 6);
  }
}

/* ============================================================
   SCENE SWITCHING (with per-scene tweak memory)
   ============================================================ */
function snapshotSceneTunables() {
  const snap = {};
  for (const k of SCENE_TUNABLES) snap[k] = state.shader[k];
  state.sceneMemory[state.shader.scene] = snap;
}
function switchScene(key) {
  if (!SCENE_BY_KEY[key] || key === state.shader.scene) return;
  snapshotSceneTunables();
  state.shader.scene = key;
  const remembered = state.sceneMemory[key];
  const source = remembered || SCENE_DEFAULTS[key] || {};
  for (const k in source) state.shader[k] = source[k];
  // Re-layout the palette slots for the new scene family
  applyPalette(state.palette, { keepBands: !!remembered });
}
