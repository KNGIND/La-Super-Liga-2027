/* Neon Striker · neon-striker.js
   Interfaz completa: menú estilo Stumble Guys, Play, Training, Shop, Game Pass y pantalla de partido.
   Vanilla JS (sin React ni Framer Motion). Se monta sola y se abre desde #btn-neon o [data-open-neon].
   Atributos propios data-nsg-* para no chocar con los listeners de app.js.
   Las etiquetas viven en STR: cambialas ahí para traducir la interfaz. */
(function (w) {
  'use strict';
  var NS = w.NS = w.NS || {};
  var doc = w.document;
  var D = NS.data, P = NS.profile;

  var STR = {
    play: 'PLAY', shop: 'Shop', training: 'Training', online: 'Online', soon: 'Coming Soon',
    gamePass: 'GAME PASS', passOwned: 'Pass activo', passDesc: 'Desbloqueá todos los skins premium para siempre.',
    passBuy: 'Comprar Game Pass', owned: 'Adquirido', needCoins: 'Not enough coins', needPass: 'Unlock with Game Pass',
    kickOff: 'Kick Off', fullTime: 'Full Time', playAgain: 'Play Again', menu: 'Menu', match: 'Match',
    you: 'You', cpu: 'CPU', goal: 'GOAL!', win: 'You win!', lose: 'CPU wins', draw: 'Draw',
    equipped: 'Equipped', equip: 'Equip', buy: 'Buy', premium: 'Game Pass', standard: 'Standard',
    tabPlayers: 'Players', tabBalls: 'Balls', chooseDiff: 'Elegí la dificultad del CPU',
    startMatch: 'Start Match', startTraining: 'Start Training', freePractice: 'Práctica libre · el CPU no se mueve',
    difficulty: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
    diffDesc: { easy: 'Lento y con poca puntería', medium: 'Equilibrio entre velocidad y salto', hard: 'Rápido, salta seguido y responde al instante' },
    hintKeys: '← → mover · ↑ / Espacio saltar', hintTouch: 'Usá los botones para moverte y saltar',
    coins: 'monedas', freeTime: 'Libre', back: 'Volver', quit: 'Salir', close: 'Cerrar'
  };

  var ICONS = {
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    shop: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
  };

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }
  function fmtClock(sec) {
    sec = Math.max(0, sec | 0);
    var r = sec % 60;
    return Math.floor(sec / 60) + ':' + (r < 10 ? '0' : '') + r;
  }
  function isTouch() {
    return ('ontouchstart' in w) || !!(w.matchMedia && w.matchMedia('(pointer: coarse)').matches);
  }
  function displayName() {
    var L = w.LSL, p = L && L.profile && L.profile.get ? L.profile.get() : null;
    return (p && p.name) || 'Jugador';
  }

  /* ---------- SVG (figura del personaje, pelota, íconos) ---------- */
  function characterSVG(color) {
    return '<svg class="nsg-fig" viewBox="0 0 160 220" aria-hidden="true">' +
      '<ellipse cx="80" cy="208" rx="44" ry="8" fill="rgba(0,0,0,.35)"/>' +
      '<rect x="58" y="150" width="16" height="42" rx="7" fill="#27272a"/>' +
      '<rect x="86" y="150" width="16" height="42" rx="7" fill="#27272a"/>' +
      '<rect x="52" y="186" width="27" height="15" rx="7" fill="#0f172a"/>' +
      '<rect x="81" y="186" width="27" height="15" rx="7" fill="#0f172a"/>' +
      '<rect x="54" y="110" width="52" height="52" rx="16" fill="' + color + '"/>' +
      '<circle cx="80" cy="72" r="54" fill="' + color + '"/>' +
      '<circle cx="61" cy="70" r="14" fill="#fff"/><circle cx="99" cy="70" r="14" fill="#fff"/>' +
      '<circle cx="65" cy="72" r="6.5" fill="#0b0b0c"/><circle cx="103" cy="72" r="6.5" fill="#0b0b0c"/>' +
      '</svg>';
  }
  function ballSVG(color, px) {
    return '<svg class="nsg-ball" viewBox="0 0 40 40" style="width:' + px + 'px;height:' + px + 'px" aria-hidden="true">' +
      '<circle cx="20" cy="20" r="18" fill="' + color + '"/>' +
      '<path d="M20 11.5l6.4 4.6-2.4 7.5h-8l-2.4-7.5z" fill="rgba(11,11,12,.55)"/></svg>';
  }
  function icon(name) {
    return '<svg class="nsg-ic" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';
  }
  function coinIcon() {
    return '<svg class="nsg-coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#fbbf24"/>' +
      '<circle cx="12" cy="12" r="5.5" fill="none" stroke="#b45309" stroke-width="1.6"/></svg>';
  }

  /* ---------- estado y DOM ---------- */
  var root, view, toastEl, toastT = 0, match = null, built = false;
  var st = { open: false, screen: 'home', diff: 'medium', mode: 'match', tab: 'character' };
  var KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', Space: 'jump' };

  function init() {
    if (built) return;
    built = true;
    root = doc.createElement('div');
    root.id = 'nsg-root';
    root.hidden = true;
    root.innerHTML =
      '<div class="nsg-scene" aria-hidden="true">' +
        '<i class="nsg-moon"></i><i class="nsg-cloud c1"></i><i class="nsg-cloud c2"></i><i class="nsg-cloud c3"></i>' +
        '<div class="nsg-floor"><i></i><i></i><i></i></div>' +
      '</div>' +
      '<div class="nsg-view" id="nsg-view"></div>' +
      '<div class="nsg-toast" id="nsg-toast" role="status" aria-live="polite"></div>';
    doc.body.appendChild(root);
    view = root.querySelector('#nsg-view');
    toastEl = root.querySelector('#nsg-toast');

    root.addEventListener('click', onClick);
    ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) {
      root.addEventListener(ev, onPointer);
    });
    doc.addEventListener('keydown', onKey);
    doc.addEventListener('keyup', onKey);
    doc.addEventListener('click', onEntry);
    if (P && P.subscribe) P.subscribe(onProfile);
  }

  /* Botón de entrada: #btn-neon (o cualquier [data-open-neon]) */
  function onEntry(e) {
    var t = e.target.closest && e.target.closest('#btn-neon, [data-open-neon]');
    if (t) { e.preventDefault(); open(); }
  }

  function onProfile() {
    if (!st.open) return;
    if (st.screen === 'home') renderHome();
    else if (st.screen === 'shop') renderShop();
    else if (st.screen === 'gamepass') renderGamePass();
  }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 1900);
  }

  /* ---------- navegación ---------- */
  function go(screen) {
    if (screen !== 'match') stopMatch();
    st.screen = screen;
    root.classList.toggle('nsg-home', screen === 'home');
    var R = { home: renderHome, play: renderPlay, training: renderTraining, shop: renderShop, gamepass: renderGamePass };
    if (R[screen]) R[screen]();
  }

  function pageHead(title) {
    return '<header class="nsg-ph"><button class="nsg-ib" data-nsg-go="home" aria-label="' + STR.back + '">' +
      icon('back') + '</button><h1>' + esc(title) + '</h1><span class="nsg-ph-sp"></span></header>';
  }

  /* ---------- menú principal (estilo Stumble Guys) ---------- */
  function renderHome() {
    var pr = P.get(), ch = P.equipped('character'), ba = P.equipped('ball');
    var pct = pr.gamePass ? 100 : Math.min(100, Math.round(pr.coins / D.GAME_PASS_PRICE * 100));
    view.innerHTML =
      '<header class="nsg-top">' +
        '<div class="nsg-profile">' +
          '<span class="nsg-av">' + characterSVG(ch.color) + '</span>' +
          '<span class="nsg-pn"><b>' + esc(displayName()) + '</b>' +
          '<small>' + ballSVG(ba.color, 14) + '<span>' + esc(ba.name) + '</span></small></span>' +
        '</div>' +
        '<div class="nsg-tr">' +
          (pr.gamePass ? '<span class="nsg-pass">PASS</span>' : '') +
          '<span class="nsg-coins">' + coinIcon() + '<b>' + pr.coins + '</b></span>' +
          '<button class="nsg-ib" data-nsg-act="close" aria-label="' + STR.close + '">' + icon('close') + '</button>' +
        '</div>' +
      '</header>' +
      '<main class="nsg-stage"><div class="nsg-char">' + characterSVG(ch.color) + '</div></main>' +
      '<footer class="nsg-dock">' +
        '<button class="nsg-gp" data-nsg-go="gamepass">' +
          '<span class="nsg-gp-t"><b>' + STR.gamePass + '</b>' +
          '<small>' + (pr.gamePass ? STR.passOwned : pr.coins + ' / ' + D.GAME_PASS_PRICE) + '</small></span>' +
          '<span class="nsg-bar"><i style="width:' + pct + '%"></i></span>' +
        '</button>' +
        '<div class="nsg-row">' +
          '<button class="nsg-db" data-nsg-go="shop">' + icon('shop') + '<span>' + STR.shop + '</span></button>' +
          '<button class="nsg-db" data-nsg-go="training">' + icon('target') + '<span>' + STR.training + '</span></button>' +
          '<button class="nsg-db is-dis" disabled>' + icon('lock') + '<span>' + STR.online + '</span><small>' + STR.soon + '</small></button>' +
        '</div>' +
        '<button class="nsg-play" data-nsg-go="play">' + STR.play + '</button>' +
      '</footer>';
  }

  /* ---------- Play: elegir dificultad ---------- */
  function renderPlay() {
    var levels = ['easy', 'medium', 'hard'];
    view.innerHTML = pageHead(STR.play) +
      '<p class="nsg-sub">' + STR.chooseDiff + '</p>' +
      '<div class="nsg-diffs">' + levels.map(function (k) {
        return '<button class="nsg-diff' + (st.diff === k ? ' on' : '') + '" data-nsg-diff="' + k + '">' +
          '<b>' + STR.difficulty[k] + '</b><small>' + STR.diffDesc[k] + '</small></button>';
      }).join('') + '</div>' +
      '<button class="nsg-btn primary xl" data-nsg-act="start-match">' + STR.startMatch + '</button>';
  }

  /* ---------- Training ---------- */
  function renderTraining() {
    view.innerHTML = pageHead(STR.training) +
      '<div class="nsg-card-info"><b>' + STR.training + '</b><p>' + STR.freePractice + '</p></div>' +
      '<button class="nsg-btn primary xl" data-nsg-act="start-training">' + STR.startTraining + '</button>';
  }

  /* ---------- Shop ---------- */
  function renderShop() {
    var kind = st.tab === 'ball' ? 'ball' : 'character';
    var list = kind === 'ball' ? D.BALLS : D.CHARACTERS;
    var pr = P.get(), eq = P.equipped(kind);
    view.innerHTML = pageHead(STR.shop) +
      '<div class="nsg-coinbar">' + coinIcon() + '<b>' + pr.coins + '</b></div>' +
      '<div class="nsg-tabs">' +
        '<button class="' + (kind === 'character' ? 'on' : '') + '" data-nsg-tab="character">' + STR.tabPlayers + '</button>' +
        '<button class="' + (kind === 'ball' ? 'on' : '') + '" data-nsg-tab="ball">' + STR.tabBalls + '</button>' +
      '</div>' +
      '<div class="nsg-grid">' + list.map(function (it) {
        var ok = P.unlocked(kind, it), isEq = eq.id === it.id;
        var tag = isEq ? STR.equipped : ok ? STR.equip : it.premium ? STR.premium : STR.buy + ' · ' + it.price;
        var art = kind === 'ball' ? ballSVG(it.color, 72) : characterSVG(it.color);
        return '<button class="nsg-card' + (isEq ? ' is-eq' : '') + (ok ? '' : ' is-lock') + '" data-nsg-item="' + kind + ':' + it.id + '">' +
          '<span class="nsg-art">' + art + '</span>' +
          '<b>' + esc(it.name) + '</b>' +
          '<small>' + (it.premium ? STR.premium : STR.standard) + '</small>' +
          '<em>' + tag + '</em></button>';
      }).join('') + '</div>';
  }

  function onItem(kind, id) {
    var list = kind === 'ball' ? D.BALLS : D.CHARACTERS;
    var it = find(list, id);
    if (!P.unlocked(kind, it)) {
      if (it.premium) return toast(STR.needPass);
      var buy = P.purchase(kind, it.id);
      if (!buy.ok) return toast(STR.needCoins);
    }
    P.equip(kind, it.id);
  }

  /* ---------- Game Pass ---------- */
  function renderGamePass() {
    var pr = P.get(), owned = pr.gamePass;
    var pct = owned ? 100 : Math.min(100, Math.round(pr.coins / D.GAME_PASS_PRICE * 100));
    var can = !owned && pr.coins >= D.GAME_PASS_PRICE;
    view.innerHTML = pageHead(STR.gamePass) +
      '<section class="nsg-gpc">' +
        '<span class="nsg-pass big">PASS</span>' +
        '<h2>' + (owned ? STR.passOwned : STR.gamePass) + '</h2>' +
        '<p>' + STR.passDesc + '</p>' +
        '<div class="nsg-bar lg"><i style="width:' + pct + '%"></i></div>' +
        '<small class="nsg-mut">' + (owned ? STR.owned : pr.coins + ' / ' + D.GAME_PASS_PRICE + ' ' + STR.coins) + '</small>' +
        '<button class="nsg-btn primary xl" data-nsg-act="buy-pass"' + (owned || !can ? ' disabled' : '') + '>' +
          (owned ? STR.owned : can ? STR.passBuy + ' · ' + D.GAME_PASS_PRICE : STR.needCoins) +
        '</button>' +
      '</section>';
  }
  function buyPass() {
    var r = P.buyGamePass();
    toast(r.ok ? STR.passOwned : STR.needCoins);
  }

  /* ---------- partido ---------- */
  function matchHTML(mode) {
    var train = mode === 'training', touch = isTouch();
    return '<section class="nsg-match">' +
      '<div class="nsg-hud">' +
        '<button class="nsg-ib" data-nsg-act="quit" aria-label="' + STR.quit + '">' + icon('close') + '</button>' +
        '<div class="nsg-sc"><span>' + STR.you + '</span><b id="nsg-sp">0</b><i>–</i><b id="nsg-sc">0</b><span>' + STR.cpu + '</span></div>' +
        '<div class="nsg-clock" id="nsg-clock">' + (train ? STR.freeTime : '1:00') + '</div>' +
      '</div>' +
      '<div class="nsg-field">' +
        '<canvas id="nsg-canvas" role="img" aria-label="Campo de juego"></canvas>' +
        '<div class="nsg-goalfx" id="nsg-goalfx" hidden>' + STR.goal + '</div>' +
        '<div class="nsg-ov" id="nsg-ov-start">' +
          '<span class="nsg-kicker">' + (train ? STR.training : STR.match) + '</span>' +
          '<h2>' + STR.kickOff + '</h2>' +
          '<p>' + (touch ? STR.hintTouch : STR.hintKeys) + '</p>' +
          '<button class="nsg-btn primary xl" data-nsg-act="kickoff">' + STR.kickOff + '</button>' +
        '</div>' +
        '<div class="nsg-ov" id="nsg-ov-end" hidden></div>' +
      '</div>' +
      '<div class="nsg-touch" id="nsg-touch"' + (touch ? '' : ' hidden') + '>' +
        '<button class="nsg-tb" data-nsg-in="left" aria-label="Izquierda">◀</button>' +
        '<button class="nsg-tb jump" data-nsg-in="jump" aria-label="Saltar">▲</button>' +
        '<button class="nsg-tb" data-nsg-in="right" aria-label="Derecha">▶</button>' +
      '</div>' +
    '</section>';
  }

  function startMatch(mode) {
    stopMatch();
    st.mode = mode;
    st.screen = 'match';
    root.classList.remove('nsg-home');
    view.innerHTML = matchHTML(mode);
    var canvas = doc.getElementById('nsg-canvas');
    var eng = NS.createEngine(canvas, { onHud: onHud, onMatchEnd: onMatchEnd });
    var ch = P.equipped('character'), ba = P.equipped('ball');
    var cpu = ['#fb7185', '#a78bfa', '#facc15'].filter(function (c) { return c !== ch.color; })[0];
    eng.configure({ mode: mode, difficulty: st.diff, colors: { player: ch.color, cpu: cpu, ball: ba.color } });
    match = {
      engine: eng,
      input: { left: { key: false, touch: false }, right: { key: false, touch: false }, jump: { key: false, touch: false } }
    };
  }

  function stopMatch() {
    if (!match) return;
    match.engine.stop();
    match = null;
  }

  function kickoff() {
    if (!match) return;
    if (NS.sound && NS.sound.unlock) NS.sound.unlock();
    var ov = doc.getElementById('nsg-ov-start');
    if (ov) ov.hidden = true;
    match.engine.start();
  }

  function onHud(h) {
    var sp = doc.getElementById('nsg-sp');
    if (!sp) return;
    sp.textContent = h.p;
    doc.getElementById('nsg-sc').textContent = h.c;
    var clock = doc.getElementById('nsg-clock');
    if (h.time == null) {
      clock.textContent = STR.freeTime;
      clock.classList.remove('low');
    } else {
      clock.textContent = fmtClock(h.time);
      clock.classList.toggle('low', h.time <= 10);
    }
    var gf = doc.getElementById('nsg-goalfx');
    if (gf) gf.hidden = h.phase !== 'celebrate';
  }

  function onMatchEnd(result, gp, gc) {
    var coins = P.reward(result);
    var el = doc.getElementById('nsg-ov-end');
    if (!el) return;
    var title = result === 'win' ? STR.win : result === 'loss' ? STR.lose : STR.draw;
    el.innerHTML =
      '<span class="nsg-kicker">' + STR.fullTime + '</span>' +
      '<h2>' + title + '</h2>' +
      '<p class="nsg-big">' + gp + ' – ' + gc + '</p>' +
      '<p class="nsg-rw">' + coinIcon() + '<span>+' + coins + ' ' + STR.coins + '</span></p>' +
      '<div class="nsg-btns">' +
        '<button class="nsg-btn primary" data-nsg-act="again">' + STR.playAgain + '</button>' +
        '<button class="nsg-btn" data-nsg-act="menu">' + STR.menu + '</button>' +
      '</div>';
    el.hidden = false;
  }

  /* ---------- entrada: teclado y táctil ---------- */
  function setInput(name, src, on) {
    if (!match) return;
    var slot = match.input[name];
    if (!slot) return;
    slot[src] = !!on;
    match.engine.setInput(name, slot.key || slot.touch);
  }

  function onKey(e) {
    if (!match || !st.open) return;
    var name = KEYS[e.code];
    if (!name) return;
    e.preventDefault();
    setInput(name, 'key', e.type === 'keydown');
  }

  function onPointer(e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-nsg-in]') : null;
    if (!t || !match) return;
    var name = t.getAttribute('data-nsg-in');
    if (e.type === 'pointerdown') {
      e.preventDefault();
      try { t.setPointerCapture(e.pointerId); } catch (x) { }
      t.classList.add('on');
      setInput(name, 'touch', true);
    } else {
      t.classList.remove('on');
      setInput(name, 'touch', false);
    }
  }

  /* ---------- clics ---------- */
  function onItemClick(t) {
    var p = t.getAttribute('data-nsg-item').split(':');
    onItem(p[0], p[1]);
    if (st.screen === 'shop') renderShop();
  }

  function onClick(e) {
    var t = e.target.closest && e.target.closest('[data-nsg-go],[data-nsg-act],[data-nsg-tab],[data-nsg-diff],[data-nsg-item]');
    if (!t || t.disabled) return;
    if (t.hasAttribute('data-nsg-go')) return go(t.getAttribute('data-nsg-go'));
    if (t.hasAttribute('data-nsg-tab')) { st.tab = t.getAttribute('data-nsg-tab'); return renderShop(); }
    if (t.hasAttribute('data-nsg-diff')) { st.diff = t.getAttribute('data-nsg-diff'); return renderPlay(); }
    if (t.hasAttribute('data-nsg-item')) return onItemClick(t);
    switch (t.getAttribute('data-nsg-act')) {
      case 'close': return requestClose();
      case 'start-match': return startMatch('match');
      case 'start-training': return startMatch('training');
      case 'kickoff': return kickoff();
      case 'again': return startMatch(st.mode);
      case 'quit': stopMatch(); return go(st.mode === 'training' ? 'training' : 'play');
      case 'menu': stopMatch(); return go('home');
      case 'buy-pass': return buyPass();
    }
  }

  /* ---------- abrir / cerrar (integrado con el botón atrás de LSL) ---------- */
  function open() {
    if (st.open) return;
    init();
    st.open = true;
    root.hidden = false;
    void root.offsetWidth;
    root.classList.add('on');
    doc.documentElement.classList.add('lock');
    go('home');
    if (w.LSL && w.LSL.pushLayer) w.LSL.pushLayer(closeNow);
  }

  function closeNow() {
    if (!st.open) return;
    stopMatch();
    st.open = false;
    root.classList.remove('on');
    root.hidden = true;
    doc.documentElement.classList.remove('lock');
  }

  /* Cerrar con la X: si LSL tiene capas, la saca del historial (así el botón atrás queda sincronizado) */
  function requestClose() {
    if (w.LSL && w.LSL.popLayer) w.LSL.popLayer();
    else closeNow();
  }

  NS.ui = { open: open, close: requestClose };
  w.NeonStriker = NS.ui;

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
