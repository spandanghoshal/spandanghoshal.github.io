/* Spandan Ghoshal: live change-point figure for the home page.
   A simulated high-dimensional sequence with two change-points (a sparse
   mean shift, then a change in scale). The pairwise distance matrix grows
   as the data arrive, and a scan statistic built from generalized distances
   phi(x, y) = (1/d) sum_k (1 - exp(-|x_k - y_k|)) locates both changes by
   binary segmentation. A fresh sample is drawn every cycle. */

(function () {
  "use strict";

  var root = document.querySelector(".cpviz");
  if (!root) return;

  var heatC = root.querySelector(".cpviz-heat");
  var distC = root.querySelector(".cpviz-dist");
  var scanC = root.querySelector(".cpviz-scan");
  var readout = root.querySelector(".cpviz-readout");

  var N = 150;          /* time points */
  var D = 60;           /* dimension */
  var S = 12;           /* coordinates carrying the mean shift */
  var MARGIN = 10;      /* minimum segment length */
  var SHIFT = 1.1;
  var SCALE = 2.0;

  var COL = {
    paper:  [251, 248, 240],
    moss:   [68, 96, 77],
    accent: [151, 68, 31],
    gold:   [173, 138, 59],
    deep:   [74, 38, 20],
    ink:    "#292317",
    inkSoft: "#5d5443",
    faint:  "#8a8070",
    rule:   "#d9cdb4"
  };

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- random numbers ---------- */
  var rand;
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss() {
    var u = 1 - rand(), v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ---------- simulation and statistics ---------- */
  var X, Dm, P, tau, est, stage1, stage2, heatImg, distImg;

  function box(r0, r1, c0, c1) {
    var W = N + 1;
    return P[r1 * W + c1] - P[r0 * W + c1] - P[r1 * W + c0] + P[r0 * W + c0];
  }

  /* Scan over split points k in (a, b):
     T(k) = w(k) [ {E phi(X,Y) - E phi(X,X')}^2 + {E phi(X,Y) - E phi(Y,Y')}^2 ] */
  function scanSeg(a, b) {
    var n = b - a, vals = [];
    for (var k = a + MARGIN; k <= b - MARGIN; k++) {
      var n1 = k - a, n2 = b - k;
      var aa = box(a, k, a, k) / (n1 * (n1 - 1));
      var bb = box(k, b, k, b) / (n2 * (n2 - 1));
      var ab = box(a, k, k, b) / (n1 * n2);
      var v = (Math.pow(ab - aa, 2) + Math.pow(ab - bb, 2)) * (n1 * n2) / n;
      vals.push({ k: k, v: v });
    }
    return { a: a, b: b, vals: vals };
  }
  function argmax(seg) {
    var best = { k: seg.a, v: -1 };
    seg.vals.forEach(function (p) { if (p.v > best.v) best = p; });
    return best;
  }

  function lerp(c0, c1, u) {
    return [c0[0] + (c1[0] - c0[0]) * u, c0[1] + (c1[1] - c0[1]) * u, c0[2] + (c1[2] - c0[2]) * u];
  }

  function simulate(seed) {
    rand = mulberry(seed);
    var t1 = Math.round(N * (0.28 + 0.12 * rand()));
    var t2 = Math.round(N * (0.62 + 0.12 * rand()));
    tau = [t1, t2];

    var idx = [], i, j, k, t;
    for (i = 0; i < D; i++) idx.push(i);
    for (i = D - 1; i > 0; i--) { j = Math.floor(rand() * (i + 1)); t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    var shifted = new Uint8Array(D);
    for (i = 0; i < S; i++) shifted[idx[i]] = 1;

    X = [];
    for (t = 0; t < N; t++) {
      var row = new Float32Array(D);
      for (k = 0; k < D; k++) {
        var z = gauss();
        if (t >= t2) z *= SCALE;
        if (t >= t1 && shifted[k]) z += SHIFT;
        row[k] = z;
      }
      X.push(row);
    }

    Dm = new Float32Array(N * N);
    for (i = 0; i < N; i++) {
      for (j = i + 1; j < N; j++) {
        var s = 0, a = X[i], b = X[j];
        for (k = 0; k < D; k++) s += 1 - Math.exp(-Math.abs(a[k] - b[k]));
        s /= D;
        Dm[i * N + j] = s; Dm[j * N + i] = s;
      }
    }

    var W = N + 1;
    P = new Float64Array(W * W);
    for (i = 0; i < N; i++) {
      var rs = 0;
      for (j = 0; j < N; j++) {
        rs += Dm[i * N + j];
        P[(i + 1) * W + j + 1] = P[i * W + j + 1] + rs;
      }
    }

    stage1 = scanSeg(0, N);
    var m1 = argmax(stage1);
    var left = scanSeg(0, m1.k), right = scanSeg(m1.k, N);
    var ml = argmax(left), mr = argmax(right);
    var m2 = ml.v > mr.v ? ml : mr;
    stage2 = [left, right];
    est = [m1.k, m2.k];

    buildImages();
  }

  function buildImages() {
    /* heat map: D rows by N columns, diverging moss / paper / terracotta */
    heatImg = document.createElement("canvas");
    heatImg.width = N; heatImg.height = D;
    var hctx = heatImg.getContext("2d");
    var hd = hctx.createImageData(N, D);
    for (var t = 0; t < N; t++) {
      for (var k = 0; k < D; k++) {
        var u = Math.max(-1, Math.min(1, X[t][k] / 2.8));
        var c = u >= 0 ? lerp(COL.paper, COL.accent, Math.pow(u, 0.75)) : lerp(COL.paper, COL.moss, Math.pow(-u, 0.75));
        var o = (k * N + t) * 4;
        hd.data[o] = c[0]; hd.data[o + 1] = c[1]; hd.data[o + 2] = c[2]; hd.data[o + 3] = 255;
      }
    }
    hctx.putImageData(hd, 0, 0);

    /* distance matrix: paper -> gold -> deep brown, scaled by quantiles */
    var off = [];
    for (var i = 0; i < N; i++) for (var j = i + 1; j < N; j += 3) off.push(Dm[i * N + j]);
    off.sort(function (a, b) { return a - b; });
    var lo = off[Math.floor(off.length * 0.03)], hi = off[Math.floor(off.length * 0.985)];
    distImg = document.createElement("canvas");
    distImg.width = N; distImg.height = N;
    var dctx = distImg.getContext("2d");
    var dd = dctx.createImageData(N, N);
    for (i = 0; i < N; i++) {
      for (j = 0; j < N; j++) {
        var v = i === j ? 0 : Math.max(0, Math.min(1, (Dm[i * N + j] - lo) / (hi - lo)));
        var col = v < 0.55 ? lerp(COL.paper, COL.gold, v / 0.55) : lerp(COL.gold, COL.deep, (v - 0.55) / 0.45);
        var p = (i * N + j) * 4;
        dd.data[p] = col[0]; dd.data[p + 1] = col[1]; dd.data[p + 2] = col[2]; dd.data[p + 3] = 255;
      }
    }
    dctx.putImageData(dd, 0, 0);
  }

  /* ---------- canvas helpers ---------- */
  var dpr = 1;
  function fit(c) {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    var ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    return { ctx: ctx, w: c.clientWidth, h: c.clientHeight };
  }
  function uiFont(size, weight) {
    return (weight || 600) + " " + size + "px Inter, -apple-system, sans-serif";
  }
  function ease(x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); }
  function phase(time, a, b) { return ease((time - a) / (b - a)); }

  /* ---------- timeline (ms) ---------- */
  var T_STREAM = 5200, T_SCAN1 = 7000, T_MARK1 = 7700, T_SCAN2 = 9300, T_MARK2 = 10000;
  var T_HOLD = 15500, T_FADE = 16300;

  function marker(ctx, x, h, alpha, label, top) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgb(" + COL.accent.join(",") + ")";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
    ctx.setLineDash([]);
    if (label) {
      var serif = "Fraunces, Georgia, serif";
      ctx.font = "italic 600 14px " + serif;
      var tauW = ctx.measureText("\u03C4").width;
      ctx.font = "italic 600 10px " + serif;
      var tw = tauW + ctx.measureText(label).width + 1;
      var lx = Math.min(x + 6, ctx.canvas.clientWidth - tw - 6);
      ctx.fillStyle = "rgba(251,248,240,.92)";
      ctx.fillRect(lx - 3, top - 15, tw + 6, 21);
      ctx.fillStyle = ctx.strokeStyle = "rgb(" + COL.accent.join(",") + ")";
      ctx.font = "italic 600 14px " + serif;
      ctx.fillText("\u03C4", lx, top);
      ctx.font = "italic 600 10px " + serif;
      ctx.fillText(label, lx + tauW + 1, top + 4);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(lx + 1.5, top - 9);
      ctx.lineTo(lx + tauW / 2 + 1, top - 12.5);
      ctx.lineTo(lx + tauW + 0.5, top - 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHeat(time, fade) {
    var f = fit(heatC), ctx = f.ctx, w = f.w, h = f.h;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = fade;
    var tNow = Math.round(N * phase(time, 0, T_STREAM));
    if (tNow > 0) ctx.drawImage(heatImg, 0, 0, tNow, D, 0, 0, w * tNow / N, h);
    /* scanning cursor */
    if (tNow > 0 && tNow < N) {
      ctx.fillStyle = "rgba(41,35,23,.55)";
      ctx.fillRect(w * tNow / N, 0, 1.5, h);
    }
    marker(ctx, w * est[0] / N, h, phase(time, T_SCAN1, T_MARK1) * fade, "1", 16);
    marker(ctx, w * est[1] / N, h, phase(time, T_SCAN2, T_MARK2) * fade, "2", 16);
    ctx.globalAlpha = 1;
  }

  function drawDist(time, fade) {
    var f = fit(distC), ctx = f.ctx, w = f.w, h = f.h;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = fade;
    var tNow = Math.round(N * phase(time, 0, T_STREAM));
    if (tNow > 0) ctx.drawImage(distImg, 0, 0, tNow, tNow, 0, 0, w * tNow / N, h * tNow / N);
    ctx.globalAlpha = 1;
    [[est[0], phase(time, T_SCAN1, T_MARK1)], [est[1], phase(time, T_SCAN2, T_MARK2)]].forEach(function (m) {
      var a = m[1] * fade;
      if (a <= 0) return;
      var x = w * m[0] / N;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = "rgb(" + COL.accent.join(",") + ")";
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
      ctx.moveTo(0, x * h / w); ctx.lineTo(w, x * h / w);
      ctx.stroke();
      ctx.restore();
    });
    /* outline the diagonal blocks once both changes are found */
    var bA = phase(time, T_SCAN2 + 300, T_MARK2 + 600) * fade;
    if (bA > 0) {
      var cuts = [0, Math.min(est[0], est[1]), Math.max(est[0], est[1]), N];
      ctx.save();
      ctx.globalAlpha = bA;
      ctx.strokeStyle = "rgba(41,35,23,.85)";
      ctx.lineWidth = 1.5;
      for (var i = 0; i < 3; i++) {
        var x0 = w * cuts[i] / N, x1 = w * cuts[i + 1] / N;
        ctx.strokeRect(x0 + 1, x0 * h / w + 1, x1 - x0 - 2, (x1 - x0) * h / w - 2);
      }
      ctx.restore();
    }
  }

  function curvePath(ctx, seg, w, h, ymax, prog) {
    var pts = seg.vals;
    var upto = Math.max(1, Math.floor(pts.length * prog));
    ctx.beginPath();
    for (var i = 0; i < upto; i++) {
      var x = w * pts[i].k / N, y = h - 18 - (h - 34) * pts[i].v / ymax;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    return { last: pts[upto - 1], upto: upto };
  }

  function drawScan(time, fade) {
    var f = fit(scanC), ctx = f.ctx, w = f.w, h = f.h;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = fade;
    var base = h - 18;

    ctx.strokeStyle = COL.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(w, base + 0.5); ctx.stroke();

    /* time ticks */
    ctx.font = uiFont(10, 500);
    ctx.fillStyle = COL.faint;
    for (var t = 0; t <= N; t += 25) {
      var tx = w * t / N;
      ctx.fillRect(tx, base, 1, 4);
      var lab = String(t);
      var lw = ctx.measureText(lab).width;
      ctx.fillText(lab, Math.max(0, Math.min(w - lw, tx - lw / 2)), h - 3);
    }

    if (!stage1.vals.length) { ctx.globalAlpha = 1; return; }
    var ymax = 0;
    stage1.vals.forEach(function (p) { ymax = Math.max(ymax, p.v); });
    ymax *= 1.08;

    /* stage 1 curve with soft fill */
    var p1 = phase(time, T_STREAM, T_SCAN1);
    if (p1 > 0) {
      var r = curvePath(ctx, stage1, w, h, ymax, p1);
      ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.7; ctx.lineJoin = "round"; ctx.stroke();
      ctx.lineTo(w * r.last.k / N, base);
      ctx.lineTo(w * stage1.vals[0].k / N, base);
      ctx.closePath();
      ctx.fillStyle = "rgba(173,138,59,.16)";
      ctx.fill();
    }

    /* stage 2 curves on the two sub-segments */
    var p2 = phase(time, T_MARK1, T_SCAN2);
    if (p2 > 0) {
      stage2.forEach(function (seg) {
        if (!seg.vals.length) return;
        var own = 0;
        seg.vals.forEach(function (p) { own = Math.max(own, p.v); });
        curvePath(ctx, seg, w, h, own / 0.62, p2);
        ctx.strokeStyle = "rgb(" + COL.accent.join(",") + ")";
        ctx.lineWidth = 1.4; ctx.setLineDash([5, 3]); ctx.stroke(); ctx.setLineDash([]);
      });
    }

    /* true change-points: small moss triangles under the axis */
    var tA = phase(time, T_SCAN2, T_MARK2 + 400);
    if (tA > 0) {
      ctx.save(); ctx.globalAlpha = tA * fade;
      ctx.fillStyle = "rgb(" + COL.moss.join(",") + ")";
      tau.forEach(function (tt) {
        var x = w * tt / N;
        ctx.beginPath(); ctx.moveTo(x, base + 1); ctx.lineTo(x - 4.5, base + 8); ctx.lineTo(x + 4.5, base + 8); ctx.closePath(); ctx.fill();
      });
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    marker(ctx, w * est[0] / N, base, phase(time, T_SCAN1, T_MARK1) * fade, "1", 14);
    marker(ctx, w * est[1] / N, base, phase(time, T_SCAN2, T_MARK2) * fade, "2", 14);
  }

  var lastReadout = "";
  function updateReadout(time) {
    var html;
    if (time < T_MARK2) {
      html = '<span class="cpviz-status">' + (time < T_STREAM ? "Observing the stream…" : "Scanning for change-points…") + "</span>";
    } else {
      var e = est.slice().sort(function (a, b) { return a - b; });
      html =
        '<div><b>Change 1</b> sparse mean shift in ' + S + ' of ' + D + ' coordinates' +
        '<span>true change at t = ' + tau[0] + ', detected at t = ' + e[0] + '</span></div>' +
        '<div><b>Change 2</b> scale change in every coordinate' +
        '<span>true change at t = ' + tau[1] + ', detected at t = ' + e[1] + '</span></div>';
    }
    if (html !== lastReadout) { readout.innerHTML = html; lastReadout = html; }
  }

  function render(time) {
    var fade = time > T_HOLD ? 1 - phase(time, T_HOLD, T_FADE) : 1;
    drawHeat(time, fade);
    drawDist(time, fade);
    drawScan(time, fade);
    updateReadout(time);
  }

  /* ---------- run loop ---------- */
  var seed = (Date.now() % 100000) | 0;
  simulate(seed);

  if (reduce) {
    render(T_HOLD - 1);
    window.addEventListener("resize", function () { render(T_HOLD - 1); });
    return;
  }

  var start = null, visible = false, raf = null;
  function frame(now) {
    if (start === null) start = now;
    var time = now - start;
    if (time > T_FADE + 250) {
      seed += 7919;
      simulate(seed);
      start = now; time = 0;
    }
    render(time);
    raf = visible ? window.requestAnimationFrame(frame) : null;
  }
  var pausedAt = null;
  function setVisible(v) {
    if (v === visible) return;
    visible = v;
    if (v) {
      if (pausedAt !== null && start !== null) start += performance.now() - pausedAt;
      pausedAt = null;
      if (!raf) raf = window.requestAnimationFrame(frame);
    } else {
      pausedAt = performance.now();
    }
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      setVisible(entries[0].isIntersecting && !document.hidden);
    }, { threshold: 0.15 }).observe(root);
  } else {
    setVisible(true);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) setVisible(false);
    else {
      var r = root.getBoundingClientRect();
      setVisible(r.bottom > 0 && r.top < window.innerHeight);
    }
  });
  window.addEventListener("resize", function () { if (!visible) render(T_HOLD - 1); });
})();
