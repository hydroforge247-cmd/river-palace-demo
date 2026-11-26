/* River Palace: the whole page sits on water.
   A small height-field wave simulation (CPU) drives a WebGL surface with caustics, refraction and a soft highlight.
   Pointer = ripples. Scroll = the water flows past a fixed point, which draws a gentle wake like a boat. */
(() => {
  const c = document.getElementById("water");
  if (!c) return;
  const gl = c.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: "low-power" });
  if (!gl) { c.remove(); return; }
  const root = document.documentElement;

  const VS = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
  const FS = `precision mediump float;
uniform sampler2D uH;uniform vec2 uRes;uniform float uT,uNight,uFlow;uniform vec2 uCell;
float caustic(vec2 p,float t){
  p=mod(p,6.2832)-250.;vec2 i=p;float c=1.;float k=.005;
  for(int n=0;n<4;n++){float tt=t*(1.-(3.5/float(n+1)));i=p+vec2(cos(tt-i.x)+sin(tt+i.y),sin(tt-i.y)+cos(tt+i.x));
  c+=1./length(vec2(p.x/(sin(i.x+tt)/k),p.y/(cos(i.y+tt)/k)));}
  c/=4.;c=1.17-pow(c,1.4);return clamp(pow(abs(c),8.),0.,1.);
}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float hL=texture2D(uH,uv-vec2(uCell.x,0.)).r,hR=texture2D(uH,uv+vec2(uCell.x,0.)).r;
  float hD=texture2D(uH,uv-vec2(0.,uCell.y)).r,hU=texture2D(uH,uv+vec2(0.,uCell.y)).r;
  vec3 n=normalize(vec3((hL-hR)*3.2,(hD-hU)*3.2,1.));
  vec2 q=vec2(uv.x*uRes.x/uRes.y,uv.y+uFlow)*3.2+n.xy*.9;
  float cs=caustic(q,uT*.35)*.6+caustic(q*1.7+3.1,uT*.27)*.4;
  vec3 dayA=vec3(.93,.925,.875),dayB=vec3(.80,.895,.885);
  vec3 nA=vec3(.039,.094,.133),nB=vec3(.05,.15,.2);
  vec3 base=mix(mix(dayA,dayB,.25+.45*uv.y),mix(nA,nB,.5+.4*uv.y),uNight);
  vec3 tint=mix(vec3(1.,1.,.97),vec3(.55,.9,.92),uNight);
  vec3 col=base+tint*cs*mix(.17,.24,uNight);
  vec3 L=normalize(vec3(-.4,.5,.75));
  float diff=dot(n,L)-L.z;
  float spec=pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),90.);
  col+=diff*mix(1.1,.8,uNight)+spec*mix(.45,.6,uNight)*vec3(1.,.97,.9);
  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  let prog;
  try { prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog); }
  catch (e) { c.remove(); return; }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const ap = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(prog, n);
  const uRes = U("uRes"), uT = U("uT"), uNight = U("uNight"), uFlow = U("uFlow"), uCell = U("uCell");
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  /* wave simulation */
  const CELL = 5;                                   // CSS px per simulation cell
  let SW = 0, SH = 0, cur, prev, bytes, rowShift = 0;
  function size() {
    const sc = Math.min(devicePixelRatio || 1, 1.25);
    c.width = Math.round(innerWidth * sc); c.height = Math.round(innerHeight * sc);
    gl.viewport(0, 0, c.width, c.height); gl.uniform2f(uRes, c.width, c.height);
    SW = Math.ceil(innerWidth / CELL) + 2; SH = Math.ceil(innerHeight / CELL) + 2;
    cur = new Float32Array(SW * SH); prev = new Float32Array(SW * SH); bytes = new Uint8Array(SW * SH);
    gl.uniform2f(uCell, 1 / SW, 1 / SH);
  }
  size(); addEventListener("resize", size);

  /* drop at CSS pixel (x, y): y measured from the top of the screen; the texture's row 0 is the bottom */
  function drop(x, y, r, s) {
    const cx = x / CELL, cy = (innerHeight - y) / CELL;
    for (let j = Math.max(1, Math.floor(cy - r)); j <= Math.min(SH - 2, Math.ceil(cy + r)); j++)
      for (let i = Math.max(1, Math.floor(cx - r)); i <= Math.min(SW - 2, Math.ceil(cx + r)); i++) {
        const d = Math.hypot(i - cx, j - cy) / r; if (d < 1) cur[j * SW + i] += s * (0.5 + 0.5 * Math.cos(d * Math.PI));
      }
  }
  function stepSim() {
    for (let j = 1; j < SH - 1; j++) {
      const o = j * SW;
      for (let i = 1; i < SW - 1; i++) {
        const k = o + i;
        prev[k] = ((cur[k - 1] + cur[k + 1] + cur[k - SW] + cur[k + SW]) * 0.5 - prev[k]) * 0.982;
      }
    }
    const t = cur; cur = prev; prev = t;
  }
  /* scroll: the surface moves with the page (half speed), so a still source leaves a trail */
  function shiftRows(n) {
    if (!n) return;
    const len = SW * SH, off = n * SW;
    for (const a of [cur, prev]) {
      if (n > 0) { a.copyWithin(off, 0, len - off); a.fill(0, 0, off); }
      else { a.copyWithin(0, -off, len); a.fill(0, len + off, len); }
    }
  }

  let px = innerWidth * 0.62, py = innerHeight * 0.62, lastMove = 0, sy = scrollY, acc = 0, flow = 0, wakeV = 0;
  addEventListener("pointermove", e => {
    px = e.clientX; py = e.clientY;
    const now = performance.now(); if (now - lastMove < 24) return; lastMove = now;
    drop(px, py, 3, 0.9);
  }, { passive: true });
  addEventListener("pointerdown", e => drop(e.clientX, e.clientY, 5, 3), { passive: true });
  addEventListener("touchmove", e => { const t = e.touches[0]; if (t) { px = t.clientX; py = t.clientY; } }, { passive: true });
  addEventListener("scroll", () => {
    const dy = scrollY - sy; sy = scrollY;
    acc += dy * 0.5 / CELL;                          // page moves up when scrolling down: water rows move up too
    const n = Math.trunc(acc); acc -= n; shiftRows(n);
    flow += dy * 0.0004;
    wakeV = Math.min(1.6, wakeV + Math.abs(dy) * 0.02);
  }, { passive: true });

  const night = () => (root.dataset.theme === "night" ? 1 : 0);
  let nightMix = night(), last = 0, idle = 0;
  function frame(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    if (!document.hidden) {
      // the wake: a steady source while the page is moving
      if (wakeV > 0.02) { drop(px + Math.sin(now / 220) * 6, py, 2.6, wakeV * 0.9); wakeV *= Math.pow(0.04, dt); }
      idle += dt; if (idle > 2.8) { idle = 0; drop(Math.random() * innerWidth, Math.random() * innerHeight, 2.2, 0.5); }   // a drop now and then so it's never dead still
      stepSim(); stepSim();
      for (let k = 0; k < bytes.length; k++) { const v = 128 + cur[k] * 22; bytes[k] = v < 0 ? 0 : v > 255 ? 255 : v; }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, SW, SH, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes);
      nightMix += (night() - nightMix) * Math.min(1, dt * 3);
      gl.uniform1f(uT, now / 1000); gl.uniform1f(uNight, nightMix); gl.uniform1f(uFlow, flow);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  root.classList.add("on-water");
})();
