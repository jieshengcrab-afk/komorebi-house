import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHouse } from '../src/house.js';

test('pitched roof rises toward the ridge instead of forming an inverted valley', () => {
  const { group } = createHouse();
  const roof = group.getObjectByName('roof');
  const panels = roof.children.filter(child => child.name === 'roof-sheathing');
  assert.equal(panels.length, 2);
  for (const panel of panels) assert.ok(panel.position.x * panel.rotation.z < 0, 'each slope must rise inward');
  const shingles = roof.getObjectByName('right-overlapping-slate-shingles');
  const outer = new THREE.Matrix4(), inner = new THREE.Matrix4();
  shingles.getMatrixAt(0, outer); shingles.getMatrixAt(shingles.count - 1, inner);
  assert.ok(inner.elements[13] > outer.elements[13], 'ridge shingles above eaves');
});

function inspect(root) {
  const names = new Set();
  let meshes = 0;
  let instanced = 0;
  let lights = 0;
  root.traverse((object) => {
    if (object.name) names.add(object.name);
    if (object.isMesh) meshes += 1;
    if (object.isInstancedMesh) instanced += 1;
    if (object.isLight) lights += 1;
  });
  return { names, meshes, instanced, lights };
}

test('createHouse returns a complete, bounded Three.js model', () => {
  const model = createHouse();
  assert.ok(model.group instanceof THREE.Group);
  assert.equal(model.wheels.length, 4);
  assert.ok(model.wheels.every((wheel) => wheel instanceof THREE.Group));
  assert.ok(model.windowMaterials.length >= 2);
  assert.ok(model.windowMaterials.every((material) => material instanceof THREE.MeshStandardMaterial));
  assert.equal(typeof model.update, 'function');

  model.group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model.group);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(bounds.min.y >= -0.02 && bounds.min.y <= 0.02, `wheels must touch y=0, got ${bounds.min.y}`);
  assert.ok(size.x >= 4.4 && size.x <= 5.8, `unexpected width ${size.x}`);
  assert.ok(size.z >= 3.3 && size.z <= 4.8, `unexpected depth ${size.z}`);
  assert.ok(size.y >= 7.0 && size.y <= 8.2, `unexpected height ${size.y}`);
});

test('model has coherent architectural and decorative systems', () => {
  const { group } = createHouse();
  const { names, meshes, instanced, lights } = inspect(group);
  for (const name of [
    'undercarriage', 'ground-floor', 'upper-floor', 'roof', 'terrace',
    'exterior-staircase', 'balcony-railings', 'chimney', 'sakura-tree',
    'cafe-furniture', 'planters', 'lanterns', 'arched-windows',
  ]) assert.ok(names.has(name), `missing system: ${name}`);
  assert.ok(meshes >= 60, `expected rich geometry, got ${meshes} meshes`);
  assert.ok(instanced >= 4, `expected optimized repeated geometry, got ${instanced} instanced meshes`);
  assert.equal(lights, 0, 'self-contained asset should not add scene lights');
  assert.ok(meshes <= 150, `draw-call proxy too high: ${meshes}`);
});

test('update deterministically animates wheels and subtle house motion', () => {
  const model = createHouse();
  const initial = model.wheels.map((wheel) => wheel.rotation.x);
  model.update(1.25, 0);
  assert.deepEqual(model.wheels.map((wheel) => wheel.rotation.x), initial, 'standing must not roll');
  const standingY = model.group.position.y;
  model.update(2.5, 2);
  assert.ok(model.wheels.some((wheel, i) => wheel.rotation.x !== initial[i]), 'moving must roll wheels');
  assert.notEqual(model.group.position.y, standingY, 'moving house should have subtle suspension motion');
  const state = [model.group.position.y, ...model.wheels.map((wheel) => wheel.rotation.x)];
  model.update(2.5, 2);
  assert.deepEqual([model.group.position.y, ...model.wheels.map((wheel) => wheel.rotation.x)], state, 'same time/speed must be deterministic');
});
