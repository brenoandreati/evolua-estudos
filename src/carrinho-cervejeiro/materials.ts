import * as THREE from 'three';

/** Texturas e materiais gerados no próprio navegador (nenhum arquivo externo). */

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const context = element.getContext('2d');
  if (!context) throw new Error('Canvas 2D indisponível.');
  return [element, context];
}

/** Riscos finos de aço escovado (usados como mapa de rugosidade). */
function brushedTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [element, ctx] = canvas(1024, 1024);
  ctx.fillStyle = 'rgb(205,205,205)';
  ctx.fillRect(0, 0, 1024, 1024);
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 9000; i++) {
    const y = rand() * 1024;
    const x = rand() * 1024;
    const length = 80 + rand() * 700;
    const tone = 150 + rand() * 105;
    ctx.strokeStyle = `rgba(${tone},${tone},${tone},${0.25 + rand() * 0.5})`;
    ctx.lineWidth = rand() < 0.85 ? 1 : 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y + (rand() - 0.5) * 1.5);
    ctx.stroke();
    if (x + length > 1024) {
      ctx.beginPath();
      ctx.moveTo(x - 1024, y);
      ctx.lineTo(x + length - 1024, y);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(element);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

/** Piso de epóxi com uma grade discreta de 25 cm (referência de escala). */
function floorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [element, ctx] = canvas(1024, 1024);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1024, 1024);
  const image = ctx.getImageData(0, 0, 1024, 1024);
  let seed = 3;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const n = 246 + (seed / 2147483647) * 9;
    image.data[i] = n;
    image.data[i + 1] = n;
    image.data[i + 2] = n;
  }
  ctx.putImageData(image, 0, 0);
  // 1 tile = 1 m. Linhas finas a cada 25 cm, mais marcadas a cada metro.
  ctx.strokeStyle = 'rgba(120,128,138,0.22)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    const p = (i * 1024) / 4;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 1024);
    ctx.moveTo(0, p);
    ctx.lineTo(1024, p);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(110,118,128,0.42)';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, 1024, 1024);
  const texture = new THREE.CanvasTexture(element);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

/** Sombra de contato suave para "assentar" o carrinho no piso. */
export function contactShadowTexture(): THREE.CanvasTexture {
  const [element, ctx] = canvas(256, 256);
  const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Ponto redondo e macio para gotas e respingos. */
export function dropletTexture(): THREE.CanvasTexture {
  const [element, ctx] = canvas(64, 64);
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.75)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface Materials {
  /** Aço inox escovado (estrutura, base, tanques). */
  steel: THREE.MeshPhysicalMaterial;
  /** Aço inox escovado no sentido vertical (colunas). */
  steelVertical: THREE.MeshPhysicalMaterial;
  /** Aço inox polido (conexões sanitárias, porcas, válvulas). */
  steelPolished: THREE.MeshPhysicalMaterial;
  /** Aço inox acetinado (rodízios, suportes). */
  steelSatin: THREE.MeshPhysicalMaterial;
  /** Cordão de solda com leve coloração térmica. */
  weld: THREE.MeshPhysicalMaterial;
  rubber: THREE.MeshStandardMaterial;
  wheelHub: THREE.MeshPhysicalMaterial;
  gripFoam: THREE.MeshStandardMaterial;
  gasket: THREE.MeshStandardMaterial;
  brakeRed: THREE.MeshPhysicalMaterial;
  accentWater: THREE.MeshPhysicalMaterial;
  accentBeer: THREE.MeshPhysicalMaterial;
  /** Corpo do medidor (polímero técnico). */
  meterBody: THREE.MeshPhysicalMaterial;
  meterBezel: THREE.MeshPhysicalMaterial;
  meterLiner: THREE.MeshPhysicalMaterial;
  copper: THREE.MeshPhysicalMaterial;
  /** Mangueira cristal com reforço em espiral. */
  hose: THREE.MeshPhysicalMaterial;
  hoseWire: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  darkSlot: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  quickCoupler: THREE.MeshPhysicalMaterial;
}

export function createMaterials(renderer: THREE.WebGLRenderer): Materials {
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const brushed = brushedTexture(maxAnisotropy);
  const brushedVertical = brushed.clone();
  brushedVertical.center.set(0.5, 0.5);
  brushedVertical.rotation = Math.PI / 2;

  const floorMap = floorTexture(maxAnisotropy);
  floorMap.repeat.set(40, 40);

  const steel = new THREE.MeshPhysicalMaterial({
    name: 'aco-inox-escovado',
    color: 0xccd1d7,
    metalness: 1,
    roughness: 0.42,
    roughnessMap: brushed,
    anisotropy: 0.75,
    clearcoat: 0.08,
    clearcoatRoughness: 0.35,
  });

  const steelVertical = steel.clone();
  steelVertical.name = 'aco-inox-escovado-vertical';
  steelVertical.roughnessMap = brushedVertical;
  steelVertical.anisotropyRotation = Math.PI / 2;

  return {
    steel,
    steelVertical,
    steelPolished: new THREE.MeshPhysicalMaterial({
      name: 'aco-inox-polido',
      color: 0xe4e7eb,
      metalness: 1,
      roughness: 0.13,
      clearcoat: 0.3,
      clearcoatRoughness: 0.1,
    }),
    steelSatin: new THREE.MeshPhysicalMaterial({
      name: 'aco-inox-acetinado',
      color: 0xc3c8ce,
      metalness: 1,
      roughness: 0.3,
      roughnessMap: brushed,
      anisotropy: 0.4,
    }),
    weld: new THREE.MeshPhysicalMaterial({
      name: 'cordao-de-solda',
      color: 0xc9b99a,
      metalness: 1,
      roughness: 0.38,
    }),
    rubber: new THREE.MeshStandardMaterial({ name: 'borracha', color: 0x2a2d31, roughness: 0.82, metalness: 0 }),
    wheelHub: new THREE.MeshPhysicalMaterial({
      name: 'cubo-poliamida',
      color: 0xd8d9d4,
      roughness: 0.48,
      metalness: 0,
      clearcoat: 0.25,
    }),
    gripFoam: new THREE.MeshStandardMaterial({ name: 'manopla', color: 0x1d2024, roughness: 0.92 }),
    gasket: new THREE.MeshStandardMaterial({ name: 'vedacao-epdm', color: 0x16181b, roughness: 0.7 }),
    brakeRed: new THREE.MeshPhysicalMaterial({ name: 'freio', color: 0xc8312b, roughness: 0.42, clearcoat: 0.4 }),
    accentWater: new THREE.MeshPhysicalMaterial({ name: 'manete-agua', color: 0x1f6fd1, roughness: 0.4, clearcoat: 0.5 }),
    accentBeer: new THREE.MeshPhysicalMaterial({ name: 'manete-cerveja', color: 0xd9890f, roughness: 0.4, clearcoat: 0.5 }),
    meterBody: new THREE.MeshPhysicalMaterial({
      name: 'medidor-corpo',
      color: 0x31455a,
      roughness: 0.38,
      metalness: 0.15,
      clearcoat: 0.55,
      clearcoatRoughness: 0.25,
    }),
    meterBezel: new THREE.MeshPhysicalMaterial({
      name: 'medidor-moldura',
      color: 0x101820,
      roughness: 0.25,
      metalness: 0.1,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
    }),
    meterLiner: new THREE.MeshPhysicalMaterial({
      name: 'revestimento-pfa',
      color: 0xf2efe6,
      roughness: 0.35,
      transmission: 0,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
    copper: new THREE.MeshPhysicalMaterial({ name: 'bobina-cobre', color: 0xc8743f, metalness: 1, roughness: 0.32 }),
    hose: new THREE.MeshPhysicalMaterial({
      name: 'mangueira-cristal',
      color: 0xe6f0ee,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.5,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    hoseWire: new THREE.MeshStandardMaterial({ name: 'espiral-aco', color: 0x7d868f, metalness: 0.85, roughness: 0.38 }),
    glass: new THREE.MeshPhysicalMaterial({
      name: 'vidro',
      color: 0xffffff,
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.16,
      clearcoat: 1,
      depthWrite: false,
    }),
    darkSlot: new THREE.MeshStandardMaterial({ name: 'canaleta', color: 0x0d0f12, roughness: 0.9 }),
    floor: new THREE.MeshStandardMaterial({ name: 'piso-epoxi', color: 0xd3d7db, map: floorMap, roughness: 0.62, metalness: 0 }),
    quickCoupler: new THREE.MeshPhysicalMaterial({ name: 'engate-co2', color: 0x4b5560, roughness: 0.35, metalness: 0.6 }),
  };
}

/**
 * Estúdio para os reflexos do aço: sala em cinza médio com softboxes em faixas.
 * O contraste entre faixas claras e áreas escuras é o que faz o inox parecer inox.
 */
export function studioEnvironment(): THREE.Scene {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(24, 12, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.215, 0.235), side: THREE.BackSide }),
  );
  room.position.y = 5;
  env.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.42, 0.43, 0.45) }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.98;
  env.add(floor);
  const softbox = (w: number, h: number, intensity: number, position: [number, number, number], tint = 1) => {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity * tint), side: THREE.DoubleSide }),
    );
    panel.position.set(...position);
    panel.lookAt(0, 0.5, 0);
    env.add(panel);
  };
  softbox(6, 2.4, 2.6, [0, 9, 0]);
  softbox(1.4, 7, 5.5, [7, 3.5, 5]);
  softbox(1.2, 7, 2.6, [-7.5, 3.5, 3], 1.06);
  softbox(9, 1.1, 2.4, [0, 3, -9]);
  softbox(4, 0.7, 1.2, [3, 1.2, 9]);
  softbox(2.2, 2.2, 3.5, [-4, 6, -6], 0.95);
  return env;
}

/**
 * Tubo transparente: quase invisível de frente e mais opaco nas bordas (efeito Fresnel),
 * como uma mangueira cristal de verdade.
 */
export function applyClearTubeShader(material: THREE.MeshPhysicalMaterial): THREE.MeshPhysicalMaterial {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float tubeFacing = abs(dot(normalize(geometryNormal), normalize(geometryViewDir)));
      diffuseColor.a *= mix(1.7, 0.22, pow(tubeFacing, 0.8));
      diffuseColor.a = clamp(diffuseColor.a, 0.0, 0.92);
      #include <opaque_fragment>`,
    );
  };
  material.customProgramCacheKey = () => 'tubo-cristal';
  return material;
}
