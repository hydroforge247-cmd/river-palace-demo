/* River Palace hero: the photo stays still, only the river moves.
   WebGL draws hero.webp (day) / sunset.webp (night) with object-fit:cover maths and ripples
   only where img/mask-day.png / mask-night.png are white (water; boats, jetty and people are masked out);
   trees sway gently where img/tree-day.png / tree-night.png are light.
   Falls back to the plain <img> photos when WebGL is off. */
(() => {
  const hero = document.querySelector(".hero"), cv = document.getElementById("heroWater");
  if (!hero || !cv) return;
  const pace = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.35 : 1;   // reduced motion: same gentle river, slower
  const gl = cv.getContext("webgl", { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!gl) return;

  const vs = `attribute vec2 p; varying vec2 v; void main(){ v = p * .5 + .5; v.y = 1. - v.y; gl_Position = vec4(p, 0., 1.); }`;
  const fs = `precision mediump float;
  varying vec2 v; uniform sampler2D iD, iN, mD, mN, tD, tN; uniform vec2 cs, sD, sN; uniform float t, night, amp;
  vec2 cover(vec2 img, vec2 pos) { float s = max(cs.x / img.x, cs.y / img.y); vec2 vis = cs / s; return ((img - vis) * pos + v * vis) / img; }
  vec3 scene(sampler2D im, sampler2D mk, sampler2D tk, vec2 uv, float day) {
    float m = texture2D(mk, uv).r, tr = texture2D(tk, uv).r;
    // ripples: bands that get finer towards the far bank, drifting slowly downstream
    float k = 160. + 260. * (1. - uv.y);
    float w = sin(uv.y * k - t * 1.3 + sin(uv.x * 23. + t * .4) * 1.6) * .6 + sin(uv.y * k * .63 + uv.x * 31. - t * .9) * .4;
    // by day a second, crossing chop breaks up the bands, like wind on open water in sun
    float w2 = sin((uv.y + uv.x * .55) * k * .8 + t * 1.1) * .5 + sin((uv.y - uv.x * .4) * k * 1.3 - t * 1.7) * .5;
    vec2 d = (vec2(w * .0016, w * .0011) * (1. + day * .5) + vec2(w2 * .0011, w2 * .0013) * day) * m * (.35 + uv.y) * amp;
    // trees: a slow sway with gentle gusts; the mask is strongest on hanging willow fronds, weakest on trunks
    float gust = .6 + .4 * sin(t * .31) * sin(t * .17 + 1.);
    float sw = sin(t * 1.1 + uv.y * 14. + uv.x * 5.) * .6 + sin(t * 2.3 + uv.y * 37. + uv.x * 11.) * .4;
    d += vec2(sw * .0024 * gust, sw * .0005) * tr * amp;
    vec3 c = texture2D(im, uv + d).rgb;
    float glint = pow(max(0., w), 14.) * m;   // light catching the ripple crests
    c += glint * (day > .5 ? vec3(.09, .085, .075) : vec3(.10, .07, .06));
    // sun sparkles: tiny points that twinkle on and off across the sunlit water
    vec2 cell = floor(uv * vec2(900., 700.));
    float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
    float tw = pow(max(0., sin(t * (0.8 + h * 1.5) + h * 60.)), 16.);
    c += step(.985, h) * tw * m * day * vec3(.38, .37, .34);   // few and soft (user, 26 Nov: the first version was too loud)
    return c;
  }
  void main() {
    vec3 a = scene(iD, mD, tD, cover(sD, vec2(.5, .4)), 1.);
    vec3 b = scene(iN, mN, tN, cover(sN, vec2(.6, .5)), 0.);
    gl_FragColor = vec4(mix(a, b, night), 1.);
  }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram();
  try { gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); } catch (e) { console.warn("hero water off:", e.message); return; }
  gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const ap = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n);

  const srcs = { iD: "img/hero.webp", iN: "img/sunset.webp", mD: "img/mask-day.png", mN: "img/mask-night.png", tD: "img/tree-day.png", tN: "img/tree-night.png" }, sizes = {}, N_TEX = 6;
  let ready = 0;
  Object.entries(srcs).forEach(([name, src], unit) => {
    const im = new Image();
    im.onload = () => {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
      for (const [p, val] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, val);
      gl.uniform1i(U(name), unit); sizes[name] = [im.naturalWidth, im.naturalHeight];
      if (++ready === N_TEX) { gl.uniform2f(U("sD"), ...sizes.iD); gl.uniform2f(U("sN"), ...sizes.iN); resize(); frame(performance.now()); cv.classList.add("on"); }
    };
    im.src = src;
  });

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr);
    gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(U("cs"), cv.width, cv.height);
    gl.uniform1f(U("amp"), cv.clientWidth < cv.clientHeight ? 1.7 : 1);   // portrait phones show a thin strip of river: more movement so it reads as alive
  }
  new ResizeObserver(() => ready === N_TEX && (resize(), draw(performance.now()))).observe(cv);
  const draw = now => {
    gl.uniform1f(U("t"), now / 1000 * pace);
    gl.uniform1f(U("night"), document.documentElement.dataset.theme === "night" ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  // redraw at once on a theme switch, so the circular reveal captures the new scene
  addEventListener("themechange", () => ready === N_TEX && draw(performance.now()));

  let vis = true, raf = 0;
  function frame(now) { raf = 0; if (!vis) return; draw(now); raf = requestAnimationFrame(frame); }
  new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis && ready === N_TEX && !raf) raf = requestAnimationFrame(frame); }).observe(hero);
})();
