import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PI = Math.PI;

/** Build a detailed, self-contained miniature wandering house. */
export function createHouse() {
  const group = new THREE.Group();
  group.name = 'wandering-house';

  const mat = {
    walnut: new THREE.MeshStandardMaterial({ color: 0x3a2015, roughness: 0.72, metalness: 0.02 }),
    darkWood: new THREE.MeshStandardMaterial({ color: 0x21120d, roughness: 0.8 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x65402a, roughness: 0.68 }),
    plaster: new THREE.MeshStandardMaterial({ color: 0xd9cba9, roughness: 0.9 }),
    brick: new THREE.MeshStandardMaterial({ color: 0xb9aa8d, roughness: 0.94 }),
    slate: new THREE.MeshStandardMaterial({ color: 0x27303a, roughness: 0.78, metalness: 0.05 }),
    slateEdge: new THREE.MeshStandardMaterial({ color: 0x171c22, roughness: 0.72 }),
    brass: new THREE.MeshStandardMaterial({ color: 0x8d622c, roughness: 0.34, metalness: 0.72 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x28231f, roughness: 0.45, metalness: 0.62 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x7d7768, roughness: 0.95 }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0x855039, roughness: 0.88 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x40552c, roughness: 0.9 }),
    leafLight: new THREE.MeshStandardMaterial({ color: 0x6b793c, roughness: 0.88 }),
    blossom: new THREE.MeshStandardMaterial({ color: 0xf4b9c8, roughness: 0.72 }),
    blossomLight: new THREE.MeshStandardMaterial({ color: 0xffd7de, roughness: 0.72 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0xe6d6b5, roughness: 0.9, side: THREE.DoubleSide }),
    warmGlass: new THREE.MeshStandardMaterial({ color: 0xffb84f, emissive: 0xff7a18, emissiveIntensity: 1.25, roughness: 0.25, metalness: 0.02 }),
    warmGlassSoft: new THREE.MeshStandardMaterial({ color: 0xffd27d, emissive: 0xff8a25, emissiveIntensity: 0.75, roughness: 0.34 }),
  };
  const windowMaterials = [mat.warmGlass, mat.warmGlassSoft];

  // Self-authored, deterministic material maps: no runtime image downloads.
  if (typeof document !== 'undefined') {
    const texture = (kind) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
      const ctx = canvas.getContext('2d');
      let seed = 495;
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      ctx.fillStyle = kind === 'wood' ? '#b8a68d' : '#e5dbc5'; ctx.fillRect(0, 0, 256, 256);
      if (kind === 'wood') {
        for (let i = 0; i < 450; i++) {
          const x = rnd() * 256;
          ctx.strokeStyle = `rgba(45,28,13,${0.025 + rnd() * 0.12})`; ctx.lineWidth = 0.3 + rnd() * 1.6;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + rnd() * 14, 80, x - rnd() * 10, 180, x + rnd() * 8, 256); ctx.stroke();
        }
      } else {
        for (let y = 0; y < 256; y += 32) for (let x = -64; x < 256; x += 64) {
          const offset = (y / 32 % 2) * 32;
          const shade = 186 + Math.floor(rnd() * 44);
          ctx.fillStyle = `rgb(${shade + 15},${shade + 6},${shade - 12})`;
          ctx.fillRect(x + offset + 1.5, y + 1.5, 61, 29);
        }
        for (let i = 0; i < 9000; i++) { ctx.fillStyle = `rgba(75,58,34,${rnd() * 0.1})`; ctx.fillRect(rnd() * 256, rnd() * 256, 1, 1); }
      }
      const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8;
      return map;
    };
    const woodMap = texture('wood'), masonry = texture('masonry');
    for (const material of [mat.walnut, mat.wood, mat.darkWood]) { material.map = woodMap; material.bumpMap = woodMap; material.bumpScale = 0.015; }
    for (const material of [mat.plaster, mat.brick]) { material.map = masonry; material.bumpMap = masonry; material.bumpScale = 0.035; }
  }

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
  const sphereGeo = new THREE.SphereGeometry(1, 9, 7);

  function box(parent, name, size, pos, material = mat.wood, rotation = null) {
    const mesh = new THREE.Mesh(boxGeo, material);
    mesh.name = name;
    mesh.position.set(...pos);
    mesh.scale.set(...size);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function cylinder(parent, name, radiusTop, radiusBottom, height, pos, material, radial = 12, rotation = null) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radial), material);
    mesh.name = name;
    mesh.position.set(...pos);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function beamFrame(parent, y0, y1, width, depth, side = 'front') {
    const frontBack = side === 'front' || side === 'back';
    const fixed = side === 'front' ? depth / 2 + 0.035 : side === 'back' ? -depth / 2 - 0.035 : side === 'right' ? width / 2 + 0.035 : -width / 2 - 0.035;
    const span = frontBack ? width : depth;
    const addBeam = (along, cross, y, thickness = 0.105) => {
      const pos = frontBack ? [along, y, fixed] : [fixed, y, along];
      const size = frontBack ? [cross, thickness, 0.1] : [0.1, thickness, cross];
      box(parent, 'timber-joinery', size, pos, mat.walnut);
    };
    addBeam(0, span, y0, 0.14);
    addBeam(0, span, y1, 0.14);
    for (const p of [-span / 2 + 0.12, 0, span / 2 - 0.12]) {
      const pos = frontBack ? [p, (y0 + y1) / 2, fixed] : [fixed, (y0 + y1) / 2, p];
      const size = frontBack ? [0.13, y1 - y0, 0.115] : [0.115, y1 - y0, 0.13];
      box(parent, 'timber-post', size, pos, mat.walnut);
    }
    for (const sign of [-1, 1]) {
      const pos = frontBack ? [sign * span * 0.37, y1 - 0.27, fixed + 0.005] : [fixed + 0.005, y1 - 0.27, sign * span * 0.37];
      const mesh = box(parent, 'diagonal-brace', [span * 0.18, 0.09, 0.105], pos, mat.walnut);
      if (frontBack) mesh.rotation.z = sign * 0.66;
      else { mesh.rotation.order = 'YXZ'; mesh.rotation.y = PI / 2; mesh.rotation.z = sign * 0.66; }
    }
  }

  function archedWindow(parent, x, y, z, width, height, facing = 'front', material = mat.warmGlass) {
    const shape = new THREE.Shape();
    const spring = height - width / 2;
    shape.moveTo(-width / 2, -height / 2);
    shape.lineTo(width / 2, -height / 2);
    shape.lineTo(width / 2, spring - height / 2);
    shape.absarc(0, spring - height / 2, width / 2, 0, PI, false);
    shape.lineTo(-width / 2, -height / 2);
    const glass = new THREE.Mesh(new THREE.ShapeGeometry(shape, 18), material);
    glass.name = 'arched-window-glass';
    glass.position.set(x, y, z);
    if (facing === 'back') glass.rotation.y = PI;
    if (facing === 'right') glass.rotation.y = PI / 2;
    if (facing === 'left') glass.rotation.y = -PI / 2;
    parent.add(glass);
    const frame = new THREE.Group();
    frame.name = 'window-mullions';
    frame.position.set(x + (facing === 'right' ? 0.014 : facing === 'left' ? -0.014 : 0), y, z + (facing === 'front' ? 0.014 : facing === 'back' ? -0.014 : 0));
    if (facing === 'right') frame.rotation.y = PI / 2;
    if (facing === 'left') frame.rotation.y = -PI / 2;
    if (facing === 'back') frame.rotation.y = PI;
    box(frame, 'mullion', [0.055, height * 0.88, 0.045], [0, -height * 0.04, 0], mat.darkWood);
    box(frame, 'mullion', [width * 0.9, 0.055, 0.045], [0, -height * 0.14, 0], mat.darkWood);
    for (const side of [-1, 1]) box(frame, 'window-jamb', [0.055, spring, 0.075], [side * width / 2, -width / 4, 0.02], mat.darkWood);
    box(frame, 'window-sill', [width + 0.16, 0.075, 0.19], [0, -height / 2, 0.055], mat.walnut);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(width / 2, 0.045, 6, 18, PI), mat.darkWood);
    arch.rotation.z = 0;
    arch.position.y = spring - height / 2;
    frame.add(arch);
    parent.add(frame);
  }

  // Brass-and-iron rolling undercarriage.
  const undercarriage = new THREE.Group();
  undercarriage.name = 'undercarriage';
  group.add(undercarriage);
  box(undercarriage, 'lower-chassis', [4.15, 0.25, 2.75], [0, 0.95, 0], mat.darkWood);
  box(undercarriage, 'brass-crossbeam-front', [3.55, 0.16, 0.18], [0, 0.63, 1.12], mat.brass);
  box(undercarriage, 'brass-crossbeam-rear', [3.55, 0.16, 0.18], [0, 0.63, -1.12], mat.brass);
  for (const x of [-1.35, 1.35]) {
    for (const z of [-1.12, 1.12]) {
      box(undercarriage, 'suspension-leaf', [0.62, 0.09, 0.16], [x, 0.78, z], mat.brass, [0, 0, x > 0 ? 0.12 : -0.12]);
      cylinder(undercarriage, 'axle-bearing', 0.14, 0.14, 0.26, [x, 0.6, z], mat.iron, 12, [0, 0, PI / 2]);
    }
  }

  const wheels = [];
  for (const x of [-1.72, 1.72]) for (const z of [-1.17, 1.17]) {
    const wheel = new THREE.Group();
    wheel.name = 'wheel';
    wheel.position.set(x, 0.49, z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.25, 20), mat.iron);
    tire.rotation.z = PI / 2;
    tire.castShadow = tire.receiveShadow = true;
    wheel.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.27, 20), mat.brass);
    rim.rotation.z = PI / 2;
    wheel.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.34, 12), mat.darkWood);
    hub.rotation.z = PI / 2;
    wheel.add(hub);
    for (let i = 0; i < 8; i++) {
      const spoke = box(wheel, 'wheel-spoke', [0.3, 0.035, 0.045], [0, 0, 0], mat.darkWood);
      spoke.rotation.x = i * PI / 4;
    }
    undercarriage.add(wheel);
    wheels.push(wheel);
  }

  // Ground floor shell and timber skeleton.
  const ground = new THREE.Group();
  ground.name = 'ground-floor';
  group.add(ground);
  box(ground, 'ground-plaster-shell', [4.1, 2.24, 3.08], [0, 2.28, 0], mat.plaster);
  box(ground, 'heavy-floor-sill', [4.52, 0.3, 3.42], [0, 1.17, 0], mat.walnut);
  box(ground, 'terrace-cornice', [4.45, 0.22, 3.37], [0, 3.45, 0], mat.walnut);
  for (const side of ['front', 'back', 'left', 'right']) beamFrame(ground, 1.25, 3.42, 4.1, 3.08, side);
  const archedWindows = new THREE.Group();
  archedWindows.name = 'arched-windows';
  ground.add(archedWindows);
  archedWindow(archedWindows, 1.2, 2.35, 1.596, 0.72, 1.35, 'front');
  archedWindow(archedWindows, -1.32, 2.32, 1.596, 0.65, 1.18, 'front', mat.warmGlassSoft);
  archedWindow(archedWindows, -1.15, 2.3, -1.596, 0.72, 1.28, 'back');
  archedWindow(archedWindows, 1.18, 2.28, -1.596, 0.68, 1.18, 'back', mat.warmGlassSoft);
  archedWindow(archedWindows, 2.096, 2.3, 0.78, 0.68, 1.24, 'right');
  archedWindow(archedWindows, -2.096, 2.3, -0.38, 0.62, 1.14, 'left');
  // Front door, hardware and brick apron.
  box(ground, 'front-door', [0.78, 1.55, 0.09], [-0.12, 2.14, 1.605], mat.wood);
  box(ground, 'door-frame-left', [0.11, 1.72, 0.13], [-0.56, 2.18, 1.66], mat.darkWood);
  box(ground, 'door-frame-right', [0.11, 1.72, 0.13], [0.32, 2.18, 1.66], mat.darkWood);
  cylinder(ground, 'door-handle', 0.045, 0.045, 0.08, [0.13, 2.14, 1.72], mat.brass, 10, [PI / 2, 0, 0]);

  // Terrace and upper storey.
  const terrace = new THREE.Group();
  terrace.name = 'terrace';
  group.add(terrace);
  box(terrace, 'terrace-deck', [4.55, 0.16, 3.48], [0, 3.59, 0], mat.wood);
  const upper = new THREE.Group();
  upper.name = 'upper-floor';
  group.add(upper);
  box(upper, 'upper-plaster-shell', [3.58, 2.08, 2.08], [0.18, 4.7, -0.37], mat.brick);
  const upperFrame = new THREE.Group(); upperFrame.position.set(0.18, 0, -0.37); upper.add(upperFrame);
  for (const side of ['front', 'back', 'left', 'right']) beamFrame(upperFrame, 3.66, 5.72, 3.58, 2.08, side);
  archedWindow(archedWindows, -0.85, 4.78, 0.726, 0.62, 1.12, 'front', mat.warmGlassSoft);
  archedWindow(archedWindows, 1.08, 4.78, 0.726, 0.72, 1.24, 'front');
  archedWindow(archedWindows, -0.72, 4.72, -1.416, 0.62, 1.1, 'back');
  archedWindow(archedWindows, 1.16, 4.72, -1.416, 0.66, 1.15, 'back', mat.warmGlassSoft);
  archedWindow(archedWindows, 1.976, 4.7, 0.25, 0.62, 1.08, 'right');
  archedWindow(archedWindows, -1.616, 4.7, -0.2, 0.58, 1.05, 'left');

  const rails = new THREE.Group();
  rails.name = 'balcony-railings';
  terrace.add(rails);
  const railSegments = [
    [[0, 3.92, 1.64], [4.38, 0.1, 0.1]], [[0, 4.32, 1.64], [4.38, 0.1, 0.1]],
    [[0, 3.92, -1.64], [4.38, 0.1, 0.1]], [[0, 4.32, -1.64], [4.38, 0.1, 0.1]],
    [[2.2, 3.92, 0], [0.1, 0.1, 3.2]], [[2.2, 4.32, 0], [0.1, 0.1, 3.2]],
    [[-2.2, 3.92, -0.35], [0.1, 0.1, 2.5]], [[-2.2, 4.32, -0.35], [0.1, 0.1, 2.5]],
  ];
  for (const [pos, size] of railSegments) box(rails, 'balcony-horizontal-rail', size, pos, mat.walnut);
  for (const z of [-1.64, 1.64]) for (let x = -2.15; x <= 2.16; x += 0.36) box(rails, 'turned-baluster', [0.055, 0.72, 0.055], [x, 3.98, z], mat.walnut);
  for (const x of [-2.2, 2.2]) for (let z = -1.55; z <= 1.56; z += 0.36) box(rails, 'turned-baluster', [0.055, 0.72, 0.055], [x, 3.98, z], mat.walnut);
  for (const x of [-2.2, 2.2]) for (const z of [-1.64, 1.64]) cylinder(rails, 'rail-finial', 0.07, 0.09, 0.2, [x, 4.46, z], mat.brass, 10);

  // Exterior staircase on the left, tucked along the facade.
  const stairs = new THREE.Group();
  stairs.name = 'exterior-staircase';
  group.add(stairs);
  for (let i = 0; i < 9; i++) {
    box(stairs, 'stair-tread', [0.62, 0.12, 0.32], [-2.24 - i * 0.055, 1.23 + i * 0.265, 1.42 - i * 0.29], mat.wood);
    if (i % 2 === 0) box(stairs, 'stair-riser', [0.08, 0.55, 0.08], [-2.57, 1.47 + i * 0.265, 1.42 - i * 0.29], mat.darkWood);
  }
  const stairRail = box(stairs, 'stair-handrail', [0.08, 0.08, 3.0], [-2.57, 2.64, 0.26], mat.walnut);
  stairRail.rotation.x = -0.73;

  // Roof structure and genuinely overlapping slate shingles.
  const roof = new THREE.Group();
  roof.name = 'roof';
  group.add(roof);
  const roofAngle = Math.atan2(1.42, 2.05);
  const roofSlope = Math.hypot(1.42, 2.05);
  for (const sign of [-1, 1]) {
    const plane = box(roof, 'roof-sheathing', [roofSlope, 0.11, 3.14], [sign * 1.02, 6.42, -0.12], mat.slateEdge);
    plane.rotation.z = -sign * roofAngle;
  }
  const shingleGeo = new THREE.BoxGeometry(0.42, 0.07, 0.4);
  for (const sign of [-1, 1]) {
    const cols = 10, rows = 9;
    const shingles = new THREE.InstancedMesh(shingleGeo, mat.slate, cols * rows);
    shingles.name = sign < 0 ? 'left-overlapping-slate-shingles' : 'right-overlapping-slate-shingles';
    const dummy = new THREE.Object3D();
    let n = 0;
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const across = 0.22 + row * 0.225;
      const x = sign * (2.04 - across);
      const y = 5.78 + across * Math.tan(roofAngle) + row * 0.002;
      const z = -1.7 + col * 0.355 + (row % 2) * 0.17;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, -sign * roofAngle);
      dummy.scale.set(1.06, 1, 1.04);
      dummy.updateMatrix();
      shingles.setMatrixAt(n++, dummy.matrix);
    }
    shingles.castShadow = shingles.receiveShadow = true;
    roof.add(shingles);
  }
  box(roof, 'ridge-cap', [0.18, 0.18, 3.55], [0, 7.18, -0.12], mat.slateEdge, [0, 0, PI / 4]);
  for (const z of [-1.88, 1.64]) {
    box(roof, 'gable-bargeboard-left', [2.52, 0.12, 0.12], [-1.01, 6.45, z], mat.walnut, [0, 0, roofAngle]);
    box(roof, 'gable-bargeboard-right', [2.52, 0.12, 0.12], [1.01, 6.45, z], mat.walnut, [0, 0, -roofAngle]);
  }
  // Front and rear half-timbered gables.
  for (const z of [-1.52, 1.28]) {
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-1.78, 5.70); gableShape.lineTo(1.78, 5.70); gableShape.lineTo(0, 6.94); gableShape.closePath();
    const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(gableShape, { depth: 0.1, bevelEnabled: false }), mat.plaster);
    gable.name = 'gable-infill'; gable.position.z = z; roof.add(gable);
    const outward = z > 0 ? 0.14 : -0.04;
    box(roof, 'gable-king-post', [0.11, 1.28, 0.14], [0, 6.37, z + outward], mat.walnut);
    for (const s of [-1, 1]) box(roof, 'gable-brace', [1.28, 0.1, 0.14], [s * 0.63, 6.18, z + outward], mat.walnut, [0, 0, -s * 0.62]);
  }

  const chimney = new THREE.Group();
  chimney.name = 'chimney';
  group.add(chimney);
  box(chimney, 'chimney-stack', [0.48, 1.42, 0.52], [0.84, 6.76, -0.48], mat.stone);
  for (let y = 6.15; y < 7.4; y += 0.2) box(chimney, 'chimney-mortar-course', [0.52, 0.035, 0.56], [0.84, y, -0.48], mat.darkWood);
  box(chimney, 'chimney-cap', [0.62, 0.12, 0.66], [0.84, 7.48, -0.48], mat.slateEdge);

  // Cafe terrace: two tables with cloth umbrellas and stools.
  const cafe = new THREE.Group();
  cafe.name = 'cafe-furniture';
  terrace.add(cafe);
  for (const x of [-1.25, 1.25]) {
    cylinder(cafe, 'cafe-table', 0.42, 0.42, 0.075, [x, 4.08, 1.08], mat.wood, 18);
    cylinder(cafe, 'table-pedestal', 0.055, 0.07, 0.55, [x, 3.82, 1.08], mat.brass, 10);
    cylinder(cafe, 'umbrella-pole', 0.028, 0.028, 1.5, [x, 4.75, 1.08], mat.brass, 8);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.24, 12, 1, true), mat.fabric);
    canopy.name = 'cafe-umbrella';
    canopy.position.set(x, 5.46, 1.08);
    cafe.add(canopy);
    for (const dx of [-0.53, 0.53]) {
      cylinder(cafe, 'cafe-stool', 0.18, 0.18, 0.09, [x + dx, 3.9, 1.08], mat.wood, 12);
      cylinder(cafe, 'stool-leg', 0.035, 0.035, 0.42, [x + dx, 3.72, 1.08], mat.darkWood, 8);
    }
  }

  // Lantern housings, emissive panes but no scene lights.
  const lanterns = new THREE.Group();
  lanterns.name = 'lanterns';
  group.add(lanterns);
  for (const [x, y, z] of [[-2.19, 2.75, 1.5], [2.19, 2.0, 1.48], [-1.8, 4.25, 1.69], [1.82, 4.25, 1.69], [-2.2, 1.35, -1.45], [2.2, 1.35, -1.45]]) {
    box(lanterns, 'lantern-pane', [0.19, 0.34, 0.16], [x, y, z], mat.warmGlass);
    box(lanterns, 'lantern-top', [0.25, 0.055, 0.22], [x, y + 0.2, z], mat.brass);
    box(lanterns, 'lantern-bottom', [0.25, 0.055, 0.22], [x, y - 0.2, z], mat.brass);
  }

  // Planter boxes and economical instanced greenery distributed on all sides.
  const planters = new THREE.Group();
  planters.name = 'planters';
  group.add(planters);
  const planterPositions = [[-1.65,3.77,1.48],[0,3.77,1.48],[1.65,3.77,1.48],[-1.55,3.77,-1.48],[1.55,3.77,-1.48],[2.05,2.72,0.78],[-2.05,2.64,-0.72]];
  for (const p of planterPositions) box(planters, 'flower-box', [0.62, 0.23, 0.25], p, mat.terracotta);
  const leafInst = new THREE.InstancedMesh(sphereGeo, mat.leaf, planterPositions.length * 5);
  leafInst.name = 'instanced-planter-greenery';
  const flowerInst = new THREE.InstancedMesh(sphereGeo, mat.blossomLight, planterPositions.length * 3);
  flowerInst.name = 'instanced-planter-flowers';
  const dummy = new THREE.Object3D();
  let li = 0, fi = 0;
  for (let p = 0; p < planterPositions.length; p++) {
    const [x,y,z] = planterPositions[p];
    for (let i = 0; i < 5; i++) {
      dummy.position.set(x - 0.25 + i * 0.125, y + 0.2 + 0.035 * ((i + p) % 2), z);
      dummy.scale.set(0.18, 0.14 + 0.03 * (i % 2), 0.14);
      dummy.updateMatrix(); leafInst.setMatrixAt(li++, dummy.matrix);
    }
    for (let i = 0; i < 3; i++) {
      dummy.position.set(x - 0.19 + i * 0.19, y + 0.3, z + 0.02);
      dummy.scale.setScalar(0.07); dummy.updateMatrix(); flowerInst.setMatrixAt(fi++, dummy.matrix);
    }
  }
  planters.add(leafInst, flowerInst);

  // Rooftop sakura: modeled branches and clustered 3D blossoms.
  const sakura = new THREE.Group();
  sakura.name = 'sakura-tree';
  group.add(sakura);
  function branchBetween(a, b, radius) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const delta = end.clone().sub(start);
    const mesh = new THREE.Mesh(cylGeo, mat.darkWood);
    mesh.name = 'sakura-branch';
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.scale.set(radius, delta.length(), radius);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    mesh.castShadow = true;
    sakura.add(mesh);
  }
  const branches = [
    [[-0.55,6.15,-0.03],[-0.72,6.75,0.02],.075], [[-.72,6.65,.02],[-1.55,7.05,.08],.055],
    [[-.98,6.83,.04],[-2.05,6.93,.2],.042], [[-.72,6.7,.02],[.15,7.08,.06],.052],
    [[.08,7.03,.06],[1.05,7.32,.02],.04], [[.72,7.2,.02],[1.72,7.08,.15],.035],
    [[1.2,7.18,.08],[2.03,7.35,-.08],.032], [[-1.42,7.0,.1],[-2.1,7.3,-.04],.03],
    [[-.2,7.0,.04],[-.35,7.42,-.18],.03], [[.32,7.1,.03],[.65,7.48,.1],.028],
  ];
  for (const [a,b,r] of branches) branchBetween(a,b,r);
  const flowerParts = [];
  for (let p = 0; p < 5; p++) {
    const angle = p * PI * 2 / 5;
    const petal = new THREE.SphereGeometry(1, 5, 4);
    petal.scale(0.48, 0.18, 0.67); petal.rotateY(angle);
    petal.translate(Math.sin(angle) * 0.42, 0, Math.cos(angle) * 0.42); flowerParts.push(petal);
  }
  const flowerGeo = mergeGeometries(flowerParts, false);
  const blossomCount = 950;
  const blossomA = new THREE.InstancedMesh(flowerGeo, mat.blossom, Math.ceil(blossomCount / 2));
  blossomA.name = 'instanced-pink-sakura-blossoms';
  const blossomB = new THREE.InstancedMesh(flowerGeo, mat.blossomLight, Math.ceil(blossomCount / 2));
  blossomB.name = 'instanced-pale-sakura-blossoms';
  let seed = 9127;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < blossomCount; i++) {
    const x = -2.22 + random() * 4.40;
    const centerY = 7.55 - 0.18 * Math.abs(x) + 0.09 * Math.sin(x * 4);
    const y = centerY + (random() - 0.5) * 0.56;
    const z = 0.03 + (random() - 0.5) * 1.3;
    dummy.position.set(x, y, z);
    const s = 0.065 + random() * 0.065;
    dummy.scale.set(s * (1.1 + random() * 0.35), s, s * 0.82);
    dummy.rotation.set(random() * PI, random() * PI, random() * PI);
    dummy.updateMatrix();
    (i % 2 ? blossomA : blossomB).setMatrixAt(Math.floor(i / 2), dummy.matrix);
  }
  sakura.add(blossomA, blossomB);

  // Draping ivy and fine leaves soften the terrace without billboard foliage.
  const ivy = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 5, 4), mat.leaf, 520);
  ivy.name = 'trailing-terrace-ivy';
  for (let i = 0; i < 520; i++) {
    const side = i % 4, along = (random() - 0.5) * (side < 2 ? 4.1 : 2.8);
    const drop = random() * random() * 0.62;
    dummy.position.set(side < 2 ? along : (side === 2 ? -2.22 : 2.22), 3.88 - drop, side < 2 ? (side === 0 ? 1.67 : -1.67) : along);
    dummy.position.x += (random() - 0.5) * 0.15; dummy.position.z += (random() - 0.5) * 0.15;
    dummy.scale.set(0.045 + random() * 0.06, 0.02, 0.07 + random() * 0.04);
    dummy.rotation.set(random() * PI, random() * PI, random() * PI); dummy.updateMatrix(); ivy.setMatrixAt(i, dummy.matrix);
    ivy.setColorAt(i, new THREE.Color().setHSL(0.22 + random() * 0.04, 0.24 + random() * 0.18, 0.37 + random() * 0.16));
  }
  planters.add(ivy);

  // Small back utility balcony and side awning make the reverse view intentional.
  const backAwning = box(group, 'rear-copper-awning', [1.35, 0.08, 0.74], [0.85, 3.08, -1.83], mat.brass);
  backAwning.rotation.x = -0.18;
  for (const x of [0.28, 1.42]) box(group, 'rear-awning-bracket', [0.06, 0.55, 0.06], [x, 2.9, -1.58], mat.darkWood, [0.28, 0, 0]);

  // Collapse dense, static joinery into per-material batches. The named
  // architectural groups remain intact for inspection, while wheels remain
  // independent animation pivots and shingles/foliage remain instanced.
  function batchStaticMeshes(root) {
    root.updateWorldMatrix(true, true);
    const inverseRoot = root.matrixWorld.clone().invert();
    const buckets = new Map();
    const originals = [];
    root.traverse((object) => {
      if (!object.isMesh || object.isInstancedMesh) return;
      const key = object.material.uuid;
      if (!buckets.has(key)) buckets.set(key, { material: object.material, geometries: [] });
      const localMatrix = inverseRoot.clone().multiply(object.matrixWorld);
      const geometry = object.geometry.clone();
      geometry.applyMatrix4(localMatrix);
      buckets.get(key).geometries.push(geometry);
      originals.push(object);
    });
    for (const object of originals) object.parent.remove(object);
    for (const { material, geometries } of buckets.values()) {
      const geometry = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `${root.name}-material-batch`;
      mesh.castShadow = mesh.receiveShadow = true;
      root.add(mesh);
    }
  }
  batchStaticMeshes(ground);
  batchStaticMeshes(upper);
  batchStaticMeshes(rails);
  wheels.forEach(batchStaticMeshes);

  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  // Deterministic absolute-time animation: callers may seek or pause freely.
  const baseY = group.position.y;
  function update(time, speed = 0) {
    const pace = Math.max(0, Number.isFinite(speed) ? speed : 0);
    const t = Number.isFinite(time) ? time : 0;
    const roll = pace === 0 ? 0 : -t * (1.3 + pace * 1.4);
    wheels.forEach((wheel) => { wheel.rotation.x = roll; });
    group.position.y = baseY + (pace === 0 ? 0 : Math.sin(t * (3.2 + pace)) * 0.025 * Math.min(pace, 2));
    group.rotation.z = pace === 0 ? 0 : Math.sin(t * 1.7) * 0.004 * Math.min(pace, 2);
  }

  return { group, wheels, windowMaterials, update };
}
