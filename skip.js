/* River Palace: skip a stone across the Vaal at buoys, in three rounds that pop up further out each time.
   Backdrop = real photos of the far bank (img/bank-day.webp, bank-night.webp); water drawn on a 2D canvas with perspective.
   Only the zone around the stone takes the throw (#gGrab, touch-action:none); the rest of the card scrolls the page. */
(() => {
  const card = document.getElementById("gameCard"), c = document.getElementById("skip"), grab = document.getElementById("gGrab");
  if (!card || !c || !grab) return;
  const main = c.getContext("2d"), $ = id => document.getElementById(id);
  let g = main;
  const big = $("gBig"), bigN = $("gBigN"), bigT = $("gBigT"), hint = $("gHint"), lastEl = $("gLast"), bestEl = $("gBest"), goalEl = $("gGoal");

  /* three rounds of buoys, hit in number order; each round pops up in new spots, further out.
     fx = distance from the centre as a share of the screen width, z = metres out */
  const ROUNDS = [
    [{ side: -1, fx: 0.24, z: 8 }, { side: 1, fx: 0.26, z: 12 }],
    [{ side: 1, fx: 0.16, z: 17 }, { side: -1, fx: 0.26, z: 21 }, { side: 1, fx: 0.28, z: 26 }],
    [{ side: -1, fx: 0.14, z: 34 }, { side: 1, fx: 0.24, z: 44 }, { side: -1, fx: 0.27, z: 56 }],   // eased 26 Nov: round 2 was too hard on a phone
  ];
  const BUOYS = ROUNDS.flatMap((r, ri) => r.map((b, k) => ({ ...b, round: ri, n: k + 1 })));
  const sideName = b => (b.side < 0 ? "left" : "right");
  let level = 0; try { level = Math.min(BUOYS.length, +localStorage.getItem("rp-buoy") || 0); } catch (e) {}
  let popAt = performance.now() / 1000;   // when the current round's buoys rose out of the water
  const showGoal = () => {
    const b = BUOYS[level];
    goalEl.textContent = !b ? "All three rounds cleared · Vaal legend" : `Round ${b.round + 1} of 3 · buoy ${b.n} of ${ROUNDS[b.round].length}, on the ${sideName(b)}`;
  };
  const save = () => { try { localStorage.setItem("rp-buoy", String(level)); } catch (e) {} };

  const bank = { day: new Image(), night: new Image() };
  let loaded = false;
  const loadBank = () => { if (loaded) return; loaded = true; bank.day.src = "img/bank-day.webp"; bank.night.src = "img/bank-night.webp"; };

  let W = 0, H = 0, dpr = 1, HY = 0, F = 1;
  const CAM_H = 1.6, D0 = 6, FAR = 120;
  function size() {
    dpr = Math.min(devicePixelRatio || 1, c.clientWidth < 760 ? 1.5 : 2);
    W = c.clientWidth; H = c.clientHeight;   // phones get dpr 1.5: sharp enough, half the pixels of 2+
    c.width = W * dpr; c.height = H * dpr; main.setTransform(dpr, 0, 0, dpr, 0, 0); stillT = -1;
    HY = H * (W < H ? 0.34 : 0.4); F = (H * 0.97 - HY) * D0 / CAM_H;
    // the grab zone sits around the stone, bottom centre
    const gw = Math.min(260, W * 0.56), gh = Math.min(H * 0.4, 260);
    Object.assign(grab.style, { width: gw + "px", height: gh + "px", left: (W - gw) / 2 + "px", top: H - gh + "px" });
  }
  new ResizeObserver(size).observe(c);

  const P = (x, y, z) => { const s = F / (z + D0); return [W / 2 + x * s, HY + (CAM_H - y) * s, s]; };
  const night = () => document.documentElement.dataset.theme === "night";
  const buoyX = b => b.side * b.fx * W * (b.z + D0) / F;   // world x that puts the buoy at fx of the screen width
  const buoyR = b => 0.7 + b.z * 0.012;                     // drawn size, so far buoys stay visible
  const hitR = b => 2.0 + b.z * 0.04;                       // a little more forgiving than it looks

  const S = { mode: "ready", x: 0, y: 0.35, z: 0.6, vx: 0, vy: 0, vz: 0, q: 1, skips: 0, spin: 0 };
  const rip = [], drops = [];
  let best = 0; try { best = +localStorage.getItem("rp-skip-best") || 0; } catch (e) {}
  const showBest = () => (bestEl.textContent = best ? `Best ${best} skip${best === 1 ? "" : "s"}` : "");
  showBest(); showGoal();

  function ripple(x, z, s) { rip.push({ x, z, t: 0, s }); if (rip.length > 60) rip.shift(); }
  function splash(x, z, n) { for (let i = 0; i < n; i++) drops.push({ x, z, y: 0, vx: (Math.random() - .5) * 1.4, vy: 1.4 + Math.random() * 1.8, vz: (Math.random() - .3) * 1.4 }); }
  function reset() { Object.assign(S, { mode: "ready", x: 0, y: 0.35, z: 0.6, vx: 0, vy: 0, vz: 0, skips: 0 }); }

  function end(hit) {
    S.mode = "done";
    const n = S.skips;
    if (n > best) { best = n; try { localStorage.setItem("rp-skip-best", String(n)); } catch (e) {} showBest(); }
    lastEl.textContent = `Last throw: ${n} skip${n === 1 ? "" : "s"}`;
    if (hit) {
      const was = BUOYS[level]; level++; save(); showGoal();
      const nx = BUOYS[level];
      if (!nx) { bigN.textContent = "Vaal legend!"; bigT.textContent = "All three rounds done. Come skip the real thing at our jetty."; }
      else if (nx.round !== was.round) { bigN.textContent = `Round ${was.round + 1} cleared!`; bigT.textContent = "New buoys are popping up, further out."; popAt = performance.now() / 1000 + 1.6; }
      else { bigN.textContent = "Hit!"; bigT.textContent = `Next: buoy ${nx.n}, on the ${sideName(nx)}.`; }
    } else {
      const b = BUOYS[level];
      bigN.textContent = n === 1 ? "1 skip" : `${n} skips`;
      const short = b && S.z < b.z - hitR(b);   // never got there: the flick was too soft
      bigT.textContent = !b ? "Flick again to start over." : short ? "Too soft to reach it. Flick harder." : `Close. Angle your flick to the ${sideName(b)}.`;
    }
    big.classList.add("show"); hint.textContent = "Grab the stone and flick again"; hint.style.opacity = 1;
    setTimeout(() => { if (S.mode === "done") { big.classList.remove("show"); reset(); } }, 2600);
  }

  /* flick input: only from the grab zone */
  let pts = [];
  grab.addEventListener("pointerdown", e => {
    if (S.mode === "flying") return;
    try { grab.setPointerCapture(e.pointerId); } catch (x) {} pts =[[e.clientX, e.clientY, performance.now()]];
    if (S.mode === "done") { big.classList.remove("show"); reset(); }
    if (level >= BUOYS.length) { level = 0; save(); showGoal(); popAt = performance.now() / 1000; }
  });
  grab.addEventListener("pointermove", e => { if (pts.length) { pts.push([e.clientX, e.clientY, performance.now()]); if (pts.length > 12) pts.shift(); } });
  grab.addEventListener("pointerup", e => {
    if (!pts.length || S.mode !== "ready") { pts = []; return; }
    pts.push([e.clientX, e.clientY, performance.now()]);
    const a = pts.find(p => performance.now() - p[2] < 140) || pts[0], b = pts[pts.length - 1];
    const dt = Math.max(16, b[2] - a[2]) / 1000, vxp = (b[0] - a[0]) / dt, vyp = (b[1] - a[1]) / dt;
    pts = [];
    if (vyp > -60 || Math.hypot(vxp, vyp) < 400) { hint.textContent = "Flick towards the buoy"; hint.style.opacity = 1; return; }
    // how hard you flick decides how far it goes: a soft flick plops in close, a hard one reaches the far buoys
    const power = Math.min(6, Math.hypot(vxp, vyp) / Math.max(H, 640)),   // same feel on a small phone as on a laptop
      aim = Math.max(-3, Math.min(3, vxp / -vyp));
    S.q = Math.max(0, 1 - Math.max(0, Math.abs(aim) - 2.2) * 1.2);   // aiming at a buoy is fine; only an almost-sideways swipe loses skips
    S.vz = Math.max(3, Math.min(36, power * 8.5)); S.vx = S.vz * aim * 0.15; S.vy = 1.6 + (1 - S.q) * 1.2;
    // aim assist: a flick within ~12 degrees of the current buoy (as seen on screen) heads straight for it
    const bu = BUOYS[level];
    if (bu) {
      const [sx, sy] = P(0, 0.35, 0.6), [bx, by] = P(buoyX(bu), 0, bu.z);
      if (Math.abs(Math.atan2(vxp, -vyp) - Math.atan2(bx - sx, sy - by)) < 0.4) S.vx = S.vz * buoyX(bu) / (bu.z - 0.6);
    }
    S.mode = "flying"; S.skips = 0; hint.style.opacity = 0; lastEl.textContent = "";
  });
  grab.addEventListener("pointercancel", () => (pts = []));

  function step(dt) {
    if (S.mode === "flying") {
      S.spin += dt * 30;
      const x0 = S.x, z0 = S.z;
      S.vy -= 9.8 * dt; S.x += S.vx * dt; S.y += S.vy * dt; S.z += S.vz * dt;
      const b = BUOYS[level];
      // hit = the stone's path this frame passes through the buoy (checked as a segment, so fast stones can't jump over it)
      const near = (ax, az, bx2, bz2) => { const px = buoyX(b), pz = b.z, dx = bx2 - ax, dz = bz2 - az, L = dx * dx + dz * dz || 1, k = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)); return Math.hypot(ax + dx * k - px, az + dz * k - pz); };
      const hitNow = () => { ripple(buoyX(b), b.z, 2); splash(buoyX(b), b.z, 18); end(true); };
      if (b && S.y < 1.6 && near(x0, z0, S.x, S.z) < hitR(b)) return hitNow();
      if (S.y <= 0 && S.vy < 0) {
        if (S.vz > 5 && -S.vy / S.vz < 0.95) {
          S.skips++; S.y = 0; S.vy = -S.vy * 0.5 + S.vz * 0.06 * (0.4 + S.q);
          const slow = 0.8 - (1 - S.q) * 0.1; S.vz *= slow; S.vx *= slow; ripple(S.x, S.z, 1); splash(S.x, S.z, 5);
        } else if (b && Math.hypot(S.x - buoyX(b), S.z - b.z) < hitR(b) * 1.2) return hitNow();   // sank right beside it: counts
        else { ripple(S.x, S.z, 1.8); splash(S.x, S.z, 12); end(false); }
      }
      if (S.mode === "flying" && (S.z > FAR - 6 || Math.abs(S.x) > 40)) end(false);
    }
    for (let i = rip.length - 1; i >= 0; i--) { rip[i].t += dt / 2.6; if (rip[i].t >= 1) rip.splice(i, 1); }
    for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.vy -= 9.8 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; if (d.y < 0) drops.splice(i, 1); }
    if (Math.random() < dt * 0.35) ripple((Math.random() - .5) * 30, 15 + Math.random() * 80, 0.35);
  }

  /* ---------- drawing ---------- */
  let BD = null;   // where the backdrop photo sits on screen: { im, x, y, sc }
  function backdrop(bankY, N) {
    const im = N ? bank.night : bank.day;
    if (im.complete && im.naturalWidth) {   // photo covers the sky, its waterline sits on the horizon
      const sc = Math.max(W / im.naturalWidth, (bankY + 2) / im.naturalHeight), w = im.naturalWidth * sc, h = im.naturalHeight * sc;
      BD = { im, x: (W - w) / 2, y: bankY + 2 - h, sc };
      g.drawImage(im, BD.x, BD.y, w, h);
      return;
    }
    BD = null;
    const sk = g.createLinearGradient(0, 0, 0, bankY);
    if (N) { sk.addColorStop(0, "#8f8aa3"); sk.addColorStop(.7, "#f0b0a0"); sk.addColorStop(1, "#e89a8c"); } else { sk.addColorStop(0, "#5ea4e6"); sk.addColorStop(1, "#cfe4f4"); }
    g.fillStyle = sk; g.fillRect(0, 0, W, bankY + 2);
  }

  /* small wind-blown wavelets scattered over the river, fixed once so they don't flicker */
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const waves = Array.from({ length: 220 }, () => ({ fx: rnd() * 1.4 - 0.7, z: 2 + rnd() ** 1.6 * (FAR - 4), l: 0.5 + rnd() * 1.4, ph: rnd() * 6.28, v: 0.15 + rnd() * 0.25 }));

  /* weathered deck planks, painted once per size and theme */
  let wood = null, woodKey = "";
  function woodTex(N) {
    const key = N + ":" + W + "x" + H; if (woodKey === key) return wood; woodKey = key;
    const cv = document.createElement("canvas"), w = 512, h = 256; cv.width = w; cv.height = h; const x = cv.getContext("2d");
    let s2 = 5; const r2 = () => ((s2 = (s2 * 16807) % 2147483647) / 2147483647);
    const ph = 32;
    for (let y = 0; y < h; y += ph) {
      const tone = 0.85 + r2() * 0.3, base = N ? [70, 52, 46] : [150, 116, 82];
      x.fillStyle = `rgb(${base.map(c => Math.round(c * tone)).join(",")})`; x.fillRect(0, y, w, ph);
      for (let k = 0; k < 14; k++) {   // grain
        x.strokeStyle = `rgba(${N ? "20,10,10" : "60,38,20"},${0.12 + r2() * 0.18})`; x.lineWidth = 0.6 + r2();
        const gy = y + 3 + r2() * (ph - 6); x.beginPath(); x.moveTo(0, gy);
        for (let gx = 0; gx <= w; gx += 32) x.lineTo(gx, gy + Math.sin(gx * 0.02 + k) * 1.4 + (r2() - .5));
        x.stroke();
      }
      const hl = x.createLinearGradient(0, y, 0, y + ph); hl.addColorStop(0, "rgba(255,255,255,.12)"); hl.addColorStop(.5, "rgba(255,255,255,0)"); hl.addColorStop(1, "rgba(0,0,0,.18)");
      x.fillStyle = hl; x.fillRect(0, y, w, ph);
      x.fillStyle = "rgba(15,8,4,.75)"; x.fillRect(0, y + ph - 2, w, 2);   // gap between planks
      x.fillStyle = "rgba(30,30,30,.55)"; for (const nx of [40, 44, 300, 304]) x.fillRect(nx + r2() * 4, y + ph / 2 - 1, 2, 2);   // nails
    }
    return (wood = cv);
  }
  /* the bank and sky mirrored into the water: built once per size and theme at full sharpness, softened slightly like a real reflection */
  let mir = null, mirKey = "";
  function mirror(bankY, wh, N) {
    if (!BD) return null;
    const key = [N, W, H, dpr, BD.im.src].join("|"); if (key === mirKey) return mir; mirKey = key;
    const cv = document.createElement("canvas"); cv.width = Math.ceil(W * dpr); cv.height = Math.ceil(wh * dpr);
    const x = cv.getContext("2d"), { im, x: ix, y: iy, sc } = BD;
    x.filter = `blur(${(0.9 * dpr).toFixed(2)}px)`;
    x.setTransform(dpr, 0, 0, -dpr / 0.9, 0, (bankY + 1) * dpr / 0.9);   // screen row y lands at (bankY + 1 - y) / 0.9 below the horizon
    x.drawImage(im, ix, iy, im.naturalWidth * sc, im.naturalHeight * sc);
    return (mir = cv);
  }

  /* the jetty you're standing on: real 3D boards in the same perspective as the river, ending just behind the stone */
  function dock(N) {
    const tex = woodTex(N), X0 = -1.25, X1 = 1.25, Y = 0.42, ZE = 0.15, ZN = -4.4, BW = 0.26, GAP = 0.025;
    const q = (pts, fill) => { g.beginPath(); pts.forEach(([a, b], k) => (k ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } };
    const [ex0, ey] = P(X0, Y, ZE), [ex1] = P(X1, Y, ZE), [, wy, ws] = P(0, 0, ZE);
    // its shadow and dark reflection on the water just past the end
    g.fillStyle = N ? "rgba(10,5,8,.55)" : "rgba(10,30,50,.4)"; g.fillRect(ex0 - ws * 0.1, wy, ex1 - ex0 + ws * 0.2, ws * 0.32);
    // end face: the thick fascia beam you see from above, from deck height down to the water
    const fg = g.createLinearGradient(0, ey, 0, wy);
    fg.addColorStop(0, N ? "#4a3530" : "#8a6440"); fg.addColorStop(.25, N ? "#2e211d" : "#5c3f25"); fg.addColorStop(1, N ? "#120c0b" : "#2a1c10");
    q([[ex0, ey], [ex1, ey], [ex1, wy], [ex0, wy]], fg);
    // deck boards across the walkway, nearer ones bigger; each with its own tone, grain and a dark gap
    let i = 0;
    for (let z = ZE; z > ZN; z -= BW + GAP, i++) {
      const z0 = Math.max(ZN, z - BW), a = P(X0, Y, z), b2 = P(X1, Y, z), c2 = P(X1, Y, z0), d = P(X0, Y, z0);
      if (a[1] > H + 2) break;
      g.save(); q([a, b2, c2, d]); g.clip();
      g.drawImage(tex, 0, (i % 8) * 32 + 2, 512, 28, Math.min(d[0], a[0]), a[1], Math.max(c2[0], b2[0]) - Math.min(d[0], a[0]), c2[1] - a[1] + 1);
      // light falls off towards you a little; the board edge nearest the water catches the light
      g.fillStyle = `rgba(0,0,0,${0.06 + i * 0.012})`; g.fillRect(d[0], a[1], c2[0] - d[0], c2[1] - a[1] + 1);
      g.restore();
      g.strokeStyle = N ? "rgba(255,220,200,.10)" : "rgba(255,240,215,.22)"; g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1] + 0.5); g.lineTo(b2[0], b2[1] + 0.5); g.stroke();
      const g0 = P(X0, Y, z0 - GAP), g1 = P(X1, Y, z0 - GAP);
      q([d, c2, g1, g0], N ? "#0c0707" : "#1e140c");
    }
    // two short mooring posts at the corners, with their wobbling reflections
    for (const px of [X0 - 0.06, X1 + 0.06]) {
      const [tx, ty, s] = P(px, Y + 0.16, ZE), [, by] = P(px, -0.05, ZE), w = s * 0.13;
      for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(${N ? "20,12,10" : "40,28,16"},${0.4 - k * 0.05})`; g.fillRect(tx - w / 2 + Math.sin(performance.now() / 500 + k) * w * 0.15, by + k * w * 0.35, w, w * 0.3); }
      const pg = g.createLinearGradient(tx - w / 2, 0, tx + w / 2, 0);
      pg.addColorStop(0, N ? "#2a1e1a" : "#5e4128"); pg.addColorStop(.35, N ? "#5a4238" : "#a8805a"); pg.addColorStop(1, N ? "#140e0c" : "#3a2816");
      g.fillStyle = pg; g.fillRect(tx - w / 2, ty, w, by - ty);
      g.fillStyle = N ? "#5d4840" : "#bf9a6e"; g.beginPath(); g.ellipse(tx, ty, w / 2, w * 0.2, 0, 0, Math.PI * 2); g.fill();
    }
  }

  function buoy(b, i, t, N) {
    const done = i < level, cur = i === level;
    // pop up out of the water when the round starts, one after another, with a small overshoot
    const k = Math.max(0, Math.min(1, (t - popAt - (b.n - 1) * 0.3) / 0.7)), pop = k === 0 ? 0 : 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;
    if (!b.popped && k > 0) { b.popped = true; ripple(buoyX(b), b.z, 1.4); splash(buoyX(b), b.z, 8); }
    const bob = Math.sin(t * 1.3 + i * 2.1), [x, wy, s] = P(buoyX(b), 0, b.z), r = buoyR(b) * s * 0.5 * pop;
    if (r < 1.2) return;
    const y = wy + bob * r * 0.06, cy = y - r * 0.45, tilt = Math.sin(t * 0.9 + i) * 0.08;
    g.save(); g.globalAlpha = done ? 0.4 : 1;
    if (cur) {   // pulsing ring on the water marks the one to hit
      const p = (t * 0.6) % 1;
      g.strokeStyle = `rgba(255,255,255,${(1 - p) * 0.6})`; g.lineWidth = Math.max(1, r * 0.07);
      g.beginPath(); g.ellipse(x, y, r * (1.5 + p * 2), r * (1.5 + p * 2) * 0.28, 0, 0, Math.PI * 2); g.stroke();
    }
    // reflection: a squashed, rippled red smear under the waterline
    for (let k = 0; k < 6; k++) {
      const ry = y + r * 0.08 + k * r * 0.16, wob = Math.sin(t * 2 + k * 1.3 + i) * r * 0.12;
      g.fillStyle = `rgba(${N ? "120,30,28" : "190,45,35"},${0.32 - k * 0.05})`;
      g.fillRect(x - r * (0.85 - k * 0.08) + wob, ry, r * (1.7 - k * 0.16), r * 0.12);
    }
    g.translate(x, cy); g.rotate(tilt);
    g.save(); g.beginPath(); g.rect(-r * 1.3, -r * 1.6, r * 2.6, r * 0.45 + r * 1.6); g.clip();   // only the part above water
    const body = g.createRadialGradient(-r * 0.38, -r * 0.42, r * 0.05, 0, 0, r * 1.05);
    body.addColorStop(0, N ? "#e2857a" : "#ff9a85"); body.addColorStop(0.3, N ? "#b8392f" : "#e23d2c"); body.addColorStop(0.75, N ? "#7a1c16" : "#a8231a"); body.addColorStop(1, N ? "#3c0c0a" : "#5c100b");
    g.fillStyle = body; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.save(); g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.clip();   // white reflective band round the middle
    const band = g.createLinearGradient(-r, 0, r, 0); band.addColorStop(0, N ? "#c9c2b8" : "#ffffff"); band.addColorStop(.6, N ? "#9b958d" : "#e4e4e4"); band.addColorStop(1, N ? "#4c4844" : "#8f8f8f");
    g.fillStyle = band; g.beginPath(); g.ellipse(0, -r * 0.05, r * 1.1, r * 0.24, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = N ? "#b8392f" : "#e23d2c"; g.beginPath(); g.ellipse(0, -r * 0.18, r * 1.1, r * 0.2, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(-r * 0.4, -r * 0.5, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2); g.fill();   // sun highlight
    g.restore();
    g.strokeStyle = N ? "#2b2b2b" : "#3d3d3d"; g.lineWidth = Math.max(0.8, r * 0.09);   // steel lifting eye on top
    g.beginPath(); g.arc(0, -r * 1.05, r * 0.18, Math.PI, 0); g.stroke();
    g.rotate(-tilt); g.translate(-x, -cy);
    g.strokeStyle = `rgba(255,255,255,${N ? 0.35 : 0.6})`; g.lineWidth = Math.max(0.6, r * 0.06);   // little wake where it meets the water
    g.beginPath(); g.ellipse(x, y, r * 1.08, r * 0.22, 0, 0, Math.PI * 2); g.stroke();
    if (!done && r > 4) {   // every buoy still to hit shows its number
      const fs = Math.max(11, Math.min(18, r * 0.9)); g.font = `700 ${fs}px system-ui,sans-serif`; g.textAlign = "center";
      g.fillStyle = cur ? "rgba(210,58,43,.9)" : "rgba(8,24,34,.55)"; g.beginPath(); g.roundRect ? g.roundRect(x - fs * 0.7, cy - r * 1.4 - fs * 1.3, fs * 1.4, fs * 1.3, fs * 0.6) : g.rect(x - fs * 0.7, cy - r * 1.4 - fs * 1.3, fs * 1.4, fs * 1.3); g.fill();
      g.fillStyle = "#fff"; g.fillText(String(b.n), x, cy - r * 1.4 - fs * 0.32);
    }
    g.restore();
  }

  /* photo, water and reflection change slowly, so they are painted into a layer at 30 fps and copied each frame (phones were dropping to ~30 fps) */
  const layer = document.createElement("canvas"); let stillT = -1;
  function still(t, bankY, wh, N) {
    if (stillT >= 0 && t - stillT < 1 / 30 && t >= stillT) return;
    stillT = t;
    if (layer.width !== c.width || layer.height !== c.height) { layer.width = c.width; layer.height = c.height; }
    g = layer.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    try { paintStill(t, bankY, wh, N); } finally { g = main; }
  }
  function paintStill(t, bankY, wh, N) {
    backdrop(bankY, N);
    // water body: the river's own colour, deeper towards you
    const wg = g.createLinearGradient(0, bankY, 0, H);
    if (N) { wg.addColorStop(0, "#c88f8c"); wg.addColorStop(.4, "#6c4752"); wg.addColorStop(1, "#1d1420"); } else { wg.addColorStop(0, "#9cbbd8"); wg.addColorStop(.4, "#5f8cb8"); wg.addColorStop(1, "#244e78"); }
    g.fillStyle = wg; g.fillRect(0, bankY, W, wh);
    // mirror image of the real bank and sky, broken up by the wind; strongest near the horizon like real water
    const rc = mirror(bankY, wh, N);
    if (rc) {   // one device-pixel line at a time, shifted by smooth waves: soft like real water, no stair-steps
      const st = W < 760 ? 2 : 1;   // phones: 2 px bands, still smooth at this size
      for (let y = 0; y < wh; y += st) {
        const f = y / wh, wob = Math.sin(t * 1.1 + y * 0.09) * (0.3 + f * 4) + Math.sin(t * 0.6 + y * 0.031) * f * 3;
        g.globalAlpha = (N ? 0.85 : 0.7) * (1 - f * 0.75);
        g.drawImage(rc, 0, y * dpr, W * dpr, dpr * st, wob - 2, bankY + y, W + 4, st);
      }
      g.globalAlpha = 1;
    }
    // tone it down towards you so the reflection fades into deep water
    const dg = g.createLinearGradient(0, bankY, 0, H);
    dg.addColorStop(0, "rgba(0,0,0,0)"); dg.addColorStop(1, N ? "rgba(22,12,20,.72)" : "rgba(18,52,86,.62)");
    g.fillStyle = dg; g.fillRect(0, bankY, W, wh);
    // wavelets: light crest over a dark trough, sized by distance, drifting gently
    for (const w of waves) {
      const s = F / (w.z + D0), y = HY + CAM_H * s, x = W / 2 + (w.fx * W + Math.sin(t * w.v + w.ph) * 8) , len = Math.min(w.l * s * 0.7, W * 0.06), hgt = Math.max(0.5, s * 0.009);
      if (y < bankY + 1 || len < 1.2) continue;
      const a = 0.5 + 0.5 * Math.sin(t * (0.8 + w.v) + w.ph);
      g.fillStyle = N ? `rgba(20,10,18,${0.1 * a})` : `rgba(10,40,70,${0.12 * a})`; g.fillRect(x - len / 2, y + hgt, len, hgt);
      g.fillStyle = N ? `rgba(255,205,190,${0.1 * a})` : `rgba(235,245,255,${0.18 * a})`; g.fillRect(x - len / 2, y, len, hgt);
    }
  }

  function draw(t) {
    if (!c.width) return;   // not sized yet
    const N = night(), bankY = P(0, 0, FAR)[1], wh = H - bankY;
    still(t, bankY, wh, N);
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(layer, 0, 0); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const r of rip) {
      const [sx, sy, s] = P(r.x, 0, r.z), e = 1 - Math.pow(1 - r.t, 2.4), rad = (0.25 + e * 2.6 * r.s) * s;
      for (let k = 0; k < 3; k++) {
        const rr = rad * (1 - k * 0.28); if (rr < 1) continue;
        g.beginPath(); g.ellipse(sx, sy, rr, rr * 0.22, 0, 0, Math.PI * 2);
        g.strokeStyle = `rgba(255,255,255,${(1 - r.t) * (N ? 0.4 : 0.6) * (1 - k * 0.3)})`;
        g.lineWidth = Math.max(0.6, s * 0.015); g.stroke();
      }
    }
    // buoys far to near, so nearer ones overlap
    // only this round's buoys are on the water (after the last round, its buoys stay, faded)
    const rd = BUOYS[Math.min(level, BUOYS.length - 1)].round;
    BUOYS.map((b, i) => [b, i]).filter(([b]) => b.round === rd).sort((p, q) => q[0].z - p[0].z).forEach(([b, i]) => buoy(b, i, t, N));
    g.fillStyle = N ? "rgba(255,230,220,.8)" : "rgba(255,255,255,.92)";
    for (const d of drops) { const [sx, sy, s] = P(d.x, d.y, d.z); g.beginPath(); g.arc(sx, sy, Math.max(0.8, s * 0.025), 0, Math.PI * 2); g.fill(); }
    dock(N);
    // stone + shadow
    if (S.mode !== "done") {
      const [shx, shy, ss] = P(S.x, 0, S.z), [sx, sy] = P(S.x, S.y, S.z), r = Math.max(2.5, ss * 0.11);
      if (S.mode === "ready") {   // soft pulse round the stone: this is what you grab
        const p = (t * 0.9) % 1;
        g.strokeStyle = `rgba(255,255,255,${0.55 * (1 - p)})`; g.lineWidth = 2;
        g.beginPath(); g.arc(sx, sy, r * (1.6 + p * 1.8), 0, Math.PI * 2); g.stroke();
      }
      g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(shx, shy, r * 1.1, r * 0.3, 0, 0, Math.PI * 2); g.fill();
      g.save(); g.translate(sx, sy); g.rotate(S.mode === "flying" ? Math.sin(S.spin) * 0.25 : 0);
      const sg = g.createRadialGradient(-r * .35, -r * .3, r * .05, 0, 0, r * 1.1);
      sg.addColorStop(0, N ? "#c9bfbd" : "#d8d2c6"); sg.addColorStop(.5, N ? "#7a6f70" : "#8c8476"); sg.addColorStop(1, N ? "#2e2729" : "#4b453c");
      g.fillStyle = sg; g.beginPath(); g.ellipse(0, 0, r, r * 0.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = Math.max(0.6, r * 0.08); g.beginPath(); g.ellipse(-r * .1, -r * .12, r * .55, r * .2, 0, Math.PI * 1.05, Math.PI * 1.75); g.stroke();
      g.restore();
    }
  }

  let vis = false, last = 0, raf = 0;   // raf guard: quick in/out scrolling used to start a second loop
  new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis && !raf) { loadBank(); last = 0; raf = requestAnimationFrame(loop); } }, { rootMargin: "300px" }).observe(card);
  function loop(now) {
    raf = 0; if (!vis) return;
    const dt = Math.min(0.04, last ? (now - last) / 1000 : 0.016); last = now;
    step(dt); draw(now / 1000);
    raf = requestAnimationFrame(loop);
  }
})();
