/* ============================================================
   MAIN — shuffle, variations, history, presets, events, init
   ============================================================ */
const PRESETS_KEY = "flow-lab-presets-v1";

/* ============================================================
   PALETTE GENERATION — color-theory harmonies + curated pulls
   ============================================================ */
function generatePalette() {
  // 45% curated — hand-picked combos keep the hit-rate high.
  if (Math.random() < 0.45) {
    const src = pick(PALETTES);
    return { bg: src.bg, inks: src.inks.slice() };
  }
  const lightBg = Math.random() < 0.22;
  const baseH = rand(0, 360);
  const harmonies = [
    { offsets: [0, 30, -30, 60],    sJ: 6,  lJ: 8  },  // analogous — cohesive
    { offsets: [0, 120, 240, 30],   sJ: 5,  lJ: 6  },  // triadic — vibrant
    { offsets: [0, 150, 210, 20],   sJ: 5,  lJ: 6  },  // split-complementary
    { offsets: [0, 20, 180, 200],   sJ: 7,  lJ: 8  },  // near-complementary
    { offsets: [0, 12, -12, 25],    sJ: 18, lJ: 22 },  // mono — varied S/L
    { offsets: [0, 40, 210, -30],   sJ: 7,  lJ: 8  },  // warm/cool contrast
  ];
  const h = pick(harmonies);
  const baseS = rand(62, 92);
  let inks = h.offsets.map((off, i) => hslToHex(
    baseH + off,
    clamp(baseS + rand(-h.sJ, h.sJ), 40, 96),
    clamp(rand(48, 72) + rand(-h.lJ, h.lJ), 30, 82)
  ));
  let bg;
  if (lightBg) {
    bg = hslToHex(baseH + rand(-18, 18), rand(18, 45), rand(88, 95));
    inks.sort((a, b) => hexToHsl(b).l - hexToHsl(a).l);   // ramp light → dark
  } else {
    bg = hslToHex(baseH + rand(-20, 20), rand(28, 58), rand(4, 12));
    inks.sort((a, b) => hexToHsl(a).l - hexToHsl(b).l);   // ramp dark → light
  }
  return { bg, inks };
}

function shufflePalette() {
  applyPalette(generatePalette());
  renderSVG();
  rebuildOpenPanels();
  pushHistory("palette");
}

/* ============================================================
   LOOK SHUFFLE — per-scene taste envelopes
   ============================================================ */
const SHUFFLE_ENVELOPES = {
  liquid(s) {
    s.gradientSize = rand(0.32, 0.7);
    s.gradientCount = pick([8, 10, 12, 12]);
    s.warpAmount = rand(0.7, 2.0);
    s.warpFreq = rand(1.2, 2.8);
    s.paintSharpness = randInt(4, 12);
    s.blendMode = rand(0.4, 0.8);
    s.centerWander = rand(0.05, 0.35);
    s.factorPulse = rand(0.02, 0.25);
    s.flowRate = rand(0.15, 0.7);
    s.speed = rand(0.25, 1.1);
    s.highlight = rand(0, 0.45);
    s.color1Weight = rand(0.5, 1.4);
    s.color2Weight = rand(0.6, 1.6);
    s.centerSizes = s.centerSizes.map(() => rand(0.6, 1.5));
  },
  silk(s) {
    s.patScale = rand(0.5, 2.0);
    s.direction = rand(-80, 80);
    s.warpAmount = rand(0.5, 1.9);
    s.complexity = rand(0.3, 0.9);
    s.definition = rand(0.1, 0.75);
    s.highlight = rand(0.05, 0.6);
    s.speed = rand(0.25, 1.0);
    s.flowRate = rand(0.2, 0.9);
    s.bands = randInt(3, 6);
  },
  marble(s) {
    s.patScale = rand(0.5, 1.8);
    s.direction = rand(-90, 90);
    s.warpAmount = rand(0.8, 2.1);
    s.complexity = rand(0.4, 1.0);
    s.definition = rand(0.5, 1.0);
    s.bands = randInt(3, 6);
    s.highlight = rand(0, 0.35);
    s.speed = rand(0.2, 0.8);
    s.flowRate = rand(0.15, 0.6);
  },
  clouds(s) {
    s.patScale = rand(0.5, 2.0);
    s.definition = rand(0.25, 0.8);
    s.complexity = rand(0.4, 1.0);
    s.warpAmount = rand(0.2, 1.2);
    s.highlight = rand(0.1, 0.7);
    s.speed = rand(0.3, 1.0);
    s.flowRate = rand(0.25, 0.9);
    s.bands = randInt(4, 6);
  },
  lava(s) {
    s.patScale = rand(0.6, 1.8);
    s.gradientSize = rand(0.3, 0.75);
    s.gradientCount = randInt(5, 12);
    s.bands = randInt(3, 6);
    s.definition = rand(0.5, 0.95);
    s.warpAmount = rand(0.3, 1.4);
    s.speed = rand(0.3, 1.1);
    s.flowRate = rand(0.2, 0.8);
  },
  aurora(s) {
    s.patScale = rand(0.5, 2.0);
    s.definition = rand(0.2, 0.8);
    s.complexity = rand(0.3, 0.9);
    s.highlight = rand(0.3, 0.9);
    s.speed = rand(0.25, 0.9);
    s.flowRate = rand(0.3, 1.0);
    s.bands = randInt(4, 6);
  },
  vortex(s) {
    s.patScale = rand(0.6, 1.9);
    s.gradientCount = pick([3, 4, 4, 4, 4, 5]);   // mostly the brand's 4 arms
    s.direction = rand(18, 65) * pick([1, 1, 1, -1]);
    s.warpAmount = rand(0.4, 1.5);
    s.complexity = rand(0.35, 0.85);
    s.definition = rand(0.35, 0.9);
    s.highlight = rand(0.15, 0.7);
    s.speed = rand(0.25, 0.9);
    s.flowRate = rand(0.25, 0.8);
  },
  drops(s) {
    s.patScale = rand(0.5, 1.9);
    s.definition = rand(0.25, 0.85);
    s.complexity = rand(0.3, 0.85);
    s.highlight = rand(0.3, 0.8);
    s.speed = rand(0.3, 1.0);
    s.bands = randInt(3, 6);
  },
  caustics(s) {
    s.patScale = rand(0.5, 2.0);
    s.definition = rand(0.3, 0.85);
    s.complexity = rand(0.3, 0.9);
    s.warpAmount = rand(0.3, 1.4);
    s.highlight = rand(0.35, 0.85);
    s.speed = rand(0.3, 0.9);
    s.flowRate = rand(0.3, 0.9);
    s.balance = rand(-0.4, 0.2);
  },
  current(s) {
    s.patScale = rand(0.6, 1.8);
    s.direction = rand(-35, 35);
    s.definition = rand(0.35, 0.9);
    s.complexity = rand(0.25, 0.85);
    s.highlight = rand(0.2, 0.7);
    s.speed = rand(0.35, 1.1);
    s.flowRate = rand(0.3, 0.9);
    s.balance = rand(-0.3, 0.4);
  },
  glass(s) {
    s.patScale = rand(0.4, 1.8);
    s.warpAmount = rand(0.4, 1.6);
    s.complexity = rand(0.35, 0.9);
    s.definition = rand(0.2, 0.8);
    s.highlight = rand(0.35, 0.85);
    s.speed = rand(0.25, 0.8);
    s.balance = rand(0, 0.55);
  },
};

function shuffleFinish(s) {
  // texture — on ~1/3 of shuffles, subtle amounts
  if (Math.random() < 0.35) {
    s.textureType = pick(["paper", "petals", "topo", "canvas", "halftone"]);
    s.textureAmount = rand(0.2, 0.6);
    s.textureScale = rand(0.7, 1.7);
  } else {
    s.textureType = "none";
  }
  s.grainIntensity = rand(0.02, 0.11);
  s.vignette = rand(0, 0.32);
  s.lightness = rand(0.95, 1.25);
  s.contrast = rand(0.95, 1.15);
  s.vibrance = rand(1.0, 1.5);
}

function shuffleLook({ withPalette = true, hopScene = false } = {}) {
  const s = state.shader;
  if (hopScene) {
    const others = SCENES.filter(x => x.key !== s.scene);
    switchScene(pick(others).key);
  }
  if (withPalette) applyPalette(generatePalette());
  const env = SHUFFLE_ENVELOPES[s.scene];
  if (env) env(s);
  shuffleFinish(s);
  s.seed = Math.random() < 0.75 ? randInt(1, 9999) : s.seed;
  s.time = rand(0, 30);
  s.zoom = rand(0.85, 1.25);
  renderSVG();
  rebuildOpenPanels();
  pushHistory(hopScene ? "shuffle+scene" : "shuffle");
}

/* ============================================================
   HISTORY — every look-level change lands here; click to return
   ============================================================ */
const HISTORY_MAX = 40;
let history = [];
let historyIdx = -1;
let suppressHistory = false;

function pushHistory(label) {
  if (suppressHistory) return;
  if (!liquidShader) return;
  // Drop any "redo" tail, then append.
  history = history.slice(0, historyIdx + 1);
  const thumb = liquidShader.renderThumb(128, 72);
  history.push({ label, state: JSON.parse(JSON.stringify(state)), thumb, at: Date.now() });
  if (history.length > HISTORY_MAX) history = history.slice(history.length - HISTORY_MAX);
  historyIdx = history.length - 1;
  renderHistoryStrip();
}

function restoreHistory(i) {
  const h = history[i];
  if (!h) return;
  historyIdx = i;
  suppressHistory = true;
  state = deepMerge(JSON.parse(JSON.stringify(h.state)), defaultState());
  renderSVG();
  rebuildOpenPanels();
  renderHistoryStrip();
  suppressHistory = false;
}

function undoHistory() {
  if (historyIdx > 0) restoreHistory(historyIdx - 1);
}
function redoHistory() {
  if (historyIdx < history.length - 1) restoreHistory(historyIdx + 1);
}

function renderHistoryStrip() {
  const strip = document.getElementById("history");
  if (!strip) return;
  strip.innerHTML = "";
  history.forEach((h, i) => {
    const img = el("img", { src: h.thumb, title: h.label, class: i === historyIdx ? "current" : "" });
    img.addEventListener("click", () => restoreHistory(i));
    strip.appendChild(img);
  });
  strip.scrollLeft = strip.scrollWidth;
}

/* ============================================================
   VARIATIONS — 6 nearby riffs on the current look
   ============================================================ */
let variationCandidates = [];

function jitter(v, amt, lo, hi) { return clamp(v + rand(-amt, amt), lo, hi); }

function makeVariation(kind) {
  const snap = JSON.parse(JSON.stringify({ shader: state.shader, palette: state.palette }));
  const s = snap.shader;
  switch (kind) {
    case "seed":
      s.seed = randInt(1, 9999);
      break;
    case "spin": {
      const deg = pick([18, -18, 35, -35, 55]);
      snap.palette = { bg: spinHex(snap.palette.bg, deg), inks: snap.palette.inks.map(c => spinHex(c, deg)) };
      s.baseColor = snap.palette.bg;
      s.colors = paletteToSlots(snap.palette, s.scene);
      break;
    }
    case "reorder": {
      const inks = snap.palette.inks.slice();
      for (let i = inks.length - 1; i > 0; i--) { const j = randInt(0, i); [inks[i], inks[j]] = [inks[j], inks[i]]; }
      snap.palette.inks = inks;
      s.colors = paletteToSlots(snap.palette, s.scene);
      break;
    }
    case "macro":
      if (s.scene === "liquid") {
        s.warpAmount = jitter(s.warpAmount, 0.45, 0.2, 2.2);
        s.gradientSize = jitter(s.gradientSize, 0.12, 0.15, 1.0);
        s.warpFreq = jitter(s.warpFreq, 0.5, 0.5, 5);
        s.paintSharpness = clamp(Math.round(jitter(s.paintSharpness, 4, 1, 32)), 1, 32);
      } else {
        s.patScale = jitter(s.patScale, 0.4, 0.2, 2.5);
        s.complexity = jitter(s.complexity, 0.2, 0, 1);
        s.definition = jitter(s.definition, 0.2, 0, 1);
        s.warpAmount = jitter(s.warpAmount, 0.4, 0, 2.2);
        if (["silk", "marble", "vortex", "current"].includes(s.scene)) s.direction = jitter(s.direction, 30, -90, 90);
        if (SCENE_PALETTE_LAYOUT[s.scene] === "ramp") s.balance = jitter(s.balance || 0, 0.35, -1, 1);
      }
      s.seed = Math.random() < 0.5 ? randInt(1, 9999) : s.seed;
      break;
    case "finish":
      s.textureType = pick(["none", "paper", "petals", "topo", "canvas", "halftone"]);
      s.textureAmount = rand(0.2, 0.65);
      s.vignette = rand(0, 0.35);
      s.vibrance = jitter(s.vibrance, 0.25, 0.6, 2.0);
      s.lightness = jitter(s.lightness, 0.12, 0.6, 1.6);
      break;
    case "time":
      s.time = rand(0, 40);
      s.zoom = jitter(s.zoom, 0.25, 0.5, 2.5);
      break;
  }
  return snap;
}

function showVariations() {
  if (!liquidShader) return;
  const wrap = document.getElementById("variations");
  const strip = document.getElementById("var-strip");
  strip.innerHTML = "";
  wrap.hidden = false;

  const kinds = ["seed", "spin", "macro", "macro", "finish", "reorder"];
  variationCandidates = kinds.map(k => makeVariation(k));

  // Render each candidate into a thumb, then restore the live look.
  variationCandidates.forEach((cand, i) => {
    liquidShader.set(shaderStateToOpts(cand.shader));
    liquidShader.uniforms.uTime.value = cand.shader.time;
    const thumb = liquidShader.renderThumb(220, 124);
    const img = el("img", { src: thumb, title: kinds[i] });
    img.addEventListener("click", () => {
      applyVariation(i);
    });
    strip.appendChild(img);
  });
  updateShader();   // restore live uniforms
}

function applyVariation(i) {
  const cand = variationCandidates[i];
  if (!cand) return;
  state.shader = deepMerge(cand.shader, defaultState().shader);
  state.palette = cand.palette;
  state.canvas.baseColor = cand.shader.baseColor;
  renderSVG();
  rebuildOpenPanels();
  pushHistory("variation");
  showVariations();   // re-riff around the newly picked look
}

function hideVariations() {
  document.getElementById("variations").hidden = true;
}

/* ============================================================
   PRESETS
   ============================================================ */
function loadPresets() {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]"); }
  catch { return []; }
}
function savePresets(p) { localStorage.setItem(PRESETS_KEY, JSON.stringify(p)); }
function savePreset() {
  const name = prompt("Name this look:", "Look " + (loadPresets().length + 1));
  if (!name) return;
  const presets = loadPresets();
  const thumb = liquidShader ? liquidShader.renderThumb(220, 124) : null;
  presets.unshift({ name, state: JSON.parse(JSON.stringify(state)), thumb, createdAt: Date.now() });
  savePresets(presets);
  toast("Look saved");
  rebuildPanel("presets");
}
function loadPreset(i) {
  const presets = loadPresets();
  const p = presets[i];
  if (!p) return;
  state = deepMerge(migrateLegacyState(JSON.parse(JSON.stringify(p.state))), defaultState());
  renderSVG();
  rebuildOpenPanels();
  pushHistory("preset: " + p.name);
  toast("Loaded: " + p.name);
}

/* ============================================================
   PLAY / PAUSE
   ============================================================ */
const btnPlay = document.getElementById("btn-play");
function setPlayState(animate) {
  state.shader.animate = animate;
  btnPlay.textContent = animate ? "⏸ Pause" : "▶ Play";
  if (!liquidShader) return;
  if (animate) {
    liquidShader.time = state.shader.time;
    liquidShader.startLoop();
    const poll = () => {
      if (!state.shader.animate || !liquidShader) return;
      state.shader.time = liquidShader.time;
      const tEl = document.getElementById("meta-time");
      if (tEl) tEl.textContent = `${state.shader.time.toFixed(1)}s`;
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  } else {
    state.shader.time = liquidShader.time;
    liquidShader.stopLoop();
    rebuildPanel("motion");
    liquidShader.renderOnce();
  }
}

/* ============================================================
   ACTION BAR
   ============================================================ */
document.getElementById("btn-shuffle").addEventListener("click", () => shuffleLook());
document.getElementById("btn-variations").addEventListener("click", () => {
  const wrap = document.getElementById("variations");
  if (wrap.hidden) showVariations(); else hideVariations();
});
btnPlay.addEventListener("click", () => setPlayState(!state.shader.animate));
document.getElementById("btn-png").addEventListener("click", () => exportPNG(2));
document.getElementById("btn-bg-only").addEventListener("click", () => exportBGOnly(2));
document.getElementById("btn-code").addEventListener("click", () => copyEmbedCode());
document.getElementById("btn-save").addEventListener("click", () => savePreset());
document.getElementById("var-again").addEventListener("click", () => showVariations());
document.getElementById("var-close").addEventListener("click", () => hideVariations());
document.getElementById("ep-cancel").addEventListener("click", () => {
  if (_videoAbort) _videoAbort.cancelled = true;
});

/* ---- Video export modal ---- */
(() => {
  const modal = document.getElementById("video-modal");
  const preset = document.getElementById("vm-preset");
  const customRow = document.getElementById("vm-custom-row");
  const wIn = document.getElementById("vm-w");
  const hIn = document.getElementById("vm-h");
  const durIn = document.getElementById("vm-dur");
  const fpsSel = document.getElementById("vm-fps");
  const qualSel = document.getElementById("vm-quality");

  const syncCustom = () => {
    const v = preset.value;
    if (v === "custom") {
      customRow.hidden = false;
    } else {
      customRow.hidden = true;
      const [w, h] = v.split("x").map(Number);
      wIn.value = w; hIn.value = h;
    }
  };
  preset.addEventListener("change", syncCustom);

  const open = () => { syncCustom(); modal.hidden = false; };
  const close = () => { modal.hidden = true; };
  document.getElementById("btn-video").addEventListener("click", open);
  document.getElementById("vm-cancel").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => {
    if (!modal.hidden && e.key === "Escape") close();
  });
  document.getElementById("vm-record").addEventListener("click", () => {
    const width = Math.max(16, Math.min(7680, Number(wIn.value) || 1920));
    const height = Math.max(16, Math.min(7680, Number(hIn.value) || 1080));
    const durationSec = Math.max(1, Math.min(120, Number(durIn.value) || 15));
    const fps = Math.max(15, Math.min(240, Number(fpsSel.value) || 60));
    const quality = qualSel.value;
    close();
    exportVideo({ width, height, durationSec, fps, quality });
  });
})();

/* ============================================================
   KEYBOARD
   ============================================================ */
document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    if (e.target.matches("input, textarea, [contenteditable]")) return;
    e.preventDefault();
    if (!window.__spaceHeld) {
      window.__spaceHeld = true;
      shaderCanvas.style.cursor = "crosshair";
      if (!state.shader.animate && liquidShader) {
        const tick = () => {
          if (!window.__spaceHeld || state.shader.animate) return;
          liquidShader.renderOnce();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }
    return;
  }
  if (e.target.matches("input, textarea, [contenteditable]")) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) redoHistory(); else undoHistory();
    return;
  }
  const k = e.key.toLowerCase();
  if (k === "r") { shuffleLook({ hopScene: e.shiftKey }); }
  else if (k === "p") { shufflePalette(); }
  else if (k === "v") { const w = document.getElementById("variations"); if (w.hidden) showVariations(); else hideVariations(); }
  else if (k === "s") { savePreset(); }
  else if (k === "f") {
    if (!liquidShader) return;
    const next = !liquidShader.touchTexture.frozen;
    liquidShader.freezeRipples(next);
    state.shader.freezeRipples = next;
    toast(next ? "Stir frozen ❄ — it's part of the artwork now" : "Stir thawed");
    rebuildPanel("motion");
  }
  else if (k === "c") {
    if (!liquidShader) return;
    liquidShader.clearRipples();
    state.shader.freezeRipples = false;
    liquidShader.freezeRipples(false);
    toast("Stir cleared");
    rebuildPanel("motion");
  }
  else if (/^[0-9]$/.test(e.key)) {
    const idx = e.key === "0" ? 9 : Number(e.key) - 1;   // 1–9 then 0 = tenth
    const scene = SCENES[idx];
    if (scene) {
      switchScene(scene.key);
      renderSVG();
      rebuildOpenPanels();
      pushHistory("scene: " + scene.name);
    }
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    window.__spaceHeld = false;
    shaderCanvas.style.cursor = "";
  }
});

/* ============================================================
   SEED PRESETS — Miguel's tuned looks + one per new scene.
   Only fills localStorage gaps; never overwrites existing saves.
   ============================================================ */
(function seedPresetsIfEmpty() {
  const HERO_WARM = {
    name: "Hero video (warm)",
    state: { shader: {
      scene: "liquid",
      colors: ["#F55926", "#13102A", "#F97841", "#8F70EB", "#FFD4BA", "#F9BFAB"],
      baseColor: "#13102A", speed: 0.1, intensity: 1.4, grainIntensity: 0.06,
      zoom: 1.0, panX: 0, panY: 0, gradientSize: 0.5, gradientCount: 12,
      color1Weight: 1.4, color2Weight: 0.7,
      saturation: 1.2, timeShift: 0, overlayMix: 0.1,
      warpAmount: 1.4, warpFreq: 2.0, highlight: 0.3,
      blendMode: 0.55, paintSharpness: 7,
      centerWander: 0.15, factorPulse: 0.1, flowRate: 0.3,
      vibrance: 1.35, contrast: 1.05, lightness: 1.15,
      animate: true, touchEnabled: false, freezeRipples: false, time: 8,
    }},
    createdAt: 1776085440968,
  };
  const FOOTER_COOL = {
    name: "Footer video (cool)",
    state: { shader: {
      scene: "liquid",
      colors: ["#8F70EB", "#0F0C22", "#5239A7", "#B399F3", "#F9BFAB", "#E5DCFC"],
      baseColor: "#0F0C22", speed: 0.06, intensity: 1.4, grainIntensity: 0.05,
      zoom: 1.0, panX: 0, panY: 0, gradientSize: 0.5, gradientCount: 12,
      color1Weight: 1.4, color2Weight: 0.6,
      saturation: 1.15, timeShift: 0, overlayMix: 0.08,
      warpAmount: 1.6, warpFreq: 1.6, highlight: 0.25,
      blendMode: 0.55, paintSharpness: 7,
      centerWander: 0.12, factorPulse: 0.08, flowRate: 0.22,
      vibrance: 1.3, contrast: 1.05, lightness: 1.15,
      animate: true, touchEnabled: false, freezeRipples: false, time: 8,
    }},
    createdAt: 1776085440969,
  };
  const SILK_DUSK = {
    name: "Silk dusk",
    state: {
      palette: { bg: "#0F0C22", inks: ["#3D2A78", "#7C5CFF", "#FF6A3D", "#FFD4BA"] },
      shader: {
        scene: "silk", seed: 214,
        colors: ["#3D2A78", "#7C5CFF", "#FF6A3D", "#FFD4BA", "#FFD4BA", "#FFD4BA"],
        baseColor: "#0F0C22", speed: 0.45, patScale: 1.15, complexity: 0.6,
        definition: 0.3, direction: 22, bands: 5, warpAmount: 1.2, highlight: 0.3,
        flowRate: 0.5, vignette: 0.18, grainIntensity: 0.05,
        vibrance: 1.15, contrast: 1.02, lightness: 1.05,
        animate: true, time: 6,
      },
    },
    createdAt: 1776085440970,
  };
  const CLOUD_PORCELAIN = {
    name: "Clouds porcelain",
    state: {
      palette: { bg: "#F5F1EA", inks: ["#E4D5C3", "#D9A778", "#B4653C", "#2E2620"] },
      shader: {
        scene: "clouds", seed: 91,
        colors: ["#E4D5C3", "#D9A778", "#B4653C", "#2E2620", "#2E2620", "#2E2620"],
        baseColor: "#F5F1EA", speed: 0.4, patScale: 1.1, complexity: 0.65,
        definition: 0.42, bands: 5, warpAmount: 0.7, highlight: 0.25,
        flowRate: 0.45, vignette: 0.1, grainIntensity: 0.05,
        vibrance: 1.05, contrast: 1.0, lightness: 1.0,
        animate: true, time: 12,
      },
    },
    createdAt: 1776085440971,
  };
  const MARBLE_INK = {
    name: "Marble ink",
    state: {
      palette: { bg: "#0A0A0D", inks: ["#26262E", "#4C4C5C", "#9A9AB0", "#EDEDF2"] },
      shader: {
        scene: "marble", seed: 512,
        colors: ["#26262E", "#4C4C5C", "#9A9AB0", "#EDEDF2", "#EDEDF2", "#EDEDF2"],
        baseColor: "#0A0A0D", speed: 0.3, patScale: 1.0, complexity: 0.75,
        definition: 0.85, direction: 68, bands: 5, warpAmount: 1.4, highlight: 0.1,
        flowRate: 0.3, vignette: 0.2, grainIntensity: 0.06,
        vibrance: 1.0, contrast: 1.05, lightness: 1.0,
        animate: true, time: 4,
      },
    },
    createdAt: 1776085440972,
  };
  const GOLDEN_WINDOW = {
    name: "Golden window",
    state: {
      palette: { bg: "#2A1608", inks: ["#7A4A16", "#C98A2E", "#F5BE5A", "#FFE9BE"] },
      shader: {
        scene: "glass", seed: 7,
        colors: ["#7A4A16", "#C98A2E", "#F5BE5A", "#FFE9BE", "#FFE9BE", "#FFE9BE"],
        baseColor: "#2A1608", speed: 0.4, patScale: 1.2, complexity: 0.85,
        definition: 0.5, bands: 5, warpAmount: 1.3, highlight: 0.65,
        flowRate: 0.35, balance: 0.35, vignette: 0.22, grainIntensity: 0.05,
        vibrance: 1.1, contrast: 1.04, lightness: 1.05,
        animate: true, time: 5,
      },
    },
    createdAt: 1776085440973,
  };
  const baked = [HERO_WARM, FOOTER_COOL, SILK_DUSK, CLOUD_PORCELAIN, MARBLE_INK, GOLDEN_WINDOW];
  try {
    const existing = loadPresets();
    const names = new Set(existing.map(p => p.name));
    let changed = false;
    for (const bp of baked) {
      if (!names.has(bp.name)) { existing.push(bp); changed = true; }
    }
    if (changed) savePresets(existing);
  } catch {}
})();

/* ============================================================
   INIT
   ============================================================ */
function initShader() {
  if (typeof THREE === "undefined") {
    console.warn("Three.js not loaded yet, retrying…");
    setTimeout(initShader, 50);
    return;
  }
  liquidShader = new LiquidShader(shaderCanvas, shaderStateToOpts(state.shader));
  liquidShader.init();

  // Mouse-trail ripples: always when touchEnabled, else only while ⎵ held.
  shaderCanvas.addEventListener("mousemove", (e) => {
    if (!state.shader.touchEnabled && !window.__spaceHeld) return;
    const r = shaderCanvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = 1 - (e.clientY - r.top) / r.height;
    liquidShader.addTouch(x, y);
    if (!state.shader.animate) liquidShader.renderOnce();
  });

  // Alt/Option + drag → pan the pattern under the frame.
  let panDrag = null;
  shaderCanvas.addEventListener("mousedown", (e) => {
    if (!e.altKey) return;
    e.preventDefault();
    const r = shaderCanvas.getBoundingClientRect();
    panDrag = {
      startX: e.clientX, startY: e.clientY,
      origPanX: state.shader.panX, origPanY: state.shader.panY,
      w: r.width, h: r.height,
    };
    shaderCanvas.style.cursor = "grab";
  });
  document.addEventListener("mousemove", (e) => {
    if (!panDrag) return;
    const dx = (e.clientX - panDrag.startX) / panDrag.w;
    const dy = -(e.clientY - panDrag.startY) / panDrag.h;
    state.shader.panX = panDrag.origPanX - dx / (state.shader.zoom || 1);
    state.shader.panY = panDrag.origPanY - dy / (state.shader.zoom || 1);
    updateShader();
    if (!state.shader.animate && liquidShader) liquidShader.renderOnce();
  });
  document.addEventListener("mouseup", () => {
    if (panDrag) {
      panDrag = null;
      shaderCanvas.style.cursor = "";
      rebuildPanel("framing");
    }
  });

  updateShader();
  if (state.shader.freezeRipples) liquidShader.freezeRipples(true);
}
initShader();
buildAllPanels();
renderSVG();
btnPlay.textContent = state.shader.animate ? "⏸ Pause" : "▶ Play";
if (state.shader.animate) setPlayState(true);
setTimeout(() => {
  updateOverlayHandles();
  updateShader();
  pushHistory("start");
}, 150);
window.addEventListener("resize", () => { updateOverlayHandles(); updateShader(); });

// Header credit reads from the AUTHOR constants so a handle change is one edit.
(function setByline() {
  const a = document.getElementById("byline");
  if (!a) return;
  a.href = AUTHOR_URL;
  a.textContent = "by @" + AUTHOR_HANDLE;
})();
