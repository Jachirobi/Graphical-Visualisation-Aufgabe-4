/**
 * Aufgabe 4 – Parametrisierte Flächen
 *
 * Drei Flächen werden algorithmisch aus ihrer Parametrisierung (u, v) → (x, y, z) erzeugt:
 *   1. Regenschirm  – Umbrella Surface, 3d-meier.de Gl. 208-1 … 208-4
 *   2. Schnecke II  – 3d-meier.de Gl. 228-1 … 228-3
 *   3. Rennradreifen mit Profil – eigene Parametrisierung
 * Jede Fläche gibt es als Linien (u- und v-Linien) und als gefüllte, kolorierte Dreiecke.
 * Ohne Kamera: Alle Punkte werden so skaliert, dass sie im NDC-Würfel [-1, 1]³ liegen.
 */
(() => {
  "use strict";

  // Mathe-Helfer
  const PI = Math.PI, TAU = 2 * PI;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

  function hsl(h, s, l) {
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)];
  }
  const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

  // Farben aus Aufgabe 3 (Kolorierung der Rennrad-Skizze)
  const C = {
    reifen: hexToRgb("#2f3337"), profil: hexToRgb("#4a5056"), felge: hexToRgb("#4e86d0"),
    gruen: hexToRgb("#98ce3b"), metall: hexToRgb("#a7adb4"), holz: hexToRgb("#8a5a35"), stock: hexToRgb("#3a3f46"),
  };

  // Flächen
  // Jede Fläche: f(u, v, p) → [x, y, z]  (z = Hochachse), Wertebereiche, Auflösung, Farbe.
  // color(s, t, sc, tc, p): s, t = normierte Parameter der Ecke (0..1), sc, tc = Mitte des Vierecks.

  const SURFACES = [
    {
      id: "schirm",
      name: "Regenschirm",
      subtitle: "Umbrella Surface",
      params: [
        { key: "n", label: "Speichen n", min: 3, max: 14, step: 1, value: 8 },
        { key: "h", label: "Höhe h", min: 0.2, max: 1.2, step: 0.05, value: 0.6 },
        { key: "R", label: "Radius R", min: 0.6, max: 1.4, step: 0.05, value: 1 },
      ],
      parts: (p) => [
        {
          name: "Schirmdach",
          // Gl. 208-1 … 208-4: Rand ist eine Hypozykloide mit n Spitzen (r = R/n)
          f: (u, v) => {
            const r = p.R / p.n, k = Math.cbrt(u);
            return [k * ((p.R - r) * Math.cos(v) + r * Math.cos((p.n - 1) * v)),
                    k * ((p.R - r) * Math.sin(v) - r * Math.sin((p.n - 1) * v)),
                    p.h * (1 - u)];
          },
          u: [0, 1], v: [0, TAU], nU: 28, nV: p.n * 18, lines: [12, p.n * 3],
          // Jede Bahn zwischen zwei Speichen bekommt einen eigenen Farbton (Regenbogen),
          // zur Spitze heller, an den Nähten dunkler – wie gespannter Stoff.
          color: (s, t, sc, tc) => {
            const panel = Math.floor(tc * p.n) % p.n;
            const inPanel = t * p.n - Math.floor(tc * p.n);              // 0..1 innerhalb der Bahn
            const seam = 1 - 0.22 * Math.pow(Math.abs(inPanel - 0.5) * 2, 3);
            const c = hsl((panel / p.n) * 360 + 12, 0.72, 0.36 + 0.24 * (1 - s));
            return c.map((x) => x * seam);
          },
        },
        {
          name: "Stock",                                                  // Zylinder (Ergänzung)
          f: (u, v) => [0.022 * Math.cos(v), 0.022 * Math.sin(v), p.h + 0.08 - u * (p.h + 0.08 + 0.75)],
          u: [0, 1], v: [0, TAU], nU: 12, nV: 12, lines: [4, 4],
          color: (s) => mix(C.stock, C.metall, 0.25 * (1 - s)),
        },
        {
          name: "Griff",                                                  // halber Torus (Ergänzung)
          f: (u, v) => {
            const R = 0.11, r = 0.03;
            return [(R + r * Math.cos(v)) * Math.cos(u) - R, r * Math.sin(v), -0.75 + (R + r * Math.cos(v)) * Math.sin(u)];
          },
          u: [PI, TAU], v: [0, TAU], nU: 18, nV: 12, lines: [6, 4],
          color: (s, t) => mix(C.holz, [0.95, 0.8, 0.6], 0.15 + 0.15 * Math.sin(t * TAU)),
        },
      ],
      formula: "schirm",
    },
    {
      id: "schnecke",
      name: "Schneckengehäuse",
      subtitle: "Schnecke II",
      params: [
        { key: "a", label: "Wachstum a", min: 1.05, max: 1.3, step: 0.01, value: 1.16 },
        { key: "turns", label: "Windungen (v-Bereich)", min: 1, max: 3, step: 0.25, value: 2 },
      ],
      parts: (p) => [
        {
          name: "Gehäuse",
          // Gl. 228-1 … 228-3
          f: (u, v) => {
            const g = Math.pow(p.a, v), s = Math.sin(u);
            return [g * s * s * Math.sin(v), g * s * s * Math.cos(v), g * s * Math.cos(u)];
          },
          u: [0, PI], v: [-p.turns * PI, p.turns * PI], nU: 40, nV: Math.round(p.turns * 110), lines: [10, Math.round(p.turns * 24)],
          // Färbung entlang des Wachstums: Spitze cremefarben, Öffnung karamell-braun,
          // dazu dunkle Spiralbänder (feste u-Werte) und feine Anwachsstreifen (v).
          color: (s, t) => {
            const base = mix([0.97, 0.9, 0.76], [0.72, 0.4, 0.2], smooth(0.1, 1, t));
            const band = 1 - 0.38 * smooth(0.55, 0.9, Math.cos((s - 0.33) * TAU * 1.5));
            const growth = 1 - 0.1 * smooth(0.6, 1, Math.sin(t * TAU * 14 * p.turns));
            const pearl = mix([1, 0.86, 0.82], [1, 1, 1], 0.5);
            const inside = smooth(0.82, 1, s);                          // Lippe der Öffnung
            return mix(base.map((x) => x * band * growth), pearl, inside * 0.7);
          },
        },
      ],
      formula: "schnecke",
    },
    {
      id: "reifen",
      name: "Rennradreifen mit Profil",
      subtitle: "eigene Parametrisierung",
      own: true,
      params: [
        { key: "N", label: "Profilstollen N", min: 0, max: 90, step: 2, value: 48 },
        { key: "k", label: "Stollenhöhe k", min: 0, max: 0.3, step: 0.01, value: 0.14 },
        { key: "q", label: "Abflachung q", min: 0.4, max: 1, step: 0.05, value: 0.62 },
      ],
      parts: (p) => {
        const R = 0.78, rho = 0.16;
        // Eigene Formel: Torus mit elliptischem Querschnitt; der Radius ρ wächst nur auf der Lauffläche
        // (cos v > 0) mit sin(N·u) → Profilstollen. Die Achse des Rades liegt in y.
        const rr = (u, v) => rho * (1 + p.k * Math.pow(Math.max(0, Math.cos(v)), 6) * Math.max(0, Math.sin(p.N * u)));
        const parts = [{
          name: "Reifen",
          f: (u, v) => {
            const r = rr(u, v);
            return [(R + r * Math.cos(v)) * Math.cos(u), p.q * r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)];
          },
          u: [0, TAU], v: [0, TAU], nU: Math.min(440, Math.max(96, p.N * 5)), nV: 36, lines: [Math.max(24, p.N), 8],
          color: (s, t, sc, tc) => {
            const u = s * TAU, v = t * TAU;
            const knob = Math.pow(Math.max(0, Math.cos(v)), 6) * Math.max(0, Math.sin(p.N * u));
            const stripe = smooth(0.08, 0.02, Math.abs(Math.abs(Math.sin(v)) - 0.82));   // Zierstreifen an der Flanke
            return mix(mix(C.reifen, C.profil, knob * 1.4), C.felge, stripe * 0.9);
          },
        }, {
          name: "Felge",                                                 // Torus, abgeflacht (Ergänzung)
          f: (u, v) => {
            const Rf = R - rho - 0.05;
            return [(Rf + 0.06 * Math.cos(v)) * Math.cos(u), 0.045 * Math.sin(v), (Rf + 0.06 * Math.cos(v)) * Math.sin(u)];
          },
          u: [0, TAU], v: [0, TAU], nU: 96, nV: 16, lines: [24, 4],
          color: (s, t) => mix(C.felge, [1, 1, 1], 0.18 * Math.max(0, Math.sin(t * TAU))),
        }, {
          name: "Nabe",                                                  // Zylinder (Ergänzung)
          f: (u, v) => [0.07 * Math.cos(v), -0.09 + 0.18 * u, 0.07 * Math.sin(v)],
          u: [0, 1], v: [0, TAU], nU: 4, nV: 24, lines: [3, 6],
          color: () => C.gruen,
        }];
        for (let k = 0; k < 24; k++) {                                   // 24 Speichen, gekreuzt
          const side = k % 2 ? 1 : -1, a0 = (k / 24) * TAU, a1 = a0 + side * 0.42;
          const Rf = R - rho - 0.1;
          parts.push({
            name: `Speiche ${k + 1}`,
            f: (u, v) => {
              const ax = 0.06 * Math.cos(a0), az = 0.06 * Math.sin(a0), bx = Rf * Math.cos(a1), bz = Rf * Math.sin(a1);
              const ay = side * 0.06;
              return [ax + (bx - ax) * u + 0.005 * Math.cos(v), ay * (1 - u) + 0.005 * Math.sin(v), az + (bz - az) * u];
            },
            u: [0, 1], v: [0, TAU], nU: 2, nV: 6, lines: [1, 1], spoke: true,
            color: () => C.metall,
          });
        }
        return parts;
      },
      formula: "reifen",
    },
  ];

  // Generator
  /** Erzeugt für eine Teilfläche Füllung (Dreiecke) und Gitterlinien. */
  function generate(part) {
    const { f, u: [u0, u1], v: [v0, v1], nU, nV } = part;
    const du = u1 - u0, dv = v1 - v0;
    const P = (s, t) => { const p = f(u0 + s * du, v0 + t * dv); return [p[0], p[2], -p[1]]; };   // z nach oben
    const eps = 1e-4;
    function normal(s, t) {
      const a = sub3(P(Math.min(1, s + eps), t), P(Math.max(0, s - eps), t));
      const b = sub3(P(s, Math.min(1, t + eps)), P(s, Math.max(0, t - eps)));
      const n = cross(a, b), l = len3(n);
      return l > 1e-12 ? n.map((x) => x / l) : [0, 1, 0];
    }

    // Füllung: je Viereck 4 eigene Ecken → harte Farbkanten möglich (Schirmbahnen)
    const pos = [], nor = [], col = [], idx = [];
    for (let i = 0; i < nU; i++) {
      for (let j = 0; j < nV; j++) {
        const sc = (i + 0.5) / nU, tc = (j + 0.5) / nV, base = pos.length / 3;
        for (const [a, b] of [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]]) {
          const s = a / nU, t = b / nV;
          pos.push(...P(s, t));
          nor.push(...normal(s, t));
          col.push(...part.color(s, t, sc, tc));
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }

    // Linien: Lu Linien mit festem u (laufen in v) und Lv Linien mit festem v (laufen in u)
    const [Lu, Lv] = part.lines;
    const lpos = [], lcol = [], lidx = [];
    const curve = (fixed, isU, samples) => {
      const first = lpos.length / 3;
      for (let k = 0; k <= samples; k++) {
        const s = isU ? fixed : k / samples, t = isU ? k / samples : fixed;
        lpos.push(...P(s, t));
        lcol.push(...part.color(s, t, s, t));
        if (k > 0) lidx.push(first + k - 1, first + k);
      }
    };
    for (let k = 0; k <= Lu; k++) curve(k / Lu, true, Math.max(nV, 8));
    for (let k = 0; k <= Lv; k++) curve(k / Lv, false, Math.max(nU, 8));

    const nVert = pos.length / 3;
    if (nVert > 65535 || lpos.length / 3 > 65535) throw new Error(`${part.name}: zu viele Vertices für UNSIGNED_SHORT`);
    return { name: part.name, pos, nor, col, idx, lpos, lcol, lidx };
  }

  /** Bounding-Box aller Teile → Mittelpunkt und Skalierung c, damit alles in [-1, 1]³ liegt */
  function fitToNDC(meshes) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    meshes.forEach((m) => { for (let i = 0; i < m.pos.length; i += 3) for (let d = 0; d < 3; d++) {
      lo[d] = Math.min(lo[d], m.pos[i + d]); hi[d] = Math.max(hi[d], m.pos[i + d]);
    } });
    const center = lo.map((v, d) => (v + hi[d]) / 2);
    let rMax = 0;                                       // größter Abstand zum Mittelpunkt → drehsicher
    meshes.forEach((m) => { for (let i = 0; i < m.pos.length; i += 3) rMax = Math.max(rMax, Math.hypot(m.pos[i] - center[0], m.pos[i + 1] - center[1], m.pos[i + 2] - center[2])); });
    return { center, c: 0.92 / rMax, lo, hi, rMax };
  }

  // WebGL
  const $ = (id) => document.getElementById(id);
  const canvas = $("gl");
  const status = $("status");
  const setStatus = (t, err = false) => { status.textContent = t; status.classList.toggle("is-error", err); };

  const VS = `
    attribute vec3 aPos;
    attribute vec3 aNormal;
    attribute vec3 aColor;
    uniform mat3 uRot;          // Drehung des Objekts (keine Kamera)
    uniform vec3 uCenter;
    uniform float uScale;       // c mit 0 < c < 1: bringt alle Punkte in den NDC-Würfel
    varying vec3 vColor;
    varying vec3 vNormal;
    void main() {
      vec3 p = uRot * ((aPos - uCenter) * uScale);
      gl_Position = vec4(p.xy, -p.z, 1.0);   // NDC: z = -1 vorne, +1 hinten
      vNormal = uRot * aNormal;
      vColor = aColor;
    }`;
  const FS = `
    precision mediump float;
    varying vec3 vColor;
    varying vec3 vNormal;
    uniform float uLit;         // 1 = Fläche schattieren, 0 = Linien unbeleuchtet
    uniform vec4 uTint;         // Linien über der Füllung: feste Farbe
    void main() {
      vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
      float d = abs(dot(normalize(vNormal), L));       // beidseitig beleuchtet (offene Flächen)
      vec3 lit = vColor * (0.34 + 0.66 * d) + vec3(0.22) * pow(d, 28.0);
      vec3 c = mix(vColor, lit, uLit);
      gl_FragColor = vec4(mix(c, uTint.rgb, uTint.a), 1.0);
    }`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`Shader-Fehler: ${gl.getShaderInfoLog(sh)}`);
    return sh;
  }

  let gl, loc, current = 0, mode = "beides", objects = [], view = { yaw: -32, pitch: 22 };
  const state = SURFACES.map((s) => Object.fromEntries(s.params.map((q) => [q.key, q.value])));

  function init() {
    gl = canvas.getContext("webgl", { antialias: true });
    if (!gl) throw new Error("Ihr Browser unterstützt kein WebGL. Bitte aktivieren Sie die Hardwarebeschleunigung.");
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`Programm-Fehler: ${gl.getProgramInfoLog(prog)}`);
    gl.useProgram(prog);
    loc = {
      pos: gl.getAttribLocation(prog, "aPos"), nor: gl.getAttribLocation(prog, "aNormal"), col: gl.getAttribLocation(prog, "aColor"),
      rot: gl.getUniformLocation(prog, "uRot"), center: gl.getUniformLocation(prog, "uCenter"),
      scale: gl.getUniformLocation(prog, "uScale"), lit: gl.getUniformLocation(prog, "uLit"), tint: gl.getUniformLocation(prog, "uTint"),
    };
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
  }

  function makeBuffer(target, data) {
    const b = gl.createBuffer();
    gl.bindBuffer(target, b);
    gl.bufferData(target, data, gl.STATIC_DRAW);
    return b;
  }

  /** Fläche neu erzeugen (beim Start, beim Wechsel und wenn ein Parameter geändert wird) */
  function build(index) {
    objects.forEach((o) => o.buffers.forEach((b) => gl.deleteBuffer(b)));
    const surf = SURFACES[index], p = state[index];
    const meshes = surf.parts(p).map(generate);
    const fit = fitToNDC(meshes);
    objects = meshes.map((m) => {
      const o = {
        name: m.name,
        pos: makeBuffer(gl.ARRAY_BUFFER, new Float32Array(m.pos)),
        nor: makeBuffer(gl.ARRAY_BUFFER, new Float32Array(m.nor)),
        col: makeBuffer(gl.ARRAY_BUFFER, new Float32Array(m.col)),
        idx: makeBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(m.idx)),
        lpos: makeBuffer(gl.ARRAY_BUFFER, new Float32Array(m.lpos)),
        lcol: makeBuffer(gl.ARRAY_BUFFER, new Float32Array(m.lcol)),
        lidx: makeBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(m.lidx)),
        nIdx: m.idx.length, nLidx: m.lidx.length, nVert: m.pos.length / 3, nLvert: m.lpos.length / 3,
      };
      o.buffers = [o.pos, o.nor, o.col, o.idx, o.lpos, o.lcol, o.lidx];
      return o;
    });
    objects.fit = fit;
    renderStats(fit);
  }

  function rotation() {
    const y = (view.yaw * PI) / 180, x = (view.pitch * PI) / 180;
    const cy = Math.cos(y), sy = Math.sin(y), cx = Math.cos(x), sx = Math.sin(x);
    // R = Rx(pitch) · Ry(yaw), spaltenweise für WebGL
    return new Float32Array([cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy]);
  }

  function bindAttr(buffer, location, size) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  }

  function draw() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--gl-bg").trim();
    const [r, g, b] = /^#[0-9a-f]{6}$/i.test(bg) ? hexToRgb(bg) : [1, 1, 1];
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniformMatrix3fv(loc.rot, false, rotation());
    gl.uniform3fv(loc.center, objects.fit.center);
    gl.uniform1f(loc.scale, objects.fit.c);
    const dark = document.documentElement.getAttribute("data-theme") === "dark";

    if (mode !== "linien") {                     // Füllung: ein drawElements je Teilfläche
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1, 1);                    // Linien liegen danach sichtbar obenauf
      gl.uniform1f(loc.lit, 1);
      gl.uniform4f(loc.tint, 0, 0, 0, 0);
      objects.forEach((o) => {
        bindAttr(o.pos, loc.pos, 3); bindAttr(o.nor, loc.nor, 3); bindAttr(o.col, loc.col, 3);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.idx);
        gl.drawElements(gl.TRIANGLES, o.nIdx, gl.UNSIGNED_SHORT, 0);
      });
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    if (mode !== "fuellung") {                   // Linien: u- und v-Linien der Parametrisierung
      gl.uniform1f(loc.lit, 0);
      if (mode === "beides") gl.uniform4fv(loc.tint, dark ? [0.92, 0.94, 0.97, 0.55] : [0.06, 0.08, 0.12, 0.6]);
      else gl.uniform4f(loc.tint, 0, 0, 0, 0);
      gl.disableVertexAttribArray(loc.nor);
      gl.vertexAttrib3f(loc.nor, 0, 1, 0);
      objects.forEach((o) => {
        bindAttr(o.lpos, loc.pos, 3); bindAttr(o.lcol, loc.col, 3);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.lidx);
        gl.drawElements(gl.LINES, o.nLidx, gl.UNSIGNED_SHORT, 0);
      });
    }
    const err = gl.getError();
    if (err !== gl.NO_ERROR) console.error(`WebGL-Fehler 0x${err.toString(16)}`);
  }

  // Oberfläche
  const fmt = (v, d = 0) => v.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });

  function renderStats(fit) {
    const v = objects.reduce((s, o) => s + o.nVert, 0), t = objects.reduce((s, o) => s + o.nIdx / 3, 0);
    const l = objects.reduce((s, o) => s + o.nLidx / 2, 0);
    $("stat-vertices").textContent = fmt(v);
    $("stat-triangles").textContent = fmt(t);
    $("stat-lines").textContent = fmt(l);
    $("stat-calls").textContent = fmt(objects.length);
    $("stat-scale").textContent = fmt(fit.c, 3);
    $("ndc-range").textContent =
      `Bereich der Fläche: x ${fmt(fit.lo[0], 2)} … ${fmt(fit.hi[0], 2)}, y ${fmt(fit.lo[1], 2)} … ${fmt(fit.hi[1], 2)}, ` +
      `z ${fmt(fit.lo[2], 2)} … ${fmt(fit.hi[2], 2)}; größter Abstand zur Mitte ${fmt(fit.rMax, 2)} → c = 0,92 / ${fmt(fit.rMax, 2)} = ${fmt(fit.c, 3)}.`;
  }

  function renderSelection() {
    const s = SURFACES[current];
    $("surface-name").textContent = s.name;
    $("surface-sub").textContent = s.own ? "eigene Parametrisierung" : `${s.subtitle}, 3d-meier.de`;
    document.querySelectorAll("[data-surface]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.surface === s.id)));
    document.querySelectorAll(".formula-card").forEach((c) => c.classList.toggle("is-current", c.id === `card-${s.id}`));
    $("canvas-desc").textContent = {
      schirm: "Regenschirm: Schirmdach mit n Bahnen in Regenbogenfarben, Rand als Hypozykloide mit n Spitzen, dazu Stock und gebogener Holzgriff.",
      schnecke: "Schneckengehäuse: spiralförmig wachsende Windungen, an der Spitze cremefarben, zur Öffnung karamellbraun, mit dunklen Spiralbändern.",
      reifen: "Rennradreifen: schwarzer Reifen mit Profilstollen auf der Lauffläche und blauem Zierstreifen, blaue Felge, grüne Nabe und 24 Speichen.",
    }[s.id];
    // Schieber für die Konstanten dieser Fläche
    const box = $("params");
    box.textContent = "";
    s.params.forEach((q) => {
      const id = `p-${s.id}-${q.key}`;
      const row = document.createElement("div");
      row.className = "speed";
      const dec = (String(q.step).split(".")[1] || "").length;
      row.innerHTML = `<label for="${id}">${q.label}</label>` +
        `<input type="range" id="${id}" min="${q.min}" max="${q.max}" step="${q.step}" value="${state[current][q.key]}">` +
        `<output for="${id}">${fmt(state[current][q.key], dec)}</output>`;
      const input = row.querySelector("input"), out = row.querySelector("output");
      input.setAttribute("aria-valuetext", fmt(state[current][q.key], dec));
      input.addEventListener("input", () => {
        state[current][q.key] = Number(input.value);
        out.textContent = fmt(Number(input.value), dec);
        input.setAttribute("aria-valuetext", out.textContent);
        scheduleRebuild();
      });
      box.appendChild(row);
    });
  }

  let pending = false;
  function scheduleRebuild() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      try { build(current); draw(); } catch (e) { console.error(e); setStatus(e.message, true); }
    });
  }

  function selectSurface(i, announce = true) {
    current = (i + SURFACES.length) % SURFACES.length;
    build(current);
    renderSelection();
    draw();
    if (announce) setStatus(`${SURFACES[current].name} (${current + 1} von ${SURFACES.length}).`);
  }

  const MODES = ["linien", "fuellung", "beides"];
  const MODE_LABEL = { linien: "Linien", fuellung: "Füllung", beides: "Linien und Füllung" };
  function setMode(m) {
    mode = m;
    document.querySelectorAll("[data-mode]").forEach((b) => {
      const on = b.dataset.mode === m;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    draw();
    setStatus(`Darstellung: ${MODE_LABEL[m]}.`);
  }

  // Eingaben
  $("btn-next").addEventListener("click", () => selectSurface(current + 1));
  document.querySelectorAll("[data-surface]").forEach((b) =>
    b.addEventListener("click", () => selectSurface(SURFACES.findIndex((s) => s.id === b.dataset.surface))));
  document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  document.querySelector("[role=radiogroup]").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const d = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
    const next = MODES[(MODES.indexOf(mode) + d + MODES.length) % MODES.length];
    setMode(next);
    document.querySelector(`[data-mode="${next}"]`).focus();
  });
  $("btn-reset").addEventListener("click", () => { view = { yaw: -32, pitch: 22 }; draw(); setStatus("Ansicht zurückgesetzt."); });

  // Drehen mit Maus / Finger
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    view.yaw += (e.clientX - drag.x) * 0.5;
    view.pitch = clamp(view.pitch + (e.clientY - drag.y) * 0.5, -89, 89);
    drag = { x: e.clientX, y: e.clientY };
    draw();
  });
  ["pointerup", "pointercancel"].forEach((t) => canvas.addEventListener(t, () => (drag = null)));
  // Drehen mit Pfeiltasten, wenn die Zeichnung den Fokus hat
  canvas.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 15 : 5;
    const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!map[e.key]) return;
    e.preventDefault();
    view.yaw += map[e.key][0];
    view.pitch = clamp(view.pitch + map[e.key][1], -89, 89);
    draw();
  });

  // Automatisch drehen (startet nie von selbst)
  let spinId = null, last = null;
  function spin(now) {
    if (last !== null) view.yaw += (now - last) * 0.02;
    last = now;
    draw();
    spinId = requestAnimationFrame(spin);
  }
  $("toggle-spin").addEventListener("change", (e) => {
    if (e.target.checked) { last = null; spinId = requestAnimationFrame(spin); setStatus("Fläche dreht sich."); }
    else { cancelAnimationFrame(spinId); spinId = null; setStatus("Drehung angehalten."); }
  });

  // Tastenkürzel B und L (abschaltbar, WCAG 2.1.4)
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* privater Modus */ } },
  };
  const shortcuts = $("toggle-shortcuts");
  shortcuts.checked = store.get("shortcuts") !== "off";
  shortcuts.addEventListener("change", () => {
    store.set("shortcuts", shortcuts.checked ? "on" : "off");
    document.body.classList.toggle("shortcuts-off", !shortcuts.checked);
    setStatus(shortcuts.checked ? "Tastenkürzel B und L eingeschaltet." : "Tastenkürzel ausgeschaltet.");
  });
  document.body.classList.toggle("shortcuts-off", !shortcuts.checked);
  document.addEventListener("keydown", (e) => {
    if (!shortcuts.checked || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (e.target.closest("input[type=text], textarea")) return;
    const k = e.key.toLowerCase();
    if (k === "b") { e.preventDefault(); selectSurface(current + 1); }
    if (k === "l") { e.preventDefault(); setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]); }
  });

  // Design hell / dunkel
  const themeSwitch = $("theme-switch");
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    themeSwitch.setAttribute("aria-checked", String(t === "dark"));
    if (gl && objects.length) draw();
  }
  themeSwitch.addEventListener("click", () => {
    const next = themeSwitch.getAttribute("aria-checked") === "true" ? "light" : "dark";
    applyTheme(next);
    store.set("theme", next);
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!store.get("theme")) applyTheme(e.matches ? "dark" : "light");
  });

  // Start
  applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  try {
    init();
    selectSurface(0, false);
    setMode("beides");
    setStatus("");
    new ResizeObserver(() => draw()).observe(canvas);
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); setStatus("WebGL-Kontext verloren – bitte Seite neu laden.", true); });
    console.info(`Parametrisierte Flächen bereit: ${SURFACES.map((s) => s.name).join(", ")}.`);
  } catch (err) {
    console.error(err);
    setStatus(err.message, true);
  }
})();
