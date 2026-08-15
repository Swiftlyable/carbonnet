/* ==========================================================================
   CarbonNet · ai.js —— AI 文献助手（BYOK）
   铁律 5：
   - API 密钥只保存在浏览器 localStorage（cn.ai.key），绝不出现在代码/仓库中；
   - 浏览器直连硅基流动 https://api.siliconflow.cn/v1/chat/completions；
   - 不引入任何第三方脚本；回答以纯文本渲染（textContent，防注入）。
   ========================================================================== */
(function () {
  'use strict';

  var API = 'https://api.siliconflow.cn/v1/chat/completions';
  var KEY_LS = 'cn.ai.key';
  var MODEL_LS = 'cn.ai.model';
  var DEFAULT_MODEL = 'deepseek-ai/DeepSeek-V3';
  var MODEL_PRESETS = [
    'deepseek-ai/DeepSeek-V3',
    'deepseek-ai/DeepSeek-R1',
    'Qwen/Qwen2.5-72B-Instruct',
    'Qwen/Qwen2.5-7B-Instruct',
    'THUDM/glm-4-9b-chat',
  ];

  var SYSTEM = '你是 CarbonNet「碳网图谱」的文献研究助手，服务于「碳材料超级电容器三维导电网络」主题。' +
    '要求：用中文回答，严谨、简洁、分点；引用数据时注明出处（论文/DOI）；不确定时明确说“不确定”，不要编造。' +
    '回答只输出纯文本，不使用 Markdown 代码块外的格式符号（可以用编号列表）。';

  var panel = null, msgsEl = null, inputEl = null, dotEl = null, ctxBanner = null;
  var ctx = null;          /* 当前论文上下文（由 paper.js 注入） */
  var busy = false;
  var aborter = null;
  var history = [];        /* 会话内对话记录 */

  var $ = function (s) { return panel ? panel.querySelector(s) : null; };

  function getKey() { try { return localStorage.getItem(KEY_LS) || ''; } catch (e) { return ''; } }
  function setKey(k) { try { k ? localStorage.setItem(KEY_LS, k) : localStorage.removeItem(KEY_LS); } catch (e) { /* ignore */ } }
  function getModel() { try { return localStorage.getItem(MODEL_LS) || DEFAULT_MODEL; } catch (e) { return DEFAULT_MODEL; } }
  function setModel(m) { try { localStorage.setItem(MODEL_LS, m || DEFAULT_MODEL); } catch (e) { /* ignore */ } }

  /* ---------- 面板构建（静态骨架用 DOM API，无用户数据拼 HTML） ---------- */
  function build() {
    if (panel) return;
    panel = document.createElement('aside');
    panel.className = 'ai-panel';
    panel.setAttribute('aria-label', 'AI 文献助手');

    var head = document.createElement('div');
    head.className = 'ai-head';
    dotEl = document.createElement('span');
    dotEl.className = 'ai-dot';
    dotEl.title = '未配置密钥';
    var t1 = document.createElement('div');
    var title = document.createElement('div');
    title.className = 'ai-title';
    title.textContent = 'AI 文献助手';
    var sub = document.createElement('div');
    sub.className = 'ai-sub';
    sub.textContent = 'BYOK · SILICONFLOW DIRECT';
    t1.appendChild(title); t1.appendChild(sub);
    var close = document.createElement('button');
    close.className = 'icon-btn ai-close';
    close.setAttribute('aria-label', '关闭助手');
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    close.addEventListener('click', closePanel);
    head.appendChild(dotEl); head.appendChild(t1); head.appendChild(close);
    panel.appendChild(head);

    /* 设置区（密钥/模型） */
    var settings = document.createElement('details');
    settings.className = 'ai-settings';
    var sum = document.createElement('summary');
    sum.textContent = '密钥与模型设置';
    settings.appendChild(sum);
    var row1 = document.createElement('div');
    row1.className = 'ai-set-row';
    var keyInput = document.createElement('input');
    keyInput.className = 'input';
    keyInput.type = 'password';
    keyInput.placeholder = 'sk-... SiliconFlow API Key';
    keyInput.value = getKey();
    keyInput.autocomplete = 'off';
    var saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-sm btn-primary';
    saveBtn.textContent = '保存';
    saveBtn.addEventListener('click', function () {
      setKey(keyInput.value.trim());
      updateDot();
      window.CN.util.toast(keyInput.value.trim() ? '密钥已仅保存在本机浏览器' : '已清除密钥');
    });
    row1.appendChild(keyInput); row1.appendChild(saveBtn);
    var row2 = document.createElement('div');
    row2.className = 'ai-set-row';
    var modelInput = document.createElement('input');
    modelInput.className = 'input';
    modelInput.list = 'cn-model-list';
    modelInput.placeholder = '模型 ID';
    modelInput.value = getModel();
    var dl = document.createElement('datalist');
    dl.id = 'cn-model-list';
    MODEL_PRESETS.forEach(function (m) {
      var o = document.createElement('option');
      o.value = m;
      dl.appendChild(o);
    });
    var modelBtn = document.createElement('button');
    modelBtn.className = 'btn btn-sm btn-ghost';
    modelBtn.textContent = '存';
    modelBtn.addEventListener('click', function () {
      setModel(modelInput.value.trim() || DEFAULT_MODEL);
      window.CN.util.toast('模型已保存：' + getModel());
    });
    row2.appendChild(modelInput); row2.appendChild(modelBtn);
    row2.appendChild(dl);
    var note = document.createElement('p');
    note.className = 'ai-note';
    note.textContent = '密钥仅存于本机浏览器 localStorage，浏览器直连 api.siliconflow.cn，不经任何中转，也不会进入代码仓库。';
    settings.appendChild(row1); settings.appendChild(row2); settings.appendChild(note);
    panel.appendChild(settings);

    /* 上下文横幅 */
    ctxBanner = document.createElement('div');
    ctxBanner.className = 'ai-ctx';
    ctxBanner.style.display = 'none';
    var ctxText = document.createElement('span');
    ctxBanner.appendChild(ctxText);
    var ctxClear = document.createElement('button');
    ctxClear.textContent = '×';
    ctxClear.setAttribute('aria-label', '移除上下文');
    ctxClear.addEventListener('click', function () { setContext(null); });
    ctxBanner.appendChild(ctxClear);
    panel.appendChild(ctxBanner);

    /* 消息区 */
    msgsEl = document.createElement('div');
    msgsEl.className = 'ai-msgs';
    panel.appendChild(msgsEl);

    /* 快捷问题 */
    var quick = document.createElement('div');
    quick.className = 'ai-quick';
    var QUICK = [
      { label: '解读本文', needCtx: true },
      { label: '三维导电网络是什么', q: '请用 3~5 句话解释：超级电容器电极中的“三维导电网络”指什么？它为什么重要？' },
      { label: '主流构建策略对比', q: '请对比碳材料三维导电网络的几种主流构建策略（模板法、CVD、自组装、冻干、3D打印）的优缺点，用编号列表。' },
      { label: '术语解释', q: '请解释电化学电容器的几个核心术语：EDLC、赝电容、比电容、倍率性能、库仑效率。' },
      { label: '研究空白', needCtx: true, blank: true },
    ];
    QUICK.forEach(function (qc) {
      var chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = qc.label;
      chip.addEventListener('click', function () {
        if (qc.needCtx && !ctx) { window.CN.util.toast('请先在论文详情页打开助手，附带上下文'); return; }
        var text = qc.q;
        if (qc.blank) text = '基于当前上下文论文，请指出该工作的局限，并提出 2~3 个值得继续研究的方向。';
        send(text, true);
      });
      quick.appendChild(chip);
    });
    panel.appendChild(quick);

    /* 输入区 */
    var inputRow = document.createElement('div');
    inputRow.className = 'ai-input-row';
    inputEl = document.createElement('textarea');
    inputEl.className = 'textarea';
    inputEl.rows = 1;
    inputEl.placeholder = '问点什么…（Enter 发送，Shift+Enter 换行）';
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(inputEl.value.trim()); }
      if (e.key === 'Escape') closePanel();
    });
    var sendBtn = document.createElement('button');
    sendBtn.className = 'btn btn-primary ai-send';
    sendBtn.textContent = '发送';
    sendBtn.addEventListener('click', function () { send(inputEl.value.trim()); });
    inputRow.appendChild(inputEl); inputRow.appendChild(sendBtn);
    panel.appendChild(inputRow);

    document.body.appendChild(panel);

    /* Esc 关闭 */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) closePanel();
    });

    addMsg('sys', 'BYOK 助手就绪。未配置密钥时先点击上方「密钥与模型设置」。');
    updateDot();
  }

  function updateDot() {
    if (!dotEl) return;
    dotEl.className = 'ai-dot' + (busy ? ' busy' : (getKey() ? ' ready' : ''));
    dotEl.title = busy ? '请求中' : (getKey() ? '密钥已配置' : '未配置密钥');
  }

  function addMsg(role, text, isStream) {
    var el = document.createElement('div');
    el.className = 'ai-msg ' + role;
    el.textContent = text;
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return el;
  }

  /* ---------- 上下文（论文详情页注入） ---------- */
  function setContext(c) {
    ctx = c;
    if (!panel) return;
    var t = $('.ai-ctx span');
    if (c) {
      t.textContent = '已附上下文：' + (c.title || '').slice(0, 60) + '（' + (c.year || '?') + '）';
      ctxBanner.style.display = 'flex';
    } else {
      ctxBanner.style.display = 'none';
    }
  }

  function buildMessages(userText) {
    var msgs = [{ role: 'system', content: SYSTEM }];
    if (ctx) {
      msgs.push({
        role: 'system',
        content: '【当前论文上下文】\n标题: ' + (ctx.title || '') +
          '\n作者: ' + ((ctx.authors || []).slice(0, 6).map(function (a) { return a.name; }).join(', ')) +
          '\n期刊: ' + (ctx.journal || '') + '\n年份: ' + (ctx.year || '') +
          '\nDOI: ' + (ctx.doi || '') + '\n被引: ' + (ctx.citations || 0) +
          '\n摘要: ' + (ctx.abstract || '（无）').slice(0, 2600),
      });
    }
    for (var i = 0; i < history.length; i++) msgs.push(history[i]);
    msgs.push({ role: 'user', content: userText });
    return msgs;
  }

  /* ---------- 发送（流式 SSE） ---------- */
  async function send(text, fromQuick) {
    if (!text || busy) return;
    var key = getKey();
    if (!key) {
      addMsg('sys', '尚未配置密钥：请展开上方「密钥与模型设置」，粘贴 SiliconFlow API Key。密钥只保存在本机浏览器。');
      return;
    }
    inputEl.value = '';
    busy = true;
    updateDot();
    addMsg('user', text);

    var msgs = buildMessages(text);
    history.push({ role: 'user', content: text });

    var bubble = addMsg('assistant', '');
    var acc = '';
    aborter = new AbortController();

    var payload = {
      model: getModel(),
      messages: msgs,
      stream: true,
      temperature: 0.4,
      max_tokens: 2048,
    };

    try {
      var res = await fetch(API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key,
        },
        body: JSON.stringify(payload),
        signal: aborter.signal,
      });

      if (!res.ok) {
        var errText = '';
        try { errText = (await res.text()).slice(0, 300); } catch (e) { /* ignore */ }
        throw new Error('HTTP ' + res.status + (errText ? ' · ' + errText : ''));
      }

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';
      while (true) {
        var r = await reader.read();
        if (r.done) break;
        buf += decoder.decode(r.value, { stream: true });
        var idx;
        while ((idx = buf.indexOf('\n')) >= 0) {
          var line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (line.indexOf('data:') !== 0) continue;
          var data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          var j = null;
          try { j = JSON.parse(data); } catch (e) { continue; }
          var delta = j && j.choices && j.choices[0] && j.choices[0].delta;
          var piece = delta && (delta.content || '');
          if (piece) { acc += piece; bubble.textContent = acc; msgsEl.scrollTop = msgsEl.scrollHeight; }
        }
      }
      if (!acc) bubble.textContent = '（空响应）';
      history.push({ role: 'assistant', content: acc || '（空响应）' });
    } catch (e) {
      if (e.name === 'AbortError') {
        bubble.textContent = acc || '（已停止）';
        if (acc) history.push({ role: 'assistant', content: acc });
      } else {
        bubble.className = 'ai-msg sys';
        bubble.textContent = '请求失败：' + (e && e.message ? e.message : e) +
          '。请检查网络、密钥额度与模型 ID（如 401 表示密钥无效，402 表示余额不足）。';
      }
    } finally {
      busy = false;
      aborter = null;
      updateDot();
    }
  }

  /* ---------- 开关 ---------- */
  function openPanel() {
    build();
    panel.classList.add('open');
    setContext(ctx);
    setTimeout(function () { if (inputEl) inputEl.focus(); }, 120);
  }
  function closePanel() {
    if (panel) panel.classList.remove('open');
  }

  window.CN.ai = { open: openPanel, close: closePanel, setContext: setContext, quick: function (q) { openPanel(); send(q); } };
})();
