/* ============================================================
   CarbonNet — 首页 (index.js)
   铁律提醒：改动后 index.html 中 ?v=N 必须 +1。
   铁律 4：文献数据渲染一律 textContent（经 CarbonNet.el）。
   ============================================================ */
(function () {
  'use strict';
  const C = window.CarbonNet;
  const { el } = C;

  /* ---------------- Hero 粒子画布 ---------------- */
  function initParticles() {
    if (C.REDUCED.matches) return;
    const canvas = document.getElementById('heroCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, raf = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const hex = (v) => {
      const s = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
      return s.startsWith('#') ? s : '#7CC7FF';
    };
    let accent = hex('--c-accent');
    const hexToRgb = (h) => {
      const m = h.replace('#', '');
      return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
    };
    let [ar, ag, ab] = hexToRgb(accent);
    const particles = [];
    function size() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const n = Math.min(110, Math.round((W * H) / 14000));
      particles.length = 0;
      for (let i = 0; i < n; i++) {
        particles.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.32, vy: (Math.random() - 0.5) * 0.32,
          r: 0.8 + Math.random() * 1.5,
        });
      }
    }
    function frame() {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 16900) {
            const alpha = (1 - d2 / 16900) * 0.16;
            ctx.strokeStyle = `rgba(${ar},${ag},${ab},${alpha.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const p of particles) {
        ctx.fillStyle = `rgba(${ar},${ag},${ab},${(0.25 + p.r * 0.12).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    size();
    frame();
    window.addEventListener('resize', size);
    window.addEventListener('themechange', () => {
      accent = hex('--c-accent');
      const [r, g, b] = hexToRgb(accent);
      ar = r; ag = g; ab = b;
    });
  }

  /* ---------------- 标语带 ---------------- */
  function initMarquee() {
    const m = document.getElementById('marquee');
    if (!m) return;
    const items = [
      'GRAPHENE FOAM', '3D CONDUCTIVE NETWORK', 'HIERARCHICAL POROUS CARBON', 'FREEZE-DRYING',
      'N-DOPING', 'ENERGY DENSITY', 'CARBON NANOTUBE ARRAY', 'MXENE HYBRID', 'FLEXIBLE DEVICE',
      'BIOMASS-DERIVED CARBON', 'CVD GROWTH', 'RATE CAPABILITY', 'AEROGEL ELECTRODE', 'SELF-ASSEMBLY',
    ];
    const half = items.map((t) => el('span', null, [el('b', { text: t.split(' ')[0] }), ` ${t.split(' ').slice(1).join(' ')} `]));
    m.append(...half, ...half.map((n) => n.cloneNode(true))); /* 双份实现无缝循环 */
  }

  /* ---------------- 渲染 ---------------- */
  function paperItem(w, opts) {
    const { rank, hot } = opts || {};
    const item = el('div', { class: 'paper-item enter' });
    if (rank !== undefined) item.append(el('div', { class: `rank${hot ? ' hot' : ''}`, text: String(rank).padStart(2, '0') }));
    const body = el('div', { class: 'paper-body' });
    body.append(el('a', { class: 'paper-title', href: `paper.html?id=${encodeURIComponent(w.id)}`, text: w.title }));
    const meta = el('div', { class: 'paper-meta' }, [
      el('span', { text: `▸ ${C.fmtYear(w.year)}` }),
      el('span', { text: `▸ ${w.venue || '—'}` }),
      el('span', null, ['被引 ', el('b', { text: C.fmtNum(w.cited) })]),
    ]);
    body.append(meta, el('div', { class: 'paper-authors', text: C.shortAuthors(w.authors, 3) }));
    const tags = el('div', { class: 'paper-tags' });
    w.tags.slice(0, 4).forEach((t) => {
      const zh = C.TAG_ZH[t];
      if (zh) tags.append(el('a', { class: 'tag', href: `library.html?tag=${encodeURIComponent(t)}`, text: zh.zh }));
    });
    body.append(tags);
    item.append(body);
    return item;
  }

  async function main() {
    initParticles();
    initMarquee();
    C.initEntrance();

    let works, stats;
    try {
      [works, stats] = await Promise.all([C.loadWorks(), C.fetchData('stats')]);
    } catch (e) {
      document.getElementById('latestList')?.replaceChildren(el('div', { class: 'state-note err', text: `数据加载失败：${e.message}` }));
      return;
    }

    /* KPI */
    const k = stats.kpi || {};
    document.getElementById('kpiWorks').textContent = C.fmtNum(k.works);
    document.getElementById('kpiCited').textContent = C.fmtNum(k.citations);
    document.getElementById('kpiVenues').textContent = C.fmtNum(k.venues);
    const span = k.years ? (k.years.max - k.years.min + 1) : 0;
    document.getElementById('kpiYears').textContent = String(span);
    const meta = await C.fetchData('meta').catch(() => null);
    if (meta?.generated_at) {
      document.getElementById('kpiUpdated').textContent = `更新于 ${meta.generated_at.slice(0, 10)}`;
    }

    /* 最新文献：按发表日期倒序 */
    const latest = [...works]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 8);
    const list = document.getElementById('latestList');
    latest.forEach((w, i) => list.append(paperItem(w, { rank: i + 1, hot: i < 3 })));

    /* 热门标签云 */
    const freq = new Map();
    for (const w of works) for (const t of w.tags) freq.set(t, (freq.get(t) || 0) + 1);
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    const cloud = document.getElementById('tagCloud');
    const maxN = top[0] ? top[0][1] : 1;
    for (const [t, n] of top) {
      const zh = C.TAG_ZH[t];
      if (!zh) continue;
      const size = 12 + Math.round((n / maxN) * 7);
      cloud.append(el('a', {
        class: 'tag', href: `library.html?tag=${encodeURIComponent(t)}`,
        style: { fontSize: `${size}px` },
      }, [zh.zh, el('span', { class: 'tag-count', text: String(n) })]));
    }

    /* 精选经典：被引 top 6 */
    const classic = [...works].sort((a, b) => (b.cited || 0) - (a.cited || 0)).slice(0, 6);
    const grid = document.getElementById('classicGrid');
    for (const w of classic) {
      const card = el('div', { class: 'card card-hover enter' });
      card.append(el('a', { class: 'paper-title', href: `paper.html?id=${encodeURIComponent(w.id)}`, text: w.title }));
      card.append(el('div', { class: 'paper-meta' }, [
        el('span', { text: `▸ ${C.fmtYear(w.year)}` }),
        el('span', { text: `▸ 被引 ${C.fmtNum(w.cited)}` }),
      ]));
      card.append(el('div', { class: 'paper-authors', text: w.venue || '' }));
      const tags = el('div', { class: 'paper-tags' });
      w.tags.slice(0, 3).forEach((t) => {
        const zh = C.TAG_ZH[t];
        if (zh) tags.append(el('span', { class: 'badge badge-accent', text: zh.zh }));
      });
      card.append(tags);
      grid.append(card);
    }

    C.animateIn(document);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();
})();
