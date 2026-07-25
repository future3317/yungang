import { getGame, sendAction } from './api.js';

const app = document.querySelector('#app');
const U = {
  title: '\u9057\u4ea7\u7f51\u7edc', journey: '\u5171\u540c\u65c5\u7a0b', network: '\u9057\u4ea7\u8282\u70b9\u7f51\u7edc',
  route: '\u5927\u540c\u6587\u5316\u7ebf\u8def', active: '\u5f53\u524d\u884c\u52a8\u8005', actions: '\u884c\u52a8\u624b\u518c',
  cards: '\u6211\u7684\u6587\u5316\u724c', log: '\u6cbf\u9014\u53d1\u751f', clear: '\u6e05\u9664\u805a\u7126',
  influence: '\u5171\u540c\u5f71\u54cd\u529b', threat: '\u5a01\u80c1', ap: '\u884c\u52a8\u70b9 AP',
  repair: '\u8010\u4e45', found: '\u5df2\u53d1\u73b0', closed: '\u5df2\u5173\u95ed', undiscovered: '\u672a\u63a2\u7d22',
  damage: '\u635f\u4f24', use: '\u7acb\u5373\u4f7f\u7528', status: '\u72b6\u6001', loading: '\u6b63\u5728\u8bb0\u5f55...'
};
const names = {
  yungang: '\u4e91\u5188\u77f3\u7a9f', huayan_temple: '\u534e\u4e25\u5bfa', shanhua_temple: '\u5584\u5316\u5bfa',
  wall_pass: '\u957f\u57ce\u5173\u9698', trade_post: '\u4e92\u5e02\u9a7f\u7ad9', pingcheng_ruins: '\u5e73\u57ce\u9057\u5740'
};
const roles = { craftsman: '\u5e73\u57ce\u5de5\u5320', dancer: '\u897f\u57df\u4e50\u821e\u4f7f\u8005', rider: '\u8349\u539f\u9a91\u884c\u4f7f\u8005', scribe: '\u4e2d\u539f\u6587\u4e66\u8bb0\u5b98' };
const cards = { survey: '\u884c\u65c5\u624b\u8bb0', craft: '\u5320\u4eba\u624b\u7a3f', alliance: '\u4e92\u5e02\u76df\u7ea6', archive: '\u77f3\u7a9f\u6863\u6848' };
const badges = { yungang: 'icon_node_yungang.png', huayan_temple: 'icon_node_huayan_temple.png', shanhua_temple: 'icon_node_shanhua_temple.png', wall_pass: 'icon_node_wall_pass.png', trade_post: 'icon_node_trade_post.png', pingcheng_ruins: 'icon_node_pingcheng_ruins.png' };
const actionIcons = { move: 'icon_action_explore.png', explore: 'icon_action_explore.png', restore: 'icon_action_restore.png', contribute: 'icon_action_contribute.png', play_card: 'icon_card_scroll.png', end_turn: 'icon_event_night.png', use_skill: 'icon_role_craftsman.png', exchange: 'icon_resource_influence.png', resolve_event: 'icon_event_sandstorm.png', select_market_card: 'icon_card_scroll.png', discard: 'icon_event_threat.png' };
const positions = { yungang: [50, 50], huayan_temple: [18, 28], shanhua_temple: [82, 28], wall_pass: [28, 79], trade_post: [72, 79], pingcheng_ruins: [50, 88] };
let state = null;
let selectedSite = null;
let busy = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const siteName = id => names[id] || id;

function lines() {
  const edges = [['yungang', 'huayan_temple'], ['yungang', 'shanhua_temple'], ['yungang', 'wall_pass'], ['yungang', 'trade_post'], ['yungang', 'pingcheng_ruins'], ['huayan_temple', 'trade_post'], ['shanhua_temple', 'wall_pass']];
  return edges.map(([a, b]) => { const [x1, y1] = positions[a]; const [x2, y2] = positions[b]; const active = selectedSite === a || selectedSite === b ? ' active' : ''; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="route-line${active}"/>`; }).join('');
}

function renderSites(active) {
  return Object.values(state.sites).map(site => {
    const [x, y] = positions[site.id] || [50, 50];
    const status = site.status === 'closed' ? U.closed : site.discovered ? U.found : U.undiscovered;
    return `<button class="map-node ${site.id === active.location ? 'current' : ''} ${site.discovered ? 'discovered' : ''} ${site.status === 'closed' ? 'closed' : ''} ${selectedSite === site.id ? 'focused' : ''}" style="left:${x}%;top:${y}%" data-site="${site.id}" aria-label="${esc(siteName(site.id))}"><span class="node-orbit"></span><img src="/static/ui-assets/generated/${badges[site.id]}" alt="" class="node-badge"><strong>${esc(siteName(site.id))}</strong><small>${status} · ${U.damage} ${site.damage}/${site.max_damage}</small></button>`;
  }).join('');
}

function renderAction(action, index) {
  const kind = action.type === 'end_turn' ? 'end' : action.type === 'play_card' ? 'card' : action.type;
  const icon = actionIcons[action.type] || 'icon_card_scroll.png';
  const detail = action.cost ? `${action.cost} AP` : action.type === 'end_turn' ? '\u63a8\u8fdb\u65c5\u7a0b\u5e76\u89e6\u53d1\u4e8b\u4ef6' : '\u53ef\u6267\u884c\u884c\u52a8';
  return `<button class="action action-${kind}" data-action-index="${index}"><span class="action-glyph"><img src="/static/ui-assets/generated/${icon}" alt=""></span><span><b>${esc(action.label)}</b><small>${detail}</small></span><i>›</i></button>`;
}

function render() {
  const active = state.players[state.shared.active_player_id];
  if (!active) { app.innerHTML = '<div class="fatal">\u65e0\u6cd5\u627e\u5230\u5f53\u524d\u73a9\u5bb6</div>'; return; }
  const hand = active.hand.length ? active.hand.map(card => `<button class="hand-card" data-card="${esc(card)}"><span class="card-mark">✦</span><b>${esc(cards[card] || card)}</b><small>\u70b9\u51fb\u67e5\u770b\u5e76\u4f7f\u7528</small></button>`).join('') : `<div class="empty-card">\u63a2\u7d22\u9057\u4ea7\u8282\u70b9\u540e\uff0c\u6587\u5316\u724c\u4f1a\u8fdb\u5165\u8fd9\u91cc\u3002</div>`;
  const logs = state.shared.log.slice(-7).reverse().map(item => `<li><span></span>${esc(item)}</li>`).join('') || '<li><span></span>\u65c5\u7a0b\u5c1a\u672a\u5f00\u59cb\u3002</li>';
  app.innerHTML = `<div class="shell"><header class="topbar"><div class="brand"><img src="/static/ui-assets/04_yungang_seal_stamp.webp" alt=""><div><p>HERITAGE NETWORK / V2</p><h1>${U.title}</h1></div></div><div class="journey-meta"><span>\u7b2c ${state.shared.turn} \u56de\u5408</span><span>REV ${state.revision}</span><span class="online-dot">\u89c4\u5219\u6e90\u5728\u7ebf</span></div></header><section class="hero-strip"><div><span class="kicker">${U.journey}</span><h2>\u8ba9\u9057\u4ea7\u91cd\u65b0\u8fde\u6210\u4e00\u6761\u8def</h2><p>\u63a2\u7d22\u8282\u70b9\uff0c\u4ea4\u6362\u77e5\u8bc6\uff0c\u5728\u6709\u9650\u884c\u52a8\u4e2d\u5efa\u7acb\u6587\u5316\u5f71\u54cd\u529b\u3002</p></div><div class="meter"><div class="meter-label"><span>${U.influence}</span><b>${state.shared.influence} / 10</b></div><div class="meter-track"><i style="width:${Math.min(100, state.shared.influence * 10)}%"></i></div><small>\u6bcf\u4e00\u6b21\u8d21\u732e\u90fd\u4f1a\u6539\u53d8\u6574\u5f20\u7f51\u7edc</small></div></section><main class="game-layout"><section class="map-panel"><div class="panel-heading"><div><span class="kicker">${U.network}</span><h2>${U.route}</h2></div><button class="quiet-button" id="clear-focus">${U.clear}</button></div><div class="network-map"><div class="map-texture"></div><svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines()}</svg><img class="buddha" src="/static/ui-assets/01_buddha_relief_medallion.webp" alt="\u4e91\u5188\u77f3\u7a9f\u6d6e\u96d5"><div class="map-caption"><span>${U.active}</span><b>${esc(active.name)}</b><small>${esc(siteName(active.location))}</small></div>${renderSites(active)}</div><div class="map-legend"><span><i class="legend-dot current-dot"></i>\u5f53\u524d\u4f4d\u7f6e</span><span><i class="legend-dot found-dot"></i>${U.found}</span><span><i class="legend-dot route-dot"></i>\u6587\u5316\u7ebf\u8def</span></div></section><aside class="control-column"><section class="player-card"><div class="player-card-head"><span class="kicker">${U.active}</span><span class="turn-pill">${esc(roles[active.role_id] || active.role_id)}</span></div><h2>${esc(active.name)}</h2><p class="location-line"><span>⌖</span>${esc(siteName(active.location))}</p><div class="resource-row"><div><b>${active.ap}</b><small>${U.ap}</small></div><div><b>${active.influence}</b><small>\u4e2a\u4eba\u5f71\u54cd</small></div><div><b>${active.durability}</b><small>${U.repair}</small></div></div></section><section class="action-panel"><div class="panel-heading compact"><h3>${U.actions}</h3><span>${state.legal_actions.length} \u9879\u53ef\u7528</span></div><div class="action-list">${state.legal_actions.map(renderAction).join('')}</div></section><section class="event-panel"><div class="panel-heading compact"><h3>\u73af\u5883\u538b\u529b</h3><span>${U.threat} ${state.shared.threat}</span></div><div class="threat-track"><i style="width:${Math.min(100, state.shared.threat * 10)}%"></i></div><p>\u516c\u5171\u4e8b\u4ef6\u5728\u6bcf\u56de\u5408\u7ed3\u675f\u65f6\u53d1\u751f\u3002</p></section></aside></main><section class="lower-grid"><section class="cards-panel"><div class="panel-heading compact"><div><span class="kicker">\u77e5\u8bc6\u4e0e\u5de5\u5177</span><h3>${U.cards}</h3></div><span>\u6700\u591a 3 \u5f20</span></div><div class="hand-row">${hand}</div></section><section class="log-panel"><div class="panel-heading compact"><div><span class="kicker">\u65c5\u7a0b\u8bb0\u5f55</span><h3>${U.log}</h3></div><button class="quiet-button" id="toggle-debug">${U.status}</button></div><ul class="log-list">${logs}</ul><details class="debug" id="debug"><summary>\u67e5\u770b\u5b8c\u6574\u72b6\u6001 JSON</summary><pre>${esc(JSON.stringify(state, null, 2))}</pre></details></section></section></div><div id="toast" class="toast" role="status"></div><div id="modal-root"></div>`;
  bindEvents(active);
}

function toast(message, tone = 'normal') { const el = document.querySelector('#toast'); if (!el) return; el.textContent = message; el.className = `toast show ${tone}`; clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.className = 'toast'; }, 2600); }
function bindEvents(active) {
  document.querySelectorAll('.map-node').forEach(node => node.addEventListener('click', () => { selectedSite = node.dataset.site; render(); toast(`${siteName(selectedSite)} \u5df2\u805a\u7126`); }));
  document.querySelector('#clear-focus')?.addEventListener('click', () => { selectedSite = null; render(); toast('\u5df2\u6e05\u9664\u8282\u70b9\u805a\u7126'); });
  document.querySelector('#toggle-debug')?.addEventListener('click', () => { const debug = document.querySelector('#debug'); if (debug) debug.open = !debug.open; });
  document.querySelectorAll('[data-card]').forEach(card => card.addEventListener('click', () => openCard(card.dataset.card, active)));
  document.querySelectorAll('[data-action-index]').forEach(button => button.addEventListener('click', () => runAction(Number(button.dataset.actionIndex), button, active)));
}
function openCard(card, active) {
  const text = { survey: '\u63a2\u7d22\u540e\u83b7\u5f97 1 AP \u5e76\u62bd\u53d6\u6587\u5316\u724c', craft: '\u4e0b\u4e00\u6b21\u8d21\u732e\u989d\u5916\u83b7\u5f97\u5f71\u54cd\u529b', alliance: '\u672c\u56de\u5408\u79fb\u52a8\u83b7\u5f97\u7075\u6d3b\u6027', archive: '\u6062\u590d 1 \u70b9\u8010\u4e45\u5e76\u83b7\u5f97\u5f71\u54cd\u529b' }[card] || '\u4e00\u5f20\u6765\u81ea\u65c5\u9014\u7684\u6587\u5316\u8bb0\u5f55';
  document.querySelector('#modal-root').innerHTML = `<div class="modal-backdrop"><section class="card-modal"><button class="modal-close">×</button><span class="kicker">CULTURE CARD</span><div class="big-card-mark">✦</div><h2>${esc(cards[card] || card)}</h2><p>${text}</p><button class="modal-use" data-use-card="${esc(card)}">${U.use}</button></section></div>`;
  document.querySelector('.modal-backdrop').addEventListener('click', event => { if (event.target.classList.contains('modal-backdrop') || event.target.classList.contains('modal-close')) event.currentTarget.remove(); });
  document.querySelector('[data-use-card]')?.addEventListener('click', event => { event.currentTarget.closest('.modal-backdrop').remove(); const action = state.legal_actions.find(item => item.type === 'play_card' && item.card_id === card); if (action) runAction(state.legal_actions.indexOf(action), null, active); else toast('\u8fd9\u5f20\u724c\u5f53\u524d\u4e0d\u53ef\u4f7f\u7528', 'warning'); });
}
async function runAction(index, button, active) {
  if (busy) return; const action = state.legal_actions[index]; if (!action) return; busy = true; button?.classList.add('is-loading'); toast(`${action.label} · ${U.loading}`);
  try { state = await sendAction({ ...action, action: action.type, player_id: active.id, expected_revision: state.revision }); selectedSite = state.players[state.shared.active_player_id]?.location || null; render(); toast(`${action.label} · \u5df2\u5b8c\u6210`, 'success'); }
  catch (error) { if (error.payload?.detail?.current_state) { state = error.payload.detail.current_state; render(); toast('\u72b6\u6001\u5df2\u66f4\u65b0\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9\u884c\u52a8', 'warning'); } else toast(error.message, 'warning'); }
  finally { busy = false; }
}

getGame().then(value => { state = value; render(); }).catch(error => { app.innerHTML = `<div class="fatal">\u65e0\u6cd5\u8f7d\u5165\u65c5\u7a0b：${esc(error.message)}</div>`; });
