/* CarbonNet · about.js —— 数据快照展示（只读，无交互逻辑） */
(function () {
  'use strict';
  var U = window.CN.util;
  function boot() {
    var meta = window.CN.meta || {};
    var st = window.CN.stats();
    var f = document.getElementById('about-fetched');
    var t = document.getElementById('about-total');
    if (f) f.textContent = U.fmtDate(meta.fetchedAt);
    if (t) t.textContent = String(st.total);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
