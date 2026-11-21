import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createProceduralTextureSet } from './proceduralTextures.ts';
import {
  buildCommuteVehicle,
  buildSmartHomeWithHepa,
  buildStreetTree,
  buildUrbanApartmentBlock,
} from './compositeModels.ts';
import type { CommuteMode } from '../shared/types.ts';

export type CameraPresetId = 'overview' | 'indoor' | 'street';

export interface SmogSceneParams {
  usAqi: number;
  pm25: number;
  hepaCadr: number;
  windSpeed: number;
  windowsSealed: boolean;
  commute: CommuteMode;
  preset: CameraPresetId;
}

/**
 * Pure illustrative indoor PM2.5 mass-balance approximation for educational simulation.
 * Intentionally transparent and never presented as a calibrated physical sensor measurement.
 */
export function estimateIndoorPm25(
  outdoorPm25: number,
  hepaCadrM3h: number,
  windowsSealed: boolean,
): number {
  const safeOutdoor = Math.max(2, Math.min(800, Number.isFinite(outdoorPm25) ? outdoorPm25 : 65));
  const safeCadr = Math.max(0, Math.min(600, Number.isFinite(hepaCadrM3h) ? hepaCadrM3h : 0));
  const infiltrationFactor = windowsSealed ? 0.35 : 0.76;
  const roomVolumeM3 = 65; // representative ~24 sqm family living room
  const airChangesPerHour = safeCadr / roomVolumeM3;
  const filtrationFactor = 1 / (1 + airChangesPerHour * 0.45);
  return Math.round(safeOutdoor * infiltrationFactor * filtrationFactor * 10) / 10;
}

const CAMERA_PRESETS: Record<
  CameraPresetId,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  overview: { pos: [14.5, 9.2, 16.5], target: [0.5, 1.8, 0.5] },
  indoor: { pos: [-1.2, 3.2, 7.6], target: [-1.1, 1.6, -0.3] },
  street: { pos: [-12.5, 3.4, 11.2], target: [0.2, 1.3, 6.2] },
};

const _vec3 = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

export function detectSoftwareWebGl(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export interface SmogSceneController {
  updateParams: (next: Partial<SmogSceneParams>) => void;
  setPreset: (preset: CameraPresetId) => void;
  dispose: () => void;
}

export function mountSmogSimulationScene(
  container: HTMLElement,
  initialParams: SmogSceneParams,
): SmogSceneController {
  const isSoftwareGl = detectSoftwareWebGl();
  let params: SmogSceneParams = { ...initialParams };

  const width = Math.max(320, container.clientWidth || 800);
  const height = Math.max(320, container.clientHeight || 520);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const skyColor = new THREE.Color(0xd5e6df);
  scene.background = skyColor;
  scene.fog = new THREE.FogExp2(skyColor.getHex(), 0.015);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmremGenerator.dispose();

  const camera = new THREE.PerspectiveCamera(44, width / height, 0.25, 180);
  const startPreset = CAMERA_PRESETS[params.preset];
  camera.position.set(...startPreset.pos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...startPreset.target);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.08;
  controls.minDistance = 4.5;
  controls.maxDistance = 36;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.update();

  let activeTransition = false;
  const targetCamPos = new THREE.Vector3(...startPreset.pos);
  const targetLookAt = new THREE.Vector3(...startPreset.target);

  controls.addEventListener('start', () => {
    activeTransition = false;
  });

  // Warm/Cool Lighting Rig
  const hemiLight = new THREE.HemisphereLight(0xc2e2f7, 0x455850, 0.95);
  hemiLight.position.set(0, 30, 0);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff0d4, 2.15);
  keyLight.position.set(16, 22, 14);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 62;
  keyLight.shadow.camera.left = -22;
  keyLight.shadow.camera.right = 22;
  keyLight.shadow.camera.top = 22;
  keyLight.shadow.camera.bottom = -22;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xbbe0f8, 0.65);
  rimLight.position.set(-14, 10, -12);
  scene.add(rimLight);

  const indoorLight = new THREE.PointLight(0xfff4dd, 4.5, 11, 1.4);
  indoorLight.position.set(0, 2.8, -1.3);
  scene.add(indoorLight);

  const textures = createProceduralTextureSet(renderer.capabilities.getMaxAnisotropy());

  // Extended terrain + street corridor (Y offsets >= 0.02 prevent Z-fighting)
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x738b7d,
    roughness: 0.92,
    metalness: 0.02,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0xc8d2cd,
    roughness: 0.85,
    metalness: 0.04,
    bumpMap: textures.stuccoBump,
    bumpScale: 0.015,
  });
  const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(58, 0.05, 13.5), sidewalkMat);
  sidewalk.position.set(0, 0.025, -1.2);
  sidewalk.receiveShadow = true;
  scene.add(sidewalk);

  const roadMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.asphaltMap,
    bumpMap: textures.asphaltBump,
    bumpScale: 0.02,
    roughness: 0.86,
    metalness: 0.04,
  });
  const road = new THREE.Mesh(new THREE.BoxGeometry(64, 0.03, 6.2), roadMat);
  road.rotation.y = Math.PI / 2;
  // Wait: road runs left-to-right along X axis at z = 6.8
  road.rotation.y = 0;
  road.position.set(0, 0.02, 7.2);
  road.receiveShadow = true;
  scene.add(road);

  // Composite Smart Home + HEPA Purifier centerpiece
  const smartHome = buildSmartHomeWithHepa(textures, isSoftwareGl);
  smartHome.group.position.set(0, 0.05, -1.6);
  scene.add(smartHome.group);

  // Surrounding urban corridor blocks
  const blockLeft = buildUrbanApartmentBlock(5.8, 9.2, 5.2, 0xd9e1dc, textures.stuccoBump, textures.contactShadowMap);
  blockLeft.position.set(-9.4, 0.05, -2.1);
  scene.add(blockLeft);

  const blockRight = buildUrbanApartmentBlock(6.2, 11.4, 5.4, 0xcfdad5, textures.stuccoBump, textures.contactShadowMap);
  blockRight.position.set(9.6, 0.05, -2.0);
  scene.add(blockRight);

  const blockBg1 = buildUrbanApartmentBlock(7.5, 13.5, 6.0, 0xc3d0ca, textures.stuccoBump, textures.contactShadowMap);
  blockBg1.position.set(-14.5, 0.05, -11.5);
  scene.add(blockBg1);

  const blockBg2 = buildUrbanApartmentBlock(8.0, 15.2, 6.2, 0xbccac4, textures.stuccoBump, textures.contactShadowMap);
  blockBg2.position.set(4.8, 0.05, -13.0);
  scene.add(blockBg2);

  // Perimeter street trees (natural framing, no floating void walls)
  const treeCoords: Array<[number, number, number]> = [
    [-5.3, 3.6, 0.95],
    [5.4, 3.6, 1.05],
    [-14.2, 3.6, 0.9],
    [14.4, 3.6, 1.0],
    [-7.2, 11.4, 1.1],
    [1.8, 11.5, 0.92],
    [10.2, 11.4, 1.08],
  ];
  for (const [tx, tz, sc] of treeCoords) {
    const tree = buildStreetTree(textures.contactShadowMap, sc);
    tree.position.set(tx, 0.05, tz);
    scene.add(tree);
  }

  // Composite Commute Vehicle on roadway
  const vehicle = buildCommuteVehicle(textures.contactShadowMap);
  vehicle.group.position.set(-3, 0.035, 7.2);
  scene.add(vehicle.group);

  // InstancedMesh 1: Outdoor airborne PM2.5/PM10 particles (150 instances)
  const OUTDOOR_COUNT = 150;
  const particleGeo = new THREE.IcosahedronGeometry(0.16, 1);
  const outdoorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.65,
    metalness: 0.05,
    transparent: true,
    opacity: 0.85,
  });
  const outdoorParticles = new THREE.InstancedMesh(particleGeo, outdoorMat, OUTDOOR_COUNT);
  outdoorParticles.frustumCulled = false;

  const outdoorSeeds = new Float32Array(OUTDOOR_COUNT * 4);
  for (let i = 0; i < OUTDOOR_COUNT; i++) {
    outdoorSeeds[i * 4] = (((i * 37) % 100) / 100 - 0.5) * 34; // x
    outdoorSeeds[i * 4 + 1] = 0.4 + (((i * 61) % 100) / 100) * 8.5; // y
    outdoorSeeds[i * 4 + 2] = (((i * 83) % 100) / 100 - 0.5) * 24 + 2; // z
    outdoorSeeds[i * 4 + 3] = 0.65 + (((i * 19) % 10) / 10) * 0.85; // scale seed
  }
  scene.add(outdoorParticles);

  // InstancedMesh 2: Indoor particles inside the Smart Home cutaway (56 instances)
  const INDOOR_COUNT = 56;
  const indoorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.55,
    metalness: 0.05,
    transparent: true,
    opacity: 0.82,
  });
  const indoorParticles = new THREE.InstancedMesh(particleGeo, indoorMat, INDOOR_COUNT);
  indoorParticles.frustumCulled = false;
  const indoorSeeds = new Float32Array(INDOOR_COUNT * 3);
  for (let i = 0; i < INDOOR_COUNT; i++) {
    indoorSeeds[i * 3] = (((i * 43) % 100) / 100 - 0.5) * 5.8;
    indoorSeeds[i * 3 + 1] = 0.5 + (((i * 29) % 100) / 100) * 2.3;
    indoorSeeds[i * 3 + 2] = -1.6 + (((i * 71) % 100) / 100 - 0.5) * 4.2;
  }
  scene.add(indoorParticles);

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  function applyAtmosphereToScene() {
    const aqiFactor = THREE.MathUtils.clamp(params.usAqi / 260, 0.05, 1.15);
    const cleanHex = new THREE.Color(0xd5ebe4);
    const smogHex = new THREE.Color(0xb8a383);
    _color.copy(cleanHex).lerp(smogHex, Math.min(1, aqiFactor));
    scene.background = _color.clone();
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(_color);
      scene.fog.density = 0.008 + aqiFactor * 0.018;
    }

    // Commute mode vehicle state (EV/metro/walk/cycle show clean electric shuttle)
    const isZeroTailpipe =
      params.commute === 'metro' ||
      params.commute === 'walk' ||
      params.commute === 'cycle' ||
      params.commute === 'remote';
    vehicle.exhaustPlumeBadge.visible = !isZeroTailpipe;
    vehicle.evSolarCap.visible = isZeroTailpipe;
    vehicle.bodyMat.color.setHex(isZeroTailpipe ? 0x257d62 : 0xb65e3b);
    vehicle.group.visible = params.commute !== 'remote';

    // Window panes slide outward when unsealed
    const paneShift = params.windowsSealed ? 0 : 0.72;
    smartHome.windowPaneLeft.position.x = -2.35 - paneShift;
    smartHome.windowPaneRight.position.x = 2.35 + paneShift;

    // Purifier status ring + airflow ribbon react to CADR
    const cadrNorm = THREE.MathUtils.clamp(params.hepaCadr / 450, 0, 1);
    smartHome.airflowRibbon.visible = cadrNorm > 0.04;
    smartHome.airflowMaterial.opacity = 0.15 + cadrNorm * 0.65;
    smartHome.purifierRingMat.color.setHex(cadrNorm > 0.2 ? 0x29b07e : 0xc97b2c);
    smartHome.purifierRingMat.emissive.setHex(cadrNorm > 0.2 ? 0x16684a : 0x7a4814);
  }

  applyAtmosphereToScene();

  let frameId = 0;
  let disposed = false;
  let lastTime = performance.now();
  let elapsed = 0;

  function afterDraw(cb: () => void) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 80);
      }
    };
    frameId = window.setTimeout(poll, 5);
  }

  function updateSimulation(dt: number) {
    elapsed += dt;

    // Damped camera preset transition
    if (activeTransition) {
      const dampRate = isSoftwareGl ? 14 : 6.5;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamPos.x, dampRate, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamPos.y, dampRate, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamPos.z, dampRate, dt);
      controls.target.x = THREE.MathUtils.damp(controls.target.x, targetLookAt.x, dampRate, dt);
      controls.target.y = THREE.MathUtils.damp(controls.target.y, targetLookAt.y, dampRate, dt);
      controls.target.z = THREE.MathUtils.damp(controls.target.z, targetLookAt.z, dampRate, dt);
      if (
        camera.position.distanceToSquared(targetCamPos) < 0.004 &&
        controls.target.distanceToSquared(targetLookAt) < 0.004
      ) {
        activeTransition = false;
      }
    }

    controls.update();

    // Animate vehicle smoothly along the street corridor
    if (vehicle.group.visible) {
      const roadX = ((elapsed * 3.1) % 34) - 17;
      vehicle.group.position.x = roadX;
    }

    // Spin HEPA fan cap proportional to CADR
    const cadrNorm = THREE.MathUtils.clamp(params.hepaCadr / 450, 0, 1);
    smartHome.hepaFanCap.rotation.y += dt * (1.2 + cadrNorm * 8.5);

    // Outdoor instanced PM2.5/PM10 particles
    const activeOutdoorFraction = THREE.MathUtils.clamp(params.usAqi / 220, 0.12, 1.0);
    const activeOutdoorCount = Math.max(16, Math.round(OUTDOOR_COUNT * activeOutdoorFraction));
    const windDrift = Math.max(0.4, params.windSpeed) * 0.65;

    for (let i = 0; i < OUTDOOR_COUNT; i++) {
      if (i >= activeOutdoorCount) {
        _scale.setScalar(0.0001);
        _vec3.set(0, -10, 0);
      } else {
        const baseX = outdoorSeeds[i * 4];
        const baseY = outdoorSeeds[i * 4 + 1];
        const baseZ = outdoorSeeds[i * 4 + 2];
        const sSeed = outdoorSeeds[i * 4 + 3];
        const px = ((baseX + elapsed * windDrift * sSeed + 17) % 34) - 17;
        const py = baseY + Math.sin(elapsed * 1.4 + i) * 0.25;
        const pz = baseZ + Math.cos(elapsed * 0.9 + i * 0.5) * 0.3;
        _vec3.set(px, py, pz);
        _scale.setScalar(sSeed * (0.75 + activeOutdoorFraction * 0.55));
      }
      _quat.identity();
      _mat4.compose(_vec3, _quat, _scale);
      outdoorParticles.setMatrixAt(i, _mat4);
      _color.setHex(params.usAqi > 150 ? 0xc26e45 : params.usAqi > 100 ? 0xcfa054 : 0x7aa895);
      outdoorParticles.setColorAt(i, _color);
    }
    outdoorParticles.instanceMatrix.needsUpdate = true;
    if (outdoorParticles.instanceColor) outdoorParticles.instanceColor.needsUpdate = true;

    // Indoor instanced air particles inside Smart Home cutaway
    const indoorEst = estimateIndoorPm25(params.pm25, params.hepaCadr, params.windowsSealed);
    const indoorRatio = THREE.MathUtils.clamp(indoorEst / 120, 0.08, 1.0);
    const activeIndoorCount = Math.max(8, Math.round(INDOOR_COUNT * indoorRatio));

    for (let i = 0; i < INDOOR_COUNT; i++) {
      if (i >= activeIndoorCount) {
        _scale.setScalar(0.0001);
        _vec3.set(0, -10, 0);
      } else {
        const ix = indoorSeeds[i * 3] + Math.sin(elapsed * 1.8 + i) * 0.35;
        const iy = indoorSeeds[i * 3 + 1] + Math.cos(elapsed * 2.1 + i) * 0.16;
        const iz = indoorSeeds[i * 3 + 2] + Math.sin(elapsed * 1.2 + i * 0.7) * 0.28;
        _vec3.set(ix, iy, iz);
        _scale.setScalar(0.6 + indoorRatio * 0.5);
      }
      _quat.identity();
      _mat4.compose(_vec3, _quat, _scale);
      indoorParticles.setMatrixAt(i, _mat4);
      _color.setHex(indoorEst < 20 ? 0x45c490 : indoorEst < 45 ? 0xd9a84e : 0xd16847);
      indoorParticles.setColorAt(i, _color);
    }
    indoorParticles.instanceMatrix.needsUpdate = true;
    if (indoorParticles.instanceColor) indoorParticles.instanceColor.needsUpdate = true;
  }

  function tick() {
    if (disposed) return;
    const now = performance.now();
    const dt = Math.min(0.08, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    updateSimulation(dt);
    renderer.render(scene, camera);
    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  const handleResize = () => {
    if (disposed) return;
    const nextW = Math.max(320, container.clientWidth || 800);
    const nextH = Math.max(320, container.clientHeight || 520);
    camera.aspect = nextW / nextH;
    camera.updateProjectionMatrix();
    renderer.setSize(nextW, nextH);
  };

  window.addEventListener('resize', handleResize);
  const resizeObserver =
    typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
  resizeObserver?.observe(container);

  // Kick off initial render loop
  if (isSoftwareGl) {
    renderer.render(scene, camera);
    afterDraw(tick);
  } else {
    frameId = requestAnimationFrame(tick);
  }

  return {
    updateParams(next) {
      params = { ...params, ...next };
      applyAtmosphereToScene();
    },
    setPreset(preset) {
      params.preset = preset;
      const cfg = CAMERA_PRESETS[preset];
      targetCamPos.set(...cfg.pos);
      targetLookAt.set(...cfg.target);
      activeTransition = true;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
      controls.dispose();
      textures.dispose();
      envTex.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
