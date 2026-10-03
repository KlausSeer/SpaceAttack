// Optional regression checks: node game.test.cjs (no packages required).
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = {};
const context = new Proxy({}, { get: (t, k) => t[k] || (() => {}), set: (t, k, v) => (t[k] = v, true) });
const element = id => elements[id] ||= { width: 960, height: 640, hidden: false, textContent: '', addEventListener() {}, getContext: () => context };
const sandbox = { assert, Math, document: { querySelector: () => element('game'), getElementById: element, addEventListener() {} }, window: { addEventListener() {} }, requestAnimationFrame() {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(`${__dirname}/game.js`, 'utf8'), sandbox);
vm.runInContext(`
start();
assert.equal(enemies.length, 6);
for (let w = 5; w <= 25; w++) {
  wave = w - 1; nextWave();
  assert.equal(enemies.length, Math.min(30, 15 + w - 5));
  assert.ok(enemies.every(e => e.x > 24 && e.x < W - 24 && e.y + e.r < DANGER_Y));
}
let lastHeavy = 0, lastLight = 0;
for (let w = 1; w <= 60; w++) {
  let composition;
  for (let repeat = 0; repeat < 10; repeat++) {
    wave = w - 1; nextWave();
    const heavy = enemies.filter(e => e.type === 'heavy').length;
    const light = enemies.filter(e => e.type === 'light').length;
    assert.ok(heavy <= Math.floor(enemies.length * .25));
    assert.ok(heavy >= lastHeavy && light >= lastLight);
    if (w < 5) assert.equal(heavy, 0);
    if (w === 1) assert.equal(light, 0);
    const current = heavy + ':' + light;
    if (composition) assert.equal(current, composition);
    composition = current; lastHeavy = heavy; lastLight = light;
  }
}
// Sweep evenly spaced random tickets to verify weighted selection without flaky sampling.
start(); wave = 4; nextWave(); wave = 1;
const pool = enemies.slice();
const realRandom = Math.random;
const counts = [0, 0, 0, 0, 0];
try {
  for (let sample = 0; sample < 1000; sample++) {
    pool.forEach(e => { e.detached = false; });
    Math.random = () => (sample + .5) / 1000;
    breakFormation();
    counts[pool.find(e => e.detached).offsetY / 42]++;
  }
  assert.ok(counts[0] > counts[2] && counts[2] > counts[4]);
  assert.ok(counts[4] > 0); // Lower rows remain eligible.
  pool.forEach(e => { e.detached = true; });
  pool[0].detached = false; pool[0].dead = true;
  pool[1].detached = false; pool[1].hp = 0;
  pool[2].detached = false;
  breakFormation();
  assert.equal(pool[0].detached, false); assert.equal(pool[1].detached, false);
  assert.equal(pool[2].detached, true);
} finally { Math.random = realRandom; }
// All types retain lateral travel and slower, positive downward progress.
for (const type of ['basic', 'light', 'heavy']) {
  const e = { x: 480, y: 100, type, phase: 0, turn: 1, direction: 1, vertical: 1 };
  let lateral = 0;
  for (let step = 0; step < 300; step++) {
    const x = e.x; moveDetached(e, .016); lateral += Math.abs(e.x - x);
  }
  const descent = e.y - 100;
  assert.ok(descent > 0 && lateral > descent * 2);
  assert.ok(descent < .8 * (110 + wave * 7) * TYPES[type].speed * .3 * 4.8);
}
// A diagonal downward crossing and an already-crossed upward mover both count.
for (const upward of [false, true]) {
  start(); breakFormation();
  const e = enemies.find(e => e.detached);
  e.x = 100; e.y = DANGER_Y - e.r + (upward ? .1 : -.1);
  e.vertical = upward ? -1 : 1;
  player.invincible = 1;
  update(.033);
  assert.equal(player.health, 4);
  assert.equal(e.detached, false);
  update(0); assert.equal(player.health, 4);
}
start();
assert.equal(breakCooldown(), 5);
assert.equal(formation.y, 85);
assert.equal(enemies[0].r, 15.75);
update(.02); assert.ok(enemies.every(e => !e.detached));
formation.breakTimer = 0; update(.02);
assert.equal(enemies.filter(e => e.detached).length, 1);
const first = enemies.find(e => e.detached), oldY = first.y;
formation.breakTimer = 0; update(.02);
assert.equal(enemies.filter(e => e.detached).length, 2);
assert.ok(first.y > oldY);
for (let i = 0; i < 4; i++) breakFormation();
assert.equal(enemies.filter(e => e.detached).length, 6); // No total detached cap.
enemies = [first]; plasma = []; first.x = 100; first.y = 200;
first.type = 'heavy'; first.hp = 2;
shots = [{ x: 100, y: 200, r: 5 }]; update(0);
assert.equal(first.hp, 1); assert.equal(score, 0);
assert.equal(enemies.length, 1); assert.equal(waveDelay, 0);
shots = [{ x: 100, y: 200, r: 5 }]; update(0);
assert.equal(enemies.length, 0); assert.equal(score, 250);
waveDelay = 2; update(.01); assert.equal(wave, 2);
assert.ok(enemies.every(e => !e.detached));
breakFormation(); const raider = enemies.find(e => e.detached);
raider.x = 100; raider.y = DANGER_Y + 40;
const healthBefore = player.health; update(0);
assert.equal(player.health, healthBefore - 1);
assert.equal(raider.detached, false);
assert.ok(enemies.every(e => e.y + e.r < DANGER_Y));
formation.y = DANGER_Y; player.invincible = 1; update(0);
assert.equal(player.health, healthBefore - 2);
assert.equal(formation.y, FORMATION_Y);
raider.detached = true; player.y = 400; raider.x = player.x; raider.y = player.y; player.invincible = 0; update(0);
assert.equal(player.health, healthBefore - 3); assert.ok(!enemies.includes(raider));
player.health = 1; score = 12345; damage(true);
assert.equal(state, 'gameover'); assert.equal(ui['final-result'].hidden, false);
assert.equal(ui['final-score'].textContent, score.toLocaleString());
activate(); assert.equal(score, 0); assert.equal(wave, 1); assert.equal(player.health, 5);
assert.equal(ui['final-result'].hidden, true); assert.ok(enemies.every(e => !e.detached && e.hp === TYPES[e.type].hp));
assert.equal(plasma.length, 0); assert.equal(shots.length, 0);
pause(); assert.equal(state, 'paused'); activate(); assert.equal(state, 'playing');
keys.add('KeyD'); keys.add('Space'); const px = player.x; update(.02);
assert.ok(player.x > px); assert.equal(shots.length, 1); keys.clear();
for (let i = 0; i < 10000; i++) {
  if (state !== 'playing') start();
  update(.016); draw();
  assert.ok(enemies.every(e => Number.isFinite(e.x) && Number.isFinite(e.y)));
}
`, sandbox);
assert.ok(!/SECTOR|class="badge"/.test(fs.readFileSync(`${__dirname}/index.html`, 'utf8')));
console.log('PASS: counts, breakaways, heavy hits/score, wave completion, breaches, collisions, result UI, reset, controls, and 10,000 frames.');
