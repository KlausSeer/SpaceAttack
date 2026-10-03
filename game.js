'use strict';

// All simulation coordinates stay fixed; CSS scales the canvas to the window.
const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const ui = Object.fromEntries(['score', 'wave', 'health', 'overlay', 'screen-label', 'screen-title', 'screen-description', 'final-result', 'final-score', 'final-wave', 'action', 'announcement'].map(id => [id, document.getElementById(id)]));
const TYPES = {
  basic: { hp: 1, speed: 1, score: 100, color: '#ff657b' },
  light: { hp: 1, speed: 1.25, score: 150, color: '#c29aff' },
  heavy: { hp: 2, speed: .8, score: 250, color: '#ffbd69' }
};
const keys = new Set();
const stars = Array.from({ length: 100 }, () => ({ x: Math.random() * W, y: Math.random() * H, size: Math.random() * 1.6 + .4, speed: Math.random() * 45 + 15 }));
let state = 'start', player, shots = [], enemies = [], plasma = [], particles = [];
let score = 0, wave = 0, waveDelay = 0, noticeTimer = 0, flash = 0;
const DANGER_Y = H - 130;
const FORMATION_Y = 85;
const ENEMY_SCALE = .75;
let formation;
let lastTime = 0, elapsed = 0;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const overlaps = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;

function updateHud() {
  ui.score.textContent = String(score).padStart(6, '0');
  ui.wave.textContent = String(wave || 1).padStart(2, '0');
  ui.health.textContent = '♥ '.repeat(player ? player.health : 5).trim() || '—';
}
function showScreen(label, title, description, action) {
  ui['final-result'].hidden = state !== 'gameover';
  ui['final-score'].textContent = score.toLocaleString();
  ui['final-wave'].textContent = `Reached Wave ${wave}`;
  ui['screen-label'].hidden = !label;
  ui['screen-description'].hidden = !description;
  ui['screen-label'].textContent = label;
  ui['screen-title'].textContent = title;
  ui['screen-description'].textContent = description;
  ui.action.textContent = action;
  ui.overlay.hidden = false;
}
function start() {
  player = { x: W / 2, y: H - 75, r: 17, health: 5, cooldown: 0, invincible: 0 };
  shots = []; enemies = []; plasma = []; particles = [];
  score = 0; wave = 0; flash = 0; elapsed = 0; keys.clear();
  state = 'playing'; ui.overlay.hidden = true;
  ui['final-result'].hidden = true;
  nextWave();
}
function nextWave() {
  wave++;
  const rows = Math.min(3 + Math.floor((wave - 1) / 2), 5);
  const rowCounts = Array.from({ length: rows }, (_, row) => row + 1);
  // Widen existing rows one ship at a time, rather than adding a full row.
  for (let extra = 0; extra < Math.min(15, Math.max(0, wave - 5)); extra++) rowCounts[4 - extra % 5]++;
  const total = rowCounts.reduce((sum, count) => sum + count, 0);
  const heavyCount = Math.floor(total * (wave < 5 ? 0 : Math.min(.25, .07 + (wave - 5) * .015)));
  const lightCount = Math.floor(total * (wave < 2 ? 0 : Math.min(.30, .17 + (wave - 2) * .015)));
  const types = [...Array(heavyCount).fill('heavy'), ...Array(lightCount).fill('light'), ...Array(total - heavyCount - lightCount).fill('basic')];
  // Shuffle positions, never composition: random rolls cannot create difficulty spikes.
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  enemies = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < rowCounts[row]; col++) {
      const type = types.pop();
      enemies.push({ x: 0, y: 0, offsetX: (col - (rowCounts[row] - 1) / 2) * 72, offsetY: row * 42, r: 21 * ENEMY_SCALE, type, hp: TYPES[type].hp, detached: false, hit: 0 });
    }
  }
  formation = { x: W / 2, y: FORMATION_Y, direction: 1, halfWidth: (Math.max(...rowCounts) - 1) * 36 + 21 * ENEMY_SCALE, fire: 1.3, breakTimer: breakCooldown() };
  positionFormation();
  shots = []; plasma = []; waveDelay = 0;
  ui.announcement.textContent = `WAVE ${String(wave).padStart(2, '0')} · ${enemies.length} ENEMIES`;
  noticeTimer = 2.2;
  updateHud();
}
function positionFormation() {
  for (const enemy of enemies) {
    if (enemy.detached) continue;
    enemy.x = formation.x + enemy.offsetX;
    enemy.y = formation.y + enemy.offsetY;
  }
}
function breakCooldown() { return Math.max(3, 5 - (wave - 1) * .2); }
function breakFormation() {
  const candidates = enemies.filter(e => !e.dead && e.hp > 0 && !e.detached);
  const count = wave >= 4 && Math.random() < .5 ? 2 : 1;
  for (let i = 0; i < count && candidates.length; i++) {
    // Each lower row has half the per-ship weight of the row above it.
    const weights = candidates.map(e => 2 ** (-e.offsetY / 42));
    let ticket = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
    let selected = weights.length - 1;
    for (let j = 0; j < weights.length; j++) {
      ticket -= weights[j];
      if (ticket < 0) { selected = j; break; }
    }
    const enemy = candidates.splice(selected, 1)[0];
    enemy.detached = true;
    enemy.direction = player.x >= enemy.x ? 1 : -1;
    enemy.vertical = 1; enemy.phase = Math.random() * Math.PI * 2;
    enemy.turn = 1 + Math.random() * 1.5;
    burst(enemy.x, enemy.y, TYPES[enemy.type].color, 8);
  }
}
function moveDetached(enemy, dt) {
  const speed = .8 * Math.min(230, 110 + wave * 7) * TYPES[enemy.type].speed;
  enemy.phase += dt * 3;
  enemy.turn -= dt;
  if (enemy.turn <= 0) {
    enemy.direction *= -1;
    enemy.turn = .9 + Math.random() * 1.5;
  }
  enemy.x += (enemy.direction * .8 + Math.sin(enemy.phase) * .45) * speed * dt;
  // Keep lateral curves brisk while descent gently varies around a slower drift.
  enemy.y += enemy.vertical * speed * (.20 + Math.sin(enemy.phase * .7) * .06) * dt;
  if (enemy.x < 26 || enemy.x > W - 26) {
    enemy.x = clamp(enemy.x, 26, W - 26); enemy.direction *= -1;
  }
  // Keep the existing curved movement; breaches are resolved before combat.
  if (enemy.y < FORMATION_Y || enemy.y > H - 26) {
    enemy.y = clamp(enemy.y, FORMATION_Y, H - 26); enemy.vertical *= -1;
  }
}
function pause() {
  if (state === 'playing') {
    state = 'paused'; keys.clear();
    showScreen('', 'Paused', 'Press P or Enter to resume.', 'Resume game');
  } else if (state === 'paused') {
    state = 'playing'; ui.overlay.hidden = true;
  }
}
function activate() { if (state === 'paused') pause(); else if (state !== 'playing') start(); }
ui.action.addEventListener('click', activate);
const controlKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyP', 'Enter'];
window.addEventListener('keydown', event => {
  if (!controlKeys.includes(event.code)) return;
  event.preventDefault();
  if (!event.repeat && event.code === 'Enter') activate();
  if (!event.repeat && event.code === 'KeyP') pause();
  keys.add(event.code);
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { keys.clear(); if (state === 'playing') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });

function burst(x, y, color, count = 16) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2, speed = 45 + Math.random() * 150;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .5, color });
  }
}
function damage(breach = false) {
  // A formation breach always costs hull, even during hit invulnerability.
  if ((!breach && player.invincible > 0) || state !== 'playing') return;
  player.health--; player.invincible = 1.25; flash = .18;
  burst(player.x, player.y, '#8ff5ff');
  updateHud();
  if (player.health <= 0) {
    state = 'gameover'; keys.clear(); ui.announcement.textContent = '';
    showScreen('', 'Mission Over', '', 'Play again');
  }
}
function update(dt) {
  elapsed += dt;
  player.invincible = Math.max(0, player.invincible - dt);
  player.cooldown -= dt; flash = Math.max(0, flash - dt);
  noticeTimer -= dt;
  if (noticeTimer <= 0) ui.announcement.textContent = '';
  let dx = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  let dy = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
  const length = Math.hypot(dx, dy) || 1;
  player.x = clamp(player.x + dx / length * 330 * dt, 22, W - 22);
  player.y = clamp(player.y + dy / length * 330 * dt, 85, H - 24);
  if (keys.has('Space') && player.cooldown <= 0) {
    shots.push({ x: player.x, y: player.y - 24, r: 5 });
    player.cooldown = .15;
  }
  let breached = enemies.some(e => e.y + e.r >= DANGER_Y);
  for (const shot of shots) shot.y -= 650 * dt;
  if (enemies.length > 0) {
    formation.x += formation.direction * Math.min(180, 60 + (wave - 1) * 12) * dt;
    const left = formation.halfWidth + 24, right = W - left;
    if (formation.x < left || formation.x > right) {
      formation.x = clamp(formation.x, left, right);
      formation.direction *= -1;
    }
    formation.y += Math.min(14, 4 + (wave - 1) * 1.2) * dt;
    positionFormation();
    formation.breakTimer -= dt;
    if (formation.breakTimer <= 0) {
      breakFormation(); formation.breakTimer = breakCooldown();
    }
    for (const enemy of enemies) {
      enemy.hit = Math.max(0, enemy.hit - dt);
      if (enemy.detached) moveDetached(enemy, dt);
      breached ||= enemy.y + enemy.r >= DANGER_Y;
    }
    // One shared firing timer keeps larger formations from flooding the screen.
    formation.fire -= dt;
    if (formation.fire <= 0) {
      const enemy = enemies[Math.floor(Math.random() * enemies.length)];
      const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const speed = Math.min(300, 145 + wave * 12);
      plasma.push({ x: enemy.x, y: enemy.y + 15, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 6 });
      formation.fire = Math.max(.35, 1.3 - (wave - 1) * .1) + Math.random() * .3;
    }
  }
  // Latch both ends of movement so upward motion cannot erase a crossing.
  // Resolve before collisions: a crossed ship cannot evade the penalty by dying.
  if (breached) {
    damage(true);
    if (state === 'playing') {
      formation.x = W / 2; formation.y = FORMATION_Y; formation.direction = 1;
      formation.fire = 1.3; formation.breakTimer = breakCooldown();
      for (const enemy of enemies) enemy.detached = false;
      positionFormation(); shots = []; plasma = [];
      ui.announcement.textContent = 'DANGER LINE CROSSED · −1 LIFE'; noticeTimer = 2.2;
    }
    return;
  }
  for (const bolt of plasma) { bolt.x += bolt.vx * dt; bolt.y += bolt.vy * dt; }
  // Mark collisions, then remove objects after traversal to avoid skipped hits.
  for (const shot of shots) {
    for (const enemy of enemies) {
      if (!shot.dead && !enemy.dead && overlaps(shot, enemy)) {
        shot.dead = true; enemy.hp--; enemy.hit = .12;
        if (enemy.hp <= 0) {
          enemy.dead = true; score += TYPES[enemy.type].score;
          burst(enemy.x, enemy.y, TYPES[enemy.type].color); updateHud();
        } else burst(enemy.x, enemy.y, '#ffffff', 5);
      }
    }
  }
  for (const enemy of enemies) {
    if (!enemy.dead && overlaps(player, enemy)) {
      enemy.dead = true; burst(enemy.x, enemy.y, '#ffb56b'); damage();
    }
  }
  for (const bolt of plasma) {
    if (overlaps(player, bolt)) { bolt.dead = true; damage(); }
  }
  shots = shots.filter(s => !s.dead && s.y > -20);
  enemies = enemies.filter(e => !e.dead);
  plasma = plasma.filter(b => !b.dead && b.y > -30 && b.y < H + 30 && b.x > -30 && b.x < W + 30);
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  particles = particles.filter(p => p.life > 0);
  if (state === 'playing' && enemies.length === 0) {
    waveDelay += dt;
    if (waveDelay > 2) { plasma = []; nextWave(); }
  }
}

function ship(x, y, enemy = null) {
  ctx.save(); ctx.translate(x, y);
  if (enemy) { ctx.rotate(Math.PI); ctx.scale(ENEMY_SCALE, ENEMY_SCALE); }
  if (enemy?.type === 'light') ctx.scale(.8, 1.1);
  if (enemy?.type === 'heavy') ctx.scale(1.15, .95);
  ctx.fillStyle = enemy ? (enemy.hit > 0 ? '#ffffff' : TYPES[enemy.type].color) : '#76e9f2';
  ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(20, 18); ctx.lineTo(7, 12); ctx.lineTo(0, 17); ctx.lineTo(-7, 12); ctx.lineTo(-20, 18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = enemy ? '#481a38' : '#153750';
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(6, 7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
  if (enemy?.type === 'heavy') {
    ctx.fillStyle = '#fff0cc';
    for (let i = 0; i < enemy.hp; i++) ctx.fillRect(-7 + i * 9, 9, 5, 4);
  }
  if (enemy?.detached) {
    ctx.strokeStyle = TYPES[enemy.type].color;
    ctx.beginPath(); ctx.moveTo(-8, 23); ctx.lineTo(0, 30); ctx.lineTo(8, 23); ctx.stroke();
  }
  if (!enemy) {
    ctx.fillStyle = '#b3faff'; ctx.beginPath(); ctx.moveTo(-5, 18); ctx.lineTo(0, 27 + Math.sin(elapsed * 40) * 5); ctx.lineTo(5, 18); ctx.fill();
  }
  ctx.restore();
}
function draw() {
  ctx.fillStyle = '#080f1e'; ctx.fillRect(0, 0, W, H);
  for (const star of stars) {
    ctx.globalAlpha = star.size / 2.5; ctx.fillStyle = '#b7d4f4'; ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#17304955'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  ctx.save();
  ctx.strokeStyle = '#ff657b80'; ctx.setLineDash([8, 8]);
  ctx.beginPath(); ctx.moveTo(0, DANGER_Y); ctx.lineTo(W, DANGER_Y); ctx.stroke();
  ctx.fillStyle = '#e78c9c'; ctx.font = '11px monospace';
  ctx.fillText('DANGER LINE · CROSSING COSTS 1 LIFE', 18, DANGER_Y + 18);
  ctx.restore();
  for (const shot of shots) { ctx.fillStyle = '#b4fbff'; ctx.fillRect(shot.x - 2, shot.y - 10, 4, 18); }
  for (const enemy of enemies) ship(enemy.x, enemy.y, enemy);
  for (const bolt of plasma) {
    ctx.fillStyle = '#ff637c'; ctx.beginPath(); ctx.arc(bolt.x, bolt.y, bolt.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd9d5'; ctx.beginPath(); ctx.arc(bolt.x, bolt.y, 2, 0, Math.PI * 2); ctx.fill();
  }
  if (player && player.health > 0) {
    ctx.globalAlpha = player.invincible > 0 ? .4 + Math.abs(Math.sin(elapsed * 25)) * .6 : 1;
    ship(player.x, player.y); ctx.globalAlpha = 1;
  } else if (state === 'start') ship(W / 2, H - 85);
  for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); }
  ctx.globalAlpha = 1;
  if (flash > 0) { ctx.fillStyle = `rgba(255, 70, 100, ${flash * 1.5})`; ctx.fillRect(0, 0, W, H); }
}
function frame(time) {
  const dt = Math.min((time - lastTime) / 1000, .033);
  lastTime = time;
  if (state !== 'paused') for (const star of stars) star.y = (star.y + star.speed * dt) % H;
  if (state === 'playing') update(dt);
  draw(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
