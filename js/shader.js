// === BEGIN PORTABLE SHADER MODULE ============================
// Drop this block + the Three.js script tag into any HTML page.
// Usage:
//   const shader = new LiquidShader(canvasElement, {
//     scene: "liquid",                       // liquid|silk|marble|clouds|lava|aurora
//     colors: ["#8F70EB","#13102A","#F55926","#13102A","#DABFE8","#13102A"],
//     baseColor: "#13102A",
//     speed: 0.5, animate: true,
//   });
//   shader.init();
//   shader.resize(w, h);
//   shader.startLoop();               // or shader.setTime(t); shader.renderOnce();
//   shader.set({ speed: 2 })          // live param changes
// ============================================================

const SHADER_SCENE_INDEX = {
  liquid: 0, silk: 1, marble: 2, clouds: 3, lava: 4, aurora: 5,
  vortex: 6, vibeflow: 6 /* legacy alias */, drops: 7, caustics: 8, current: 9, glass: 10,
};
const SHADER_BLEND_INDEX = { multiply: 0, softlight: 1, overlay: 2, screen: 3 };
const SHADER_MASK_INDEX = { none: 0, artwork: 1, radial: 2, linear: 3, noise: 4 };
const SHADER_TEXTURE_INDEX = { none: 0, paper: 1, canvas: 2, linen: 3, petals: 4, halftone: 5, hatch: 6, riso: 7, topo: 8, image: 9 };

class TouchTexture {
  constructor() {
    this.size = 64;
    this.width = this.height = this.size;
    this.maxAge = 64;
    this.radius = 0.25 * this.size;
    this.speed = 1 / this.maxAge;
    this.trail = [];
    this.last = null;
    this.frozen = false;     // when true, trail points never age/decay
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = this.size;
    this.ctx = this.canvas.getContext("2d");
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.size, this.size);
    this.texture = new THREE.Texture(this.canvas);
  }
  update() {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.size, this.size);
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i];
      if (!this.frozen) {
        const f = p.force * this.speed * (1 - p.age / this.maxAge);
        p.x += p.vx * f; p.y += p.vy * f;
        p.age++;
        if (p.age > this.maxAge) { this.trail.splice(i, 1); continue; }
      }
      this.drawPoint(p);
    }
    this.texture.needsUpdate = true;
  }
  clearTrail() { this.trail = []; this.last = null; this.update(); }
  addTouch(point) {
    let force = 0, vx = 0, vy = 0;
    if (this.last) {
      const dx = point.x - this.last.x, dy = point.y - this.last.y;
      if (dx === 0 && dy === 0) return;
      const dd = dx * dx + dy * dy, d = Math.sqrt(dd);
      vx = dx / d; vy = dy / d;
      force = Math.min(dd * 20000, 2.0);
    }
    this.last = { x: point.x, y: point.y };
    this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy });
  }
  drawPoint(p) {
    const pos = { x: p.x * this.width, y: (1 - p.y) * this.height };
    let intensity = 1;
    if (p.age < this.maxAge * 0.3) intensity = Math.sin((p.age / (this.maxAge * 0.3)) * (Math.PI / 2));
    else { const t = 1 - (p.age - this.maxAge * 0.3) / (this.maxAge * 0.7); intensity = -t * (t - 2); }
    intensity *= p.force;
    const color = `${((p.vx + 1) / 2) * 255}, ${((p.vy + 1) / 2) * 255}, ${intensity * 255}`;
    const offset = this.size * 5;
    this.ctx.shadowOffsetX = offset; this.ctx.shadowOffsetY = offset;
    this.ctx.shadowBlur = this.radius;
    this.ctx.shadowColor = `rgba(${color},${0.2 * intensity})`;
    this.ctx.beginPath();
    this.ctx.fillStyle = "rgba(255,0,0,1)";
    this.ctx.arc(pos.x - offset, pos.y - offset, this.radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

const LIQUID_FRAGMENT_SHADER = `
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor1; uniform vec3 uColor2; uniform vec3 uColor3;
uniform vec3 uColor4; uniform vec3 uColor5; uniform vec3 uColor6;
uniform float uSpeed; uniform float uIntensity;
uniform sampler2D uTouchTexture;
uniform float uGrainIntensity;
uniform float uZoom;
uniform vec2 uPan;
uniform float uRotation;
uniform vec3 uDarkNavy;
uniform float uGradientSize;
uniform float uGradientCount;
uniform float uColor1Weight;
uniform float uColor2Weight;
uniform float uSizes[12];
uniform float uSaturation;
uniform float uTimeShift;
uniform float uOverlayMix;
uniform float uWarpAmount;     // domain warp strength
uniform float uWarpFreq;       // scale of the warp noise
uniform float uHighlight;      // bright wisps / sheen / silver lining
uniform float uBlendMode;      // liquid: 0 additive plasma → 1 mesh
uniform float uPaintSharpness; // liquid: 1 blend → 32 paint
uniform float uLoopLen;        // 0 = live time; >0 = phase-locked seamless loop
uniform float uCenterWander;
uniform float uFactorPulse;
uniform float uFlowRate;
uniform float uVibrance;
uniform float uContrast;
uniform float uLightness;
// — scene system —
uniform float uScene;          // 0 liquid · 1 silk · 2 marble · 3 clouds · 4 lava · 5 aurora
uniform float uSeed;           // 0 = classic composition · n = reshuffled layout
uniform float uPatScale;       // pattern scale for non-liquid scenes
uniform float uComplexity;     // 0..1 detail
uniform float uDefinition;     // 0..1 soft ↔ sharp
uniform float uDirection;      // radians — silk/marble flow direction · vibeflow twist
uniform float uBands;          // palette stops in use (2..6)
uniform float uBalance;        // −1..1 — how much ink vs background in ramp scenes
uniform float uOklab;          // 1 = perceptual ramps
// — finish —
uniform float uTexKind;        // 0 none 1 paper 2 canvas 3 linen 4 petals 5 halftone 6 hatch 7 riso 8 topo 9 image
uniform float uTexAmount;
uniform float uTexScale;
uniform sampler2D uImageTexture;
uniform float uImageAspect;    // aspect of the loaded image (w/h)
uniform float uTexBlend;       // image blend: 0 multiply 1 soft-light 2 overlay 3 screen
uniform float uTexMono;        // 1 = desaturate the image before blending
uniform float uMaskKind;       // 0 everywhere 1 artwork darks 2 radial 3 linear 4 drifting noise
uniform float uMaskCover;      // how much of the frame the texture covers
uniform float uMaskSoft;       // mask edge softness
uniform float uMaskInvert;
uniform float uMaskAngle;      // radians — linear mask direction
uniform float uMaskScale;      // noise mask scale
uniform float uVignette;
uniform float uDither;
varying vec2 vUv;
#define PI 3.14159265359
#define TAU 6.28318530718

// ------------------------------------------------------------------
// Phase-locked time helpers. When uLoopLen > 0, every rate maps to an
// integer number of cycles across the loop so frame(0) == frame(loopLen)
// and exported video loops seamlessly.
// ------------------------------------------------------------------
float pSin(float rate) {
  if (uLoopLen > 0.0) {
    float absN = max(1.0, floor(abs(rate) * uLoopLen / TAU + 0.5));
    float N = rate < 0.0 ? -absN : absN;
    return sin(TAU * N * uTime / uLoopLen);
  }
  return sin(uTime * rate);
}
float pCos(float rate) {
  if (uLoopLen > 0.0) {
    float absN = max(1.0, floor(abs(rate) * uLoopLen / TAU + 0.5));
    float N = rate < 0.0 ? -absN : absN;
    return cos(TAU * N * uTime / uLoopLen);
  }
  return cos(uTime * rate);
}
float pAngle(float rate) {
  if (uLoopLen > 0.0) {
    float absN = max(1.0, floor(abs(rate) * uLoopLen / TAU + 0.5));
    float N = rate < 0.0 ? -absN : absN;
    return TAU * N * uTime / uLoopLen;
  }
  return uTime * rate;
}
// Linear drift becomes a circle in noise space; the path closes at uLoopLen.
vec2 pFbmOffset(float rate) {
  rate *= uFlowRate;
  if (uLoopLen > 0.0) {
    float r = rate * uLoopLen / TAU;
    float a = TAU * uTime / uLoopLen;
    return vec2(cos(a), sin(a)) * r;
  }
  return vec2(uTime * rate);
}

// ------------------------------------------------------------------
// Noise kit
// ------------------------------------------------------------------
float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.02; a *= 0.5; }
  return v;
}
// Variable-octave fbm with per-octave rotation (kills axis-aligned artifacts).
float fbmo(vec2 p, float oct) {
  float v = 0.0, a = 0.5, tot = 0.0;
  mat2 R = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    if (float(i) >= oct) break;
    v += a * vnoise(p); tot += a;
    p = R * p * 2.03 + vec2(3.1, 7.7);
    a *= 0.5;
  }
  return tot > 0.0 ? v / tot : 0.0;
}
// (F1, F2, cellHash) worley — powers the petals texture
vec3 voronoi3(vec2 p) {
  vec2 n = floor(p), f = fract(p);
  float F1 = 8.0, F2 = 8.0; float id = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = vec2(hash21(n + g), hash21(n + g + 19.19));
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < F1) { F2 = F1; F1 = d; id = hash21(n + g + 7.7); }
    else if (d < F2) { F2 = d; }
  }
  return vec3(sqrt(F1), sqrt(F2), id);
}
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// Seed offset — shifts noise domains so each seed is a fresh composition.
// Seed 0 returns zero so classic (pre-seed) looks render pixel-identically.
vec2 sOff(float k) {
  if (uSeed < 0.5) return vec2(0.0);
  return vec2(hash21(vec2(uSeed, k)), hash21(vec2(k + 1.31, uSeed))) * 23.7;
}

float grain(vec2 uv, float time) {
  vec2 g = uv * uResolution * 0.5;
  float v = fract(sin(dot(g + time, vec2(12.9898, 78.233))) * 43758.5453);
  return v * 2.0 - 1.0;
}

// ------------------------------------------------------------------
// OKLab — perceptual mixing for the ramp scenes. Gamma-2 approximation
// for the sRGB transfer keeps it cheap; visually indistinguishable here.
// ------------------------------------------------------------------
vec3 lin2oklab(vec3 c) {
  float l = dot(c, vec3(0.4122214708, 0.5363325363, 0.0514459929));
  float m = dot(c, vec3(0.2119034982, 0.6806995451, 0.1073969566));
  float s = dot(c, vec3(0.0883024619, 0.2817188376, 0.6299787005));
  l = pow(max(l, 0.0), 1.0 / 3.0); m = pow(max(m, 0.0), 1.0 / 3.0); s = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
              1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
              0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
vec3 oklab2lin(vec3 c) {
  float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  vec3 lms = vec3(l_ * l_ * l_, m_ * m_ * m_, s_ * s_ * s_);
  return vec3(dot(lms, vec3( 4.0767416621, -3.3077115913,  0.2309699292)),
              dot(lms, vec3(-1.2684380046,  2.6097574011, -0.3413193965)),
              dot(lms, vec3(-0.0041960863, -0.7034186147,  1.7076147010)));
}
vec3 mixc(vec3 a, vec3 b, float t) {
  t = clamp(t, 0.0, 1.0);
  if (uOklab > 0.5) {
    vec3 la = lin2oklab(a * a), lb = lin2oklab(b * b);
    // OKLCH polar interpolation — hue rotates while chroma is preserved,
    // so orange↔violet passes through vivid rose instead of grey mud.
    float Ca = length(la.yz), Cb = length(lb.yz);
    float ha = atan(la.z, la.y), hb = atan(lb.z, lb.y);
    float dh = hb - ha;
    if (dh > PI) dh -= TAU; else if (dh < -PI) dh += TAU;
    float L = mix(la.x, lb.x, t);
    float C = mix(Ca, Cb, t);
    float h = ha + dh * t;
    // near-grey endpoints have unstable hue — ease back to cartesian there
    float stab = smoothstep(0.0, 0.03, min(Ca, Cb));
    vec3 pol = vec3(L, cos(h) * C, sin(h) * C);
    vec3 cart = mix(la, lb, t);
    return sqrt(max(oklab2lin(mix(cart, pol, stab)), vec3(0.0)));
  }
  return mix(a, b, t);
}

// ------------------------------------------------------------------
// Palette ramp — stop 0 is the background, stops 1..n are the inks.
// ------------------------------------------------------------------
vec3 rampStop(float i) {
  i = clamp(i, 0.0, clamp(uBands, 2.0, 6.0) - 1.0);
  if (i < 0.5) return uDarkNavy;
  else if (i < 1.5) return uColor1;
  else if (i < 2.5) return uColor2;
  else if (i < 3.5) return uColor3;
  else if (i < 4.5) return uColor4;
  return uColor5;
}
vec3 ramp(float t) {
  // Ink balance: bias the ramp curve so inks (or the background) dominate.
  t = pow(clamp(t, 0.0, 1.0), exp2(-uBalance * 1.4));
  float n = clamp(uBands, 2.0, 6.0) - 1.0;
  float x = clamp(t, 0.0, 1.0) * n;
  float i = floor(x);
  return mixc(rampStop(i), rampStop(i + 1.0), x - i);
}
// Cycling ink picker for banded scenes (marble) — skips the background.
vec3 inkAt(float i) {
  float n = max(clamp(uBands, 2.0, 6.0) - 1.0, 1.0);
  float k = mod(i, n);
  if (k < 0.5) return uColor1;
  else if (k < 1.5) return uColor2;
  else if (k < 2.5) return uColor3;
  else if (k < 3.5) return uColor4;
  return uColor5;
}

// ==================================================================
// SCENE 0 — LIQUID (the classic stirred-paint engine, preserved)
// ==================================================================
vec3 getGradientColor(vec2 uv, float time) {
  float gr = uGradientSize;
  if (uWarpAmount > 0.001) {
    vec2 q = vec2(
      fbm(uv * uWarpFreq + pFbmOffset(0.07) + sOff(1.0)),
      fbm(uv * uWarpFreq + vec2(5.2, 1.3) + pFbmOffset(0.09) + sOff(2.0))
    );
    vec2 r = vec2(
      fbm(uv * uWarpFreq + 4.0 * q + vec2(1.7, 9.2)),
      fbm(uv * uWarpFreq + 4.0 * q + vec2(8.3, 2.8))
    );
    uv += (r - 0.5) * uWarpAmount;
  }
  vec2 h1  = vec2(0.85, 0.50); vec2 h2  = vec2(0.24, 0.74);
  vec2 h3  = vec2(0.53, 0.15); vec2 h4  = vec2(0.71, 0.78);
  vec2 h5  = vec2(0.16, 0.43); vec2 h6  = vec2(0.79, 0.31);
  vec2 h7  = vec2(0.43, 0.84); vec2 h8  = vec2(0.32, 0.20);
  vec2 h9  = vec2(0.83, 0.61); vec2 h10 = vec2(0.20, 0.68);
  vec2 h11 = vec2(0.61, 0.17); vec2 h12 = vec2(0.67, 0.81);
  if (uSeed > 0.5) {
    // fresh composition: hash the home layout (keeps 12 distinct anchors)
    h1  = vec2(0.14 + 0.72 * hash21(vec2(uSeed, 1.0)),  0.14 + 0.72 * hash21(vec2(1.0, uSeed)));
    h2  = vec2(0.14 + 0.72 * hash21(vec2(uSeed, 2.0)),  0.14 + 0.72 * hash21(vec2(2.0, uSeed)));
    h3  = vec2(0.14 + 0.72 * hash21(vec2(uSeed, 3.0)),  0.14 + 0.72 * hash21(vec2(3.0, uSeed)));
    h4  = vec2(0.14 + 0.72 * hash21(vec2(uSeed, 4.0)),  0.14 + 0.72 * hash21(vec2(4.0, uSeed)));
    h5  = vec2(0.14 + 0.72 * hash21(vec2(uSeed, 5.0)),  0.14 + 0.72 * hash21(vec2(5.0, uSeed)));
    h6  = vec2(0.14 + 0.72 * hash21(vec2(uSeed, 6.0)),  0.14 + 0.72 * hash21(vec2(6.0, uSeed)));
    h7  = vec2(0.14 + 0.72 * hash21(vec2(uSeed, 7.0)),  0.14 + 0.72 * hash21(vec2(7.0, uSeed)));
    h8  = vec2(0.14 + 0.72 * hash21(vec2(uSeed, 8.0)),  0.14 + 0.72 * hash21(vec2(8.0, uSeed)));
    h9  = vec2(0.14 + 0.72 * hash21(vec2(uSeed, 9.0)),  0.14 + 0.72 * hash21(vec2(9.0, uSeed)));
    h10 = vec2(0.14 + 0.72 * hash21(vec2(uSeed, 10.0)), 0.14 + 0.72 * hash21(vec2(10.0, uSeed)));
    h11 = vec2(0.14 + 0.72 * hash21(vec2(uSeed, 11.0)), 0.14 + 0.72 * hash21(vec2(11.0, uSeed)));
    h12 = vec2(0.14 + 0.72 * hash21(vec2(uSeed, 12.0)), 0.14 + 0.72 * hash21(vec2(12.0, uSeed)));
  }
  float cw = uCenterWander;
  vec2 c1  = mix(h1,  vec2(0.5 + pSin(uSpeed * 0.4) * 0.4,   0.5 + pCos(uSpeed * 0.5) * 0.4),  cw);
  vec2 c2  = mix(h2,  vec2(0.5 + pCos(uSpeed * 0.6) * 0.5,   0.5 + pSin(uSpeed * 0.45) * 0.5), cw);
  vec2 c3  = mix(h3,  vec2(0.5 + pSin(uSpeed * 0.35) * 0.45, 0.5 + pCos(uSpeed * 0.55) * 0.45), cw);
  vec2 c4  = mix(h4,  vec2(0.5 + pCos(uSpeed * 0.5) * 0.4,   0.5 + pSin(uSpeed * 0.4) * 0.4),  cw);
  vec2 c5  = mix(h5,  vec2(0.5 + pSin(uSpeed * 0.7) * 0.35,  0.5 + pCos(uSpeed * 0.6) * 0.35), cw);
  vec2 c6  = mix(h6,  vec2(0.5 + pCos(uSpeed * 0.45) * 0.5,  0.5 + pSin(uSpeed * 0.65) * 0.5), cw);
  vec2 c7  = mix(h7,  vec2(0.5 + pSin(uSpeed * 0.55) * 0.38, 0.5 + pCos(uSpeed * 0.48) * 0.42), cw);
  vec2 c8  = mix(h8,  vec2(0.5 + pCos(uSpeed * 0.65) * 0.36, 0.5 + pSin(uSpeed * 0.52) * 0.44), cw);
  vec2 c9  = mix(h9,  vec2(0.5 + pSin(uSpeed * 0.42) * 0.41, 0.5 + pCos(uSpeed * 0.58) * 0.39), cw);
  vec2 c10 = mix(h10, vec2(0.5 + pCos(uSpeed * 0.48) * 0.37, 0.5 + pSin(uSpeed * 0.62) * 0.43), cw);
  vec2 c11 = mix(h11, vec2(0.5 + pSin(uSpeed * 0.68) * 0.33, 0.5 + pCos(uSpeed * 0.44) * 0.46), cw);
  vec2 c12 = mix(h12, vec2(0.5 + pCos(uSpeed * 0.38) * 0.39, 0.5 + pSin(uSpeed * 0.56) * 0.41), cw);

  float i1 = 1.0 - smoothstep(0.0, gr * uSizes[0], length(uv - c1));
  float i2 = 1.0 - smoothstep(0.0, gr * uSizes[1], length(uv - c2));
  float i3 = 1.0 - smoothstep(0.0, gr * uSizes[2], length(uv - c3));
  float i4 = 1.0 - smoothstep(0.0, gr * uSizes[3], length(uv - c4));
  float i5 = 1.0 - smoothstep(0.0, gr * uSizes[4], length(uv - c5));
  float i6 = 1.0 - smoothstep(0.0, gr * uSizes[5], length(uv - c6));
  float i7 = 1.0 - smoothstep(0.0, gr * uSizes[6], length(uv - c7));
  float i8 = 1.0 - smoothstep(0.0, gr * uSizes[7], length(uv - c8));
  float i9 = 1.0 - smoothstep(0.0, gr * uSizes[8], length(uv - c9));
  float i10 = 1.0 - smoothstep(0.0, gr * uSizes[9], length(uv - c10));
  float i11 = 1.0 - smoothstep(0.0, gr * uSizes[10], length(uv - c11));
  float i12 = 1.0 - smoothstep(0.0, gr * uSizes[11], length(uv - c12));

  vec2 ru1 = uv - 0.5;
  float a1 = pAngle(uSpeed * 0.15);
  ru1 = vec2(ru1.x * cos(a1) - ru1.y * sin(a1), ru1.x * sin(a1) + ru1.y * cos(a1));
  ru1 += 0.5;
  vec2 ru2 = uv - 0.5;
  float a2 = pAngle(-uSpeed * 0.12);
  ru2 = vec2(ru2.x * cos(a2) - ru2.y * sin(a2), ru2.x * sin(a2) + ru2.y * cos(a2));
  ru2 += 0.5;
  float ri1 = 1.0 - smoothstep(0.0, 0.8, length(ru1 - 0.5));
  float ri2 = 1.0 - smoothstep(0.0, 0.8, length(ru2 - 0.5));

  float fp = 0.45 * uFactorPulse;
  float f1  = (0.55 + fp * pSin(uSpeed)) * uColor1Weight;
  float f2  = (0.55 + fp * pCos(uSpeed * 1.2)) * uColor2Weight;
  float f3  = (0.55 + fp * pSin(uSpeed * 0.8)) * uColor1Weight;
  float f4  = (0.55 + fp * pCos(uSpeed * 1.3)) * uColor2Weight;
  float f5  = (0.55 + fp * pSin(uSpeed * 1.1)) * uColor1Weight;
  float f6  = (0.55 + fp * pCos(uSpeed * 0.9)) * uColor2Weight;
  float f7  = (0.55 + fp * pSin(uSpeed * 1.4)) * uColor1Weight;
  float f8  = (0.55 + fp * pCos(uSpeed * 1.5)) * uColor2Weight;
  float f9  = (0.55 + fp * pSin(uSpeed * 1.6)) * uColor1Weight;
  float f10 = (0.55 + fp * pCos(uSpeed * 1.7)) * uColor2Weight;
  float f11 = (0.55 + fp * pSin(uSpeed * 1.8)) * uColor1Weight;
  float f12 = (0.55 + fp * pCos(uSpeed * 1.9)) * uColor2Weight;

  float wMax = 0.0;
  wMax = max(wMax, max(0.0, i1 * f1));
  wMax = max(wMax, max(0.0, i2 * f2));
  wMax = max(wMax, max(0.0, i3 * f3));
  wMax = max(wMax, max(0.0, i4 * f4));
  wMax = max(wMax, max(0.0, i5 * f5));
  wMax = max(wMax, max(0.0, i6 * f6));
  if (uGradientCount > 6.0) {
    wMax = max(wMax, max(0.0, i7  * f7));
    wMax = max(wMax, max(0.0, i8  * f8));
    wMax = max(wMax, max(0.0, i9  * f9));
    wMax = max(wMax, max(0.0, i10 * f10));
  }
  if (uGradientCount > 10.0) {
    wMax = max(wMax, max(0.0, i11 * f11));
    wMax = max(wMax, max(0.0, i12 * f12));
  }
  float invWMax = wMax > 0.0001 ? 1.0 / wMax : 0.0;

  vec3 colorAdd = vec3(0.0);
  vec3 colorWA = vec3(0.0);
  float wSum = 0.0;
  vec3 colorPaint = vec3(0.0);
  float pSum = 0.0;
  // Perceptual accumulators. Averaging sRGB triples pulls every overlap
  // toward grey, because opposing a/b components cancel. We accumulate in
  // OKLab instead and separately track the weighted mean chroma, then
  // restore that chroma at the end. Overlaps stay as saturated as the
  // colours that made them.
  vec3 okWA = vec3(0.0), okPaint = vec3(0.0);
  float chWA = 0.0, chPaint = 0.0;
  #define ACCUM(C, infl, factor) { float w = max(0.0, (infl) * (factor)); colorAdd += (C) * (infl) * (factor); colorWA += (C) * w; wSum += w; float pw = pow(w * invWMax, uPaintSharpness); colorPaint += (C) * pw; pSum += pw; vec3 ok = lin2oklab((C) * (C)); float ch = length(ok.yz); okWA += ok * w; chWA += ch * w; okPaint += ok * pw; chPaint += ch * pw; }

  ACCUM(uColor1, i1, f1)
  ACCUM(uColor2, i2, f2)
  ACCUM(uColor3, i3, f3)
  ACCUM(uColor4, i4, f4)
  ACCUM(uColor5, i5, f5)
  ACCUM(uColor6, i6, f6)
  if (uGradientCount > 6.0) {
    ACCUM(uColor1, i7,  f7)
    ACCUM(uColor2, i8,  f8)
    ACCUM(uColor3, i9,  f9)
    ACCUM(uColor4, i10, f10)
  }
  if (uGradientCount > 10.0) {
    ACCUM(uColor5, i11, f11)
    ACCUM(uColor6, i12, f12)
  }
  colorAdd += mix(uColor1, uColor3, ri1) * uOverlayMix * uColor1Weight;
  colorAdd += mix(uColor2, uColor4, ri2) * uOverlayMix * 0.9 * uColor2Weight;

  // Resolve the perceptual accumulators back to linear, rescaling chroma to
  // the weighted mean of the contributing colours so blends stay vivid.
  vec3 colorWANorm, colorPaintNorm;
  if (uOklab > 0.5 && wSum > 0.001) {
    vec3 ok = okWA / wSum;
    float c = length(ok.yz);
    if (c > 1e-4) ok.yz *= mix(1.0, (chWA / wSum) / c, 0.85);
    colorWANorm = sqrt(max(oklab2lin(ok), vec3(0.0)));
  } else {
    colorWANorm = wSum > 0.001 ? colorWA / wSum : uDarkNavy;
  }
  float coverage = clamp(wSum * 1.5, 0.0, 1.0);
  colorWANorm = mix(uDarkNavy, colorWANorm, coverage);
  if (uOklab > 0.5 && pSum > 0.0001) {
    vec3 ok = okPaint / pSum;
    float c = length(ok.yz);
    if (c > 1e-4) ok.yz *= mix(1.0, (chPaint / pSum) / c, 0.85);
    colorPaintNorm = sqrt(max(oklab2lin(ok), vec3(0.0)));
  } else {
    colorPaintNorm = pSum > 0.0001 ? colorPaint / pSum : uDarkNavy;
  }
  colorPaintNorm = mix(uDarkNavy, colorPaintNorm, coverage);

  float paintT = clamp((uPaintSharpness - 1.0) / 31.0, 0.0, 1.0);
  vec3 colorBase = mix(colorAdd, colorWANorm, uBlendMode);
  vec3 color = mix(colorBase, colorPaintNorm, paintT);

  float mixT = max(uBlendMode, paintT);
  color = clamp(color, vec3(0.0), vec3(1.0)) * mix(uIntensity, 1.0, mixT);
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(lum), color, mix(uSaturation, 1.0, mixT));
  color = pow(color, vec3(0.92));
  float b1 = length(color);
  float mf1 = max(b1 * 1.2, 0.15);
  color = mix(uDarkNavy, color, mf1);
  float maxB = 1.0;
  float bb = length(color);
  if (bb > maxB) color = color * (maxB / bb);

  if (uHighlight > 0.001) {
    float h = fbm(uv * (uWarpFreq * 1.6 + 1.0) + pFbmOffset(0.05) + sOff(3.0));
    h = pow(smoothstep(0.55, 0.85, h), 2.0);
    color += vec3(h * uHighlight);
  }
  return color;
}

// ==================================================================
// SCENE 1 — SILK: flowing directional waves with satin sheen
// ==================================================================
vec3 sceneSilk(vec2 uv) {
  vec2 p = rot2(uDirection) * (uv - 0.5);
  float freq = 1.5 + 2.7 * uPatScale;     // wave count across the frame
  float wf = 1.1 + 2.4 * uComplexity;
  float oct = 3.0 + 3.0 * uComplexity;
  vec2 drift = pFbmOffset(0.05);
  vec2 q = vec2(
    fbmo(p * wf + drift + sOff(4.0), oct),
    fbmo(p * wf + vec2(3.7, 8.1) - drift * 0.7 + sOff(5.0), oct)
  );
  // The warp BENDS the waves (phase shift) instead of dissolving them.
  float bend = (q.x - 0.5) * uWarpAmount * 2.6;
  float phase = (p.y + (q.y - 0.5) * uWarpAmount * 0.35) * TAU * freq + bend + pAngle(uSpeed * 0.12);
  float t = 0.5 + 0.5 * sin(phase);
  float t2 = 0.5 + 0.5 * sin(phase * 0.5 + (q.y - 0.5) * 3.0 + 1.7);
  t = clamp(t * 0.72 + t2 * 0.28, 0.0, 1.0);   // gentle cloth interference
  t = mix(t, smoothstep(0.12, 0.88, t), uDefinition);
  vec3 col = ramp(t);
  float sheen = pow(clamp(sin(phase + PI * 0.5), 0.0, 1.0), 28.0);
  col = mixc(col, rampStop(uBands - 1.0), sheen * uHighlight * 0.8);
  return col;
}

// ==================================================================
// SCENE 2 — MARBLE: warped ink bands with dark veins (paper marbling)
// ==================================================================
vec3 sceneMarble(vec2 uv) {
  vec2 p = rot2(uDirection) * (uv - 0.5);
  p *= (0.7 + 1.3 * uPatScale);
  float wf = 1.6 + 3.0 * uComplexity;
  float oct = 4.0 + 2.0 * uComplexity;
  vec2 drift = pFbmOffset(0.05);
  vec2 q = vec2(
    fbmo(p * wf + drift + sOff(6.0), oct),
    fbmo(p * wf + vec2(5.2, 1.3) - drift + sOff(7.0), oct)
  );
  vec2 r = vec2(
    fbmo(p * wf * 1.3 + 3.4 * q + vec2(1.7, 9.2) + drift * 0.4, oct),
    fbmo(p * wf * 1.3 + 3.4 * q + vec2(8.3, 2.8) - drift * 0.6, oct)
  );
  float nInks = max(clamp(uBands, 2.0, 6.0) - 1.0, 1.0);
  float s = p.x * nInks * 0.95 + (r.x - 0.5) * uWarpAmount * 5.0 + (r.y - 0.5) * 1.6;
  float bi = floor(s), bf = s - bi;
  float aa = mix(0.42, 0.05, uDefinition);
  vec3 col = mixc(inkAt(bi), inkAt(bi + 1.0), smoothstep(1.0 - aa, 1.0, bf));
  // dark vein along each boundary
  float edgeD = min(bf, 1.0 - bf);
  float vein = 1.0 - smoothstep(0.0, 0.045 + 0.09 * (1.0 - uDefinition), edgeD);
  col = mixc(col, uDarkNavy, vein * (0.2 + 0.5 * uDefinition));
  // fine mineral streaking
  float streak = fbmo(p * wf * 3.6 + q * 2.2 + sOff(12.0), 3.0);
  col *= 1.0 - (streak - 0.5) * 0.28;
  // pale wisps drifting across
  col = mixc(col, rampStop(uBands - 1.0), pow(smoothstep(0.62, 0.95, q.y), 2.0) * uHighlight);
  return col;
}

// ==================================================================
// SCENE 3 — CLOUDS: layered fbm density, airy nebula
// ==================================================================
vec3 sceneClouds(vec2 uv) {
  vec2 p = (uv - 0.5) * (0.65 + 1.5 * uPatScale);
  float oct = 4.0 + 2.0 * uComplexity;
  vec2 drift = pFbmOffset(0.045);
  vec2 q = vec2(
    fbmo(p * 1.6 + drift + sOff(8.0), 4.0),
    fbmo(p * 1.6 + vec2(4.4, 2.9) - drift, 4.0)
  );
  p += (q - 0.5) * uWarpAmount * 0.9;
  float d = fbmo(p * 2.3 + drift * 1.4 + sOff(9.0), oct);
  d += 0.34 * (fbmo(p * 5.8 - drift + sOff(10.0), oct) - 0.5);
  float cover = mix(0.63, 0.37, uDefinition);
  float t = smoothstep(cover - 0.34, cover + 0.27, d);
  vec3 col = ramp(t);
  // silver lining on the densest crests
  float hl = smoothstep(cover + 0.15, cover + 0.31, d);
  col = mixc(col, rampStop(uBands - 1.0), hl * uHighlight * 0.9);
  return col;
}

// ==================================================================
// SCENE 4 — CUTOUT (lava): posterized metaball layers, paper-cut look
// ==================================================================
vec3 sceneLava(vec2 uv) {
  vec2 p = uv;
  vec2 drift = pFbmOffset(0.05);
  float wq = 2.0 + 2.5 * uComplexity;
  vec2 q = vec2(
    fbmo(p * wq + drift + sOff(11.0), 4.0),
    fbmo(p * wq + vec2(7.7, 3.3) - drift, 4.0)
  );
  p += (q - 0.5) * uWarpAmount * 0.38;
  float field = 0.0;
  float rad = max(uGradientSize * (0.22 + 0.34 * uPatScale), 0.02);
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    if (fi >= uGradientCount) break;
    vec2 home = vec2(
      0.08 + 0.84 * hash21(vec2(fi * 3.17 + uSeed * 0.031, 2.7 + uSeed * 0.017)),
      0.08 + 0.84 * hash21(vec2(5.1 + uSeed * 0.023, fi * 7.91 + uSeed * 0.013))
    );
    float rx = 0.35 + 0.55 * hash21(vec2(fi, 12.7));
    float ry = 0.35 + 0.55 * hash21(vec2(fi, 31.4));
    vec2 c = home + vec2(pSin(uSpeed * (0.3 + rx * 0.5)) * (fi > 5.5 ? -1.0 : 1.0),
                         pCos(uSpeed * (0.3 + ry * 0.5))) * 0.12;
    float rr = rad * (0.5 + hash21(vec2(fi, 77.0)) * 1.0);
    float dd = length(p - c) / rr;
    field += exp(-dd * dd * 2.4);
  }
  float t0 = 1.0 - exp(-field * 0.85);
  float levels = clamp(uBands, 2.0, 6.0) - 1.0;
  float lv = t0 * levels;
  float li = floor(lv), lf = lv - li;
  float w = mix(0.38, 0.05, uDefinition);
  float t = (li + smoothstep(0.5 - w, 0.5 + w, lf)) / levels;
  vec3 col = ramp(clamp(t, 0.0, 1.0));
  // paper-cut rim shadow just below each contour edge
  float rim = smoothstep(0.5 - w, 0.5, lf) * (1.0 - smoothstep(0.5, 0.5 + w * 2.2, lf));
  col = mixc(col, uDarkNavy, rim * 0.22 * (1.0 - uHighlight));
  return col;
}

// ==================================================================
// SCENE 5 — AURORA: light curtains breathing over the base color
// ==================================================================
vec3 sceneAurora(vec2 uv) {
  vec3 col = uDarkNavy;
  vec2 drift = pFbmOffset(0.05);
  float nInks = max(clamp(uBands, 2.0, 6.0) - 1.0, 1.0);
  for (int L = 0; L < 3; L++) {
    float fl = float(L);
    float x = uv.x * (0.7 + 1.3 * uPatScale) + fl * 3.71 + uSeed * 0.613;
    // stacked baselines so the three curtains layer instead of piling up
    float base = 0.30 + 0.20 * fl;
    float yc = base
      + (fbmo(vec2(x * 1.25, fl * 7.7) + drift * (1.0 + fl * 0.25), 4.0) - 0.5) * 0.5
      // traveling ripple — the curtain visibly dances (loop-safe phase)
      + sin(x * (2.6 + fl * 1.3) - pAngle(uSpeed * (0.55 + fl * 0.2))) * 0.045
      + sin(x * (5.3 + fl) + pAngle(uSpeed * 0.34)) * 0.02;
    float w = (0.045 + 0.13 * (1.0 - uDefinition)) * (1.0 + fl * 0.35);
    float dd = uv.y - yc;
    float glow = exp(-(dd * dd) / (w * w));
    // upward-fading tail — light rises off the curtain edge
    float tail = dd < 0.0 ? exp(-(dd * dd) / (w * w * 9.0)) * 0.5 : 0.0;
    float body = max(glow, tail);
    // shimmering vertical rays scrolling through the curtain
    float streak = 0.42 + 0.58 * fbmo(vec2(x * (4.0 + 8.0 * uComplexity), uv.y * 2.0 - fl * 2.0) + drift * 2.3, 3.0);
    float shim = fbmo(vec2(x * 3.1, fl * 5.0) + drift * 1.7, 3.0);
    float rays = 0.75 + 0.25 * sin(x * (26.0 + 10.0 * uComplexity) + shim * 6.0 - pAngle(uSpeed * 0.8));
    vec3 lcol = rampStop(clamp(nInks - fl, 1.0, 5.0));   // brightest ink on the top curtain
    float amt = body * streak * rays * (0.55 + uHighlight * 0.75) * (1.0 - fl * 0.18);
    // screen blend — curtains glow over each other without washing to grey
    vec3 lit = clamp(lcol * amt, 0.0, 1.0);
    col = 1.0 - (1.0 - col) * (1.0 - lit);
  }
  return col;
}

// ==================================================================
// SCENE 6 - VORTEX: a pinwheel of paint arms spiralling around a living
// centre, stirred slowly so the arms never quite repeat.
// ==================================================================
vec3 sceneVibeflow(vec2 uv) {
  // living center — breathes a little, never leaves the heart of the frame
  vec2 c = vec2(0.5 + pSin(uSpeed * 0.21) * 0.035, 0.5 + pCos(uSpeed * 0.17) * 0.03);
  vec2 p = uv - c;
  p.x *= uResolution.x / max(uResolution.y, 1.0);
  p *= 2.6 / (0.75 + 1.25 * uPatScale);
  // organic pre-warp so the geometry reads as liquid, not math
  vec2 drift = pFbmOffset(0.05);
  float oct = 3.0 + 3.0 * uComplexity;
  vec2 q = vec2(
    fbmo(p * 1.5 + drift + sOff(13.0), oct),
    fbmo(p * 1.5 + vec2(4.2, 1.9) - drift * 0.8 + sOff(14.0), oct)
  );
  p += (q - 0.5) * uWarpAmount * 0.55;
  float r = length(p) + 1e-4;
  float th = atan(p.y, p.x);
  float arms = clamp(uGradientCount, 2.0, 8.0);
  float twist = uDirection * 7.0;                        // slider (radians) → spiral wind rate
  // archimedean spiral arms, rotating a whole number of turns per loop
  float rot = pAngle(uSpeed * 0.22);
  float s = (th + rot) * arms / TAU + r * twist;
  s += (q.x - 0.5) * 1.7;                                // paint wobble along the arms
  float bi = floor(s), bf = fract(s);
  float aa = mix(0.42, 0.07, uDefinition);
  vec3 arm = mixc(inkAt(bi), inkAt(bi + 1.0), smoothstep(1.0 - aa, 1.0, bf));
  // fin dimensionality — light gathers along each band's spine
  arm = mixc(arm, uDarkNavy, (1.0 - sin(clamp(bf, 0.0, 1.0) * PI)) * 0.18);
  // tonal life along the arm — light gathers mid-arm, deepens outward
  arm = mixc(arm, uDarkNavy, smoothstep(0.7, 1.9, r) * 0.55);
  arm = mixc(arm, rampStop(uBands - 1.0), pow(smoothstep(0.55, 0.95, q.y), 2.0) * uHighlight * 0.35);
  // fin taper — arms rise out of the ink around a small dark pupil
  float petal = smoothstep(0.015, 0.12, r);
  vec3 col = mixc(uDarkNavy, arm, petal * (0.72 + 0.28 * q.y));
  // dark marbling veins between arms
  float vein = 1.0 - smoothstep(0.0, 0.05 + 0.1 * (1.0 - uDefinition), min(bf, 1.0 - bf));
  col = mixc(col, uDarkNavy, vein * 0.34 * uDefinition * petal);
  // luminous core ring at the centre of the spiral
  float ring = exp(-pow((r - 0.13) * 11.0, 2.0));
  col = mixc(col, rampStop(uBands - 1.0), ring * uHighlight * 1.1);
  return col;
}

// ==================================================================
// SCENE 7 — DROPS: ink drops blooming in still water. Each drop lives
// on its own phase of the loop, so the cycle is seamless.
// ==================================================================
vec3 sceneDrops(vec2 uv) {
  float asp = uResolution.x / max(uResolution.y, 1.0);
  vec2 su = (uv - 0.5) * vec2(asp, 1.0);
  vec3 col = uDarkNavy;
  // ambient wash so the water isn't dead flat
  vec2 drift = pFbmOffset(0.04);
  float wash = fbmo(su * 1.4 + drift + sOff(15.0), 4.0);
  col = mixc(col, rampStop(1.0), smoothstep(0.35, 0.95, wash) * 0.22);
  float sizeMul = 0.55 + 0.75 * uPatScale;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    // per-drop lifecycle phase — advances a whole number of cycles per loop
    float ph = fract(pAngle(uSpeed * (0.1 + 0.018 * fi)) / TAU + hash21(vec2(fi * 1.7, uSeed + 3.0)));
    vec2 cpos = (vec2(
      0.1 + 0.8 * hash21(vec2(fi * 7.13, uSeed + 1.0)),
      0.12 + 0.76 * hash21(vec2(uSeed + 2.0, fi * 3.37))
    ) - 0.5) * vec2(asp, 1.0);
    float d = length(su - cpos);
    float R = (0.05 + 0.52 * ph) * (0.55 + 0.65 * hash21(vec2(fi, 9.9))) * sizeMul;
    float ringW = (0.018 + 0.16 * ph) * mix(1.4, 0.55, uDefinition) * sizeMul;
    // organic ink edge — wobble the radius with noise around the ring
    float wob = fbmo(su * (5.0 + 6.0 * uComplexity) + cpos * 3.0 + sOff(fi + 16.0), 3.0);
    float ring = exp(-pow((d - R * (0.9 + 0.2 * wob)) / max(ringW, 1e-4), 2.0));
    float life = sin(ph * PI);                     // bloom in, dissolve out
    vec3 ic = inkAt(fi);
    float amt = ring * life * (0.7 + uHighlight * 0.55);
    col = 1.0 - (1.0 - col) * (1.0 - clamp(ic * amt, 0.0, 1.0));   // screen blend
    // faint filled interior right after the drop lands
    float fill = exp(-pow(d / max(R, 1e-4), 2.0) * 3.0) * (1.0 - ph) * 0.35;
    col = mixc(col, ic, fill * life);
  }
  return col;
}

// ==================================================================
// SCENE 8 — REEF: drifting underwater caustic light-webs
// ==================================================================
vec3 sceneCaustics(vec2 uv) {
  float asp = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(asp, 1.0) * (1.6 + 2.4 * uPatScale);
  vec2 drift = pFbmOffset(0.06);
  vec2 q = vec2(
    fbmo(p * 0.9 + drift + sOff(17.0), 3.0),
    fbmo(p * 0.9 + vec2(3.3, 7.1) - drift, 3.0)
  );
  p += (q - 0.5) * uWarpAmount * 0.8;
  // deep watery base from the palette
  float depth = fbmo(p * 0.5 + drift * 0.5 + sOff(18.0), 4.0);
  vec3 col = ramp(0.18 + 0.45 * depth);
  // light webs: ridges where the two nearest voronoi cells meet
  vec3 v1 = voronoi3(p + drift * 0.6);
  float web1 = pow(1.0 - smoothstep(0.0, 0.05 + 0.3 * (1.0 - uDefinition), v1.y - v1.x), 2.0);
  vec3 v2 = voronoi3(p * 1.9 - drift * 0.9 + 5.0);
  float web2 = pow(1.0 - smoothstep(0.0, 0.4, v2.y - v2.x), 2.0);
  float flicker = 0.65 + 0.35 * fbmo(p * 2.0 + drift * 2.0, 3.0);
  vec3 lightC = mixc(rampStop(uBands - 1.0), vec3(1.0), 0.45);   // caustics burn toward white
  col = 1.0 - (1.0 - col) * (1.0 - clamp(lightC * web1 * flicker * (0.55 + uHighlight * 0.9), 0.0, 1.0));
  col = 1.0 - (1.0 - col) * (1.0 - clamp(rampStop(uBands - 2.0) * web2 * 0.35 * (0.5 + uComplexity), 0.0, 1.0));
  return col;
}

// ==================================================================
// SCENE 9 — CURRENT: a meandering river of ink with striations
// flowing along it — motion with a direction, tasks moving through.
// ==================================================================
vec3 sceneCurrent(vec2 uv) {
  vec2 drift = pFbmOffset(0.05);
  vec2 p = rot2(uDirection * 0.35) * (uv - 0.5) + 0.5;
  float x = p.x * (0.9 + 1.1 * uPatScale);
  // centerline meanders with noise + a traveling undulation
  float y0 = 0.5
    + (fbmo(vec2(x * 1.7, 3.7) + drift + sOff(19.0), 4.0) - 0.5) * 0.55
    + sin(x * 3.1 - pAngle(uSpeed * 0.45)) * 0.045;
  float d = p.y - y0;
  float halfW = 0.16 * (0.7 + 0.6 * fbmo(vec2(x * 2.3, 9.1) + drift * 0.6, 3.0)) * (0.6 + 0.8 * uPatScale);
  float band = d / max(halfW, 1e-4);            // −1..1 across the river
  float t = clamp(0.5 - band * 0.5, 0.0, 1.0);  // ramp across thickness
  vec3 rib = ramp(t);
  // striations sliding along the flow — the visible current
  float striae = sin(x * (26.0 + 34.0 * uComplexity) + band * 5.0 - pAngle(uSpeed * 1.1)
    + (fbmo(vec2(x * 3.0, band * 1.5) + drift, 3.0) - 0.5) * 5.0);
  rib = mixc(rib, uDarkNavy, (0.5 + 0.5 * striae) * 0.22);
  float inside = 1.0 - smoothstep(0.85, 1.02 + 0.6 * (1.0 - uDefinition), abs(band));
  vec3 col = mixc(uDarkNavy, rib, inside);
  // faint glow bleeding off the banks
  float glow = exp(-pow(abs(band) - 1.0, 2.0) * 3.0);
  col = 1.0 - (1.0 - col) * (1.0 - clamp(rampStop(uBands - 1.0) * glow * uHighlight * 0.35, 0.0, 1.0));
  return col;
}

// ==================================================================
// SCENE 10 — GLASS: light through real textured glass. A relief field
// (fluted ribs ↔ hammered cathedral ↔ fine frost) refracts an
// out-of-focus scene of drifting colored lights. Sheen on the relief.
// ==================================================================
float glassRelief(vec2 su) {
  // fluted vertical ribs
  float ribs = 0.5 + 0.5 * sin(su.x * 52.0 + sin(su.y * 3.0) * 0.4);
  // hammered cathedral cells
  vec3 v = voronoi3(su * (7.0 + uSeed * 0.0) + sOff(32.0));
  float hammered = smoothstep(0.0, 0.55, v.x);
  // fine frost stipple
  float frost = fbmo(su * 55.0 + sOff(33.0), 3.0);
  float c = uComplexity;
  return c < 0.5 ? mix(ribs, hammered, pow(c * 2.0, 1.7)) : mix(hammered, frost, (c - 0.5) * 2.0);
}
vec3 sceneGlass(vec2 uv) {
  float asp = uResolution.x / max(uResolution.y, 1.0);
  vec2 su = uv * vec2(asp, 1.0);
  // relief normal via central differences → true refraction offsets
  float e = 0.0045;
  vec2 grad = vec2(
    glassRelief(su + vec2(e, 0.0)) - glassRelief(su - vec2(e, 0.0)),
    glassRelief(su + vec2(0.0, e)) - glassRelief(su - vec2(0.0, e))
  ) / (2.0 * e);
  vec2 p = uv + grad * (0.001 + 0.0085 * uWarpAmount);

  // — the world behind the glass: dark stage + drifting blurry lights —
  float nInks = max(clamp(uBands, 2.0, 6.0) - 1.0, 1.0);
  vec3 col = ramp(0.03 + 0.16 * fbmo(p * 1.3 + pFbmOffset(0.03) + sOff(34.0), 3.0));
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 c = vec2(
      0.12 + 0.76 * hash21(vec2(fi * 3.7, uSeed + 11.0)),
      0.12 + 0.76 * hash21(vec2(uSeed + 13.0, fi * 5.1))
    );
    c += vec2(pSin(uSpeed * (0.09 + 0.035 * fi)), pCos(uSpeed * (0.11 + 0.027 * fi))) * 0.09;
    float d = length((p - c) * vec2(asp, 1.0));
    // light 0 is the big warm sun patch; the rest are room lights
    float r = fi < 0.5 ? 0.5 : 0.16 + 0.3 * hash21(vec2(fi, uSeed + 17.0));
    float glow = exp(-(d * d) / (r * r));
    vec3 lc = rampStop(1.0 + mod(fi, nInks));
    float amt = glow * (0.5 + uHighlight * 0.8) * (fi < 0.5 ? 1.15 : 0.9);
    col = 1.0 - (1.0 - col) * (1.0 - clamp(lc * amt, 0.0, 1.0));
  }

  // — window frame shadows, refracted along with the scene —
  float panes = 1.0 + floor(uPatScale * 2.5);
  float sway = pSin(uSpeed * 0.22) * 0.01;
  float bx = abs(fract(p.x * panes + sway + 0.5) - 0.5);
  float by = abs(fract(p.y * panes * 0.72 - sway + 0.5) - 0.5);
  float shadowSoft = 0.08 + 0.3 * (1.0 - uDefinition);
  float bar = min(smoothstep(0.024, 0.024 + shadowSoft, bx), smoothstep(0.024, 0.024 + shadowSoft, by));
  col *= mix(1.0 - 0.42 * uDefinition, 1.0, bar);

  // — glass presence: sheen down the relief slopes + self-shading —
  float sheen = pow(clamp(0.5 + 0.5 * (grad.x * 0.055 + grad.y * 0.04), 0.0, 1.0), 10.0);
  col += sheen * (0.08 + uHighlight * 0.18);
  col *= 1.0 + (glassRelief(su) - 0.5) * 0.34;
  return col;
}

// ==================================================================
// TEXTURE MASK — confines the texture layer to where you want it.
// Luminance mask rides the artwork (it moves with the animation);
// the noise mask drifts on the same loop-safe clock as everything.
// ==================================================================
float texMask(vec3 baseCol) {
  if (uMaskKind < 0.5) return 1.0;
  float asp = uResolution.x / max(uResolution.y, 1.0);
  float soft = max(uMaskSoft, 0.02);
  float m;
  if (uMaskKind < 1.5) {
    // texture settles into the artwork's darks (invert → lights)
    float l = dot(baseCol, vec3(0.299, 0.587, 0.114));
    m = smoothstep(uMaskCover + soft * 0.5, uMaskCover - soft * 0.5, l);
  } else if (uMaskKind < 2.5) {
    // radial pool from the center
    float d = length((vUv - 0.5) * vec2(asp, 1.0)) * 1.45;
    m = smoothstep(uMaskCover + soft, uMaskCover - soft, d);
  } else if (uMaskKind < 3.5) {
    // linear wipe along an angle
    vec2 dir = vec2(cos(uMaskAngle), sin(uMaskAngle));
    float d = dot(vUv - 0.5, dir) + 0.5;
    m = smoothstep(uMaskCover + soft, uMaskCover - soft, d);
  } else {
    // organic patches drifting through the frame (loop-safe)
    float n = fbmo(vUv * vec2(asp, 1.0) * (2.6 * uMaskScale) + pFbmOffset(0.06) + sOff(21.0), 4.0);
    m = smoothstep(uMaskCover + soft * 0.5, uMaskCover - soft * 0.5, n);
  }
  return uMaskInvert > 0.5 ? 1.0 - m : m;
}

// ==================================================================
// TEXTURE OVERLAYS — procedural kinds are static screen-space
// (loop-safe by construction); kind 6 blends a loaded image.
// ==================================================================
vec3 blendImage(vec3 col, vec3 tex, float k) {
  vec3 b;
  if (uTexBlend < 0.5) {
    b = col * tex;                                                        // multiply
  } else if (uTexBlend < 1.5) {
    // soft light — keeps mids, the texture modulates gently
    b = mix(2.0 * col * tex + col * col * (1.0 - 2.0 * tex),
            2.0 * col * (1.0 - tex) + sqrt(max(col, vec3(0.0))) * (2.0 * tex - 1.0),
            step(vec3(0.5), tex));
  } else if (uTexBlend < 2.5) {
    b = mix(2.0 * col * tex, 1.0 - 2.0 * (1.0 - col) * (1.0 - tex), step(vec3(0.5), col));  // overlay
  } else {
    b = 1.0 - (1.0 - col) * (1.0 - tex);                                  // screen
  }
  return mix(col, clamp(b, 0.0, 1.0), k);
}

vec3 applyTexture(vec3 col) {
  if (uTexKind < 0.5 || uTexAmount < 0.001) return col;
  float k = uTexAmount * texMask(col);
  if (k < 0.001) return col;
  vec2 tp = vUv * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0) * (6.0 * uTexScale);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  if (uTexKind > 8.5) {
    // image texture, cover-fit, zoomable, mirrors at the edges
    float canvasAspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 fit = canvasAspect > uImageAspect
      ? vec2(1.0, uImageAspect / canvasAspect)
      : vec2(canvasAspect / uImageAspect, 1.0);
    vec2 iuv = (vUv - 0.5) * fit / max(uTexScale, 0.05) + 0.5;
    vec3 tex = texture2D(uImageTexture, iuv).rgb;
    if (uTexMono > 0.5) tex = vec3(dot(tex, vec3(0.299, 0.587, 0.114)));
    return blendImage(col, tex, k);
  }

  // Real materials are not uniform. Paper has thick and thin patches, canvas
  // has slack and tension. Modulating amplitude with a low frequency field is
  // what stops all of these reading as a flat digital filter laid on top.
  float kb = k * (0.58 + 0.84 * fbmo(tp * 0.22 + 4.0, 3.0));

  if (uTexKind < 1.5) {
    // paper, pulp fibres plus cockling, the slow undulation of a damp sheet
    float n = fbmo(tp * 7.0, 4.0);
    float fiber = vnoise(vec2(tp.x * 40.0, tp.y * 3.0)) * 0.5 + vnoise(vec2(tp.x * 3.0, tp.y * 40.0)) * 0.5;
    float cockle = fbmo(tp * 0.85 + 11.0, 3.0) - 0.5;
    col *= 1.0 + ((n - 0.5) * 1.5 + (fiber - 0.5) * 0.7 + cockle * 0.6) * 0.32 * kb;
  } else if (uTexKind < 2.5) {
    // canvas, warp and weft of unequal weight, each thread wandering a little
    // so the weave never resolves into a regular grid and cannot moire
    vec2 j = vec2(vnoise(tp * 2.3), vnoise(tp.yx * 2.1 + 7.0)) - 0.5;
    float warp = sin((tp.x + j.x * 0.12) * 34.0);
    float weft = sin((tp.y + j.y * 0.12) * 29.0);
    float weave = warp * 0.55 + weft * 0.45 + warp * weft * 0.35;
    float slub = (vnoise(tp * 11.0) - 0.5) * 0.55;
    col *= 1.0 + (weave * 0.42 + slub) * 0.34 * kb;
  } else if (uTexKind < 3.5) {
    // linen, coarser and more irregular than canvas, with visible slubs
    vec2 j = vec2(fbmo(tp * 1.7, 3.0), fbmo(tp.yx * 1.5 + 3.0, 3.0)) - 0.5;
    float a = sin((tp.x + j.x * 0.34) * 19.0);
    float b = sin((tp.y + j.y * 0.34) * 16.0);
    float slub = smoothstep(0.52, 1.0, vnoise(tp * 3.6)) * (vnoise(tp * 24.0) - 0.5);
    col *= 1.0 + (a * 0.40 + b * 0.34 + slub * 1.5) * 0.32 * kb;
  } else if (uTexKind < 4.5) {
    // petals, organic voronoi flakes with per-cell tint
    vec3 v = voronoi3(tp * 1.35);
    float edge = smoothstep(0.02, 0.3, v.y - v.x);
    col *= 1.0 - (1.0 - edge) * 0.42 * kb;
    col *= 1.0 + (v.z - 0.5) * 0.2 * kb;
    col += edge * edge * 0.05 * kb;
  } else if (uTexKind < 5.5) {
    // halftone, print dots sized by luminance, screen angle wandering slightly
    float ang = 0.42 + (fbmo(tp * 0.4, 2.0) - 0.5) * 0.06;
    vec2 hp = rot2(ang) * tp * 5.0;
    float d = length(fract(hp) - 0.5);
    float r = mix(0.44, 0.13, lum);
    float dt = smoothstep(r, r - 0.09, d);
    col = mix(col, col * (0.62 + 0.5 * dt), kb);
  } else if (uTexKind < 6.5) {
    // crosshatch, engraving strokes that thicken where the artwork goes dark
    float dens = clamp(1.0 - lum, 0.0, 1.0);
    vec2 w = (vec2(fbmo(tp * 1.3, 3.0), fbmo(tp.yx * 1.1 + 5.0, 3.0)) - 0.5) * 0.09;
    float l1 = abs(fract(((tp.x + w.x) + (tp.y + w.y)) * 5.5) - 0.5);
    float l2 = abs(fract(((tp.x + w.x) - (tp.y + w.y)) * 5.5) - 0.5);
    float s1 = smoothstep(0.34 * dens, 0.34 * dens - 0.08, l1);
    float s2 = smoothstep(0.26 * dens, 0.26 * dens - 0.08, l2) * smoothstep(0.42, 0.66, dens);
    col = mix(col, col * 0.52, max(s1, s2) * kb);
  } else if (uTexKind < 7.5) {
    // riso, coarse ink grain with a hair of channel misregistration
    float g = vnoise(tp * 44.0) * 0.62 + vnoise(tp * 44.0 + 19.0) * 0.38 - 0.5;
    vec2 off = vec2(0.05, -0.04);
    col.r *= 1.0 + (fbmo((tp + off) * 3.0, 3.0) - 0.5) * 0.13 * kb;
    col.b *= 1.0 + (fbmo((tp - off) * 3.0, 3.0) - 0.5) * 0.13 * kb;
    col *= 1.0 + g * 0.6 * kb;
  } else {
    // topo, contour lines traced on the artwork's own luminance
    float levels = 5.0 + 7.0 * uTexScale;
    float band = abs(fract(lum * levels) - 0.5);
    float line = 1.0 - smoothstep(0.02, 0.09, band);
    col = mix(col, mix(col, uDarkNavy, 0.4), line * kb * 0.8);
  }
  return col;
}

void main() {
  vec2 uv = vUv;
  vec2 centered = uv - 0.5;
  if (uRotation != 0.0) {
    float cr = cos(uRotation);
    float sr = sin(uRotation);
    centered = vec2(centered.x * cr - centered.y * sr, centered.x * sr + centered.y * cr);
  }
  uv = centered / uZoom + 0.5 + uPan;
  vec4 tt = texture2D(uTouchTexture, uv);
  float vx = -(tt.r * 2.0 - 1.0);
  float vy = -(tt.g * 2.0 - 1.0);
  float intensity = tt.b;
  uv.x += vx * 0.8 * intensity;
  uv.y += vy * 0.8 * intensity;
  vec2 cen = vec2(0.5);
  float dist = length(uv - cen);
  float ripple = sin(dist * 20.0 - pAngle(3.0)) * 0.04 * intensity;
  float wave = sin(dist * 15.0 - pAngle(2.0)) * 0.03 * intensity;
  uv += vec2(ripple + wave);

  vec3 color;
  if (uScene < 0.5) {
    // Liquid keeps its historical pipeline exactly (grain participates in
    // the navy blend) so saved presets keep rendering pixel-identically.
    color = getGradientColor(uv, uTime);
    float gv = grain(uv, uTime);
    color += gv * uGrainIntensity;
    color.r += pSin(0.5) * uTimeShift;
    color.g += pCos(0.7) * uTimeShift;
    color.b += pSin(0.6) * uTimeShift;
    float b2 = length(color);
    float mf2 = max(b2 * 1.2, 0.15);
    color = mix(uDarkNavy, color, mf2);
  }
  else if (uScene < 1.5) color = sceneSilk(uv);
  else if (uScene < 2.5) color = sceneMarble(uv);
  else if (uScene < 3.5) color = sceneClouds(uv);
  else if (uScene < 4.5) color = sceneLava(uv);
  else if (uScene < 5.5) color = sceneAurora(uv);
  else if (uScene < 6.5) color = sceneVibeflow(uv);
  else if (uScene < 7.5) color = sceneDrops(uv);
  else if (uScene < 8.5) color = sceneCaustics(uv);
  else if (uScene < 9.5) color = sceneCurrent(uv);
  else color = sceneGlass(uv);

  // — shared grade —
  if (uVibrance != 1.0) {
    float lum2 = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(lum2), color, uVibrance);
  }
  if (uContrast != 1.0) {
    color = (color - 0.5) * uContrast + 0.5;
  }
  color *= uLightness;

  // — finish: texture, vignette, grain (non-liquid), dither —
  color = applyTexture(color);
  if (uVignette > 0.001) {
    float vd = length((vUv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0));
    color *= 1.0 - uVignette * smoothstep(0.42, 1.05, vd);
  }
  if (uScene > 0.5) {
    // gentler than the liquid path — these scenes have big smooth fields
    color += grain(uv, uTime) * uGrainIntensity * 0.55;
  }
  color = clamp(color, vec3(0.0), vec3(1.0));
  float bb = length(color);
  if (bb > 1.0) color = color * (1.0 / bb);
  // sub-quantum dither — kills gradient banding in exports, invisible otherwise
  color += (hash21(vUv * uResolution + fract(uTime) * 13.7) - 0.5) * (uDither * 2.0 / 255.0);
  gl_FragColor = vec4(color, 1.0);
}
`;

const LIQUID_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vUv = uv;
}
`;

class LiquidShader {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = Object.assign({
      scene: "liquid", seed: 0,
      colors: ["#8F70EB","#13102A","#F55926","#13102A","#DABFE8","#13102A"],
      baseColor: "#13102A",
      speed: 0.5, intensity: 1.6, grainIntensity: 0.06,
      zoom: 1.0, gradientSize: 0.5, gradientCount: 12,
      color1Weight: 0.9, color2Weight: 1.3,
      patScale: 1, complexity: 0.55, definition: 0.5, direction: 0, bands: 5, balance: 0,
      textureType: "none", textureAmount: 0, textureScale: 1,
      textureBlend: "softlight", textureMono: true, textureImage: null,
      maskKind: "none", maskCover: 0.5, maskSoft: 0.35, maskInvert: false, maskAngle: 90, maskScale: 1,
      animate: false, touchEnabled: true,
    }, opts);
    this.time = 0;
    this.touchTexture = new TouchTexture();
    this.rafId = null;
    this.lastFrame = 0;
  }
  init() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false, stencil: false, depth: false, preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

    const o = this.opts;
    const num = (v, d) => (v != null ? v : d);
    this.uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uColor1: { value: new THREE.Vector3() },
      uColor2: { value: new THREE.Vector3() },
      uColor3: { value: new THREE.Vector3() },
      uColor4: { value: new THREE.Vector3() },
      uColor5: { value: new THREE.Vector3() },
      uColor6: { value: new THREE.Vector3() },
      uSpeed: { value: num(o.speed, 1.2) },
      uIntensity: { value: num(o.intensity, 1.6) },
      uTouchTexture: { value: this.touchTexture.texture },
      uGrainIntensity: { value: num(o.grainIntensity, 0.06) },
      uZoom: { value: num(o.zoom, 1.0) },
      uPan: { value: new THREE.Vector2(num(o.panX, 0), num(o.panY, 0)) },
      uRotation: { value: num(o.rotation, 0) },
      uDarkNavy: { value: new THREE.Vector3() },
      uGradientSize: { value: num(o.gradientSize, 0.5) },
      uGradientCount: { value: num(o.gradientCount, 12) },
      uColor1Weight: { value: num(o.color1Weight, 1.0) },
      uColor2Weight: { value: num(o.color2Weight, 1.0) },
      uSizes: { value: (o.centerSizes && o.centerSizes.slice(0, 12)) || new Array(12).fill(1.0) },
      uSaturation: { value: num(o.saturation, 1.2) },
      uTimeShift: { value: num(o.timeShift, 0) },
      uOverlayMix: { value: num(o.overlayMix, 0.15) },
      uWarpAmount: { value: num(o.warpAmount, 0) },
      uWarpFreq: { value: num(o.warpFreq, 2.0) },
      uHighlight: { value: num(o.highlight, 0) },
      uBlendMode: { value: num(o.blendMode, 0) },
      uPaintSharpness: { value: num(o.paintSharpness, 1) },
      uLoopLen: { value: num(o.loopLen, 0) },
      uCenterWander: { value: num(o.centerWander, 1) },
      uFactorPulse: { value: num(o.factorPulse, 1) },
      uFlowRate: { value: num(o.flowRate, 1) },
      uVibrance: { value: num(o.vibrance, 1) },
      uContrast: { value: num(o.contrast, 1) },
      uLightness: { value: num(o.lightness, 1) },
      uScene: { value: SHADER_SCENE_INDEX[o.scene] ?? 0 },
      uSeed: { value: num(o.seed, 0) },
      uPatScale: { value: num(o.patScale, 1) },
      uComplexity: { value: num(o.complexity, 0.55) },
      uDefinition: { value: num(o.definition, 0.5) },
      uDirection: { value: (num(o.direction, 0)) * Math.PI / 180 },
      uBands: { value: num(o.bands, 5) },
      uBalance: { value: num(o.balance, 0) },
      uOklab: { value: (o.oklab == null || o.oklab) ? 1 : 0 },
      uTexKind: { value: SHADER_TEXTURE_INDEX[o.textureType] ?? 0 },
      uTexAmount: { value: num(o.textureAmount, 0) },
      uTexScale: { value: num(o.textureScale, 1) },
      uImageTexture: { value: this._makeFallbackImageTexture() },
      uImageAspect: { value: 1 },
      uTexBlend: { value: SHADER_BLEND_INDEX[o.textureBlend] ?? 1 },
      uTexMono: { value: (o.textureMono == null || o.textureMono) ? 1 : 0 },
      uMaskKind: { value: SHADER_MASK_INDEX[o.maskKind] ?? 0 },
      uMaskCover: { value: num(o.maskCover, 0.5) },
      uMaskSoft: { value: num(o.maskSoft, 0.35) },
      uMaskInvert: { value: o.maskInvert ? 1 : 0 },
      uMaskAngle: { value: num(o.maskAngle, 90) * Math.PI / 180 },
      uMaskScale: { value: num(o.maskScale, 1) },
      uVignette: { value: num(o.vignette, 0) },
      uDither: { value: num(o.dither, 1) },
    };
    if (o.textureImage) this.setImageTextureFromDataURL(o.textureImage);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: LIQUID_VERTEX_SHADER,
      fragmentShader: LIQUID_FRAGMENT_SHADER,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    this.setColors(this.opts.colors);
    this.setBaseColor(this.opts.baseColor);
  }
  hexToVec3(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return new THREE.Vector3(0, 0, 0);
    return new THREE.Vector3(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
  }
  setColors(arr) {
    for (let i = 0; i < 6; i++) {
      const v = this.hexToVec3(arr[i] || arr[arr.length - 1] || "#000000");
      this.uniforms[`uColor${i + 1}`].value.copy(v);
    }
  }
  setBaseColor(hex) {
    this.uniforms.uDarkNavy.value.copy(this.hexToVec3(hex));
  }
  set(opts) {
    Object.assign(this.opts, opts);
    const u = this.uniforms;
    if (opts.colors) this.setColors(opts.colors);
    if (opts.baseColor) this.setBaseColor(opts.baseColor);
    if (opts.speed !== undefined) u.uSpeed.value = opts.speed;
    if (opts.intensity !== undefined) u.uIntensity.value = opts.intensity;
    if (opts.grainIntensity !== undefined) u.uGrainIntensity.value = opts.grainIntensity;
    if (opts.zoom !== undefined) u.uZoom.value = opts.zoom;
    if (opts.panX !== undefined || opts.panY !== undefined) {
      const cur = u.uPan.value;
      u.uPan.value.set(opts.panX ?? cur.x, opts.panY ?? cur.y);
    }
    if (opts.rotation !== undefined) u.uRotation.value = opts.rotation;
    if (opts.gradientSize !== undefined) u.uGradientSize.value = opts.gradientSize;
    if (opts.gradientCount !== undefined) u.uGradientCount.value = opts.gradientCount;
    if (opts.color1Weight !== undefined) u.uColor1Weight.value = opts.color1Weight;
    if (opts.color2Weight !== undefined) u.uColor2Weight.value = opts.color2Weight;
    if (opts.centerSizes !== undefined) {
      const arr = u.uSizes.value;
      for (let i = 0; i < 12; i++) arr[i] = opts.centerSizes[i] != null ? opts.centerSizes[i] : 1.0;
    }
    if (opts.saturation !== undefined) u.uSaturation.value = opts.saturation;
    if (opts.timeShift !== undefined) u.uTimeShift.value = opts.timeShift;
    if (opts.overlayMix !== undefined) u.uOverlayMix.value = opts.overlayMix;
    if (opts.warpAmount !== undefined) u.uWarpAmount.value = opts.warpAmount;
    if (opts.warpFreq !== undefined) u.uWarpFreq.value = opts.warpFreq;
    if (opts.highlight !== undefined) u.uHighlight.value = opts.highlight;
    if (opts.blendMode !== undefined) u.uBlendMode.value = opts.blendMode;
    if (opts.paintSharpness !== undefined) u.uPaintSharpness.value = opts.paintSharpness;
    if (opts.loopLen !== undefined) u.uLoopLen.value = opts.loopLen;
    if (opts.centerWander !== undefined) u.uCenterWander.value = opts.centerWander;
    if (opts.factorPulse !== undefined) u.uFactorPulse.value = opts.factorPulse;
    if (opts.flowRate !== undefined) u.uFlowRate.value = opts.flowRate;
    if (opts.vibrance !== undefined) u.uVibrance.value = opts.vibrance;
    if (opts.contrast !== undefined) u.uContrast.value = opts.contrast;
    if (opts.lightness !== undefined) u.uLightness.value = opts.lightness;
    if (opts.scene !== undefined) u.uScene.value = typeof opts.scene === "number" ? opts.scene : (SHADER_SCENE_INDEX[opts.scene] ?? 0);
    if (opts.seed !== undefined) u.uSeed.value = opts.seed;
    if (opts.patScale !== undefined) u.uPatScale.value = opts.patScale;
    if (opts.complexity !== undefined) u.uComplexity.value = opts.complexity;
    if (opts.definition !== undefined) u.uDefinition.value = opts.definition;
    if (opts.direction !== undefined) u.uDirection.value = opts.direction * Math.PI / 180;
    if (opts.bands !== undefined) u.uBands.value = opts.bands;
    if (opts.balance !== undefined) u.uBalance.value = opts.balance;
    if (opts.oklab !== undefined) u.uOklab.value = opts.oklab ? 1 : 0;
    if (opts.textureType !== undefined) u.uTexKind.value = typeof opts.textureType === "number" ? opts.textureType : (SHADER_TEXTURE_INDEX[opts.textureType] ?? 0);
    if (opts.textureAmount !== undefined) u.uTexAmount.value = opts.textureAmount;
    if (opts.textureScale !== undefined) u.uTexScale.value = opts.textureScale;
    if (opts.textureBlend !== undefined) u.uTexBlend.value = typeof opts.textureBlend === "number" ? opts.textureBlend : (SHADER_BLEND_INDEX[opts.textureBlend] ?? 1);
    if (opts.textureMono !== undefined) u.uTexMono.value = opts.textureMono ? 1 : 0;
    if (opts.maskKind !== undefined) u.uMaskKind.value = typeof opts.maskKind === "number" ? opts.maskKind : (SHADER_MASK_INDEX[opts.maskKind] ?? 0);
    if (opts.maskCover !== undefined) u.uMaskCover.value = opts.maskCover;
    if (opts.maskSoft !== undefined) u.uMaskSoft.value = opts.maskSoft;
    if (opts.maskInvert !== undefined) u.uMaskInvert.value = opts.maskInvert ? 1 : 0;
    if (opts.maskAngle !== undefined) u.uMaskAngle.value = opts.maskAngle * Math.PI / 180;
    if (opts.maskScale !== undefined) u.uMaskScale.value = opts.maskScale;
    if (opts.vignette !== undefined) u.uVignette.value = opts.vignette;
    if (opts.dither !== undefined) u.uDither.value = opts.dither;
  }
  _makeFallbackImageTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 2;
    const x = c.getContext("2d");
    x.fillStyle = "#808080"; x.fillRect(0, 0, 2, 2);
    const t = new THREE.Texture(c);
    t.needsUpdate = true;
    return t;
  }
  // Load an image (HTMLImageElement / canvas) as the texture layer.
  setImageTexture(image) {
    const t = new THREE.Texture(image);
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    if (this.uniforms) {
      const old = this.uniforms.uImageTexture.value;
      this.uniforms.uImageTexture.value = t;
      this.uniforms.uImageAspect.value = (image.width || 1) / (image.height || 1);
      if (old && old.dispose) old.dispose();
    }
  }
  setImageTextureFromDataURL(url) {
    const img = new Image();
    img.onload = () => {
      this.setImageTexture(img);
      if (!this.rafId) this.renderOnce();
    };
    img.src = url;
  }
  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.uniforms.uResolution.value.set(w, h);
  }
  setTime(t) { this.time = t; this.uniforms.uTime.value = t; }
  addTouch(x, y) {
    this.touchTexture.addTouch({ x, y });
  }
  freezeRipples(on) {
    this.touchTexture.frozen = on;
    this.touchTexture.update();
    this.renderOnce();
  }
  clearRipples() {
    this.touchTexture.clearTrail();
    this.renderOnce();
  }
  renderOnce() {
    this.touchTexture.update();
    this.uniforms.uTime.value = this.time;
    this.renderer.render(this.scene, this.camera);
  }
  startLoop() {
    if (this.rafId) return;
    this.lastFrame = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      this.time += dt;
      this.uniforms.uTime.value = this.time;
      this.touchTexture.update();
      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
  stopLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
  // Render at arbitrary resolution into a target canvas (for export).
  renderToCanvas(targetCanvas, w, h) {
    const tempRenderer = new THREE.WebGLRenderer({
      canvas: targetCanvas,
      antialias: true, alpha: false, preserveDrawingBuffer: true,
    });
    tempRenderer.setPixelRatio(1);
    tempRenderer.setSize(w, h, false);
    const prevRes = this.uniforms.uResolution.value.clone();
    this.uniforms.uResolution.value.set(w, h);
    tempRenderer.render(this.scene, this.camera);
    this.uniforms.uResolution.value.copy(prevRes);
    tempRenderer.dispose();
  }
  // Fast small render for variation/history thumbnails. Reuses one hidden
  // renderer so we don't churn WebGL contexts.
  renderThumb(w, h) {
    if (!this._thumbRenderer) {
      this._thumbCanvas = document.createElement("canvas");
      this._thumbRenderer = new THREE.WebGLRenderer({
        canvas: this._thumbCanvas, antialias: false, alpha: false, preserveDrawingBuffer: true,
      });
      this._thumbRenderer.setPixelRatio(1);
    }
    this._thumbRenderer.setSize(w, h, false);
    const prevRes = this.uniforms.uResolution.value.clone();
    this.uniforms.uResolution.value.set(w, h);
    this._thumbRenderer.render(this.scene, this.camera);
    this.uniforms.uResolution.value.copy(prevRes);
    return this._thumbCanvas.toDataURL("image/jpeg", 0.78);
  }
}

// === END PORTABLE SHADER MODULE ==============================
