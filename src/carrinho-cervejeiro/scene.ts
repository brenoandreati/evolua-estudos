import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CART, createCart, type CartModel } from './cart';
import type { Materials } from './materials';
import { dropletTexture } from './materials';
import { DIN, GeometryCache, mesh, tagPick } from './parts';
import { TANK, createTank, type TankModel } from './tanks';
import { METER, createPicomag, type PicomagModel } from './picomag';
import { METER_X, PIPE_Y, createDischarge, createManifold, type DischargeModel, type ManifoldModel } from './manifold';
import { createHose, hoseCurve, type HoseModel } from './hoses';
import type { FluidMaterial } from './fluid';
import { FLUID_LOOKS } from './fluid';
import type { FluidId, SegmentSpec } from './simulation';

/** Monta o carrinho completo, as mangueiras e o circuito usado pela simulação. */

export interface FluidBinding {
  segment: string;
  material: FluidMaterial;
  mesh: THREE.Mesh;
}

export interface CalloutAnchor {
  id: string;
  label: string;
  object: THREE.Object3D;
  /** Distância da câmera ao focar este ponto. */
  focusDistance: number;
}

export interface BreweryCart {
  root: THREE.Group;
  cart: CartModel;
  tanks: Record<FluidId, TankModel>;
  manifold: ManifoldModel;
  picomag: PicomagModel;
  discharge: DischargeModel;
  hoses: Record<'agua' | 'cerveja' | 'outlet', HoseModel>;
  segments: SegmentSpec[];
  paths: Record<FluidId, string[]>;
  bindings: FluidBinding[];
  assembly: Assembly;
  callouts: CalloutAnchor[];
  splash: Splash;
}

export function buildBreweryCart(materials: Materials, lightDir: THREE.Vector3): BreweryCart {
  const cache = new GeometryCache();
  const root = new THREE.Group();
  root.name = 'cena';

  const cart = createCart(materials, cache);
  root.add(cart.group);

  const tanks: Record<FluidId, TankModel> = {
    agua: createTank(materials, cache, {
      fluid: 'agua',
      name: 'ÁGUA',
      number: '01',
      accent: materials.accentWater,
      accentColor: '#1f6fd1',
      description: 'Água cervejeira para enxágue, empurre de linha e testes de vazão. Fixado na prateleira inferior por berços e cintas de inox.',
    }),
    cerveja: createTank(materials, cache, {
      fluid: 'cerveja',
      name: 'CERVEJA',
      number: '02',
      accent: materials.accentBeer,
      accentColor: '#c97a06',
      description: 'Cerveja pronta, gelada e carbonatada, empurrada por CO₂. Fixado na prateleira intermediária por berços e cintas de inox.',
    }),
  };
  tanks.agua.group.position.set(TANK.centerX, CART.shelves[0] + TANK.saddleHeight + TANK.radius, 0);
  tanks.cerveja.group.position.set(TANK.centerX, CART.shelves[1] + TANK.saddleHeight + TANK.radius, 0);
  root.add(tanks.agua.group, tanks.cerveja.group);

  const manifold = createManifold(materials, cache);
  root.add(manifold.group);

  const picomag = createPicomag(materials, cache, lightDir);
  picomag.group.position.set(METER_X, PIPE_Y, 0);
  addMeterMount(picomag.group, materials);
  root.add(picomag.group);

  const discharge = createDischarge(materials, cache, lightDir);
  root.add(discharge.group);
  root.add(discharge.drain);

  root.updateMatrixWorld(true);

  // ——— Mangueiras ———
  const port = (object: THREE.Object3D) => {
    const position = object.getWorldPosition(new THREE.Vector3());
    const direction = new THREE.Vector3(1, 0, 0).applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));
    return { position, direction };
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  const aguaCurve = hoseCurve(
    port(tanks.agua.hosePort),
    [v(0.79, 0.3, 0.05), v(0.86, 0.5, 0.12), v(0.87, 0.8, 0.15), v(0.81, 1.04, 0.14), v(0.71, 1.105, 0.124)],
    port(manifold.ports.agua),
  );
  const cervejaCurve = hoseCurve(
    port(tanks.cerveja.hosePort),
    [v(0.765, 0.72, -0.05), v(0.79, 0.86, -0.11), v(0.765, 1.03, -0.125), v(0.7, 1.1, -0.121)],
    port(manifold.ports.cerveja),
  );
  const outletCurve = hoseCurve(
    port(picomag.outletPort),
    [v(-0.34, 1.098, 0.035), v(-0.46, 1.112, 0.17), v(-0.56, 1.105, 0.33), v(-0.65, 0.98, 0.43), v(-0.7, 0.76, 0.45), v(-0.705, 0.56, 0.4), v(-0.73, 0.45, 0.345)],
    port(discharge.port),
  );

  const hosePick = {
    id: 'mangueira',
    title: 'Mangueira cristal 2" com espiral de aço',
    description: 'PVC atóxico transparente para alimentos, reforço em espiral de aço e pontas com união DIN 11851. Dá para ver o produto passando.',
  };
  const hoses = {
    agua: createHose(aguaCurve, materials, { lightDir, pick: hosePick }),
    cerveja: createHose(cervejaCurve, materials, { lightDir, pick: hosePick }),
    outlet: createHose(outletCurve, materials, { lightDir, pick: hosePick }),
  };
  root.add(hoses.agua.group, hoses.cerveja.group, hoses.outlet.group);

  // ——— Circuito para a simulação ———
  const tankOutlet = 0.06 + 0.1 + DIN.unionLength;
  const segments: SegmentSpec[] = [
    { id: 'tank-agua', length: tankOutlet },
    { id: 'supply-agua', length: hoses.agua.length },
    { id: 'manifold-agua', length: manifold.lengths.branch.agua },
    { id: 'tank-cerveja', length: tankOutlet },
    { id: 'supply-cerveja', length: hoses.cerveja.length },
    { id: 'manifold-cerveja', length: manifold.lengths.branch.cerveja },
    { id: 'header', length: manifold.lengths.header },
    { id: 'meter', length: METER.coreLength },
    { id: 'meter-out', length: METER.stub - METER.coreLength / 2 + DIN.unionLength },
    { id: 'outlet', length: hoses.outlet.length },
    { id: 'spout', length: discharge.spoutLength },
    { id: 'stream', length: discharge.streamLength },
  ];
  const shared = ['header', 'meter', 'meter-out', 'outlet', 'spout', 'stream'];
  const paths: Record<FluidId, string[]> = {
    agua: ['tank-agua', 'supply-agua', 'manifold-agua', ...shared],
    cerveja: ['tank-cerveja', 'supply-cerveja', 'manifold-cerveja', ...shared],
  };
  const bindings: FluidBinding[] = [
    { segment: 'supply-agua', material: hoses.agua.fluidMaterial, mesh: hoses.agua.fluid },
    { segment: 'supply-cerveja', material: hoses.cerveja.fluidMaterial, mesh: hoses.cerveja.fluid },
    { segment: 'meter', material: picomag.fluidMaterial, mesh: picomag.fluid },
    { segment: 'outlet', material: hoses.outlet.fluidMaterial, mesh: hoses.outlet.fluid },
    { segment: 'stream', material: discharge.streamMaterial, mesh: discharge.stream },
  ];

  // ——— Montagem / vista explodida ———
  const assembly = new Assembly();
  cart.casters.forEach((caster, i) => {
    const sx = Math.sign(caster.position.x);
    const sz = Math.sign(caster.position.z);
    assembly.add(caster, v(sx * 0.1, -0.22, sz * 0.1), 0.02 * i);
  });
  assembly.add(cart.shelves[0], v(0, -0.07, 0), 0.06);
  cart.posts.forEach((post, i) => {
    assembly.add(post, v(Math.sign(post.position.x) * 0.17, 0.06, Math.sign(post.position.z) * 0.15), 0.1 + 0.015 * i);
  });
  assembly.add(cart.shelves[1], v(0, 0.2, 0), 0.16);
  assembly.add(cart.shelves[2], v(0, 0.5, 0), 0.22);
  assembly.add(cart.handle, v(-0.34, 0.56, 0), 0.28);
  assembly.add(tanks.agua.group, v(0, 0.02, 0.66), 0.32);
  assembly.add(tanks.cerveja.group, v(0, 0.24, 0.76), 0.38);
  assembly.add(manifold.group, v(0.3, 0.64, -0.12), 0.44);
  assembly.add(picomag.group, v(0, 0.86, 0.24), 0.5);
  assembly.add(discharge.group, v(-0.3, 0.3, 0.22), 0.46);
  assembly.hoseStart = 0.6;

  // ——— Pontos de legenda ———
  const anchor = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const hoseMid = hoses.agua.curve.getPointAt(0.42);
  const callouts: CalloutAnchor[] = [
    { id: 'picomag', label: 'Picomag DN50', object: picomag.displayAnchor, focusDistance: 1.05 },
    { id: 'cerveja', label: 'Tanque CERVEJA', object: anchor(tanks.cerveja.group, -0.33, 0.07, TANK.radius + 0.03), focusDistance: 1.5 },
    { id: 'agua', label: 'Tanque ÁGUA', object: anchor(tanks.agua.group, -0.33, 0.07, TANK.radius + 0.03), focusDistance: 1.5 },
    { id: 'din', label: 'União DIN 11851 · 2"', object: anchor(tanks.cerveja.group, 0.63, TANK.outletY + 0.055, 0.03), focusDistance: 0.75 },
    { id: 'manifold', label: 'Manifold', object: manifold.anchor, focusDistance: 0.95 },
    { id: 'mangueira', label: 'Mangueira cristal 2"', object: anchor(root, hoseMid.x + 0.04, hoseMid.y, hoseMid.z + 0.05), focusDistance: 1.3 },
    { id: 'rodizios', label: 'Rodízio Ø125 mm', object: anchor(cart.casters[3], 0.05, -0.1, 0.06), focusDistance: 0.85 },
    { id: 'descarga', label: 'Descarga', object: discharge.anchor, focusDistance: 1.25 },
    { id: 'estrutura', label: 'Inox AISI 304', object: anchor(cart.shelves[2], -0.36, 0.03, 0.31), focusDistance: 1.9 },
  ];

  const splash = new Splash(discharge.splashOrigin);
  root.add(splash.group);

  return { root, cart, tanks, manifold, picomag, discharge, hoses, segments, paths, bindings, assembly, callouts, splash };
}

/** Base do medidor parafusada na prateleira superior. */
function addMeterMount(meter: THREE.Group, materials: Materials) {
  const shelfTop = CART.shelves[2] - PIPE_Y;
  const plate = mesh(new RoundedBoxGeometry(0.22, 0.006, 0.13, 2, 0.002), materials.steelSatin);
  plate.position.set(0, shelfTop + 0.003, 0);
  meter.add(plate);
  const block = mesh(new RoundedBoxGeometry(0.12, -0.055 - (shelfTop + 0.006) + 0.004, 0.075, 2, 0.003), materials.steelSatin);
  block.position.set(0, (shelfTop + 0.006 - 0.055) / 2, 0);
  meter.add(block);
  const nut = new THREE.CylinderGeometry(0.006, 0.006, 0.006, 6);
  for (const x of [-0.09, 0.09]) {
    for (const z of [-0.045, 0.045]) {
      const n = mesh(nut, materials.steelPolished);
      n.position.set(x, shelfTop + 0.009, z);
      meter.add(n);
    }
  }
  tagPick(plate, {
    id: 'picomag',
    title: 'Base do medidor',
    description: 'Suporte em inox parafusado na prateleira superior; o medidor fica alinhado com o manifold.',
  });
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface AssemblyItem {
  object: THREE.Object3D;
  base: THREE.Vector3;
  offset: THREE.Vector3;
  start: number;
}

/** Animação de montagem: cada peça entra em sequência a partir da posição explodida. */
export class Assembly {
  readonly items: AssemblyItem[] = [];
  hoseStart = 0.6;
  /** 0 = explodido, 1 = montado. */
  progress = 1;
  target = 1;
  private readonly window = 0.4;

  add(object: THREE.Object3D, offset: THREE.Vector3, start: number) {
    this.items.push({ object, base: object.position.clone(), offset, start: Math.min(start, 1 - this.window) });
  }

  get assembled(): boolean {
    return this.progress >= 1 && this.target === 1;
  }

  get animating(): boolean {
    return this.progress !== this.target;
  }

  /** Avança a animação; `duration` é o tempo total de montagem em segundos. */
  update(dt: number, duration: number): void {
    if (this.progress !== this.target) {
      const step = dt / duration;
      this.progress = this.target > this.progress ? Math.min(this.target, this.progress + step) : Math.max(this.target, this.progress - step);
    }
    this.apply(this.progress);
  }

  apply(g: number): void {
    for (const item of this.items) {
      const p = ease(THREE.MathUtils.clamp((g - item.start) / this.window, 0, 1));
      item.object.position.copy(item.base).addScaledVector(item.offset, 1 - p);
    }
  }

  /** Opacidade das mangueiras (só aparecem com tudo encaixado). */
  get hoseOpacity(): number {
    return ease(THREE.MathUtils.clamp((this.progress - this.hoseStart) / this.window, 0, 1));
  }
}

/** Respingos no ralo enquanto o jato cai. */
export class Splash {
  readonly group = new THREE.Group();
  private readonly count = 90;
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly life: Float32Array;
  private readonly points: THREE.Points;
  private readonly material: THREE.PointsMaterial;
  private readonly puddle: THREE.Mesh;
  private readonly puddleMaterial: THREE.MeshBasicMaterial;
  private spawnAccumulator = 0;

  constructor(private readonly origin: THREE.Vector3) {
    this.positions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.PointsMaterial({
      size: 0.011,
      map: dropletTexture(),
      transparent: true,
      depthWrite: false,
      color: 0xffffff,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    for (let i = 0; i < this.count; i++) this.positions[i * 3 + 1] = -10;

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.puddleMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0 });
    this.puddle = new THREE.Mesh(new THREE.CircleGeometry(0.09, 32), this.puddleMaterial);
    this.puddle.rotation.x = -Math.PI / 2;
    this.puddle.position.copy(origin).setY(origin.y + 0.002);
    this.group.add(this.puddle);
  }

  update(dt: number, intensity: number, fluid: FluidId | null, time: number): void {
    const look = FLUID_LOOKS[fluid ?? 'agua'];
    const tint = look.color.clone().lerp(new THREE.Color(1, 1, 1), fluid === 'cerveja' ? 0.55 : 0.35);
    this.material.color.copy(tint);
    this.puddleMaterial.color.copy(tint);
    this.puddleMaterial.opacity = THREE.MathUtils.lerp(this.puddleMaterial.opacity, intensity > 0 ? 0.75 : 0, 1 - Math.exp(-dt / 0.3));
    const s = 0.85 + 0.15 * Math.sin(time * 9) * intensity;
    this.puddle.scale.setScalar(s * (0.6 + 0.4 * Math.min(1, intensity)));

    this.spawnAccumulator += dt * 260 * intensity;
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      if (this.life[i] > 0) {
        this.life[i] -= dt;
        this.velocities[k + 1] -= 9.81 * dt;
        this.positions[k] += this.velocities[k] * dt;
        this.positions[k + 1] += this.velocities[k + 1] * dt;
        this.positions[k + 2] += this.velocities[k + 2] * dt;
        if (this.positions[k + 1] < this.origin.y || this.life[i] <= 0) {
          this.life[i] = 0;
          this.positions[k + 1] = -10;
        }
      } else if (this.spawnAccumulator >= 1) {
        this.spawnAccumulator -= 1;
        const a = Math.random() * Math.PI * 2;
        const speed = 0.35 + Math.random() * 0.55;
        this.positions[k] = this.origin.x + Math.cos(a) * 0.012;
        this.positions[k + 1] = this.origin.y + 0.004;
        this.positions[k + 2] = this.origin.z + Math.sin(a) * 0.012;
        this.velocities[k] = Math.cos(a) * speed * 0.6;
        this.velocities[k + 1] = 0.6 + Math.random() * 0.9;
        this.velocities[k + 2] = Math.sin(a) * speed * 0.6;
        this.life[i] = 0.5;
      }
    }
    this.spawnAccumulator = Math.min(this.spawnAccumulator, 4);
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}
