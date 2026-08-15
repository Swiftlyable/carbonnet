/* ==========================================================================
   CarbonNet · library.js —— 文献库：搜索 / 多维筛选 / CSV 导出 / 分页 / 错峰入场
   铁律 4：所有文献数据渲染一律 textContent / createElement。
   ========================================================================== */
(function () {
  'use strict';

  var U = window.CN.util;
  var $ = U.$;
  var RM = U.RM;

  var state = {
    q: '', tag: '', material: '', strategy: '',
    yearFrom: '', yearTo: '', journal: '',
    sort: 'citations', page: 1, perPage: 20,
  };

  function opts() {
    return {
      q: state.q, tag: state.tag, material: state.material, strategy: state.strategy,
      yearFrom: state.yearFrom, yearTo: state.yearTo, journal: state.journal,
      sort: state.sort, page: state.page, perPage: state.perPage,
    };
  }

  /* ---------------- 初始化筛选控件 ---------------- */
  function fillSelect(sel, items, allLabel) {
    sel.textContent = '';
    var all = document.createElement('option');
    all.value = '';
    all.textContent = allLabel;
    sel.appendChild(all);
    items.forEach(function (it) {
      var o = document.createElement('option');
      o.value = it.value;
      o.textContent = it.label;
      sel.appendChild(o);
    });
  }

  function initControls() {
    var flat = window.CN.flat;
    var materials = flat.filter(function (n) { return n.type === 'material'; })
      .map(function (n) { return { value: n.tag, label: n.name + ' · ' + n.en }; });
    var strategies = flat.filter(function (n) { return n.type === 'strategy'; })
      .map(function (n) { return { value: n.tag, label: n.name + ' · ' + n.en }; });
    fillSelect($('#f-material'), materials, '全部材料');
    fillSelect($('#f-strategy'), strategies, '全部策略');

    var st = window.CN.stats();
    var years = [];
    for (var y = st.yearMax; y >= st.yearMin; y--) years.push({ value: String(y), label: String(y) });
    fillSelect($('#f-year-from'), years, '不限');
    fillSelect($('#f-year-to'), years.slice().reverse(), '不限');

    fillSelect($('#f-journal'), st.journalList.slice(0, 30).map(function (j) {
      return { value: j.name, label: j.name + '（' + j.count + '）' };
    }), '全部期刊');
  }

  /* ---------------- URL 同步（?tag= 等可分享） ---------------- */
  function readUrl() {
    var p = new URLSearchParams(location.search);
    state.q = p.get('q') || '';
    state.tag = p.get('tag') || '';
    state.material = p.get('material') || '';
    state.strategy = p.get('strategy') || '';
    state.yearFrom = p.get('yearFrom') || '';
    state.yearTo = p.get('yearTo') || '';
    state.journal = p.get('journal') || '';
    state.sort = p.get('sort') || 'citations';
    state.page = parseInt(p.get('page'), 10) || 1;
    state.perPage = parseInt(p.get('per'), 10) || 20;
  }
  function syncControls() {
    $('#f-q').value = state.q;
    $('#f-material').value = state.material;
    $('#f-strategy').value = state.strategy;
    $('#f-year-from').value = state.yearFrom;
    $('#f-year-to').value = state.yearTo;
    $('#f-journal').value = state.journal;
    $('#f-sort').value = state.sort;
    $('#f-per').value = String(state.perPage);
  }
  function writeUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.tag) p.set('tag', state.tag);
    if (state.material) p.set('material', state.material);
    if (state.strategy) p.set('strategy', state.strategy);
    if (state.yearFrom) p.set('yearFrom', state.yearFrom);
    if (state.yearTo) p.set('yearTo', state.yearTo);
    if (state.journal) p.set('journal', state.journal);
    if (state.sort !== 'citations') p.set('sort', state.sort);
    if (state.page > 1) p.set('page', String(state.page));
    if (state.perPage !== 20) p.set('per', String(state.perPage));
    var qs = p.toString();
    history.replaceState(null, '', qs ? 'library.html?' + qs : 'library.html');
  }

  /* ---------------- 激活筛选 chips ---------------- */
  function tagLabel(tag) {
    var flat = window.CN.flat;
    for (var i = 0; i < flat.length; i++) {
      if ((flat[i].tag || '').toLowerCase() === tag.toLowerCase()) return flat[i].name;
    }
    return tag;
  }
  function renderActiveFilters() {
    var box = $('#active-filters');
    box.textContent = '';
    var defs = [
      { key: 'q', label: '搜索', value: state.q, clear: 'q' },
      { key: 'tag', label: '标签', value: state.tag ? tagLabel(state.tag) : '', clear: 'tag' },
      { key: 'material', label: '材料', value: state.material ? tagLabel(state.material) : '', clear: 'material' },
      { key: 'strategy', label: '策略', value: state.strategy ? tagLabel(state.strategy) : '', clear: 'strategy' },
      { key: 'journal', label: '期刊', value: state.journal, clear: 'journal' },
      { key: 'years', label: '年份', value: state.yearFrom || state.yearTo ? (state.yearFrom || '…') + ' – ' + (state.yearTo || '…') : '', clear: 'years' },
    ];
    var any = false;
    defs.forEach(function (d) {
      if (!d.value) return;
      any = true;
      var chip = document.createElement('span');
      chip.className = 'chip on';
      chip.textContent = d.label + '：' + d.value;
      var x = document.createElement('button');
      x.textContent = '×';
      x.setAttribute('aria-label', '清除筛选 ' + d.label);
      x.style.cssText = 'background:none;border:0;color:inherit;cursor:pointer;font:inherit;padding:0 0 0 6px';
      x.addEventListener('click', function () {
        if (d.clear === 'years') { state.yearFrom = ''; state.yearTo = ''; }
        else state[d.clear] = '';
        state.page = 1;
        syncControls();
        refresh();
      });
      chip.appendChild(x);
      box.appendChild(chip);
    });
    if (any) {
      var label = document.createElement('span');
      label.className = 'af-label';
      label.textContent = 'FILTERS';
      box.insertBefore(label, box.firstChild);
    }
  }

  /* ---------------- 表格渲染（错峰入场） ---------------- */
  function renderRows(res) {
    var tbody = $('#lib-tbody');
    tbody.textContent = '';
    res.items.forEach(function (p, i) {
      var tr = document.createElement('tr');
      tr.setAttribute('data-anim', 'rise');
      tr.dataset.pid = p.id;

      /* # */
      var tdIdx = document.createElement('td');
      tdIdx.className = 'td-num';
      tdIdx.style.textAlign = 'left';
      tdIdx.textContent = String((res.page - 1) * res.perPage + i + 1).padStart(2, '0');

      /* 标题 / 摘要 */
      var tdTitle = document.createElement('td');
      var wrap = document.createElement('div');
      wrap.className = 'td-title-wrap';
      var a = document.createElement('a');
      a.className = 'td-title';
      a.href = 'paper.html?id=' + encodeURIComponent(p.id);
      a.textContent = p.title;
      wrap.appendChild(a);
      if (p.abstract) {
        var sn = document.createElement('div');
        sn.className = 'td-snippet';
        sn.textContent = p.abstract;
        wrap.appendChild(sn);
      }
      tdTitle.appendChild(wrap);

      var tdYear = document.createElement('td');
      tdYear.className = 'td-num';
      tdYear.style.textAlign = 'left';
      tdYear.textContent = p.year || '—';

      var tdJ = document.createElement('td');
      tdJ.className = 'td-sub';
      tdJ.textContent = p.journal || '—';

      var tdA = document.createElement('td');
      tdA.className = 'td-authors';
      var names = (p.authors || []).map(function (x) { return x.name; });
      tdA.textContent = names.slice(0, 3).join(', ') + (names.length > 3 ? ' 等' : '');

      var tdC = document.createElement('td');
      tdC.className = 'td-num';
      tdC.textContent = U.fmt(p.citations);

      var tdOa = document.createElement('td');
      var oa = document.createElement('span');
      oa.className = 'oa-badge' + (['gold', 'diamond', 'hybrid'].indexOf(p.oa) >= 0 ? ' ' + p.oa : '');
      oa.textContent = p.oa ? p.oa.toUpperCase() : '—';
      tdOa.appendChild(oa);

      var tdTags = document.createElement('td');
      tdTags.className = 'td-tags';
      var labels = window.CN.paperTagLabels(p, 3);
      labels.forEach(function (l) {
        var chip = document.createElement('button');
        chip.className = 'chip td-tag';
        chip.textContent = l.name;
        chip.dataset.tag = l.tag || l.name;
        tdTags.appendChild(chip);
      });
      if (!labels.length) tdTags.textContent = '—';

      tr.appendChild(tdIdx);
      tr.appendChild(tdTitle);
      tr.appendChild(tdYear);
      tr.appendChild(tdJ);
      tr.appendChild(tdA);
      tr.appendChild(tdC);
      tr.appendChild(tdOa);
      tr.appendChild(tdTags);
      U.animStagger(tr, i, RM ? 0 : 40); /* 先设延迟再插入，保证错峰生效 */
      tbody.appendChild(tr);
    });
  }

  /* ---------------- 分页 ---------------- */
  function renderPagination(res) {
    var box = $('#lib-pagination');
    box.textContent = '';
    if (res.pages <= 1) return;

    var info = document.createElement('span');
    info.className = 'pg-info';
    info.textContent = res.total + ' 篇 · ' + res.page + ' / ' + res.pages + ' 页';
    box.appendChild(info);

    function pageBtn(label, page, on) {
      var b = document.createElement('button');
      b.className = 'pg-btn' + (on ? ' on' : '');
      b.textContent = label;
      b.disabled = !page;
      if (page) b.addEventListener('click', function () { state.page = page; refresh(true); });
      box.appendChild(b);
      return b;
    }
    pageBtn('‹', res.page > 1 ? res.page - 1 : 0);
    var win = [];
    var start = Math.max(1, res.page - 2);
    var end = Math.min(res.pages, start + 4);
    start = Math.max(1, end - 4);
    for (var i = start; i <= end; i++) win.push(i);
    if (win[0] > 1) {
      pageBtn('1', 1);
      if (win[0] > 2) { var e1 = document.createElement('span'); e1.className = 'pg-ellipsis'; e1.textContent = '…'; box.appendChild(e1); }
    }
    win.forEach(function (i) { pageBtn(String(i), i, i === res.page); });
    if (win[win.length - 1] < res.pages) {
      if (win[win.length - 1] < res.pages - 1) { var e2 = document.createElement('span'); e2.className = 'pg-ellipsis'; e2.textContent = '…'; box.appendChild(e2); }
      pageBtn(String(res.pages), res.pages);
    }
    pageBtn('›', res.page < res.pages ? res.page + 1 : 0);
  }

  /* ---------------- 刷新 ---------------- */
  function refresh(keepScroll) {
    var res = window.CN.searchPapers(opts());
    if (res.page > res.pages) { state.page = res.pages; res = window.CN.searchPapers(opts()); }
    renderRows(res);
    renderPagination(res);
    renderActiveFilters();
    $('#lib-empty').style.display = res.total ? 'none' : 'block';
    var countEl = $('#lib-count');
    if (countEl) {
      countEl.textContent = '';
      var b = document.createElement('b');
      b.textContent = U.fmt(res.total);
      countEl.appendChild(b);
      countEl.appendChild(document.createTextNode(' 篇文献 · 第 ' + res.page + ' 页'));
    }
    document.querySelector('.lib-table-wrap').style.display = res.total ? '' : 'none';
    writeUrl();
  }

  /* ---------------- CSV 导出 ---------------- */
  function csvCell(v) {
    v = String(v == null ? '' : v);
    /* CSV 公式注入防护：以 = + - @ 开头（可含前导空白）的单元格加前缀单引号 */
    if (/^[\s\uFEFF]*[=+\-@]/.test(v)) v = "'" + v;
    if (/[",\r\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
    return v;
  }
  function exportCsv() {
    var all = window.CN.searchPapers(Object.assign(opts(), { page: 1, perPage: 100000 }));
    if (!all.total) { U.toast('当前筛选结果为空，无内容可导出'); return; }
    var headers = ['id', 'doi', 'title', 'year', 'date', 'journal', 'authors', 'citations', 'type', 'oa', 'concepts', 'keywords', 'abstract', 'zh_abstract', 'curated'];
    var lines = [headers.join(',')];
    all.items.forEach(function (p) {
      lines.push([
        p.id, p.doi, p.title, p.year, p.date, p.journal,
        (p.authors || []).map(function (a) { return a.name; }).join('; '),
        p.citations, p.type, p.oa,
        (p.concepts || []).map(function (c) { return c.name; }).join('; '),
        (p.keywords || []).join('; '),
        p.abstract || '', p.zh_abstract || '', p.curated || '',
      ].map(csvCell).join(','));
    });
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    var d = new Date();
    a.download = 'carbonnet-literature-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    U.toast('已导出 ' + all.total + ' 篇文献（UTF-8 CSV）');
  }

  /* ---------------- 事件 ---------------- */
  function bindEvents() {
    $('#f-q').addEventListener('input', U.debounce(function () {
      state.q = this.value.trim(); state.page = 1; refresh();
    }, 260));
    $('#f-material').addEventListener('change', function () { state.material = this.value; state.page = 1; refresh(); });
    $('#f-strategy').addEventListener('change', function () { state.strategy = this.value; state.page = 1; refresh(); });
    $('#f-year-from').addEventListener('change', function () { state.yearFrom = this.value; state.page = 1; refresh(); });
    $('#f-year-to').addEventListener('change', function () { state.yearTo = this.value; state.page = 1; refresh(); });
    $('#f-journal').addEventListener('change', function () { state.journal = this.value; state.page = 1; refresh(); });
    $('#f-sort').addEventListener('change', function () { state.sort = this.value; state.page = 1; refresh(); });
    $('#f-per').addEventListener('change', function () { state.perPage = parseInt(this.value, 10) || 20; state.page = 1; refresh(); });
    $('#f-reset').addEventListener('click', function () {
      state = { q: '', tag: '', material: '', strategy: '', yearFrom: '', yearTo: '', journal: '', sort: 'citations', page: 1, perPage: state.perPage };
      syncControls();
      refresh();
    });
    $('#btn-csv').addEventListener('click', exportCsv);

    /* 行点击 → 详情；标签点击 → 反向筛选（不触发行导航） */
    $('#lib-tbody').addEventListener('click', function (e) {
      var chip = e.target.closest('.td-tag');
      if (chip) {
        e.stopPropagation();
        state.tag = chip.dataset.tag || '';
        state.page = 1;
        refresh();
        return;
      }
      var tr = e.target.closest('tr');
      if (tr && tr.dataset.pid) {
        window.location.href = 'paper.html?id=' + encodeURIComponent(tr.dataset.pid);
      }
    });
    $('#lib-tbody').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.closest('tr') && e.target.closest('tr').dataset.pid) {
        window.location.href = 'paper.html?id=' + encodeURIComponent(e.target.closest('tr').dataset.pid);
      }
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    readUrl();
    initControls();
    syncControls();
    bindEvents();
    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
