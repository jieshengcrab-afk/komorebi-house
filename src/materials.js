import * as THREE from 'three';

/**
 * Procedural, physically-based surface detail for the miniature house.
 *
 * Design goals (see task brief):
 *  - Real material realism, not a flat toy/plastic look.
 *  - Object/world-space TRIPLANAR procedural detail so texel density stays
 *    consistent across merged (batchStatic) and instanced/scaled geometry.
 *    Box UVs on this model are stretched by non-uniform scale, so we ignore
 *    UVs entirely and sample GLSL value-noise in the mesh's own local space
 *    (including per-instance placement) instead.
 *  - No CanvasTexture / no `document`: everything is generated in the shader,
 *    so Node `--test` (which has no DOM) exercises the same code path safely.
 *  - Multiscale grain / knots / wear (wood), layered chips + roughness
 *    variation (slate), mineral speckle (stone/masonry), worn tarnish with
 *    varying metal/roughness (bronze), and directional fibre (bamboo).
 *  - Subtle bumps (derivative-based) — never overpowering.
 *  - A single stable customProgramCacheKey so the shader program is cached.
 *  - Window glass is intentionally left untouched (keeps the warm glow; never
 *    flattened to white) and albedo is only gently modulated where per-instance
 *    vertex colors already multiply the diffuse, to avoid double-darkening.
 */

const CACHE_KEY = 'komorebi-pbr-v1';

// Style ids selected in-shader by a uniform (keeps ONE cached program).
export const STYLE = {
  WOOD: 0,
  SLATE: 1,
  MASONRY: 2,
  METAL: 3,
  BAMBOO: 4,
  PLASTER: 5,
};

// --- shared GLSL: hash-based 3D value noise + fbm (no textures needed) ---
const NOISE_GLSL = /* glsl */ `
float kmbHash31(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float kmbNoise(vec3 p){
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = kmbHash31(i + vec3(0.0,0.0,0.0));
  float n100 = kmbHash31(i + vec3(1.0,0.0,0.0));
  float n010 = kmbHash31(i + vec3(0.0,1.0,0.0));
  float n110 = kmbHash31(i + vec3(1.0,1.0,0.0));
  float n001 = kmbHash31(i + vec3(0.0,0.0,1.0));
  float n101 = kmbHash31(i + vec3(1.0,0.0,1.0));
  float n011 = kmbHash31(i + vec3(0.0,1.0,1.0));
  float n111 = kmbHash31(i + vec3(1.0,1.0,1.0));
  return mix(mix(mix(n000,n100,u.x), mix(n010,n110,u.x), u.y),
             mix(mix(n001,n101,u.x), mix(n011,n111,u.x), u.y), u.z);
}
float kmbFbm(vec3 p){
  float a = 0.5, s = 0.0;
  for(int i = 0; i < 4; i++){ s += a * kmbNoise(p); p = p * 2.02 + 7.31; a *= 0.5; }
  return s;
}
`;

const VERTEX_VARYINGS = 'varying vec3 vKmbPos;\nvarying vec3 vKmbNormal;\n';

// Capture object-space (plus per-instance) position & normal. We deliberately
// do NOT multiply by modelMatrix so the pattern does not swim when the whole
// house group translates during the walk animation.
const BEGIN_VERTEX = /* glsl */ `#include <begin_vertex>
  vec3 kmbLocal = transformed;
  #ifdef USE_INSTANCING
    kmbLocal = (instanceMatrix * vec4(transformed, 1.0)).xyz;
  #endif
  vKmbPos = kmbLocal;`;

const BEGIN_NORMAL = /* glsl */ `#include <beginnormal_vertex>
  vec3 kmbN = objectNormal;
  #ifdef USE_INSTANCING
    kmbN = mat3(instanceMatrix) * objectNormal;
  #endif
  vKmbNormal = kmbN;`;

const FRAG_HEADER = 'varying vec3 vKmbPos;\nvarying vec3 vKmbNormal;\n' +
  'uniform float uKmbStyle;\nuniform float uKmbDetail;\nuniform float uKmbBump;\n' +
  NOISE_GLSL;

// Injected right after the normal is finalized; diffuseColor / roughnessFactor /
// metalnessFactor / normal / vViewPosition are all in scope here.
const DETAIL_BLOCK = /* glsl */ `#include <normal_fragment_maps>
  {
    vec3 kp = vKmbPos;
    vec3 kn = normalize(vKmbNormal);
    vec3 an = abs(kn);
    float kh = 0.0;

    if (uKmbStyle < 0.5) {
      // ---- WOOD: multiscale anisotropic grain, growth rings, knots, wear ----
      float alo, acr;
      if (an.y >= an.x && an.y >= an.z) { alo = kp.x; acr = kp.z; }
      else if (an.x >= an.z)           { alo = kp.y; acr = kp.z; }
      else                             { alo = kp.y; acr = kp.x; }
      float warp = (kmbFbm(kp * 1.6) - 0.5) * 0.4;
      float rings = kmbFbm(vec3(acr * 6.5 + warp, alo * 0.7, 2.3));
      float ringBands = abs(fract(rings * 5.0) - 0.5) * 2.0;
      float lines = smoothstep(0.30, 0.92, ringBands);
      float fine = kmbFbm(vec3(acr * 44.0, alo * 3.0, 9.1));
      float knot = smoothstep(0.74, 0.88, kmbFbm(kp * 0.85 + 11.3));
      float dark = lines * 0.15 + knot * 0.30 + (fine - 0.5) * 0.10;
      diffuseColor.rgb *= clamp(1.0 - dark * uKmbDetail, 0.55, 1.15);
      diffuseColor.rgb *= 1.0 + (rings - 0.5) * 0.10 * uKmbDetail;
      roughnessFactor = clamp(roughnessFactor + (0.06 - lines * 0.12 + knot * 0.14) * uKmbDetail, 0.25, 1.0);
      kh = lines * 0.7 + knot * 0.5 + (fine - 0.5) * 0.3;
    } else if (uKmbStyle < 1.5) {
      // ---- SLATE: horizontal strata + chipped flakes, roughness variation ----
      float strata = kmbFbm(vec3(kp.x * 3.0, kp.y * 20.0, kp.z * 3.0));
      float chip = kmbFbm(kp * 26.0);
      float crack = smoothstep(0.52, 0.60, kmbFbm(vec3(kp.x * 8.0, kp.y * 34.0, kp.z * 8.0)));
      diffuseColor.rgb *= 1.0 + (strata - 0.5) * 0.10 * uKmbDetail - crack * 0.06 * uKmbDetail;
      roughnessFactor = clamp(roughnessFactor + (chip - 0.5) * 0.20 * uKmbDetail + crack * 0.08 * uKmbDetail, 0.4, 1.0);
      kh = strata * 0.6 + chip * 0.4 + crack * 0.5;
    } else if (uKmbStyle < 2.5) {
      // ---- STONE / MASONRY: fine mineral speckle (gentle albedo: vertex colors) ----
      float grit = kmbFbm(kp * 34.0);
      float spk = smoothstep(0.60, 0.72, kmbFbm(kp * 80.0));
      float mid = kmbFbm(kp * 10.0);
      diffuseColor.rgb *= 1.0 + (grit - 0.5) * 0.06 * uKmbDetail + spk * 0.06 * uKmbDetail + (mid - 0.5) * 0.05 * uKmbDetail;
      roughnessFactor = clamp(roughnessFactor + (grit - 0.5) * 0.12 * uKmbDetail, 0.6, 1.0);
      kh = grit * 0.5 + spk * 0.6 + (mid - 0.5) * 0.3;
    } else if (uKmbStyle < 3.5) {
      // ---- METAL: worn tarnish patches varying metalness + roughness ----
      float kpatch = kmbFbm(kp * 3.2);
      float tar = smoothstep(0.42, 0.78, kmbFbm(kp * 2.0 + 3.7));
      float micro = kmbFbm(kp * 46.0);
      diffuseColor.rgb *= 1.0 - tar * 0.26 * uKmbDetail;
      diffuseColor.rgb += tar * vec3(0.020, 0.045, 0.028) * uKmbDetail;
      metalnessFactor = clamp(metalnessFactor - tar * 0.45 * uKmbDetail, 0.0, 1.0);
      roughnessFactor = clamp(roughnessFactor + tar * 0.38 * uKmbDetail + (micro - 0.5) * 0.10 * uKmbDetail, 0.08, 1.0);
      kh = kpatch * 0.5 + micro * 0.35 + tar * 0.4;
    } else if (uKmbStyle < 4.5) {
      // ---- BAMBOO: directional fibre + node bands ----
      float alo2, acr2;
      if (an.y >= an.x && an.y >= an.z) { alo2 = kp.y; acr2 = kp.x; }
      else if (an.x >= an.z)            { alo2 = kp.x; acr2 = kp.y; }
      else                              { alo2 = kp.z; acr2 = kp.y; }
      float fiber = kmbFbm(vec3(acr2 * 80.0, alo2 * 3.5, 5.0));
      float node = abs(sin(alo2 * 7.5));
      float nodeBand = smoothstep(0.88, 1.0, node);
      diffuseColor.rgb *= 1.0 - (smoothstep(0.45, 0.9, fiber) * 0.10 + nodeBand * 0.16) * uKmbDetail;
      diffuseColor.rgb *= 1.0 + (fiber - 0.5) * 0.06 * uKmbDetail;
      roughnessFactor = clamp(roughnessFactor + (fiber - 0.5) * 0.12 * uKmbDetail + nodeBand * 0.10 * uKmbDetail, 0.4, 1.0);
      kh = fiber * 0.6 + nodeBand * 0.5;
    } else {
      // ---- PLASTER: soft undulation + fine tooth ----
      float u1 = kmbFbm(kp * 7.0);
      float fp = kmbFbm(kp * 30.0);
      diffuseColor.rgb *= 1.0 + (u1 - 0.5) * 0.05 * uKmbDetail;
      roughnessFactor = clamp(roughnessFactor + (fp - 0.5) * 0.08 * uKmbDetail, 0.7, 1.0);
      kh = u1 * 0.7 + fp * 0.3;
    }

    // Derivative-based bump (perturbNormalArb technique) — subtle by design.
    vec3 kvp = -vViewPosition;
    vec3 kdpx = dFdx(kvp), kdpy = dFdy(kvp);
    float kdhx = dFdx(kh), kdhy = dFdy(kh);
    vec3 kr1 = cross(kdpy, normal);
    vec3 kr2 = cross(normal, kdpx);
    float kdet = dot(kdpx, kr1);
    vec3 kgrad = sign(kdet) * (kdhx * kr1 + kdhy * kr2);
    normal = normalize(abs(kdet) * normal - uKmbBump * kgrad);
  }`;

/**
 * Attach procedural detail to one MeshStandardMaterial.
 * Safe in Node: only assigns callbacks/flags; GLSL runs only when a real
 * renderer compiles the program (never during headless unit tests).
 */
export function attachDetail(material, style, { detail = 1.0, bump = 0.03 } = {}) {
  if (!material || !material.isMaterial) return material;
  material.userData.kmbStyle = style;
  material.userData.kmbDetail = detail;
  material.userData.kmbBump = bump;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uKmbStyle = { value: style };
    shader.uniforms.uKmbDetail = { value: detail };
    shader.uniforms.uKmbBump = { value: bump };
    shader.vertexShader = VERTEX_VARYINGS + shader.vertexShader
      .replace('#include <begin_vertex>', BEGIN_VERTEX)
      .replace('#include <beginnormal_vertex>', BEGIN_NORMAL);
    shader.fragmentShader = FRAG_HEADER + shader.fragmentShader
      .replace('#include <normal_fragment_maps>', DETAIL_BLOCK);
  };
  // Stable across every enhanced material so the program is cached once.
  material.customProgramCacheKey = () => CACHE_KEY;
  material.needsUpdate = true;
  return material;
}

/**
 * Clone a material AND re-attach its procedural detail.
 *
 * CRITICAL: THREE.Material.prototype.copy() (used by .clone()) copies plain
 * fields and deep-copies userData, but it does NOT copy the `onBeforeCompile`
 * callback or the `customProgramCacheKey` function. A raw `.clone()` of an
 * enhanced material therefore renders as a FLAT MeshStandardMaterial with none
 * of the triplanar grain/tarnish/speckle — a silent visual regression.
 *
 * We recover the intended style from the deep-copied userData (kmbStyle /
 * kmbDetail / kmbBump, which DO survive clone) and re-run attachDetail on the
 * clone. No global monkeypatch of Material.prototype — this is opt-in per clone.
 */
export function cloneEnhanced(material) {
  const clone = material.clone();
  const ud = material && material.userData;
  if (ud && ud.kmbStyle !== undefined) {
    attachDetail(clone, ud.kmbStyle, { detail: ud.kmbDetail, bump: ud.kmbBump });
  }
  return clone;
}

/** Names of materials that must stay untouched (window glow, organic bits). */
export const SKIP_MATERIALS = new Set(['glass', 'glassSoft']);

/**
 * Enhance the house material dictionary in place. Call BEFORE any material is
 * cloned in house.js so clones inherit the onBeforeCompile/cache key.
 * Returns the same `mat` object for convenience.
 */
export function enhanceMaterials(mat) {
  if (!mat) return mat;
  // Bump strengths are ~10x lower than the first pass: derivative bumps on
  // high-frequency value noise were producing a harsh black "speckle" on slate,
  // chimney brick and wood instead of subtle micro-relief. Keep them tiny.
  const w = { detail: 1.0, bump: 0.0035 };
  attachDetail(mat.walnut, STYLE.WOOD, w);
  attachDetail(mat.walnutDark, STYLE.WOOD, { detail: 1.05, bump: 0.0035 });
  attachDetail(mat.walnutEdge, STYLE.WOOD, { detail: 0.9, bump: 0.003 });
  attachDetail(mat.bark, STYLE.WOOD, { detail: 1.1, bump: 0.0045 });
  attachDetail(mat.barkLight, STYLE.WOOD, { detail: 1.0, bump: 0.004 });

  attachDetail(mat.bamboo, STYLE.BAMBOO, { detail: 0.9, bump: 0.003 });

  attachDetail(mat.slate, STYLE.SLATE, { detail: 1.0, bump: 0.003 });
  attachDetail(mat.slateAlt, STYLE.SLATE, { detail: 1.0, bump: 0.003 });
  attachDetail(mat.slateEdge, STYLE.SLATE, { detail: 0.8, bump: 0.0025 });

  for (const m of [mat.plaster, mat.mortar, mat.cream]) attachDetail(m, STYLE.PLASTER, { detail: 0.8, bump: 0.002 });
  for (const m of [mat.brick, mat.brickLight, mat.brickWarm]) attachDetail(m, STYLE.MASONRY, { detail: 0.7, bump: 0.002 });
  attachDetail(mat.stone, STYLE.MASONRY, { detail: 0.9, bump: 0.003 });
  attachDetail(mat.terracotta, STYLE.MASONRY, { detail: 0.7, bump: 0.0025 });

  for (const m of [mat.bronze, mat.brass]) attachDetail(m, STYLE.METAL, { detail: 1.0, bump: 0.003 });
  for (const m of [mat.iron, mat.ironEdge]) attachDetail(m, STYLE.METAL, { detail: 0.85, bump: 0.003 });

  return mat;
}

export default enhanceMaterials;
