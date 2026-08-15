/* ==========================================================================
   CarbonNet · home.js —— 首页：粒子画布、KPI 计数、最新文献、标签云、经典文献
   铁律 4：文献数据渲染一律 textContent / createElement，杜绝 innerHTML 注入。
   ========================================================================== */
(function () {
  'use strict';

  var U = window.CN.util;
  var RM = U.RM;
  var $ = U.$;

  /* ---------------- 1. Hero 粒子画布 ---------------- */
  function initParticles() {
    var cv = document.getElementById('hero-canvas');
    if (!cv) return;
    var c2d = cv.getContext('2d');
    var W = 0, H = 0, DPR = 1;
    var parts = [];
    var raf = null;
    var pointer = { x: -9999, y: -9999 };
    var theme = { dot: U.tok('--accent'), line: U.tok('--accent'), soft: U.tok('--text-3') };

    function size() {
      var rect = cv.parentElement.getBoundingClientRect();
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = rect.width; H = rect.height;
      cv.width = W * DPR; cv.height = H * DPR;
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      c2d.setTransform(DPR, 0, 0, DPR, 0, 0);
      initParts();
    }
    function initParts() {
      var n = Math.min(110, Math.max(36, Math.floor((W * H) / 15000)));
      parts = [];
      for (var i = 0; i < n; i++) {
        parts.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r: Math.random() * 1.6 + 0.7,
        });
      }
    }
    function frame() {
      c2d.clearRect(0, 0, W, H);
      var i, j, p, q, dx, dy, d;
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        /* 指针轻微斥力 */
        dx = p.x - pointer.x; dy = p.y - pointer.y;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d < 130 && d > 0.01) {
          var f = (130 - d) / 130 * 0.06;
          p.vx += (dx / d) * f; p.vy += (dy / d) * f;
        }
        p.vx *= 0.985; p.vy *= 0.985;
        if (Math.abs(p.vx) < 0.02 && Math.abs(p.vy) < 0.02) {
          p.vx = (Math.random() - 0.5) * 0.3;
          p.vy = (Math.random() - 0.5) * 0.3;
        }
        p.x += p.vx; p.y += p.vy;
        if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
      }
      /* 连线 */
      c2d.lineWidth = 1;
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        for (j = i + 1; j < parts.length; j++) {
          q = parts[j];
          dx = p.x - q.x; dy = p.y - q.y;
          d = dx * dx + dy * dy;
          if (d < 115 * 115) {
            var a = (1 - Math.sqrt(d) / 115) * 0.4;
            c2d.strokeStyle = theme.line;
            c2d.globalAlpha = a;
            c2d.beginPath();
            c2d.moveTo(p.x, p.y);
            c2d.lineTo(q.x, q.y);
            c2d.stroke();
          }
        }
      }
      /* 节点 */
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        c2d.globalAlpha = 0.85;
        c2d.fillStyle = theme.dot;
        c2d.beginPath();
        c2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c2d.fill();
      }
      c2d.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    function drawStatic() {
      c2d.clearRect(0, 0, W, H);
      var i, j, p, q, dx, dy, d;
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        for (j = i + 1; j < parts.length; j++) {
          q = parts[j];
          dx = p.x - q.x; dy = p.y - q.y;
          d = dx * dx + dy * dy;
          if (d < 115 * 115) {
            c2d.globalAlpha = (1 - Math.sqrt(d) / 115) * 0.35;
            c2d.strokeStyle = theme.line;
            c2d.beginPath();
            c2d.moveTo(p.x, p.y);
            c2d.lineTo(q.x, q.y);
            c2d.stroke();
          }
        }
      }
      c2d.globalAlpha = 0.85;
      c2d.fillStyle = theme.dot;
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        c2d.beginPath();
        c2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c2d.fill();
      }
      c2d.globalAlpha = 1;
    }
    function start() {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    size();
    if (RM) { drawStatic(); } else { start(); }

    /* 主题切换：重取令牌颜色（不动结构） */
    window.addEventListener('cn:theme', function () {
      theme.dot = U.tok('--accent');
      theme.line = U.tok('--accent');
      if (RM) drawStatic();
    });

    window.addEventListener('resize', U.debounce(function () {
      size();
      if (RM) drawStatic();
    }, 200));

    cv.parentElement.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
    });
    cv.parentElement.addEventListener('pointerleave', function () {
      pointer.x = -9999; pointer.y = -9999;
    });

    document.addEventListener('visibilitychange', function () {
      if (RM) return;
      if (document.hidden) stop(); else start();
    });
  }

  /* ---------------- 2. KPI 计数（尊重弱动效） ---------------- */
  function countUp(el, target, fmtFn) {
    el.textContent = fmtFn(0);
    if (RM) { el.textContent = fmtFn(target); return; }
    var t0 = performance.now();
    var dur = 1300;
    function step(t) {
      var p = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmtFn(Math.round(target * e));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function compact(n) {
    if (n >= 10000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  /* ---------------- 3. 最新文献列表 ---------------- */
  function renderLatest() {
    var box = $('#latest-list');
    if (!box) return;
    var latest = window.CN.papers.slice()
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); })
      .slice(0, 6);

    latest.forEach(function (p, i) {
      var row = document.createElement('a');
      row.className = 'lit-row';
      row.href = 'paper.html?id=' + encodeURIComponent(p.id);
      row.setAttribute('data-anim', 'rise');

      var idx = document.createElement('div');
      idx.className = 'lit-idx';
      idx.textContent = String(i + 1).padStart(2, '0');

      var main = document.createElement('div');
      main.className = 'lit-main';
      var title = document.createElement('span');
      title.className = 'lit-title';
      title.textContent = p.title;
      var sub = document.createElement('div');
      sub.className = 'lit-sub';
      var auth = document.createElement('span');
      auth.textContent = (p.authors || []).slice(0, 3).map(function (a) { return a.name; }).join(' · ');
      var sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '·';
      var jr = document.createElement('span');
      jr.textContent = p.journal || '';
      sub.appendChild(auth); sub.appendChild(sep); sub.appendChild(jr);
      main.appendChild(title); main.appendChild(sub);

      var side = document.createElement('div');
      side.className = 'lit-side';
      var yr = document.createElement('span');
      yr.className = 'lit-year';
      yr.textContent = p.year || '—';
      var cite = document.createElement('span');
      cite.className = 'lit-cite';
      cite.textContent = U.fmt(p.citations) + ' 引';
      side.appendChild(yr); side.appendChild(cite);

      row.appendChild(idx); row.appendChild(main); row.appendChild(side);
      U.animStagger(row, i, 60); /* 先设延迟再插入，保证错峰生效 */
      box.appendChild(row);
    });
  }

  /* ---------------- 4. 热门标签云 ---------------- */
  function renderCloud() {
    var box = $('#tag-cloud');
    if (!box) return;
    var tags = window.CN.tagCloud(42);
    var max = tags.length ? tags[0].count : 1;
    tags.forEach(function (t) {
      var a = document.createElement('a');
      a.className = 'tcloud-tag';
      a.href = 'library.html?tag=' + encodeURIComponent(t.tag);
      a.textContent = t.tag;
      var ratio = t.count / max;
      a.style.fontSize = (12 + ratio * 17).toFixed(1) + 'px';
      a.style.opacity = (0.55 + ratio * 0.45).toFixed(2);
      a.title = t.tag + ' · ' + t.count + ' 篇';
      box.appendChild(a);
    });
  }

  /* ---------------- 5. 精选 / 经典文献 ---------------- */
  function renderClassics() {
    var grid = $('#classics-grid');
    if (!grid) return;
    var curated = window.CN.papers.filter(function (p) { return p.curated; })
      .sort(function (a, b) { return (a.curated || 99) - (b.curated || 99); });

    curated.forEach(function (p, i) {
      var card = document.createElement('article');
      card.className = 'card card-hover paper-card';
      card.setAttribute('data-anim', 'rise');

      var meta = document.createElement('div');
      meta.className = 'p-meta';
      var yr = document.createElement('span');
      yr.className = 'lit-year';
      yr.textContent = String(p.year || '');
      var jr = document.createElement('span');
      jr.className = 'journal';
      jr.textContent = p.journal || '';
      var badge = document.createElement('span');
      badge.className = 'badge-curated';
      badge.textContent = '经典 · 中文解读';
      meta.appendChild(yr); meta.appendChild(jr); meta.appendChild(badge);

      var title = document.createElement('a');
      title.className = 'p-title';
      title.href = 'paper.html?id=' + encodeURIComponent(p.id);
      title.textContent = p.title;

      var desc = document.createElement('p');
      desc.className = 'p-desc';
      desc.textContent = p.zh_abstract || p.abstract || '';

      var foot = document.createElement('div');
      foot.className = 'p-foot';
      var authors = document.createElement('span');
      authors.className = 'p-authors';
      authors.textContent = (p.authors || []).slice(0, 2).map(function (a) { return a.name; }).join(', ');
      var cite = document.createElement('span');
      cite.className = 'p-cite';
      cite.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12a8 8 0 0 1 16 0M12 4v4M8.5 8.5l2.5 2.5M15.5 8.5L13 11"/></svg>';
      cite.appendChild(document.createTextNode(U.fmt(p.citations)));
      foot.appendChild(authors); foot.appendChild(cite);

      card.appendChild(meta); card.appendChild(title); card.appendChild(desc); card.appendChild(foot);
      U.animStagger(card, i, 70); /* 先设延迟再插入，保证错峰生效 */
      grid.appendChild(card);
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    var st = window.CN.stats();
    $('#hero-count').textContent = st.total + ' 篇文献';
    countUp($('#kpi-papers'), st.total, function (n) { return String(n); });
    countUp($('#kpi-citations'), st.citations, compact);
    $('#kpi-years').textContent = st.yearMin + '–' + st.yearMax;
    $('#kpi-classics').textContent = String(st.curated);
    renderLatest();
    renderCloud();
    renderClassics();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initParticles(); boot(); });
  } else {
    initParticles(); boot();
  }
})();
