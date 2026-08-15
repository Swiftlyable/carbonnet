# CarbonNet 碳网图谱

**碳材料超级电容器三维导电网络 · 文献知识站**

静态站，无构建步骤，直接部署 GitHub Pages。原生 HTML/CSS/JS + 本地 vendored ECharts +
本地打包字体（Space Grotesk / DM Mono），**运行时零第三方请求**。

- 首页：粒子画布 Hero + 大字标语带 + KPI + 最新文献 + 热门标签云 + 精选经典
- 知识脉络 `taxonomy.html`：体系树图，点节点弹右侧详情面板（× / 点空白 / Esc 关闭）
- 知识关系图 `graph.html`：材料 × 策略 × 文献 三层力导向网络
- 文献库 `library.html`：搜索 / 多维筛选 / CSV 导出 / 分页 / 行错峰入场
- 数据面板 `dashboard.html`：年度趋势 / 期刊 / 热力图 / 被引分布 / 散点 / Treemap
- 论文详情 `paper.html`：`?id=` / `?doi=` 定位，完整元信息 + 中英摘要 + 相似文献
- 关于 `about.html`：理念 / 数据管线 / BYOK 隐私 / 工程铁律
- AI 助手（全站）：BYOK，密钥仅存 localStorage，浏览器直连 `api.siliconflow.cn`

## 目录

```
index.html taxonomy.html graph.html library.html dashboard.html paper.html about.html
assets/
  css/    tokens.css（设计令牌，改这里=全站换肤）+ 各页样式
  js/     data.js（查询 API）、core.js（主题/chartTheme/动效退役）、ai.js（BYOK）、各页脚本
  vendor/echarts/echarts.min.js   # 本地 vendored，不引 CDN
  fonts/  # Space Grotesk + DM Mono woff2，本地打包
data/     papers.js / papers.json（OpenAlex 数据）、taxonomy.js（人工本体树）
scripts/  fetch-openalex.js（数据管线，Node 18+，零依赖）
.github/workflows/update-data.yml   # 每周一自动抓取 → rebase → push
```

## 工程铁律（务必遵守）

1. **缓存版本号**：每次改动任何 CSS/JS，把所有页面引用里的 `?v=N` **统一加 1**。
2. **动画退役**：入场动画 `animationend` 后置 `animation:none !important`（core.js 的
   `bindAnim/animStagger`）；**绝不在 `:hover` 上移除/重放动画**，悬停只用 transition。
3. **力导向手势**（graph.js）：pointerdown/up/move 期间绝不 `setOption`（物理冻结、
   操作排队、抬起后冲刷）；点击导航 = click 事件（位移<6px 校验）+ pointerup 位移<6px
   兜底命中，拖拽(>6px)不导航。
4. **防 XSS**：文献数据渲染一律 `textContent`/`createElement`，禁止拼接 `innerHTML`。
5. **AI BYOK**：密钥只存浏览器 localStorage，直连硅基流动，密钥绝不进仓库，不引第三方脚本。
6. **零第三方请求**：ECharts 与字体本地打包，运行时只访问本站文件；站点 CSP
   `script-src 'self'`（无内联脚本），仅 AI 助手按用户操作放行 `api.siliconflow.cn`。
7. **提交纪律**：push 前先 `git fetch` + `rebase origin/main`。
8. **UTF-8 编码纪律**：所有文件一律 UTF-8 无 BOM；编辑/校验禁用 GBK 默认编码工具
   （如 PowerShell 5.1 的 `Get-Content` 会误读中文），提交前自查无乱码。

## 数据管线

```bash
node scripts/fetch-openalex.js        # 抓 OpenAlex → 主题门控去重 → data/papers.{js,json}
```

- 多路 `title_and_abstract.search` 检索合并，按 OpenAlex ID 去重；
- 主题门控（必须含超电容核心词 + 三维/网络/碳结构词，剔除传感/屏蔽等邻近噪声）；
- 合并 10 篇人工遴选经典文献（`scripts/fetch-openalex.js` 的 `CLASSICS`，含中文解读）；
- GitHub Actions 每周一 03:00 UTC 自动运行，有变更则 `git fetch origin main && git rebase
  origin/main && git push origin HEAD:main`。

## 本地预览

```bash
npx serve .        # 或 python -m http.server 8080
# 打开 http://localhost:3000/index.html
```

无需任何构建步骤。

## 部署到 GitHub Pages

仓库已内置「Update Data & Deploy」工作流（SHA 钉版 actions）：
抓取数据 → 提交 → 打包 `_site` → `actions/deploy-pages` 自动发布。

1. 一次性开启：Settings → Pages → Build and deployment → Source 选 **GitHub Actions**；
2. 手动触发一次 Actions → Update Data & Deploy → Run workflow，或等每周一 02:00 UTC 自动运行；
3. 站点地址：`https://<用户名>.github.io/<仓库名>/`。

> 注意：站点带严格 CSP（`script-src 'self'`），请用本地服务器预览
> （`npx serve .` / `python -m http.server`）；直接双击 `file://` 打开会被 CSP 拦截脚本。

GitHub Pages 对静态资源默认 `Cache-Control: max-age=600`，数据更新 10 分钟内可见；
站内 CSS/JS 的缓存控制靠铁律 1 的 `?v=N`。

## 许可

- 站点代码：MIT（见 LICENSE）
- 文献数据：来自 [OpenAlex](https://openalex.org)（CC0）；经典文献中文解读为编辑整理内容
- 字体：Space Grotesk / DM Mono（SIL Open Font License，见 assets/fonts/OFL.txt）
- ECharts：Apache-2.0（见 assets/vendor/echarts/LICENSE）
