/* Neon Striker · sounds.js
   Sonidos sintetizados con Web Audio API (sin archivos de audio).
   El contexto se crea/reanuda con un gesto del usuario (sound.unlock() en "Kick Off"). */
(function (w) {
  'use strict';
  var NS = w.NS = w.NS || {};
  var AC = w.AudioContext || w.webkitAudioContext;
  var ac = null, muted = false;

  function ctx() {
    if (!AC) return null;
    if (!ac) { try { ac = new AC(); } catch (e) { return null; } }
    if (ac.state === 'suspended') { try { ac.resume(); } catch (e) { } }
    return ac;
  }

  function tone(freq, dur, type, vol, delay, slideTo) {
    var c = ctx();
    if (!c || muted) return;
    var t0 = c.currentTime + (delay || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  NS.sound = {
    unlock: function () { ctx(); },
    setMuted: function (m) { muted = !!m; },
    hit: function () { tone(220, 0.09, 'square', 0.05, 0, 140); },
    goal: function () {
      [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.24, 'triangle', 0.13, i * 0.11); });
    },
    whistle: function () {
      tone(2100, 0.22, 'sine', 0.08, 0, 2000);
      tone(2100, 0.22, 'sine', 0.08, 0.3, 2000);
    }
  };
})(window);
