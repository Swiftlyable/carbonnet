/* ==========================================================================
   CarbonNet · taxonomy.js —— 知识脉络树图 + 详情面板
   面板关闭：× 按钮 / 点击空白（veil）/ Esc。
   铁律 4：所有文献数据经 textContent 渲染。
   ========================================================================== */
(function () {
  'use strict';

  var U = window.CN.util;
  var $ = U.$;
  var chart = null;
  var openNode = null;

  var TYPE_LABEL = {
    root: '根节点', branch: '分支',
    material: '碳材料体系', strategy: '网络构建策略',
    device: '器件与性能', application: '应用场景',
  };

  /* ---- 组装 ECharts 树数据（附带节点负载） ---- */
  function buildTreeData(node, depth) {
    var out = {
      name: node.name,
      en: node.en || '',
      type: node.type || 'leaf',
      tag: node.tag || '',
      desc: node.desc || '',
      match: node.match || [],
      depth: depth,
    };
    if (node.children && node.children.length) {
      out.children = node.children.map(function (c) { return buildTreeData(c, depth + 1); });
    }
    return out;
  }

  function nodeColor(type) {
    var t = U.tok;
    if (type === 'root') return t('--accent');
    if (type === 'branch') return t('--c5');
    if (type === 'material') return t('--c2');
    if (type === 'strategy') return t('--c3');
    if (type === 'device') return t('--c4');
    return t('--c6');
  }
  /* ECharts 回调签名：symbolSize(value, params)，节点数据在 params.data */
  function symbolSize(value, params) {
    var t = params && params.data ? params.data.type : 'leaf';
    if (t === 'root') return 16;
    if (t === 'branch') return 12;
    return 9;
  }

  /* ---- 图表选项 ---- */
  function buildOption() {
    var th = U.chartTheme();
    var tree = buildTreeData(window.CN.taxonomy, 0);
    return {
      backgroundColor: 'transparent',
      animationDuration: th.animation ? 600 : 0,
      animationDurationUpdate: th.animation ? 400 : 0,
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        backgroundColor: th.tooltipBg,
        borderColor: th.tooltipBorder,
        textStyle: { color: th.tooltipText, fontFamily: th.font, fontSize: 12 },
        formatter: function (p) {
          var d = p.data;
          return '<b>' + d.name + '</b> · ' + (d.en || '') + '<br/>' + (TYPE_LABEL[d.type] || '');
        },
      },
      series: [{
        type: 'tree',
        data: [tree],
        left: '3%', right: '16%', top: '3%', bottom: '4%',
        layout: 'orthogonal',
        orient: 'LR',
        roam: true,
        expandAndCollapse: true,
        initialTreeDepth: 2,
        symbol: 'circle',
        symbolSize: symbolSize,
        itemStyle: {
          color: function (p) { return nodeColor(p.data.type); },
          borderColor: U.tok('--bg'),
          borderWidth: 2,
        },
        lineStyle: { color: th.splitLine, width: 1.4, curveness: 0.5 },
        label: {
          position: 'right',
          distance: 10,
          align: 'left',
          verticalAlign: 'middle',
          formatter: function (p) {
            return '{n|' + p.data.name + '}\n{e|' + (p.data.en || '') + '}';
          },
          rich: {
            n: {
              color: th.textColor, fontSize: 13, fontWeight: 600,
              fontFamily: th.font, lineHeight: 18,
            },
            e: {
              color: th.textMuted, fontSize: 10,
              fontFamily: U.tok('--font-mono'), lineHeight: 14,
            },
          },
        },
        emphasis: { focus: 'descendant' },
      }],
    };
  }

  function initChart() {
    var el = $('#taxo-chart');
    if (!el || !window.echarts) return;
    if (chart) { chart.dispose(); chart = null; }
    chart = window.echarts.init(el, null, { renderer: 'canvas' });
    chart.setOption(buildOption());
    chart.on('click', function (p) {
      if (p.dataType === 'node') openPanel(p.data);
    });
  }

  /* ---- 详情面板 ---- */
  function collectTerms(n) {
    if (n.children && n.children.length) {
      var acc = [];
      n.children.forEach(function (c) { acc = acc.concat(collectTerms(c)); });
      return acc;
    }
    return n.match || [];
  }

  function relatedPapers(node) {
    var terms = collectTerms(node);
    var items = window.CN.papers.filter(function (p) {
      return window.CN.tagMatch(p, { match: terms });
    }).sort(function (a, b) { return b.citations - a.citations; }).slice(0, 6);
    return items;
  }

  function openPanel(node) {
    openNode = node;
    $('#dp-type').textContent = TYPE_LABEL[node.type] || '节点';
    $('#dp-title').textContent = node.name;
    $('#dp-en').textContent = node.en || '';
    var desc = node.desc || '';
    if (node.type === 'root') desc = desc + ' 全站文献均围绕这一体系组织，可在文献库按脉络标签筛选。';
    $('#dp-desc').textContent = desc;

    /* 相关文献 */
    var relBox = $('#dp-rel');
    relBox.textContent = '';
    var items = relatedPapers(node);
    if (!items.length) {
      var none = document.createElement('p');
      none.className = 'dp-desc';
      none.textContent = '暂无直接匹配的文献。';
      relBox.appendChild(none);
    }
    items.forEach(function (p) {
      var a = document.createElement('a');
      a.href = 'paper.html?id=' + encodeURIComponent(p.id);
      var t = document.createElement('div');
      t.className = 't';
      t.textContent = p.title;
      var m = document.createElement('div');
      m.className = 'dp-rel-meta';
      m.textContent = (p.journal || '') + ' · ' + p.year + ' · 被引 ' + U.fmt(p.citations);
      a.appendChild(t); a.appendChild(m);
      relBox.appendChild(a);
    });

    /* CTA */
    var cta = $('#dp-cta');
    if (node.tag) {
      cta.href = 'library.html?tag=' + encodeURIComponent(node.tag);
      cta.textContent = '在文献库中查看「' + node.name + '」→';
    } else {
      cta.href = 'library.html';
      cta.textContent = '进入文献库 →';
    }

    $('#panel-veil').classList.add('open');
    $('#panel-veil').setAttribute('aria-hidden', 'false');
    $('#detail-panel').classList.add('open');
    $('#dp-close').focus();
  }

  function closePanel() {
    openNode = null;
    $('#panel-veil').classList.remove('open');
    $('#panel-veil').setAttribute('aria-hidden', 'true');
    $('#detail-panel').classList.remove('open');
  }

  function initPanel() {
    $('#dp-close').addEventListener('click', closePanel);
    $('#panel-veil').addEventListener('click', closePanel);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('#detail-panel').classList.contains('open')) closePanel();
    });
  }

  /* ---- 启动 ---- */
  function boot() {
    initPanel();
    initChart();
    window.addEventListener('cn:theme', function () {
      if (chart) initChart(); /* 换令牌即换肤：重建图表 */
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
