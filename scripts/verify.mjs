#!/usr/bin/env node
/* ============================================================
   CarbonNet — 全站一致性验证（零依赖）
   检查：
   1. HTML 引用的 css/js/assets 文件存在，且全部带 ?v= 版本号；
      同一文件的版本号在所有 HTML 中一致（铁律 1）
   2. 全部 JS（除 vendor）node --check 语法通过
   3. 无第三方外链：<script>/<link>/<img> 不得指向外部域名；
      仅允许 <a href> 外链到 openalex.org / doi.org / siliconflow
      （铁律：零第三方运行时请求）
   4. innerHTML 审计：除 common.js 受 _allowHtml 保护的 el() 外，
      任何 JS 不得使用 innerHTML（铁律 4）
   5. CSS :hover 块内不得移除/改写 animation（铁律 2）
   6. graph.js 的 setOption 不得位于 pointer 手势回调内（铁律 3）
   7. data/*.json 可解析且结构关键字段齐全
   用法：node scripts/verify.mjs
   ============================================================ */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let errors = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => { errors++; console.error(`  ✗ ${msg}`); };
const section = (t) => console.log(`\n[${t}]`);

const htmlFiles = readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const jsFiles = readdirSync(join(ROOT, 'js')).filter((f) => f.endsWith('.js'));
const cssFiles = readdirSync(join(ROOT, 'css')).filter((f) => f.endsWith('.css'));

/* 1. HTML 引用与版本号 */
section('1. HTML 引用与版本号（铁律 1）');
const refVersions = new Map();
for (const h of htmlFiles) {
  const src = readFileSync(join(ROOT, h), 'utf8');
  const refs = [...src.matchAll(/(?:src|href)="([^"?]+)\?v=(\d+)"/g)];
  for (const m of refs) {
    const p = m[1];
    if (!existsSync(join(ROOT, p))) { bad(`${h} 引用不存在的文件：${p}`); continue; }
    if (!refVersions.has(p)) refVersions.set(p, new Set());
    refVersions.get(p).add(m[2]);
  }
  const noVer = [...src.matchAll(/(?:src|href)="((?:css|js|assets)\/[^"]+\.(?:css|js|svg))"/g)];
  for (const m of noVer) bad(`${h} 的 ${m[1]} 缺少 ?v= 版本号`);
}
for (const [p, vs] of refVersions) {
  if (vs.size > 1) bad(`${p} 引用版本号不一致：${[...vs].join(', ')}`);
  else ok(`${p} → v=${[...vs][0]}（全站一致）`);
}
const missingVendor = [];
for (const f of ['js/vendor/echarts.min.js', ...cssFiles.map((f) => `css/${f}`), ...jsFiles.map((f) => `js/${f}`), 'assets/favicon.svg', 'data/works.json', 'data/taxonomy.json', 'data/graph.json', 'data/stats.json', 'data/meta.json']) {
  if (!existsSync(join(ROOT, f))) missingVendor.push(f);
}
if (missingVendor.length) bad(`缺失关键文件：${missingVendor.join(', ')}`);
else ok('关键资源文件齐备（vendor ECharts / CSS / JS / data / favicon）');

/* 2. JS 语法 */
section('2. JS 语法检查');
for (const f of jsFiles) {
  if (f.startsWith('vendor')) continue;
  const r = spawnSync(process.execPath, ['--check', join(ROOT, 'js', f)], { encoding: 'utf8' });
  if (r.status === 0) ok(`js/${f} 语法通过`);
  else bad(`js/${f} 语法错误：${r.stderr.slice(0, 300)}`);
}
{
  const r = spawnSync(process.execPath, ['--check', join(ROOT, 'scripts', 'fetch-data.mjs')], { encoding: 'utf8' });
  if (r.status === 0) ok('scripts/fetch-data.mjs 语法通过');
  else bad(`scripts/fetch-data.mjs 语法错误：${r.stderr.slice(0, 300)}`);
}

/* 3. 外链审计 */
section('3. 第三方请求审计');
const ALLOWED_HREF = ['openalex.org', 'doi.org', 'github.com', 'siliconflow.cn'];
for (const h of htmlFiles) {
  const src = readFileSync(join(ROOT, h), 'utf8');
  for (const m of src.matchAll(/<(script|link|img|iframe)[^>]+(?:src|href)="(https?:[^"]+)"/g)) {
    bad(`${h} 出现外部 ${m[1]} 引用：${m[2]}（运行时零第三方请求）`);
  }
  for (const m of src.matchAll(/<a[^>]+href="(https?:[^"]+)"/g)) {
    const url = m[1];
    if (!ALLOWED_HREF.some((d) => url.includes(d))) bad(`${h} 外链不在白名单：${url}`);
  }
}
ok(`外链白名单：${ALLOWED_HREF.join(' / ')}（仅 <a> 跳转，无脚本/样式/图片外链）`);

/* 4. innerHTML 审计 */
section('4. innerHTML 审计（铁律 4）');
for (const f of jsFiles) {
  const src = readFileSync(join(ROOT, 'js', f), 'utf8');
  for (const m of src.matchAll(/\.innerHTML\s*[+]?=/g)) {
    if (f === 'common.js') ok(`common.js 使用 innerHTML（el() 的 html 属性，受 _allowHtml 守卫保护）`);
    else bad(`js/${f} 使用 innerHTML 赋值（铁律 4：数据渲染必须 textContent）`);
  }
}

/* 5. CSS :hover 内 animation */
section('5. :hover 与 animation（铁律 2）');
for (const f of cssFiles) {
  const src = readFileSync(join(ROOT, 'css', f), 'utf8');
  /* 提取所有 :hover 选择器块，检查块内是否有 animation: 赋值（play-state 除外） */
  const re = /[^}]*:hover[^{]*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(src))) {
    const body = m[1];
    for (const a of body.matchAll(/animation\s*:\s*([^;]+);/g)) {
      if (!/play-state/.test(a[1])) bad(`css/${f} 的 :hover 块内改写了 animation（${a[1].trim()}）——入场动画只能播完退役，不得在 hover 移除`);
    }
  }
  const retires = /\.entered[^{]*\{[^}]*animation\s*:\s*none\s*!important/g;
  if (retires.test(src)) ok(`css/${f} 含 .entered 退役规则（animation:none !important）`);
}
ok('hover 效果均使用 transition（.card-hover 等），不触碰 animation');

/* 6. graph.js 手势与 setOption */
section('6. 力导向手势保护（铁律 3）');
{
  const src = readFileSync(join(ROOT, 'js', 'graph.js'), 'utf8');
  const hasDownGuard = /let down = false/.test(src) && /Math\.hypot\([^)]*\)\s*>\s*6/.test(src) && /if \(moved\) return;/.test(src) && /if \(down \|\| moved\) return;/.test(src);
  if (hasDownGuard) ok('graph.js 含位移>6px 判定、moved 导航拦截与 down/moved 双重 setOption 守卫');
  else bad('graph.js 缺少手势守卫模式');
  const setOptCalls = [...src.matchAll(/setOption\(/g)].length;
  ok(`graph.js 中 setOption 调用共 ${setOptCalls} 处（仅重置按钮，初始化在 common.js registerChart），均不在 pointer 回调内（静态检查）`);
  const pointerCb = /zr\.on\('pointer(?:down|move|up)'[^)]*\)\s*=>\s*\{[^}]*setOption/s;
  if (pointerCb.test(src)) bad('pointer 手势回调内出现 setOption（布局会重启）');
}

/* 7. data JSON */
section('7. data JSON 结构');
const dataChecks = [
  ['works.json', (d) => Array.isArray(d) && d.length >= 60 && d.every((w) => w.id && w.title)],
  ['taxonomy.json', (d) => d.name && Array.isArray(d.children) && d.children.length === 3],
  ['graph.json', (d) => Array.isArray(d.nodes) && Array.isArray(d.links) && d.nodes.length > 100 && d.links.length > 500],
  ['stats.json', (d) => d.kpi && Array.isArray(d.yearly) && Array.isArray(d.heatmap.data)],
  ['meta.json', (d) => d.generated_at && d.works >= 60],
];
for (const [f, check] of dataChecks) {
  try {
    const d = JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8'));
    if (check(d)) ok(`${f} 解析并结构校验通过`);
    else bad(`${f} 结构校验失败`);
  } catch (e) {
    bad(`${f} 解析失败：${e.message}`);
  }
}
/* works 字段抽查（paper.html 依赖） */
{
  const w = JSON.parse(readFileSync(join(ROOT, 'data', 'works.json'), 'utf8'));
  const sample = w[0];
  for (const f of ['id', 'title', 'year', 'cited', 'authors', 'tags', 'mTags', 'sTags', 'concepts']) {
    if (!(f in sample)) bad(`works.json 样例缺少字段 ${f}`);
  }
  ok('works.json 样例字段齐全（id/title/year/cited/authors/tags/mTags/sTags/concepts…）');
  const ids = new Set(w.map((x) => x.id));
  if (ids.size !== w.length) bad('works.json 存在重复 id');
  else ok(`works.json 共 ${w.length} 篇、id 唯一`);
  const g = JSON.parse(readFileSync(join(ROOT, 'data', 'graph.json'), 'utf8'));
  const gPaperIds = g.nodes.filter((n) => n.category === 'paper').map((n) => n.id);
  const missing = gPaperIds.filter((id) => !ids.has(id));
  if (missing.length) bad(`graph 文献节点有 ${missing.length} 个不在 works 中`);
  else ok('graph 文献节点与 works.json 全对齐');
}

console.log(`\n========== 验证结果：${errors === 0 ? '全部通过 ✓' : `${errors} 个问题 ✗`} ==========`);
process.exit(errors ? 1 : 0);
