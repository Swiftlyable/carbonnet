/* ============================================================
   CarbonNet — 数据面板 (stats.js)
   铁律提醒：改动后 stats.html 中 ?v=N 必须 +1。
   所有图表颜色经 chartTheme() 从 CSS 令牌读取。
   铁律 4：文献数据渲染一律 textContent。
   ============================================================ */
(function () {
  'use strict';
  const C = window.CarbonNet;
  const { el } = C;

  function yearlyOption(s, theme) {
    const years = s.yearly.map((y) => String(y.year));
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['文献数', '累计被引'], top: 0 },
      grid: { left: 44, right: 44, top: 34, bottom: 28 },
      xAxis: { type: 'category', data: years, axisLabel: { rotate: years.length > 16 ? 45 : 0 } },
      yAxis: [
        { type: 'value', name: '文献数', splitLine: { lineStyle: { color: theme.valueAxis.splitLine.lineStyle.color } } },
        { type: 'value', name: '被引', splitLine: { show: false } },
      ],
      series: [
        { name: '文献数', type: 'bar', data: s.yearly.map((y) => y.count), itemStyle: { color: theme.color[0], borderRadius: [3, 3, 0, 0] }, barMaxWidth: 18 },
        { name: '累计被引', type: 'line', yAxisIndex: 1, data: s.yearly.map((y) => y.cited), itemStyle: { color: theme.color[3] }, lineStyle: { width: 2 }, smooth: true },
      ],
    };
  }

  function venuesOption(s, theme) {
    const data = [...s.venues].reverse();
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 8, right: 30, top: 8, bottom: 24 },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: theme.valueAxis.splitLine.lineStyle.color } } },
      yAxis: { type: 'category', data: data.map((v) => v.name), axisLabel: { fontSize: 10, width: 150, overflow: 'truncate' } },
      series: [{ type: 'bar', data: data.map((v) => v.count), itemStyle: { color: theme.color[1], borderRadius: [0, 3, 3, 0] }, barMaxWidth: 14 }],
    };
  }

  function heatOption(s, theme) {
    const max = Math.max(1, ...s.heatmap.data.map((d) => d[2]));
    return {
      tooltip: {
        position: 'top',
        formatter: (p) => `${C.escapeHtml(s.heatmap.x[p.value[0]])} × ${C.escapeHtml(s.heatmap.y[p.value[1]])}<br>文献数：${p.value[2]}`,
      },
      grid: { left: 110, right: 20, top: 8, bottom: 60 },
      xAxis: { type: 'category', data: s.heatmap.x, axisLabel: { rotate: 30, fontSize: 10 } },
      yAxis: { type: 'category', data: s.heatmap.y, axisLabel: { fontSize: 11 } },
      visualMap: {
        min: 0, max, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
        inRange: { color: [theme.color[1], theme.color[0]] },
        textStyle: { color: theme.textStyle.color, fontSize: 10 },
      },
      series: [{
        type: 'heatmap', data: s.heatmap.data,
        label: { show: true, color: theme.textStyle.color, fontSize: 9 },
        emphasis: { itemStyle: { borderColor: theme.color[3], borderWidth: 1 } },
      }],
    };
  }

  function citedOption(s, theme) {
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 40, right: 16, top: 8, bottom: 24 },
      xAxis: { type: 'category', data: s.citedHist.bins, axisLabel: { fontSize: 10 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: theme.valueAxis.splitLine.lineStyle.color } } },
      series: [{ type: 'bar', data: s.citedHist.hist, itemStyle: { color: theme.color[4], borderRadius: [3, 3, 0, 0] }, barMaxWidth: 30 }],
    };
  }

  function capOption(s, theme) {
    const values = s.capFg || [];
    const bins = [
      { label: '≤100', lo: 0, hi: 100 }, { label: '101-200', lo: 101, hi: 200 },
      { label: '201-300', lo: 201, hi: 300 }, { label: '301-400', lo: 301, hi: 400 },
      { label: '401-600', lo: 401, hi: 600 }, { label: '>600', lo: 601, hi: Infinity },
    ];
    const counts = bins.map((b) => values.filter((v) => v >= b.lo && v <= b.hi).length);
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps) => `${ps[0].name}：${ps[0].value} 个样本` },
      grid: { left: 40, right: 16, top: 8, bottom: 24 },
      xAxis: { type: 'category', data: bins.map((b) => b.label), axisLabel: { fontSize: 10 } },
      yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: theme.valueAxis.splitLine.lineStyle.color } } },
      series: [{ type: 'bar', data: counts, itemStyle: { color: theme.color[2], borderRadius: [3, 3, 0, 0] }, barMaxWidth: 34 }],
    };
  }

  function pieOption(s, theme) {
    const typeData = (s.types || []).map((t) => ({ name: t.name, value: t.count }));
    const oaData = (s.oa || []).map((t) => ({ name: t.name, value: t.count }));
    return {
      tooltip: { trigger: 'item', formatter: (p) => `${C.escapeHtml(p.name)}：${p.value}（${p.percent}%）` },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      series: [
        {
          name: '类型', type: 'pie', radius: ['0%', '38%'], center: ['22%', '44%'],
          data: typeData, label: { show: false },
          itemStyle: { borderColor: 'transparent', borderWidth: 2 },
        },
        {
          name: 'OA', type: 'pie', radius: ['0%', '38%'], center: ['74%', '44%'],
          data: oaData, label: { show: false },
          itemStyle: { borderColor: 'transparent', borderWidth: 2 },
        },
      ],
    };
  }

  async function main() {
    C.initEntrance();
    let s, works;
    try {
      [s, works] = await Promise.all([C.fetchData('stats'), C.loadWorks()]);
    } catch (e) {
      document.querySelector('.chart-grid').replaceChildren(el('div', { class: 'state-note err', text: `数据加载失败：${e.message}` }));
      return;
    }
    document.getElementById('capN').textContent = String((s.capFg || []).length);
    C.registerChart('chartYearly', (t) => yearlyOption(s, t));
    C.registerChart('chartVenues', (t) => venuesOption(s, t));
    C.registerChart('chartHeat', (t) => heatOption(s, t));
    C.registerChart('chartCited', (t) => citedOption(s, t));
    C.registerChart('chartCap', (t) => capOption(s, t));
    C.registerChart('chartPie', (t) => pieOption(s, t));

    /* 高被引 Top 10 */
    const list = document.getElementById('topList');
    const top = [...works].sort((a, b) => (b.cited || 0) - (a.cited || 0)).slice(0, 10);
    top.forEach((w, i) => {
      const item = el('div', { class: 'paper-item enter' });
      item.append(el('div', { class: `rank${i < 3 ? ' hot' : ''}`, text: String(i + 1).padStart(2, '0') }));
      const body = el('div', { class: 'paper-body' });
      body.append(el('a', { class: 'paper-title', href: `paper.html?id=${encodeURIComponent(w.id)}`, text: w.title }));
      body.append(el('div', { class: 'paper-meta' }, [
        el('span', { text: `▸ ${C.fmtYear(w.year)}` }),
        el('span', { text: `▸ ${w.venue || '—'}` }),
        el('span', null, ['被引 ', el('b', { text: C.fmtNum(w.cited) })]),
      ]));
      item.append(body);
      list.append(item);
    });
    C.animateIn(document);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();
})();
