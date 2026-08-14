/* ============================================================
   CarbonNet — 论文详情 (paper.js)
   ?id=OpenAlexID 或 ?doi=10.xxxx 定位。
   铁律提醒：改动后 paper.html 中 ?v=N 必须 +1。
   铁律 4：元信息一律 textContent。
   铁律 5：中文摘要翻译走 BYOK（localStorage 密钥直连硅基流动）。
   ============================================================ */
(function () {
  'use strict';
  const C = window.CarbonNet;
  const { el } = C;

  function metaRow(rows) {
    const table = el('table', { class: 'meta-table' });
    for (const [label, node] of rows) {
      table.append(el('tr', null, [el('th', { text: label }), el('td', null, [node])]));
    }
    return table;
  }

  /* 相似度：tags 与 concepts 的 Jaccard */
  function similarity(a, b) {
    const ta = new Set([...(a.tags || []), ...(a.concepts || []).map((c) => c.toLowerCase())]);
    const tb = new Set([...(b.tags || []), ...(b.concepts || []).map((c) => c.toLowerCase())]);
    let inter = 0;
    for (const t of ta) if (tb.has(t)) inter++;
    const union = ta.size + tb.size - inter;
    return union ? inter / union : 0;
  }

  function renderPaper(w, works) {
    const main = document.getElementById('paperMain');
    const state = document.getElementById('paperState');
    if (!w) {
      state.textContent = '未找到该论文。可能 ID/DOI 有误，或数据尚未更新。';
      state.className = 'state-note err';
      return;
    }
    state.remove();
    document.title = `${w.title.slice(0, 60)} — CarbonNet 碳网图谱`;

    /* 头部卡片 */
    const head = el('div', { class: 'card paper-head-card enter' });
    head.append(el('span', { class: 'eyebrow', text: w.type === 'review' ? 'REVIEW' : 'PAPER' }));
    head.append(el('h1', { text: w.title }));
    const idLine = el('div', { class: 'paper-id-line' }, [
      el('span', { text: `▸ ${C.fmtYear(w.year)}` }),
      el('span', { text: `▸ 被引 ${C.fmtNum(w.cited)}` }),
      el('span', { text: `▸ OA: ${w.oa || '—'}` }),
      el('span', { text: `▸ OpenAlex: ${w.id}` }),
    ]);
    if (w.doi) idLine.append(el('a', { class: 'doi', href: `https://doi.org/${encodeURIComponent(w.doi)}`, target: '_blank', rel: 'noopener noreferrer', text: `▸ doi:${w.doi}` }));
    head.append(idLine);
    const actions = el('div', { class: 'hero-actions' });
    if (w.doi) actions.append(el('a', { class: 'btn btn-primary btn-sm', href: `https://doi.org/${encodeURIComponent(w.doi)}`, target: '_blank', rel: 'noopener noreferrer', text: '查看原文 DOI ↗' }));
    actions.append(el('a', { class: 'btn btn-ghost btn-sm', href: `https://openalex.org/${encodeURIComponent(w.id)}`, target: '_blank', rel: 'noopener noreferrer', text: 'OpenAlex 页面 ↗' }));
    actions.append(el('button', { class: 'btn btn-soft btn-sm', id: 'btnTranslate', text: '⟳ AI 翻译中文摘要' }));
    head.append(actions);

    /* 中英摘要 */
    const abs = el('div', { class: 'abs-grid' });
    const enCard = el('div', { class: 'card abs-card' });
    enCard.append(el('h3', null, ['英文摘要', el('span', { class: 'abs-lang', text: 'EN' })]));
    enCard.append(el('div', {
      class: 'abs-text' + (w.abstract ? '' : ' abs-empty'),
      text: w.abstract || '（OpenAlex 未收录该文献摘要）',
    }));
    const zhCard = el('div', { class: 'card abs-card' });
    zhCard.append(el('h3', null, ['中文摘要', el('span', { class: 'abs-lang', text: 'ZH · BYOK' })]));
    const zhBody = el('div', { class: 'abs-text abs-empty', id: 'zhAbstract', text: '点击上方「AI 翻译中文摘要」生成。密钥仅保存在你的浏览器中（localStorage），请求由浏览器直连 api.siliconflow.cn。' });
    zhCard.append(zhBody);
    abs.append(enCard, zhCard);

    /* 元信息 */
    const authorsChips = el('div', { class: 'author-list' });
    for (const a of w.authors || []) authorsChips.append(el('span', { class: 'author-chip', text: a }));
    const tags = el('div', { class: 'tag-cloud' });
    for (const t of w.tags || []) {
      const zh = C.TAG_ZH[t];
      if (zh) tags.append(el('a', { class: 'tag', href: `library.html?tag=${encodeURIComponent(t)}`, text: zh.zh }));
    }
    const meta = el('div', { class: 'card enter' });
    meta.append(el('h3', { text: '完整元信息' }));
    meta.append(metaRow([
      ['作者', authorsChips],
      ['期刊', el('span', { text: w.venue || '—' })],
      ['发表日期', el('span', { text: w.date || '—' })],
      ['被引次数', el('span', { text: C.fmtNum(w.cited) })],
      ['文献类型', el('span', { text: w.type || '—' })],
      ['开放获取', el('span', { text: w.oa || '—' })],
      ['DOI', el('span', { text: w.doi || '—' })],
      ['OpenAlex ID', el('span', { text: w.id })],
      ['标签', tags],
    ]));

    /* 相似文献推荐 */
    const sims = works
      .filter((x) => x.id !== w.id)
      .map((x) => ({ w: x, s: similarity(w, x) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .filter((x) => x.s > 0);
    const simCard = el('div', { class: 'card enter' });
    simCard.append(el('h3', { text: '相似文献推荐' }));
    if (!sims.length) simCard.append(el('p', { class: 'state-note', text: '暂无足够信息计算相似文献。' }));
    for (const { w: sw, s } of sims) {
      simCard.append(el('a', { class: 'sim-item', href: `paper.html?id=${encodeURIComponent(sw.id)}`, style: { display: 'flex' } }, [
        el('span', { class: 'sim-score', text: `${Math.round(s * 100)}%` }),
        el('span', { class: 'sim-title', text: sw.title }),
        el('span', { class: 'sim-meta', text: `${C.fmtYear(sw.year)} · 被引 ${C.fmtNum(sw.cited)}` }),
      ]));
    }

    main.append(head, abs, meta, simCard);
    C.initEntrance(document);
    C.animateIn(main);

    /* AI 翻译（BYOK） */
    const btn = document.getElementById('btnTranslate');
    btn.addEventListener('click', async () => {
      if (!w.abstract) { C.toast('该文献没有摘要，无法翻译', 'err'); return; }
      if (!C.getApiKey()) {
        C.toast('未设置硅基流动 API Key，请先到 AI 助手页设置', 'err');
        return;
      }
      btn.disabled = true;
      btn.textContent = '翻译中…';
      try {
        const zh = await C.aiChat([
          { role: 'system', content: '你是材料科学领域的专业翻译。请将用户提供的英文论文摘要翻译成准确、流畅的简体中文，保留专业术语（如 graphene 石墨烯、specific capacitance 比电容），只输出译文本身，不要任何解释。' },
          { role: 'user', content: w.abstract.slice(0, 4000) },
        ], { temperature: 0.3, maxTokens: 2048 });
        zhBody.textContent = zh;
        zhBody.classList.remove('abs-empty');
        C.toast('中文摘要已生成', 'ok');
      } catch (e) {
        zhBody.textContent = `翻译失败：${e.message}${e.code === 'no-key' ? '（请在 AI 助手页设置密钥）' : ''}`;
        zhBody.classList.add('abs-empty');
        C.toast('翻译失败', 'err');
      } finally {
        btn.disabled = false;
        btn.textContent = '⟳ AI 翻译中文摘要';
      }
    });
  }

  async function main() {
    C.initEntrance();
    const sp = new URLSearchParams(location.search);
    const id = sp.get('id');
    const doi = sp.get('doi');
    if (!id && !doi) {
      document.getElementById('paperState').textContent = '缺少参数：请通过 ?id=OpenAlexID 或 ?doi=10.xxxx 访问。';
      document.getElementById('paperState').className = 'state-note err';
      return;
    }
    let works;
    try {
      works = await C.loadWorks();
    } catch (e) {
      document.getElementById('paperState').textContent = `数据加载失败：${e.message}`;
      document.getElementById('paperState').className = 'state-note err';
      return;
    }
    const w = works.find((x) => (id && x.id === id) || (doi && x.doi && x.doi.toLowerCase() === doi.toLowerCase()));
    renderPaper(w, works);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();
})();
