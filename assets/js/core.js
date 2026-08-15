/* ==========================================================================
   CarbonNet · core.js —— 全站共享核心
   - 主题系统：localStorage 记忆 + prefers-color-scheme 兜底 + cn:theme 事件
   - chartTheme()：ECharts 颜色一律从 CSS 令牌读取（改 tokens.css 即全站换肤）
   - 动效退役（铁律 2）：[data-anim] 元素 animationend 后置
     animation:none !important；绝不在 :hover 上动 animation
   - 导航 / Toast / 工具函数
   ========================================================================== */
(function () {
  'use strict';

  var RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function fmt(n) {
    n = Number(n) || 0;
    return n.toLocaleString('en-US');
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------------- 主题 ---------------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('cn.theme', t); } catch (e) { /* 隐私模式 */ }
    window.dispatchEvent(new CustomEvent('cn:theme', { detail: { theme: t } }));
  }
  function initTheme() {
    var t = null;
    try { t = localStorage.getItem('cn.theme'); } catch (e) { /* 隐私模式 */ }
    if (t !== 'dark' && t !== 'light') {
      t = (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', t);
    /* 跟随系统变化（用户未手动选择时） */
    try {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function (e) {
        if (!localStorage.getItem('cn.theme')) {
          document.documentElement.setAttribute('data-theme', e.matches ? 'light' : 'dark');
          window.dispatchEvent(new CustomEvent('cn:theme', { detail: { theme: e.matches ? 'light' : 'dark' } }));
        }
      });
    } catch (e) { /* ignore */ }
  }
  initTheme();

  /* ---------------- ECharts 令牌主题（铁律：颜色从令牌读取） ---------------- */
  var tokCache = {};
  function tok(k) {
    if (!(k in tokCache)) tokCache[k] = getComputedStyle(document.documentElement).getPropertyValue(k).trim();
    return tokCache[k];
  }
  function chartTheme() {
    tokCache = {}; /* 主题可能已切换，重新读取令牌 */
    return {
      color: [tok('--c1'), tok('--c2'), tok('--c3'), tok('--c4'), tok('--c5'), tok('--c6'), tok('--c7'), tok('--c8')],
      textColor: tok('--text-2'),
      textMuted: tok('--text-3'),
      axisLine: tok('--line-strong'),
      splitLine: tok('--line'),
      tooltipBg: tok('--surface-3'),
      tooltipBorder: tok('--line-strong'),
      tooltipText: tok('--text'),
      font: tok('--font-ui'),
      animation: !RM,
      accent: tok('--accent'),
    };
  }
  function axisStyle(th) {
    return {
      axisLine: { lineStyle: { color: th.axisLine } },
      axisLabel: { color: th.textMuted, fontFamily: th.font },
      axisTick: { lineStyle: { color: th.axisLine } },
      splitLine: { lineStyle: { color: th.splitLine } },
    };
  }

  /* ---------------- 动效退役（铁律 2） ---------------- */
  function retireAnim(el) {
    el.style.setProperty('animation', 'none', 'important');
    el.style.willChange = 'auto';
    el.removeAttribute('data-anim');
  }
  function bindAnim(el) {
    if (!el || !el.dataset || el.dataset.anim === undefined) return;
    if (RM) { el.removeAttribute('data-anim'); return; }
    el.addEventListener('animationend', function handler(e) {
      if (e.target !== el) return; /* 忽略子元素冒泡上来的 animationend */
      el.removeEventListener('animationend', handler);
      retireAnim(el);
    });
  }
  function bindAnims(root) {
    $$('[data-anim]', root || document).forEach(bindAnim);
  }
  /* 动态插入的行：先设错峰延迟，再插入 DOM，最后绑定退役 */
  function animStagger(el, i, base) {
    if (RM) { el.removeAttribute('data-anim'); return; }
    if (i > 0) el.style.animationDelay = ((base || 45) * i) + 'ms';
    bindAnim(el);
  }

  /* ---------------- Toast ---------------- */
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2800);
  }

  /* ---------------- 导航 ---------------- */
  function initNav() {
    var burger = $('#nav-burger'), nav = $('#site-nav');
    if (burger && nav) {
      burger.addEventListener('click', function () {
        var open = nav.classList.toggle('open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      $$('a', nav).forEach(function (a) {
        a.addEventListener('click', function () {
          nav.classList.remove('open');
          burger.setAttribute('aria-expanded', 'false');
        });
      });
    }
    var tb = $('#theme-btn');
    if (tb) {
      tb.addEventListener('click', function () {
        applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
      });
    }
    var aiBtn = $('#ai-btn');
    if (aiBtn) aiBtn.addEventListener('click', function () { window.CN.ai.open(); });
  }

  window.CN = window.CN || {};
  window.CN.util = {
    $: $, $$: $$, fmt: fmt, fmtDate: fmtDate, esc: esc, debounce: debounce,
    tok: tok, chartTheme: chartTheme, axisStyle: axisStyle,
    bindAnim: bindAnim, bindAnims: bindAnims, animStagger: animStagger,
    toast: toast, applyTheme: applyTheme, RM: RM,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { bindAnims(document); initNav(); });
  } else {
    bindAnims(document);
    initNav();
  }
})();
