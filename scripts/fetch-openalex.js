#!/usr/bin/env node
/**
 * CarbonNet 数据管线
 * 从 OpenAlex 抓取「碳材料超级电容器三维导电网络」相关文献，
 * 合并人工整理的经典文献（含中文摘要），输出：
 *   data/papers.json —— 原始 JSON（可读、可审计）
 *   data/papers.js   —— window.CARBONNET_PAPERS / window.CARBONNET_META（站点直接引用）
 *
 * 无第三方依赖，仅用 Node 18+ 内置 fetch。GitHub Actions 每周自动运行。
 * 用法：node scripts/fetch-openalex.js   （可选环境变量 OPENALEX_MAILTO）
 */
'use strict';

const fs = require('fs');
const path = require('path');

const API = 'https://api.openalex.org';
const MAILTO = process.env.OPENALEX_MAILTO || '';
const OUT_DIR = path.join(__dirname, '..', 'data');
const CAP = 200; // 最终收录上限（按被引排序）

/* 检索式：多路检索后按 OpenAlex ID 去重合并 */
const QUERIES = [
  'three-dimensional conductive network supercapacitor carbon',
  '3D porous carbon network supercapacitor electrode',
  'graphene aerogel supercapacitor electrode',
  'carbon nanotube sponge supercapacitor',
  'carbon fiber network supercapacitor electrode',
  '3D graphene framework supercapacitor',
  'hierarchical porous carbon supercapacitor energy storage',
  'carbon aerogel electrode capacitance',
  'biomass derived porous carbon supercapacitor',
  '3D printed electrode supercapacitor',
  'free-standing carbon electrode supercapacitor',
];

/* 主题相关性门控：
   - CORE  ：必须命中超电容核心词
   - SENSE ：传感器/屏蔽/摩擦电等邻近领域，除非标题摘要明确含 supercapacit，否则剔除
   - SHAPE ：必须命中三维/网络/碳结构词（保证「三维导电网络」主题聚焦） */
const CORE = /supercapacit|ultracapacit|electrochemical capacitor|double-layer capacitor|pseudo-?capacit/i;
const SENSE = /sensor|shielding|electromagnetic interference|triboelectric|piezoelectric|thermoelectric|nanogenerator|battery management/i;
const SHAPE = /three-?dimensional|3-?d|porous|network|aerogel|nanotube|graphene|carbon|hierarch|foam|sponge|framework|scaffold|interconnect|fiber|fibre|activated carbon/i;

function relevant(p) {
  const h = [p.title, p.abstract, (p.keywords || []).join(' ')].join(' ').toLowerCase();
  if (!CORE.test(h)) return false;
  if (SENSE.test(h) && !/supercapacit/.test(h)) return false;
  if (!SHAPE.test(h)) return false;
  return true;
}

/* 经典文献（人工整理，附中文摘要）。rank 用于首页「精选/经典」排序。 */
const CLASSICS = [
  {
    doi: '10.1038/nmat2297', rank: 1,
    zh: '系统梳理了电化学电容器的基础原理与电极材料：碳基双电层材料、过渡金属氧化物/导电聚合物赝电容材料及混合体系，指出三维多孔碳的孔结构与导电网络是功率与能量平衡的关键，为后续三维导电网络电极研究奠定了框架。',
  },
  {
    doi: '10.1039/b813846j', rank: 2,
    zh: '综述了碳材料（活性炭、碳纳米管、石墨烯、碳化物衍生碳、模板碳）作为超级电容器电极的研究进展，强调比表面积、孔径分布与导电性三者协同，并讨论了三维有序孔道网络在提升倍率性能中的作用。',
  },
  {
    doi: '10.1039/c1cs15060j', rank: 3,
    zh: '全面评述电化学超级电容器三类电极材料（碳材料、金属氧化物、导电聚合物）的储能机制与性能瓶颈，指出构建分级孔结构与连续导电骨架是实现高功率密度的主要路径。',
  },
  {
    doi: '10.1126/science.1200770', rank: 4,
    zh: '提出以 KOH 活化微波剥离氧化石墨烯，获得比表面积约 3100 m²/g 的三维多孔石墨烯网络，其弯曲孔壁构成连续导电骨架，在多种电解液中比电容与能量密度远超传统活性炭，是化学活化构建 3D 多孔碳网络的代表作。',
  },
  {
    doi: '10.1126/science.1216744', rank: 5,
    zh: '用 LightScribe 激光在氧化石墨烯薄膜上原位刻写还原，一步制成叉指结构石墨烯微型超级电容器：多孔电极网络无需粘结剂与集流体，功率密度可与电解电容器相当，开辟了柔性微型储能方向。',
  },
  {
    doi: '10.1038/nnano.2010.162', rank: 6,
    zh: '采用洋葱状碳（OLC）构建微米级超级电容器电极：零维碳球密堆积形成完全外表面可及的导电网络，充放电速率达毫秒量级，证明无孔内扩散限制的网络可实现超高功率。',
  },
  {
    doi: '10.1126/science.1132195', rank: 7,
    zh: '发现孔径小于 1 nm 的碳化物衍生碳中离子发生部分去溶剂化、电容反常升高，颠覆了“孔径需大于溶剂化离子”的传统认知，为微孔网络电极的孔工程设计提供了关键依据。',
  },
  {
    doi: '10.1038/nmat3001', rank: 8,
    zh: '以镍泡沫为模板 CVD 生长三维石墨烯网络：自支撑、高导电、比表面大，免粘结剂直接用作超级电容器电极，展示了大面积三维导电骨架在储能器件中的可行性。',
  },
  {
    doi: '10.1021/nn4000836', rank: 9,
    zh: '通过水热自组装制备三维石墨烯水凝胶并压制成膜，形成连通的介孔导电网络，组装全固态柔性超级电容器实现高比电容与优异循环稳定性，是自组装 3D 网络电极的代表工作。',
  },
  {
    doi: '10.1021/acs.chemrev.8b00252', rank: 10,
    zh: '系统论述非对称超级电容器的设计原理与电荷平衡策略，从材料到器件层面梳理高电压窗口的实现路径，为基于三维导电网络的正负极匹配提供设计指南。',
  },
];

const SELECT = [
  'id', 'doi', 'title', 'display_name', 'publication_year', 'publication_date',
  'cited_by_count', 'authorships', 'primary_location', 'type', 'open_access',
  'concepts', 'keywords', 'abstract_inverted_index', 'biblio',
].join(',');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiGet(pathname) {
  const url = new URL(pathname, API);
  if (MAILTO) url.searchParams.set('mailto', MAILTO);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'CarbonNet-data-pipeline (GitHub Actions)' },
  });
  if (!res.ok) {
    console.error('  HTTP', res.status, url.toString());
    return null;
  }
  return res.json();
}

function abstractText(inv) {
  if (!inv || typeof inv !== 'object') return '';
  const pos = {};
  for (const [word, positions] of Object.entries(inv)) {
    for (const p of positions) pos[p] = word;
  }
  const out = [];
  for (let i = 0; i < Object.keys(pos).length; i++) if (pos[i]) out.push(pos[i]);
  return out.join(' ');
}

function cleanAuthors(a) {
  return (a || [])
    .slice(0, 20)
    .map((x) => ({
      name: (x.author && x.author.display_name) || '',
      institution: ((x.institutions || [])[0] || {}).display_name || '',
    }))
    .filter((x) => x.name);
}

function cleanConcepts(c) {
  return (c || []).slice(0, 6).map((x) => ({
    name: x.display_name || '', level: x.level || 0, score: x.score || 0,
  }));
}

function cleanKeywords(k) {
  return (k || []).slice(0, 8).map((x) => x.display_name).filter(Boolean);
}

function clean(work) {
  const src = (work.primary_location && work.primary_location.source) || {};
  const bib = work.biblio || {};
  return {
    id: String(work.id || '').replace('https://openalex.org/', ''),
    doi: work.doi || '',
    title: work.title || work.display_name || '',
    year: work.publication_year || 0,
    date: work.publication_date || '',
    citations: work.cited_by_count || 0,
    authors: cleanAuthors(work.authorships),
    journal: src.display_name || '',
    type: work.type || '',
    oa: (work.open_access && work.open_access.oa_status) || '',
    concepts: cleanConcepts(work.concepts),
    keywords: cleanKeywords(work.keywords),
    abstract: abstractText(work.abstract_inverted_index),
    vol: bib.volume || '',
    issue: bib.issue || '',
    pages: bib.first_page ? String(bib.first_page) + (bib.last_page ? '-' + bib.last_page : '') : '',
  };
}

async function searchWorks(query) {
  const out = [];
  let cursor = '*';
  while (out.length < 200 && cursor) {
    const params = new URLSearchParams({
      filter: 'title_and_abstract.search:' + query,
      'per-page': '100',
      sort: 'cited_by_count:desc',
      select: SELECT,
    });
    if (cursor !== '*') params.set('cursor', cursor);
    const j = await apiGet('/works?' + params.toString());
    if (!j) break;
    out.push(...(j.results || []));
    cursor = (j.meta && j.meta.next_cursor) || null;
    await sleep(150);
  }
  return out;
}

async function workByDoi(doi) {
  const params = new URLSearchParams({ filter: 'doi:' + doi, select: SELECT, 'per-page': '1' });
  const j = await apiGet('/works?' + params.toString());
  return j && j.results && j.results[0] ? j.results[0] : null;
}

async function main() {
  const map = new Map();
  const errors = [];

  for (const q of QUERIES) {
    process.stdout.write('search: ' + q + ' ... ');
    const rs = await searchWorks(q);
    for (const w of rs) if (w && w.id) map.set(w.id, clean(w));
    console.log('+' + rs.length + ' (累计去重 ' + map.size + ')');
    await sleep(200);
  }

  for (const c of CLASSICS) {
    try {
      const w = await workByDoi(c.doi);
      if (w && w.id) {
        const o = clean(w);
        o.zh_abstract = c.zh;
        o.curated = c.rank;
        map.set(w.id, o);
        console.log('classic ok: ' + c.doi + ' -> ' + o.id);
      } else {
        errors.push('classic missing: ' + c.doi);
      }
    } catch (e) {
      errors.push('classic error: ' + c.doi + ' ' + e.message);
    }
    await sleep(200);
  }

  const preGate = map.size;
  let list = Array.from(map.values())
    .filter((p) => p.title && (p.curated || relevant(p)))
    .sort((a, b) => b.citations - a.citations);
  const dropped = list.length - CAP;
  /* 混合收录：高被引 170 + 最新收录 30（保证「最新文献」时效性） */
  const byCite = list.slice(0, 170);
  const citeSet = new Set(byCite.map((p) => p.id));
  const byDate = list.slice(170)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .filter((p) => !citeSet.has(p.id))
    .slice(0, 30);
  list = byCite.concat(byDate).sort((a, b) => b.citations - a.citations);
  console.log('gate: ' + preGate + ' -> ' + list.length + ' relevant (170 cited + ' + byDate.length + ' recent)');

  const meta = {
    fetchedAt: new Date().toISOString(),
    total: list.length,
    curated: list.filter((p) => p.curated).length,
    source: 'OpenAlex',
    queries: QUERIES.length,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'papers.json'), JSON.stringify(list, null, 1), 'utf8');
  const js = '/* CarbonNet 数据 —— 由 scripts/fetch-openalex.js 生成，请勿手改 */\n'
    + 'window.CARBONNET_PAPERS=' + JSON.stringify(list) + ';\n'
    + 'window.CARBONNET_META=' + JSON.stringify(meta) + ';\n';
  fs.writeFileSync(path.join(OUT_DIR, 'papers.js'), js, 'utf8');

  console.log('----');
  console.log('done: ' + list.length + ' papers (dropped ' + dropped + '), curated ' + meta.curated);
  if (errors.length) console.log('errors:\n' + errors.join('\n'));
}

main().catch((e) => { console.error(e); process.exit(1); });
