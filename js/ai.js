/* ============================================================
   CarbonNet — AI 文献助手 (ai.js) · BYOK（铁律 5）
   密钥只存浏览器 localStorage；浏览器直连 api.siliconflow.cn；
   密钥绝不进代码仓库、不引第三方脚本。
   铁律提醒：改动后 ai.html 中 ?v=N 必须 +1。
   ============================================================ */
(function () {
  'use strict';
  const C = window.CarbonNet;
  const { el } = C;

  const SYSTEM_PROMPT = '你是 CarbonNet 碳网图谱的文献助手，专注「碳材料超级电容器三维导电网络」领域（石墨烯、碳纳米管、多孔碳、MOF 衍生碳、气凝胶等材料；模板法、自组装、3D 打印、CVD、掺杂等策略；能量密度、比电容、循环稳定性等性能）。回答请使用简体中文，简洁、准确、学术化；涉及具体数据时注明来源文献。';

  function addMsg(role, text) {
    const box = document.getElementById('aiMessages');
    const node = el('div', { class: `ai-msg ${role}`, text });
    box.append(node);
    box.scrollTop = box.scrollHeight;
    return node;
  }
  const addUser = (t) => addMsg('user', t);
  const addAssistant = (t) => addMsg('assistant', t);
  const addError = (t) => addMsg('assistant error', t);

  let history = [{ role: 'system', content: SYSTEM_PROMPT }];

  function keyStateLine() {
    const ks = document.getElementById('keyState');
    ks.textContent = C.getApiKey() ? '● 已设置 API Key（仅本浏览器）' : '○ 未设置 API Key';
  }

  async function send(text) {
    const input = document.getElementById('aiInput');
    const btn = document.getElementById('btnSend');
    if (!text.trim()) return;
    if (!C.getApiKey()) {
      addError('请先在左侧设置硅基流动 API Key（BYOK：密钥仅保存在本浏览器 localStorage）。');
      return;
    }
    input.value = '';
    addUser(text);
    history.push({ role: 'user', content: text });
    btn.disabled = true;
    const thinking = addAssistant('思考中…');
    try {
      const reply = await C.aiChat(history, { temperature: 0.6, maxTokens: 2048 });
      thinking.textContent = reply;
      history.push({ role: 'assistant', content: reply });
    } catch (e) {
      thinking.remove();
      addError(`请求失败：${e.message}`);
    } finally {
      btn.disabled = false;
      input.focus();
    }
  }

  function initPrompts() {
    const box = document.getElementById('aiPrompts');
    const prompts = [
      { label: '什么是三维导电网络？', text: '在碳材料超级电容器中，什么是三维导电网络？它为什么重要？' },
      { label: '石墨烯 vs 碳纳米管', text: '比较石墨烯与碳纳米管在超级电容器三维电极中的优势与局限。' },
      { label: '提升能量密度的策略', text: '提高碳基超级电容器能量密度的主要构筑策略有哪些？各举代表工作。' },
      { label: '比电容与能量密度', text: '解释比电容（F/g）与能量密度（Wh/kg）的关系，以及电压窗口的影响。' },
      { label: 'MOF 衍生碳', text: 'MOF 衍生碳用于超级电容器电极有什么特点？常用的 MOF 前驱体有哪些？' },
    ];
    for (const p of prompts) {
      box.append(el('button', { class: 'btn btn-soft btn-sm ai-prompt', text: p.label, onclick: () => send(p.text) }));
    }
  }

  function main() {
    C.initEntrance();
    keyStateLine();
    initPrompts();
    /* 模型下拉 */
    const sel = document.getElementById('aiModel');
    for (const m of C.AI_MODELS) sel.append(el('option', { value: m.id, text: m.name }));
    sel.value = C.getAiModel();
    sel.addEventListener('change', () => C.setAiModel(sel.value));
    /* Key 输入 */
    const keyInput = document.getElementById('aiKey');
    if (C.getApiKey()) keyInput.placeholder = '已保存（输入新值可覆盖）';
    document.getElementById('btnSaveKey').addEventListener('click', () => {
      const v = keyInput.value.trim();
      if (!v) { C.toast('请输入 API Key', 'err'); return; }
      C.setApiKey(v);
      keyInput.value = '';
      keyInput.placeholder = '已保存（输入新值可覆盖）';
      keyStateLine();
      C.toast('API Key 已保存到本浏览器 localStorage', 'ok');
    });
    document.getElementById('btnClearKey').addEventListener('click', () => {
      C.setApiKey('');
      keyStateLine();
      C.toast('API Key 已清除', 'ok');
    });
    /* 发送 */
    const input = document.getElementById('aiInput');
    document.getElementById('btnSend').addEventListener('click', () => send(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); }
    });
    addAssistant('你好，我是 CarbonNet 文献助手（BYOK）。设置好硅基流动 API Key 后即可提问。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();
})();
