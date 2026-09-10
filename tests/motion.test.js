import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocomotion, spawnPetal, stepPetal, makeRng, CANOPY, WHEEL_RADIUS } from '../src/motion.js';

test('locomotion eases velocity in and out and integrates honest distance', () => {
  const loco = createLocomotion();
  // Cold start must not jump to full speed on the first frame.
  const first = loco.update(1 / 60, 0.6);
  assert.ok(first.velocity > 0 && first.velocity < 0.6, `eased start ${first.velocity}`);
  // Ramp up toward target.
  let s = first;
  for (let i = 0; i < 240; i++) s = loco.update(1 / 60, 0.6);
  assert.ok(Math.abs(s.velocity - 0.6) < 0.01, `reaches target ${s.velocity}`);
  const rollingDistance = s.distance;
  assert.ok(rollingDistance > 0, 'distance accumulates while moving');
  // Roll angle is exactly travelled distance / radius (no slide).
  assert.ok(Math.abs(s.roll - (-s.distance / WHEEL_RADIUS)) < 1e-9, 'roll locked to travel');
  // Decelerate smoothly to a full stop.
  let stopping = s;
  for (let i = 0; i < 240; i++) stopping = loco.update(1 / 60, 0);
  assert.equal(stopping.velocity, 0, 'comes to a complete stop');
  assert.ok(stopping.distance > rollingDistance, 'keeps rolling forward while decelerating');
});

test('locomotion distance is monotonic and never reverses (no back-and-forth)', () => {
  const loco = createLocomotion();
  let prev = -Infinity;
  for (let i = 0; i < 600; i++) {
    const target = i < 300 ? 0.6 : 0;
    const s = loco.update(1 / 60, target);
    assert.ok(s.distance >= prev, `distance must not reverse (${s.distance} < ${prev})`);
    prev = s.distance;
  }
});

test('petals originate in the blossom canopy band', () => {
  const rng = makeRng(123);
  for (let i = 0; i < 200; i++) {
    const p = spawnPetal({}, rng, CANOPY, false);
    assert.ok(p.x >= CANOPY.xMin && p.x <= CANOPY.xMax);
    assert.ok(p.z >= CANOPY.zMin && p.z <= CANOPY.zMax);
    assert.ok(p.y >= CANOPY.yTop && p.y <= CANOPY.yTop + CANOPY.yVar, `spawn height ${p.y}`);
  }
});

test('petals fall downward under gravity and gain flutter/tumble over time', () => {
  const rng = makeRng(7);
  const p = spawnPetal({}, rng, CANOPY, false);
  const y0 = p.y, x0 = p.x, rx0 = p.rx, ry0 = p.ry;
  for (let i = 0; i < 60; i++) stepPetal(p, 1 / 60, rng, CANOPY);
  assert.ok(p.y < y0 - 0.2, `net downward travel: ${y0} -> ${p.y}`);
  assert.ok(p.vy < 0, 'velocity is downward');
  assert.notEqual(p.x, x0, 'lateral flutter moved the petal');
  assert.ok(p.rx !== rx0 && p.ry !== ry0, 'petal tumbles about multiple axes');
});

test('petals reach a size-dependent terminal fall speed (variable depth/speed)', () => {
  const rng = makeRng(99);
  const p = spawnPetal({}, rng, CANOPY, false);
  for (let i = 0; i < 600; i++) stepPetal(p, 1 / 60, rng, CANOPY);
  assert.ok(p.vy >= -p.terminal - 1e-6, `clamped to terminal ${p.vy} vs ${-p.terminal}`);
  assert.ok(p.terminal > 0.5, 'terminal speed is perceptible');
});

test('petals recycle to the canopy after reaching the ground (continuous field)', () => {
  const rng = makeRng(42);
  const p = spawnPetal({}, rng, CANOPY, false);
  let recycled = false;
  for (let i = 0; i < 4000; i++) {
    const before = p.y;
    stepPetal(p, 1 / 60, rng, CANOPY);
    if (p.y > before + 1) { recycled = true; break; } // jumped back up to canopy
  }
  assert.ok(recycled, 'a grounded petal is respawned aloft');
});

test('petal simulation is deterministic for a given seed', () => {
  const run = () => {
    const rng = makeRng(2025);
    const p = spawnPetal({}, rng, CANOPY, false);
    for (let i = 0; i < 120; i++) stepPetal(p, 1 / 60, rng, CANOPY);
    return [p.x, p.y, p.z, p.rx, p.ry, p.rz];
  };
  assert.deepEqual(run(), run());
});
