async function ensureFontReady() {
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch {} }
}

// Render the shader to an offscreen canvas at the given resolution.
// Uses a temporary WebGLRenderer instance so the live canvas isn't disturbed.
function renderShaderToOffscreen(w, h) {
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  const tempRenderer = new THREE.WebGLRenderer({
    canvas: off, antialias: true, alpha: false, preserveDrawingBuffer: true,
  });
  tempRenderer.setPixelRatio(1);
  tempRenderer.setSize(w, h, false);
  const prevRes = liquidShader.uniforms.uResolution.value.clone();
  liquidShader.uniforms.uResolution.value.set(w, h);
  tempRenderer.render(liquidShader.scene, liquidShader.camera);
  liquidShader.uniforms.uResolution.value.copy(prevRes);
  // Don't dispose immediately or we lose the canvas pixels; GC handles it.
  return off;
}

function roundClip(ctx, W, H, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, 0, W, H, r);
  else {
    ctx.moveTo(r, 0);
    ctx.arcTo(W, 0, W, H, r);
    ctx.arcTo(W, H, 0, H, r);
    ctx.arcTo(0, H, 0, 0, r);
    ctx.arcTo(0, 0, W, 0, r);
  }
  ctx.closePath();
  ctx.clip();
}

/* ============================================================
   PNG EXPORTS
   ============================================================ */
async function exportPNG(scale = 2) {
  await ensureFontReady();
  const W = state.canvas.w * scale, H = state.canvas.h * scale;
  const shaderOff = renderShaderToOffscreen(W, H);
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  const ctx = out.getContext("2d");
  ctx.save();
  roundClip(ctx, W, H, state.canvas.radius * scale);
  ctx.drawImage(shaderOff, 0, 0, W, H);
  const xml = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, W, H);
    ctx.restore();
    out.toBlob(b => { downloadBlob(b, "flow-lab.png"); toast("PNG exported"); }, "image/png");
    URL.revokeObjectURL(svgUrl);
  };
  img.onerror = () => { toast("PNG export failed"); URL.revokeObjectURL(svgUrl); };
  img.src = svgUrl;
}

async function exportBGOnly(scale = 2) {
  if (!liquidShader) return;
  const W = state.canvas.w * scale, H = state.canvas.h * scale;
  const shaderOff = renderShaderToOffscreen(W, H);
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  const ctx = out.getContext("2d");
  roundClip(ctx, W, H, state.canvas.radius * scale);
  ctx.drawImage(shaderOff, 0, 0, W, H);
  out.toBlob(b => { downloadBlob(b, "flow-lab-bg.png"); toast("Background exported"); }, "image/png");
}

/* ============================================================
   VIDEO EXPORT
   Two engines:
   1) WebCodecs + mp4-muxer — frame-exact, faster than realtime, no drops.
   2) MediaRecorder fallback — realtime capture (older browsers / no CDN).
   Both run phase-locked (uLoopLen = duration) → seamless loop.
   ============================================================ */
let _videoAbort = null;

function showExportProgress(label) {
  const elp = document.getElementById("export-progress");
  elp.hidden = false;
  document.getElementById("ep-label").textContent = label;
  setExportProgress(0, "");
}
function setExportProgress(frac, note) {
  document.getElementById("ep-bar").style.width = `${Math.round(frac * 100)}%`;
  if (note != null) document.getElementById("ep-note").textContent = note;
}
function hideExportProgress() {
  document.getElementById("export-progress").hidden = true;
}

function pickBitrate(width, height, fps, quality) {
  const bpp = { standard: 0.12, high: 0.22, max: 0.38 }[quality] || 0.15;
  return Math.min(Math.round(width * height * fps * bpp), 220_000_000);
}

async function pickAvcConfig(width, height, fps, bitrate) {
  const pxps = width * height * fps;
  // High profile at the lowest level that fits the pixel rate.
  const level = pxps <= 62914560 ? "28" : pxps <= 133693440 ? "2A" : pxps <= 267386880 ? "32" : pxps <= 534773760 ? "33" : "34";
  const candidates = [
    `avc1.6400${level}`,   // High
    `avc1.4D40${level}`,   // Main
    `avc1.4200${level}`,   // Baseline
    "avc1.640033", "avc1.42001f",
  ];
  for (const codec of candidates) {
    const cfg = { codec, width, height, bitrate, framerate: fps };
    try {
      const s = await VideoEncoder.isConfigSupported(cfg);
      if (s.supported) return cfg;
    } catch {}
  }
  return null;
}

// Prepare an offscreen renderer + loop-locked uniforms; returns a cleanup fn.
function beginVideoRender(width, height, durationSec) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  const prevRes = liquidShader.uniforms.uResolution.value.clone();
  liquidShader.uniforms.uResolution.value.set(width, height);
  liquidShader.set({ loopLen: durationSec });
  // Freeze the touch state for the whole clip: whatever stir is on screen
  // stays constant, so the loop closes cleanly.
  liquidShader.touchTexture.update();
  const cleanup = () => {
    liquidShader.uniforms.uResolution.value.copy(prevRes);
    liquidShader.set({ loopLen: 0 });
    renderer.dispose();
    liquidShader.uniforms.uTime.value = liquidShader.time;
    liquidShader.renderOnce();
  };
  return { canvas, renderer, cleanup };
}

async function exportVideoWebCodecs({ width, height, durationSec, fps, quality }) {
  const bitrate = pickBitrate(width, height, fps, quality);
  const cfg = await pickAvcConfig(width, height, fps, bitrate);
  if (!cfg) throw new Error("no-avc-config");

  const { Muxer, ArrayBufferTarget } = Mp4Muxer;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  let encError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encError = e; },
  });
  encoder.configure(cfg);

  const { canvas, renderer, cleanup } = beginVideoRender(width, height, durationSec);
  const frames = Math.round(durationSec * fps);
  const dt = durationSec / frames;
  const keyInt = Math.max(1, Math.round(fps * 2));
  const t0 = performance.now();
  _videoAbort = { cancelled: false };
  const abortRef = _videoAbort;

  showExportProgress(`Encoding ${width}×${height} · ${fps} fps · ${(bitrate / 1e6).toFixed(0)} Mbps`);
  try {
    for (let i = 0; i < frames; i++) {
      if (abortRef.cancelled) throw new Error("cancelled");
      if (encError) throw encError;
      liquidShader.uniforms.uTime.value = i * dt;
      renderer.render(liquidShader.scene, liquidShader.camera);
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round(i * 1e6 / fps),
        duration: Math.round(1e6 / fps),
      });
      encoder.encode(frame, { keyFrame: i % keyInt === 0 });
      frame.close();
      // Backpressure: don't let the encode queue balloon.
      while (encoder.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 1));
      if (i % 3 === 0) {
        const elapsed = (performance.now() - t0) / 1000;
        const rate = (i + 1) / Math.max(elapsed, 0.001);
        const eta = Math.max(0, (frames - i - 1) / Math.max(rate, 0.001));
        setExportProgress(i / frames, `frame ${i + 1}/${frames} · ${rate.toFixed(0)} fps · ~${Math.ceil(eta)}s left`);
        await new Promise(r => setTimeout(r, 0));   // let the bar paint
      }
    }
    setExportProgress(1, "finalizing…");
    await encoder.flush();
    muxer.finalize();
  } catch (e) {
    try { encoder.close(); } catch {}
    cleanup();
    hideExportProgress();
    if (e && e.message === "cancelled") { toast("Export cancelled"); return; }
    throw e;
  }
  cleanup();
  hideExportProgress();
  const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  downloadBlob(blob, `flow-lab-${width}x${height}-${durationSec}s.mp4`);
  toast(`MP4 saved · ${(blob.size / 1024 / 1024).toFixed(1)} MB · encoded in ${secs}s`);
}

// Realtime fallback — MediaRecorder (WebM/MP4 depending on browser).
async function exportVideoMediaRecorder({ width, height, durationSec, fps, quality }) {
  if (typeof MediaRecorder === "undefined") { toast("Video export unsupported in this browser"); return; }
  const candidates = quality === "max"
    ? ["video/mp4;codecs=avc1.64001F", "video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    : ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const mime = candidates.find(m => MediaRecorder.isTypeSupported(m));
  if (!mime) { toast("No supported video codec"); return; }
  const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
  const videoBitsPerSecond = pickBitrate(width, height, fps, quality);

  const { canvas, renderer, cleanup } = beginVideoRender(width, height, durationSec);
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((res) => { recorder.onstop = res; });
  recorder.start();
  _videoAbort = { cancelled: false };
  const abortRef = _videoAbort;

  showExportProgress(`Recording (realtime) ${width}×${height} · ${fps} fps`);
  const frames = Math.round(durationSec * fps);
  const dt = durationSec / frames;
  try {
    const frameIntervalMs = 1000 / fps;
    let nextFrameTime = performance.now();
    for (let i = 0; i < frames; i++) {
      if (abortRef.cancelled) break;
      liquidShader.uniforms.uTime.value = i * dt;
      renderer.render(liquidShader.scene, liquidShader.camera);
      if (i % 5 === 0) setExportProgress(i / frames, `frame ${i + 1}/${frames} (realtime)`);
      nextFrameTime += frameIntervalMs;
      const delay = Math.max(0, nextFrameTime - performance.now());
      await new Promise(r => setTimeout(r, delay));
    }
  } finally {
    recorder.stop();
    await stopped;
    cleanup();
    hideExportProgress();
  }
  if (abortRef.cancelled) { toast("Export cancelled"); return; }
  const blob = new Blob(chunks, { type: mime });
  downloadBlob(blob, `flow-lab-${width}x${height}-${durationSec}s.${ext}`);
  toast(`Saved ${ext.toUpperCase()} · ${(blob.size / 1024 / 1024).toFixed(1)} MB`);
}

async function exportVideo(opts) {
  if (!liquidShader) { toast("Shader not ready"); return; }
  const canWebCodecs = typeof VideoEncoder !== "undefined" && typeof window.Mp4Muxer !== "undefined";
  if (canWebCodecs) {
    try {
      await exportVideoWebCodecs(opts);
      return;
    } catch (e) {
      console.warn("WebCodecs export failed, falling back to MediaRecorder:", e);
      hideExportProgress();
      toast("Fast encoder unavailable — recording realtime instead");
    }
  }
  await exportVideoMediaRecorder(opts);
}

/* ============================================================
   EMBED KIT — a fully self-contained snippet for the landing page.
   Serializes the live shader classes so the copy always matches
   what you're looking at.
   ============================================================ */
function buildStandaloneShaderJS() {
  return [
    "// Generated by Flow Lab, https://github.com/teramike/flow-lab",
    `// Made by Miguel, ${AUTHOR_URL} . Yours to use, no attribution required.`,
    "// Requires Three.js r128.",
    `const SHADER_SCENE_INDEX = ${JSON.stringify(SHADER_SCENE_INDEX)};`,
    `const SHADER_TEXTURE_INDEX = ${JSON.stringify(SHADER_TEXTURE_INDEX)};`,
    `const LIQUID_FRAGMENT_SHADER = ${JSON.stringify(LIQUID_FRAGMENT_SHADER)};`,
    `const LIQUID_VERTEX_SHADER = ${JSON.stringify(LIQUID_VERTEX_SHADER)};`,
    TouchTexture.toString(),
    LiquidShader.toString(),
  ].join("\n\n");
}

function copyEmbedCode() {
  const cfg = shaderStateToOpts(state.shader);
  delete cfg.touchEnabled;
  const texImg = state.shader.textureType === "image" ? state.shader.textureImage : null;
  const code = `<!-- ============================================
  Animated background, exported from Flow Lab
  flow-lab by @${AUTHOR_HANDLE} . Free to use, credit optional.
  Paste inside the hero section. The canvas fills its
  nearest positioned ancestor.
============================================= -->
<canvas id="vt-bg" style="position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0;"></canvas>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<script>
(function () {
${buildStandaloneShaderJS().replace(/<\/script>/gi, "<\\/script>")}

  const cfg = ${JSON.stringify(cfg, null, 2)};
  const canvas = document.getElementById("vt-bg");
  const shader = new LiquidShader(canvas, Object.assign({}, cfg, { animate: true, touchEnabled: false }));
  shader.init();
${texImg ? `  shader.setImageTextureFromDataURL(${JSON.stringify(texImg)});\n` : ""}
  const fit = () => {
    const host = canvas.parentElement || document.body;
    const r = host.getBoundingClientRect();
    shader.resize(Math.max(1, r.width), Math.max(1, r.height));
  };
  fit();
  window.addEventListener("resize", fit);
  shader.setTime(${Number(state.shader.time.toFixed(2))});
  shader.startLoop();
})();
<\/script>`;
  navigator.clipboard.writeText(code).then(
    () => toast("Embed code copied — paste into the hero"),
    () => toast("Clipboard blocked — see console"),
  );
  console.log(code);
}

/* ============================================================
   PRESET JSON IO
   ============================================================ */
function exportPresetsJSON() {
  const data = {
    app: "flow-lab",
    author: "@" + AUTHOR_HANDLE,
    source: "https://github.com/teramike/flow-lab",
    version: 2,
    exportedAt: new Date().toISOString(),
    presets: loadPresets(),
  };
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "flow-lab-presets.json");
  toast("Presets JSON downloaded");
}
function importPresetsJSON() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const incoming = Array.isArray(data) ? data : (data.presets || []);
        if (!incoming.length) { toast("No presets in that file"); return; }
        const existing = loadPresets();
        const names = new Set(existing.map(p => p.name));
        let added = 0;
        for (const p of incoming) {
          if (!p || !p.state) continue;
          if (names.has(p.name)) p.name = p.name + " (imported)";
          existing.push(p); added++;
        }
        savePresets(existing);
        rebuildPanel("presets");
        toast(`Imported ${added} preset${added === 1 ? "" : "s"}`);
      } catch (e) {
        toast("Couldn't read that JSON");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}
