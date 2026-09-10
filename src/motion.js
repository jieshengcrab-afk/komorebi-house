// Motion helpers for the wandering house: graceful falling sakura petals and
// smoothly-eased wheel locomotion. The math paths are framework-light and pure
// (no DOM, THREE optional) so tests/motion.test.js can exercise them headless.

export const WHEEL_RADIUS = 0.49; // matches heavy-iron-tire radius in house.js

// ---------------------------------------------------------------------------
// Locomotion: eased velocity + honest distance integration.
//
// The wheel roll angle must equal travelled-distance / radius. Feeding the
// house a smoothly ramped velocity (instead of a hard 0 -> full step) removes
// the "teleport / snap" feel when walking starts and stops, and integrating the
// *actual* eased velocity keeps the wheels' rotation locked to ground travel so
// they never look like they slide or skid.
// ---------------------------------------------------------------------------
export function createLocomotion({ radius = WHEEL_RADIUS, accel = 2.6, decel = 6.5 } = {}) {
  let velocity = 0;
  let distance = 0;
  let movingTime = 0;
  const snapshot = () => ({ velocity, distance, movingTime, roll: -distance / radius });
  return {
    reset() { velocity = 0; distance = 0; movingTime = 0; },
    // dt seconds, targetSpeed in world-units/sec (0 = stopped). instant=true
    // (prefers-reduced-motion) skips easing so the scene settles immediately.
    update(dt, targetSpeed, instant = false) {
      const d = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.1));
      const target = Math.max(0, Number.isFinite(targetSpeed) ? targetSpeed : 0);
      if (instant) {
        velocity = target;
      } else {
        // Exponential approach → smooth acceleration; a brisker rate on the way
        // down so the wheels ease to a *complete* stop within a fraction of a
        // second instead of lingering at a sub-perceptual crawl (which would
        // keep the render loop hot and the canvas visually non-idle).
        const rate = target >= velocity ? accel : decel;
        const k = 1 - Math.exp(-rate * d);
        velocity += (target - velocity) * k;
        // Snap to a true stop once imperceptible so the scene goes fully static.
        if (target === 0 && velocity < 2e-3) velocity = 0;
      }
      distance += velocity * d;
      if (velocity > 2e-3) movingTime += d;
      return snapshot();
    },
    get state() { return snapshot(); }
  };
}

// ---------------------------------------------------------------------------
// Falling sakura petals (pure simulation).
//
// Each petal originates in the blossom canopy band and descends under gravity
// toward a terminal (air-resistance) velocity that scales with its size, while
// a per-petal sway oscillator adds lateral flutter and a gentle vertical
// wobble, and independent spin axes make it tumble and catch light on both
// faces. When a petal reaches the ground it is recycled to the canopy so the
// field is continuous. All randomness comes from an injected rng for
// determinism under test.
// ---------------------------------------------------------------------------
export const CANOPY = {
  xMin: -2.7, xMax: 2.7,   // spread across the front eave
  yTop: 6.0, yVar: 1.15,   // spawn height band (blossom level)
  zMin: 0.55, zMax: 2.05,  // depth in front of the facade
  groundY: -0.05           // recycle threshold
};

export function spawnPetal(p, rng, canopy = CANOPY, initial = false) {
  p.x = canopy.xMin + rng() * (canopy.xMax - canopy.xMin);
  p.z = canopy.zMin + rng() * (canopy.zMax - canopy.zMin);
  // On first spawn scatter through the full column so petals are already mid-air;
  // on recycle, drop from just above the canopy band.
  p.y = initial
    ? canopy.groundY + rng() * (canopy.yTop + canopy.yVar - canopy.groundY)
    : canopy.yTop + rng() * canopy.yVar;
  p.size = 0.055 + rng() * 0.06;                 // variable petal size
  p.terminal = 0.55 + p.size * 5.5 + rng() * 0.3; // bigger petals settle faster
  p.vy = -0.15 - rng() * 0.2;                    // small initial downward drift
  p.age = rng() * Math.PI * 2;
  p.phase = rng() * Math.PI * 2;
  p.swayFreq = 1.1 + rng() * 1.9;                // flutter rate
  p.swayAmp = 0.35 + rng() * 0.6;                // lateral flutter reach
  p.driftX = (rng() - 0.5) * 0.55;              // prevailing breeze per petal
  p.driftZ = 0.05 + rng() * 0.35;              // gentle drift toward viewer
  p.spinX = (rng() - 0.5) * 2.4;
  p.spinY = (rng() - 0.5) * 3.0;
  p.spinZ = (rng() - 0.5) * 2.2;
  p.rx = rng() * Math.PI * 2;
  p.ry = rng() * Math.PI * 2;
  p.rz = rng() * Math.PI * 2;
  return p;
}

export function stepPetal(p, dt, rng, canopy = CANOPY, gravity = 1.35) {
  const d = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.05));
  p.age += d;
  // Accelerate downward under gravity but clamp to a size-based terminal speed.
  p.vy -= gravity * d;
  if (p.vy < -p.terminal) p.vy = -p.terminal;
  const sway = Math.sin(p.age * p.swayFreq + p.phase);
  const swayZ = Math.cos(p.age * p.swayFreq * 0.85 + p.phase);
  p.x += (p.driftX + sway * p.swayAmp) * d;
  p.z += (p.driftZ + swayZ * p.swayAmp * 0.5) * d;
  // Vertical: fall plus a subtle flutter lift so descent isn't a straight line.
  p.y += p.vy * d + Math.cos(p.age * p.swayFreq + p.phase) * 0.18 * d;
  p.rx += p.spinX * d;
  p.ry += p.spinY * d;
  p.rz += p.spinZ * d;
  if (p.y <= canopy.groundY) spawnPetal(p, rng, canopy, false);
  return p;
}

// LCG so the field is deterministic given a seed (used by both app and tests).
export function makeRng(seed = 0x9e3779b9) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Build a THREE InstancedMesh petal field. THREE is injected to keep this file
// importable in headless tests that only touch the pure simulation above.
export function createPetalField(THREE, { count = 110, seed = 4177 } = {}) {
  const rng = makeRng(seed);
  // A small, softly-curved petal (bent plane) reads as a real petal when it
  // tumbles, catching light differently on each face.
  const geo = new THREE.PlaneGeometry(1, 1.35, 1, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setZ(i, -0.28 * (1 - Math.abs(y / 0.675))); // gentle cup
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf2b8c6, roughness: 0.78, metalness: 0.0,
    side: THREE.DoubleSide, emissive: 0x3a1622, emissiveIntensity: 0.08
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.name = 'falling-sakura-petals';
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const petals = Array.from({ length: count }, () => spawnPetal({}, rng, CANOPY, true));
  const dummy = new THREE.Object3D();
  const writeAll = () => {
    for (let i = 0; i < count; i++) {
      const p = petals[i];
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, p.rz);
      dummy.scale.set(p.size, p.size * 1.15, p.size);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  writeAll();
  return {
    mesh,
    count,
    update(dt) {
      for (let i = 0; i < count; i++) stepPetal(petals[i], dt, rng, CANOPY);
      writeAll();
    },
    // Diagnostics for robust motion tests: sampled heights + how many are aloft.
    diagnostics() {
      let minY = Infinity, maxY = -Infinity, aloft = 0, sumVy = 0;
      for (const p of petals) {
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
        if (p.y > CANOPY.groundY + 0.1) aloft++;
        sumVy += p.vy;
      }
      return { count, aloft, minY, maxY, meanFallRate: sumVy / count, sampleY: petals.slice(0, 6).map(p => +p.y.toFixed(4)) };
    }
  };
}
