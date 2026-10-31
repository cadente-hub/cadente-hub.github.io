// Draws js/sky/story.mjs with WebGL2: every star, trail and line is an instanced quad with an additive glow. The loop
// runs only while something moves: it stops once the sky settles, when the hero leaves the screen and while the tab
// is hidden, and its clock pauses with it. Pixel density is capped at 1.5.
import { starfield, slots, frame } from './story.mjs';

const QUAD = 'const vec2 Q[6] = vec2[](vec2(-1,-1), vec2(1,-1), vec2(-1,1), vec2(-1,1), vec2(1,-1), vec2(1,1));';
const GLOW_VS = `#version 300 es
layout(location=0) in vec2 a_pos; layout(location=1) in float a_size; layout(location=2) in vec4 a_color;
uniform vec2 u_res; out vec2 v_uv; out vec4 v_color; ${QUAD}
void main() { vec2 c = Q[gl_VertexID]; v_uv = c; v_color = a_color; vec2 p = a_pos + c * a_size * 4.0;
  gl_Position = vec4(p / u_res * 2.0 - 1.0, 0.0, 1.0); gl_Position.y = -gl_Position.y; }`;
const GLOW_FS = `#version 300 es
precision mediump float; in vec2 v_uv; in vec4 v_color; out vec4 o;
void main() { float d = dot(v_uv, v_uv); float g = exp(-d * 40.0) + exp(-d * 5.0) * 0.3; o = vec4(v_color.rgb * v_color.a, v_color.a) * g; }`;
const SEG_VS = `#version 300 es
layout(location=0) in vec2 a_a; layout(location=1) in vec2 a_b; layout(location=2) in float a_w; layout(location=3) in vec4 a_color;
uniform vec2 u_res; out float v_y; out vec4 v_color; ${QUAD}
void main() { vec2 c = Q[gl_VertexID]; vec2 d = a_b - a_a; vec2 dir = length(d) > 0.001 ? normalize(d) : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x); vec2 p = mix(a_a, a_b, c.x * 0.5 + 0.5) + n * c.y * (a_w + 1.5);
  v_y = c.y; v_color = a_color; gl_Position = vec4(p / u_res * 2.0 - 1.0, 0.0, 1.0); gl_Position.y = -gl_Position.y; }`;
const SEG_FS = `#version 300 es
precision mediump float; in float v_y; in vec4 v_color; out vec4 o;
void main() { float e = 1.0 - smoothstep(0.35, 1.0, abs(v_y)); o = vec4(v_color.rgb * v_color.a, v_color.a) * e; }`;
const HUES = [[0.84, 0.87, 1], [0.95, 0.86, 1], [0.7, 0.5, 1]];

function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
// A VAO whose instance attributes are laid out as `sizes` floats, in one buffer.
function instanced(gl, sizes) {
  const vao = gl.createVertexArray(), buf = gl.createBuffer(), stride = sizes.reduce((a, b) => a + b, 0);
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  let off = 0;
  sizes.forEach((n, i) => { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, stride * 4, off * 4); gl.vertexAttribDivisor(i, 1); off += n; });
  gl.bindVertexArray(null);
  return { vao, buf, stride };
}

// Returns null where WebGL2 is not available, so the caller draws the static sky instead.
export function createSky(canvas, { words, labels: labelHost, narrow = false, onSettle = () => {} }) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const glowP = program(gl, GLOW_VS, GLOW_FS), segP = program(gl, SEG_VS, SEG_FS);
  const glowV = instanced(gl, [2, 1, 4]), segV = instanced(gl, [2, 2, 1, 4]);
  const uGlow = gl.getUniformLocation(glowP, 'u_res'), uSeg = gl.getUniformLocation(segP, 'u_res');
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);

  const model = { field: starfield(7, narrow ? 70 : 140), targets: slots(words.length, { narrow }), drops: [], hub: null };
  const tags = words.map((w, i) => {
    const s = document.createElement('span');
    s.className = 'sky__label';
    s.textContent = w;
    Object.assign(s.style, { left: `${model.targets[i].x * 100}%`, top: `${model.targets[i].y * 100}%` });
    labelHost?.append(s);
    return s;
  });

  let W = 1, H = 1, dpr = 1;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(1.5, devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H;
    request();
  };
  // A clock that stops while nobody sees the sky.
  let paused = 0, pausedAt = null, raf = 0, visible = true, settled = false, done = false;
  const now = () => (pausedAt ?? performance.now()) - paused;
  const running = () => visible && !document.hidden;
  const syncClock = () => {
    if (running() && pausedAt !== null) { paused += performance.now() - pausedAt; pausedAt = null; request(); }
    else if (!running() && pausedAt === null) pausedAt = performance.now();
  };
  function request() { if (!raf && running()) raf = requestAnimationFrame(draw); }
  const glowData = new Float32Array(7 * 400), segData = new Float32Array(9 * 600);
  function draw() {
    raf = 0;
    const f = frame(model, now());
    gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const s = dpr * (narrow ? 0.85 : 1);
    let n = 0;
    for (const g of f.glows) { if (n >= 400) break; const c = HUES[g.hue], o = n * 7; glowData.set([g.x * W, g.y * H, g.size * s, c[0], c[1], c[2], g.alpha], o); n++; }
    gl.useProgram(glowP); gl.uniform2f(uGlow, W, H); gl.bindVertexArray(glowV.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, glowV.buf); gl.bufferData(gl.ARRAY_BUFFER, glowData.subarray(0, n * 7), gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
    let m = 0;
    for (const g of f.segments) { if (m >= 600) break; const c = HUES[g.hue], o = m * 9; segData.set([g.a.x * W, g.a.y * H, g.b.x * W, g.b.y * H, g.width * s, c[0], c[1], c[2], g.alpha], o); m++; }
    gl.useProgram(segP); gl.uniform2f(uSeg, W, H); gl.bindVertexArray(segV.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, segV.buf); gl.bufferData(gl.ARRAY_BUFFER, segData.subarray(0, m * 9), gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, m);
    gl.bindVertexArray(null);
    f.labels.forEach((a, i) => { if (tags[i]) tags[i].style.opacity = a.toFixed(3); });
    if (f.moving) request();
    else if (!settled) { settled = true; onSettle(); }
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; syncClock(); }, { threshold: 0 }); io.observe(canvas);
  document.addEventListener('visibilitychange', syncClock);
  const norm = rect => { const b = canvas.getBoundingClientRect(); return { x: (rect.left + rect.width / 2 - b.left) / b.width, y: (rect.top + rect.height / 2 - b.top) / b.height }; };
  return {
    // A word of the title fell: its star starts from where the word was.
    drop(i, rect) { if (done) return; model.drops[i] = { at: now(), from: norm(rect) }; settled = false; request(); },
    settle(rect) { model.hub = { at: now(), ...norm(rect) }; request(); },
    // How far the hero has scrolled away (0..1); redraws once for each change.
    pour(p) { const v = Math.round(Math.min(1, Math.max(0, p)) * 500) / 500; if (v !== model.pour) { model.pour = v; request(); } },
    get moving() { return !!raf; },
    model,
    destroy() { done = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', syncClock); tags.forEach(t => t.remove()); },
  };
}
