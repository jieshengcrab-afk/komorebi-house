import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initialState, transition } from './state.js';

const $ = selector => document.querySelector(selector);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = initialState(reducedMotion);
let renderer, controls, camera, scene, house, frame = 0;
let noticeTimer;
function notice(text) {
  $('#notice').textContent = text;
  $('#notice').classList.add('visible');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => $('#notice').classList.remove('visible'), 3500);
}
const dialog = $('#about-dialog');
$('#about-open').addEventListener('click', () => dialog.showModal());
$('#about-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const b = dialog.getBoundingClientRect(); if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) dialog.close(); } });
$('#retry').addEventListener('click', () => location.reload());
function fail(error) {
  console.error('Gallery initialization:', error);
  cancelAnimationFrame(frame);
  $('#loading').hidden = true;
  $('#fallback').hidden = false;
  document.body.dataset.ready = 'false';
  document.body.dataset.fallback = 'true';
  document.querySelectorAll('.tools button, .mode-buttons button, .view-selector button, #explore').forEach(button => { button.disabled = true; });
}

async function init() {
  const container = $('#scene');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, matchMedia('(max-width:700px)').matches ? 1.5 : 2));
  renderer.setClearColor(0xefece4, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); fail(new Error('WebGL context lost')); });
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xefece4, 0.015);
  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 120);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.minDistance = 7;
  controls.maxDistance = 27;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI / 2 - 0.035;
  controls.autoRotateSpeed = 0.45;
  controls.zoomSpeed = 0.65;
  controls.rotateSpeed = 0.55;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.05);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.30;
  room.dispose(); pmrem.dispose();
  const sky = new THREE.HemisphereLight(0xf7f5e8, 0x716551, 2.0); scene.add(sky);
  const sun = new THREE.DirectionalLight(0xffe9c7, 3.1);
  sun.position.set(-7, 13, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 12, bottom: -10, near: 0.5, far: 40 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.026; sun.shadow.radius = 3;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xfff2da, 1.1); rim.position.set(5, 10, -8); scene.add(rim);
  const warm = new THREE.PointLight(0xffb24c, 0, 12, 2); warm.position.set(0, 3.0, 3.0); scene.add(warm);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xe6e1d5, roughness: 1 });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.6, 0.16, 128), floorMaterial);
  floor.position.y = -0.10; floor.receiveShadow = true; scene.add(floor);
  const groundMat = new THREE.ShadowMaterial({ color: 0x171d18, opacity: 0.14 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.19; ground.receiveShadow = true; scene.add(ground);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xc5c2b2, transparent: true, opacity: 0.4 });
  for (const radius of [5.05, 5.20]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.011, 128), ringMaterial);
    ring.rotation.x = -Math.PI / 2; ring.position.y = -0.014; scene.add(ring);
  }
  // Broad baked-style contact shadow grounds the four wheels without a hard oval.
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
  const context = shadowCanvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(38,29,17,0.48)'); gradient.addColorStop(0.5, 'rgba(38,29,17,0.24)'); gradient.addColorStop(1, 'rgba(38,29,17,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(8, 6.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, opacity: 0.7 }));
  contact.rotation.x = -Math.PI / 2; contact.position.y = -0.009; scene.add(contact);

  const { createHouse } = await import('./house.js');
  house = createHouse(); scene.add(house.group);
  let seed = 73;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // A sparse garden at ground level, entirely volumetric from every angle.
  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  const rockMats = [0x9a9380, 0xb0a38a, 0xc1b69d].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.97 }));
  for (let i = 0; i < 14; i++) {
    const angle = random() * Math.PI * 2, radius = 2.7 + random() * 1.2, scale = 0.09 + random() * 0.24;
    const rock = new THREE.Mesh(rockGeo, rockMats[i % 3]);
    rock.position.set(Math.cos(angle) * radius, scale * 0.47, Math.sin(angle) * radius);
    rock.scale.set(scale * 1.7, scale, scale * 1.2); rock.rotation.set(random(), random(), random()); rock.castShadow = true; rock.receiveShadow = true; scene.add(rock);
  }
  const petalCount = matchMedia('(max-width:700px)').matches ? 55 : 110;
  const petalGeo = new THREE.SphereGeometry(1, 6, 4);
  const petalMat = new THREE.MeshStandardMaterial({ color: 0xe8acb7, roughness: 0.83, side: THREE.DoubleSide });
  const petals = new THREE.InstancedMesh(petalGeo, petalMat, petalCount);
  const petalData = Array.from({ length: petalCount }, () => ({ x: (random() - 0.5) * 8, z: (random() - 0.5) * 7, y: random() * 8, speed: 0.16 + random() * 0.3, phase: random() * Math.PI * 2 }));
  const transform = new THREE.Object3D(); scene.add(petals); petals.frustumCulled = false;
  // A few petals rest on the plinth even when motion is disabled.
  const fallen = new THREE.InstancedMesh(petalGeo, petalMat, 65);
  for (let i = 0; i < 65; i++) {
    const a = random() * Math.PI * 2, r = 2.7 + random() * 2.7;
    transform.position.set(Math.cos(a) * r, 0.012, Math.sin(a) * r);
    transform.rotation.set(0, random() * Math.PI, 0); transform.scale.set(0.034, 0.008, 0.019); transform.updateMatrix(); fallen.setMatrixAt(i, transform.matrix);
  }
  scene.add(fallen);
  let tween = null;
  const presets = {
    home: { position: [10.8, 8.6, 16], target: [0, 3.4, 0], caption: '01 / 全景 · THE LITTLE WANDERER' },
    roof: { position: [7.0, 10.0, 9.8], target: [0, 5.85, 0], caption: '02 / 櫻花屋頂 · A ROOFTOP IN BLOOM' },
    terrace: { position: [6.1, 6.1, 10], target: [0, 3.75, 1.0], caption: '03 / 午後露台 · SLOW AFTERNOONS' },
    chassis: { position: [6.5, 2.4, 9], target: [0, 1.1, 0], caption: '04 / 旅行底盤 · MADE TO WANDER' },
    back: { position: [-10.8, 8.6, -16], target: [0, 3.4, 0], caption: '05 / 小屋背面 · THE OTHER SIDE OF HOME' }
  };
  function goToView(name, immediate = false) {
    state = transition(state, 'view', name);
    const preset = presets[state.view];
    const position = new THREE.Vector3(...preset.position);
    const target = new THREE.Vector3(...preset.target);
    if (container.clientWidth < 600) position.sub(target).multiplyScalar(1.16).add(target);
    tween = { start: performance.now(), from: camera.position.clone(), to: position, fromTarget: controls.target.clone(), toTarget: target };
    if (immediate || reducedMotion) { camera.position.copy(position); controls.target.copy(target); tween = null; }
    $('#scene-caption').textContent = preset.caption;
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === state.view)));
    controls.update();
  }
  function updateUI() {
    renderer.shadowMap.needsUpdate = true;
    document.body.classList.toggle('night', state.night);
    for (const action of ['night', 'petals', 'orbit']) $('#' + action).setAttribute('aria-pressed', String(state[action]));
    document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    $('#mode-status').textContent = { stand: '慢下來，也是一種前進。', walk: '讓風景，慢慢走進日常。', rest: '晚安，把星光留在窗邊。' }[state.mode];
    $('#time-label').textContent = state.night ? '春夜 · 20:30' : '春日 · 16:30';
    controls.autoRotate = state.orbit;
    petals.visible = state.petals;
  }
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    state = transition(state, 'mode', button.dataset.mode);
    if (state.mode === 'rest') state = { ...state, night: true, orbit: false };
    if (state.mode === 'walk') state = { ...state, night: false };
    updateUI();
  }));
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { state = { ...state, orbit: false }; updateUI(); goToView(button.dataset.view); }));
  for (const action of ['night', 'petals', 'orbit']) $('#' + action).addEventListener('click', () => {
    state = transition(state, action);
    if (action === 'night' && !state.night && state.mode === 'rest') state = { ...state, mode: 'stand' };
    updateUI();
  });
  $('#home').addEventListener('click', () => { state = { ...state, orbit: false }; updateUI(); goToView('home'); });
  $('#explore').addEventListener('click', () => { state = { ...state, orbit: !state.orbit }; updateUI(); container.focus({ preventScroll: true }); });
  $('#fullscreen').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else notice('此瀏覽器不支援全螢幕；可用雙指縮放探索。'); }
    catch { notice('無法進入全螢幕，請直接在瀏覽器開啟此頁。'); }
  });
  document.addEventListener('fullscreenchange', () => $('#fullscreen').setAttribute('aria-pressed', String(!!document.fullscreenElement)));
  controls.addEventListener('start', () => { tween = null; state = { ...state, orbit: false }; updateUI(); });
  container.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '=', 'Home'].includes(event.key)) {
      event.preventDefault(); tween = null;
      const offset = camera.position.clone().sub(controls.target), sphere = new THREE.Spherical().setFromVector3(offset);
      if (event.key === 'ArrowLeft') sphere.theta -= 0.12;
      if (event.key === 'ArrowRight') sphere.theta += 0.12;
      if (event.key === 'ArrowUp') sphere.phi = Math.max(controls.minPolarAngle, sphere.phi - 0.1);
      if (event.key === 'ArrowDown') sphere.phi = Math.min(controls.maxPolarAngle, sphere.phi + 0.1);
      if (event.key === '+' || event.key === '=') sphere.radius = Math.max(controls.minDistance, sphere.radius * 0.9);
      if (event.key === '-') sphere.radius = Math.min(controls.maxDistance, sphere.radius * 1.1);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sphere));
      if (event.key === 'Home') goToView('home');
      controls.update();
    }
  });
  const resize = () => {
    const width = container.clientWidth, height = container.clientHeight;
    camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height);
  };
  new ResizeObserver(resize).observe(container); resize(); goToView('home', true); updateUI();
  const dayFog = new THREE.Color(0xefece4), nightFog = new THREE.Color(0x1c2625);
  const dayFloor = new THREE.Color(0xe6e1d5), nightFloor = new THREE.Color(0x394440);
  let nightFactor = 0, lastTime = performance.now(), simulationTime = 0, movingTime = 0;
  let frames = 0, accumulatedTime = 0, measuredFps = 0;
  let meshes = 0; house.group.traverse(object => { if (object.isMesh) meshes++; });
  window.__gallery = {
    getDiagnostics: () => ({ state: { ...state }, meshes, triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, fps: Math.round(measuredFps), camera: camera.position.toArray(), target: controls.target.toArray(), nightFactor, wheels: house.wheels.map(wheel => wheel.rotation.toArray()), webgl: renderer.capabilities.isWebGL2 ? 2 : 'unknown', canvasSize: [renderer.domElement.width, renderer.domElement.height] })
  };
  function render(now) {
    frame = requestAnimationFrame(render);
    const elapsed = Math.min((now - lastTime) / 1000, 1);
    const dt = Math.min(elapsed, 0.05); lastTime = now;
    if (document.hidden) return;
    simulationTime += dt; frames++; accumulatedTime += elapsed;
    if (accumulatedTime > 1) { measuredFps = frames / accumulatedTime; frames = 0; accumulatedTime = 0; }
    const smooth = 1 - Math.exp(-elapsed * 2.3);
    nightFactor += ((state.night ? 1 : 0) - nightFactor) * (reducedMotion ? 1 : smooth);
    scene.fog.color.copy(dayFog).lerp(nightFog, nightFactor);
    groundMat.opacity = THREE.MathUtils.lerp(0.14, 0.22, nightFactor);
    floorMaterial.color.copy(dayFloor).lerp(nightFloor, nightFactor);
    sky.intensity = THREE.MathUtils.lerp(2.0, 0.52, nightFactor);
    sun.intensity = THREE.MathUtils.lerp(3.1, 0.34, nightFactor);
    sun.color.setRGB(1 - nightFactor * 0.45, 0.82 - nightFactor * 0.15, 0.65 + nightFactor * 0.35);
    rim.intensity = THREE.MathUtils.lerp(1.1, 1.9, nightFactor);
    rim.color.set(nightFactor > 0.5 ? 0x83adbb : 0xfff2da);
    warm.intensity = nightFactor * 7;
    scene.environmentIntensity = THREE.MathUtils.lerp(0.30, 0.13, nightFactor);
    for (const material of house.windowMaterials) material.emissiveIntensity = THREE.MathUtils.lerp(0.45, 2.0, nightFactor);
    if (tween) {
      const raw = Math.min((now - tween.start) / 1300, 1), t = raw * raw * (3 - 2 * raw);
      camera.position.lerpVectors(tween.from, tween.to, t); controls.target.lerpVectors(tween.fromTarget, tween.toTarget, t);
      if (raw === 1) tween = null;
    }
    const speed = state.mode === 'walk' ? 0.6 : 0;
    if (speed) movingTime += dt;
    house.update(movingTime, speed);
    if (speed || Math.abs(house.group.position.y) > 0.0001) renderer.shadowMap.needsUpdate = true;
    if (state.petals) {
      for (let i = 0; i < petalCount; i++) {
        const p = petalData[i], t = simulationTime;
        transform.position.set(p.x + Math.sin(t * 0.24 + p.phase) * 0.5, (p.y - t * p.speed % 8 + 8) % 8, p.z + Math.cos(t * 0.2 + p.phase) * 0.5);
        transform.rotation.set(t * 0.7 + p.phase, t * 0.5, t + p.phase);
        transform.scale.set(0.045, 0.008, 0.025); transform.updateMatrix(); petals.setMatrixAt(i, transform.matrix);
      }
      petals.instanceMatrix.needsUpdate = true;
    }
    controls.update(dt); renderer.render(scene, camera);
  }
  renderer.render(scene, camera);
  document.body.dataset.ready = 'true';
  $('#loading').hidden = true;
  frame = requestAnimationFrame(render);
}
init().catch(fail);
