/* ==========================================================================
   CarbonNet · graph.js —— 材料 × 策略 × 文献 三层力导向网络
   铁律 3 的实现：
   1) 自研物理模拟（环层锚点 + 斥力 + 弹簧），空闲时以 ~30fps 把新坐标
      经 setOption 推给 ECharts（layout:'none'，roam 由 ECharts 自管）；
   2) pointerdown→pointerup 期间【绝不 setOption】——物理冻结、待执行的
      setOption 一律排队，全部指针抬起后才冲刷；
   3) 点击导航 = chart click（校验位移 < 6px）+ pointerup 位移 < 6px 的
      convertFromPixel 命中兜底；拖拽(>6px)绝不导航。
   ========================================================================== */
(function () {
  'use strict';

  var U = window.CN.util;
  var $ = U.$;
  var RM = U.RM;

  var chart = null;
  var chartDom = null;
  var sim = null;           /* {nodes, links, cx, cy} */
  var itemById = {};        /* 最近一次完整 setOption 的节点项（更新坐标时复用，保住 label 等配置） */
  var rafId = null;
  var frame = 0;
  var converged = true;
  var firstPaint = false;

  var VISIBLE = { material: true, strategy: true, paper: true };
  var params = { repulsion: 1, edgeLen: 110, gravity: 0.018 };

  /* ---------------- 手势状态 ---------------- */
  var pointers = 0;
  var gesture = { moved: 0, sx: 0, sy: 0, fired: false };
  var pendingSet = null;

  /* ---------------- 数据构建 ---------------- */
  function buildData() {
    var flat = window.CN.flat;
    var mats = flat.filter(function (n) { return n.type === 'material'; });
    var strs = flat.filter(function (n) { return n.type === 'strategy'; });
    var papers = window.CN.papers.slice()
      .sort(function (a, b) { return b.citations - a.citations; })
      .slice(0, 64);

    var kept = [];
    papers.forEach(function (p) {
      var pm = [], ps = [];
      mats.forEach(function (m) { if (window.CN.tagMatch(p, m)) pm.push(m); });
      strs.forEach(function (s) { if (window.CN.tagMatch(p, s)) ps.push(s); });
      if (!pm.length && !ps.length) return;
      kept.push({ paper: p, mats: pm.slice(0, 2), strs: ps.slice(0, 2) });
    });

    var nodes = [];
    var links = [];
    var cross = {};

    mats.forEach(function (m) {
      nodes.push({ id: 'm:' + m.tag, name: m.name, en: m.en, type: 'material', tag: m.tag, layer: 0 });
    });
    strs.forEach(function (s) {
      nodes.push({ id: 's:' + s.tag, name: s.name, en: s.en, type: 'strategy', tag: s.tag, layer: 1 });
    });
    kept.forEach(function (k) {
      var p = k.paper;
      nodes.push({ id: 'p:' + p.id, name: p.title, paper: p, type: 'paper', layer: 2 });
    });

    kept.forEach(function (k) {
      var pid = 'p:' + k.paper.id;
      k.mats.forEach(function (m) { links.push({ s: 'm:' + m.tag, t: pid, kind: 'paper' }); });
      k.strs.forEach(function (s) { links.push({ s: 's:' + s.tag, t: pid, kind: 'paper' }); });
      k.mats.forEach(function (m) {
        k.strs.forEach(function (s) {
          var key = 'm:' + m.tag + '|s:' + s.tag;
          cross[key] = (cross[key] || 0) + 1;
        });
      });
    });
    Object.keys(cross).sort(function (a, b) { return cross[b] - cross[a]; }).slice(0, 16).forEach(function (key) {
      var parts = key.split('|');
      links.push({ s: parts[0], t: parts[1], kind: 'cross' });
    });

    place(nodes);
    return { nodes: nodes, links: links, cx: 560, cy: 380 };
  }

  /* 环层初始位置：内环材料 / 中环策略 / 外环文献 */
  function place(nodes) {
    var cx = 560, cy = 380;
    var rings = { 0: 180, 1: 350, 2: 560 };
    var cnt = { 0: 0, 1: 0, 2: 0 };
    var at = { 0: 0, 1: 0, 2: 0 };
    nodes.forEach(function (n) { cnt[n.layer]++; });
    nodes.forEach(function (n) {
      var l = n.layer;
      var a = (at[l] / cnt[l]) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
      at[l]++;
      n.x = cx + Math.cos(a) * rings[l] + (Math.random() - 0.5) * 40;
      n.y = cy + Math.sin(a) * rings[l] + (Math.random() - 0.5) * 40;
      n.vx = 0; n.vy = 0;
      n.homeA = a; n.homeR = rings[l];
    });
  }

  /* ---------------- 物理模拟（一个 tick） ---------------- */
  function tick() {
    var nodes = sim.nodes;
    var i, j, n, m, dx, dy, d, f;

    /* 斥力（近邻截断） */
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      for (j = i + 1; j < nodes.length; j++) {
        m = nodes[j];
        dx = n.x - m.x; dy = n.y - m.y;
        d = dx * dx + dy * dy;
        if (d > 270 * 270) continue;
        d = Math.sqrt(d) || 0.01;
        f = params.repulsion * 1300 / (d * d);
        f = Math.min(f, 2.2);
        dx /= d; dy /= d;
        n.vx += dx * f; n.vy += dy * f;
        m.vx -= dx * f; m.vy -= dy * f;
      }
    }

    /* 弹簧（文献—节点、策略—材料共现） */
    var idx = {};
    nodes.forEach(function (n) { idx[n.id] = n; });
    sim.links.forEach(function (L) {
      var s = idx[L.s], t = idx[L.t];
      if (!s || !t) return;
      var len = L.kind === 'cross' ? params.edgeLen * 2.2 : params.edgeLen;
      dx = t.x - s.x; dy = t.y - s.y;
      d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      f = (d - len) * 0.0045;
      dx /= d; dy /= d;
      s.vx += dx * f; s.vy += dy * f;
      t.vx -= dx * f; t.vy -= dy * f;
    });

    /* 环层锚点（保持三层结构） */
    nodes.forEach(function (n) {
      var hx = sim.cx + Math.cos(n.homeA) * n.homeR;
      var hy = sim.cy + Math.sin(n.homeA) * n.homeR;
      n.vx += (hx - n.x) * params.gravity;
      n.vy += (hy - n.y) * params.gravity;
    });

    /* 积分 */
    var speed = 0;
    nodes.forEach(function (n) {
      n.vx *= 0.82; n.vy *= 0.82;
      n.vx = Math.max(-6, Math.min(6, n.vx));
      n.vy = Math.max(-6, Math.min(6, n.vy));
      n.x += n.vx; n.y += n.vy;
      speed += Math.abs(n.vx) + Math.abs(n.vy);
    });
    return speed / nodes.length;
  }

  /* ---------------- 渲染 ---------------- */
  function nodeColor(type) {
    var t = U.tok;
    if (type === 'material') return t('--c2');
    if (type === 'strategy') return t('--c3');
    return t('--c4');
  }
  function sizeFor(n) {
    if (n.type === 'paper') {
      var s = 4 + Math.sqrt((n.paper && n.paper.citations) || 0) * 0.35;
      return Math.max(3.5, Math.min(15, s));
    }
    return 13;
  }

  function buildOption(animate) {
    var th = U.chartTheme();
    var mono = U.tok('--font-mono');

    itemById = {};
    var data = sim.nodes.map(function (n) {
      var it = {
        id: n.id,
        name: n.name,
        x: n.x, y: n.y,
        category: n.type === 'material' ? 0 : (n.type === 'strategy' ? 1 : 2),
        symbolSize: sizeFor(n),
        itemStyle: { color: nodeColor(n.type), borderColor: U.tok('--bg'), borderWidth: 1.5, opacity: n.type === 'paper' ? 0.85 : 1 },
      };
      if (n.type !== 'paper') {
        it.label = {
          show: true,
          position: 'right',
          distance: 7,
          formatter: function () {
            return '{n|' + n.name + '}\n{e|' + (n.en || '') + '}';
          },
          rich: {
            n: { color: th.textColor, fontSize: 12, fontWeight: 600, fontFamily: th.font },
            e: { color: th.textMuted, fontSize: 9.5, fontFamily: mono },
          },
        };
      }
      itemById[n.id] = it;
      return it;
    });

    var linkData = sim.links.map(function (L) {
      return {
        source: L.s, target: L.t,
        lineStyle: {
          color: L.kind === 'cross' ? th.axisLine : th.splitLine,
          width: L.kind === 'cross' ? 1.6 : 1,
          type: L.kind === 'cross' ? 'dashed' : 'solid',
          opacity: L.kind === 'cross' ? 0.55 : 0.7,
          curveness: 0.18,
        },
      };
    });

    return {
      backgroundColor: 'transparent',
      animationDuration: animate ? 700 : 0,
      animationDurationUpdate: animate ? 300 : 0,
      tooltip: {
        backgroundColor: th.tooltipBg,
        borderColor: th.tooltipBorder,
        textStyle: { color: th.tooltipText, fontFamily: th.font, fontSize: 12 },
        formatter: function (p) {
          if (p.dataType !== 'node') return '';
          var n = sim.nodes[p.dataIndex];
          if (!n) return p.name;
          if (n.type === 'paper') {
            var pp = n.paper;
            return '<b>' + n.name + '</b><br/>' + (pp.journal || '') + ' · ' + pp.year +
              '<br/>被引 ' + U.fmt(pp.citations) + '<br/><span style="opacity:.6">单击打开论文详情</span>';
          }
          return '<b>' + n.name + '</b> · ' + (n.en || '') + '<br/><span style="opacity:.6">单击进入文献库筛选</span>';
        },
      },
      series: [{
        type: 'graph',
        layout: 'none',
        roam: true,
        scaleLimit: { min: 0.25, max: 4 },
        data: data,
        links: linkData,
        symbol: 'circle',
        lineStyle: { color: th.splitLine, width: 1, opacity: 0.7, curveness: 0.18 },
        emphasis: {
          focus: 'adjacency',
          blurScope: 'coordinateSystem',
          itemStyle: { borderColor: th.accent, borderWidth: 2 },
          label: { show: true, position: 'right', distance: 6, color: th.textColor, fontSize: 12 },
        },
        categories: [
          { name: '材料' },
          { name: '策略' },
          { name: '文献' },
        ],
      }],
    };
  }

  function pushPositions() {
    if (!chart || !sim) return;
    chart.setOption({
      series: [{
        animation: false,
        data: sim.nodes.map(function (n) {
          var it = itemById[n.id];
          return it ? Object.assign({}, it, { x: n.x, y: n.y }) : { id: n.id, x: n.x, y: n.y };
        }),
      }],
    });
  }

  /* 安全 setOption：手势期间排队，指针全部抬起后执行（铁律 3-1） */
  function safeSetOption(fn) {
    if (pointers > 0) { pendingSet = fn; return; }
    pendingSet = null;
    fn();
  }

  /* ---------------- 动画循环 ---------------- */
  function loop() {
    rafId = requestAnimationFrame(loop);
    if (pointers > 0 || RM || document.hidden) return; /* 手势期间：物理与 setOption 全冻结 */
    var speed = tick();
    frame++;
    if (frame % 2 === 0) pushPositions();
    if (frame > 1200 || (frame > 40 && speed < 0.28)) {
      stopLoop();
    }
  }
  function stopLoop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    converged = true;
    if (chart && sim) pushPositions(); /* 收尾定格 */
  }
  function wake() {
    converged = false;
    frame = 0;
    if (!rafId && !RM) rafId = requestAnimationFrame(loop);
  }

  /* ---------------- 导航（铁律 3-2/3-3） ---------------- */
  function navTo(n) {
    if (!n) return;
    if (n.type === 'paper' && n.paper) {
      window.location.href = 'paper.html?id=' + encodeURIComponent(n.paper.id);
    } else if (n.tag) {
      window.location.href = 'library.html?tag=' + encodeURIComponent(n.tag);
    }
  }
  function hitTest(clientX, clientY) {
    try {
      var r = chartDom.getBoundingClientRect();
      var pt = chart.convertFromPixel({ seriesIndex: 0 }, [clientX - r.left, clientY - r.top]);
      if (pt && Array.isArray(pt) && pt[0] >= 0) {
        var n = sim.nodes[pt[0]];
        if (n) { gesture.fired = true; navTo(n); }
      }
    } catch (e) { /* ignore */ }
  }

  function bindGestures() {
    if (!chartDom) return;
    chartDom.addEventListener('pointerdown', function (e) {
      pointers++;
      gesture.moved = 0;
      gesture.sx = e.clientX;
      gesture.sy = e.clientY;
      gesture.fired = false;
    });
    document.addEventListener('pointermove', function (e) {
      if (pointers <= 0) return;
      var d = Math.hypot(e.clientX - gesture.sx, e.clientY - gesture.sy);
      if (d > gesture.moved) gesture.moved = d;
    });
    document.addEventListener('pointerup', function (e) {
      if (pointers <= 0) return;
      pointers--;
      if (pointers > 0) return; /* 多指触控：等全部抬起 */
      var moved = gesture.moved;
      var cx = e.clientX, cy = e.clientY;
      setTimeout(function () {
        if (pendingSet) { var f = pendingSet; pendingSet = null; f(); }
        wake();
        if (moved < 6 && !gesture.fired) hitTest(cx, cy); /* 兜底导航 */
      }, 60);
    });
    document.addEventListener('pointercancel', function () {
      pointers = 0;
      gesture.moved = 0;
      if (pendingSet) { var f = pendingSet; pendingSet = null; f(); }
      wake();
    });
  }

  /* ---------------- 控制条 ---------------- */
  function bindControls() {
    ['material', 'strategy', 'paper'].forEach(function (key) {
      var btn = document.querySelector('[data-toggle="' + key + '"]');
      if (!btn) return;
      btn.addEventListener('click', function () {
        VISIBLE[key] = !VISIBLE[key];
        btn.classList.toggle('on', VISIBLE[key]);
        btn.classList.toggle('off', !VISIBLE[key]);
        safeSetOption(function () {
          rebuild(true);
        });
      });
    });
    function slider(id, key, valId, digits) {
      var el = $(id), val = $(valId);
      if (!el) return;
      el.addEventListener('input', function () {
        params[key] = parseFloat(el.value);
        val.textContent = parseFloat(el.value).toFixed(digits);
        wake();
      });
    }
    slider('#ctl-repulsion', 'repulsion', '#val-repulsion', 1);
    slider('#ctl-len', 'edgeLen', '#val-len', 0);
    slider('#ctl-gravity', 'gravity', '#val-gravity', 3);

    var shuffle = $('#btn-shuffle');
    if (shuffle) shuffle.addEventListener('click', function () {
      safeSetOption(function () {
        place(sim.nodes);
        chart.setOption(buildOption(true));
        wake();
      });
    });
    var restore = $('#btn-restore');
    if (restore) restore.addEventListener('click', function () {
      if (chart) chart.dispatchAction({ type: 'restore' });
    });
  }

  /* ---------------- 重建（含层级过滤） ---------------- */
  function rebuild(animate) {
    var raw = buildData();
    sim = {
      nodes: raw.nodes.filter(function (n) {
        return VISIBLE[n.type === 'paper' ? 'paper' : n.type];
      }),
      links: [],
      cx: raw.cx,
      cy: raw.cy,
    };
    var keep = {};
    sim.nodes.forEach(function (n) { keep[n.id] = true; });
    raw.links.forEach(function (L) {
      if (keep[L.s] && keep[L.t]) sim.links.push(L);
    });
    firstPaint = true;
    chart.setOption(buildOption(animate && !RM));
    if (RM) {
      var i;
      for (i = 0; i < 500; i++) tick();
      pushPositions();
    } else {
      wake();
    }
  }

  function bindChartEvents() {
    chart.on('click', function (p) {
      if (gesture.moved >= 6) return;      /* 拖拽不导航（铁律 3-3） */
      if (p.dataType === 'node') {
        gesture.fired = true;
        var n = sim.nodes[p.dataIndex];
        navTo(n);
      }
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    chartDom = $('#graph-chart');
    if (!chartDom || !window.echarts) return;
    chart = window.echarts.init(chartDom, null, { renderer: 'canvas' });
    bindGestures();
    bindControls();
    bindChartEvents();
    rebuild(true);

    window.addEventListener('cn:theme', function () {
      safeSetOption(function () {
        chart.dispose();
        chart = window.echarts.init(chartDom, null, { renderer: 'canvas' });
        bindChartEvents();
        rebuild(!RM);
      });
    });
    window.addEventListener('resize', U.debounce(function () {
      if (chart) chart.resize();
    }, 200));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
