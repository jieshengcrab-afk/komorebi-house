import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { enhanceMaterials, cloneEnhanced } from './materials.js';

const PI = Math.PI;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** A crafted 360° miniature house, front facing +Z and ridge running X. */
export function createHouse() {
  const group = new THREE.Group();
  group.name = 'wandering-house';

  const mat = {
    walnut: new THREE.MeshStandardMaterial({ color: 0x674128, roughness: .65, metalness: .02 }),
    walnutDark: new THREE.MeshStandardMaterial({ color: 0x43271a, roughness: .74 }),
    walnutEdge: new THREE.MeshStandardMaterial({ color: 0x8a5b35, roughness: .65 }),
    plaster: new THREE.MeshStandardMaterial({ color: 0xcbbd9e, roughness: .94 }),
    mortar: new THREE.MeshStandardMaterial({ color: 0x6d6254, roughness: 1 }),
    brick: new THREE.MeshStandardMaterial({ color: 0xc7b799, roughness: .92 }),
    brickLight: new THREE.MeshStandardMaterial({ color: 0xdfd0af, roughness: .93 }),
    brickWarm: new THREE.MeshStandardMaterial({ color: 0xaa977a, roughness: .94 }),
    slate: new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: .83, metalness: .05, side: THREE.DoubleSide }),
    slateAlt: new THREE.MeshStandardMaterial({ color: 0x42454b, roughness: .87, side: THREE.DoubleSide }),
    slateEdge: new THREE.MeshStandardMaterial({ color: 0x171b20, roughness: .77 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0x72502c, roughness: .38, metalness: .72 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb88a3b, roughness: .28, metalness: .78 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x262729, roughness: .42, metalness: .68 }),
    ironEdge: new THREE.MeshStandardMaterial({ color: 0x111315, roughness: .38, metalness: .75 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xeadbb9, roughness: .88, side: THREE.DoubleSide }),
    bamboo: new THREE.MeshStandardMaterial({ color: 0xc69d5a, roughness: .75 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xffbd55, emissive: 0xff7a18, emissiveIntensity: 1.25, roughness: .22 }),
    glassSoft: new THREE.MeshStandardMaterial({ color: 0xffdda0, emissive: 0xff962f, emissiveIntensity: .72, roughness: .32 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x44261e, roughness: .95 }),
    barkLight: new THREE.MeshStandardMaterial({ color: 0x67402c, roughness: .9 }),
    pink: new THREE.MeshStandardMaterial({ color: 0xf3a9bd, roughness: .72, side: THREE.DoubleSide }),
    palePink: new THREE.MeshStandardMaterial({ color: 0xffcfda, roughness: .7, side: THREE.DoubleSide }),
    flowerCenter: new THREE.MeshStandardMaterial({ color: 0xf2c65e, roughness: .65 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3e592c, roughness: .9, side: THREE.DoubleSide }),
    leafLight: new THREE.MeshStandardMaterial({ color: 0x718247, roughness: .9, side: THREE.DoubleSide }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0x8f5540, roughness: .88 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x777268, roughness: .96 }),
  };
  const windowMaterials = [mat.glass, mat.glassSoft];

  // Physically-based procedural surface detail (grain, tarnish, chips, speckle).
  // Implemented as object/world-space triplanar GLSL in src/materials.js via
  // onBeforeCompile: no CanvasTexture, no `document`, texel-consistent across
  // merged and instanced/scaled geometry, and safe under headless Node tests.
  // Must run before any material is cloned below so clones inherit the shader.
  enhanceMaterials(mat);

  const unitBox = new THREE.BoxGeometry(1,1,1);
  const roundedBox = new RoundedBoxGeometry(1,1,1,2,.09);
  const unitCylinder = new THREE.CylinderGeometry(1,1,1,12);
  const dummy = new THREE.Object3D();
  let seed = 58491;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  function mesh(parent, geometry, material, name, pos=[0,0,0], scale=[1,1,1], rot=null) {
    const o = new THREE.Mesh(geometry, material); o.name=name; o.position.set(...pos); o.scale.set(...scale);
    if (rot) o.rotation.set(...rot); o.castShadow=o.receiveShadow=true; parent.add(o); return o;
  }
  function box(parent,name,size,pos,material=mat.walnut,rot=null,rounded=false){ return mesh(parent,rounded?roundedBox:unitBox,material,name,pos,size,rot); }
  function cylinder(parent,name,rt,rb,h,pos,material=mat.walnut,segments=12,rot=null){ return mesh(parent,new THREE.CylinderGeometry(rt,rb,h,segments),material,name,pos,[1,1,1],rot); }
  function groupNamed(parent,name){ const g=new THREE.Group(); g.name=name; parent.add(g); return g; }
  function between(parent,name,a,b,r,material=mat.walnut,segments=10){
    const av=new THREE.Vector3(...a), bv=new THREE.Vector3(...b), d=bv.clone().sub(av);
    const o=mesh(parent,new THREE.CylinderGeometry(r*.82,r,d.length(),segments),material,name);
    o.position.copy(av).add(bv).multiplyScalar(.5); o.quaternion.setFromUnitVectors(Y_AXIS,d.normalize()); return o;
  }
  function torus(parent,name,major,tube,pos,material,rot=[0,0,0],radial=8,tubular=24,arc=PI*2){ return mesh(parent,new THREE.TorusGeometry(major,tube,radial,tubular,arc),material,name,pos,[1,1,1],rot); }

  // ---------- rolling bronze chassis ----------
  const under = groupNamed(group,'bronze-undercarriage');
  box(under,'deep-oak-chassis',[4.65,.34,2.82],[0,1.07,0],mat.walnutDark, null,true);
  box(under,'front-bronze-axle-bed',[4.05,.16,.20],[0,.74,1.04],mat.bronze,null,true);
  box(under,'rear-bronze-axle-bed',[4.05,.16,.20],[0,.74,-1.04],mat.bronze,null,true);
  for (const z of [-1.04,1.04]) {
    cylinder(under,'axle',.105,.105,4.58,[0,.48,z],mat.iron,16,[0,0,PI/2]);
    for (const x of [-1.55,1.55]) {
      for (let l=0;l<2;l++) {
        const spring=box(under,'leaf-spring',[.78,.055,.10],[x,.74+l*.08,z],mat.bronze,[0,0,(x<0?-1:1)*(.08+l*.025)],true);
        spring.scale.x *= 1-l*.1;
      }
      cylinder(under,'axle-box',.16,.16,.29,[x,.49,z],mat.brass,16,[0,0,PI/2]);
      box(under,'suspension-hanger',[.12,.43,.13],[x,.79,z],mat.iron,null,true);
    }
  }
  const wheels=[];
  for (const x of [-1.82,1.82]) for (const z of [-1.12,1.12]) {
    // Wheel axis MUST align with the axle (world X). Any steer (rotation.y) here
    // would make the spin axis (X) diverge from the disc normal and the tire
    // would visibly precess/wobble while rolling. Keep it dead-on the axle.
    const w=groupNamed(under,'wheel'); w.position.set(x,.48,z);
    cylinder(w,'heavy-iron-tire',.49,.49,.27,[0,0,0],mat.ironEdge,28,[0,0,PI/2]);
    cylinder(w,'bronze-wheel-face',.39,.39,.285,[0,0,0],mat.bronze,24,[0,0,PI/2]);
    torus(w,'raised-metal-rim',.345,.035,[x>0?.15:-.15,0,0],mat.brass,[0,PI/2,0],7,28);
    cylinder(w,'wheel-hub',.115,.145,.36,[0,0,0],mat.iron,16,[0,0,PI/2]);
    for(let i=0;i<8;i++){
      const a=i*PI/4, side=x>0?.19:-.19;
      cylinder(w,'wheel-bolt',.026,.026,.035,[side,Math.cos(a)*.27,Math.sin(a)*.27],mat.brass,8,[0,0,PI/2]);
      const spoke=box(w,'wheel-spoke',[.03,.55,.055],[0,0,0],mat.walnutDark,[a,0,0],true); spoke.rotation.x=a;
    }
    wheels.push(w);
  }

  // ---------- broad ground storey and deep porch ----------
  const ground=groupNamed(group,'ground-floor');
  box(ground,'ground-mortar-shell',[5.02,2.30,2.82],[0,2.38,-.18],mat.mortar,null,true);
  box(ground,'ground-plaster-infill',[4.88,2.16,2.70],[0,2.39,-.18],mat.plaster,null,true);
  box(ground,'massive-base-sill',[5.42,.33,3.16],[0,1.22,-.07],mat.walnutDark,null,true);
  box(ground,'first-floor-cornice',[5.36,.25,3.18],[0,3.58,-.05],mat.walnutDark,null,true);
  const porch=groupNamed(ground,'front-porch');
  box(porch,'front-porch-deck',[5.40,.18,1.15],[0,1.32,1.38],mat.walnut,null,true);
  box(porch,'front-porch-fascia',[5.48,.34,.18],[0,1.17,1.91],mat.walnutDark,null,true);
  for(const x of [-2.55,-1.55,-.52,.52,1.55,2.55]) box(porch,'porch-joist',[.10,.28,1.12],[x,1.13,1.38],mat.walnutEdge,null,true);

  const joinery=groupNamed(group,'carved-timber-joinery');
  const frameSide=(z,front=true)=>{
    box(joinery,'timber-sill',[5.18,.15,.14],[0,1.36,z],mat.walnutDark,null,true);
    box(joinery,'timber-plate',[5.18,.16,.14],[0,3.47,z],mat.walnutDark,null,true);
    for(const x of [-2.48,-1.25,-.3,.65,1.92,2.48]) box(joinery,'timber-post',[.15,2.18,.15],[x,2.40,z],mat.walnut,null,true);
    for(const [x,s] of [[-1.86,1],[-.62,-1],[.62,1],[1.86,-1]]) box(joinery,'diagonal-timber-brace',[1.02,.12,.14],[x,3.12,z+(front?.015:-.015)],mat.walnut,[0,0,s*.62],true);
  };
  frameSide(1.40,true); frameSide(-1.755,false);
  for(const x of [-2.63,2.63]){ box(joinery,'side-timber-post',[.14,2.18,.14],[x,2.40,-.18],mat.walnut,null,true); box(joinery,'side-cross-beam',[.14,.14,2.75],[x,2.49,-.18],mat.walnut,null,true); }
  for(const [x,y,z] of [[-2.48,1.42,1.34],[-1.25,3.39,1.34],[0,1.42,1.34],[1.25,3.39,1.34],[2.48,1.42,1.34],[-2.48,3.39,-1.69],[2.48,3.39,-1.69],[0,3.39,-1.69]]) cylinder(joinery,'joinery-bolt',.038,.038,.035,[x,y,z],mat.iron,8,[PI/2,0,0]);

  // Individual cream masonry bricks on visible panels (thin dark shell is grout).
  const brickGeo=new RoundedBoxGeometry(.42,.19,.065,1,.018);
  const brickPositions=[];
  const blocked=()=>false; // Windows sit in front of continuous brick panels.
  for(let row=0;row<10;row++) for(let col=0;col<12;col++){
    const x=-2.30+col*.42+(row%2)*.205, y=1.51+row*.195;
    if(x<2.42&&!blocked(x,y)) brickPositions.push([x,y,1.335,(row+col)%3]);
  }
  // MeshStandardMaterial.clone() drops onBeforeCompile/customProgramCacheKey, so
  // a raw clone here would render flat, un-enhanced masonry. cloneEnhanced()
  // re-attaches the MASONRY procedural detail from the surviving userData.
  const masonryMaterial = cloneEnhanced(mat.brickLight); masonryMaterial.color.set(0xffffff);
  const bricks=new THREE.InstancedMesh(brickGeo,masonryMaterial,brickPositions.length); bricks.name='individual-masonry-bricks';
  brickPositions.forEach((p,i)=>{ dummy.position.set(p[0],p[1],p[2]); dummy.rotation.set(0,0,(random()-.5)*.025); dummy.scale.set(.92+random()*.12,.9+random()*.1,1); dummy.updateMatrix(); bricks.setMatrixAt(i,dummy.matrix); bricks.setColorAt(i,new THREE.Color([0xc5b596,0xd7c8a9,0xab997c][p[3]])); }); ground.add(bricks);
  const wrap = new THREE.InstancedMesh(brickGeo,masonryMaterial,550); wrap.name='side-and-rear-masonry'; let wi=0;
  for(const [cx,cy,cz,cols,rows,angle] of [[0,1.51,-1.685,12,10,PI],[-2.575,1.51,-.18,6,10,-PI/2],[2.575,1.51,-.18,6,10,PI/2],[.31,3.96,-1.67,10,11,PI],[-1.975,3.96,-.5,5,11,-PI/2],[2.595,3.96,-.5,5,11,PI/2]]) {
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++) {
      const along=(c-(cols-1)/2)*.42+(r%2)*.10;
      dummy.position.set(cx+Math.cos(angle)*along,cy+r*.195,cz-Math.sin(angle)*along);
      dummy.rotation.set(0,angle,0);dummy.scale.set(.97,.96,1);dummy.updateMatrix();wrap.setMatrixAt(wi,dummy.matrix);
      wrap.setColorAt(wi++,new THREE.Color().setHSL(.10,.17,.65+random()*.16));
    }
  }
  wrap.count=wi; group.add(wrap);

  function archedWindow(parent,name,x,y,z,w,h,facing='front',glassMat=mat.glass){
    const g=groupNamed(parent,name); g.position.set(x,y,z); if(facing==='back')g.rotation.y=PI; else if(facing==='left')g.rotation.y=-PI/2; else if(facing==='right')g.rotation.y=PI/2;
    const shape=new THREE.Shape(), spring=h-w/2; shape.moveTo(-w/2,-h/2); shape.lineTo(w/2,-h/2); shape.lineTo(w/2,spring-h/2); shape.absarc(0,spring-h/2,w/2,0,PI,false); shape.closePath();
    mesh(g,new THREE.ShapeGeometry(shape,18),glassMat,name.startsWith('upper-fanlight-')?'upper-arched-fanlight-glass':'arched-window-glass',[0,0,0]);
    box(g,'window-sill',[w+.18,.08,.15],[0,-h/2,.045],mat.walnutDark,null,true);
    for(const sx of [-1,1]) box(g,'window-jamb',[.065,spring,.09],[sx*w/2,-w/4,.035],mat.walnutDark,null,true);
    torus(g,'arched-window-frame',w/2,.045,[0,spring-h/2,.035],mat.walnutDark,[0,0,0],6,20,PI);
    box(g,'vertical-mullion',[.045,h*.86,.055],[0,-.04,.055],mat.walnutDark,null,true);
    box(g,'horizontal-mullion',[w*.88,.045,.055],[0,-.12,.055],mat.walnutDark,null,true);
    box(g,'fanlight-transom',[w*.90,.043,.055],[0,spring-h/2,.06],mat.walnutDark,null,true);
    for(const side of [-1,1]) between(g,'fanlight-ray',[0,spring-h/2,.07],[side*w*.33,spring-h/2+w*.30,.07],.020,mat.walnutDark,7);
    return g;
  }
  archedWindow(ground,'ground-right-arched-window',1.26,2.42,1.425,.76,1.30);
  archedWindow(ground,'ground-left-arched-window',-1.81,2.39,1.425,.61,1.12);
  archedWindow(ground,'ground-rear-arched-window',-1.18,2.35,-1.74,.72,1.22,'back',mat.glassSoft);
  archedWindow(ground,'ground-right-side-window',2.64,2.35,.36,.68,1.18,'right',mat.glassSoft);
  // Door left of centre, center window and a real bamboo roller screen.
  box(ground,'front-door',[.72,1.55,.10],[-.78,2.27,1.36],mat.walnut,null,true);
  for(const x of [-1.19,-.37]) box(ground,'carved-door-jamb',[.12,1.77,.16],[x,2.28,1.39],mat.walnutDark,null,true);
  box(ground,'door-lintel',[.94,.13,.16],[-.78,3.14,1.39],mat.walnutDark,null,true);
  cylinder(ground,'brass-door-knob',.045,.045,.08,[-.53,2.27,1.47],mat.brass,10,[PI/2,0,0]);
  const blind=groupNamed(ground,'bamboo-roller-blind'); blind.position.set(.13,2.49,1.42);
  box(ground,'center-window-glass',[.72,.95,.035],[.13,2.27,1.415],mat.glassSoft);
  for(let i=0;i<14;i++) cylinder(blind,'bamboo-slat',.021,.021,.78,[0,.43-i*.032,.04+i*.023],mat.bamboo,7,[0,0,PI/2]);
  cylinder(blind,'blind-roll',.075,.075,.86,[0,.47,0],mat.bamboo,12,[0,0,PI/2]);
  for(const x of [-.31,.31]) between(blind,'blind-cord',[x,-.41,.045],[x,.47,.045],.008,mat.walnutDark,6);

  // Bench and doorstep still-life.
  const tiny=groupNamed(ground,'tiny-porch-furnishings');
  box(tiny,'tiny-bench-seat',[.78,.10,.30],[.48,1.72,1.73],mat.walnut,null,true);
  for(const x of [.18,.78]) box(tiny,'tiny-bench-leg',[.07,.36,.07],[x,1.53,1.73],mat.walnutDark,null,true);
  box(tiny,'tiny-bench-back',[.76,.34,.07],[.48,1.96,1.84],mat.walnutDark,null,true);
  for(const x of [-.18,1.04]) cylinder(tiny,'porch-pot',.15,.11,.27,[x,1.53,1.72],mat.terracotta,12);

  // ---------- recessed upper room and broad front terrace ----------
  const terrace=groupNamed(group,'second-floor-terrace');
  box(terrace,'terrace-deck',[5.38,.19,3.35],[0,3.69,.02],mat.walnut,null,true);
  box(terrace,'deep-front-balcony',[5.55,.17,1.18],[0,3.72,1.43],mat.walnutEdge,null,true);
  const upper=groupNamed(group,'upper-floor');
  box(upper,'upper-mortar-shell',[4.45,2.33,2.22],[.31,4.90,-.50],mat.mortar,null,true);
  box(upper,'upper-plaster-infill',[4.30,2.18,2.08],[.31,4.89,-.50],mat.plaster,null,true);
  // Upper front z≈0.61 gives terrace depth to z≈1.9.
  const uz=.70;
  for(const x of [-1.83,-1.08,.02,1.03,2.48]) box(upper,'upper-timber-post',[.14,2.28,.15],[x,4.90,uz],mat.walnut,null,true);
  const upperBricks = new THREE.InstancedMesh(brickGeo,masonryMaterial,120); upperBricks.name='upper-individual-masonry';
  let ubi=0;
  for(let row=0;row<11;row++) for(let col=0;col<10;col++) {
    const x=-1.66+col*.418+(row%2)*.19,y=3.96+row*.19;
    if(x>2.36 || (y>5.16 && (Math.abs(x+.72)<.4 || Math.abs(x-.48)<.4 || Math.abs(x-1.63)<.43))) continue;
    dummy.position.set(x,y,.658); dummy.rotation.set(0,0,0); dummy.scale.set(.97,.97,1); dummy.updateMatrix();
    upperBricks.setMatrixAt(ubi,dummy.matrix); upperBricks.setColorAt(ubi++,new THREE.Color().setHSL(.10,.17,.69+random()*.14));
  }
  upperBricks.count=ubi; upper.add(upperBricks);
  box(upper,'upper-bottom-beam',[4.48,.15,.16],[.31,3.80,uz],mat.walnutDark,null,true);
  box(upper,'upper-top-beam',[4.48,.17,.16],[.31,6.00,uz],mat.walnutDark,null,true);
  box(upper,'upper-middle-beam',[4.48,.12,.14],[.31,5.18,uz],mat.walnut,null,true);
  for(const [x,s] of [[-1.28,1],[-.17,-1],[.93,1],[1.98,-1]]) box(upper,'upper-diagonal-brace',[.85,.11,.14],[x,5.68,uz+.02],mat.walnut,[0,0,s*.68],true);
  const fanlights=groupNamed(upper,'upper-fanlight-windows');
  archedWindow(fanlights,'upper-fanlight-left',-.72,5.58,uz+.09,.52,.73,'front',mat.glassSoft);
  archedWindow(fanlights,'upper-fanlight-center',.48,5.58,uz+.09,.54,.75,'front',mat.glass);
  archedWindow(fanlights,'upper-fanlight-right',1.63,5.58,uz+.09,.58,.79,'front',mat.glass);
  archedWindow(upper,'upper-rear-window',.4,5.05,-1.735,.62,1.08,'back',mat.glassSoft);
  archedWindow(upper,'upper-right-side-window',2.65,4.95,-.50,.65,1.10,'right',mat.glassSoft);
  for(const x of [-1.83,-.7,1.4,2.48]) box(upper,'rear-timber-post',[.14,2.26,.14],[x,4.9,-1.76],mat.walnut,null,true);
  for(const y of [3.82,5.17,6.00]) box(upper,'rear-timber-beam',[4.48,.13,.14],[.31,y,-1.76],mat.walnutDark,null,true);

  const rail=groupNamed(terrace,'balcony-railings');
  for(const z of [1.91,-1.58]){
    box(rail,'balcony-top-rail',[5.32,.10,.11],[0,4.39,z],mat.walnutDark,null,true);
    box(rail,'balcony-mid-rail',[5.32,.075,.09],[0,4.04,z],mat.walnut,null,true);
    for(let x=-2.55;x<=2.56;x+=.32) cylinder(rail,'turned-baluster',.028,.045,.64,[x,4.04,z],mat.walnut,8);
  }
  for(const x of [-2.64,2.64]){
    box(rail,'side-balcony-top-rail',[.10,.10,3.38],[x,4.39,.16],mat.walnutDark,null,true);
    for(let z=-1.46;z<=1.74;z+=.34)cylinder(rail,'turned-baluster',.028,.045,.64,[x,4.04,z],mat.walnut,8);
    cylinder(rail,'brass-roof-finial',.035,.075,.22,[x,4.52,1.91],mat.brass,10);
    mesh(rail,new THREE.SphereGeometry(.075,10,7),mat.brass,'brass-roof-finial',[x,4.66,1.91]);
  }

  // Two low, ribbed cream parasols beneath the upper fanlights.
  const umbrellas=groupNamed(terrace,'cafe-umbrellas');
  function umbrella(x){
    const u=groupNamed(umbrellas,'ribbed-cream-umbrella'); u.position.set(x,4.91,1.15);
    cylinder(u,'umbrella-pole',.025,.025,1.28,[0,-.40,0],mat.brass,8);
    mesh(u,new THREE.ConeGeometry(.66,.25,12,1,true),mat.cream,'umbrella-fabric-canopy',[0,-.11,0]);
    for(let i=0;i<12;i++){
      between(u,'umbrella-rib',[0,.015,0],[Math.cos(i*PI/6)*.61,-.23,Math.sin(i*PI/6)*.61],.009,mat.brass,6);
    }
    cylinder(u,'umbrella-cap',.035,.06,.10,[0,.05,0],mat.brass,10);
    cylinder(u,'cafe-table',.38,.38,.07,[0,-.77,0],mat.walnut,20);
  }
  umbrella(-1.18); umbrella(1.35);

  // ---------- left staggered annex and outdoor stair ----------
  const annex=groupNamed(group,'left-annex');
  box(annex,'annex-lower-room',[.72,1.64,1.55],[-2.70,2.35,.37],mat.plaster,null,true);
  box(annex,'annex-timber-post',[.13,1.72,.13],[-3.02,2.38,1.15],mat.walnutDark,null,true);
  const annexRoof=(name,y,z,w,d,h)=>{
    const r=groupNamed(annex,name), angle=Math.atan2(h,d/2), slope=Math.hypot(h,d/2);
    for(const sign of [-1,1]) box(r,'annex-roof-slope',[w,.08,slope],[-2.70,y+h/2,z+sign*d/4],mat.slate,[sign*angle,0,0]);
    box(r,'annex-ridge',[w+.12,.11,.11],[-2.70,y+h,z],mat.slateEdge,[0,0,PI/4]);
    return r;
  };
  annexRoof('lower-left-gabled-roof',3.12,.38,.94,1.80,.58);
  box(annex,'annex-upper-room',[.68,1.65,1.20],[-2.48,5.08,-.26],mat.plaster,null,true);
  annexRoof('upper-left-gabled-roof',5.86,-.25,.90,1.48,.48);
  archedWindow(annex,'annex-upper-window',-2.48,5.12,.40,.44,.85);
  archedWindow(annex,'annex-lower-window',-2.70,2.43,1.205,.43,.89);
  for(const [x,z,y,h] of [[-2.84,.41,5.05,1.7],[-2.13,.41,5.05,1.7],[-3.05,1.22,2.37,1.7],[-2.35,1.22,2.37,1.7]]) box(annex,'annex-oak-post',[.09,h,.10],[x,y,z],mat.walnut,null,true);
  const stairs=groupNamed(group,'exterior-staircase');
  for(let i=0;i<10;i++){
    box(stairs,'stair-tread',[.26,.09,.58],[-4.03+i*.135,.42+i*.1,1.66],mat.walnut,null,true);
    box(stairs,'stair-riser',[.055,.12,.53],[-4.09+i*.135,.35+i*.1,1.66],mat.walnutDark,null,true);
  }
  between(stairs,'stair-stringer',[-4.08,.31,1.48],[-2.78,1.28,1.48],.045,mat.walnutDark,8);
  between(stairs,'stair-stringer',[-4.08,.31,1.87],[-2.78,1.28,1.87],.045,mat.walnutDark,8);

  // ---------- main ridge-X roof and overlapping scalloped slate ----------
  const roof=groupNamed(group,'main-roof'); roof.position.x=.35; roof.scale.x=.90;
  const eaveY=5.98, ridgeY=7.42, halfDepth=1.78, roofAngle=Math.atan2(ridgeY-eaveY,halfDepth), slope=Math.hypot(ridgeY-eaveY,halfDepth);
  const frontSheath=box(roof,'main-roof-sheathing',[5.72,.10,slope],[0,(eaveY+ridgeY)/2,.89],mat.slateEdge,[roofAngle,0,0]);
  const rearSheath=box(roof,'main-roof-sheathing',[5.72,.10,slope],[0,(eaveY+ridgeY)/2,-.89],mat.slateEdge,[-roofAngle,0,0]);
  frontSheath.userData.roofFace='front +Z'; rearSheath.userData.roofFace='rear -Z';
  box(roof,'main-ridge-cap',[5.90,.16,.18],[0,7.44,0],mat.slateEdge,null,true);
  // Scallop: straight top, rounded lower lobe. Shape lies X/Z then pitches around X.
  const tileShape=new THREE.Shape(); tileShape.moveTo(-.17,.20); tileShape.lineTo(.17,.20); tileShape.lineTo(.17,-.06); tileShape.absarc(0,-.06,.17,0,-PI,true); tileShape.lineTo(-.17,.20); tileShape.closePath();
  const tileGeo=new THREE.ExtrudeGeometry(tileShape,{depth:.024,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.008,bevelThickness:.006,curveSegments:5}); tileGeo.rotateX(-PI/2);
  function tiledFace(front){
    const rows=8, cols=17, count=rows*cols;
    const tiles=new THREE.InstancedMesh(tileGeo,front?mat.slate:mat.slateAlt,count); tiles.name=front?'front-scalloped-slate-tiles':'rear-scalloped-slate-tiles';
    let n=0;
    for(let row=0;row<rows;row++) for(let col=0;col<cols;col++){
      const t=row/(rows-1), z=(front?1:-1)*(1.78-t*1.63), y=ridgeY-Math.abs(z)*(ridgeY-eaveY)/halfDepth+.09+row*.010;
      const x=-2.72+col*.34+(row%2)*.17;
      dummy.position.set(x,y,z); dummy.rotation.set(front?roofAngle:-roofAngle,front?0:PI,0); dummy.scale.set(.90+random()*.05,1,1.22); dummy.updateMatrix(); tiles.setMatrixAt(n++,dummy.matrix);
      tiles.setColorAt(n-1,new THREE.Color().setHSL(.61,.055,.61+random()*.24));
    }
    tiles.castShadow=tiles.receiveShadow=true; roof.add(tiles);
  }
  tiledFace(true); tiledFace(false);
  const endShape=new THREE.Shape();endShape.moveTo(-1.52,5.97);endShape.lineTo(1.52,5.97);endShape.lineTo(0,7.34);endShape.closePath();
  const endGeometry=new THREE.ExtrudeGeometry(endShape,{depth:.06,bevelEnabled:false});endGeometry.rotateY(PI/2);
  for(const x of [-1.93,2.54]) {
    mesh(annex,endGeometry,mat.plaster,'enclosed-roof-gable',[x,0,0]);
    box(annex,'gable-center-post',[.1,1.28,.10],[x,6.60,0],mat.walnutDark);
  }
  for(const [name,y,z,d,h] of [['lower-left-gabled-roof',3.12,.38,1.80,.58],['upper-left-gabled-roof',5.86,-.25,1.48,.48]]) {
    const holder=annex.getObjectByName(name), tiles=new THREE.InstancedMesh(tileGeo,mat.slate,24);
    let index=0;
    for(const sign of [-1,1])for(let row=0;row<4;row++)for(let col=0;col<3;col++) {
      const zz=sign*(d/2-row*(d/2)/4);
      dummy.position.set(-3.0+col*.3,y+h-Math.abs(zz)*h/(d/2)+.065,z+zz);
      dummy.rotation.set(sign*Math.atan2(h,d/2),sign>0?0:PI,0); dummy.scale.set(.9,1,.9); dummy.updateMatrix();tiles.setMatrixAt(index++,dummy.matrix);
    }
    holder.add(tiles);
  }
  for(const z of [-1.83,1.83]) box(roof,'dark-walnut-eave',[5.92,.15,.13],[0,5.94,z],mat.walnutDark,null,true);
  // End verge boards show roof cross-section only from sides, never a front gable.
  for(const x of [-2.90,2.90]) for(const s of [-1,1]) between(roof,'roof-verge',[x,ridgeY,0],[x,eaveY,s*1.84],.065,mat.walnutDark,8);
  for(const x of [-2.82,2.82]){
    cylinder(roof,'brass-roof-finial',.035,.055,.35,[x,7.58,0],mat.brass,10);
    mesh(roof,new THREE.SphereGeometry(.07,10,7),mat.brass,'brass-roof-finial',[x,7.78,0]);
  }

  // Masonry chimney with actual courses and cap, offset on rear roof.
  const chimney=groupNamed(group,'chimney');
  box(chimney,'chimney-mortar-core',[.55,1.36,.57],[1.04,7.24,-.48],mat.mortar,null,true);
  const cbrick=new THREE.InstancedMesh(new RoundedBoxGeometry(.25,.15,.07,2,.025),mat.brickWarm,32); cbrick.name='chimney-individual-bricks';
  let ci=0; for(let face=0;face<2;face++) for(let row=0;row<8;row++) for(let col=0;col<2;col++){
    dummy.position.set(1.04+(col-.5)*.26+(row%2)*.07,6.64+row*.16,face===0?-.18:-.78); dummy.rotation.set(0,0,0); dummy.updateMatrix(); cbrick.setMatrixAt(ci++,dummy.matrix);
  } chimney.add(cbrick);
  box(chimney,'chimney-cap',[.72,.13,.72],[1.04,7.94,-.48],mat.slateEdge,null,true);
  box(chimney,'chimney-cap-upper',[.58,.10,.58],[1.04,8.045,-.48],mat.stone,null,true);

  // ---------- lanterns with complete cages and curved brackets ----------
  const lanterns=groupNamed(group,'lanterns');
  function lantern(x,y,z,side=0){
    const l=groupNamed(lanterns,'framed-hanging-lantern'); l.position.set(x,y,z); if(side)l.rotation.y=side;
    box(l,'lantern-glass',[.19,.34,.15],[0,0,0],mat.glass,null,true);
    for(const xx of [-.12,.12]) for(const zz of [-.09,.09]) box(l,'lantern-frame',[.025,.42,.025],[xx,0,zz],mat.iron,null,true);
    box(l,'lantern-top',[.31,.055,.25],[0,.23,0],mat.brass,null,true); box(l,'lantern-bottom',[.29,.055,.23],[0,-.23,0],mat.brass,null,true);
    cylinder(l,'lantern-roof',0,.20,.13,[0,.31,0],mat.iron,8);
    torus(l,'curved-lantern-bracket',.24,.025,[0,.47,-.08],mat.iron,[0,PI/2,0],6,16,PI);
    between(l,'lantern-chain',[0,.26,0],[0,.47,0],.012,mat.iron,6);
  }
  lantern(-2.62,2.67,1.48); lantern(-2.53,3.33,1.82); lantern(2.61,2.02,1.48); lantern(-1.98,4.60,1.82); lantern(2.30,4.55,1.80);

  // ---------- pots, ivy, ferns and miniature flowers ----------
  const garden=groupNamed(group,'planters-and-ivy');
  const pots=[[-1.75,4.43,1.83],[.02,4.43,1.83],[1.80,4.43,1.83],[-2.17,1.55,1.72],[1.96,1.55,1.72],[2.55,2.40,.82],[-2.45,4.02,-1.35],[1.75,4.00,-1.43]];
  for(const [x,y,z] of pots) cylinder(garden,'terracotta-flower-pot',.17,.12,.27,[x,y,z],mat.terracotta,12);
  const leafGeo=new THREE.SphereGeometry(1,6,4), leaves=new THREE.InstancedMesh(leafGeo,mat.leaf,pots.length*18+480); leaves.name='distinct-ivy-and-fern-leaves';
  let li=0;
  for(const [x,y,z] of pots) for(let i=0;i<18;i++){
    const a=random()*PI*2, r=random()*.26; dummy.position.set(x+Math.cos(a)*r,y+.18+random()*.30,z+Math.sin(a)*r); dummy.scale.set(.045+random()*.07,.018,.08+random()*.09); dummy.rotation.set(random()*PI,random()*PI,random()*PI); dummy.updateMatrix(); leaves.setMatrixAt(li++,dummy.matrix); leaves.setColorAt(li-1,new THREE.Color().setHSL(.23+random()*.06,.3+random()*.25,.27+random()*.22));
  }
  for(let i=0;i<480;i++){
    const side=i%3===0?-1:1, x=-2.5+random()*5, drop=random()*random()*.65; dummy.position.set(x,4.55-drop,side>0?1.94:-1.61); dummy.scale.set(.035+random()*.055,.016,.07+random()*.07); dummy.rotation.set(random()*PI,random()*PI,random()*PI); dummy.updateMatrix(); leaves.setMatrixAt(li++,dummy.matrix); leaves.setColorAt(li-1,new THREE.Color().setHSL(.25+random()*.04,.36,.45+random()*.20));
  } garden.add(leaves);
  const miniFlowers=new THREE.InstancedMesh(new THREE.SphereGeometry(1,7,5),mat.palePink,pots.length*7); miniFlowers.name='potted-miniature-flowers';
  let fi=0; for(const [x,y,z] of pots)for(let i=0;i<7;i++){const a=random()*PI*2,r=random()*.22;dummy.position.set(x+Math.cos(a)*r,y+.43+random()*.13,z+Math.sin(a)*r);dummy.scale.setScalar(.035+random()*.035);dummy.updateMatrix();miniFlowers.setMatrixAt(fi++,dummy.matrix);} garden.add(miniFlowers);

  // ---------- connected front-eave sakura ----------
  const sakura=groupNamed(group,'sakura-tree'); sakura.position.z=.52;
  const nodes=[
    [[.50,4.02,1.22],[.47,4.72,1.20],.105], [[.47,4.72,1.20],[.28,5.38,1.27],.09],
    [[.28,5.38,1.27],[-.18,5.92,1.34],.078], [[-.18,5.92,1.34],[-.84,6.32,1.39],.064],
    [[-.84,6.32,1.39],[-1.65,6.54,1.43],.050], [[-1.65,6.54,1.43],[-2.45,6.65,1.48],.035],
    [[-.82,6.31,1.39],[-1.35,6.82,1.35],.037], [[-1.35,6.82,1.35],[-2.05,6.96,1.43],.026],
    [[-.16,5.91,1.34],[.58,6.27,1.38],.060], [[.58,6.27,1.38],[1.42,6.48,1.42],.047],
    [[1.42,6.48,1.42],[2.38,6.58,1.48],.032], [[.62,6.28,1.38],[1.08,6.78,1.36],.035],
    [[1.08,6.78,1.36],[1.87,6.91,1.43],.025], [[.15,5.62,1.31],[.84,5.82,1.41],.047],
    [[.84,5.82,1.41],[1.55,6.02,1.50],.032], [[-1.62,6.53,1.43],[-2.22,6.32,1.55],.027],
    [[1.38,6.48,1.42],[1.98,6.31,1.58],.025], [[-2.04,6.95,1.43],[-2.55,6.85,1.55],.020],
  ];
  nodes.forEach(([a,b,r],i)=>{ const branch=between(sakura,i===0?'sakura-front-trunk':'sakura-branch',a,b,r,i<3?mat.barkLight:mat.bark,10); branch.userData.connectedEndpoints=[a,b]; });
  // Five rounded ellipsoid petals in a single merged geometry, instanced along branch endpoints.
  const petalParts=[];
  for(let p=0;p<5;p++){
    const a=p*PI*2/5, geo=new THREE.SphereGeometry(1,12,8); geo.scale(.095,.025,.13); geo.rotateY(a); geo.translate(Math.sin(a)*.10,0,Math.cos(a)*.10); petalParts.push(geo);
  }
  const centerGeo=new THREE.SphereGeometry(.045,8,6), flowerGeo=mergeGeometries([...petalParts,centerGeo],false);
  const blossomAnchors=[];
  // Dense but deliberate ribbons around branch segments, never above ridge.
  for(const [a,b] of nodes.slice(3)){
    const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b); const amount=3+Math.floor(new THREE.Vector3().subVectors(bv,av).length()*5);
    for(let i=0;i<amount;i++){
      const t=random(), p=av.clone().lerp(bv,t); p.add(new THREE.Vector3((random()-.5)*.22,(random()-.5)*.17,(random()-.5)*.20)); p.y=Math.min(p.y,6.79); p.z=Math.max(p.z,.78); blossomAnchors.push(p);
    }
  }
  const halves=[Math.ceil(blossomAnchors.length/2),Math.floor(blossomAnchors.length/2)];
  const blossomMeshes=halves.map((count,i)=>{const im=new THREE.InstancedMesh(flowerGeo,i?mat.palePink:mat.pink,count);im.name='five-petal-sakura-blossoms';return im;});
  const counters=[0,0]; blossomAnchors.forEach((p,i)=>{
    const k=i%2; dummy.position.copy(p);
    dummy.quaternion.setFromUnitVectors(Y_AXIS,new THREE.Vector3((random()-.5)*.7,(random()-.5)*.7,1).normalize()); dummy.rotateY(random()*PI*2);
    const s=.65+random()*.45;dummy.scale.setScalar(s);dummy.updateMatrix();blossomMeshes[k].setMatrixAt(counters[k]++,dummy.matrix);
  }); sakura.add(...blossomMeshes);

  // Coherent rear service details.
  const rear=groupNamed(group,'rear-service-details');
  box(rear,'rear-utility-balcony',[2.30,.14,.65],[.75,3.18,-1.84],mat.walnut,null,true);
  box(rear,'rear-copper-awning',[1.48,.07,.70],[-1.05,2.95,-1.90],mat.bronze,[-.16,0,0],true);
  for(const x of [-1.65,-.45]) between(rear,'rear-awning-bracket',[x,2.70,-1.61],[x,3.02,-2.02],.035,mat.iron,7);
  for(let x=-.34;x<1.86;x+=.30)cylinder(rear,'rear-baluster',.026,.034,.57,[x,3.50,-2.08],mat.walnut,7);
  box(rear,'rear-balcony-rail',[2.35,.09,.09],[.75,3.78,-2.08],mat.walnutDark,null,true);

  // Merge fine static parts by material while retaining semantic parent groups.
  // Instanced masonry, tiles, plants and flowers remain independently batched.
  function batchStatic(root, brassBatchName=null){
    root.updateWorldMatrix(true,true);
    const inverse=root.matrixWorld.clone().invert(), buckets=new Map(), originals=[];
    root.traverse(o=>{
      if(!o.isMesh||o.isInstancedMesh)return;
      const key=o.material.uuid;
      if(!buckets.has(key))buckets.set(key,{material:o.material,geometries:[]});
      let g=o.geometry.clone();
      if(g.index) g=g.toNonIndexed();
      // Normalize optional attributes before merging unrelated crafted primitives.
      for(const key of Object.keys(g.attributes)) if(!['position','normal','uv'].includes(key)) g.deleteAttribute(key);
      g.applyMatrix4(inverse.clone().multiply(o.matrixWorld)); buckets.get(key).geometries.push(g); originals.push(o);
    });
    originals.forEach(o=>o.parent.remove(o));
    for(const {material,geometries} of buckets.values()){
      const g=geometries.length===1?geometries[0]:mergeGeometries(geometries,false);
      const o=new THREE.Mesh(g,material); o.name=brassBatchName&&material===mat.brass?brassBatchName:`${root.name}-material-batch`; o.castShadow=o.receiveShadow=true; root.add(o);
    }
  }
  batchStatic(ground);
  joinery.userData.visibleBoltCount=8;
  batchStatic(joinery);
  batchStatic(rail);
  umbrellas.children.filter(o=>o.name==='ribbed-cream-umbrella').forEach(o=>batchStatic(o));
  batchStatic(stairs);
  batchStatic(lanterns);
  batchStatic(rear);
  batchStatic(annex);
  batchStatic(garden);
  wheels.forEach(w=>batchStatic(w,'wheel-bolt-circle'));

  group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  const baseY=group.position.y;
  const WHEEL_RADIUS=0.49;
  // update(time, speed, distance?)
  //  - Pure function of its arguments so headless tests stay deterministic.
  //  - Wheel roll = -travelledDistance / wheelRadius, so tires never slide.
  //    When the caller integrates an eased velocity it passes the real
  //    `distance`; otherwise we fall back to speed*time (constant-velocity),
  //    which keeps the 2-arg contract deterministic.
  //  - Only the rolling wheel groups spin; axles, springs, hangers and other
  //    decorative supports live in the parent undercarriage and stay still.
  function update(time,speed=0,distance){
    const t=Number.isFinite(time)?time:0;
    const pace=Math.max(0,Number.isFinite(speed)?speed:0);
    const travelled=Number.isFinite(distance)?distance:pace*t;
    const roll=-travelled/WHEEL_RADIUS;
    wheels.forEach(w=>{w.rotation.x=roll;});
    // Body bob/sway scales with pace so a stopped house is perfectly still.
    group.position.y=baseY+(pace===0?0:Math.sin(t*(3.1+pace))*.022*Math.min(pace,2));
    group.rotation.z=pace===0?0:Math.sin(t*1.65)*.004*Math.min(pace,2);
  }
  return { group, wheels, windowMaterials, update };
}
