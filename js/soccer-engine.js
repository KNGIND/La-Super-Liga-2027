/* Neon Striker · soccer-engine.js
   Motor del partido en Canvas 2D. Física fija a 60 Hz con acumulador de tiempo, sin dependencias.
   Portado de SoccerGame.jsx: mismas constantes, cabezazos círculo-círculo, arcos con postes,
   celebración de 900 ms con posiciones congeladas, modos "match" (60 s) y "training". */
(function (w) {
  'use strict';
  var NS = w.NS = w.NS || {};

  var W = 1000, H = 560, GROUND_Y = H - 60;
  var GRAVITY = 0.55, PLAYER_R = 34, BODY_H = 26, BALL_R = 18;
  var GOAL_H = 150, GOAL_DEPTH = 36, MOVE_SPEED = 4.2, JUMP_V = -11.5;
  var BALL_BOUNCE = 0.72, WALL_BOUNCE = 0.78, GROUND_FRICTION = 0.86;
  var MATCH_SECONDS = 60, CELEBRATE_S = 0.9, MAX_SPEED = 16, POST_R = 6, STEP = 1 / 60;
  var FEET = PLAYER_R + BODY_H;             // distancia centro de cabeza → suelo
  var FLOOR_P = GROUND_Y - FEET;            // y del centro de cabeza parado
  var GOAL_TOP = GROUND_Y - GOAL_H;         // borde superior de la boca del arco
  var LINE_L = GOAL_DEPTH, LINE_R = W - GOAL_DEPTH;   // líneas de gol (el marco queda detrás)

  var AI = {
    easy: { speed: 0.6, jump: 0.02 },
    medium: { speed: 0.92, jump: 0.06 },
    hard: { speed: 1.15, jump: 0.1 }
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function roundRect(ctx, x, y, rw, rh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + rw - r, y); ctx.quadraticCurveTo(x + rw, y, x + rw, y + r);
    ctx.lineTo(x + rw, y + rh - r); ctx.quadraticCurveTo(x + rw, y + rh, x + rw - r, y + rh);
    ctx.lineTo(x + r, y + rh); ctx.quadraticCurveTo(x, y + rh, x, y + rh - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function createEngine(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(w.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var s = {
      mode: 'match', ai: AI.medium, phase: 'idle',
      p: null, c: null, ball: null, spin: 0,
      score: { p: 0, c: 0 }, time: MATCH_SECONDS,
      celebrateT: 0, flash: 0, scorer: '',
      colors: { p: '#22d3ee', c: '#fb7185', ball: '#f5f5f7' }
    };
    var inp = { left: false, right: false, jump: false, jumpQ: false };
    var running = false, raf = 0, last = null, acc = 0, hudKey = '';

    function mkPlayer(x, color, facing) {
      return { x: x, y: FLOOR_P, vx: 0, vy: 0, onGround: true, facing: facing, color: color };
    }

    function resetKickoff() {
      s.p = mkPlayer(W * 0.25, s.colors.p, 1);
      s.c = mkPlayer(W * 0.75, s.colors.c, -1);
      s.ball = { x: W / 2, y: GROUND_Y - BALL_R, vx: 0, vy: 0 };
    }

    function sfx(name) {
      var S = NS.sound;
      if (S && typeof S[name] === 'function') S[name]();
    }

    function emitHud() {
      var secs = s.mode === 'match' ? Math.ceil(s.time) : null;
      var key = s.score.p + ':' + s.score.c + ':' + secs + ':' + s.phase + ':' + s.scorer;
      if (key === hudKey) return;
      hudKey = key;
      if (opts.onHud) opts.onHud({ p: s.score.p, c: s.score.c, time: secs, phase: s.phase, scorer: s.scorer, mode: s.mode });
    }

    function integrate(p) {
      p.vy += GRAVITY;
      p.x += p.vx;
      p.y += p.vy;
      p.x = clamp(p.x, PLAYER_R, W - PLAYER_R);
      if (p.y < PLAYER_R) { p.y = PLAYER_R; if (p.vy < 0) p.vy = 0; }
      if (p.y >= FLOOR_P) { p.y = FLOOR_P; p.vy = 0; p.onGround = true; }
      else p.onGround = false;
    }

    /* CPU: en modo training queda quieta. Defiende el arco derecho (su campo = mitad derecha). */
    function stepCpu(c) {
      if (s.mode === 'training') { c.vx = 0; return; }
      var b = s.ball, cfg = s.ai;
      var tx = b.x > W / 2 ? b.x : W - 150;
      var dx = tx - c.x;
      c.vx = Math.abs(dx) > 6 ? Math.sign(dx) * MOVE_SPEED * cfg.speed : 0;
      if (c.vx) c.facing = c.vx > 0 ? 1 : -1;
      if (c.onGround && Math.abs(b.x - c.x) < 90 && b.y < c.y - 10 && Math.random() < cfg.jump) {
        c.vy = JUMP_V;
        c.onGround = false;
      }
    }

    function stepPlayers() {
      var P = s.p;
      P.vx = ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * MOVE_SPEED;
      if (P.vx) P.facing = P.vx > 0 ? 1 : -1;
      if (inp.jumpQ && P.onGround) { P.vy = JUMP_V; P.onGround = false; }
      inp.jumpQ = false;
      integrate(P);
      stepCpu(s.c);
      integrate(s.c);
    }

    /* Cabezazo: colisión círculo-círculo. Impulso = -1.6 × velocidad relativa en la normal,
       más el empuje del jugador (vx × 0.4 y -2.2 vertical). */
    function headHit(p) {
      var b = s.ball;
      var dx = b.x - p.x, dy = b.y - p.y, d = Math.sqrt(dx * dx + dy * dy), min = PLAYER_R + BALL_R;
      if (d >= min) return;
      var nx = 0, ny = -1;
      if (d > 0.0001) { nx = dx / d; ny = dy / d; }
      var ov = min - d;
      b.x += nx * ov; b.y += ny * ov;
      var rvx = b.vx - p.vx, rvy = b.vy - p.vy, vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        var imp = -1.6 * vn;
        b.vx += nx * imp; b.vy += ny * imp;
        if (-vn > 2.5) sfx('hit');
      }
      b.vx += p.vx * 0.4;
      b.vy += -2.2;
    }

    /* Postes superiores de la boca del arco: rebote simple */
    function postHit(px, py) {
      var b = s.ball;
      var dx = b.x - px, dy = b.y - py, d = Math.sqrt(dx * dx + dy * dy), min = BALL_R + POST_R;
      if (d >= min || d === 0) return;
      var nx = dx / d, ny = dy / d, ov = min - d;
      b.x += nx * ov; b.y += ny * ov;
      var vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.vx -= (1 + WALL_BOUNCE) * vn * nx;
        b.vy -= (1 + WALL_BOUNCE) * vn * ny;
      }
    }

    function goal(who) {
      if (s.mode === 'match') s.score[who]++;
      s.phase = 'celebrate';
      s.celebrateT = CELEBRATE_S;
      s.flash = 1;
      s.scorer = who;
      sfx('goal');
      emitHud();
    }

    /* Devuelve true si la pelota entró en un arco (en ese caso el estado pasa a "celebrate") */
    function stepBall() {
      var b = s.ball;
      b.vy += GRAVITY;
      b.x += b.vx;
      b.y += b.vy;

      var floorY = GROUND_Y - BALL_R;
      if (b.y > floorY) {
        b.y = floorY;
        b.vy = -b.vy * BALL_BOUNCE;
        b.vx *= GROUND_FRICTION;
        if (Math.abs(b.vy) < 0.8) b.vy = 0;
      }
      if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy) * BALL_BOUNCE; }

      // Arco izquierdo (defiende el humano): cruzar la línea dentro de la boca = gol del CPU
      if (b.x - BALL_R <= LINE_L && b.y >= GOAL_TOP) { goal('c'); return true; }
      if (b.x - BALL_R <= 0) { b.x = BALL_R; b.vx = Math.abs(b.vx) * WALL_BOUNCE; }
      // Arco derecho (defiende el CPU): cruzar la línea dentro de la boca = gol del humano
      if (b.x + BALL_R >= LINE_R && b.y >= GOAL_TOP) { goal('p'); return true; }
      if (b.x + BALL_R >= W) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx) * WALL_BOUNCE; }

      postHit(LINE_L, GOAL_TOP);
      postHit(LINE_R, GOAL_TOP);
      headHit(s.p);
      headHit(s.c);

      var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp > MAX_SPEED) { b.vx *= MAX_SPEED / sp; b.vy *= MAX_SPEED / sp; }
      s.spin += b.vx / BALL_R;
      return false;
    }

    function finish() {
      s.phase = 'ended';
      running = false;
      cancelAnimationFrame(raf);
      emitHud();
      sfx('whistle');
      var r = s.score.p > s.score.c ? 'win' : s.score.p < s.score.c ? 'loss' : 'draw';
      if (opts.onMatchEnd) opts.onMatchEnd(r, s.score.p, s.score.c);
      draw();
    }

    function update() {
      if (s.phase === 'celebrate') {
        s.celebrateT -= STEP;
        s.flash = Math.max(0, s.flash - STEP * 1.6);
        if (s.celebrateT <= 0) { resetKickoff(); s.phase = 'play'; s.flash = 0; }
        emitHud();
        return;
      }
      if (s.phase !== 'play') return;
      if (s.mode === 'match') {
        s.time -= STEP;
        if (s.time <= 0) { s.time = 0; finish(); return; }
      }
      stepPlayers();
      stepBall();
      emitHud();
    }

    /* ---------- dibujo ---------- */
    function drawField() {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#121214');
      g.addColorStop(1, '#0b0b0c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(255,255,255,.035)';
      ctx.lineWidth = 1;
      for (var x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GROUND_Y); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,.025)';
      ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

      ctx.save();
      ctx.shadowColor = 'rgba(34,211,238,.6)';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = 'rgba(34,211,238,.55)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(W, GROUND_Y); ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = 'rgba(255,255,255,.07)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(W / 2, GROUND_Y, 70, Math.PI, 0); ctx.stroke();
    }

    function drawGoal(lx, back, color) {
      var x0 = Math.min(lx, back), x1 = Math.max(lx, back);
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,.035)';
      ctx.fillRect(x0, GOAL_TOP, x1 - x0, GROUND_Y - GOAL_TOP);
      ctx.strokeStyle = 'rgba(255,255,255,.07)';
      ctx.lineWidth = 1;
      for (var gx = x0 + 6; gx < x1; gx += 8) { ctx.beginPath(); ctx.moveTo(gx, GOAL_TOP); ctx.lineTo(gx, GROUND_Y); ctx.stroke(); }
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(back, GOAL_TOP); ctx.lineTo(lx, GOAL_TOP); ctx.lineTo(lx, GROUND_Y);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(lx, GOAL_TOP, POST_R, 0, Math.PI * 2); ctx.fill();
    }

    /* Jugador: sombra en el piso, piernas, botas (hacia donde mira), torso, cabeza y ojos.
       Todo el cuerpo se dibuja relativo a p.y, así sube junto con el salto. */
    function drawPlayer(p) {
      var R = PLAYER_R, f = p.facing || 1, x = p.x, y = p.y, feet = y + FEET;
      var lift = clamp((GROUND_Y - feet) / 160, 0, 1);

      ctx.fillStyle = 'rgba(0,0,0,' + (0.45 * (1 - lift * 0.6)).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(x, GROUND_Y, R * 0.9 * (1 - lift * 0.4), 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#27272a';
      roundRect(ctx, x - 11, y + R + 6, 9, 14, 4); ctx.fill();
      roundRect(ctx, x + 2, y + R + 6, 9, 14, 4); ctx.fill();

      ctx.fillStyle = '#0f172a';
      roundRect(ctx, x - 13 + f * 3, feet - 6, 13, 7, 3.5); ctx.fill();
      roundRect(ctx, x + 1 + f * 3, feet - 6, 13, 7, 3.5); ctx.fill();

      ctx.fillStyle = p.color;
      roundRect(ctx, x - 12, y + R - 8, 24, 16, 6); ctx.fill();

      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();

      var ex = x + f * 7;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex - 9, y - 4, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 9, y - 4, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0b0b0c';
      ctx.beginPath(); ctx.arc(ex - 9 + f * 2, y - 3, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 9 + f * 2, y - 3, 3.2, 0, Math.PI * 2); ctx.fill();
    }

    function drawBall() {
      var b = s.ball, col = s.colors.ball;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(s.spin);
      ctx.shadowColor = col;
      ctx.shadowBlur = 12;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(11,11,12,.6)';
      for (var k = 0; k < 5; k++) {
        var a = k * Math.PI * 2 / 5;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * BALL_R * 0.62, Math.sin(a) * BALL_R * 0.62, BALL_R * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath(); ctx.arc(0, 0, BALL_R * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      drawField();
      drawGoal(LINE_L, 0, '#22d3ee');
      drawGoal(LINE_R, W, '#fb7185');
      if (s.c) drawPlayer(s.c);
      if (s.p) drawPlayer(s.p);
      if (s.ball) drawBall();
      if (s.flash > 0) {
        ctx.fillStyle = 'rgba(34,211,238,' + (0.18 * s.flash).toFixed(3) + ')';
        ctx.fillRect(0, 0, W, H);
      }
    }

    /* ---------- bucle ---------- */
    function frame(t) {
      if (!running) return;
      if (last == null) last = t;
      acc += Math.min((t - last) / 1000, 0.1);
      last = t;
      var n = 0;
      while (acc >= STEP && n < 6) {
        update();
        acc -= STEP;
        n++;
        if (!running) break;
      }
      if (!running) return;
      draw();
      raf = requestAnimationFrame(frame);
    }

    function configure(cfg) {
      cfg = cfg || {};
      s.mode = cfg.mode === 'training' ? 'training' : 'match';
      s.ai = AI[cfg.difficulty] || AI.medium;
      if (cfg.colors) {
        if (cfg.colors.player) s.colors.p = cfg.colors.player;
        if (cfg.colors.cpu) s.colors.c = cfg.colors.cpu;
        if (cfg.colors.ball) s.colors.ball = cfg.colors.ball;
      }
      s.score = { p: 0, c: 0 };
      s.time = MATCH_SECONDS;
      s.phase = 'idle';
      s.celebrateT = 0; s.flash = 0; s.scorer = ''; s.spin = 0;
      inp.left = inp.right = inp.jump = inp.jumpQ = false;
      hudKey = '';
      resetKickoff();
      emitHud();
      draw();
    }

    function start() {
      if (running) return;
      if (s.phase === 'idle' || s.phase === 'ended') s.phase = 'play';
      running = true;
      last = null;
      acc = 0;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    /* name: 'left' | 'right' | 'jump'. El salto se dispara por flanco (no por mantener presionado). */
    function setInput(name, on) {
      if (name === 'jump') {
        if (on && !inp.jump) inp.jumpQ = true;
        inp.jump = !!on;
        return;
      }
      if (name === 'left' || name === 'right') inp[name] = !!on;
    }

    return {
      configure: configure,
      start: start,
      stop: stop,
      setInput: setInput,
      render: draw,
      _update: update,      // expuesto para pruebas headless
      _state: s
    };
  }

  NS.createEngine = createEngine;
})(window);
