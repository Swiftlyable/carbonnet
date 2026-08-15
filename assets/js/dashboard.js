/* ==========================================================================
   CarbonNet · dashboard.js —— 数据面板：KPI + 六类 ECharts 图表
   铁律：颜色一律从 chartTheme()（CSS 令牌）读取；主题切换即重建。
   ========================================================================== */
(function () {
  'use strict';

  var U = window.CN.util;
  var $ = U.$;

  var registry = []; /* {el, chart, build} */

  function reg(id, build) {
    var el = document.getElementById(id);
    if (el) registry.push({ el: el, chart: null, build: build });
  }

  /* ---------------- 各图表构建 ---------------- */
  function thCommon(th) {
    return {
      tooltip: {
        backgroundColor: th.tooltipBg,
        borderColor: th.tooltipBorder,
        textStyle: { color: th.tooltipText, fontFamily: th.font, fontSize: 12 },
      },
    };
  }

  reg('chart-annual', function () {
    var th = U.chartTheme();
    var st = window.CN.stats();
    var years = [];
    for (var y = st.yearMin; y <= st.yearMax; y++) years.push(y);
    var citesByYear = {};
    window.CN.papers.forEach(function (p) {
      if (p.year) citesByYear[p.year] = (citesByYear[p.year] || 0) + (p.citations || 0);
    });
    var ax = U.axisStyle(th);
    return Object.assign({
      backgroundColor: 'transparent',
      animationDuration: th.animation ? 700 : 0,
      grid: { left: 44, right: 52, top: 30, bottom: 34 },
      legend: { textStyle: { color: th.textColor, fontFamily: th.font }, top: 0 },
      xAxis: Object.assign({ type: 'category', data: years, boundaryGap: true }, ax),
      yAxis: [
        Object.assign({ type: 'value', name: '文献数', nameTextStyle: { color: th.textMuted } }, ax),
        Object.assign({
          type: 'value', name: '被引量', nameTextStyle: { color: th.textMuted },
          axisLabel: { color: th.textMuted, formatter: function (v) { return v >= 1000 ? (v / 1000) + 'k' : v; } },
          splitLine: { show: false }, axisLine: { show: true, lineStyle: { color: th.axisLine } },
        }, {}),
      ],
      series: [
        {
          name: '文献数', type: 'bar', data: years.map(function (y) { return st.yearCounts[y] || 0; }),
          itemStyle: { color: th.color[0], borderRadius: [3, 3, 0, 0] }, barMaxWidth: 22,
        },
        {
          name: '被引量', type: 'line', yAxisIndex: 1, smooth: true, symbol: 'none',
          data: years.map(function (y) { return citesByYear[y] || 0; }),
          lineStyle: { color: th.color[3], width: 2.5 },
          areaStyle: { color: th.color[3], opacity: 0.08 },
        },
      ],
    }, thCommon(th));
  });

  reg('chart-journals', function () {
    var th = U.chartTheme();
    var st = window.CN.stats();
    var list = st.journalList.slice(0, 15).slice().reverse();
    var ax = U.axisStyle(th);
    return Object.assign({
      backgroundColor: 'transparent',
      animationDuration: th.animation ? 700 : 0,
      grid: { left: 8, right: 44, top: 8, bottom: 8, containLabel: true },
      xAxis: Object.assign({ type: 'value', splitLine: { lineStyle: { color: th.splitLine } } }, {}),
      yAxis: Object.assign({
        type: 'category',
        data: list.map(function (j) { return j.name.length > 26 ? j.name.slice(0, 25) + '…' : j.name; }),
        axisLabel: { color: th.textColor, fontFamily: th.font, fontSize: 11 },
        axisLine: { show: false }, axisTick: { show: false },
      }, {}),
      series: [{
        type: 'bar',
        data: list.map(function (j) { return j.count; }),
        itemStyle: { color: th.color[1], borderRadius: [0, 3, 3, 0] },
        barMaxWidth: 14,
        label: { show: true, position: 'right', color: th.textMuted, fontFamily: th.font, fontSize: 10 },
      }],
    }, thCommon(th));
  });

  reg('chart-concepts', function () {
    var th = U.chartTheme();
    var st = window.CN.stats();
    var data = st.conceptList.slice(0, 26).map(function (c, i) {
      return { name: c.name, value: c.count, itemStyle: { color: th.color[i % th.color.length] } };
    });
    return Object.assign({
      backgroundColor: 'transparent',
      animationDuration: th.animation ? 700 : 0,
      series: [{
        type: 'treemap',
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        data: data,
        left: 0, right: 0, top: 0, bottom: 0,
        label: {
          show: true,
          color: th.tooltipText,
          fontFamily: th.font,
          fontSize: 11,
          formatter: function (p) {
            return p.name.length > 22 ? p.name.slice(0, 21) + '…' : p.name;
          },
        },
        itemStyle: { borderColor: U.tok('--bg'), borderWidth: 2, gapWidth: 2 },
        upperLabel: { show: false },
      }],
    }, thCommon(th));
  });

  reg('chart-heatmap', function () {
    var th = U.chartTheme();
    var st = window.CN.stats();
    var years = [];
    for (var y = st.yearMin; y <= st.yearMax; y++) years.push(y);
    var months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    var data = [];
    var max = 1;
    st.monthCounts && Object.keys(st.monthCounts).forEach(function (m) {
      var year = parseInt(m.slice(0, 4), 10);
      var month = parseInt(m.slice(5, 7), 10) - 1;
      if (year >= st.yearMin && year <= st.yearMax) {
        data.push([year - st.yearMin, month, st.monthCounts[m]]);
        if (st.monthCounts[m] > max) max = st.monthCounts[m];
      }
    });
    return Object.assign({
      backgroundColor: 'transparent',
      animationDuration: th.animation ? 700 : 0,
      grid: { left: 44, right: 16, top: 8, bottom: 40 },
      xAxis: {
        type: 'category', data: years,
        splitArea: { show: true },
        axisLabel: { color: th.textMuted, fontFamily: th.font, fontSize: 10, rotate: years.length > 18 ? 45 : 0 },
        axisLine: { lineStyle: { color: th.axisLine } },
      },
      yAxis: {
        type: 'category', data: months,
        splitArea: { show: true },
        axisLabel: { color: th.textMuted, fontFamily: th.font, fontSize: 10 },
        axisLine: { lineStyle: { color: th.axisLine } },
      },
      visualMap: {
        min: 0, max: max,
        calculable: false, show: false,
        inRange: { color: [U.tok('--surface-2'), th.color[0]] },
      },
      series: [{
        type: 'heatmap',
        data: data,
        itemStyle: { borderColor: U.tok('--bg'), borderWidth: 1.5 },
        emphasis: { itemStyle: { borderColor: th.accent, borderWidth: 2 } },
      }],
    }, thCommon(th));
  });

  reg('chart-hist', function () {
    var th = U.chartTheme();
    var st = window.CN.stats();
    var ax = U.axisStyle(th);
    return Object.assign({
      backgroundColor: 'transparent',
      animationDuration: th.animation ? 700 : 0,
      grid: { left: 40, right: 16, top: 24, bottom: 30 },
      xAxis: Object.assign({ type: 'category', data: st.hist.map(function (h) { return h.label; }) }, ax),
      yAxis: Object.assign({ type: 'value' }, ax),
      series: [{
        type: 'bar',
        data: st.hist.map(function (h, i) {
          return { value: h.count, itemStyle: { color: th.color[i % 2 === 0 ? 2 : 5], borderRadius: [3, 3, 0, 0] } };
        }),
        barMaxWidth: 34,
        label: { show: true, position: 'top', color: th.textMuted, fontFamily: th.font, fontSize: 10 },
      }],
    }, thCommon(th));
  });

  reg('chart-scatter', function () {
    var th = U.chartTheme();
    var data = window.CN.papers.filter(function (p) { return p.year > 0; }).map(function (p) {
      return {
        value: [p.year, p.citations + 1, p.citations, p.title, p.id],
        symbolSize: Math.max(4, Math.min(26, 4 + Math.sqrt(p.citations) * 0.9)),
      };
    });
    return Object.assign({
      backgroundColor: 'transparent',
      animationDuration: th.animation ? 700 : 0,
      grid: { left: 52, right: 24, top: 24, bottom: 34 },
      xAxis: {
        type: 'value', name: '年份',
        nameTextStyle: { color: th.textMuted },
        min: 'dataMin', max: 'dataMax',
        axisLabel: { color: th.textMuted, fontFamily: th.font },
        splitLine: { lineStyle: { color: th.splitLine } },
        axisLine: { lineStyle: { color: th.axisLine } },
      },
      yAxis: {
        type: 'log', logBase: 10, name: '被引 + 1',
        nameTextStyle: { color: th.textMuted },
        axisLabel: {
          color: th.textMuted, fontFamily: th.font,
          formatter: function (v) {
            if (v < 0) return '0';
            var n = Math.round(Math.pow(10, v) - 1);
            return n >= 1000 ? (n / 1000).toFixed(0) + 'k' : String(n);
          },
        },
        splitLine: { lineStyle: { color: th.splitLine } },
        axisLine: { lineStyle: { color: th.axisLine } },
      },
      series: [{
        type: 'scatter',
        data: data,
        itemStyle: { color: th.color[1], opacity: 0.55, borderColor: th.color[0], borderWidth: 0.5 },
        emphasis: { itemStyle: { opacity: 1 } },
      }],
      tooltip: {
        backgroundColor: th.tooltipBg,
        borderColor: th.tooltipBorder,
        textStyle: { color: th.tooltipText, fontFamily: th.font, fontSize: 12 },
        formatter: function (p) {
          var v = p.value;
          return '<b>' + v[3] + '</b><br/>' + v[0] + ' 年 · 被引 ' + U.fmt(v[2]) + '<br/><span style="opacity:.6">单击进入详情</span>';
        },
      },
    });
  });

  /* ---------------- 生命周期 ---------------- */
  function initAll() {
    registry.forEach(function (r) {
      r.chart = window.echarts.init(r.el, null, { renderer: 'canvas' });
      r.chart.setOption(r.build());
    });
  }
  function rebuildAll() {
    registry.forEach(function (r) {
      if (r.chart) r.chart.dispose();
      r.chart = window.echarts.init(r.el, null, { renderer: 'canvas' });
      r.chart.setOption(r.build());
    });
  }
  function bindClickNav() {
    registry.forEach(function (r) {
      if (r.el.id !== 'chart-scatter') return;
      r.chart.on('click', function (p) {
        if (p.seriesType === 'scatter' && p.value && p.value[4]) {
          window.location.href = 'paper.html?id=' + encodeURIComponent(p.value[4]);
        }
      });
    });
  }

  function kpi() {
    var st = window.CN.stats();
    $('#dk-papers').textContent = U.fmt(st.total);
    $('#dk-citations').textContent = st.citations >= 10000 ? (st.citations / 1000).toFixed(1) + 'K' : U.fmt(st.citations);
    $('#dk-avg').textContent = (st.citations / Math.max(1, st.total)).toFixed(1);
    $('#dk-abs').textContent = Math.round(st.withAbstract / Math.max(1, st.total) * 100) + '%';
    $('#dk-fetched').textContent = U.fmtDate(window.CN.meta.fetchedAt);
  }

  function boot() {
    if (!window.echarts) return;
    kpi();
    initAll();
    bindClickNav();
    window.addEventListener('cn:theme', rebuildAll);
    window.addEventListener('resize', U.debounce(function () {
      registry.forEach(function (r) { if (r.chart) r.chart.resize(); });
    }, 200));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
