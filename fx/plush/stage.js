// Stages for the plush family: renderer, lights, set and post-processing.
// Renderer: ACES, PCF soft shadows, 4x MSAA (the fur's alpha-to-coverage needs it), light bloom and
// depth of field whose depth pass skips the fur layers. Each render is a function of the camera,
// the lights and the scene as posed for that frame.
//   'bedroom'  dusk bedroom: teal wall, knit blanket, warm window glow and fairy-light bokeh.
//   'studio'   seamless dark backdrop and floor with strong back rims, for fur close-ups.
import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {knit, wall} from './textures.js';
import {blobGeometry, addContactOcclusion, withoutFur} from './fur.js';

export function createStage({width = 1280, height = 720, set = 'bedroom', exposure = 1.02} = {}) {
  const renderer = new T.WebGLRenderer({antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.setSize(width, height, false); renderer.setPixelRatio(1); renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer), env = pmrem.fromScene(new RoomEnvironment(), .04).texture; pmrem.dispose();
  scene.environment = env; scene.environmentIntensity = .3;
  const camera = new T.PerspectiveCamera(30, width / height, .05, 60);
  const lights = {}, props = {}, disposables = [];

  if (set === 'studio') {
    scene.background = new T.Color('#0b1a1f');
    lights.hemi = new T.HemisphereLight('#c9e4ff', '#2a1d16', .55); scene.add(lights.hemi);
    lights.key = new T.DirectionalLight('#ffd9b0', 2.2); lights.key.position.set(-2.4, 2.6, 3.2);
    lights.rim = new T.DirectionalLight('#ffcf94', 5.2); lights.rim.position.set(2.2, 2.6, -3.0);
    lights.rim2 = new T.DirectionalLight('#9fd8ff', 3.6); lights.rim2.position.set(-2.6, 2.0, -2.6);
    lights.fill = new T.DirectionalLight('#9ec6ff', .35); lights.fill.position.set(3, 1.2, 2.4);
    // Backdrop: a curved sweep whose colour falls from teal to near black.
    const sweep = new T.Mesh(new T.PlaneGeometry(14, 10, 1, 64), new T.MeshStandardMaterial({color: '#1d4148', roughness: 1}));
    { const p = sweep.geometry.attributes.position, Lf = 5, R = 1, arc = Math.PI / 2 * R;
      for (let i = 0; i < p.count; i++) { const s = p.getY(i) + 5; let y, z;
        if (s < Lf) { y = 0; z = Lf - s; } else if (s < Lf + arc) { const a = (s - Lf) / R; y = R * (1 - Math.cos(a)); z = -R * Math.sin(a); } else { y = R + s - Lf - arc; z = -R; }
        p.setY(i, y); p.setZ(i, z); }
      sweep.geometry.computeVertexNormals(); }
    sweep.position.set(0, -.001, -2.2); sweep.receiveShadow = true; scene.add(sweep); props.floor = sweep;
    const glow = new T.Mesh(new T.CircleGeometry(1.9, 48), new T.MeshBasicMaterial({color: '#2f6f73', transparent: true, opacity: .55, depthWrite: false}));
    glow.position.set(.2, 1.35, -2.35); scene.add(glow); props.glow = glow;
  } else {
    scene.background = new T.Color('#16343a');
    lights.hemi = new T.HemisphereLight('#d8ecff', '#6a4c3a', .9); scene.add(lights.hemi);
    lights.key = new T.DirectionalLight('#ffd7ae', 2.7); lights.key.position.set(-2.6, 3.2, 3.2);
    lights.fill = new T.DirectionalLight('#9cc8ff', .55); lights.fill.position.set(3, 1.6, 2.5);
    lights.rim = new T.DirectionalLight('#8fd0ff', 3.4); lights.rim.position.set(1.9, 3.0, -3.2);
    lights.rim2 = new T.DirectionalLight('#ffd09a', 2.0); lights.rim2.position.set(-2.4, 2.2, -2.8);
    const k = knit('#c9ab86'); k.map.repeat.set(4.2, 3); k.bump.repeat.set(4.2, 3);
    const blanketGeo = new T.PlaneGeometry(9, 7, 120, 90); blanketGeo.rotateX(-Math.PI / 2);
    { const p = blanketGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, .025 * Math.sin(x * 2.1 + z * .7) + .018 * Math.sin(z * 3.3 - x * 1.2) - .02); } blanketGeo.computeVertexNormals(); }
    const blanket = new T.Mesh(blanketGeo, new T.MeshPhysicalMaterial({map: k.map, bumpMap: k.bump, bumpScale: 6, roughness: .95, sheen: .7, sheenColor: new T.Color('#ffffff'), sheenRoughness: .6}));
    blanket.receiveShadow = true; blanket.position.z = 1; scene.add(blanket); props.floor = blanket;
    const wallMesh = new T.Mesh(new T.PlaneGeometry(14, 9), new T.MeshStandardMaterial({map: wall('#2c5a5e', '#1d3f44'), roughness: 1}));
    wallMesh.position.set(0, 3.2, -2.2); wallMesh.receiveShadow = true; scene.add(wallMesh); props.wall = wallMesh;
    // Window glow, out of focus at the left.
    const glow = new T.Mesh(new T.PlaneGeometry(1.6, 2.6), new T.MeshBasicMaterial({color: '#ffd9a8'})); glow.position.set(-2.4, 2.9, -2.18); scene.add(glow);
    const bar = new T.Mesh(new T.BoxGeometry(.06, 2.6, .04), new T.MeshStandardMaterial({color: '#3c4f50'})); bar.position.set(-2.4, 2.9, -2.15); scene.add(bar);
    // Fairy lights: warm bulbs along two sagging strings (they become bokeh discs).
    const bulbMat = new T.MeshStandardMaterial({color: '#ffd9a0', emissive: '#ffb357', emissiveIntensity: 5});
    const wire = new T.MeshStandardMaterial({color: '#3a3a32'});
    for (const [y0, sag, z] of [[2.55, .35, -2.1], [1.65, .28, -2.05]]) {
      const pts = []; for (let i = 0; i <= 40; i++) { const x = -3.2 + 6.4 * i / 40; pts.push(new T.Vector3(x, y0 - sag * (1 - (x / 3.2) ** 2), z)); }
      scene.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 80, .006, 4), wire));
      for (let i = 1; i < 40; i += 3) { const b = new T.Mesh(new T.SphereGeometry(.035, 12, 8), bulbMat); b.position.copy(pts[i]).add(new T.Vector3(0, -.04, .02)); scene.add(b); }
    }
  }
  const key = lights.key; key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {left: -2.2, right: 2.2, top: 2.6, bottom: -1, near: .5, far: 12});
  key.shadow.radius = 6; key.shadow.bias = -.0004; key.shadow.normalBias = .02;
  for (const l of Object.values(lights)) if (l.isDirectionalLight) scene.add(l);

  /** A soft pillow (superellipsoid) for any set. */
  function pillow(color = '#f4c9c2') {
    const geo = blobGeometry(v => { const se = (c, e) => Math.sign(c) * Math.abs(c) ** e; v.set(se(v.x, .45) * 1.1, se(v.y, .5) * .52, se(v.z, .8) * .3 * (1 - .25 * Math.abs(v.x) ** 3)); }, 64, 40);
    const m = new T.Mesh(geo, new T.MeshPhysicalMaterial({color, roughness: .9, sheen: 1, sheenColor: new T.Color('#fff4f0'), sheenRoughness: .5}));
    m.castShadow = m.receiveShadow = true; return m;
  }

  const rt = new T.WebGLRenderTarget(width, height, {type: T.HalfFloatType, samples: 4});
  const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new T.Vector2(width, height), .22, .5, .9); composer.addPass(bloom);
  const bokeh = new BokehPass(scene, camera, {focus: 4, aperture: .0016, maxblur: .012});
  const depthRender = bokeh.render.bind(bokeh);
  bokeh.render = (...args) => withoutFur(scene, () => depthRender(...args));
  composer.addPass(bokeh); composer.addPass(new OutputPass());

  return {
    renderer, scene, camera, composer, bokeh, bloom, lights, props, width, height, pillow,
    /** Contact occlusion of a character's ellipsoids on the floor. */
    addContact(shared) { addContactOcclusion(props.floor.material, shared, 1); },
    /** cam = {pos:[x,y,z], target:[x,y,z], fov, focus (distance; default target distance), aperture, roll} */
    render(cam) {
      camera.position.set(...cam.pos); camera.fov = cam.fov ?? 30; camera.aspect = width / height; camera.updateProjectionMatrix();
      camera.up.set(Math.sin(cam.roll || 0), Math.cos(cam.roll || 0), 0); camera.lookAt(...cam.target); camera.updateMatrixWorld();
      bokeh.uniforms.focus.value = cam.focus ?? camera.position.distanceTo(new T.Vector3(...cam.target));
      bokeh.uniforms.aperture.value = cam.aperture ?? .0016;
      composer.render(0);
      if (renderer.getContext().isContextLost()) throw new Error('WebGL context lost');
      return renderer.domElement;
    },
    dispose() { composer.dispose(); bokeh.dispose(); bloom.dispose(); rt.dispose(); env.dispose(); disposables.forEach(d => d.dispose()); scene.traverse(o => { o.geometry?.dispose(); const ms = o.material ? [].concat(o.material) : []; ms.forEach(m => { m.map?.dispose(); m.bumpMap?.dispose(); m.dispose(); }); }); renderer.dispose(); },
  };
}
