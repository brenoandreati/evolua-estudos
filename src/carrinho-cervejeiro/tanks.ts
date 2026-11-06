import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Materials } from './materials';
import {
  DIN,
  type ButterflyValve,
  type Gauge,
  GeometryCache,
  butterflyValve,
  cylinderX,
  dinUnion,
  hexNut,
  latheX,
  mesh,
  pressureGauge,
  tagPick,
} from './parts';
import type { FluidId } from './simulation';

export const TANK = {
  radius: 0.145,
  shell: 0.78,
  dish: 0.06,
  /** Centro do tanque em X (os tanques ficam deslocados para o lado do puxador). */
  centerX: -0.05,
  outletY: -0.085,
  saddleX: 0.28,
  saddleHeight: 0.025,
  /** Capacidade geométrica aproximada, em litros. */
  capacity: 55,
};

export interface TankModel {
  group: THREE.Group;
  fluid: FluidId;
  /** Ponto onde começa a mangueira (direção local +X). */
  hosePort: THREE.Object3D;
  valve: ButterflyValve;
  gauge: Gauge;
}

interface TankOptions {
  fluid: FluidId;
  name: string;
  number: string;
  accent: THREE.Material;
  accentColor: string;
  description: string;
}

export function createTank(materials: Materials, cache: GeometryCache, options: TankOptions): TankModel {
  const { radius: R, shell, dish } = TANK;
  const group = new THREE.Group();
  group.name = `tanque-${options.fluid}`;

  // Costado + tampos elípticos.
  const body = mesh(
    cache.get('tank-body', () => {
      const profile: Array<[number, number]> = [];
      const steps = 22;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * (Math.PI / 2);
        profile.push([R * Math.sin(t), -(shell / 2 + dish * Math.cos(t))]);
      }
      for (let i = steps; i >= 0; i--) {
        const t = (i / steps) * (Math.PI / 2);
        profile.push([R * Math.sin(t), shell / 2 + dish * Math.cos(t)]);
      }
      return latheX(profile, 112);
    }),
    materials.steel,
  );
  group.add(body);

  // Cordões de solda tampo/costado.
  const weld = cache.get('tank-weld', () => {
    const g = new THREE.TorusGeometry(R + 0.0006, 0.0022, 8, 112);
    g.rotateY(Math.PI / 2);
    return g;
  });
  for (const x of [-shell / 2, shell / 2]) {
    const w = mesh(weld, materials.weld);
    w.position.x = x;
    group.add(w);
  }

  // Berços, mantas de borracha e cintas de fixação.
  const saddle = cache.get('tank-saddle', () => {
    const half = 0.12;
    const base = -(R + TANK.saddleHeight);
    const cut = R + 0.004;
    const top = -Math.sqrt(cut * cut - half * half);
    const shape = new THREE.Shape();
    shape.moveTo(-half, base);
    shape.lineTo(half, base);
    shape.lineTo(half, top);
    shape.absarc(0, 0, cut, Math.atan2(top, half), Math.atan2(top, -half), true);
    shape.lineTo(-half, base);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelSize: 0.001, bevelThickness: 0.001, bevelSegments: 1, curveSegments: 32 });
    g.rotateY(Math.PI / 2);
    g.translate(-0.006, 0, 0);
    g.computeVertexNormals();
    return g;
  });
  const foot = cache.get('tank-saddle-foot', () => new RoundedBoxGeometry(0.07, 0.006, 0.27, 2, 0.002));
  const pad = cache.get('tank-pad', () =>
    latheX([[R + 0.0005, -0.016], [R + 0.0035, -0.016], [R + 0.0035, 0.016], [R + 0.0005, 0.016]], 40, Math.PI / 2 - 0.95, 1.9),
  );
  const strap = cache.get('tank-strap', () =>
    latheX([[R + 0.0005, -0.0135], [R + 0.0032, -0.0135], [R + 0.0032, 0.0135], [R + 0.0005, 0.0135]], 96, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9),
  );
  const lug = cache.get('tank-strap-lug', () => new RoundedBoxGeometry(0.03, 0.016, 0.014, 2, 0.003));
  const bolt = cache.get('tank-bolt', () => hexNut(0.0055, 0.006));
  for (const sx of [-1, 1]) {
    const x = sx * TANK.saddleX;
    const s = mesh(saddle, materials.steelSatin);
    s.position.x = x;
    group.add(s);
    const f = mesh(foot, materials.steelSatin);
    f.position.set(x, -(R + TANK.saddleHeight) + 0.003, 0);
    group.add(f);
    for (const dx of [-0.024, 0.024]) {
      for (const z of [-0.115, 0.115]) {
        const b = mesh(bolt, materials.steelPolished);
        b.position.set(x + dx, -(R + TANK.saddleHeight) + 0.009, z);
        group.add(b);
      }
    }
    const p = mesh(pad, materials.gasket);
    p.position.x = x;
    group.add(p);
    const st = mesh(strap, materials.steelPolished);
    st.position.x = x;
    group.add(st);
    for (const side of [-1, 1]) {
      const phi = Math.PI / 2 + side * 0.95;
      const l = mesh(lug, materials.steelSatin);
      l.position.set(x, -(R + 0.012) * Math.sin(phi), (R + 0.012) * Math.cos(phi));
      l.rotation.x = -(phi - Math.PI / 2) * 0.6;
      group.add(l);
      const tb = mesh(bolt, materials.steelPolished);
      tb.position.copy(l.position).add(new THREE.Vector3(0, 0.011, 0));
      group.add(tb);
    }
  }

  // Rótulo esmaltado curvado sobre o costado.
  const label = mesh(createLabelGeometry(cache), new THREE.MeshPhysicalMaterial({
    map: labelTexture(options),
    roughness: 0.38,
    clearcoat: 0.7,
    clearcoatRoughness: 0.18,
  }));
  group.add(label);
  const rivet = cache.get('tank-rivet', () => new THREE.SphereGeometry(0.0035, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  for (const x of [-0.158, 0.158]) {
    for (const theta of [-0.77, 0.77]) {
      const r = mesh(rivet, materials.steelPolished);
      const rr = R + 0.0022;
      r.position.set(x, -rr * Math.sin(theta), rr * Math.cos(theta));
      r.lookAt(r.position.clone().multiplyScalar(2).setX(x));
      r.rotateX(Math.PI / 2);
      group.add(r);
    }
  }

  // Bocal de saída no tampo (+X), válvula borboleta e união DIN para a mangueira.
  const y = TANK.outletY;
  const nozzle = mesh(cache.get('tank-nozzle', () => cylinderX(DIN.pipeRadius, 0.06, 0.415, 36)), materials.steelPolished);
  nozzle.position.y = y;
  group.add(nozzle);
  const nozzleWeld = mesh(
    cache.get('tank-nozzle-weld', () => {
      const g = new THREE.TorusGeometry(DIN.pipeRadius + 0.001, 0.0025, 8, 36);
      g.rotateY(Math.PI / 2);
      return g;
    }),
    materials.weld,
  );
  nozzleWeld.position.set(shell / 2 + dish * Math.sqrt(1 - (y / R) ** 2) - 0.002, y, 0);
  group.add(nozzleWeld);

  const valve = butterflyValve(materials, cache, options.accent, { open: 0, closed: -Math.PI / 2 });
  valve.group.position.set(0.525, y, 0);
  tagPick(valve.group, {
    id: `valvula-${options.fluid}`,
    title: `Válvula borboleta — saída ${options.name}`,
    description: 'Válvula sanitária DN50 com manete de posições. Clique para abrir esta linha e iniciar a transferência.',
    action: `linha-${options.fluid}`,
  });
  group.add(valve.group);

  const union = dinUnion(materials, cache);
  union.position.set(0.575, y, 0);
  tagPick(union, {
    id: 'din',
    title: 'União sanitária DIN 11851 DN50 (2")',
    description: 'Macho roscado Rd 78 × 1/6", porca ranhurada e espigão com luva prensada para a mangueira.',
  });
  group.add(union);

  const hosePort = new THREE.Object3D();
  hosePort.position.set(0.575 + DIN.unionLength, y, 0);
  group.add(hosePort);

  // Manômetro e engate de CO₂ no tampo traseiro (−X).
  const gy = 0.07;
  const headX = -(shell / 2 + dish * Math.sqrt(1 - (gy / R) ** 2));
  const port = mesh(cache.get('tank-gas-port', () => cylinderX(0.0085, 0.065, -0.05, 20)), materials.steelPolished);
  port.position.set(headX - 0.008, gy, 0);
  group.add(port);
  const tee = mesh(cache.get('tank-gas-tee', () => new THREE.CylinderGeometry(0.0125, 0.0125, 0.034, 24)), materials.steelPolished);
  tee.position.set(headX - 0.055, gy, 0);
  group.add(tee);
  const teeNut = mesh(cache.get('tank-gas-tee-nut', () => hexNut(0.0115, 0.01)), materials.steelPolished);
  teeNut.position.set(headX - 0.055, gy + 0.02, 0);
  group.add(teeNut);
  const gauge = pressureGauge(materials, cache, 'CO₂');
  gauge.group.position.set(headX - 0.055, gy + 0.09, 0.004);
  tagPick(gauge.group, {
    id: `manometro-${options.fluid}`,
    title: `Manômetro de CO₂ — tanque ${options.name}`,
    description: 'Transferência por pressão de gás: sem bomba e sem cabos. O regulador mantém a pressão para a vazão pedida.',
  });
  group.add(gauge.group);
  const coupler = new THREE.Group();
  coupler.position.set(headX - 0.055, gy, 0);
  const couplerStem = mesh(cache.get('tank-coupler-stem', () => {
    const g = new THREE.CylinderGeometry(0.0065, 0.0065, 0.03, 16);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, -0.025);
    return g;
  }), materials.steelPolished);
  coupler.add(couplerStem);
  const couplerBody = mesh(cache.get('tank-coupler-body', () => {
    const g = new THREE.CylinderGeometry(0.012, 0.0105, 0.032, 24);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, -0.054);
    return g;
  }), materials.quickCoupler);
  coupler.add(couplerBody);
  const couplerCap = mesh(cache.get('tank-coupler-cap', () => {
    const g = new THREE.CylinderGeometry(0.0085, 0.0085, 0.01, 20);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, -0.075);
    return g;
  }), materials.accentWater);
  coupler.add(couplerCap);
  group.add(coupler);

  // Válvula de alívio de pressão no topo.
  const prv = new THREE.Group();
  prv.position.set(0.22, R - 0.002, 0);
  const prvFerrule = mesh(cache.get('prv-ferrule', () => new THREE.CylinderGeometry(0.016, 0.017, 0.008, 28)), materials.steelPolished);
  prvFerrule.position.y = 0.004;
  prv.add(prvFerrule);
  const prvBody = mesh(cache.get('prv-body', () => new THREE.CylinderGeometry(0.0095, 0.011, 0.018, 24)), materials.steelPolished);
  prvBody.position.y = 0.017;
  prv.add(prvBody);
  const prvCap = mesh(cache.get('prv-cap', () => new THREE.CylinderGeometry(0.0115, 0.0115, 0.008, 16)), materials.steelSatin);
  prvCap.position.y = 0.03;
  prv.add(prvCap);
  const prvRing = mesh(cache.get('prv-ring', () => new THREE.TorusGeometry(0.008, 0.0016, 8, 20)), materials.steelPolished);
  prvRing.position.y = 0.04;
  prv.add(prvRing);
  group.add(prv);

  tagPick(body, {
    id: `tanque-${options.fluid}`,
    title: `Tanque ${options.name} — ${TANK.capacity} L`,
    description: options.description,
    action: `linha-${options.fluid}`,
  });
  tagPick(label, {
    id: `tanque-${options.fluid}`,
    title: `Tanque ${options.name} — ${TANK.capacity} L`,
    description: options.description,
    action: `linha-${options.fluid}`,
  });

  return { group, fluid: options.fluid, hosePort, valve, gauge };
}

function createLabelGeometry(cache: GeometryCache): THREE.BufferGeometry {
  return cache.get('tank-label', () => {
    const r = TANK.radius + 0.0018;
    const g = new THREE.CylinderGeometry(r, r, 0.34, 64, 1, true, -0.85, 1.7);
    g.rotateZ(-Math.PI / 2);
    // Texto ao longo de +X e de cima para baixo no rótulo.
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      const around = uv.getX(i);
      const along = uv.getY(i);
      uv.setXY(i, along, 1 - around);
    }
    return g;
  });
}

function labelTexture(options: TankOptions): THREE.CanvasTexture {
  const W = 1280;
  const H = 940;
  const element = document.createElement('canvas');
  element.width = W;
  element.height = H;
  const ctx = element.getContext('2d')!;
  const font = '"Inter Variable", "Inter", system-ui, sans-serif';

  ctx.fillStyle = '#f3f4f1';
  ctx.fillRect(0, 0, W, H);
  // Faixa superior colorida.
  ctx.fillStyle = options.accentColor;
  ctx.fillRect(0, 0, W, 150);
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 50px ${font}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  setLetterSpacing(ctx, '6px');
  ctx.fillText(`TANQUE ${options.number}`, 70, 78);
  ctx.textAlign = 'right';
  ctx.fillText('PRESSURIZADO · CO₂', W - 70, 78);
  setLetterSpacing(ctx, '0px');

  // Ícone e nome do produto.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#14202b';
  ctx.font = `700 290px ${font}`;
  ctx.fillText(options.name, W / 2, 400);

  ctx.strokeStyle = 'rgba(20,32,43,0.18)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(70, 590);
  ctx.lineTo(W - 70, 590);
  ctx.stroke();

  ctx.font = `500 50px ${font}`;
  ctx.fillStyle = '#45525e';
  ctx.textAlign = 'left';
  ctx.fillText(`Capacidade ${TANK.capacity} L`, 70, 670);
  ctx.fillText('PMT 3,0 bar', 70, 750);
  ctx.textAlign = 'right';
  ctx.fillText('Aço inox AISI 304', W - 70, 670);
  ctx.fillText('Saída DN50 · DIN 11851', W - 70, 750);

  ctx.fillStyle = options.accentColor;
  ctx.fillRect(0, H - 64, W, 64);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `600 34px ${font}`;
  ctx.textAlign = 'center';
  setLetterSpacing(ctx, '4px');
  ctx.fillText('USO EXCLUSIVO ALIMENTÍCIO', W / 2, H - 32);
  setLetterSpacing(ctx, '0px');

  ctx.strokeStyle = 'rgba(20,32,43,0.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);

  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, value: string) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in c) c.letterSpacing = value;
}
