/* ============================================================
   CarbonNet 碳网图谱 — 共享脚本 (common.js)
   铁律提醒：本文件每次改动后，引用它的 HTML 中 ?v=N 必须 +1。
   铁律 4：所有文献数据渲染一律 textContent（见 el() 的 text 属性），
   禁止用 innerHTML 拼接动态数据。
   ============================================================ */
(function () {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------- 标签词典（与 scripts/fetch-data.mjs 保持一致） ---------------- */
  const MATERIALS = {
    graphene: { zh: '石墨烯及衍生物' }, cnt: { zh: '碳纳米管' }, biomass: { zh: '生物质衍生碳' },
    mof: { zh: 'MOF 衍生碳' }, porous: { zh: '多孔碳/活性炭' }, aerogel: { zh: '碳气凝胶/泡沫' },
    fiber: { zh: '碳纤维/织物' }, otherc: { zh: '其他碳材料' },
  };
  const STRATEGIES = {
    template: { zh: '模板法' }, assembly: { zh: '自组装' }, print3d: { zh: '3D 打印/增材' },
    cvd: { zh: 'CVD 气相沉积' }, freeze: { zh: '冷冻干燥' }, spin: { zh: '静电纺丝' },
    doping: { zh: '杂原子掺杂' }, activation: { zh: '活化造孔' }, hybrid: { zh: '复合杂化' },
  };
  const DEVICE = {
    asymmetric: { zh: '非对称/对称器件' }, flexible: { zh: '柔性/可穿戴' }, solid: { zh: '固态/凝胶电解质' },
    energyd: { zh: '高能量密度' }, powerd: { zh: '高功率密度' }, cycling: { zh: '循环稳定性' },
    sensing: { zh: '储能-传感一体化' },
  };
  const TAG_ZH = { ...MATERIALS, ...STRATEGIES, ...DEVICE };
  const M_KEYS = Object.keys(MATERIALS);
  const S_KEYS = Object.keys(STRATEGIES);
  const D_KEYS = Object.keys(DEVICE);

  /* ---------------- 工具：DOM 构建（动态文本一律 textContent，防 XSS） ---------------- */
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = String(v); /* 防 XSS 核心 */
        else if (k === 'html') { /* 仅允许受控静态片段；动态数据禁用 */
          if (attrs._allowHtml) node.innerHTML = v; else throw new Error('html attr requires _allowHtml (XSS guard)');
        }
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k === 'style') Object.assign(node.style, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, String(v));
      }
    }
    if (children) {
      for (const c of [].concat(children)) {
        if (c === null || c === undefined) continue;
        node.append(c.nodeType ? c : document.createTextNode(String(c)));
      }
    }
    return node;
  }

  /* 搜索高亮：DOM 文本节点拆分包裹 <mark>，不拼 HTML（防 XSS） */
  function highlightTerm(node, term) {
    if (!term) return;
    const t = term.trim().toLowerCase();
    if (!t) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && n.parentElement.closest('script,style,mark') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const hits = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const idx = n.textContent.toLowerCase().indexOf(t);
      if (idx >= 0) hits.push({ n, idx });
    }
    for (const { n, idx } of hits) {
      const range = document.createRange();
      range.setStart(n, idx);
      range.setEnd(n, idx + t.length);
      const mark = document.createElement('mark');
      range.surroundContents(mark);
    }
  }

  /* ---------------- 工具：格式化 ---------------- */
  const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US'));
  const fmtYear = (y) => (y ? String(y) : '—');
  /* HTML 转义：用于 ECharts tooltip 等必须以 HTML 输出的通道 */
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shortAuthors = (authors, max = 3) => {
    if (!authors || !authors.length) return '—';
    const names = authors.slice(0, max);
    const suffix = authors.length > max ? ' et al.' : '';
    return names.map((a) => a.split(' ').slice(-1)[0]).join(', ') + suffix;
  };

  /* ---------------- 主题 ---------------- */
  function currentTheme() {
    const saved = localStorage.getItem('carbonnet-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('carbonnet-theme', t);
    document.querySelectorAll('.theme-toggle').forEach((b) => {
      b.textContent = t === 'dark' ? '☾' : '☀';
      b.setAttribute('aria-label', t === 'dark' ? '切换到浅色主题' : '切换到深色主题');
    });
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: t } }));
  }
  function toggleTheme() { applyTheme(currentTheme() === 'dark' ? 'light' : 'dark'); }

  /* ---------------- ECharts 主题（从 CSS 令牌读取，改令牌即换肤） ---------------- */
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function chartTheme() {
    return {
      color: ['--chart-p1', '--chart-p2', '--chart-p3', '--chart-p4', '--chart-p5', '--chart-p6', '--chart-p7', '--chart-p8'].map(cssVar),
      backgroundColor: 'transparent',
      textStyle: { color: cssVar('--chart-text'), fontFamily: cssVar('--font-mono') },
      title: { textStyle: { color: cssVar('--c-heading'), fontFamily: cssVar('--font-display') }, subtextStyle: { color: cssVar('--chart-text') } },
      legend: { textStyle: { color: cssVar('--chart-text') }, inactiveColor: cssVar('--c-text-faint') },
      tooltip: {
        backgroundColor: cssVar('--c-bg-raised'),
        borderColor: cssVar('--c-border-strong'),
        textStyle: { color: cssVar('--c-text') },
        extraCssText: 'box-shadow: var(--shadow-pop); border-radius: 10px;',
      },
      categoryAxis: {
        axisLine: { lineStyle: { color: cssVar('--chart-axis') } },
        axisTick: { lineStyle: { color: cssVar('--chart-axis') } },
        axisLabel: { color: cssVar('--chart-text') },
        splitLine: { lineStyle: { color: cssVar('--chart-split') } },
      },
      valueAxis: {
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: cssVar('--chart-text') },
        splitLine: { lineStyle: { color: cssVar('--chart-split') } },
      },
      grid: { borderColor: cssVar('--chart-axis') },
    };
  }

  /* 图表注册帮助：主题切换时 dispose + 重建（图表颜色随令牌换肤） */
  function registerChart(id, buildOption) {
    const dom = document.getElementById(id);
    if (!dom || !window.echarts) return null;
    let chart = echarts.init(dom, null, { renderer: 'canvas' });
    let opt = buildOption(chartTheme());
    chart.setOption(opt);
    const resize = () => chart && chart.resize();
    window.addEventListener('resize', resize);
    window.addEventListener('themechange', () => {
      if (!chart) return;
      chart.dispose();
      chart = echarts.init(dom, null, { renderer: 'canvas' });
      opt = buildOption(chartTheme());
      chart.setOption(opt);
    });
    return { chart, getOption: () => opt, refresh: (o) => { opt = o; if (chart) chart.setOption(opt); } };
  }

  /* ---------------- 数据加载 ---------------- */
  const dataCache = {};
  async function fetchData(name) {
    if (!dataCache[name]) dataCache[name] = fetch(`data/${name}.json`).then((r) => {
      if (!r.ok) throw new Error(`data/${name}.json ${r.status}`);
      return r.json();
    });
    return dataCache[name];
  }
  async function loadWorks() { return fetchData('works'); }

  /* ---------------- 入场动画（铁律 2：播完退役） ---------------- */
  function initEntrance(root) {
    const scope = root || document;
    const reduce = REDUCED.matches;
    /* 错峰 stagger：容器 [data-stagger]，子元素依次入场 */
    scope.querySelectorAll('[data-stagger]').forEach((container) => {
      const step = parseFloat(container.dataset.stagger || getComputedStyle(document.documentElement).getPropertyValue('--stagger-step')) || 55;
      [...container.children].forEach((child, i) => {
        child.classList.add('enter-fade');
        child.style.animationDelay = reduce ? '0s' : `${i * step}ms`;
      });
    });
    scope.querySelectorAll('.enter, .enter-fade').forEach((node) => {
      if (reduce) { node.classList.add('entered'); return; }
      if (getComputedStyle(node).animationName === 'none') node.classList.add('entered');
    });
    /* animationend 统一退役（冒泡监听，动态插入的节点同样生效） */
    scope.addEventListener('animationend', (e) => {
      const t = e.target;
      if (t && t.classList && (t.classList.contains('enter') || t.classList.contains('enter-fade'))) {
        t.classList.add('entered'); /* .entered { animation: none !important } */
      }
    });
  }
  /* 动态内容渲染后调用：新节点重演入场 */
  function animateIn(container) {
    const reduce = REDUCED.matches;
    [...container.querySelectorAll('.enter, .enter-fade, [data-stagger] > *')].forEach((node, i) => {
      node.classList.remove('entered');
      if (!node.style.animationDelay && node.parentElement?.hasAttribute('data-stagger')) {
        node.style.animationDelay = reduce ? '0s' : `${i * 55}ms`;
      }
      if (reduce) node.classList.add('entered');
    });
  }

  /* ---------------- 导航 ---------------- */
  function initNav() {
    const here = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (href === here || (here === '' && href === 'index.html')) a.classList.add('active');
      else if (href.startsWith(here.split('.')[0] + '?')) a.classList.add('active');
    });
    const toggle = document.querySelector('.nav-toggle');
    if (toggle) toggle.addEventListener('click', () => {
      const links = document.querySelector('.nav-links');
      if (links) links.classList.toggle('open');
    });
  }

  /* ---------------- toast ---------------- */
  function toast(msg, type, ms) {
    let stack = document.querySelector('.toast-stack');
    if (!stack) { stack = el('div', { class: 'toast-stack' }); document.body.append(stack); }
    const node = el('div', { class: `toast ${type || ''}`, text: msg });
    stack.append(node);
    setTimeout(() => {
      node.style.transition = 'opacity .3s, transform .3s';
      node.style.opacity = '0';
      setTimeout(() => node.remove(), 320);
    }, ms || 2600);
  }

  /* ---------------- BYOK AI 助手核心（铁律 5） ----------------
     密钥只存浏览器 localStorage；浏览器直连 api.siliconflow.cn；
     密钥绝不进代码仓库、不引第三方脚本。 */
  const AI_KEY_STORE = 'carbonnet-siliconflow-key';
  const AI_MODEL_STORE = 'carbonnet-siliconflow-model';
  const AI_MODELS = [
    { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3（推荐）' },
    { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5-72B' },
    { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen2.5-7B（快）' },
  ];
  function getApiKey() { try { return localStorage.getItem(AI_KEY_STORE) || ''; } catch { return ''; } }
  function setApiKey(k) { try { k ? localStorage.setItem(AI_KEY_STORE, k) : localStorage.removeItem(AI_KEY_STORE); } catch { /* 私密模式降级 */ } }
  function getAiModel() { try { return localStorage.getItem(AI_MODEL_STORE) || AI_MODELS[0].id; } catch { return AI_MODELS[0].id; } }
  function setAiModel(m) { try { localStorage.setItem(AI_MODEL_STORE, m); } catch { /* 私密模式降级 */ } }
  async function aiChat(messages, opts = {}) {
    const key = getApiKey();
    if (!key) { const e = new Error('未设置硅基流动 API Key'); e.code = 'no-key'; throw e; }
    const res = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: opts.model || getAiModel(),
        messages,
        temperature: opts.temperature ?? 0.6,
        max_tokens: opts.maxTokens ?? 2048,
        stream: false,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      const e = new Error(`API ${res.status}：${t.slice(0, 180)}`);
      e.code = 'api';
      throw e;
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    if (!text) { const e = new Error('API 返回为空'); e.code = 'api'; throw e; }
    return text;
  }

  /* ---------------- CSV 导出（文献库） ---------------- */
  function downloadCsv(filename, rows) {
    const esc = (v) => {
      let s = v == null ? '' : String(v);
      /* 防 CSV 公式注入：trim 后以 = + - @ 开头的前置单引号（表格软件会 trim 单元格） */
      if (/^[=+\-@\t]/.test(s.trim())) s = "'" + s.trimStart();
      if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const csv = '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = el('a', { href: URL.createObjectURL(blob), download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ---------------- 公共导出 ---------------- */
  window.CarbonNet = {
    REDUCED,
    MATERIALS, STRATEGIES, DEVICE, TAG_ZH, M_KEYS, S_KEYS, D_KEYS,
    el, highlightTerm, fmtNum, fmtYear, shortAuthors, escapeHtml,
    currentTheme, applyTheme, toggleTheme, chartTheme, registerChart,
    fetchData, loadWorks, initEntrance, animateIn, initNav, toast, downloadCsv,
    getApiKey, setApiKey, getAiModel, setAiModel, aiChat, AI_MODELS,
  };

  /* ---------------- 启动 ---------------- */
  document.documentElement.classList.remove('no-js');
  applyTheme(currentTheme());
  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    document.querySelectorAll('.theme-toggle').forEach((b) => b.addEventListener('click', toggleTheme));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.dispatchEvent(new CustomEvent('carbonnet:esc'));
    });
  });
})();
