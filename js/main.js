/* ═══════════════════════════════════════════
   三体 · 地球往事 — 交互脚本
   1) 星野  2) 三体混沌模拟（RK4）  3) 滚动浮现 / 导航  4) 彩蛋
   ═══════════════════════════════════════════ */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ───────── 星野 ───────── */
  var starsCv = document.getElementById("stars");
  var sctx = starsCv.getContext("2d");
  var stars = [];

  function buildStars(w, h, dpr) {
    stars = [];
    var n = Math.round((w * h) / 5200);
    for (var i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.25,
        base: Math.random() * 0.55 + 0.2,
        amp: Math.random() * 0.35,
        sp: Math.random() * 0.0016 + 0.0004,
        ph: Math.random() * Math.PI * 2,
        warm: Math.random() < 0.14
      });
    }
  }

  function drawStars(t) {
    var w = starsCv._w, h = starsCv._h;
    sctx.clearRect(0, 0, w, h);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var a = s.base + s.amp * Math.sin(t * s.sp + s.ph);
      sctx.globalAlpha = Math.max(0.05, a);
      sctx.fillStyle = s.warm ? "#e8b04a" : "#cfd8e3";
      sctx.beginPath();
      sctx.arc(s.x, s.y, s.r, 0, 6.2832);
      sctx.fill();
    }
    sctx.globalAlpha = 1;
  }

  /* ───────── 三体模拟 ───────── */
  var simCv = document.getElementById("sim");
  var ctx = simCv.getContext("2d");

  var G = 1, DT = 0.004, SUB = 4;
  // Chenciner–Montgomery 花形解初值（G=1, m=1）
  var SUNS = [
    { x: -0.97000436, y: 0.24308753, vx: -0.2332018015, vy: -0.2161654455, color: "#ffd27a", core: "#fff6e0" },
    { x:  0.97000436, y: -0.24308753, vx: -0.2332018015, vy: -0.2161654455, color: "#ff7a5c", core: "#ffece5" },
    { x:  0.0,        y: 0.0,          vx:  0.4662036850, vy:  0.4323657300, color: "#d94f43", core: "#ffe9e7" }
  ];
  var planet = null, civNo = 192, flashes = [];
  var dHist = [];
  var roEra = document.getElementById("roEra");
  var roCiv = document.getElementById("roCiv");
  var roMsg = document.getElementById("roMsg");
  var lastRo = 0;

  var DEATH_HIT = [
    "毁于三日凌空：三颗太阳同时逼近，大地熔化。",
    "毁于双日凌空：烈焰掠过，文明烧成玻璃。",
    "被恒星俘获，坠入永夜之前化作流星。"
  ];
  var DEATH_OUT = [
    "毁于极寒：行星被抛入星际黑暗的深渊。",
    "漂离恒星系，在永夜里失去所有热量。"
  ];

  function accel(x, y) {
    var ax = 0, ay = 0;
    for (var i = 0; i < 3; i++) {
      var s = SUNS[i];
      var dx = s.x - x, dy = s.y - y;
      var r2 = dx * dx + dy * dy + 1e-5;
      var inv = G / (r2 * Math.sqrt(r2));
      ax += dx * inv; ay += dy * inv;
    }
    return [ax, ay];
  }

  function sunAccel() {
    // 记录每颗恒星的加速度（RK4 中间量存临时对象）
    var out = [];
    for (var i = 0; i < 3; i++) {
      var s = SUNS[i], ax = 0, ay = 0;
      for (var j = 0; j < 3; j++) {
        if (i === j) continue;
        var o = SUNS[j];
        var dx = o.x - s.x, dy = o.y - s.y;
        var r2 = dx * dx + dy * dy + 1e-5;
        var inv = G / (r2 * Math.sqrt(r2));
        ax += dx * inv; ay += dy * inv;
      }
      out.push([ax, ay]);
    }
    return out;
  }

  function rk4Step(dt) {
    // 恒星：速度 Verlet（能量漂移小）；行星：RK4 试质量
    var i;
    var a0 = sunAccel();
    for (i = 0; i < 3; i++) {
      SUNS[i].vx += a0[i][0] * dt * 0.5;
      SUNS[i].vy += a0[i][1] * dt * 0.5;
      SUNS[i].x += SUNS[i].vx * dt;
      SUNS[i].y += SUNS[i].vy * dt;
    }
    var a1 = sunAccel();
    for (i = 0; i < 3; i++) {
      SUNS[i].vx += a1[i][0] * dt * 0.5;
      SUNS[i].vy += a1[i][1] * dt * 0.5;
    }

    // 行星 RK4
    function pAcc(x, y) { return accel(x, y); }
    var x0 = planet.x, y0 = planet.y, u0 = planet.vx, v0 = planet.vy;
    var a = pAcc(x0, y0);
    var k1x = u0, k1y = v0, k1u = a[0], k1v = a[1];
    var x1 = x0 + k1x * dt / 2, y1 = y0 + k1y * dt / 2;
    var a2 = pAcc(x1, y1);
    var k2x = u0 + k1u * dt / 2, k2y = v0 + k1v * dt / 2, k2u = a2[0], k2v = a2[1];
    var x2 = x0 + k2x * dt / 2, y2 = y0 + k2y * dt / 2;
    var a3 = pAcc(x2, y2);
    var k3x = u0 + k2u * dt / 2, k3y = v0 + k2v * dt / 2, k3u = a3[0], k3v = a3[1];
    var x3 = x0 + k3x * dt, y3 = y0 + k3y * dt;
    var a4 = pAcc(x3, y3);
    var k4x = u0 + k3u * dt, k4y = v0 + k3v * dt, k4u = a4[0], k4v = a4[1];

    planet.x += (k1x + 2 * k2x + 2 * k3x + k4x) * dt / 6;
    planet.y += (k1y + 2 * k2y + 2 * k3y + k4y) * dt / 6;
    planet.vx += (k1u + 2 * k2u + 2 * k3u + k4u) * dt / 6;
    planet.vy += (k1v + 2 * k2v + 2 * k3v + k4v) * dt / 6;
  }

  function respawnPlanet(msg) {
    civNo++;
    var ang = Math.random() * 6.2832;
    var r = 1.55 + Math.random() * 0.7;
    planet = {
      x: Math.cos(ang) * r,
      y: Math.sin(ang) * r,
      vx: -Math.sin(ang) * 0.52 + (Math.random() - 0.5) * 0.14,
      vy: Math.cos(ang) * 0.52 + (Math.random() - 0.5) * 0.14
    };
    dHist = [];
    roCiv.textContent = "第 " + civNo + " 号文明";
    roMsg.textContent = "第 " + civNo + " 号文明在乱纪元中诞生，挣扎求生。" + (msg ? "上一纪元：" + msg : "");
  }

  function checkPlanetState() {
    var dmin = 1e9, i, dx, dy, r2;
    for (i = 0; i < 3; i++) {
      dx = planet.x - SUNS[i].x; dy = planet.y - SUNS[i].y;
      r2 = Math.sqrt(dx * dx + dy * dy);
      if (r2 < dmin) dmin = r2;
    }
    dHist.push(dmin);
    if (dHist.length > 90) dHist.shift();

    // 毁灭判定
    if (dmin < 0.06) {
      flashes.push({ x: planet.x, y: planet.y, r: 0, life: 34 });
      respawnPlanet(DEATH_HIT[Math.floor(Math.random() * DEATH_HIT.length)]);
      return;
    }
    if (Math.abs(planet.x) > 7 || Math.abs(planet.y) > 7) {
      respawnPlanet(DEATH_OUT[Math.floor(Math.random() * DEATH_OUT.length)]);
      return;
    }
    return dmin;
  }

  function drawSim(scale, cx, cy) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, 0, simCv._w, simCv._h);
    ctx.globalCompositeOperation = "lighter";

    var i, sx, sy;
    // 行星轨迹点
    var px = cx + planet.x * scale, py = cy - planet.y * scale;
    ctx.fillStyle = "rgba(120, 220, 245, 0.85)";
    ctx.beginPath(); ctx.arc(px, py, 2.1, 0, 6.2832); ctx.fill();

    // 恒星
    for (i = 0; i < 3; i++) {
      var s = SUNS[i];
      sx = cx + s.x * scale; sy = cy - s.y * scale;
      var g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 22);
      g.addColorStop(0, s.core);
      g.addColorStop(0.22, s.color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, 22, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 毁灭闪光
    for (i = flashes.length - 1; i >= 0; i--) {
      var f = flashes[i];
      f.r += 2.6; f.life--;
      if (f.life <= 0) { flashes.splice(i, 1); continue; }
      ctx.strokeStyle = "rgba(226, 72, 61, " + (f.life / 34) + ")";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx + f.x * scale, cy - f.y * scale, f.r * 2, 0, 6.2832);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function updateReadout(now) {
    if (now - lastRo < 260) return;
    lastRo = now;
    var dmin = 1e9, i, dx, dy;
    for (i = 0; i < 3; i++) {
      dx = planet.x - SUNS[i].x; dy = planet.y - SUNS[i].y;
      var r = Math.sqrt(dx * dx + dy * dy);
      if (r < dmin) dmin = r;
    }
    var era;
    if (dmin < 0.25) {
      era = "三日凌空";
      roEra.style.color = "var(--red)";
    } else if (dHist.length > 40) {
      var min = Math.min.apply(null, dHist), max = Math.max.apply(null, dHist);
      if (max - min < 0.16) {
        era = "恒纪元"; roEra.style.color = "var(--gold)";
      } else {
        era = "乱纪元"; roEra.style.color = "var(--blue)";
      }
    } else {
      era = "乱纪元"; roEra.style.color = "var(--blue)";
    }
    roEra.textContent = era;
  }

  /* ───────── 尺寸与主循环 ───────── */
  var hero = document.querySelector(".hero");

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = hero.clientWidth, h = hero.clientHeight;
    starsCv.width = w * dpr; starsCv.height = h * dpr;
    simCv.width = w * dpr; simCv.height = h * dpr;
    starsCv._w = w; starsCv._h = h; simCv._w = w; simCv._h = h;
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars(w, h, dpr);
  }

  function loop(now) {
    drawStars(now);
    var scale = Math.min(simCv._w, simCv._h) / 4.6;
    var cx = simCv._w > 860 ? simCv._w * 0.6 : simCv._w * 0.5;
    var cy = simCv._h * (simCv._w > 860 ? 0.5 : 0.42);
    if (!reduced) {
      for (var k = 0; k < SUB; k++) { rk4Step(DT); }
      var dmin = checkPlanetState();
      drawSim(scale, cx, cy);
      updateReadout(now);
      // 偶发微扰：花形解终将失稳，如乱纪元终会到来
      if (Math.random() < 0.0012) {
        SUNS[0].vx += (Math.random() - 0.5) * 0.002;
        SUNS[0].vy += (Math.random() - 0.5) * 0.002;
      }
    } else {
      drawSim(scale, cx, cy);
    }
    requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener("resize", resize);
  respawnPlanet();

  if (reduced) {
    // 减少动态偏好：只渲染一帧静态画面
    var staticDraw = function () {
      drawStars(0);
      var scale = Math.min(simCv._w, simCv._h) / 4.6;
      var cx = simCv._w > 860 ? simCv._w * 0.6 : simCv._w * 0.5;
      var cy = simCv._h * (simCv._w > 860 ? 0.5 : 0.42);
      drawSim(scale, cx, cy);
    };
    staticDraw();
    window.addEventListener("resize", staticDraw);
  } else {
    requestAnimationFrame(loop);
  }

  /* ───────── 滚动浮现（含子元素错峰） ───────── */
  var revealEls = document.querySelectorAll(".reveal");
  document.querySelectorAll(".reveal").forEach(function (el) {
    var parent = el.parentElement;
    var kids = parent ? Array.prototype.slice.call(parent.querySelectorAll(":scope > .reveal")) : [];
    var idx = kids.indexOf(el);
    if (idx > 0) el.style.transitionDelay = Math.min(idx, 8) * 80 + "ms";
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  revealEls.forEach(function (el) { io.observe(el); });

  /* ───────── 导航状态 ───────── */
  var nav = document.getElementById("topnav");
  var links = document.querySelectorAll(".navlinks a");
  var secIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        links.forEach(function (a) {
          a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id);
        });
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll("main section[id], header[id]").forEach(function (s) { secIO.observe(s); });
  window.addEventListener("scroll", function () {
    nav.classList.toggle("scrolled", window.scrollY > 40);
  }, { passive: true });

  /* ───────── 彩蛋：连点「三体」→ 不要回答 ───────── */
  var title = document.getElementById("heroTitle");
  var clicks = 0, timer = null;
  title.addEventListener("click", function () {
    clicks++;
    clearTimeout(timer);
    timer = setTimeout(function () { clicks = 0; }, 1400);
    if (clicks >= 3) {
      clicks = 0;
      var d = document.createElement("div");
      d.className = "dont-answer";
      d.innerHTML = "<span>不要回答！</span><span>不要回答！！</span><span>不要回答！！！</span><em>—— 1379 号监听员，来自四光年外的警告</em>";
      document.body.appendChild(d);
      setTimeout(function () { d.classList.add("show"); }, 20);
      setTimeout(function () {
        d.classList.remove("show");
        setTimeout(function () { d.remove(); }, 900);
      }, 2600);
    }
  });
})();
