/* ============================================================
   CONTROL HELPERS
   ============================================================ */
function row(label, controlEl, valueEl) {
  return el("div", { class: valueEl ? "row" : "row wide" }, [
    el("label", {}, label),
    controlEl,
    valueEl
  ]);
}

function slider(label, getVal, setVal, min, max, step, fmt, onDone) {
  if (!fmt) fmt = (v) => {
    if (step >= 1) return Math.round(v);
    if (step >= 0.1) return (Math.round(v * 10) / 10).toFixed(1);
    return (Math.round(v * 100) / 100).toFixed(2);
  };
  const input = el("input", { type: "range", min, max, step });
  input.value = getVal();
  const valEl = el("span", { class: "val", contenteditable: "true", spellcheck: "false" }, String(fmt(getVal())));
  input.addEventListener("input", () => {
    const v = parseFloat(input.value);
    setVal(v);
    valEl.textContent = String(fmt(v));
    renderSVG();
  });
  if (onDone) input.addEventListener("change", onDone);
  valEl.addEventListener("blur", () => {
    const v = parseFloat(valEl.textContent);
    if (!isNaN(v)) {
      // Soft bounds: store the unclamped value; the thumb pegs at min/max.
      setVal(v);
      input.value = Math.max(min, Math.min(max, v));
      valEl.textContent = String(fmt(v));
      renderSVG();
      if (onDone) onDone();
    } else {
      valEl.textContent = String(fmt(getVal()));
    }
  });
  valEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); valEl.blur(); }
  });
  return row(label, input, valEl);
}

function colorRow(label, getVal, setVal) {
  const input = el("input", { type: "color" });
  input.value = getVal();
  input.addEventListener("input", () => { setVal(input.value); renderSVG(); });
  return row(label, input, el("span"));
}

function textRow(label, getVal, setVal) {
  const input = el("input", { type: "text" });
  input.value = getVal();
  input.addEventListener("input", () => { setVal(input.value); renderSVG(); });
  return el("div", { class: "row wide" }, [el("label", {}, label), input]);
}

// Drop your own mark on the artwork to judge how it sits. Read as a data URI
// so it survives a saved look and an export without needing a server.
function logoUploadRow() {
  const input = el("input", { type: "file", accept: "image/png,image/svg+xml,image/jpeg,image/webp" });
  input.style.display = "none";
  const pick = smallBtn(state.overlay.logoSrc ? "replace logo" : "choose file", () => input.click());
  const clear = smallBtn("clear", () => {
    state.overlay.logoSrc = null;
    state.overlay.mode = "none";
    renderSVG(); rebuildPanel("overlay");
  });
  input.addEventListener("change", () => {
    const f = input.files && input.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const src = r.result;
      const probe = new Image();
      probe.onload = () => {
        state.overlay.logoAspect = probe.width / Math.max(probe.height, 1);
        state.overlay.logoSrc = src;
        state.overlay.mode = "logo";
        renderSVG(); rebuildPanel("overlay");
      };
      probe.onerror = () => {
        state.overlay.logoAspect = 1;
        state.overlay.logoSrc = src;
        state.overlay.mode = "logo";
        renderSVG(); rebuildPanel("overlay");
      };
      probe.src = src;
    };
    r.readAsDataURL(f);
  });
  const row = el("div", { class: "btn-row" }, [pick]);
  if (state.overlay.logoSrc) row.appendChild(clear);
  row.appendChild(input);
  return row;
}

function toggleRow(label, getVal, setVal, after) {
  const cb = el("input", { type: "checkbox" });
  cb.checked = getVal();
  cb.addEventListener("change", () => {
    setVal(cb.checked);
    renderSVG();
    if (after) after();
  });
  return el("label", { class: "toggle" }, [
    cb,
    el("span", { class: "switch" }),
    el("span", {}, label)
  ]);
}

function chipRow(options, getVal, setVal) {
  const wrap = el("div", { class: "chips" });
  options.forEach(o => {
    const val = typeof o === "string" ? o : o.value;
    const lbl = typeof o === "string" ? o : o.label;
    wrap.appendChild(el("button", {
      class: "chip" + (getVal() === val ? " active" : ""),
      onclick: () => {
        setVal(val);
        [...wrap.children].forEach((ch, i) => {
          const v = typeof options[i] === "string" ? options[i] : options[i].value;
          ch.classList.toggle("active", v === getVal());
        });
        renderSVG();
      }
    }, lbl));
  });
  return wrap;
}

function sectionLabel(text) {
  return el("div", { class: "section-label" }, text);
}
function hintEl(text) {
  return el("div", { class: "hint-line" }, text);
}
function smallBtn(label, onclick, cls = "") {
  return el("button", { class: "add-btn " + cls, onclick }, label);
}

/* ============================================================
   COLLAPSIBLE SECTIONS
   ============================================================ */
const OPEN_SECTIONS = new Set(
  JSON.parse(localStorage.getItem("flowlab-open-sections") || '["scene","palette","look","texture"]')
);
function persistOpenSections() {
  localStorage.setItem("flowlab-open-sections", JSON.stringify([...OPEN_SECTIONS]));
}

const SECTION_DEFS = [];  // {id, title, build}
function defineSection(id, title, build) { SECTION_DEFS.push({ id, title, build }); }

function buildSection(def) {
  const open = OPEN_SECTIONS.has(def.id);
  const body = el("div", { class: "sec-body" });
  const head = el("button", { class: "sec-head" + (open ? " open" : ""), onclick: () => {
    const nowOpen = !OPEN_SECTIONS.has(def.id);
    if (nowOpen) OPEN_SECTIONS.add(def.id); else OPEN_SECTIONS.delete(def.id);
    persistOpenSections();
    head.classList.toggle("open", nowOpen);
    sec.classList.toggle("open", nowOpen);
    if (nowOpen && !body.dataset.built) { def.build(body); body.dataset.built = "1"; }
  }}, [el("span", { class: "sec-caret" }, "▸"), def.title]);
  const sec = el("div", { class: "sec" + (open ? " open" : ""), "data-sec": def.id }, [head, body]);
  if (open) { def.build(body); body.dataset.built = "1"; }
  return sec;
}

function rebuildPanel(id) {
  const sec = document.querySelector(`[data-sec="${id}"]`);
  if (!sec) return;
  const def = SECTION_DEFS.find(d => d.id === id);
  const body = sec.querySelector(".sec-body");
  if (!def || !body) return;
  if (!OPEN_SECTIONS.has(id)) { body.dataset.built = ""; body.innerHTML = ""; return; }
  body.innerHTML = "";
  def.build(body);
  body.dataset.built = "1";
}
function buildAllPanels() {
  const root = document.getElementById("panel-root");
  root.innerHTML = "";
  SECTION_DEFS.forEach(def => root.appendChild(buildSection(def)));
}
function rebuildOpenPanels() {
  SECTION_DEFS.forEach(d => { if (OPEN_SECTIONS.has(d.id)) rebuildPanel(d.id); });
}

/* ============================================================
   SECTION: SCENE
   ============================================================ */
function scenePreviewCSS(key) {
  const pal = state.palette;
  const [a, b, c] = [pal.inks[0] || "#A32C5C", pal.inks[1] || "#F0704A", pal.inks[2] || pal.inks[0] || "#FFD48A"];
  const bg = pal.bg;
  switch (key) {
    case "liquid": return `background:
      radial-gradient(circle at 30% 35%, ${a} 0%, transparent 42%),
      radial-gradient(circle at 72% 60%, ${c} 0%, transparent 46%),
      radial-gradient(circle at 55% 20%, ${b} 0%, transparent 38%), ${bg};`;
    case "silk": return `background: repeating-linear-gradient(112deg, ${bg} 0 8px, ${a} 14px 20px, ${b} 26px 30px, ${bg} 38px 46px);`;
    case "marble": return `background: repeating-linear-gradient(78deg, ${a} 0 9px, ${bg} 10px 12px, ${b} 13px 22px, ${bg} 23px 24px, ${c} 25px 34px);`;
    case "clouds": return `background:
      radial-gradient(ellipse 60% 42% at 35% 45%, ${b} 0%, transparent 70%),
      radial-gradient(ellipse 52% 38% at 70% 60%, ${a} 0%, transparent 72%), ${bg};`;
    case "lava": return `background:
      radial-gradient(circle at 38% 45%, ${c} 0 22%, ${a} 23% 36%, ${b} 37% 48%, transparent 49%),
      radial-gradient(circle at 74% 62%, ${a} 0 14%, ${b} 15% 24%, transparent 25%), ${bg};`;
    case "aurora": return `background: linear-gradient(180deg, ${bg} 0%, ${bg} 28%, ${a} 46%, ${b} 55%, ${bg} 78%);`;
    case "vortex": return `background:
      radial-gradient(circle at 50% 50%, ${bg} 0 9%, transparent 10%),
      conic-gradient(from 25deg at 50% 50%, ${a} 0 25%, ${b} 25% 50%, ${c} 50% 75%, ${a} 75% 100%);`;
    case "drops": return `background:
      radial-gradient(circle at 32% 40%, transparent 0 14%, ${a} 15% 18%, transparent 19%),
      radial-gradient(circle at 68% 58%, transparent 0 20%, ${b} 21% 25%, transparent 26%),
      radial-gradient(circle at 55% 30%, transparent 0 8%, ${c} 9% 12%, transparent 13%), ${bg};`;
    case "caustics": return `background:
      linear-gradient(115deg, transparent 42%, ${b} 47%, transparent 52%),
      linear-gradient(65deg, transparent 55%, ${a} 60%, transparent 66%),
      linear-gradient(160deg, transparent 30%, ${b} 34%, transparent 39%), ${bg};`;
    case "current": return `background: linear-gradient(180deg, ${bg} 0 30%, ${a} 42%, ${b} 50%, ${c} 58%, ${bg} 72%);`;
    case "glass": return `background:
      linear-gradient(90deg, transparent 0 30%, #00000030 32% 34%, transparent 36%),
      linear-gradient(0deg, transparent 0 55%, #00000030 57% 59%, transparent 61%),
      radial-gradient(circle at 40% 35%, ${c} 0%, ${b} 40%, ${bg} 90%);`;
  }
  return `background:${bg};`;
}

defineSection("scene", "Scene", (g) => {
  const grid = el("div", { class: "scene-grid" });
  SCENES.forEach(s => {
    const card = el("div", {
      class: "scene-card" + (state.shader.scene === s.key ? " active" : "") + (s.featured ? " featured" : ""),
      onclick: () => {
        switchScene(s.key);
        renderSVG();
        rebuildOpenPanels();
        if (typeof pushHistory === "function") pushHistory("scene: " + s.name);
      }
    }, [
      el("div", { class: "scene-prev", style: scenePreviewCSS(s.key) }),
      el("div", { class: "scene-name" }, s.name),
      el("div", { class: "scene-desc" }, s.desc),
    ]);
    grid.appendChild(card);
  });
  g.appendChild(grid);
  g.appendChild(hintEl("Keys 1–9 and 0 hop scenes. Each scene remembers your tweaks."));
});

/* ============================================================
   SECTION: PALETTE
   ============================================================ */
defineSection("palette", "Palette", (g) => {
  const grid = el("div", { class: "palettes" });
  PALETTES.forEach(p => {
    const sw = el("div", { class: "pal", title: p.name, onclick: () => {
      applyPalette(p);
      renderSVG();
      rebuildOpenPanels();
      if (typeof pushHistory === "function") pushHistory("palette: " + p.name);
    }});
    sw.appendChild(el("div", { class: "pal-bg", style: `background:${p.bg}` }));
    p.inks.forEach(c => sw.appendChild(el("div", { style: `background:${c}` })));
    grid.appendChild(sw);
  });
  g.appendChild(grid);

  const ops = el("div", { class: "btn-row" });
  ops.appendChild(smallBtn("🎲 random", () => { shufflePalette(); }));
  ops.appendChild(smallBtn("⇄ reorder", () => {
    const inks = state.palette.inks.slice();
    for (let i = inks.length - 1; i > 0; i--) { const j = randInt(0, i); [inks[i], inks[j]] = [inks[j], inks[i]]; }
    applyPalette({ bg: state.palette.bg, inks }, { keepBands: true });
    renderSVG(); rebuildOpenPanels();
    if (typeof pushHistory === "function") pushHistory("reorder inks");
  }));
  ops.appendChild(smallBtn("↻ spin hue", () => {
    const deg = pick([20, -20, 40, -40, 65, -65]);
    const pal = { bg: spinHex(state.palette.bg, deg), inks: state.palette.inks.map(c => spinHex(c, deg)) };
    applyPalette(pal, { keepBands: true });
    renderSVG(); rebuildOpenPanels();
    if (typeof pushHistory === "function") pushHistory("spin hue");
  }));
  ops.appendChild(smallBtn("◐ swap bg↔ink", () => {
    const inks = state.palette.inks.slice();
    const newBg = inks.pop();
    inks.unshift(state.palette.bg);
    applyPalette({ bg: newBg, inks }, { keepBands: true });
    renderSVG(); rebuildOpenPanels();
    if (typeof pushHistory === "function") pushHistory("swap bg");
  }));
  g.appendChild(ops);

  g.appendChild(sectionLabel("Edit"));
  g.appendChild(colorRow("Background", () => state.palette.bg, v => {
    state.palette.bg = v;
    applyPalette(state.palette, { keepBands: true });
  }));
  state.palette.inks.forEach((_, i) => {
    g.appendChild(colorRow(`Ink ${i + 1}`, () => state.palette.inks[i], v => {
      state.palette.inks[i] = v;
      applyPalette(state.palette, { keepBands: true });
    }));
  });
  const inkBtns = el("div", { class: "btn-row" });
  if (state.palette.inks.length < 5) {
    inkBtns.appendChild(smallBtn("+ ink", () => {
      state.palette.inks.push(spinHex(state.palette.inks[state.palette.inks.length - 1] || "#8F70EB", 30));
      applyPalette(state.palette);
      renderSVG(); rebuildPanel("palette");
    }));
  }
  if (state.palette.inks.length > 2) {
    inkBtns.appendChild(smallBtn("− ink", () => {
      state.palette.inks.pop();
      applyPalette(state.palette);
      renderSVG(); rebuildPanel("palette");
    }));
  }
  g.appendChild(inkBtns);
  g.appendChild(hintEl("P shuffles the palette. Liquid alternates inks with the bg · Marble/Vibeflow band the inks in this order · Silk/Clouds/Cutout/Aurora ramp bg → inks sorted by brightness, so every ink you pick shows cleanly. Use Ink balance in Look to push inks forward."));
});

/* ============================================================
   SECTION: LOOK (per-scene macros)
   ============================================================ */
const sh = () => state.shader;

function lookControlsFor(scene, g) {
  if (scene === "vortex") {
    g.appendChild(slider("Scale", () => sh().patScale, v => sh().patScale = v, 0.2, 2.5, 0.01));
    g.appendChild(slider("Arms", () => sh().gradientCount, v => sh().gradientCount = v, 2, 8, 1));
    g.appendChild(slider("Twist", () => sh().direction, v => sh().direction = v, -90, 90, 1, v => v.toFixed(0) + "°"));
    g.appendChild(slider("Warp", () => sh().warpAmount, v => sh().warpAmount = v, 0, 2.2, 0.01));
    g.appendChild(slider("Detail", () => sh().complexity, v => sh().complexity = v, 0, 1, 0.01));
    g.appendChild(slider("Definition", () => sh().definition, v => sh().definition = v, 0, 1, 0.01));
    g.appendChild(slider("Core glow", () => sh().highlight, v => sh().highlight = v, 0, 1, 0.01));
    g.appendChild(hintEl("Arms of paint rotating around a centre. More arms means a tighter spiral."));
  } else if (scene === "drops") {
    g.appendChild(slider("Drop size", () => sh().patScale, v => sh().patScale = v, 0.2, 2.5, 0.01));
    g.appendChild(slider("Edge", () => sh().definition, v => sh().definition = v, 0, 1, 0.01));
    g.appendChild(slider("Wobble", () => sh().complexity, v => sh().complexity = v, 0, 1, 0.01));
    g.appendChild(slider("Glow", () => sh().highlight, v => sh().highlight = v, 0, 1, 0.01));
    g.appendChild(hintEl("Eight drops, each blooming on its own phase of the loop — the cycle never pops."));
  } else if (scene === "caustics") {
    g.appendChild(slider("Scale", () => sh().patScale, v => sh().patScale = v, 0.2, 2.5, 0.01));
    g.appendChild(slider("Web sharp", () => sh().definition, v => sh().definition = v, 0, 1, 0.01));
    g.appendChild(slider("Depth layer", () => sh().complexity, v => sh().complexity = v, 0, 1, 0.01));
    g.appendChild(slider("Sway", () => sh().warpAmount, v => sh().warpAmount = v, 0, 2.2, 0.01));
    g.appendChild(slider("Light", () => sh().highlight, v => sh().highlight = v, 0, 1, 0.01));
    g.appendChild(slider("Ink balance", () => sh().balance, v => sh().balance = v, -1, 1, 0.01));
  } else if (scene === "current") {
    g.appendChild(slider("Scale", () => sh().patScale, v => sh().patScale = v, 0.2, 2.5, 0.01));
    g.appendChild(slider("Tilt", () => sh().direction, v => sh().direction = v, -90, 90, 1, v => v.toFixed(0) + "°"));
    g.appendChild(slider("Edge", () => sh().definition, v => sh().definition = v, 0, 1, 0.01));
    g.appendChild(slider("Striations", () => sh().complexity, v => sh().complexity = v, 0, 1, 0.01));
    g.appendChild(slider("Bank glow", () => sh().highlight, v => sh().highlight = v, 0, 1, 0.01));
    g.appendChild(slider("Ink balance", () => sh().balance, v => sh().balance = v, -1, 1, 0.01));
  } else if (scene === "glass") {
    g.appendChild(slider("Glass type", () => sh().complexity, v => sh().complexity = v, 0, 1, 0.01));
    g.appendChild(slider("Refraction", () => sh().warpAmount, v => sh().warpAmount = v, 0, 2.2, 0.01));
    g.appendChild(slider("Lights", () => sh().highlight, v => sh().highlight = v, 0, 1, 0.01));
    g.appendChild(slider("Panes", () => sh().patScale, v => sh().patScale = v, 0.2, 2.5, 0.01));
    g.appendChild(slider("Shadow", () => sh().definition, v => sh().definition = v, 0, 1, 0.01));
    g.appendChild(slider("Ink balance", () => sh().balance, v => sh().balance = v, -1, 1, 0.01));
    g.appendChild(hintEl("Glass type sweeps fluted ribs → hammered cathedral → fine frost. Blurry colored lights drift behind; seed re-deals them."));
  } else if (scene === "liquid") {
    g.appendChild(slider("Blob size", () => sh().gradientSize, v => sh().gradientSize = v, 0.12, 1.0, 0.01));
    g.appendChild(slider("Blob count", () => sh().gradientCount, v => sh().gradientCount = v, 4, 12, 2));
    g.appendChild(slider("Warp", () => sh().warpAmount, v => sh().warpAmount = v, 0, 2.2, 0.01));
    g.appendChild(slider("Warp detail", () => sh().warpFreq, v => sh().warpFreq = v, 0.5, 5, 0.05));
    g.appendChild(slider("Paint", () => sh().paintSharpness, v => sh().paintSharpness = v, 1, 32, 1));
    g.appendChild(slider("Wander", () => sh().centerWander, v => sh().centerWander = v, 0, 1, 0.01));
    g.appendChild(slider("Wisps", () => sh().highlight, v => sh().highlight = v, 0, 1, 0.01));
    g.appendChild(hintEl("Paint high = inks layer without mixing. Wander low = paint sits; high = blobs roam. Warp is the liquid-ness."));
  } else if (scene === "silk") {
    g.appendChild(slider("Scale", () => sh().patScale, v => sh().patScale = v, 0.2, 2.5, 0.01));
    g.appendChild(slider("Direction", () => sh().direction, v => sh().direction = v, -90, 90, 1, v => v.toFixed(0) + "°"));
    g.appendChild(slider("Warp", () => sh().warpAmount, v => sh().warpAmount = v, 0, 2.2, 0.01));
    g.appendChild(slider("Detail", () => sh().complexity, v => sh().complexity = v, 0, 1, 0.01));
    g.appendChild(slider("Definition", () => sh().definition, v => sh().definition = v, 0, 1, 0.01));
    g.appendChild(slider("Sheen", () => sh().highlight, v => sh().highlight = v, 0, 1, 0.01));
    g.appendChild(slider("Ink balance", () => sh().balance, v => sh().balance = v, -1, 1, 0.01));
  } else if (scene === "marble") {
    g.appendChild(slider("Scale", () => sh().patScale, v => sh().patScale = v, 0.2, 2.5, 0.01));
    g.appendChild(slider("Direction", () => sh().direction, v => sh().direction = v, -90, 90, 1, v => v.toFixed(0) + "°"));
    g.appendChild(slider("Veins", () => sh().warpAmount, v => sh().warpAmount = v, 0, 2.2, 0.01));
    g.appendChild(slider("Detail", () => sh().complexity, v => sh().complexity = v, 0, 1, 0.01));
    g.appendChild(slider("Sharpness", () => sh().definition, v => sh().definition = v, 0, 1, 0.01));
    g.appendChild(slider("Bands", () => sh().bands, v => sh().bands = v, 2, 6, 1));
    g.appendChild(slider("Wisps", () => sh().highlight, v => sh().highlight = v, 0, 1, 0.01));
  } else if (scene === "clouds") {
    g.appendChild(slider("Scale", () => sh().patScale, v => sh().patScale = v, 0.2, 2.5, 0.01));
    g.appendChild(slider("Cover", () => sh().definition, v => sh().definition = v, 0, 1, 0.01));
    g.appendChild(slider("Detail", () => sh().complexity, v => sh().complexity = v, 0, 1, 0.01));
    g.appendChild(slider("Swirl", () => sh().warpAmount, v => sh().warpAmount = v, 0, 2.2, 0.01));
    g.appendChild(slider("Lining", () => sh().highlight, v => sh().highlight = v, 0, 1, 0.01));
    g.appendChild(slider("Ink balance", () => sh().balance, v => sh().balance = v, -1, 1, 0.01));
  } else if (scene === "lava") {
    g.appendChild(slider("Scale", () => sh().patScale, v => sh().patScale = v, 0.2, 2.5, 0.01));
    g.appendChild(slider("Blob size", () => sh().gradientSize, v => sh().gradientSize = v, 0.15, 1.2, 0.01));
    g.appendChild(slider("Blob count", () => sh().gradientCount, v => sh().gradientCount = v, 3, 12, 1));
    g.appendChild(slider("Layers", () => sh().bands, v => sh().bands = v, 2, 6, 1));
    g.appendChild(slider("Edge", () => sh().definition, v => sh().definition = v, 0, 1, 0.01));
    g.appendChild(slider("Warp", () => sh().warpAmount, v => sh().warpAmount = v, 0, 2.2, 0.01));
    g.appendChild(slider("Ink balance", () => sh().balance, v => sh().balance = v, -1, 1, 0.01));
  } else if (scene === "aurora") {
    g.appendChild(slider("Scale", () => sh().patScale, v => sh().patScale = v, 0.2, 2.5, 0.01));
    g.appendChild(slider("Width", () => sh().definition, v => sh().definition = v, 0, 1, 0.01));
    g.appendChild(slider("Streaks", () => sh().complexity, v => sh().complexity = v, 0, 1, 0.01));
    g.appendChild(slider("Glow", () => sh().highlight, v => sh().highlight = v, 0, 1, 0.01));
  }
}

defineSection("look", "Look", (g) => {
  lookControlsFor(state.shader.scene, g);

  g.appendChild(sectionLabel("Composition seed"));
  const seedRow = el("div", { class: "btn-row" });
  const seedVal = el("span", { class: "seed-val" }, state.shader.seed ? String(state.shader.seed) : "classic");
  seedRow.appendChild(smallBtn("🎲 new seed", () => {
    state.shader.seed = randInt(1, 9999);
    seedVal.textContent = String(state.shader.seed);
    renderSVG();
    if (typeof pushHistory === "function") pushHistory("seed " + state.shader.seed);
  }));
  seedRow.appendChild(smallBtn("↺ classic", () => {
    state.shader.seed = 0;
    seedVal.textContent = "classic";
    renderSVG();
  }));
  seedRow.appendChild(seedVal);
  g.appendChild(seedRow);
  g.appendChild(hintEl("Seed re-deals the whole composition layout without touching your settings."));
});

/* ============================================================
   SECTION: TEXTURE
   ============================================================ */
function loadImageAsTextureDataURL(src, cb) {
  const img = new Image();
  img.onload = () => {
    try {
      const maxSide = 1400;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL("image/jpeg", 0.82));
    } catch (e) {
      toast("Couldn't read that image (try the ⇡ upload button)");
    }
  };
  img.onerror = () => toast("Couldn't load image");
  img.src = src;
}

function pickTextureFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const f = input.files && input.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    loadImageAsTextureDataURL(url, (dataURL) => {
      URL.revokeObjectURL(url);
      state.shader.textureImage = dataURL;
      state.shader.textureType = "image";
      if (state.shader.textureAmount < 0.05) state.shader.textureAmount = 0.5;
      renderSVG();
      rebuildPanel("texture");
      toast("Texture loaded");
    });
  };
  input.click();
}

defineSection("texture", "Texture", (g) => {
  g.appendChild(chipRow(
    [
      { value: "none", label: "none" },
      { value: "paper", label: "▤ paper" },
      { value: "canvas", label: "▦ canvas" },
      { value: "linen", label: "▩ linen" },
      { value: "petals", label: "❀ petals" },
      { value: "halftone", label: "⣿ halftone" },
      { value: "hatch", label: "▨ hatch" },
      { value: "riso", label: "◍ riso" },
      { value: "topo", label: "〰 topo" },
      { value: "image", label: "🖼 your image" },
    ],
    () => state.shader.textureType,
    v => { state.shader.textureType = v; renderSVG(); rebuildPanel("texture"); }
  ));

  if (state.shader.textureType === "image") {
    g.appendChild(hintEl("Use any image as the texture layer. It modulates the artwork rather than sitting on top of it, so photographs of paper, concrete, fabric or foliage all work well. Desaturate it below if you only want its light and shadow."));
    g.appendChild(smallBtn("⇡ upload image…", () => pickTextureFile()));
    g.appendChild(sectionLabel("Blend"));
    g.appendChild(chipRow(
      [
        { value: "softlight", label: "soft light" },
        { value: "multiply", label: "multiply" },
        { value: "overlay", label: "overlay" },
        { value: "screen", label: "screen" },
      ],
      () => state.shader.textureBlend,
      v => state.shader.textureBlend = v
    ));
    g.appendChild(toggleRow("Desaturate (texture as light/shadow)", () => state.shader.textureMono, v => state.shader.textureMono = v));
  }

  g.appendChild(slider("Amount", () => sh().textureAmount, v => sh().textureAmount = v, 0, 1, 0.01));
  g.appendChild(slider("Tex scale", () => sh().textureScale, v => sh().textureScale = v, 0.2, 4, 0.05));

  g.appendChild(sectionLabel("Mask — where the texture lives"));
  g.appendChild(chipRow(
    [
      { value: "none", label: "everywhere" },
      { value: "artwork", label: "☾ darks" },
      { value: "radial", label: "◎ radial" },
      { value: "linear", label: "▨ linear" },
      { value: "noise", label: "☁ drift" },
    ],
    () => state.shader.maskKind,
    v => { state.shader.maskKind = v; renderSVG(); rebuildPanel("texture"); }
  ));
  if (state.shader.maskKind !== "none") {
    g.appendChild(slider("Coverage", () => sh().maskCover, v => sh().maskCover = v, 0, 1, 0.01));
    g.appendChild(slider("Softness", () => sh().maskSoft, v => sh().maskSoft = v, 0.02, 1, 0.01));
    if (state.shader.maskKind === "linear") {
      g.appendChild(slider("Angle", () => sh().maskAngle, v => sh().maskAngle = v, 0, 360, 1, v => v.toFixed(0) + "°"));
    }
    if (state.shader.maskKind === "noise") {
      g.appendChild(slider("Patch size", () => sh().maskScale, v => sh().maskScale = v, 0.2, 4, 0.05));
    }
    g.appendChild(toggleRow("Invert mask", () => state.shader.maskInvert, v => state.shader.maskInvert = v));
  }

  g.appendChild(sectionLabel("Film grain"));
  g.appendChild(slider("Grain", () => sh().grainIntensity, v => sh().grainIntensity = v, 0, 0.3, 0.005, v => v.toFixed(3)));
  g.appendChild(hintEl("Masks make the texture live somewhere: ☾ darks rides the artwork (moves with the animation, invert = lights), ☁ drift wanders on the seamless loop. All baked into exports."));
});

/* ============================================================
   SECTION: MOTION
   ============================================================ */
defineSection("motion", "Motion & loop", (g) => {
  g.appendChild(toggleRow("Animate (Play/Pause)", () => state.shader.animate, v => { setPlayState(v); }));
  g.appendChild(slider("Speed", () => sh().speed, v => sh().speed = v, 0, 3, 0.01));
  g.appendChild(slider("Flow drift", () => sh().flowRate, v => sh().flowRate = v, 0, 2, 0.01));
  if (state.shader.scene === "liquid") {
    g.appendChild(slider("Pulse", () => sh().factorPulse, v => sh().factorPulse = v, 0, 1, 0.01));
  }
  g.appendChild(slider("Time", () => sh().time, v => sh().time = v, 0, 60, 0.05));
  g.appendChild(sectionLabel("Ripples"));
  g.appendChild(toggleRow("Always-on mouse ripples", () => state.shader.touchEnabled, v => state.shader.touchEnabled = v));
  g.appendChild(toggleRow("Freeze ripples (F)", () => state.shader.freezeRipples, v => {
    state.shader.freezeRipples = v;
    if (liquidShader) liquidShader.freezeRipples(v);
  }));
  g.appendChild(smallBtn("Clear ripples (C)", () => {
    if (!liquidShader) return;
    liquidShader.clearRipples();
    state.shader.freezeRipples = false;
    liquidShader.freezeRipples(false);
    rebuildPanel("motion");
  }));
  g.appendChild(hintEl("Hold ⎵ Space + move on canvas to stir. F freezes the stir into the artwork; video exports keep it. Exports are phase-locked to loop seamlessly at any duration."));
});

/* ============================================================
   SECTION: GRADE
   ============================================================ */
defineSection("grade", "Grade", (g) => {
  g.appendChild(slider("Lightness", () => sh().lightness, v => sh().lightness = v, 0.5, 2.0, 0.01));
  g.appendChild(slider("Contrast", () => sh().contrast, v => sh().contrast = v, 0.5, 2.0, 0.01));
  g.appendChild(slider("Vibrance", () => sh().vibrance, v => sh().vibrance = v, 0.5, 2.5, 0.01));
  g.appendChild(slider("Vignette", () => sh().vignette, v => sh().vignette = v, 0, 0.9, 0.01));
  g.appendChild(hintEl("Vignette darkens edges — helps hero text pop. All grading is baked into exports."));
});

/* ============================================================
   SECTION: FRAMING (canvas + view)
   ============================================================ */
defineSection("framing", "Framing", (g) => {
  const ratios = [
    { name: "16:9", w: 1600, h: 900 },
    { name: "21:9", w: 1680, h: 720 },
    { name: "1:1", w: 1080, h: 1080 },
    { name: "4:5", w: 1080, h: 1350 },
    { name: "9:16", w: 900, h: 1600 },
  ];
  const rg = el("div", { class: "chips" });
  ratios.forEach(r => {
    rg.appendChild(el("button", {
      class: "chip" + (state.canvas.w === r.w && state.canvas.h === r.h ? " active" : ""),
      onclick: () => { state.canvas.w = r.w; state.canvas.h = r.h; renderSVG(); rebuildPanel("framing"); }
    }, r.name));
  });
  g.appendChild(rg);
  g.appendChild(slider("Width", () => state.canvas.w, v => state.canvas.w = v, 400, 2400, 10));
  g.appendChild(slider("Height", () => state.canvas.h, v => state.canvas.h = v, 300, 2000, 10));
  g.appendChild(slider("Corner R", () => state.canvas.radius, v => state.canvas.radius = v, 0, 200, 1));
  g.appendChild(sectionLabel("View (crop into the pattern)"));
  g.appendChild(slider("Zoom", () => sh().zoom, v => sh().zoom = v, 0.2, 4, 0.05));
  g.appendChild(slider("Pan X", () => sh().panX, v => sh().panX = v, -2, 2, 0.01));
  g.appendChild(slider("Pan Y", () => sh().panY, v => sh().panY = v, -2, 2, 0.01));
  g.appendChild(slider("Rotate", () => sh().rotation * 180 / Math.PI, v => sh().rotation = v * Math.PI / 180, -180, 180, 1, v => v.toFixed(0) + "°"));
  g.appendChild(hintEl("⌥ Alt + drag on canvas pans the view. Exports render at canvas resolution ×2 (PNG) or the size you pick (video)."));
});

/* ============================================================
   SECTION: BRAND OVERLAY
   ============================================================ */
defineSection("overlay", "Preview overlay", (g) => {
  g.appendChild(chipRow(
    [
      { value: "none", label: "none" },
      { value: "logo", label: "your logo" },
    ],
    () => state.overlay.mode,
    v => { state.overlay.mode = v; }
  ));
  g.appendChild(logoUploadRow());
  const quick = el("div", { class: "btn-row" });
  const setCol = (c) => () => { state.overlay.color = c; renderSVG(); rebuildPanel("overlay"); };
  quick.appendChild(smallBtn("white", setCol("#ffffff")));
  quick.appendChild(smallBtn("black", setCol("#0a0a0d")));
  quick.appendChild(smallBtn("ink 1", setCol(state.palette.inks[0] || "#ffffff")));
  g.appendChild(quick);
  g.appendChild(colorRow("Color", () => state.overlay.color, v => state.overlay.color = v));
  g.appendChild(slider("Scale", () => state.overlay.scale, v => state.overlay.scale = v, 0.3, 4, 0.05));
  g.appendChild(slider("X", () => state.overlay.x, v => state.overlay.x = v, 0, 100, 0.5, v => v.toFixed(1) + "%"));
  g.appendChild(slider("Y", () => state.overlay.y, v => state.overlay.y = v, 0, 100, 0.5, v => v.toFixed(1) + "%"));
  g.appendChild(sectionLabel("Hero mock"));
  g.appendChild(toggleRow("Show dummy hero copy", () => state.overlay.heroMock, v => state.overlay.heroMock = v));
  if (state.overlay.heroMock) {
    g.appendChild(textRow("Title", () => state.overlay.heroTitle, v => state.overlay.heroTitle = v));
    g.appendChild(textRow("Sub", () => state.overlay.heroSub, v => state.overlay.heroSub = v));
    g.appendChild(colorRow("Text color", () => state.overlay.heroColor, v => state.overlay.heroColor = v));
  }
  g.appendChild(hintEl("Drop in a PNG or SVG to see how your own mark sits on the artwork. Nothing you add here is baked into an export unless you leave it on. Use BG only for the clean plate."));
});

/* ============================================================
   SECTION: ADVANCED
   ============================================================ */
defineSection("advanced", "Advanced", (g) => {
  g.appendChild(sectionLabel("Raw color slots (6)"));
  for (let i = 0; i < 6; i++) {
    g.appendChild(colorRow(`Slot ${i + 1}`,
      () => state.shader.colors[i] || "#000000",
      v => { state.shader.colors[i] = v; }
    ));
  }
  g.appendChild(colorRow("Base color", () => sh().baseColor, v => { sh().baseColor = v; state.canvas.baseColor = v; }));

  if (state.shader.scene === "liquid") {
    g.appendChild(sectionLabel("Liquid internals"));
    g.appendChild(slider("Intensity", () => sh().intensity, v => sh().intensity = v, 0, 3, 0.05));
    g.appendChild(slider("Saturation", () => sh().saturation, v => sh().saturation = v, 0.5, 2, 0.01));
    g.appendChild(slider("Add ↔ Mesh", () => sh().blendMode, v => sh().blendMode = v, 0, 1, 0.01));
    g.appendChild(slider("Odd weight", () => sh().color1Weight, v => sh().color1Weight = v, 0, 3, 0.05));
    g.appendChild(slider("Even weight", () => sh().color2Weight, v => sh().color2Weight = v, 0, 3, 0.05));
    g.appendChild(slider("Overlay mix", () => sh().overlayMix, v => sh().overlayMix = v, 0, 1, 0.01));
    g.appendChild(slider("Time drift", () => sh().timeShift, v => sh().timeShift = v, 0, 0.1, 0.005, v => v.toFixed(3)));
    const btns = el("div", { class: "btn-row" });
    btns.appendChild(smallBtn("🎲 blob sizes", () => {
      state.shader.centerSizes = state.shader.centerSizes.map(() => rand(0.3, 1.8));
      renderSVG();
    }));
    btns.appendChild(smallBtn("↺ sizes = 1", () => {
      state.shader.centerSizes = state.shader.centerSizes.map(() => 1);
      renderSVG();
    }));
    g.appendChild(btns);
  }

  g.appendChild(sectionLabel("Engine"));
  g.appendChild(toggleRow("OKLab color ramps (non-liquid)", () => !!sh().oklab, v => sh().oklab = v));
  g.appendChild(toggleRow("Dither (kills banding)", () => sh().dither > 0.5, v => sh().dither = v ? 1 : 0));
});

/* ============================================================
   SECTION: SAVED LOOKS
   ============================================================ */
defineSection("presets", "Saved looks", (g) => {
  const grid = el("div", { class: "preset-grid" });
  const presets = loadPresets();
  if (presets.length === 0) {
    grid.appendChild(el("div", { class: "empty" }, "Nothing saved yet — hit Save (S) to capture this look."));
  } else {
    presets.forEach((p, i) => {
      const card = el("div", { class: "preset-card", title: p.name });
      if (p.thumb) {
        card.appendChild(el("img", { src: p.thumb, alt: p.name }));
      } else {
        card.appendChild(el("div", { class: "preset-ghost" }, "◈"));
      }
      card.appendChild(el("div", { class: "name" }, p.name));
      const del = el("button", {
        class: "del",
        onclick: (e) => { e.stopPropagation(); const ps = loadPresets(); ps.splice(i, 1); savePresets(ps); rebuildPanel("presets"); }
      }, "×");
      card.appendChild(del);
      card.addEventListener("click", () => loadPreset(i));
      grid.appendChild(card);
    });
  }
  g.appendChild(grid);
  const btns = el("div", { class: "btn-row" });
  btns.appendChild(smallBtn("💾 save look (S)", () => savePreset()));
  btns.appendChild(smallBtn("set as default", () => {
    localStorage.setItem(CUSTOM_DEFAULT_KEY, JSON.stringify(state));
    toast("This look now loads on startup");
  }));
  g.appendChild(btns);
  const io = el("div", { class: "btn-row" });
  io.appendChild(smallBtn("⇣ export JSON", () => exportPresetsJSON()));
  io.appendChild(smallBtn("⇡ import JSON", () => importPresetsJSON()));
  g.appendChild(io);
});
