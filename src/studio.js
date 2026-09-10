import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** A continuous photographic studio, rather than a floating display plinth. */
export function createStudio(renderer, scene, camera) {
  const day = new THREE.Color(0xeee5d9), night = new THREE.Color(0x202b32);
  scene.background = day.clone();
  scene.fog = new THREE.Fog(day, 32, 85);
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  room.dispose(); pmrem.dispose();
  const hemi = new THREE.HemisphereLight(0xfff2dc, 0x827566, 0.95);
  const key = new THREE.DirectionalLight(0xffe6c2, 3.0);
  key.position.set(-7, 9, 5); key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 11, bottom: -7, near: 0.5, far: 35 });
  key.shadow.normalBias = 0.004; key.shadow.bias = -0.00003;
  key.shadow.radius = 6; key.shadow.blurSamples = 8;
  const fill = new THREE.DirectionalLight(0xffefe0, 0.6); fill.position.set(7, 5, 4);
  const rim = new THREE.DirectionalLight(0xffefd1, 1.7); rim.position.set(3, 9, -5);
  scene.add(hemi, key, fill, rim);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xe4d6c4, roughness: 0.94 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), floorMaterial);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.025; floor.receiveShadow = true; scene.add(floor);
  let seed = 771;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  const rockMapCanvas = document.createElement('canvas'); rockMapCanvas.width = rockMapCanvas.height = 128;
  const ctx = rockMapCanvas.getContext('2d');
  const pixels = ctx.createImageData(128, 128);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const s = 125 + random() * 85;
    pixels.data[i] = s; pixels.data[i + 1] = s * 0.97; pixels.data[i + 2] = s * 0.88; pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const rockMap = new THREE.CanvasTexture(rockMapCanvas); rockMap.colorSpace = THREE.SRGBColorSpace;
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0xa69e8a, roughness: 0.97, map: rockMap, bumpMap: rockMap, bumpScale: 0.027 });
  const stones = [[-3.0,0.23,1.65,.48],[-3.65,.14,1.3,.26],[-3.25,.1,2.08,.21],[3.05,.17,1.75,.38],[3.58,.1,1.53,.23],[2.9,.08,2.18,.17],[-2.6,.12,-1.7,.28],[2.7,.2,-1.8,.4]];
  stones.forEach(([x,y,z,s], index) => {
    const geometry = new THREE.IcosahedronGeometry(1, 3), pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const warp = 1 + .11 * Math.sin(vx * 9 + index) * Math.cos(vz * 7 + vy * 5);
      pos.setXYZ(i,vx*warp,vy*warp,vz*warp);
    }
    geometry.computeVertexNormals();
    const stone = new THREE.Mesh(geometry, rockMaterial); stone.position.set(x,y,z);
    stone.scale.set(s*1.3,s*.7,s); stone.rotation.y = random()*6;
    stone.castShadow = stone.receiveShadow = true; scene.add(stone);
  });
  const moss = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x728136, roughness: 1 }), 800);
  const d = new THREE.Object3D();
  for (let i=0;i<800;i++) {
    const p=stones[i%stones.length], a=random()*Math.PI*2, r=p[3]*(.6+random());
    d.position.set(p[0]+Math.cos(a)*r,.012+random()*.07,p[2]+Math.sin(a)*r);
    d.scale.set(.035+random()*.06,.022+random()*.055,.035+random()*.06); d.rotation.set(random(),random()*6,random()); d.updateMatrix();
    moss.setMatrixAt(i,d.matrix); moss.setColorAt(i,new THREE.Color().setHSL(.19+random()*.08,.35,.3+random()*.15));
  }
  moss.receiveShadow=true; scene.add(moss);
  const glowLights = [[-2.5,2.5,2.1],[2.4,2.6,2.1],[-2.2,4.35,2],[2.1,4.35,2]].map(p => {
    const light = new THREE.PointLight(0xffb34e, .3, 2.4, 2); light.position.set(...p); scene.add(light); return light;
  });
  const target = new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:Math.min(2,renderer.capabilities.maxSamples)});
  const composer = new EffectComposer(renderer,target);
  composer.addPass(new RenderPass(scene,camera));
  const ao = new GTAOPass(scene,camera,512,512);
  ao.updateGtaoMaterial({ radius: .25, thickness: .7, distanceExponent: 2, distanceFallOff: .75, scale: 1, samples: 8, screenSpaceRadius: false });
  ao.updatePdMaterial({ samples: 8, radius: 4, rings: 2 }); ao.blendIntensity = .75;
  composer.addPass(ao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(512,512),.13,.35,1.3); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  renderer.info.autoReset=false;
  return {
    resize(w,h) { composer.setSize(w,h); ao.setSize(Math.round(w*.65),Math.round(h*.65)); },
    setNight(t) {
      scene.background.copy(day).lerp(night,t); scene.fog.color.copy(scene.background);
      floorMaterial.color.set(0xe4d6c4).lerp(new THREE.Color(0x293942),t);
      hemi.intensity=THREE.MathUtils.lerp(.32,.26,t); key.intensity=THREE.MathUtils.lerp(3.5,.25,t);
      key.color.set(0xffdda9).lerp(new THREE.Color(0x99bfd9),t);
      fill.intensity=THREE.MathUtils.lerp(.12,.12,t); rim.intensity=THREE.MathUtils.lerp(1.5,1.1,t);
      rim.color.set(0xffefd1).lerp(new THREE.Color(0x98bed8),t);
      scene.environmentIntensity=THREE.MathUtils.lerp(.35,.20,t);
      glowLights.forEach(light => { light.intensity=THREE.MathUtils.lerp(.3,3.2,t); });
      bloom.strength=THREE.MathUtils.lerp(.13,.25,t);
    },
    render(dt) { renderer.info.reset(); composer.render(dt); }
  };
}
