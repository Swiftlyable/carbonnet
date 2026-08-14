#!/usr/bin/env node
/* ============================================================
   CarbonNet 碳网图谱 — OpenAlex 数据抓取脚本（零依赖）
   数据源：OpenAlex API（数据 CC0，可自由再分发）
   用法：node scripts/fetch-data.mjs
   可选环境变量：
     CONTACT_EMAIL — 传入 OpenAlex 礼貌池（限速更高）
     MAX_WORKS     — 期望保留的最大文献数（默认 260）
   输出（写入 data/）：
     works.json    文献数据集
     taxonomy.json 知识脉络树（材料体系 × 构筑策略 × 器件与性能）
     graph.json    材料×策略×文献三层力导向网络
     stats.json    数据面板聚合
     meta.json     生成元信息
   ============================================================ */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const MAILTO = process.env.CONTACT_EMAIL || 'carbonnet@example.com';
const MAX_WORKS = Number(process.env.MAX_WORKS || 420);
const API = 'https://api.openalex.org/works';

/* ---------------- 领域词典 ---------------- */
const MATERIALS = [
  { key: 'graphene',   label: '石墨烯及衍生物', zh: '石墨烯/氧化石墨烯/rGO 及其三维组装体',   re: /\b(graphene|rgo|reduced graphene|graphene oxide|graphdiyne)\b/i },
  { key: 'cnt',        label: '碳纳米管',       zh: 'CNT 阵列、垂直取向与三维交织网络',          re: /\b(carbon nanotube|CNTs?|carbon nanofiber|VACNT)\b/i },
  { key: 'biomass',    label: '生物质衍生碳',   zh: '壳/木/棉等生物质碳化得到的多孔碳',          re: /\b(biomass(-derived)?|biochar|wood(-derived)?|cellulose|chitosan|lignin)\b/i },
  { key: 'mof',        label: 'MOF 衍生碳',     zh: 'ZIF/MOF 热解衍生的多孔碳骨架',              re: /\b(MOF|metal-organic framework|ZIF|zeolitic imidazolate)\b/i },
  { key: 'porous',     label: '多孔碳/活性炭',  zh: '分级多孔碳、活性炭与硬碳',                  re: /\b(porous carbon|activated carbon|hierarchical porous|hard carbon|mesoporous carbon|microporous carbon)\b/i },
  { key: 'aerogel',    label: '碳气凝胶/泡沫',  zh: '超轻三维碳气凝胶、泡沫与海绵',              re: /\b(aerogel|carbon foam|graphene foam|sponge-like|carbon sponge)\b/i },
  { key: 'fiber',      label: '碳纤维/织物',    zh: '碳纤维布、碳布与织物基三维电极',            re: /\b(carbon (fiber|fibre|cloth|fabric|textile)|carbonized (cotton|silk|bamboo))\b/i },
  { key: 'otherc',     label: '其他碳材料',     zh: '碳黑、碳点、类金刚石碳等辅助碳相',          re: /\b(carbon black|carbon dot|carbon quantum dot|nanodiamond|onion-like carbon|fullerene)\b/i },
];

const STRATEGIES = [
  { key: 'template',   label: '模板法',         zh: '硬/软模板、冰模板与牺牲模板造孔',          re: /\b(template|hard template|soft template|ice template|sacrificial)\b/i },
  { key: 'assembly',   label: '自组装',         zh: '分子自组装、层层组装与水热组装',            re: /\b(self-assembl|layer-by-layer|hydrothermal|solvothermal|electrostatic assembly|vacuum filtration|filtration-assembl)\b/i },
  { key: 'print3d',    label: '3D 打印/增材',   zh: '直写、光固化与增材制造构筑三维电极',        re: /\b(3D print|three-dimensional print|additive manufacturing|direct ink writing|inkjet print)\b/i },
  { key: 'cvd',        label: 'CVD 气相沉积',   zh: '化学气相沉积在金属/泡沫基底上生长',          re: /\b(CVD|chemical vapor deposition|chemical vapour deposition)\b/i },
  { key: 'freeze',     label: '冷冻干燥',       zh: '冷冻铸造与冻干保持三维骨架',                re: /\b(freeze(-|\s)?dry|freeze(-|\s)?cast|lyophiliz|cryogel)\b/i },
  { key: 'spin',       label: '静电纺丝',       zh: '静电纺丝构建纤维网络与无纺布电极',          re: /\b(electrospin|nanofiber mat|spun fiber)\b/i },
  { key: 'doping',     label: '杂原子掺杂',     zh: 'N/S/P/B 掺杂调控电子结构与润湿性',          re: /\b(heteroatom doping|nitrogen(-|\s)?dop|N-doped|sulfur(-|\s)?dop|S-doped|phosphorus(-|\s)?dop|boron(-|\s)?dop|co-doping)\b/i },
  { key: 'activation', label: '活化造孔',       zh: 'KOH/CO₂ 活化与高温造孔',                    re: /\b(activation|KOH|chemical activat|CO2 activat)\b/i },
  { key: 'hybrid',     label: '复合杂化',       zh: '碳与赝电容材料（金属氧化物/导电聚合物/MXene）复合', re: /\b(composite|hybrid|pseudocapacitive|metal oxide|conductive polymer|polyaniline|polypyrrole|PEDOT|MXene|NiCo|RuO2|MnO2)\b/i },
];

const DEVICE = [
  { key: 'asymmetric', label: '非对称/对称器件', re: /\b(asymmetric|symmetric supercapacitor|two-electrode|device)\b/i },
  { key: 'flexible',   label: '柔性/可穿戴',     re: /\b(flexible|wearable|stretchable|fiber-shaped|yarn)\b/i },
  { key: 'solid',      label: '固态/凝胶电解质', re: /\b(solid-state|gel electrolyte|PVA|ionic liquid electrolyte|quasi-solid)\b/i },
  { key: 'energyd',    label: '高能量密度',     re: /\b(energy density|Wh kg|Wh\/kg)\b/i },
  { key: 'powerd',     label: '高功率密度',     re: /\b(power density|rate capability|fast charg)\b/i },
  { key: 'cycling',    label: '循环稳定性',     re: /\b(cycling stability|cycle stability|long-term cycling|capacitance retention)\b/i },
  { key: 'sensing',    label: '储能-传感一体化', re: /\b(integrated (device|system)|self-powered|photocharg|smart)\b/i },
];

/* 领域主题门槛：必须命中超级电容器主题词，防止宽泛综述混入 */
const SUPER_RE = /\b(supercapacitor|electrochemical capacitor|ultracapacitor|super-capacitor|electric double[- ]?layer|EDLC|capacitive energy storage|capacitance|capacitor electrode)\b/i;

/* ---------------- OpenAlex 抓取 ---------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, retries = 4) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': `carbonnet-fetcher/1.0 (mailto:${MAILTO})` } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === retries) throw new Error(`fetch failed: ${e.message} — ${url}`);
      await sleep(1000 * (i + 1));
    }
  }
}

/* 摘要 inverted index → 纯文本 */
function rebuildAbstract(inv) {
  if (!inv || typeof inv !== 'object') return '';
  const pos = [];
  for (const [word, idxs] of Object.entries(inv)) for (const i of idxs) pos[i] = word;
  return pos.join(' ').trim();
}

const CAP_FG_RE = /(\d{2,5}(?:\.\d+)?)\s*F\s*g\s*[−-]?\s*1/gi;
const CAP_MF_RE = /(\d{1,4}(?:\.\d+)?)\s*mF\s*cm\s*[−-]?\s*2/gi;

function extractCapacitance(text) {
  const fg = [], mf = [];
  if (!text) return { fg, mf };
  let m;
  const seen = new Set();
  CAP_FG_RE.lastIndex = 0;
  while ((m = CAP_FG_RE.exec(text)) && fg.length < 3) {
    const v = parseFloat(m[1]);
    const key = `${Math.round(v / 10)}`;
    if (!seen.has(key) && v >= 20 && v <= 2000) { fg.push(v); seen.add(key); }
  }
  CAP_MF_RE.lastIndex = 0;
  while ((m = CAP_MF_RE.exec(text)) && mf.length < 2) mf.push(parseFloat(m[1]));
  return { fg, mf };
}

function matchTags(text, dict) {
  const out = new Set();
  for (const d of dict) if (d.re.test(text)) out.add(d.key);
  return out;
}

function pickAuthors(authorships) {
  return (authorships || [])
    .filter((a) => a.author)
    .slice(0, 8)
    .map((a) => a.author.display_name)
    .filter(Boolean);
}

function workToRecord(w) {
  const title = w.title || '';
  const abstract = rebuildAbstract(w.abstract_inverted_index);
  const concepts = (w.concepts || [])
    .filter((c) => c.score > 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((c) => c.display_name);
  const hay = `${title} ${abstract} ${concepts.join(' ')} ${(w.keywords || []).map((k) => k.display_name).join(' ')}`;
  if (!SUPER_RE.test(hay)) return null; /* 未命中超级电容器主题 → 离题，丢弃 */
  const mTags = [...matchTags(hay, MATERIALS)];
  const sTags = [...matchTags(hay, STRATEGIES)];
  const dTags = [...matchTags(hay, DEVICE)];
  const cap = extractCapacitance(abstract);
  const openId = w.id ? w.id.replace('https://openalex.org/', '') : '';
  return {
    id: openId || `local-${w.doi || Math.random().toString(36).slice(2, 10)}`,
    title,
    year: w.publication_year || null,
    date: w.publication_date || null,
    venue: (w.primary_location?.source?.display_name) || null,
    cited: w.cited_by_count ?? 0,
    doi: w.doi ? w.doi.replace('https://doi.org/', '') : null,
    oa: w.open_access?.oa_status || null,
    type: w.type || 'article',
    authors: pickAuthors(w.authorships),
    abstract,
    concepts,
    tags: [...new Set([...mTags, ...sTags])],
    mTags,
    sTags,
    dTags,
    capFg: cap.fg,
    capMf: cap.mf,
  };
}

async function collectWorks() {
  const queries = [
    '"three-dimensional conductive network" supercapacitor carbon',
    '"3D porous carbon" supercapacitor electrode',
    '"graphene aerogel" supercapacitor',
    '"carbon nanotube" supercapacitor electrode 3D network',
    '"biomass-derived carbon" supercapacitor',
    '"MOF-derived carbon" supercapacitor',
    '"hierarchical porous carbon" supercapacitor',
    '"3D graphene network" supercapacitor',
    '"carbon nanofiber" supercapacitor electrode',
    '"porous carbon" supercapacitor "energy density"',
  ];
  const seen = new Map();
  const baseSelect = 'select=id,doi,title,publication_year,publication_date,cited_by_count,type,open_access,authorships,primary_location,abstract_inverted_index,concepts,keywords';
  for (const q of queries) {
    /* 页 1：按相关度；页 2：按发布日期倒序（保证最新文献覆盖） */
    const urls = [
      `${API}?search=${encodeURIComponent(q)}&per-page=50&${baseSelect}&mailto=${encodeURIComponent(MAILTO)}`,
      `${API}?search=${encodeURIComponent(q)}&per-page=50&sort=publication_date:desc&${baseSelect}&mailto=${encodeURIComponent(MAILTO)}`,
    ];
    for (const url of urls) {
      const page = await fetchJson(url);
      for (const w of page.results || []) {
        if (!w.title || seen.has(w.id)) continue;
        const rec = workToRecord(w);
        if (!rec) continue; /* 离题（未命中超级电容器主题） */
        /* 保底：至少命中一个材料/策略关键词才算领域内 */
        if (rec.mTags.length === 0 && rec.sTags.length === 0) continue;
        seen.set(w.id, rec);
      }
      await sleep(250);
    }
    console.log(`query "${q.slice(0, 46)}…": total kept ${seen.size}`);
    if (seen.size >= MAX_WORKS) break;
  }
  const works = [...seen.values()].sort((a, b) => (b.cited ?? 0) - (a.cited ?? 0));
  return works.slice(0, MAX_WORKS);
}

/* ---------------- taxonomy / graph / stats 生成 ---------------- */
function buildTaxonomy(works) {
  const node = (name, zh, key) => ({ name, zh, key, value: 0, children: [] });
  const root = { name: '碳材料超级电容器三维导电网络', zh: 'Carbon Supercapacitor 3D Conductive Network', key: 'root', value: works.length, children: [] };
  const mat = node('材料体系', 'Materials', 'dim-mat');
  const str = node('构筑策略', 'Strategies', 'dim-str');
  const dev = node('器件与性能', 'Devices & Performance', 'dim-dev');
  const paperIds = new Set(works.map((w) => w.id));
  for (const d of MATERIALS) {
    const hits = works.filter((w) => w.mTags.includes(d.key));
    mat.children.push({
      name: d.label, zh: d.zh, key: `mat-${d.key}`, value: hits.length,
      children: hits.slice(0, 4).map((w) => ({ name: w.title.slice(0, 60), zh: '', key: w.id, value: w.cited, paper: true })),
    });
  }
  for (const d of STRATEGIES) {
    const hits = works.filter((w) => w.sTags.includes(d.key));
    str.children.push({
      name: d.label, zh: d.zh, key: `str-${d.key}`, value: hits.length,
      children: hits.slice(0, 4).map((w) => ({ name: w.title.slice(0, 60), zh: '', key: w.id, value: w.cited, paper: true })),
    });
  }
  for (const d of DEVICE) {
    const hits = works.filter((w) => w.dTags.includes(d.key));
    dev.children.push({ name: d.label, zh: d.label, key: `dev-${d.key}`, value: hits.length, children: [] });
  }
  mat.value = mat.children.reduce((s, c) => s + c.value, 0);
  str.value = str.children.reduce((s, c) => s + c.value, 0);
  dev.value = dev.children.reduce((s, c) => s + c.value, 0);
  root.children.push(mat, str, dev);
  root.paperIds = [...paperIds];
  return root;
}

function buildGraph(works) {
  const nodes = [];
  const links = [];
  const nidx = new Map();
  const addNode = (id, name, category, size, extra = {}) => {
    if (!nidx.has(id)) { nidx.set(id, nodes.length); nodes.push({ id, name, category, size, ...extra }); }
    return nidx.get(id);
  };
  for (const d of MATERIALS) {
    const hits = works.filter((w) => w.mTags.includes(d.key));
    if (hits.length === 0) continue;
    addNode(`mat-${d.key}`, d.label, 'material', 14 + Math.log2(hits.length + 1) * 5, { zh: d.zh, count: hits.length });
    for (const w of hits) {
      addNode(w.id, w.title.slice(0, 52), 'paper', Math.max(4, Math.min(16, Math.sqrt(w.cited) + 4)), { year: w.year, cited: w.cited, venue: w.venue });
      links.push({ source: `mat-${d.key}`, target: w.id });
    }
  }
  for (const d of STRATEGIES) {
    const hits = works.filter((w) => w.sTags.includes(d.key));
    if (hits.length === 0) continue;
    addNode(`str-${d.key}`, d.label, 'strategy', 14 + Math.log2(hits.length + 1) * 5, { zh: d.zh, count: hits.length });
    for (const w of hits) {
      if (!nidx.has(w.id)) addNode(w.id, w.title.slice(0, 52), 'paper', Math.max(4, Math.min(16, Math.sqrt(w.cited) + 4)), { year: w.year, cited: w.cited, venue: w.venue });
      links.push({ source: `str-${d.key}`, target: w.id });
    }
  }
  return { nodes, links, categories: { material: '材料体系', strategy: '构筑策略', paper: '文献' } };
}

function buildStats(works) {
  const yearly = new Map();
  const venues = new Map();
  const types = new Map();
  const oas = new Map();
  let citations = 0;
  const heat = new Map();
  const capFg = [];
  for (const w of works) {
    citations += w.cited || 0;
    const y = w.year || 0;
    const ye = yearly.get(y) || { year: y, count: 0, cited: 0 };
    ye.count++; ye.cited += w.cited || 0;
    yearly.set(y, ye);
    if (w.venue) venues.set(w.venue, (venues.get(w.venue) || 0) + 1);
    types.set(w.type || 'unknown', (types.get(w.type || 'unknown') || 0) + 1);
    oas.set(w.oa || 'unknown', (oas.get(w.oa || 'unknown') || 0) + 1);
    for (const mt of w.mTags) for (const st of w.sTags) {
      const k = `${mt}|${st}`;
      heat.set(k, (heat.get(k) || 0) + 1);
    }
    for (const v of w.capFg || []) capFg.push(v);
  }
  const hist = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const w of works) {
    const c = w.cited || 0;
    if (c < 10) hist[0]++;
    else if (c < 50) hist[1]++;
    else if (c < 100) hist[2]++;
    else if (c < 200) hist[3]++;
    else if (c < 500) hist[4]++;
    else if (c < 1000) hist[5]++;
    else if (c < 5000) hist[6]++;
    else hist[7]++;
  }
  const xMats = MATERIALS.map((d) => d.label);
  const yStrs = STRATEGIES.map((d) => d.label);
  const heatData = [];
  MATERIALS.forEach((m, i) => STRATEGIES.forEach((s, j) => {
    const v = heat.get(`${m.key}|${s.key}`) || 0;
    if (v > 0) heatData.push([i, j, v]);
  }));
  return {
    kpi: {
      works: works.length,
      citations,
      avgCited: works.length ? Math.round(citations / works.length) : 0,
      years: { min: Math.min(...works.map((w) => w.year || 9999)), max: Math.max(...works.map((w) => w.year || 0)) },
      venues: venues.size,
    },
    yearly: [...yearly.values()].filter((y) => y.year > 0).sort((a, b) => a.year - b.year),
    venues: [...venues.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, count]) => ({ name, count })),
    types: [...types.entries()].map(([name, count]) => ({ name, count })),
    oa: [...oas.entries()].map(([name, count]) => ({ name, count })),
    citedHist: { bins: ['0-9', '10-49', '50-99', '100-199', '200-499', '500-999', '1k-5k', '5k+'], hist },
    heatmap: { x: xMats, y: yStrs, data: heatData },
    capFg,
    topWorks: works.slice(0, 10).map((w) => ({ id: w.id, title: w.title, cited: w.cited, year: w.year })),
  };
}

/* ---------------- 主流程 ---------------- */
async function main() {
  console.log('CarbonNet fetcher — source: OpenAlex');
  console.log(`collecting works (max ${MAX_WORKS})…`);
  const works = await collectWorks();
  console.log(`kept ${works.length} works`);

  mkdirSync(DATA_DIR, { recursive: true });
  const taxonomy = buildTaxonomy(works);
  const graph = buildGraph(works);
  const stats = buildStats(works);
  const meta = {
    generated_at: new Date().toISOString(),
    source: 'OpenAlex API',
    license: 'CC0 (OpenAlex)',
    works: works.length,
    query_count: 10,
    /* 注意：不写入 CONTACT_EMAIL（可能来自 secrets，禁止随数据提交公开） */
  };
  writeFileSync(join(DATA_DIR, 'works.json'), JSON.stringify(works), 'utf8');
  writeFileSync(join(DATA_DIR, 'taxonomy.json'), JSON.stringify(taxonomy), 'utf8');
  writeFileSync(join(DATA_DIR, 'graph.json'), JSON.stringify(graph), 'utf8');
  writeFileSync(join(DATA_DIR, 'stats.json'), JSON.stringify(stats), 'utf8');
  writeFileSync(join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
  console.log(`written: works.json (${works.length}), taxonomy.json, graph.json (${graph.nodes.length} nodes/${graph.links.length} links), stats.json, meta.json`);
  console.log(`sample: ${works[0]?.title?.slice(0, 70)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
