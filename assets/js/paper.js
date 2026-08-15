/* ==========================================================================
   CarbonNet · paper.js —— 论文详情页
   ?id=<openalex id> 或 ?doi=<doi> 定位；完整元信息 + 英文摘要 +
   经典文献中文解读 + 相似文献推荐 + AI 助手上下文注入。
   铁律 4：所有文献数据渲染一律 textContent / createElement。
   ========================================================================== */
(function () {
  'use strict';

  var U = window.CN.util;
  var $ = U.$;

  var TYPE_LABEL = {
    article: '论文', review: '综述', 'book-chapter': '章节',
    preprint: '预印本', dissertation: '学位论文', other: '其他',
  };

  function chip(text, cls) {
    var c = document.createElement('span');
    c.className = cls || 'chip';
    c.textContent = text;
    return c;
  }
  function chipLink(text, href, cls) {
    var c = document.createElement('a');
    c.className = (cls || 'chip');
    c.href = href;
    c.textContent = text;
    return c;
  }

  function render(p) {
    document.title = p.title + ' · CarbonNet 碳网图谱';

    /* 头部 chips */
    var chips = $('#pp-chips');
    chips.appendChild(chip(String(p.year || '—'), 'lit-year'));
    chips.appendChild(chip(TYPE_LABEL[p.type] || p.type || '文献'));
    if (p.oa) {
      chips.appendChild(chip('OA · ' + p.oa.toUpperCase(), 'oa-badge ' + p.oa));
    }
    if (p.curated) chips.appendChild(chip('经典文献 · 人工中文解读', 'badge-curated'));

    $('#pp-title').textContent = p.title;

    var authors = $('#pp-authors');
    authors.textContent = (p.authors || []).map(function (a) { return a.name; }).join(' · ');

    var metaLine = $('#pp-meta-line');
    var bib = [];
    if (p.journal) bib.push(p.journal);
    if (p.vol) bib.push('Vol.' + p.vol + (p.issue ? '(' + p.issue + ')' : ''));
    if (p.pages) bib.push('pp.' + p.pages);
    if (p.date) bib.push(U.fmtDate(p.date));
    metaLine.textContent = bib.join(' · ');

    /* 摘要 */
    $('#pp-abstract').textContent = p.abstract || '（OpenAlex 未收录该文献摘要）';

    /* 中文解读 */
    if (p.zh_abstract) {
      $('#pp-zh-sec').hidden = false;
      $('#pp-zh').textContent = p.zh_abstract;
    }

    /* 关键词 / 概念 */
    var kw = $('#pp-keywords');
    (p.keywords || []).forEach(function (k) {
      kw.appendChild(chipLink(k, 'library.html?tag=' + encodeURIComponent(k)));
    });
    if (!(p.keywords || []).length) kw.appendChild(chip('无关键词'));
    var co = $('#pp-concepts');
    (p.concepts || []).forEach(function (c) {
      var el = chipLink(c.name, 'library.html?tag=' + encodeURIComponent(c.name));
      el.style.opacity = String(0.55 + (c.score || 0) * 0.4);
      co.appendChild(el);
    });

    /* 影响力 */
    $('#pp-citations').textContent = U.fmt(p.citations);

    /* 外部链接 */
    var links = $('#pp-links');
    links.textContent = '';
    if (p.doi) {
      var d = document.createElement('a');
      d.href = p.doi.indexOf('http') === 0 ? p.doi : 'https://doi.org/' + p.doi;
      d.target = '_blank'; d.rel = 'noopener';
      d.textContent = 'DOI · ' + String(p.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
      links.appendChild(d);
    }
    if (p.id) {
      var o = document.createElement('a');
      o.href = 'https://openalex.org/' + encodeURIComponent(p.id);
      o.target = '_blank'; o.rel = 'noopener';
      o.textContent = 'OpenAlex · ' + p.id;
      links.appendChild(o);
    }

    /* 脉络标签 */
    var tags = $('#pp-tags');
    window.CN.paperTagLabels(p, 6).forEach(function (l) {
      tags.appendChild(chipLink(l.name, 'library.html?tag=' + encodeURIComponent(l.tag || l.name)));
    });

    /* 作者列表 */
    var al = $('#pp-author-list');
    var list = (p.authors || []).slice(0, 8);
    list.forEach(function (a) {
      var li = document.createElement('li');
      li.textContent = a.name;
      if (a.institution) {
        var aff = document.createElement('span');
        aff.className = 'aff';
        aff.textContent = a.institution;
        li.appendChild(aff);
      }
      al.appendChild(li);
    });
    if ((p.authors || []).length > 8) {
      var more = document.createElement('li');
      more.className = 'more';
      more.textContent = '+ ' + (p.authors.length - 8) + ' 位作者';
      al.appendChild(more);
    }

    /* 相似文献 */
    var sim = window.CN.similar(p, 6);
    var grid = $('#pp-similar');
    if (!sim.length) {
      var none = document.createElement('div');
      none.className = 'empty-state';
      none.style.gridColumn = '1/-1';
      none.innerHTML = '';
      var p1 = document.createElement('p');
      p1.textContent = '暂无足够重叠的相似文献。';
      none.appendChild(p1);
      grid.appendChild(none);
    }
    sim.forEach(function (s, i) {
      var card = document.createElement('article');
      card.className = 'card card-hover paper-card sim-card';
      card.setAttribute('data-anim', 'rise');

      var meta = document.createElement('div');
      meta.className = 'p-meta';
      var yr = document.createElement('span');
      yr.className = 'lit-year';
      yr.textContent = String(s.year || '—');
      var jr = document.createElement('span');
      jr.className = 'journal';
      jr.textContent = s.journal || '';
      meta.appendChild(yr); meta.appendChild(jr);

      var t = document.createElement('a');
      t.className = 'p-title';
      t.href = 'paper.html?id=' + encodeURIComponent(s.id);
      t.textContent = s.title;

      var desc = document.createElement('p');
      desc.className = 'p-desc';
      desc.textContent = s.abstract || '';

      var foot = document.createElement('div');
      foot.className = 'p-foot';
      var cite = document.createElement('span');
      cite.className = 'p-cite';
      cite.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12a8 8 0 0 1 16 0M12 4v4M8.5 8.5l2.5 2.5M15.5 8.5L13 11"/></svg>';
      cite.appendChild(document.createTextNode(U.fmt(s.citations)));
      foot.appendChild(cite);

      card.appendChild(meta); card.appendChild(t); card.appendChild(desc); card.appendChild(foot);
      U.animStagger(card, i, 60); /* 先设延迟再插入，保证错峰生效 */
      grid.appendChild(card);
    });

    $('#paper-wrap').hidden = false;

    /* AI 助手上下文（BYOK，仅注入到面板） */
    $('#pp-ai-btn').addEventListener('click', function () {
      window.CN.ai.setContext({
        title: p.title,
        authors: p.authors,
        journal: p.journal,
        year: p.year,
        doi: p.doi,
        citations: p.citations,
        abstract: p.abstract,
      });
      window.CN.ai.quick('请基于当前上下文论文，用中文总结：1) 研究问题 2) 材料体系与制备方法 3) 关键结果与性能 4) 局限。分点作答，引用数据注明来源。');
    });
  }

  function notFound(msg) {
    $('#paper-empty').hidden = false;
    $('#pp-err-msg').textContent = msg || '未找到对应文献。请检查 ?id= 或 ?doi= 参数。';
  }

  function boot() {
    var q = new URLSearchParams(location.search);
    var ref = q.get('id') || q.get('doi') || '';
    var p = window.CN.findPaper(ref);
    if (p) render(p);
    else notFound(ref ? '未找到文献「' + ref + '」。可能是数据更新后该条目被替换，请在文献库中检索。' : '缺少定位参数。请通过 ?id=<OpenAlex ID> 或 ?doi=<DOI> 访问。');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
