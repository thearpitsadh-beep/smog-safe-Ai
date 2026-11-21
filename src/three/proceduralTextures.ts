import * as THREE from 'three';

export interface ProceduralTextureSet {
  asphaltMap: THREE.CanvasTexture;
  asphaltBump: THREE.CanvasTexture;
  stuccoBump: THREE.CanvasTexture;
  hepaPleatMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextureSet(maxAnisotropy: number): ProceduralTextureSet {
  // 1. Road asphalt albedo (SRGBColorSpace) + micro-aggregate bump (NoColorSpace)
  const asphaltCanvas = document.createElement('canvas');
  asphaltCanvas.width = 512;
  asphaltCanvas.height = 512;
  const actx = asphaltCanvas.getContext('2d')!;
  actx.fillStyle = '#333a3d';
  actx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 4800; i++) {
    const x = (i * 73) % 512;
    const y = (i * 197 + Math.floor(i / 7) * 19) % 512;
    const shade = 44 + ((i * 29) % 24);
    actx.fillStyle = `rgb(${shade},${shade + 4},${shade + 6})`;
    actx.fillRect(x, y, 2, 2);
  }
  // Crisp dashed center lane line & edge markings
  actx.fillStyle = '#d7dfd9';
  actx.fillRect(20, 0, 8, 512);
  actx.fillRect(484, 0, 8, 512);
  actx.fillStyle = '#e7c979';
  for (let y = 18; y < 512; y += 92) {
    actx.fillRect(251, y, 10, 48);
  }

  const asphaltMap = new THREE.CanvasTexture(asphaltCanvas);
  asphaltMap.colorSpace = THREE.SRGBColorSpace;
  asphaltMap.wrapS = THREE.RepeatWrapping;
  asphaltMap.wrapT = THREE.RepeatWrapping;
  asphaltMap.repeat.set(1, 5);
  asphaltMap.anisotropy = maxAnisotropy;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3600; i++) {
    const x = (i * 53) % 256;
    const y = (i * 113) % 256;
    const v = 90 + ((i * 41) % 85);
    bctx.fillStyle = `rgb(${v},${v},${v})`;
    bctx.fillRect(x, y, 2, 2);
  }
  const asphaltBump = new THREE.CanvasTexture(bumpCanvas);
  asphaltBump.colorSpace = THREE.NoColorSpace;
  asphaltBump.wrapS = THREE.RepeatWrapping;
  asphaltBump.wrapT = THREE.RepeatWrapping;
  asphaltBump.repeat.set(2, 10);
  asphaltBump.anisotropy = maxAnisotropy;

  // 2. Stucco/concrete micro-relief bump (NoColorSpace)
  const stuccoCanvas = document.createElement('canvas');
  stuccoCanvas.width = 256;
  stuccoCanvas.height = 256;
  const sctx = stuccoCanvas.getContext('2d')!;
  sctx.fillStyle = '#848484';
  sctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const x = (i * 89) % 256;
    const y = (i * 151) % 256;
    const v = 108 + ((i * 17) % 44);
    sctx.fillStyle = `rgb(${v},${v},${v})`;
    sctx.fillRect(x, y, 3, 2);
  }
  const stuccoBump = new THREE.CanvasTexture(stuccoCanvas);
  stuccoBump.colorSpace = THREE.NoColorSpace;
  stuccoBump.wrapS = THREE.RepeatWrapping;
  stuccoBump.wrapT = THREE.RepeatWrapping;
  stuccoBump.repeat.set(3, 3);
  stuccoBump.anisotropy = maxAnisotropy;

  // 3. HEPA pleated intake grille albedo (SRGBColorSpace)
  const hepaCanvas = document.createElement('canvas');
  hepaCanvas.width = 256;
  hepaCanvas.height = 256;
  const hctx = hepaCanvas.getContext('2d')!;
  hctx.fillStyle = '#e7f0ec';
  hctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 8) {
    hctx.fillStyle = x % 16 === 0 ? '#a9c1b9' : '#d5e4de';
    hctx.fillRect(x, 0, 4, 256);
  }
  for (let y = 0; y < 256; y += 32) {
    hctx.fillStyle = 'rgba(20, 90, 79, 0.25)';
    hctx.fillRect(0, y, 256, 3);
  }
  const hepaPleatMap = new THREE.CanvasTexture(hepaCanvas);
  hepaPleatMap.colorSpace = THREE.SRGBColorSpace;
  hepaPleatMap.wrapS = THREE.RepeatWrapping;
  hepaPleatMap.wrapT = THREE.RepeatWrapping;
  hepaPleatMap.anisotropy = maxAnisotropy;

  // 4. Soft radial contact shadow disc (SRGBColorSpace)
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const cctx = shadowCanvas.getContext('2d')!;
  const grad = cctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(8, 24, 24, 0.65)');
  grad.addColorStop(0.55, 'rgba(8, 24, 24, 0.24)');
  grad.addColorStop(1, 'rgba(8, 24, 24, 0)');
  cctx.fillStyle = grad;
  cctx.fillRect(0, 0, 128, 128);
  const contactShadowMap = new THREE.CanvasTexture(shadowCanvas);
  contactShadowMap.colorSpace = THREE.SRGBColorSpace;

  return {
    asphaltMap,
    asphaltBump,
    stuccoBump,
    hepaPleatMap,
    contactShadowMap,
    dispose() {
      asphaltMap.dispose();
      asphaltBump.dispose();
      stuccoBump.dispose();
      hepaPleatMap.dispose();
      contactShadowMap.dispose();
    },
  };
}
