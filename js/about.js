/* ============================================================
   CarbonNet — 关于页 (about.js)
   铁律提醒：改动后 about.html 中 ?v=N 必须 +1。
   ============================================================ */
(function () {
  'use strict';
  const C = window.CarbonNet;
  async function main() {
    C.initEntrance();
    try {
      const meta = await C.fetchData('meta');
      const n = document.getElementById('aboutMeta');
      if (n) n.textContent = `当前数据集：${meta.works} 篇文献 · 生成于 ${meta.generated_at.slice(0, 10)} · 数据许可 ${meta.license}。`;
    } catch { /* 元信息缺失时不阻塞页面 */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();
})();
