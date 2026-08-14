/* ============================================================
   CarbonNet — 文献库 (library.js)
   铁律提醒：改动后 library.html 中 ?v=N 必须 +1。
   铁律 4：文献数据渲染一律 textContent（经 CarbonNet.el），
   搜索高亮用 DOM 文本节点拆分（highlightTerm）。
   ============================================================ */
(function () {
  'use strict';
  const C = window.CarbonNet;
  const { el } = C;

  const PAGE_SIZE = 15;
  let works = [];
  let state = {
    q: '', mTag: '', sTag: '', type: '', oa: '', year: '', sort: 'cited', sortDir: -1, page: 1,
  };

  /* ---------------- URL 参数同步（graph 页跳转 ?tag= 等） ---------------- */
  function readUrl() {
    const sp = new URLSearchParams(location.search);
    if (sp.has('q')) state.q = sp.get('q') || '';
    if (sp.has('tag')) {
      const t = sp.get('tag') || '';
      if (C.M_KEYS.includes(t)) state.mTag = t;
      else if (C.S_KEYS.includes(t)) state.sTag = t;
    }
    if (sp.has('m')) state.mTag = sp.get('m') || '';
    if (sp.has('s')) state.sTag = sp.get('s') || '';
    if (sp.has('type')) state.type = sp.get('type') || '';
    if (sp.has('oa')) state.oa = sp.get('oa') || '';
    if (sp.has('year')) state.year = sp.get('year') || '';
    if (sp.has('sort')) {
      const v = sp.get('sort');
      if (v === 'date') state.sort = 'date';
      else if (v === 'year') state.sort = 'year';
      else if (v === 'title') state.sort = 'title';
      else state.sort = 'cited';
    }
  }
  function writeUrl() {
    const sp = new URLSearchParams();
    if (state.q) sp.set('q', state.q);
    if (state.mTag) sp.set('m', state.mTag);
    if (state.sTag) sp.set('s', state.sTag);
    if (state.type) sp.set('type', state.type);
    if (state.oa) sp.set('oa', state.oa);
    if (state.year) sp.set('year', state.year);
    if (state.sort !== 'cited') sp.set('sort', state.sort);
    if (state.page > 1) sp.set('page', String(state.page));
    const qs = sp.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }

  /* ---------------- 筛选 ---------------- */
  function filterWorks() {
    const q = state.q.trim().toLowerCase();
    const out = works.filter((w) => {
      if (state.mTag && !w.mTags.includes(state.mTag)) return false;
      if (state.sTag && !w.sTags.includes(state.sTag)) return false;
      if (state.type && w.type !== state.type) return false;
      if (state.oa && w.oa !== state.oa) return false;
      if (state.year && String(w.year) !== state.year) return false;
      if (q) {
        const hay = `${w.title} ${(w.authors || []).join(' ')} ${w.venue || ''} ${w.abstract || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const dir = state.sortDir;
    out.sort((a, b) => {
      switch (state.sort) {
        case 'date': return dir * (b.date || '').localeCompare(a.date || '');
        case 'year': return dir * ((b.year || 0) - (a.year || 0));
        case 'title': return dir * (a.title || '').localeCompare(b.title || '');
        default: return dir * ((b.cited || 0) - (a.cited || 0));
      }
    });
    return out;
  }

  /* ---------------- 渲染 ---------------- */
  function renderRows(rows) {
    const body = document.getElementById('papersBody');
    const stateNote = document.getElementById('tableState');
    body.replaceChildren();
    if (!rows.length) {
      stateNote.style.display = 'block';
      stateNote.textContent = '没有匹配的文献，试试放宽筛选条件。';
      return;
    }
    stateNote.style.display = 'none';
    rows.forEach((w, i) => {
      const tr = el('tr', { class: 'enter-fade', style: { animationDelay: `${i * 45}ms` } });
      const titleCell = el('td', { class: 'cell-title' });
      titleCell.append(el('a', { href: `paper.html?id=${encodeURIComponent(w.id)}`, text: w.title }));
      const tags = el('div', { class: 'paper-tags', style: { marginTop: '6px' } });
      w.tags.slice(0, 3).forEach((t) => {
        const zh = C.TAG_ZH[t];
        if (zh) tags.append(el('a', { class: 'badge badge-accent', href: `library.html?tag=${encodeURIComponent(t)}`, text: zh.zh }));
      });
      titleCell.append(tags);
      tr.append(
        titleCell,
        el('td', { class: 'num', text: C.fmtYear(w.year) }),
        el('td', { text: w.venue || '—' }),
        el('td', { class: 'num', text: w.type === 'review' ? 'review' : (w.type || '—') }),
        el('td', { class: 'num', text: w.oa || '—' }),
        el('td', { class: 'num', text: C.fmtNum(w.cited) }),
        el('td', { text: C.shortAuthors(w.authors, 3) }),
      );
      body.append(tr);
    });
    /* 搜索词高亮（DOM 拆分，不拼 HTML） */
    if (state.q.trim()) {
      body.querySelectorAll('.cell-title a').forEach((a) => C.highlightTerm(a, state.q));
    }
  }

  function renderPager(total) {
    const pager = document.getElementById('pager');
    pager.replaceChildren();
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const mkBtn = (label, target, opts = {}) => {
      const b = el('button', {
        class: `page-btn${opts.current ? ' current' : ''}`,
        text: String(label),
        disabled: opts.disabled ? 'disabled' : false,
      });
      if (!opts.disabled) b.addEventListener('click', () => { state.page = target; refresh(); });
      return b;
    };
    pager.append(mkBtn('‹', state.page - 1, { disabled: state.page <= 1 }));
    const win = [];
    for (let p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - state.page) <= 2) win.push(p);
      else if (win[win.length - 1] !== '…') win.push('…');
    }
    for (const p of win) {
      if (p === '…') pager.append(el('span', { class: 'page-info', text: '…' }));
      else pager.append(mkBtn(p, p, { current: p === state.page }));
    }
    pager.append(mkBtn('›', state.page + 1, { disabled: state.page >= pages }));
    pager.append(el('span', { class: 'page-info', text: `${total} 条 · 第 ${state.page}/${pages} 页` }));
  }

  function renderActiveFilters() {
    const box = document.getElementById('activeFilters');
    box.replaceChildren();
    const mkChip = (label, onRemove) => {
      const chip = el('button', { class: 'filter-chip', text: label, onclick: () => { onRemove(); refresh(); } });
      box.append(chip);
    };
    if (state.mTag) mkChip(`材料：${C.TAG_ZH[state.mTag]?.zh || state.mTag}`, () => { state.mTag = ''; document.getElementById('fMat').value = ''; });
    if (state.sTag) mkChip(`策略：${C.TAG_ZH[state.sTag]?.zh || state.sTag}`, () => { state.sTag = ''; document.getElementById('fStr').value = ''; });
    if (state.type) mkChip(`类型：${state.type}`, () => { state.type = ''; document.getElementById('fType').value = ''; });
    if (state.oa) mkChip(`OA：${state.oa}`, () => { state.oa = ''; document.getElementById('fOA').value = ''; });
    if (state.year) mkChip(`年份：${state.year}`, () => { state.year = ''; document.getElementById('fYear').value = ''; });
    if (state.q) mkChip(`搜索：${state.q}`, () => { state.q = ''; document.getElementById('fQ').value = ''; });
  }

  function refresh() {
    const rows = filterWorks();
    const start = (state.page - 1) * PAGE_SIZE;
    renderRows(rows.slice(start, start + PAGE_SIZE));
    renderPager(rows.length);
    renderActiveFilters();
    document.getElementById('libCount').textContent = `共 ${rows.length} / ${works.length} 条文献`;
    writeUrl();
    window.scrollTo({ top: 0, behavior: C.REDUCED.matches ? 'auto' : 'smooth' });
  }

  /* ---------------- CSV 导出 ---------------- */
  function exportCsv() {
    const rows = filterWorks();
    const data = [['id', 'title', 'year', 'venue', 'type', 'oa', 'cited_by', 'authors', 'doi', 'url', 'tags']];
    for (const w of rows) {
      data.push([
        w.id, w.title, w.year ?? '', w.venue || '', w.type || '', w.oa || '',
        w.cited ?? 0, (w.authors || []).join('; '), w.doi || '',
        `https://openalex.org/${w.id}`,
        (w.tags || []).map((t) => C.TAG_ZH[t]?.zh || t).join('; '),
      ]);
    }
    C.downloadCsv(`carbonnet-文献-${new Date().toISOString().slice(0, 10)}.csv`, data);
    C.toast(`已导出 ${rows.length} 条文献`, 'ok');
  }

  /* ---------------- 初始化 ---------------- */
  function initControls() {
    const fMat = document.getElementById('fMat');
    for (const k of C.M_KEYS) fMat.append(el('option', { value: k, text: C.TAG_ZH[k].zh }));
    const fStr = document.getElementById('fStr');
    for (const k of C.S_KEYS) fStr.append(el('option', { value: k, text: C.TAG_ZH[k].zh }));

    document.getElementById('fQ').addEventListener('input', debounce((e) => {
      state.q = e.target.value.trim();
      state.page = 1;
      refresh();
    }, 300));
    fMat.addEventListener('change', (e) => { state.mTag = e.target.value; state.page = 1; refresh(); });
    fStr.addEventListener('change', (e) => { state.sTag = e.target.value; state.page = 1; refresh(); });
    document.getElementById('fType').addEventListener('change', (e) => { state.type = e.target.value; state.page = 1; refresh(); });
    document.getElementById('fOA').addEventListener('change', (e) => { state.oa = e.target.value; state.page = 1; refresh(); });
    document.getElementById('fYear').addEventListener('change', (e) => { state.year = e.target.value; state.page = 1; refresh(); });
    document.getElementById('fSort').addEventListener('change', (e) => {
      state.sort = e.target.value;
      state.sortDir = e.target.value === 'title' ? 1 : -1;
      state.page = 1;
      refresh();
    });
    document.getElementById('btnCsv').addEventListener('click', exportCsv);

    /* 表头排序 */
    document.querySelectorAll('#papersTable thead th[data-sort]').forEach((th) => {
      th.addEventListener('click', () => {
        const field = th.dataset.sort;
        if (state.sort === field) state.sortDir *= -1;
        else { state.sort = field; state.sortDir = field === 'title' ? 1 : -1; }
        document.getElementById('fSort').value = ['cited', 'date', 'year', 'title'].includes(field) ? field : 'cited';
        state.page = 1;
        refresh();
        updateSortIndicator(th);
      });
    });
  }
  function updateSortIndicator(activeTh) {
    document.querySelectorAll('#papersTable thead th[data-sort] .sort-ind').forEach((s) => s.remove());
    const dir = state.sortDir === 1 ? '↑' : '↓';
    activeTh.append(el('span', { class: 'sort-ind', text: dir }));
  }
  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  async function main() {
    C.initEntrance();
    readUrl();
    initControls();
    try {
      works = await C.loadWorks();
    } catch (e) {
      document.getElementById('tableState').style.display = 'block';
      document.getElementById('tableState').textContent = `数据加载失败：${e.message}`;
      return;
    }
    /* 年份下拉：数据年份范围 */
    const fYear = document.getElementById('fYear');
    const years = [...new Set(works.map((w) => w.year).filter(Boolean))].sort((a, b) => b - a);
    for (const y of years) fYear.append(el('option', { value: String(y), text: String(y) }));
    /* 回填控件状态 */
    document.getElementById('fQ').value = state.q;
    document.getElementById('fMat').value = state.mTag;
    document.getElementById('fStr').value = state.sTag;
    document.getElementById('fType').value = state.type;
    document.getElementById('fOA').value = state.oa;
    document.getElementById('fYear').value = state.year;
    document.getElementById('fSort').value = state.sort;
    if (state.sort === 'title') state.sortDir = 1;
    const sp = new URLSearchParams(location.search);
    if (sp.has('page')) state.page = Math.max(1, parseInt(sp.get('page'), 10) || 1);
    refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();
})();
