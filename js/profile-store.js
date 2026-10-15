/* Neon Striker · profile-store.js
   Progreso del jugador (monedas, skins, Game Pass, equipados) en localStorage.
   Reemplaza el perfil de Base44 con la misma forma de datos.
   Para sincronizar con Supabase más adelante, solo hay que cambiar load() y save().
   No toca el estado de la liga (LSL.store) ni el perfil de LSL. */
(function (w) {
  'use strict';
  var NS = w.NS = w.NS || {};
  var D = NS.data;
  var KEY = 'lsl:nsg:profile';
  var subs = [];

  function defaults() {
    return {
      coins: 0,
      ownedCharacters: ['classic'],
      ownedBalls: ['classic'],
      equippedCharacter: 'classic',
      equippedBall: 'classic',
      gamePass: false
    };
  }

  function strList(v, fb) {
    return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string'; }) : fb.slice();
  }

  function clean(o) {
    var d = defaults();
    if (!o || typeof o !== 'object') return d;
    d.coins = Math.max(0, Math.floor(+o.coins || 0));
    d.gamePass = !!o.gamePass;
    d.ownedCharacters = strList(o.ownedCharacters, d.ownedCharacters);
    d.ownedBalls = strList(o.ownedBalls, d.ownedBalls);
    if (d.ownedCharacters.indexOf('classic') < 0) d.ownedCharacters.unshift('classic');
    if (d.ownedBalls.indexOf('classic') < 0) d.ownedBalls.unshift('classic');
    if (typeof o.equippedCharacter === 'string') d.equippedCharacter = o.equippedCharacter;
    if (typeof o.equippedBall === 'string') d.equippedBall = o.equippedBall;
    return d;
  }

  function load() {
    try { return clean(JSON.parse(w.localStorage.getItem(KEY) || 'null')); }
    catch (e) { return defaults(); }
  }

  var state = load();

  function save() {
    try { w.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { }
    subs.forEach(function (fn) { try { fn(state); } catch (e) { } });
  }

  function catalog(kind) { return kind === 'ball' ? D.BALLS : D.CHARACTERS; }
  function list(kind) { return kind === 'ball' ? state.ownedBalls : state.ownedCharacters; }
  function item(kind, id) {
    var c = catalog(kind);
    for (var i = 0; i < c.length; i++) if (c[i].id === id) return c[i];
    return null;
  }
  function owns(kind, id) { return list(kind).indexOf(id) > -1; }

  /* Premium: solo con Game Pass. Estándar: gratis (precio 0) o comprado con monedas. */
  function unlocked(kind, it) {
    if (!it) return false;
    if (it.premium) return state.gamePass;
    return it.price === 0 || owns(kind, it.id);
  }

  function equipped(kind) {
    var id = kind === 'ball' ? state.equippedBall : state.equippedCharacter;
    return item(kind, id) || catalog(kind)[0];
  }

  function fail(reason) { return { ok: false, reason: reason }; }

  function purchase(kind, id) {
    var it = item(kind, id);
    if (!it) return fail('missing');
    if (it.premium) return fail('premium');
    if (owns(kind, id) || it.price === 0) return fail('owned');
    if (state.coins < it.price) return fail('coins');
    state.coins -= it.price;
    list(kind).push(id);
    save();
    return { ok: true };
  }

  function equip(kind, id) {
    var it = item(kind, id);
    if (!it || !unlocked(kind, it)) return fail('locked');
    if (kind === 'ball') state.equippedBall = id; else state.equippedCharacter = id;
    save();
    return { ok: true };
  }

  function buyGamePass() {
    if (state.gamePass) return fail('owned');
    if (state.coins < D.GAME_PASS_PRICE) return fail('coins');
    state.coins -= D.GAME_PASS_PRICE;
    state.gamePass = true;
    save();
    return { ok: true };
  }

  /* Devuelve las monedas ganadas según el resultado del partido */
  function reward(result) {
    var n = D.REWARDS[result] || 0;
    state.coins += n;
    save();
    return n;
  }

  function subscribe(fn) { subs.push(fn); }

  NS.profile = {
    get: function () { return state; },
    purchase: purchase,
    equip: equip,
    buyGamePass: buyGamePass,
    reward: reward,
    unlocked: unlocked,
    owns: owns,
    equipped: equipped,
    subscribe: subscribe
  };
})(window);
