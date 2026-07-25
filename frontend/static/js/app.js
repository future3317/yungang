import { getGame, sendAction } from './api.js';

const app = document.querySelector('#app');
let state;
const labels = {"yungang":"云冈石窟", "huayan_temple":"华严寺", "shanhua_temple":"善化寺", "wall_pass":"长城关隘", "trade_post":"互市驿站", "pingcheng_ruins":"平城遗址"};

function render() {
  const active = state.players[state.shared.active_player_id];
  const sites = Object.values(state.sites).map(site => `<article class="site ${site.id === active.location ? 'current' : ''} ${site.discovered ? 'found' : ''}"><strong>${labels[site.id] || site.id}</strong><span>${site.discovered ? '已发现' : '待探索'}</span><small>耐久 ${site.durability}/${site.max_durability} · 影响 ${site.influence}</small></article>`).join('');
  const actions = state.legal_actions.map(action => `<button data-action='${JSON.stringify(action)}'>${action.label}${action.cost ? ` · ${action.cost} AP` : ''}</button>`).join('');
  const log = state.shared.log.slice(-8).reverse().map(item => `<li>${item}</li>`).join('');
  app.innerHTML = `<header><p class="eyebrow">HERITAGE NETWORK / V2</p><h1>遗产节点网络</h1><p>沿文化线路移动、发现节点、修复遗产，并把影响力连接成一张网络。</p></header><main><section class="network"><div class="section-title"><h2>丝路节点</h2><span>第 ${state.shared.turn} 回合 · Revision ${state.revision}</span></div><div class="sites">${sites}</div></section><aside><div class="player"><p class="eyebrow">当前行动者</p><h2>${active.name}</h2><p>${labels[active.location] || active.location}</p><div class="stats"><b>${active.ap}<small>AP</small></b><b>${active.influence}<small>影响力</small></b><b>${state.shared.threat}<small>威胁</small></b></div></div><div class="actions"><h3>可执行动作</h3>${actions}</div><div class="journal"><h3>行旅记录</h3><ul>${log || '<li>旅程尚未开始。</li>'}</ul></div><details class="debug"><summary>调试状态</summary><pre>${JSON.stringify(state, null, 2)}</pre></details></aside></main>`;
  app.querySelectorAll('button').forEach(button => button.addEventListener('click', async () => { const action = JSON.parse(button.dataset.action); try { state = await sendAction({...action, player_id: active.id, expected_revision: state.revision}); render(); } catch (error) { if (error.payload?.detail?.current_state) { state = error.payload.detail.current_state; render(); } else alert(error.message); } }));
}

getGame().then(value => { state = value; render(); }).catch(error => { app.innerHTML = `<p class="error">${error.message}</p>`; });
