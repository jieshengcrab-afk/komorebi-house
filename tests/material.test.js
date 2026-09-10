import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHouse } from '../src/house.js';
import { enhanceMaterials, attachDetail, cloneEnhanced, STYLE, SKIP_MATERIALS } from '../src/materials.js';

// The whole point of the procedural approach: it must construct cleanly with no
// DOM. `document` is undefined under `node --test`, so simply building the house
// exercises the headless path.
test('house builds without a DOM and keeps its public API', () => {
  assert.equal(typeof document, 'undefined');
  const house = createHouse();
  assert.ok(house.group instanceof THREE.Group);
  assert.equal(house.wheels.length, 4);
  assert.ok(house.windowMaterials.length >= 2);
  assert.equal(typeof house.update, 'function');
});

test('attachDetail wires onBeforeCompile and a stable cache key', () => {
  const m = new THREE.MeshStandardMaterial();
  attachDetail(m, STYLE.WOOD, { detail: 1, bump: 0.03 });
  assert.equal(typeof m.onBeforeCompile, 'function');
  assert.equal(typeof m.customProgramCacheKey, 'function');
  const m2 = new THREE.MeshStandardMaterial();
  attachDetail(m2, STYLE.METAL);
  // One shared program cache key so the program is compiled/cached once.
  assert.equal(m.customProgramCacheKey(), m2.customProgramCacheKey());
});

test('onBeforeCompile injects triplanar detail and preserves uniforms', () => {
  const m = new THREE.MeshStandardMaterial();
  attachDetail(m, STYLE.SLATE, { detail: 0.8, bump: 0.02 });
  const shader = {
    uniforms: {},
    vertexShader: '#include <beginnormal_vertex>\n#include <begin_vertex>\n',
    fragmentShader: '#include <normal_fragment_maps>\n',
  };
  m.onBeforeCompile(shader);
  assert.equal(shader.uniforms.uKmbStyle.value, STYLE.SLATE);
  assert.equal(shader.uniforms.uKmbDetail.value, 0.8);
  assert.equal(shader.uniforms.uKmbBump.value, 0.02);
  assert.ok(shader.vertexShader.includes('vKmbPos'));
  assert.ok(shader.fragmentShader.includes('kmbFbm'));
  // Must not have flattened albedo to white or wiped the diffuse.
  assert.ok(!shader.fragmentShader.includes('diffuseColor = vec4(1.0)'));
});

test('enhanceMaterials tags every family except window glass', () => {
  const mat = {
    walnut: new THREE.MeshStandardMaterial(),
    slate: new THREE.MeshStandardMaterial(),
    bronze: new THREE.MeshStandardMaterial(),
    bamboo: new THREE.MeshStandardMaterial(),
    stone: new THREE.MeshStandardMaterial(),
    plaster: new THREE.MeshStandardMaterial(),
    glass: new THREE.MeshStandardMaterial(),
    glassSoft: new THREE.MeshStandardMaterial(),
  };
  enhanceMaterials(mat);
  assert.equal(mat.walnut.userData.kmbStyle, STYLE.WOOD);
  assert.equal(mat.slate.userData.kmbStyle, STYLE.SLATE);
  assert.equal(mat.bronze.userData.kmbStyle, STYLE.METAL);
  assert.equal(mat.bamboo.userData.kmbStyle, STYLE.BAMBOO);
  assert.equal(mat.stone.userData.kmbStyle, STYLE.MASONRY);
  assert.equal(mat.plaster.userData.kmbStyle, STYLE.PLASTER);
  // Window glow materials stay pristine (never flattened / bumped).
  assert.ok(SKIP_MATERIALS.has('glass') && SKIP_MATERIALS.has('glassSoft'));
  assert.equal(mat.glass.userData.kmbStyle, undefined);
  assert.equal(mat.glassSoft.userData.kmbStyle, undefined);
});

test('house window materials keep their emissive glow (not flattened white)', () => {
  const house = createHouse();
  for (const m of house.windowMaterials) {
    assert.ok(m.emissive.getHex() !== 0xffffff, 'glass emissive must stay warm, not white');
    assert.ok(m.emissiveIntensity > 0, 'glass must still glow');
    assert.equal(m.userData.kmbStyle, undefined, 'glass must not receive procedural detail');
  }
});

// --- Regression: THREE.Material.clone()/copy() drops the enhancement. ---

test('raw Material.clone() DROPS onBeforeCompile/customProgramCacheKey (documents the trap)', () => {
  const m = new THREE.MeshStandardMaterial();
  attachDetail(m, STYLE.MASONRY, { detail: 0.7, bump: 0.002 });
  const raw = m.clone();
  // copy() deep-copies userData but leaves the callbacks at the prototype no-ops.
  assert.equal(raw.userData.kmbStyle, STYLE.MASONRY, 'userData survives clone');
  assert.equal(raw.onBeforeCompile, THREE.Material.prototype.onBeforeCompile,
    'raw clone must fall back to the prototype no-op onBeforeCompile');
  assert.equal(raw.customProgramCacheKey, THREE.Material.prototype.customProgramCacheKey,
    'raw clone must fall back to the prototype customProgramCacheKey');
});

test('cloneEnhanced() re-attaches the shader from surviving userData', () => {
  const m = new THREE.MeshStandardMaterial();
  attachDetail(m, STYLE.MASONRY, { detail: 0.7, bump: 0.002 });
  const c = cloneEnhanced(m);
  assert.notEqual(c, m, 'must be a distinct material');
  assert.equal(typeof c.onBeforeCompile, 'function');
  assert.notEqual(c.onBeforeCompile, THREE.Material.prototype.onBeforeCompile,
    'clone must carry a real onBeforeCompile, not the prototype no-op');
  assert.equal(typeof c.customProgramCacheKey, 'function');
  assert.equal(c.customProgramCacheKey(), m.customProgramCacheKey(),
    'clone shares the stable program cache key');
  assert.equal(c.userData.kmbStyle, STYLE.MASONRY);
  // Compiling the clone must inject the same style uniform the source uses.
  const shader = {
    uniforms: {},
    vertexShader: '#include <beginnormal_vertex>\n#include <begin_vertex>\n',
    fragmentShader: '#include <normal_fragment_maps>\n',
  };
  c.onBeforeCompile(shader);
  assert.equal(shader.uniforms.uKmbStyle.value, STYLE.MASONRY);
  assert.equal(shader.uniforms.uKmbBump.value, 0.002);
});

test('no house InstancedMesh material is a flat clone (kmbStyle set but onBeforeCompile lost)', () => {
  // The clone trap: Material.copy() deep-copies userData (so kmbStyle survives)
  // but leaves onBeforeCompile at the prototype no-op. Any instanced material
  // that carries a kmbStyle MUST therefore also carry a real onBeforeCompile.
  // Organic bits (leaves/flowers/blossoms) legitimately have no kmbStyle and are
  // ignored. This precisely catches the masonry clone regression.
  const house = createHouse();
  const seen = new Set();
  let enhancedInstanced = 0;
  house.group.traverse((o) => {
    if (!o.isInstancedMesh) return;
    const m = o.material;
    if (seen.has(m.uuid)) return;
    seen.add(m.uuid);
    if (m.userData.kmbStyle === undefined) return; // organic / intentionally plain
    enhancedInstanced++;
    assert.notEqual(m.onBeforeCompile, THREE.Material.prototype.onBeforeCompile,
      `instanced material on "${o.name}" has kmbStyle but a no-op onBeforeCompile (flat clone!)`);
    assert.equal(typeof m.customProgramCacheKey, 'function');
    assert.notEqual(m.customProgramCacheKey, THREE.Material.prototype.customProgramCacheKey,
      `instanced material on "${o.name}" lost its customProgramCacheKey`);
  });
  assert.ok(enhancedInstanced > 0, 'house must contain enhanced instanced masonry/tile meshes');
});

// --- Shared program cache key must NOT mean shared uniforms across materials. ---

test('each material gets its own uniforms object; one cache key still styles per material', () => {
  // Three calls onBeforeCompile with a per-material `parameters` object and stores
  // parameters.uniforms as materialProperties.uniforms, so a shared
  // customProgramCacheKey caches ONE compiled program while every material keeps
  // its own uniform values. We emulate that: two styles, two shader objects.
  const wood = new THREE.MeshStandardMaterial();
  attachDetail(wood, STYLE.WOOD, { detail: 1.0, bump: 0.0035 });
  const slate = new THREE.MeshStandardMaterial();
  attachDetail(slate, STYLE.SLATE, { detail: 1.0, bump: 0.003 });

  assert.equal(wood.customProgramCacheKey(), slate.customProgramCacheKey(),
    'one cached program for all enhanced materials');

  const mk = () => ({ uniforms: {},
    vertexShader: '#include <beginnormal_vertex>\n#include <begin_vertex>\n',
    fragmentShader: '#include <normal_fragment_maps>\n' });
  const sWood = mk(); wood.onBeforeCompile(sWood);
  const sSlate = mk(); slate.onBeforeCompile(sSlate);

  assert.notEqual(sWood.uniforms, sSlate.uniforms, 'uniform sets must be distinct objects');
  assert.equal(sWood.uniforms.uKmbStyle.value, STYLE.WOOD);
  assert.equal(sSlate.uniforms.uKmbStyle.value, STYLE.SLATE);
  assert.notEqual(sWood.uniforms.uKmbStyle.value, sSlate.uniforms.uKmbStyle.value,
    'shared program must NOT collapse the two styles into one uniform value');
});
