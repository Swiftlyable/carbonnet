/* ============================================================
   CarbonNet — 知识关系图 (graph.js)
   铁律提醒：改动后 graph.html 中 ?v=N 必须 +1。
   铁律 3：力导向图在手势（pointerdown/up/move）期间绝不 setOption
   （否则布局重启、节点点击失效）；点击导航用 chart click +
   pointerup 位移 <6px 兜底，拖拽（>6px）不导航。
   ============================================================ */
(function () {
  'use strict';
  const C = window.CarbonNet;
  const { el } = C;

  const CATS = {
    material: { name: '材料体系', colorIdx: 0 },
    strategy: { name: '构筑策略', colorIdx: 2 },
    paper: { name: '文献', colorIdx: 3 },
  };

  function buildOption(data, theme) {
    const colorFor = (cat) => theme.color[CATS[cat] ? CATS[cat].colorIdx : 4];
    const nodes = data.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      category: n.category,
      symbolSize: n.size,
      value: n.cited,
      zh: n.zh || '',
      count: n.count,
      year: n.year,
      venue: n.venue || '',
      itemStyle: { color: colorFor(n.category), borderColor: colorFor(n.category), borderWidth: n.category === 'paper' ? 0 : 1.5, opacity: n.category === 'paper' ? 0.85 : 1 },
      label: { show: n.category !== 'paper', position: 'right', fontSize: 13, fontWeight: 600, color: colorFor(n.category), formatter: (p) => p.data.name },
    }));
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p) => {
          const d = p.data;
          if (d.category === 'paper') {
            return [`<b>${C.escapeHtml(d.name)}</b>`,
              `${C.escapeHtml(d.venue || '')} · ${C.fmtYear(d.year)}`,
              `被引 ${C.fmtNum(d.value)}`,
              '<span style="opacity:.7">点击进入论文详情</span>'].join('<br>');
          }
          return [`<b>${C.escapeHtml(d.name)}</b>`,
            C.escapeHtml(d.zh || ''),
            `关联文献 ${C.fmtNum(d.count)}`,
            '<span style="opacity:.7">点击跳转文献库筛选</span>'].join('<br>');
        },
      },
      series: [{
        type: 'graph',
        layout: 'force',
        data: nodes,
        links: data.links,
        categories: Object.entries(CATS).map(([k, v]) => ({ name: v.name })),
        roam: true,
        draggable: true,
        scaleLimit: { min: 0.15, max: 6 },
        force: {
          repulsion: 130,
          edgeLength: [30, 110],
          gravity: 0.055,
          friction: 0.6,
          layoutAnimation: true,
        },
        emphasis: {
          focus: 'adjacency',
          label: { show: true, fontSize: 12 },
          itemStyle: { borderWidth: 2 },
        },
        lineStyle: { color: theme.color[1], opacity: 0.16, width: 1, curveness: 0.15 },
        label: { show: false, color: theme.textStyle.color, fontSize: 11 },
        animationDuration: 800,
        animationEasingUpdate: 'cubicOut',
      }],
    };
  }

  async function main() {
    C.initEntrance();
    let data;
    try {
      data = await C.fetchData('graph');
    } catch (e) {
      document.getElementById('graphChart').replaceChildren(el('div', { class: 'state-note err', text: `数据加载失败：${e.message}` }));
      return;
    }
    const reg = C.registerChart('graphChart', (theme) => buildOption(data, theme));
    if (!reg) return;
    const { chart } = reg;
    const info = document.getElementById('graphInfo');
    info.textContent = `${data.nodes.length} 节点 · ${data.links.length} 条边 · 力导向布局`;

    /* ---------- 铁律 3：手势状态机 ----------
       pointerdown 记录起点；pointermove 位移 >6px 判定为拖拽；
       拖拽与手势期间绝不 setOption；click 只在非拖拽时导航。 */
    let down = false;
    let downX = 0, downY = 0;
    let moved = false;
    const zr = chart.getZr();
    zr.on('pointerdown', (e) => {
      down = true; moved = false;
      downX = e.offsetX; downY = e.offsetY;
    });
    zr.on('pointermove', (e) => {
      if (!down) return;
      if (Math.hypot(e.offsetX - downX, e.offsetY - downY) > 6) moved = true;
    });
    zr.on('pointerup', () => {
      down = false;
      /* click 在 pointerup 之后派发：延迟一帧再复位 moved，保证 click 处理时状态有效 */
      setTimeout(() => { if (!down) moved = false; }, 0);
    });

    /* 点击导航：位移 <6px 才生效 */
    chart.on('click', (p) => {
      if (moved) return;
      const d = p.data;
      if (!d) return;
      if (d.category === 'paper') {
        location.href = `paper.html?id=${encodeURIComponent(d.id)}`;
      } else if (d.category === 'material' || d.category === 'strategy') {
        const key = d.id.replace(/^(mat|str)-/, '');
        location.href = `library.html?tag=${encodeURIComponent(key)}`;
      }
    });

    /* 工具栏：仅在手势结束（非拖拽中）时允许 setOption（铁律 3） */
    const resetBtn = document.getElementById('graphReset');
    const centerBtn = document.getElementById('graphCenter');
    const resetGraph = () => {
      if (down || moved) return;
      const opt = reg.getOption();
      /* 删除已收敛坐标，让力导向重新布局；notMerge 完整重建并复位视图 */
      opt.series[0].data = opt.series[0].data.map(({ x, y, ...rest }) => rest);
      chart.setOption(opt, { notMerge: true });
      chart.resize();
    };
    if (resetBtn) resetBtn.addEventListener('click', resetGraph);
    if (centerBtn) centerBtn.addEventListener('click', resetGraph);

    /* 收敛提示 */
    let settled = false;
    chart.on('finished', () => {
      if (!settled && !C.REDUCED.matches) {
        settled = true;
        info.textContent += ' · 布局已收敛，可拖拽微调';
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();
})();
