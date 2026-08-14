# CarbonNet 碳网图谱

「碳材料超级电容器三维导电网络」文献知识站。静态站点，零构建、零第三方运行时请求：
原生 HTML/CSS/JS + 本地 vendored ECharts + 本地打包字体，数据来自 OpenAlex，每周自动更新。

## 页面

| 页面 | 文件 | 说明 |
| --- | --- | --- |
| 首页 | `index.html` | hero 粒子画布、大字标语带、KPI、最新文献、热门标签云、精选/经典文献 |
| 知识脉络 | `taxonomy.html` | 材料×策略×器件 taxonomy 树图，点节点弹右侧详情面板（× / 点空白 / Esc 关闭） |
| 知识关系图 | `graph.html` | 材料×策略×文献三层力导向网络，点文献节点进详情页，点标签进文献库筛选 |
| 文献库 | `library.html` | 搜索 / 多维筛选 / CSV 导出 / 分页，表格行错峰入场动画 |
| 数据面板 | `stats.html` | 年度趋势 / 期刊 / 材料×策略热力图 / 性能（比电容）分布等 ECharts 图表 |
| 论文详情 | `paper.html` | `?id=` 或 `?doi=` 定位，完整元信息 + 中英摘要 + 相似文献推荐 |
| AI 助手 | `ai.html` | BYOK：密钥仅存 localStorage，浏览器直连硅基流动 api.siliconflow.cn |
| 关于 | `about.html` | 项目说明、数据来源、许可证 |

## 本地运行

无构建步骤，但 `fetch` 加载本地 JSON 需要 HTTP 服务（`file://` 会被浏览器 CORS 拦截）：

```bash
python -m http.server 8000     # 或 npx serve
# 打开 http://localhost:8000
```

## 部署到 GitHub Pages

1. 推送本仓库到 GitHub。
2. Settings → Pages → **Source: GitHub Actions**（workflow 已内置 deploy-pages）。
3. 手动跑一次 `Update Data & Deploy`，或等待每周一 02:00 UTC 的定时任务。
4. （推荐）Settings → Secrets and variables → Actions → 新建 `CONTACT_EMAIL` 秘密，
   填入你的邮箱以进入 OpenAlex 礼貌池（更高限速）。不设置也可运行。

## 数据管线

- `scripts/fetch-data.mjs` — 零依赖 Node 脚本（内置 fetch），查询 OpenAlex API，
  生成 `data/` 下五个 JSON：
  - `works.json` — 文献记录（含还原后的英文摘要、材料/策略/器件标签、比电容值）
  - `taxonomy.json` — 知识脉络树
  - `graph.json` — 三层力导向网络（材料→文献←策略，无跨层直连）
  - `stats.json` — 数据面板聚合
  - `meta.json` — 生成时间与统计
- 文献数据版权：OpenAlex 数据为 CC0，可自由再分发。

## 设计令牌

所有颜色集中在 `css/tokens.css`（暗色默认：底色 `#0a0f14`、电光青 `#7CC7FF`、深蓝
`#125E9A`；浅色主题覆盖同名变量）。ECharts 通过 `chartTheme()` 读取同一批
`--chart-*` 变量——改令牌即全站换肤（含图表）。

## 维护铁律（改代码前必读）

1. **缓存版本号**：CSS/JS 每次改动后，所有引用它的 HTML 中 `?v=N` 必须 +1
   （浏览器缓存）。可以用 `node scripts/verify.mjs` 检查引用一致性。
2. **入场动画必须退役**：动画播完由 JS 加 `.entered`（`animation: none !important`），
   绝不能在 `:hover` 时移除动画，否则移开鼠标卡片会闪没；hover 效果一律用 transition。
3. **力导向图手势保护**：`pointerdown/up/move` 期间绝不 `setOption`（会布局重启、
   节点点击失效）；点击导航用 `click` + `pointerup` 位移 <6px 兜底，拖拽（>6px）不导航。
4. **防 XSS**：文献数据渲染一律 `textContent`，搜索高亮用 DOM 文本节点拆分。
5. **AI 助手 BYOK**：密钥只存浏览器 localStorage，浏览器直连
   `https://api.siliconflow.cn`，密钥绝不进代码仓库、不引第三方脚本。
6. **push 前先 `git fetch` + `rebase origin/main`**（本地与 workflow 同样遵守）。
7. **编码纪律（重要）**：全仓库文件一律 UTF-8。在 Windows 上严禁用 PowerShell
   的 `Get-Content`/`Set-Content` 默认编码处理含中文的文件（GBK 读入再按 UTF-8
   写回会造成双重编码乱码——2026-08-14 已因此返工重写全部 HTML）。改文件请用
   编辑器或 Node 脚本；必须用 PowerShell 时显式 `-Encoding UTF8` 且先确认输入
   编码。改完可跑 `node scripts/verify.mjs` 自查。

## 目录结构

```
carbonnet/
├── index.html  taxonomy.html  graph.html  library.html
├── stats.html  paper.html  ai.html  about.html
├── css/         tokens.css（令牌） main.css（全局） pages.css（页面）
├── js/          common.js（共享） index/taxonomy/graph/library/stats/paper/ai.js
│   └── vendor/  echarts.min.js（本地 vendored，Apache-2.0）
├── fonts/       Space Grotesk、DM Mono（woff2，OFL 许可）
├── data/        works.json 等（由 fetch-data.mjs 生成）
├── scripts/     fetch-data.mjs、verify.mjs
└── .github/workflows/update-data.yml（每周抓取 + Pages 部署）
```

## 许可证

- 代码与站点：MIT
- ECharts：Apache-2.0
- Space Grotesk / DM Mono：SIL OFL 1.1
- 文献元数据：CC0（OpenAlex）
