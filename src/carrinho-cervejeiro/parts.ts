import * as THREE from 'three';
import type { Materials } from './materials';

/** Peças comuns: geometria de revolução, tubulação e conexões sanitárias DIN 11851. */

export interface PickInfo {
  id: string;
  title: string;
  description: string;
  /** Ação ao clicar (opcional). */
  action?: string;
}

export function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  options: { cast?: boolean; receive?: boolean } = {},
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.castShadow = options.cast ?? true;
  result.receiveShadow = options.receive ?? true;
  return result;
}

export function tagPick<T extends THREE.Object3D>(object: T, info: PickInfo): T {
  object.userData.pick = info;
  return object;
}

/**
 * Sólido de revolução em torno do eixo X.
 * `profile` é uma lista de [raio, x] percorrida no sentido de x crescente pela face externa;
 * cantos vivos são duplicados para manter arestas nítidas.
 */
export function latheX(profile: Array<[number, number]>, segments = 48, phiStart = 0, phiLength = Math.PI * 2): THREE.BufferGeometry {
  const points: THREE.Vector2[] = [];
  for (let i = 0; i < profile.length; i++) {
    const [r, x] = profile[i];
    const point = new THREE.Vector2(Math.max(r, 0), x);
    points.push(point);
    if (i > 0 && i < profile.length - 1) {
      const [r0, x0] = profile[i - 1];
      const [r1, x1] = profile[i + 1];
      const a = new THREE.Vector2(r - r0, x - x0).normalize();
      const b = new THREE.Vector2(r1 - r, x1 - x).normalize();
      if (a.dot(b) < Math.cos(THREE.MathUtils.degToRad(35))) points.push(point.clone());
    }
  }
  const geometry = new THREE.LatheGeometry(points, segments, phiStart, phiLength);
  geometry.rotateZ(-Math.PI / 2);
  return geometry;
}

/** Cilindro ao longo de X, de `x0` até `x0 + length`. */
export function cylinderX(radius: number, length: number, x0 = 0, segments = 32, openEnded = false): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments, 1, openEnded);
  geometry.rotateZ(-Math.PI / 2);
  geometry.translate(x0 + length / 2, 0, 0);
  return geometry;
}

/** Faixa curva em volta do eixo X (rótulos, cintas, mantas). θ=0 aponta para +Z, θ=π/2 para −Y. */
export function arcBandX(radius: number, width: number, thetaStart: number, thetaLength: number, segments = 48): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(radius, radius, width, segments, 1, true, thetaStart, thetaLength);
  geometry.rotateZ(-Math.PI / 2);
  return geometry;
}

export function hexNut(size: number, height: number): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(size, size, height, 6);
  geometry.rotateY(Math.PI / 6);
  return geometry;
}

/** Tubo com curvas suaves passando pelos pontos (cantos arredondados com raio `bend`). */
export function pipeRunGeometry(points: THREE.Vector3[], radius: number, bend: number, radialSegments = 28): THREE.TubeGeometry {
  const path = new THREE.CurvePath<THREE.Vector3>();
  let cursor = points[0].clone();
  for (let i = 1; i < points.length; i++) {
    const current = points[i];
    if (i === points.length - 1) {
      path.add(new THREE.LineCurve3(cursor, current.clone()));
      break;
    }
    const next = points[i + 1];
    const inDir = current.clone().sub(points[i - 1]).normalize();
    const outDir = next.clone().sub(current).normalize();
    const r = Math.min(bend, current.distanceTo(points[i - 1]) * 0.5, current.distanceTo(next) * 0.5);
    const a = current.clone().addScaledVector(inDir, -r);
    const b = current.clone().addScaledVector(outDir, r);
    if (cursor.distanceTo(a) > 1e-5) path.add(new THREE.LineCurve3(cursor, a));
    path.add(new THREE.QuadraticBezierCurve3(a, current.clone(), b));
    cursor = b;
  }
  const length = path.getLength();
  return new THREE.TubeGeometry(path, Math.max(24, Math.round(length * 220)), radius, radialSegments, false);
}

// ——— DIN 11851 DN50 (2") ———

export const DIN = {
  /** Raio externo do tubo DN50 (53 × 1,5 mm). */
  pipeRadius: 0.0265,
  threadRadius: 0.039,
  nutRadius: 0.046,
  /** Comprimento da união montada: do início do macho até o início da mangueira. */
  unionLength: 0.112,
  hoseRadius: 0.032,
};

/** Macho roscado (Gewindestutzen) — rosca redonda Rd 78 × 1/6". */
export function dinMaleGeometry(): THREE.BufferGeometry {
  const profile: Array<[number, number]> = [
    [DIN.pipeRadius, 0],
    [DIN.pipeRadius, 0.006],
    [0.0285, 0.008],
    [0.0355, 0.0095],
    [0.0355, 0.013],
  ];
  // Filetes da rosca redonda (passo de 4,23 mm).
  const pitch = 0.00423;
  for (let i = 0; i < 6; i++) {
    const x = 0.0135 + i * pitch;
    profile.push([0.0372, x], [DIN.threadRadius, x + pitch * 0.35], [DIN.threadRadius, x + pitch * 0.6], [0.0372, x + pitch * 0.95]);
  }
  profile.push([0.0362, 0.0395], [0.0335, 0.041], [0.0248, 0.041], [0.0248, 0.0], [DIN.pipeRadius - 0.0001, 0]);
  return latheX(profile, 48);
}

/** Porca ranhurada (Nutmutter) com os quatro rasgos para chave de gancho. */
export function dinNutGeometry(): THREE.BufferGeometry {
  const outer = 0.0445;
  const shape = new THREE.Shape();
  const slots = 4;
  const slotHalf = 0.0065 / outer; // meia largura angular
  const slotDepth = 0.0065;
  for (let i = 0; i < slots; i++) {
    const center = (i / slots) * Math.PI * 2 + Math.PI / 4;
    const a0 = center - Math.PI / slots + 0.0001;
    const a1 = center - slotHalf;
    const a2 = center + slotHalf;
    if (i === 0) shape.moveTo(Math.cos(a0) * outer, Math.sin(a0) * outer);
    shape.absarc(0, 0, outer, a0, a1, false);
    shape.lineTo(Math.cos(a1) * (outer - slotDepth), Math.sin(a1) * (outer - slotDepth));
    shape.lineTo(Math.cos(a2) * (outer - slotDepth), Math.sin(a2) * (outer - slotDepth));
    shape.lineTo(Math.cos(a2) * outer, Math.sin(a2) * outer);
    shape.absarc(0, 0, outer, a2, center + Math.PI / slots, false);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.0318, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.028,
    bevelEnabled: true,
    bevelThickness: 0.0018,
    bevelSize: 0.0012,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geometry.rotateY(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/** Espigão com luva prensada (lado da mangueira). */
export function hoseFerruleGeometry(): THREE.BufferGeometry {
  const profile: Array<[number, number]> = [
    [0.0248, 0],
    [0.0318, 0],
    [0.0318, 0.004],
    [0.0368, 0.006],
  ];
  for (let i = 0; i < 3; i++) {
    const x = 0.014 + i * 0.016;
    profile.push([0.0368, x], [0.0352, x + 0.002], [0.0352, x + 0.006], [0.0368, x + 0.008]);
  }
  profile.push([0.0368, 0.06], [0.0335, 0.066], [0.0248, 0.066], [0.0248, 0]);
  return latheX(profile, 48);
}

/**
 * União DIN 11851 completa ao longo de +X: macho (lado da peça), porca ranhurada e
 * espigão da mangueira. A mangueira começa em x = DIN.unionLength.
 */
export function dinUnion(materials: Materials, cache: GeometryCache): THREE.Group {
  const group = new THREE.Group();
  group.name = 'uniao-din-11851';
  group.add(mesh(cache.get('din-male', dinMaleGeometry), materials.steelPolished));
  const nut = mesh(cache.get('din-nut', dinNutGeometry), materials.steelPolished);
  nut.position.x = 0.021;
  group.add(nut);
  const ferrule = mesh(cache.get('din-ferrule', hoseFerruleGeometry), materials.steelSatin);
  ferrule.position.x = 0.05;
  group.add(ferrule);
  return group;
}

/** Ponta macho roscada sozinha (para o medidor, que recebe a porca da mangueira). */
export function dinMale(materials: Materials, cache: GeometryCache): THREE.Mesh {
  return mesh(cache.get('din-male', dinMaleGeometry), materials.steelPolished);
}

// ——— Válvula borboleta sanitária ———

export interface ButterflyValve {
  group: THREE.Group;
  pivot: THREE.Group;
  setOpen(fraction: number): void;
}

/**
 * Válvula borboleta DN50 centrada na origem, eixo do tubo em X, haste para +Y.
 * O manete fica paralelo ao tubo quando aberta e transversal quando fechada.
 */
export function butterflyValve(
  materials: Materials,
  cache: GeometryCache,
  accent: THREE.Material,
  angles: { open: number; closed: number },
): ButterflyValve {
  const group = new THREE.Group();
  group.name = 'valvula-borboleta';
  const half = cache.get('bfv-half', () =>
    latheX([
      [DIN.pipeRadius, -0.05],
      [DIN.pipeRadius, -0.03],
      [0.03, -0.028],
      [0.0455, -0.022],
      [0.0465, -0.019],
      [0.0465, -0.003],
      [0.042, -0.002],
      [0.025, -0.002],
      [0.025, -0.05],
    ]),
  );
  const left = mesh(half, materials.steelPolished);
  const right = mesh(half, materials.steelPolished);
  right.scale.x = -1;
  group.add(left, right);
  const seal = mesh(cache.get('bfv-seal', () => cylinderX(0.0448, 0.004, -0.002, 40)), materials.gasket);
  group.add(seal);

  // Parafusos axiais que unem as duas metades.
  const boltGeometry = cache.get('bfv-bolt', () => {
    const g = hexNut(0.0045, 0.006);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + (i * Math.PI) / 2;
    for (const side of [-1, 1]) {
      const bolt = mesh(boltGeometry, materials.steelSatin);
      bolt.position.set(side * 0.022, Math.sin(angle) * 0.036, Math.cos(angle) * 0.036);
      group.add(bolt);
    }
  }

  // Haste, placa de posições e manete.
  const boss = mesh(cache.get('bfv-boss', () => new THREE.CylinderGeometry(0.0105, 0.012, 0.018, 24)), materials.steelPolished);
  boss.position.y = 0.053;
  group.add(boss);
  const plate = mesh(
    cache.get('bfv-plate', () => new THREE.CylinderGeometry(0.034, 0.034, 0.003, 32, 1, false, -Math.PI / 2, Math.PI)),
    materials.steelSatin,
  );
  plate.position.y = 0.0615;
  plate.rotation.y = angles.closed;
  group.add(plate);
  for (let i = 0; i <= 4; i++) {
    const notch = mesh(cache.get('bfv-notch', () => new THREE.BoxGeometry(0.008, 0.0035, 0.0025)), materials.darkSlot, { cast: false });
    const a = angles.closed - Math.PI / 2 + (i / 4) * Math.PI;
    notch.position.set(Math.cos(a) * 0.031, 0.0617, -Math.sin(a) * 0.031);
    notch.rotation.y = a;
    group.add(notch);
  }

  const pivot = new THREE.Group();
  pivot.position.y = 0.066;
  const lever = mesh(
    cache.get('bfv-lever', () => {
      const g = new THREE.BoxGeometry(0.15, 0.005, 0.02);
      g.translate(0.065, 0, 0);
      return g;
    }),
    materials.steelPolished,
  );
  pivot.add(lever);
  const trigger = mesh(
    cache.get('bfv-trigger', () => {
      const g = new THREE.BoxGeometry(0.07, 0.012, 0.016);
      g.translate(0.085, -0.008, 0);
      return g;
    }),
    materials.steelSatin,
  );
  pivot.add(trigger);
  const grip = mesh(
    cache.get('bfv-grip', () => {
      const g = new THREE.CapsuleGeometry(0.011, 0.045, 6, 16);
      g.rotateZ(Math.PI / 2);
      g.scale(1, 0.85, 1.15);
      g.translate(0.122, 0.002, 0);
      return g;
    }),
    accent,
  );
  pivot.add(grip);
  const cap = mesh(cache.get('bfv-cap', () => hexNut(0.008, 0.007)), materials.steelPolished);
  cap.position.y = 0.006;
  pivot.add(cap);
  group.add(pivot);

  const setOpen = (fraction: number) => {
    const f = THREE.MathUtils.clamp(fraction, 0, 1);
    const eased = f * f * (3 - 2 * f);
    pivot.rotation.y = THREE.MathUtils.lerp(angles.closed, angles.open, eased);
  };
  setOpen(0);
  return { group, pivot, setOpen };
}

// ——— Manômetro ———

export interface Gauge {
  group: THREE.Group;
  setPressure(bar: number): void;
}

function gaugeDialTexture(label: string): THREE.CanvasTexture {
  const size = 512;
  const element = document.createElement('canvas');
  element.width = size;
  element.height = size;
  const ctx = element.getContext('2d')!;
  const c = size / 2;
  ctx.fillStyle = '#f7f7f4';
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();
  const start = (135 * Math.PI) / 180;
  const sweep = (270 * Math.PI) / 180;
  // Faixa vermelha acima de 3 bar.
  ctx.strokeStyle = '#d23a2f';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(c, c, c * 0.78, start + sweep * 0.75, start + sweep);
  ctx.stroke();
  ctx.strokeStyle = '#1b2026';
  ctx.fillStyle = '#1b2026';
  for (let i = 0; i <= 40; i++) {
    const a = start + (i / 40) * sweep;
    const major = i % 10 === 0;
    const half = i % 5 === 0;
    const r0 = c * (major ? 0.66 : half ? 0.7 : 0.74);
    ctx.lineWidth = major ? 7 : 3;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
    ctx.lineTo(c + Math.cos(a) * c * 0.84, c + Math.sin(a) * c * 0.84);
    ctx.stroke();
    if (major) {
      ctx.font = '600 60px "Inter Variable", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i / 10), c + Math.cos(a) * c * 0.5, c + Math.sin(a) * c * 0.5);
    }
  }
  ctx.font = '600 46px "Inter Variable", system-ui, sans-serif';
  ctx.fillText('bar', c, c + c * 0.42);
  ctx.font = '500 34px "Inter Variable", system-ui, sans-serif';
  ctx.fillStyle = '#5b6570';
  ctx.fillText(label, c, c - c * 0.36);
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Manômetro de 63 mm com o mostrador voltado para +Z e a conexão para −Y. */
export function pressureGauge(materials: Materials, cache: GeometryCache, label: string): Gauge {
  const group = new THREE.Group();
  group.name = 'manometro';
  const radius = 0.034;
  const caseGeometry = cache.get('gauge-case', () => {
    const g = latheX([
      [0, -0.016],
      [radius - 0.004, -0.016],
      [radius, -0.012],
      [radius, 0.004],
      [radius + 0.0025, 0.006],
      [radius + 0.0025, 0.011],
      [radius - 0.002, 0.012],
      [radius - 0.002, 0.008],
      [0, 0.008],
    ]);
    g.rotateY(-Math.PI / 2);
    return g;
  });
  group.add(mesh(caseGeometry, materials.steelPolished));
  const dial = new THREE.Mesh(
    cache.get('gauge-dial', () => new THREE.CircleGeometry(radius - 0.002, 48)),
    new THREE.MeshStandardMaterial({ map: gaugeDialTexture(label), roughness: 0.55 }),
  );
  dial.position.z = 0.0085;
  group.add(dial);
  const needle = new THREE.Group();
  needle.position.z = 0.0105;
  const needleMesh = new THREE.Mesh(
    cache.get('gauge-needle', () => {
      const shape = new THREE.Shape();
      shape.moveTo(-0.0012, -0.006);
      shape.lineTo(0.0012, -0.006);
      shape.lineTo(0.0004, 0.026);
      shape.lineTo(-0.0004, 0.026);
      shape.closePath();
      return new THREE.ShapeGeometry(shape);
    }),
    new THREE.MeshStandardMaterial({ color: 0xc62a22, roughness: 0.4 }),
  );
  needle.add(needleMesh);
  const hub = new THREE.Mesh(cache.get('gauge-hub', () => new THREE.CircleGeometry(0.0032, 16)), materials.meterBezel);
  hub.position.z = 0.0003;
  needle.add(hub);
  group.add(needle);
  const glass = new THREE.Mesh(cache.get('gauge-glass', () => new THREE.CircleGeometry(radius - 0.001, 48)), materials.glass);
  glass.position.z = 0.0118;
  group.add(glass);
  // Conexão inferior.
  const socket = mesh(cache.get('gauge-socket', () => hexNut(0.008, 0.012)), materials.steelPolished);
  socket.position.y = -radius - 0.006;
  group.add(socket);
  const stem = mesh(cache.get('gauge-stem', () => new THREE.CylinderGeometry(0.0055, 0.0055, 0.03, 16)), materials.steelPolished);
  stem.position.y = -radius - 0.026;
  group.add(stem);

  const setPressure = (bar: number) => {
    const p = THREE.MathUtils.clamp(bar, 0, 4);
    needle.rotation.z = THREE.MathUtils.degToRad(135 - (p / 4) * 270);
  };
  setPressure(0);
  return { group, setPressure };
}

/** Cache simples para reaproveitar geometrias iguais. */
export class GeometryCache {
  private readonly items = new Map<string, THREE.BufferGeometry>();
  get(key: string, create: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let geometry = this.items.get(key);
    if (!geometry) {
      geometry = create();
      this.items.set(key, geometry);
    }
    return geometry;
  }
}
