/* ==========================================================================
   CarbonNet · data.js —— 客户端数据查询 API（纯函数，无网络、无副作用）
   依赖：data/papers.js（window.CARBONNET_PAPERS / CARBONNET_META）
         data/taxonomy.js（window.CARBONNET_TAXONOMY）
   铁律 4：本文件只返回数据；渲染一律 textContent，绝不拼接 innerHTML。
   ========================================================================== */
(function () {
  'use strict';

  var papers = window.CARBONNET_PAPERS || [];
  var meta = window.CARBONNET_META || {};
  var TAX = window.CARBONNET_TAXONOMY || null;

  /* ---- 扁平化 taxonomy ---- */
  var flat = [];
  function walk(node, parent, depth) {
    var n = {
      name: node.name, en: node.en || '', type: node.type || 'leaf',
      tag: node.tag || '', desc: node.desc || '', match: node.match || [],
      parent: parent, depth: depth, children: node.children || null,
    };
    flat.push(n);
    (node.children || []).forEach(function (c) { walk(c, n, depth + 1); });
  }
  if (TAX) walk(TAX, null, 0);

  function isLeaf(n) { return n.type !== 'branch' && n.depth > 0; }

  /* ---- 索引 ---- */
  var byId = {};
  var byDoi = {};
  papers.forEach(function (p) {
    if (p.id) byId[p.id] = p;
    if (p.doi) {
      byDoi[String(p.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').toLowerCase()] = p;
    }
  });

  function findPaper(ref) {
    if (!ref) return null;
    var r = String(ref).trim();
    if (byId[r]) return byId[r];
    if (r.indexOf('openalex.org/') >= 0) return byId[r.split('/').pop()] || null;
    var d = r.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').toLowerCase();
    return byDoi[d] || null;
  }

  /* ---- 论文 ↔ 脉络节点匹配 ---- */
  function haystack(p) {
    return [p.title, (p.keywords || []).join(' '), (p.concepts || []).map(function (c) { return c.name; }).join(' ')]
      .join(' ').toLowerCase();
  }
  function tagMatch(p, node) {
    if (!node || !node.match || !node.match.length) return false;
    var h = haystack(p);
    return node.match.some(function (t) { return h.indexOf(String(t).toLowerCase()) >= 0; });
  }
  function paperTags(p) {
    var out = [];
    flat.forEach(function (n) {
      if (isLeaf(n) && tagMatch(p, n)) out.push(n);
    });
    /* 材料优先、策略次之，每类最多取 2 个 */
    var order = { material: 0, strategy: 1, device: 2, application: 3 };
    out.sort(function (a, b) {
      var d = (order[a.type] || 9) - (order[b.type] || 9);
      return d !== 0 ? d : b.name.length - a.name.length;
    });
    return out;
  }
  function paperTagLabels(p, max) {
    var tags = paperTags(p);
    var labels = [];
    var cnt = { material: 0, strategy: 0, device: 0, application: 0 };
    for (var i = 0; i < tags.length && labels.length < (max || 4); i++) {
      var t = tags[i];
      if (cnt[t.type] >= 2) continue;
      cnt[t.type]++;
      labels.push({ name: t.name, tag: t.tag || t.en, type: t.type });
    }
    return labels;
  }

  /* ---- 检索 / 筛选 ---- */
  var SORTS = {
    citations: function (a, b) { return b.citations - a.citations; },
    date: function (a, b) { return (b.date || '').localeCompare(a.date || ''); },
    year: function (a, b) { return b.year - a.year; },
    title: function (a, b) { return a.title.localeCompare(b.title); },
  };

  function searchPapers(opts) {
    opts = opts || {};
    var q = String(opts.q || '').trim().toLowerCase();
    var tag = String(opts.tag || '').trim().toLowerCase();
    var material = String(opts.material || '');
    var strategy = String(opts.strategy || '');
    var yearFrom = parseInt(opts.yearFrom, 10) || 0;
    var yearTo = parseInt(opts.yearTo, 10) || 9999;
    var journal = String(opts.journal || '');
    var sort = SORTS[opts.sort] ? opts.sort : 'citations';

    /* tag 可能是脉络标签（按 match 词条匹配）或原始关键词 */
    var tagNode = null;
    if (tag) {
      flat.forEach(function (n) {
        if (!tagNode && String(n.tag || '').toLowerCase() === tag) tagNode = n;
      });
    }

    var items = papers.filter(function (p) {
      if (p.year < yearFrom || p.year > yearTo) return false;
      if (journal && (p.journal || '').toLowerCase().indexOf(journal.toLowerCase()) < 0) return false;
      if (material && !flat.some(function (n) { return n.tag === material && tagMatch(p, n); })) return false;
      if (strategy && !flat.some(function (n) { return n.tag === strategy && tagMatch(p, n); })) return false;
      if (tag) {
        if (tagNode) { if (!tagMatch(p, tagNode)) return false; }
        else {
          var h = haystack(p);
          if (h.indexOf(tag) < 0 && p.title.toLowerCase().indexOf(tag) < 0) return false;
        }
      }
      if (q) {
        var h = haystack(p) + ' ' + (p.journal || '') + ' ' + (p.authors || []).map(function (a) { return a.name; }).join(' ');
        if (h.indexOf(q) < 0) return false;
      }
      return true;
    }).sort(SORTS[sort]);

    var total = items.length;
    var page = Math.max(1, parseInt(opts.page, 10) || 1);
    var perPage = Math.max(1, parseInt(opts.perPage, 10) || 20);
    var start = (page - 1) * perPage;
    return { total: total, page: page, perPage: perPage, pages: Math.max(1, Math.ceil(total / perPage)), items: items.slice(start, start + perPage) };
  }

  /* ---- 相似文献：共享概念/关键词/期刊加权 ---- */
  function similar(p, n) {
    var kw = {}, co = {};
    (p.keywords || []).forEach(function (k) { kw[String(k).toLowerCase()] = 1; });
    (p.concepts || []).forEach(function (c) { co[String(c.name).toLowerCase()] = 1; });
    return papers.filter(function (o) { return o.id !== p.id; }).map(function (o) {
      var s = 0;
      (o.concepts || []).forEach(function (c) { if (co[String(c.name).toLowerCase()]) s += 2; });
      (o.keywords || []).forEach(function (k) { if (kw[String(k).toLowerCase()]) s += 1.5; });
      if (o.journal === p.journal) s += 1;
      if (Math.abs(o.year - p.year) <= 2) s += 0.5;
      return { paper: o, score: s };
    }).filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score || b.paper.citations - a.paper.citations; })
      .slice(0, n || 6).map(function (x) { return x.paper; });
  }

  /* ---- 标签云 ---- */
  function tagCloud(n) {
    var freq = {};
    papers.forEach(function (p) {
      (p.keywords || []).slice(0, 6).forEach(function (k) {
        k = String(k); if (k.length < 3 || k.length > 32) return;
        freq[k] = (freq[k] || 0) + 1;
      });
    });
    var arr = Object.keys(freq).map(function (k) { return { tag: k, count: freq[k] }; })
      .sort(function (a, b) { return b.count - a.count; }).slice(0, n || 42);
    return arr;
  }

  /* ---- 统计（数据面板 / KPI） ---- */
  var statsCache = null;
  function stats() {
    if (statsCache) return statsCache;
    var withYear = papers.filter(function (p) { return p.year > 0; });
    var years = withYear.map(function (p) { return p.year; });
    var yearCounts = {};
    var citations = 0;
    withYear.forEach(function (p) {
      yearCounts[p.year] = (yearCounts[p.year] || 0) + 1;
      citations += p.citations || 0;
    });

    var monthCounts = {};
    papers.forEach(function (p) {
      var m = String(p.date || '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(m)) monthCounts[m] = (monthCounts[m] || 0) + 1;
    });

    var journals = {};
    papers.forEach(function (p) {
      var j = p.journal || '未知来源';
      journals[j] = (journals[j] || 0) + 1;
    });
    var journalList = Object.keys(journals).map(function (j) { return { name: j, count: journals[j] }; })
      .sort(function (a, b) { return b.count - a.count; });

    /* 被引分布（对数分箱） */
    var BINS = [[0, 1], [2, 5], [6, 10], [11, 20], [21, 50], [51, 100], [101, 200], [201, 999999]];
    var hist = BINS.map(function (b) { return { label: b[0] + (b[1] > 99999 ? '+' : '-' + b[1]), count: 0 }; });
    papers.forEach(function (p) {
      for (var i = 0; i < BINS.length; i++) {
        if (p.citations >= BINS[i][0] && p.citations <= BINS[i][1]) { hist[i].count++; break; }
      }
    });

    var concepts = {};
    papers.forEach(function (p) {
      (p.concepts || []).forEach(function (c) {
        var n = c.name; if (!n) return;
        concepts[n] = concepts[n] || { name: n, count: 0, cites: 0 };
        concepts[n].count++;
        concepts[n].cites += p.citations;
      });
    });
    var conceptList = Object.keys(concepts).map(function (k) { return concepts[k]; })
      .sort(function (a, b) { return b.count - a.count; });

    var authors = {};
    papers.forEach(function (p) {
      (p.authors || []).slice(0, 6).forEach(function (a) {
        if (!a.name) return;
        authors[a.name] = (authors[a.name] || 0) + 1;
      });
    });
    var authorList = Object.keys(authors).map(function (a) { return { name: a, count: authors[a] }; })
      .sort(function (a, b) { return b.count - a.count; });

    statsCache = {
      total: papers.length,
      curated: papers.filter(function (p) { return p.curated; }).length,
      citations: citations,
      yearMin: years.length ? Math.min.apply(null, years) : 0,
      yearMax: years.length ? Math.max.apply(null, years) : 0,
      yearCounts: yearCounts,
      monthCounts: monthCounts,
      journalList: journalList,
      hist: hist,
      conceptList: conceptList,
      authorList: authorList,
      withAbstract: papers.filter(function (p) { return p.abstract; }).length,
    };
    return statsCache;
  }

  window.CN = {
    papers: papers,
    meta: meta,
    taxonomy: TAX,
    flat: flat,
    findPaper: findPaper,
    tagMatch: tagMatch,
    paperTags: paperTags,
    paperTagLabels: paperTagLabels,
    searchPapers: searchPapers,
    similar: similar,
    tagCloud: tagCloud,
    stats: stats,
    isLeaf: isLeaf,
  };
})();
