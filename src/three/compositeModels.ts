import * as THREE from 'three';
import type { ProceduralTextureSet } from './proceduralTextures.ts';

export interface SmartHomeRefs {
  group: THREE.Group;
  hepaFanCap: THREE.Mesh;
  airflowRibbon: THREE.Mesh;
  airflowMaterial: THREE.MeshStandardMaterial;
  windowPaneLeft: THREE.Mesh;
  windowPaneRight: THREE.Mesh;
  purifierGlowRing: THREE.Mesh;
  purifierRingMat: THREE.MeshStandardMaterial;
}

function makeContactShadow(
  radiusX: number,
  radiusZ: number,
  shadowMap: THREE.CanvasTexture,
  y = 0.015,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(radiusX * 2, radiusZ * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowMap,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = y;
  return mesh;
}

/**
 * Composite 10-part Smart Home cutaway + HEPA purifier tower + airflow circulation ribbon.
 * Bottom-center pivot sits flush at y = 0.
 */
export function buildSmartHomeWithHepa(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean,
): SmartHomeRefs {
  const group = new THREE.Group();

  const plasterMat = new THREE.MeshStandardMaterial({
    color: 0xf4f6f2,
    roughness: 0.84,
    metalness: 0.04,
    bumpMap: textures.stuccoBump,
    bumpScale: 0.02,
  });
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x5c6d6a,
    roughness: 0.88,
    metalness: 0.08,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x164a44,
    roughness: 0.56,
    metalness: 0.16,
  });
  const woodFloorMat = new THREE.MeshStandardMaterial({
    color: 0xc29e74,
    roughness: 0.72,
    metalness: 0.05,
  });
  const metalTrimMat = new THREE.MeshStandardMaterial({
    color: 0x8ea39d,
    roughness: 0.25,
    metalness: 0.82,
  });
  const glassCutawayMat = new THREE.MeshPhysicalMaterial({
    color: 0xdff4ed,
    roughness: 0.1,
    metalness: 0.04,
    transparent: true,
    opacity: isSoftwareGl ? 0.14 : 0.18,
    transmission: isSoftwareGl ? 0 : 0.78,
    ior: 1.48,
    depthWrite: false,
  });

  // 1. Contact shadow beneath foundation
  group.add(makeContactShadow(5.2, 4.4, textures.contactShadowMap, 0.015));

  // 2. Stepped foundation plinth (y = 0 to 0.24)
  const plinthGeo = new THREE.BoxGeometry(8.2, 0.24, 6.2);
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.position.y = 0.12;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // 3. Interior hardwood floor slab (offset >= 0.02 above plinth top)
  const floorGeo = new THREE.BoxGeometry(7.6, 0.06, 5.6);
  const floor = new THREE.Mesh(floorGeo, woodFloorMat);
  floor.position.y = 0.27;
  floor.receiveShadow = true;
  group.add(floor);

  // 4. Back + side U-shaped stucco shell (after rotateX(-PI/2), y=+2.9 -> z=-2.9 back, y=-2.7 -> z=+2.7 open front)
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-3.9, 2.9);
  wallShape.lineTo(3.9, 2.9);
  wallShape.lineTo(3.9, -2.7);
  wallShape.lineTo(3.35, -2.7);
  wallShape.lineTo(3.35, 2.35);
  wallShape.lineTo(-3.35, 2.35);
  wallShape.lineTo(-3.35, -2.7);
  wallShape.lineTo(-3.9, -2.7);
  wallShape.closePath();

  const wallGeo = new THREE.ExtrudeGeometry(wallShape, {
    depth: 3.1,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  wallGeo.rotateX(-Math.PI / 2);
  const walls = new THREE.Mesh(wallGeo, plasterMat);
  walls.position.y = 0.24;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // 5. Pitched gable roof (extruded triangle with generous eave overhang)
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-4.45, 0);
  roofShape.lineTo(0, 1.85);
  roofShape.lineTo(4.45, 0);
  roofShape.lineTo(4.1, -0.2);
  roofShape.lineTo(0, 1.5);
  roofShape.lineTo(-4.1, -0.2);
  roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
    depth: 6.8,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, 3.35, -3.4);
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // 6. Roof solar collector panel (accent metal + dark silicon cells)
  const solarFrame = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 1.7), metalTrimMat);
  solarFrame.position.set(1.75, 4.35, 0.3);
  solarFrame.rotation.z = -0.39;
  solarFrame.castShadow = true;
  group.add(solarFrame);

  const solarCellMat = new THREE.MeshStandardMaterial({
    color: 0x183148,
    roughness: 0.18,
    metalness: 0.65,
  });
  const solarCells = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.04, 1.54), solarCellMat);
  solarCells.position.set(1.78, 4.39, 0.3);
  solarCells.rotation.z = -0.39;
  group.add(solarCells);

  // 7. Translucent front inspection glass + sliding ventilation panes
  const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(6.7, 2.9, 0.05), glassCutawayMat);
  frontGlass.position.set(0, 1.82, 2.68);
  frontGlass.renderOrder = 4;
  group.add(frontGlass);

  const windowPaneMat = new THREE.MeshStandardMaterial({
    color: 0x8bcbb8,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.36,
  });
  const windowPaneLeft = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.25, 0.07), windowPaneMat);
  windowPaneLeft.position.set(-2.35, 2.15, 2.75);
  group.add(windowPaneLeft);

  const windowPaneRight = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.25, 0.07), windowPaneMat);
  windowPaneRight.position.set(2.35, 2.15, 2.75);
  group.add(windowPaneRight);

  // 8. Interior living room sofa & table (grounding interior scale)
  const sofaMat = new THREE.MeshStandardMaterial({ color: 0x3b6760, roughness: 0.85, metalness: 0.02 });
  const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.95), sofaMat);
  sofaBase.position.set(1.45, 0.52, -0.75);
  sofaBase.castShadow = true;
  group.add(sofaBase);
  const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 0.25), sofaMat);
  sofaBack.position.set(1.45, 0.88, -1.1);
  sofaBack.castShadow = true;
  group.add(sofaBack);

  // 9. Composite HEPA Purifier Tower (5 parts: base, pleated Lathe/cylinder drum, status ring, spinning diffuser cap, glow halo)
  const hepaGroup = new THREE.Group();
  hepaGroup.position.set(-1.55, 0.3, -0.3);

  const hepaBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.62, 0.16, 24),
    metalTrimMat,
  );
  hepaBase.position.y = 0.08;
  hepaBase.castShadow = true;
  hepaGroup.add(hepaBase);

  const hepaPleatMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.hepaPleatMap,
    roughness: 0.68,
    metalness: 0.08,
  });
  const hepaDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.49, 0.51, 1.15, 24),
    hepaPleatMat,
  );
  hepaDrum.position.y = 0.72;
  hepaDrum.castShadow = true;
  hepaGroup.add(hepaDrum);

  const purifierRingMat = new THREE.MeshStandardMaterial({
    color: 0x26a678,
    emissive: 0x1d7c58,
    emissiveIntensity: 0.85,
    roughness: 0.22,
    metalness: 0.35,
  });
  const purifierGlowRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.49, 0.04, 12, 28),
    purifierRingMat,
  );
  purifierGlowRing.rotation.x = Math.PI / 2;
  purifierGlowRing.position.y = 1.32;
  hepaGroup.add(purifierGlowRing);

  const hepaFanCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.48, 0.14, 16),
    new THREE.MeshStandardMaterial({ color: 0x164a44, roughness: 0.32, metalness: 0.45 }),
  );
  hepaFanCap.position.y = 1.4;
  hepaGroup.add(hepaFanCap);
  group.add(hepaGroup);

  // 10. Clean-air circulation ribbon (TubeGeometry) swirling out of HEPA unit
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.55, 1.75, -0.3),
    new THREE.Vector3(-1.25, 2.35, 0.35),
    new THREE.Vector3(-0.15, 2.55, 0.1),
    new THREE.Vector3(1.1, 2.15, -0.35),
    new THREE.Vector3(1.8, 1.45, 0.25),
  ]);
  const ribbonGeo = new THREE.TubeGeometry(curve, 32, 0.075, 10, false);
  const airflowMaterial = new THREE.MeshStandardMaterial({
    color: 0x5fd4a2,
    emissive: 0x288560,
    emissiveIntensity: 0.55,
    roughness: 0.3,
    metalness: 0.1,
    transparent: true,
    opacity: 0.68,
  });
  const airflowRibbon = new THREE.Mesh(ribbonGeo, airflowMaterial);
  group.add(airflowRibbon);

  return {
    group,
    hepaFanCap,
    airflowRibbon,
    airflowMaterial,
    windowPaneLeft,
    windowPaneRight,
    purifierGlowRing,
    purifierRingMat,
  };
}

/**
 * Composite 6-part Mid-Rise Urban Building Block (podium, shaft, fin louvers, cornice, HVAC, solar).
 */
export function buildUrbanApartmentBlock(
  width: number,
  height: number,
  depth: number,
  tintHex: number,
  stuccoBump: THREE.CanvasTexture,
  shadowMap: THREE.CanvasTexture,
): THREE.Group {
  const group = new THREE.Group();
  group.add(makeContactShadow(width * 0.62, depth * 0.62, shadowMap, 0.015));

  const podiumMat = new THREE.MeshStandardMaterial({ color: 0x4b5c5b, roughness: 0.85, metalness: 0.1 });
  const bodyMat = new THREE.MeshStandardMaterial({
    color: tintHex,
    roughness: 0.78,
    metalness: 0.06,
    bumpMap: stuccoBump,
    bumpScale: 0.02,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x8bb6b5,
    roughness: 0.18,
    metalness: 0.62,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x2a4544, roughness: 0.4, metalness: 0.45 });

  // 1. Podium
  const podium = new THREE.Mesh(new THREE.BoxGeometry(width * 1.05, 1.1, depth * 1.05), podiumMat);
  podium.position.y = 0.55;
  podium.castShadow = true;
  podium.receiveShadow = true;
  group.add(podium);

  // 2. Main shaft
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(width, height - 1.3, depth), bodyMat);
  shaft.position.y = 1.1 + (height - 1.3) / 2;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);

  // 3. Window bands on front & side
  const floors = Math.max(2, Math.floor((height - 1.6) / 1.45));
  const bandGeo = new THREE.BoxGeometry(width * 0.86, 0.55, depth + 0.08);
  for (let f = 0; f < floors; f++) {
    const band = new THREE.Mesh(bandGeo, glassMat);
    band.position.y = 1.85 + f * 1.45;
    group.add(band);
  }

  // 4. Roof parapet cornice
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(width * 1.04, 0.28, depth * 1.04), trimMat);
  cornice.position.y = height - 0.1;
  cornice.castShadow = true;
  group.add(cornice);

  // 5. Mechanical penthouse
  const mech = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.42, 0.65, depth * 0.42),
    podiumMat,
  );
  mech.position.set(-width * 0.16, height + 0.32, 0);
  mech.castShadow = true;
  group.add(mech);

  return group;
}

/**
 * Composite 6-part Street Tree (Lathe trunk, grate collar, 4 asymmetric canopies + contact shadow).
 */
export function buildStreetTree(shadowMap: THREE.CanvasTexture, scale = 1): THREE.Group {
  const group = new THREE.Group();
  group.add(makeContactShadow(1.35 * scale, 1.35 * scale, shadowMap, 0.015));

  const grate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.6, 0.06, 12),
    new THREE.MeshStandardMaterial({ color: 0x3b4948, roughness: 0.45, metalness: 0.72 }),
  );
  grate.position.y = 0.03;
  group.add(grate);

  const trunkPts = [
    new THREE.Vector2(0.01, 0),
    new THREE.Vector2(0.24, 0),
    new THREE.Vector2(0.15, 0.5),
    new THREE.Vector2(0.11, 1.9),
    new THREE.Vector2(0.05, 2.3),
  ];
  const trunk = new THREE.Mesh(
    new THREE.LatheGeometry(trunkPts, 10),
    new THREE.MeshStandardMaterial({ color: 0x5c4637, roughness: 0.9, metalness: 0.02 }),
  );
  trunk.castShadow = true;
  group.add(trunk);

  const foliageColors = [0x3d7d57, 0x4b8f64, 0x2f6c49, 0x589c6f];
  const foliageOffsets: Array<[number, number, number, number]> = [
    [0, 2.6, 0, 1.05],
    [-0.55, 2.25, 0.35, 0.76],
    [0.58, 2.3, -0.25, 0.8],
    [0.12, 3.15, 0.15, 0.68],
  ];
  foliageOffsets.forEach(([x, y, z, r], i) => {
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 1),
      new THREE.MeshStandardMaterial({
        color: foliageColors[i % foliageColors.length],
        roughness: 0.82,
        metalness: 0.02,
      }),
    );
    crown.position.set(x, y, z);
    crown.castShadow = true;
    crown.receiveShadow = true;
    group.add(crown);
  });

  group.scale.setScalar(scale);
  return group;
}

export interface VehicleRefs {
  group: THREE.Group;
  exhaustPlumeBadge: THREE.Mesh;
  evSolarCap: THREE.Mesh;
  bodyMat: THREE.MeshStandardMaterial;
}

/**
 * Composite 8-part Beveled Commute Vehicle (chassis ExtrudeGeometry, cabin, 4 wheels/rims, headlights, EV vs petrol details).
 */
export function buildCommuteVehicle(shadowMap: THREE.CanvasTexture): VehicleRefs {
  const group = new THREE.Group();
  group.add(makeContactShadow(1.65, 0.9, shadowMap, 0.02));

  // Extruded side profile along X, centered around Z
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-1.45, 0.25);
  bodyShape.lineTo(1.48, 0.25);
  bodyShape.lineTo(1.52, 0.62);
  bodyShape.lineTo(0.88, 0.78);
  bodyShape.lineTo(0.45, 1.18);
  bodyShape.lineTo(-0.78, 1.18);
  bodyShape.lineTo(-1.25, 0.76);
  bodyShape.lineTo(-1.48, 0.65);
  bodyShape.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 1.24,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  bodyGeo.translate(0, 0, -0.62);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xb65e3b,
    roughness: 0.34,
    metalness: 0.42,
  });
  const chassis = new THREE.Mesh(bodyGeo, bodyMat);
  chassis.castShadow = true;
  group.add(chassis);

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1e353d,
    roughness: 0.14,
    metalness: 0.55,
  });
  const greenhouse = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.36, 1.16), glassMat);
  greenhouse.position.set(-0.15, 0.96, 0);
  group.add(greenhouse);

  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1f2526, roughness: 0.88, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd0dad6, roughness: 0.24, metalness: 0.85 });
  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.18, 16);
  wheelGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.2, 12);
  rimGeo.rotateX(Math.PI / 2);

  const wheelPos: Array<[number, number]> = [
    [-0.9, 0.66],
    [0.9, 0.66],
    [-0.9, -0.66],
    [0.9, -0.66],
  ];
  for (const [wx, wz] of wheelPos) {
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.position.set(wx, 0.28, wz);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(wx, 0.28, wz);
    group.add(tire, rim);
  }

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfff5d6,
    emissive: 0xffdf9a,
    emissiveIntensity: 0.65,
    roughness: 0.15,
  });
  const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.24), headlightMat);
  hlLeft.position.set(1.53, 0.54, 0.4);
  const hlRight = hlLeft.clone();
  hlRight.position.z = -0.4;
  group.add(hlLeft, hlRight);

  const exhaustPlumeBadge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.06, 0.22, 10),
    new THREE.MeshStandardMaterial({ color: 0x5d6466, roughness: 0.35, metalness: 0.78 }),
  );
  exhaustPlumeBadge.rotation.z = Math.PI / 2;
  exhaustPlumeBadge.position.set(-1.55, 0.32, -0.35);
  group.add(exhaustPlumeBadge);

  const evSolarCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.06, 0.84),
    new THREE.MeshStandardMaterial({
      color: 0x2ca97a,
      emissive: 0x1b6d52,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.5,
    }),
  );
  evSolarCap.position.set(-0.15, 1.24, 0);
  evSolarCap.visible = false;
  group.add(evSolarCap);

  return { group, exhaustPlumeBadge, evSolarCap, bodyMat };
}
