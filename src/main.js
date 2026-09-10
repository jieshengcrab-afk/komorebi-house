import './atelier.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStudio } from './studio.js';
import { initialState, transition } from './state.js';
import { createPetalField, createLocomotion } from './motion.js';

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
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); fail(new Error('WebGL context lost')); });
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(28, 1, 0.1, 150);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.minDistance = 7;
  controls.maxDistance = 65;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI / 2 - 0.035;
  controls.autoRotateSpeed = 0.45;
  controls.zoomSpeed = 0.65;
  controls.rotateSpeed = 0.55;
  const studio = createStudio(renderer, scene, camera);
  let needsRender = true;
  const { createHouse } = await import('./house.js');
  house = createHouse(); scene.add(house.group);
  let seed = 73;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  // Graceful falling sakura: petals originate in the blossom canopy and drift
  // down under gravity with flutter, tumble and recycling (see src/motion.js).
  const petalCount = matchMedia('(max-width:700px)').matches ? 70 : 130;
  const petalField = createPetalField(THREE, { count: petalCount, seed: 4177 });
  scene.add(petalField.mesh);
  // A few petals rest on the plinth as permanent ground detail (static).
  const restGeo = new THREE.PlaneGeometry(1, 1.3);
  const restMat = new THREE.MeshStandardMaterial({ color: 0xecb3c2, roughness: 0.85, side: THREE.DoubleSide });
  const fallen = new THREE.InstancedMesh(restGeo, restMat, 60);
  const restDummy = new THREE.Object3D();
  for (let i = 0; i < 60; i++) {
    const a = random() * Math.PI * 2, r = 2.7 + random() * 2.7;
    restDummy.position.set(Math.cos(a) * r, 0.011, Math.sin(a) * r);
    restDummy.rotation.set(-Math.PI / 2, 0, random() * Math.PI);
    restDummy.scale.setScalar(0.05 + random() * 0.03);
    restDummy.updateMatrix(); fallen.setMatrixAt(i, restDummy.matrix);
  }
  fallen.name = 'fallen-sakura-petals'; scene.add(fallen);
  // Locomotion integrator: eased velocity + honest travelled distance so the
  // wheels roll in lock-step with ground travel (no slide, smooth start/stop).
  const locomotion = createLocomotion();
  let tween = null;
  const presets = {
    home: { position: [-5.5, 6.3, 22.5], target: [-0.35, 3.8, 0], caption: '01 / 全景 · THE LITTLE WANDERER' },
    roof: { position: [-4.8, 9.3, 13.5], target: [0, 6.05, 0], caption: '02 / 櫻花屋頂 · A ROOFTOP IN BLOOM' },
    terrace: { position: [-4.8, 5.9, 14.5], target: [-0.15, 4.4, 0.9], caption: '03 / 午後露台 · SLOW AFTERNOONS' },
    chassis: { position: [-5.0, 2.7, 12.5], target: [0, 1.1, 0], caption: '04 / 旅行底盤 · MADE TO WANDER' },
    back: { position: [8, 7, -22], target: [-0.35, 3.8, 0], caption: '05 / 小屋背面 · THE OTHER SIDE OF HOME' }
  };
  function goToView(name, immediate = false) {
    state = transition(state, 'view', name);
    const preset = presets[state.view];
    const position = new THREE.Vector3(...preset.position);
    const target = new THREE.Vector3(...preset.target);
    if (container.clientWidth <= 900) {
      const widthToFit = ['home','back'].includes(state.view) ? 7.5 : 5.4;
      const fitDistance = widthToFit / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * .82);
      const heightToFit = ['home','back'].includes(state.view) ? 9.6 : 5.6;
      const heightDistance = heightToFit / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * .9);
      position.sub(target).setLength(Math.max(position.length(), fitDistance, heightDistance)).add(target);
    }
    tween = { start: performance.now(), from: camera.position.clone(), to: position, fromTarget: controls.target.clone(), toTarget: target };
    if (immediate || reducedMotion) { camera.position.copy(position); controls.target.copy(target); tween = null; }
    $('#scene-caption').textContent = preset.caption;
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === state.view)));
    controls.update();
  }
  function updateUI() {
    needsRender = true;
    renderer.shadowMap.needsUpdate = true;
    document.body.classList.toggle('night', state.night);
    for (const action of ['night', 'petals', 'orbit']) $('#' + action).setAttribute('aria-pressed', String(state[action]));
    document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    $('#mode-status').textContent = { stand: '慢下來，也是一種前進。', walk: '讓風景，慢慢走進日常。', rest: '晚安，把星光留在窗邊。' }[state.mode];
    $('#time-label').textContent = state.night ? '春夜 · 20:30' : '春日 · 16:30';
    controls.autoRotate = state.orbit;
    petalField.mesh.visible = state.petals;
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
      needsRender = true;
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
    needsRender = true;
    const width = container.clientWidth, height = container.clientHeight;
    camera.aspect = width / height;
    if (width > 900) camera.setViewOffset(width,height,-width*.17,0,width,height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix(); renderer.setSize(width, height); studio.resize(width,height);
  };
  const updateControlSpace = () => {
    document.documentElement.style.setProperty('--controls-height', `${Math.ceil(document.querySelector('.controls').getBoundingClientRect().height)}px`);
  };
  new ResizeObserver(updateControlSpace).observe(document.querySelector('.controls'));
  updateControlSpace();
  new ResizeObserver(() => { resize(); goToView(state.view, true); }).observe(container); resize(); goToView('home', true); updateUI();

  let nightFactor = 0, lastTime = performance.now(), simulationTime = 0, movingTime = 0;
  let frames = 0, accumulatedTime = 0, measuredFps = 0;
  let meshes = 0; house.group.traverse(object => { if (object.isMesh) meshes++; });
  window.__gallery = {
    getDiagnostics: () => ({ revision: 'reference-rebuild-2', materialRevision: 'pbr-detail-3', state: { ...state }, meshes, triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, fps: Math.round(measuredFps), camera: camera.position.toArray(), target: controls.target.toArray(), nightFactor, wheels: house.wheels.map(wheel => wheel.rotation.toArray()), locomotion: { velocity: +locomotion.state.velocity.toFixed(4), distance: +locomotion.state.distance.toFixed(4), roll: +locomotion.state.roll.toFixed(4) }, petals: petalField.diagnostics(), webgl: renderer.capabilities.isWebGL2 ? 2 : 'unknown', canvasSize: [renderer.domElement.width, renderer.domElement.height] })
  };
  function render(now) {
    frame = requestAnimationFrame(render);
    const elapsed = Math.max(0, (now - lastTime) / 1000);
    const dt = Math.min(elapsed, 0.05); lastTime = now;
    if (document.hidden) return;
    simulationTime += dt; frames++; accumulatedTime += elapsed;
    if (accumulatedTime > 1) { measuredFps = frames / accumulatedTime; frames = 0; accumulatedTime = 0; }
    const smooth = 1 - Math.exp(-elapsed * 2.3);
    nightFactor += ((state.night ? 1 : 0) - nightFactor) * (reducedMotion ? 1 : smooth);
    studio.setNight(nightFactor);
    for (const material of house.windowMaterials) material.emissiveIntensity = THREE.MathUtils.lerp(0.9, 2.4, nightFactor);
    if (tween) {
      const raw = Math.min((now - tween.start) / 1300, 1), t = raw * raw * (3 - 2 * raw);
      camera.position.lerpVectors(tween.from, tween.to, t); controls.target.lerpVectors(tween.fromTarget, tween.toTarget, t);
      if (raw === 1) tween = null;
    }
    const targetSpeed = state.mode === 'walk' ? 0.6 : 0;
    // Integrate bounded wall time in small steps: slow GPUs must not stretch
    // a short braking transition into tens of seconds.
    let remaining = Math.min(elapsed, 2);
    let loco = locomotion.state;
    while (remaining > 0) {
      const step = Math.min(remaining, 0.05);
      loco = locomotion.update(step, targetSpeed, reducedMotion);
      remaining -= step;
    }
    if (loco.velocity > 2e-3) movingTime += dt;
    // Feed the house the eased velocity and honestly-integrated travel distance
    // so wheels roll in lock-step (no slide) and start/stop is smooth.
    house.update(loco.movingTime, loco.velocity, loco.distance);
    const moving = loco.velocity > 2e-3;
    if (moving || Math.abs(house.group.position.y) > 0.0001) renderer.shadowMap.needsUpdate = true;
    if (state.petals && !reducedMotion) {
      petalField.update(dt);
    }
    const cameraChanged = controls.update(dt);
    if (needsRender || cameraChanged || tween || state.orbit || (state.petals && !reducedMotion) || moving || Math.abs(nightFactor-(state.night?1:0))>.001) {
      studio.render(dt); needsRender = false;
    }
  }
  studio.setNight(0); studio.render(0);
  document.body.dataset.ready = 'true';
  $('#loading').hidden = true;
  frame = requestAnimationFrame(render);
}
init().catch(fail);
