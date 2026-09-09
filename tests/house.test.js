import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHouse } from '../src/house.js';

function objectsNamed(root, name) {
  const result = [];
  root.traverse(o => { if (o.name === name) result.push(o); });
  return result;
}

function boundsOf(root) {
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root);
}

test('createHouse preserves its public API and miniature bounds', () => {
  const house = createHouse();
  assert.ok(house.group instanceof THREE.Group);
  assert.equal(house.group.name, 'wandering-house');
  assert.equal(house.wheels.length, 4);
  assert.ok(house.wheels.every(w => w instanceof THREE.Group));
  assert.ok(house.windowMaterials.length >= 2);
  assert.equal(typeof house.update, 'function');
  const b = boundsOf(house.group);
  const s = b.getSize(new THREE.Vector3());
  assert.ok(b.min.y >= -0.025 && b.min.y <= 0.025, `wheels should touch ground, min y ${b.min.y}`);
  assert.ok(s.x >= 6.5 && s.x <= 7.5, `width including projecting porch stair ${s.x}`);
  assert.ok(s.y >= 7.3 && s.y <= 8.2, `height ${s.y}`);
  assert.ok(s.z >= 3.4 && s.z <= 4.9, `depth ${s.z}`);
});

test('main roof is a broad eave-facing slope with ridge running left-right', () => {
  const { group } = createHouse();
  const roof = group.getObjectByName('main-roof');
  assert.ok(roof, 'main-roof missing');
  const slopes = objectsNamed(roof, 'main-roof-sheathing');
  assert.equal(slopes.length, 2);
  for (const slope of slopes) {
    assert.ok(Math.abs(slope.rotation.x) > .3, 'roof must pitch around X so ridge runs X');
    assert.ok(Math.abs(slope.rotation.z) < .001, 'roof must not pitch around Z into a front gable');
  }
  const ridge = roof.getObjectByName('main-ridge-cap');
  const ridgeBounds = boundsOf(ridge).getSize(new THREE.Vector3());
  assert.ok(ridgeBounds.x > ridgeBounds.z * 5, 'ridge cap must extend left-right');
  const frontTiles = roof.getObjectByName('front-scalloped-slate-tiles');
  assert.ok(frontTiles?.isInstancedMesh && frontTiles.count >= 100);
  const first = new THREE.Matrix4(), last = new THREE.Matrix4();
  frontTiles.getMatrixAt(0, first); frontTiles.getMatrixAt(frontTiles.count - 1, last);
  assert.ok(last.elements[13] > first.elements[13], 'tile rows must rise from front eave to ridge');
  assert.ok(last.elements[14] < first.elements[14], 'tile rows must recede toward ridge');
});

test('facade composes porch, left stair, terrace, umbrellas and upper fanlights', () => {
  const { group } = createHouse();
  for (const name of ['ground-floor','front-porch','exterior-staircase','second-floor-terrace','upper-floor','cafe-umbrellas','upper-fanlight-windows','left-annex','bamboo-roller-blind']) {
    assert.ok(group.getObjectByName(name), `missing ${name}`);
  }
  const stair = group.getObjectByName('exterior-staircase');
  const stairBounds = boundsOf(stair);
  assert.ok(stairBounds.max.x < -1.65, 'outside staircase must stay on left');
  assert.ok(stairBounds.min.z > .4, 'outside staircase must be on front side');
  assert.ok(stairBounds.max.y < 1.5, 'reference stair reaches ground-floor porch, not upper terrace');
  const terrace = boundsOf(group.getObjectByName('second-floor-terrace'));
  assert.ok(terrace.min.y >= 3.55 && terrace.max.y <= 5.2);
  const umbrellas = objectsNamed(group, 'ribbed-cream-umbrella');
  assert.equal(umbrellas.length, 2);
  assert.ok(umbrellas.every(u => u.position.z > .65 && u.position.y > 4.65 && u.position.y < 5.2));
  const fanlights = objectsNamed(group, 'upper-arched-fanlight-glass');
  assert.ok(fanlights.length >= 3);
  assert.ok(fanlights.every(w => w.getWorldPosition(new THREE.Vector3()).y > 5.25));
});

test('crafted materials use individual masonry, joinery and scalloped tile geometry', () => {
  const { group } = createHouse();
  assert.ok(group.getObjectByName('individual-masonry-bricks')?.isInstancedMesh);
  assert.ok(group.getObjectByName('carved-timber-joinery'));
  assert.ok(group.getObjectByName('carved-timber-joinery').userData.visibleBoltCount >= 8);
  assert.ok(group.getObjectByName('front-scalloped-slate-tiles')?.count >= 100);
  assert.ok(group.getObjectByName('rear-scalloped-slate-tiles')?.count >= 100);
  assert.ok(group.getObjectByName('chimney'));
  assert.ok(group.getObjectByName('brass-roof-finial'));
});

test('sakura follows connected front branches rather than floating above the ridge', () => {
  const { group } = createHouse();
  const tree = group.getObjectByName('sakura-tree');
  assert.ok(tree);
  const trunk = tree.getObjectByName('sakura-front-trunk');
  assert.ok(trunk && trunk.position.y > 4 && trunk.position.z > 1);
  assert.ok(objectsNamed(tree, 'sakura-branch').length >= 16);
  const blossoms = objectsNamed(tree, 'five-petal-sakura-blossoms');
  assert.ok(blossoms.length >= 2 && blossoms.every(b => b.isInstancedMesh));
  const b = boundsOf(tree);
  assert.ok(b.min.y < 4.15, `tree must begin at balcony, got ${b.min.y}`);
  assert.ok(b.max.y <= 7.25, `blossoms should trace eave, not float over ridge: ${b.max.y}`);
  assert.ok(b.max.z > 1.1 && b.min.z > .25, 'sakura must remain along the front roof/eave');
});

test('undercarriage has four detailed wheels, axles, suspension and bolt circles', () => {
  const house = createHouse();
  const under = house.group.getObjectByName('bronze-undercarriage');
  assert.ok(under);
  assert.equal(objectsNamed(under, 'wheel').length, 4);
  assert.ok(objectsNamed(under, 'axle').length >= 2);
  assert.ok(objectsNamed(under, 'leaf-spring').length >= 8);
  assert.equal(objectsNamed(under, 'wheel-bolt-circle').length, 4);
});

test('model remains renderable and deterministic within the detail budget', () => {
  const house = createHouse();
  let meshes = 0, triangles = 0, lights = 0;
  house.group.traverse(o => {
    if (o.isMesh) {
      if (Array.isArray(o.material)) for (const g of o.geometry.groups) assert.ok(o.material[g.materialIndex], `${o.name}: missing material for face ${g.materialIndex}`);
      meshes++;
      const indexCount = o.geometry.index?.count ?? o.geometry.attributes.position.count;
      triangles += indexCount / 3 * (o.isInstancedMesh ? o.count : 1);
    }
    if (o.isLight) lights++;
  });
  assert.equal(lights, 0);
  assert.ok(meshes < 200, `draw-call proxy ${meshes}`);
  assert.ok(triangles < 500000, `triangle count ${triangles}`);
  house.update(1.25, 0);
  const still = house.wheels.map(w => w.rotation.x);
  house.update(2.5, 2);
  assert.ok(house.wheels.some((w, i) => w.rotation.x !== still[i]));
  const state = [house.group.position.y, house.group.rotation.z, ...house.wheels.map(w => w.rotation.x)];
  house.update(2.5, 2);
  assert.deepEqual([house.group.position.y, house.group.rotation.z, ...house.wheels.map(w => w.rotation.x)], state);
});
