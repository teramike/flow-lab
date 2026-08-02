/* ============================================================
   OVERLAY SVG — brand mark / wordmark / lockup / hero mock.
   The animated background is the WebGL canvas underneath;
   this SVG layer is transparent and purely for composition checks
   + branded exports.
   ============================================================ */

function buildSVGInner(s, idPrefix) {
  const c = s.canvas;
  const W = c.w, H = c.h;
  const id = (n) => `${idPrefix}-${n}`;
  const ov = s.overlay || { mode: "none" };

  let defs = `<clipPath id="${id('clip')}"><rect x="0" y="0" width="${W}" height="${H}" rx="${c.radius}" ry="${c.radius}"/></clipPath>`;
  let body = `<g clip-path="url(#${id('clip')})">`;

  const cx = (ov.x / 100) * W;
  const cy = (ov.y / 100) * H;

  if (ov.mode === "logo" && ov.logoSrc) {
    // Your own mark, dropped in by you. Sized off canvas height so it stays
    // proportional at any export resolution.
    const h = 0.075 * H * ov.scale * 2.2;
    const w = h * (ov.logoAspect || 1);
    body += `<g id="${id('overlay')}">`;
    body += `<image href="${ov.logoSrc}" x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" preserveAspectRatio="xMidYMid meet"/>`;
    body += `</g>`;
  }

  if (ov.heroMock) {
    // Dummy hero copy — for judging text contrast on the moving background.
    const tSize = Math.round(W * 0.046);
    const sSize = Math.round(W * 0.0165);
    const hx = W / 2;
    const hy = H * 0.46;
    body += `<g id="${id('hero')}" opacity="0.96">`;
    body += `<text x="${hx}" y="${hy}" font-family="'Fraunces', serif" font-weight="600" font-size="${tSize}" fill="${ov.heroColor}" text-anchor="middle" letter-spacing="-1">${escapeXML(ov.heroTitle)}</text>`;
    body += `<text x="${hx}" y="${hy + tSize * 0.95}" font-family="'Inter', sans-serif" font-weight="400" font-size="${sSize}" fill="${ov.heroColor}" fill-opacity="0.78" text-anchor="middle">${escapeXML(ov.heroSub)}</text>`;
    const pillW = W * 0.128, pillH = sSize * 2.5, pillY = hy + tSize * 1.5;
    body += `<rect x="${hx - pillW / 2}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${ov.heroColor}"/>`;
    body += `<text x="${hx}" y="${pillY + pillH / 2}" font-family="'Inter', sans-serif" font-weight="600" font-size="${sSize}" fill="${s.shader.baseColor}" text-anchor="middle" dominant-baseline="central">${escapeXML(ov.heroCta || "Get started")}</text>`;
    body += `</g>`;
  }

  body += `</g>`;
  return `<defs>${defs}</defs>${body}`;
}

/* ============================================================
   RENDER
   ============================================================ */
const svgEl = document.getElementById("stage-svg");
const shaderCanvas = document.getElementById("shader-canvas");
let liquidShader = null;

function renderSVG() {
  const c = state.canvas;
  svgEl.setAttribute("viewBox", `0 0 ${c.w} ${c.h}`);
  svgEl.setAttribute("width", c.w);
  svgEl.setAttribute("height", c.h);
  svgEl.innerHTML = buildSVGInner(state, "main");
  updateShader();
  updateOverlayHandles();
  updateMeta();
}

// Push a shader-state object into uniforms. Defaults to the live state,
// but variations/exports can pass a temp object.
function shaderStateToOpts(sh) {
  return {
    scene: sh.scene,
    seed: sh.seed,
    colors: sh.colors,
    baseColor: sh.baseColor,
    speed: sh.speed,
    intensity: sh.intensity,
    grainIntensity: sh.grainIntensity,
    zoom: sh.zoom,
    panX: sh.panX,
    panY: sh.panY,
    rotation: sh.rotation,
    gradientSize: sh.gradientSize,
    gradientCount: sh.gradientCount,
    color1Weight: sh.color1Weight,
    color2Weight: sh.color2Weight,
    centerSizes: sh.centerSizes,
    saturation: sh.saturation,
    timeShift: sh.timeShift,
    overlayMix: sh.overlayMix,
    warpAmount: sh.warpAmount,
    warpFreq: sh.warpFreq,
    highlight: sh.highlight,
    blendMode: sh.blendMode,
    paintSharpness: sh.paintSharpness,
    centerWander: sh.centerWander,
    factorPulse: sh.factorPulse,
    flowRate: sh.flowRate,
    vibrance: sh.vibrance,
    contrast: sh.contrast,
    lightness: sh.lightness,
    patScale: sh.patScale,
    complexity: sh.complexity,
    definition: sh.definition,
    direction: sh.direction,
    bands: sh.bands,
    balance: sh.balance,
    oklab: sh.oklab,
    textureType: sh.textureType,
    textureAmount: sh.textureAmount,
    textureScale: sh.textureScale,
    textureBlend: sh.textureBlend,
    textureMono: sh.textureMono,
    maskKind: sh.maskKind,
    maskCover: sh.maskCover,
    maskSoft: sh.maskSoft,
    maskInvert: sh.maskInvert,
    maskAngle: sh.maskAngle,
    maskScale: sh.maskScale,
    vignette: sh.vignette,
    dither: sh.dither,
    touchEnabled: sh.touchEnabled,
  };
}

// The image texture uploads imperatively (not via uniforms-per-frame).
// Call after state.shader.textureImage changes.
let _appliedTextureImage = null;
function syncImageTexture() {
  if (!liquidShader) return;
  const url = state.shader.textureImage;
  if (url === _appliedTextureImage) return;
  _appliedTextureImage = url;
  if (url) liquidShader.setImageTextureFromDataURL(url);
}

function updateShader(shaderState) {
  if (!liquidShader) return;
  const sh = shaderState || state.shader;
  const c = state.canvas;
  const svgRect = svgEl.getBoundingClientRect();
  const dispW = Math.max(1, Math.round(svgRect.width));
  const dispH = Math.max(1, Math.round(svgRect.height));
  liquidShader.resize(dispW, dispH);
  shaderCanvas.style.borderRadius = (c.radius * (dispW / c.w)) + "px";
  liquidShader.set(shaderStateToOpts(sh));
  liquidShader.setTime(sh.time);
  if (!shaderState) {
    syncImageTexture();
    if (sh.animate) {
      liquidShader.startLoop();
    } else {
      liquidShader.stopLoop();
      liquidShader.renderOnce();
    }
  }
}

function updateMeta() {
  document.getElementById("meta-dim").textContent = `${state.canvas.w}×${state.canvas.h}`;
  const timeEl = document.getElementById("meta-time");
  if (timeEl) timeEl.textContent = `${state.shader.time.toFixed(1)}s`;
  const sceneEl = document.getElementById("meta-scene");
  if (sceneEl) sceneEl.textContent = state.shader.scene;
  const seedEl = document.getElementById("meta-seed");
  if (seedEl) seedEl.textContent = state.shader.seed || "classic";
}

/* ============================================================
   OVERLAY DRAG HANDLE + GUIDES
   ============================================================ */
function updateOverlayHandles() {
  const layer = document.getElementById("blob-handles");
  if (!layer) return;
  const rect = svgEl.getBoundingClientRect();
  const shellRect = document.getElementById("stage-shell").getBoundingClientRect();
  const cssPos = (e) => {
    e.style.left = (rect.left - shellRect.left) + "px";
    e.style.top = (rect.top - shellRect.top) + "px";
    e.style.width = rect.width + "px";
    e.style.height = rect.height + "px";
  };
  cssPos(layer);
  cssPos(document.getElementById("guides"));

  layer.innerHTML = "";
  if (!state.overlay || state.overlay.mode === "none" || !state.overlay.logoSrc) return;

  const lh = document.createElement("div");
  lh.className = "logo-handle";
  lh.style.left = state.overlay.x + "%";
  lh.style.top = state.overlay.y + "%";
  lh.title = "Drag to reposition your logo";
  lh.innerHTML = `<div class="blob-handle-num">logo · ${Math.round(state.overlay.x)},${Math.round(state.overlay.y)}</div>`;
  lh.addEventListener("mousedown", (e) => startDragOverlay(e));
  layer.appendChild(lh);
}

function showGuides(x, y, snappedX, snappedY) {
  const guides = document.getElementById("guides");
  guides.classList.add("active");
  const vc = document.getElementById("g-vc");
  const hc = document.getElementById("g-hc");
  const lbl = document.getElementById("g-lbl");
  vc.classList.toggle("snap", snappedX);
  hc.classList.toggle("snap", snappedY);
  lbl.textContent = `${x.toFixed(1)} · ${y.toFixed(1)}`;
  lbl.style.left = x + "%";
  lbl.style.top = (y - 6) + "%";
}
function hideGuides() {
  document.getElementById("guides").classList.remove("active");
}
function snapValue(v, target = 50, threshold = 1.5) {
  return Math.abs(v - target) < threshold ? { v: target, snap: true } : { v, snap: false };
}

function startDragOverlay(e) {
  e.preventDefault();
  const layer = document.getElementById("blob-handles");
  const rect = layer.getBoundingClientRect();
  const startX = ((e.clientX - rect.left) / rect.width) * 100;
  const startY = ((e.clientY - rect.top) / rect.height) * 100;
  const init = [state.overlay.x, state.overlay.y];
  const move = (ev) => {
    const px = ((ev.clientX - rect.left) / rect.width) * 100;
    const py = ((ev.clientY - rect.top) / rect.height) * 100;
    let nx = clamp(init[0] + (px - startX), 0, 100);
    let ny = clamp(init[1] + (py - startY), 0, 100);
    const sx = snapValue(nx), sy = snapValue(ny);
    nx = sx.v; ny = sy.v;
    state.overlay.x = nx; state.overlay.y = ny;
    renderSVG();
    showGuides(nx, ny, sx.snap, sy.snap);
  };
  const up = () => {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
    hideGuides();
    rebuildPanel("overlay");
  };
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
}

window.addEventListener("resize", updateOverlayHandles);
