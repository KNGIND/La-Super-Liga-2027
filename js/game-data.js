/* Neon Striker · game-data.js
   Catálogo de skins y reglas de economía (mismos valores que gameData.js de Base44). */
(function (w) {
  'use strict';
  var NS = w.NS = w.NS || {};

  NS.data = {
    CHARACTERS: [
      { id: 'classic', name: 'Classic', color: '#22d3ee', price: 0 },
      { id: 'emerald', name: 'Emerald', color: '#34d399', price: 150 },
      { id: 'sunset', name: 'Sunset', color: '#fb923c', price: 250 },
      { id: 'rose', name: 'Rose', color: '#fb7185', price: 350 },
      { id: 'violet', name: 'Violet', color: '#a78bfa', price: 500, premium: true },
      { id: 'gold', name: 'Gold', color: '#facc15', price: 700, premium: true }
    ],
    BALLS: [
      { id: 'classic', name: 'Classic', color: '#f5f5f7', price: 0 },
      { id: 'lime', name: 'Lime', color: '#a3e635', price: 150 },
      { id: 'ocean', name: 'Ocean', color: '#38bdf8', price: 250 },
      { id: 'lava', name: 'Lava', color: '#ef4444', price: 400, premium: true },
      { id: 'golden', name: 'Golden', color: '#fbbf24', price: 600, premium: true },
      { id: 'disco', name: 'Disco', color: '#e879f9', price: 800, premium: true }
    ],
    REWARDS: { win: 100, draw: 50, loss: 25 },
    GAME_PASS_PRICE: 1000
  };
})(window);
