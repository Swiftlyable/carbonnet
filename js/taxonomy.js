/* ============================================================
   CarbonNet — 知识脉络 (taxonomy.js)
   铁律提醒：改动后 taxonomy.html 中 ?v=N 必须 +1。
   铁律 3 相关：点击导航用 chart click + pointerup 位移 <6px 兜底，
   拖拽（>6px）不打开面板。
   铁律 4：面板内容一律 textContent 渲染。
   ============================================================ */
(function () {
  'use strict';
  const C = window.CarbonNet;
  const { el } = C;

  /* ---------------- 详情面板 ---------------- */
  const drawer = () => document.getElementById('drawer');
  const mask = () => document.getElementById('drawerMask');
  let currentNode = null;

  function openDrawer(node) {
    currentNode = node;
    const t = document.getElementById('drawerTitle');
    const eb = document.getElementById('drawerEyebrow');
    const desc = document.getElementById('drawerDesc');
    const metaRow = document.getElementById('drawerMeta');
    const body = document.getElementById('drawerBody');
    t.textContent = node.name || '—';
    eb.textContent = node.paper ? 'REPRESENTATIVE PAPER · 代表文献' : (node.depthLabel || 'NODE');
    desc.textContent = node.zh || '';
    metaRow.replaceChildren(
      el('span', { class: 'badge', text: `文献 ${C.fmtNum(node.value)}` }),
      ...(node.depth ? [el('span', { class: 'badge', text: `深度 ${node.depth}` })] : []),
    );
    const frag = [];
    if (node.paper) {
      frag.push(el('p', { style: { color: 'var(--c-text-dim)', fontSize: '13.5px' } },
        '这是该类别下的高被引代表文献。'));
      frag.push(el('a', { class: 'btn btn-primary btn-sm', href: `paper.html?id=${encodeURIComponent(node.key)}`, text: '查看论文详情 →' }));
    } else if (node.children && node.children.length) {
      const subs = node.children.filter((c) => !c.paper);
      const papers = node.children.filter((c) => c.paper);
      if (subs.length) {
        frag.push(el('p', { style: { marginBottom: '8px', color: 'var(--c-text-dim)', fontSize: '13px' }, text: '子类别' }));
        const chips = el('div', { class: 'tag-cloud', style: { marginBottom: '14px' } });
        for (const s of subs) {
          chips.append(el('button', {
            class: 'tag', onclick: () => openDrawer(s),
          }, [s.name, el('span', { class: 'tag-count', text: String(s.value) })]));
        }
        frag.push(chips);
      }
      if (papers.length) {
        frag.push(el('p', { style: { marginBottom: '8px', color: 'var(--c-text-dim)', fontSize: '13px' }, text: '代表文献' }));
        const ul = el('div', {});
        for (const p of papers) {
          ul.append(el('a', {
            class: 'sim-item', href: `paper.html?id=${encodeURIComponent(p.key)}`,
            style: { display: 'flex' },
          }, [
            el('span', { class: 'sim-score', text: `▸` }),
            el('span', { class: 'sim-title', text: p.name }),
            el('span', { class: 'sim-meta', text: `被引 ${C.fmtNum(p.value)}` }),
          ]));
        }
        frag.push(ul);
      }
    } else {
      frag.push(el('p', { style: { color: 'var(--c-text-faint)', fontSize: '13px' }, text: '暂无细分数据。' }));
    }
    body.replaceChildren(...frag);
    drawer().classList.add('open');
    mask().classList.add('open');
  }

  function closeDrawer() {
    drawer().classList.remove('open');
    mask().classList.remove('open');
    currentNode = null;
  }

  function initDrawer() {
    document.getElementById('drawerClose').addEventListener('click', closeDrawer);
    mask().addEventListener('click', closeDrawer);
    document.addEventListener('carbonnet:esc', closeDrawer);
  }

  /* ---------------- 树图 ---------------- */
  function buildOption(data, theme) {
    const depthName = (d) => (d === 0 ? '根' : d === 1 ? '维度' : d === 2 ? '类别' : '文献');
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p) => {
          const d = p.data;
          const parts = [`<b>${C.escapeHtml(d.name || '')}</b>`];
          if (d.zh) parts.push(C.escapeHtml(d.zh));
          parts.push(`文献数：${C.fmtNum(d.value)}`);
          return parts.join('<br>');
        },
      },
      series: [{
        type: 'tree',
        data: [data],
        top: '4%', bottom: '4%', left: '3%', right: '6%',
        layout: 'orthogonal',
        orient: 'LR',
        roam: true,
        expandAndCollapse: true,
        initialTreeDepth: 2,
        symbol: 'circle',
        symbolSize: (v, p) => {
          if (p.data.paper) return 7;
          if (p.data.depth === 1) return 20;
          if (p.data.depth === 2) return 13;
          return 24;
        },
        itemStyle: (p) => {
          if (p.data.paper) return { color: theme.color[3], borderColor: theme.color[3], borderWidth: 1 };
          if (p.data.depth === 1) return { color: theme.color[0], borderColor: theme.color[1], borderWidth: 2 };
          if (p.data.depth === 2) return { color: theme.color[2], borderColor: theme.color[2], borderWidth: 1 };
          return { color: theme.color[0], borderColor: theme.color[1], borderWidth: 2 };
        },
        label: {
          position: 'right',
          verticalAlign: 'middle',
          align: 'left',
          fontSize: (p) => (p.data.paper ? 10 : p.data.depth === 1 ? 14 : 12),
          fontWeight: (p) => (p.data.depth === 1 ? 600 : 400),
          color: (p) => (p.data.paper ? theme.textStyle.color : (p.data.depth === 1 ? theme.color[0] : theme.textStyle.color)),
          formatter: (p) => {
            const n = p.data.name || '';
            return n.length > 26 ? `${n.slice(0, 26)}…` : n;
          },
        },
        lineStyle: { color: theme.color[1], width: 1, opacity: 0.55, curveness: 0.6 },
        emphasis: { focus: 'descendant' },
        leaves: { label: { position: 'right' } },
        animationDuration: 420,
        animationDurationUpdate: 520,
        animationEasingUpdate: 'cubicOut',
      }],
    };
  }

  async function main() {
    C.initEntrance();
    initDrawer();
    let tax;
    try {
      tax = await C.fetchData('taxonomy');
    } catch (e) {
      document.getElementById('taxChart').replaceChildren(el('div', { class: 'state-note err', text: `数据加载失败：${e.message}` }));
      return;
    }
    /* 标注节点深度 */
    (function walk(n, d) {
      n.depth = d;
      n.depthLabel = d === 0 ? '根节点' : d === 1 ? '维度' : d === 2 ? '类别' : '文献';
      (n.children || []).forEach((c) => walk(c, d + 1));
    })(tax, 0);

    const reg = C.registerChart('taxChart', (theme) => buildOption(tax, theme));
    if (!reg) return;
    const { chart } = reg;

    /* 手势位移兜底：拖拽 >6px 不打开面板（铁律 3） */
    let downX = 0, downY = 0, down = false;
    const zr = chart.getZr();
    zr.on('pointerdown', (e) => { down = true; downX = e.offsetX; downY = e.offsetY; });
    zr.on('pointerup', (e) => {
      if (!down) return;
      down = false;
      const dist = Math.hypot(e.offsetX - downX, e.offsetY - downY);
      if (dist >= 6) zr._carbonnetDrag = true;
      setTimeout(() => { zr._carbonnetDrag = false; }, 0);
    });
    zr.on('click', (e) => {
      if (zr._carbonnetDrag) return;
      /* 点到空白区域（没有 target）→ 关闭面板 */
      if (!e.target) { closeDrawer(); return; }
    });
    chart.on('click', (p) => {
      if (zr._carbonnetDrag) return;
      if (p.data && p.data.name !== undefined) openDrawer(p.data);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();
})();
