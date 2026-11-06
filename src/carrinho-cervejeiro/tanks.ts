import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Materials } from './materials';
import {
  DIN,
  type ButterflyValve,
  type Gauge,
  GeometryCache,
  butterflyValve,
  dinUnion,
  hexNut,
  mesh,
  pipeRunGeometry,
  pressureGauge,
  tagPick,
} from './parts';
import type { FluidId } from './simulation';

/**
 * Tanque vertical sobre três pés, com tampos abaulados, saída pelo fundo (curva de 90°,
 * válvula borboleta e união DIN voltadas para a frente), boca de visita, manômetro e
 * engate de CO₂ no topo, e cinta presa à travessa do fundo do carrinho.
 * Origem do grupo: na face superior da base do carrinho, sob o eixo do tanque.
 */
export const TANK = {
  radius: 0.2,
  shell: 0.66,
  dish: 0.08,
  /** Ponto mais baixo do tampo inferior (de onde sai o dreno). */
  apexY: 0.145,
  /** Altura do eixo da saída horizontal, sobre a base. */
  outletY: 0.085,
  /** Centro da válvula de saída, à frente do tanque. */
  valveZ: 0.27,
  /** Altura da cinta de fixação, sobre a base. */
  bandY: 0.71,
  /** Capacidade geométrica aproximada, em litros. */
  capacity: 95,
};

const SHELL_BOTTOM = TANK.apexY + TANK.dish;
const SHELL_TOP = SHELL_BOTTOM + TANK.shell;
/** Altura do tampo superior a uma distância `r` do eixo. */
const topHeadY = (r: number) => SHELL_TOP + TANK.dish * Math.sqrt(Math.max(0, 1 - (r / TANK.radius) ** 2));

export interface TankModel {
  group: THREE.Group;
  fluid: FluidId;
  /** Ponto onde começa a mangueira (direção local +X do objeto). */
  hosePort: THREE.Object3D;
  valve: ButterflyValve;
  gauge: Gauge;
  /** Ponto para a legenda do tanque (acima do rótulo). */
  labelAnchor: THREE.Object3D;
  /** Ponto para a legenda da saída inferior. */
  outletAnchor: THREE.Object3D;
}

interface TankOptions {
  fluid: FluidId;
  name: string;
  number: string;
  accent: THREE.Material;
  accentColor: string;
  description: string;
  /** Posição Z da travessa do fundo (para o braço da cinta). */
  backRailZ: number;
}

/** Rotação que leva o eixo local +X para +Z (frente do carrinho). */
const X_TO_FRONT = -Math.PI / 2;

export function createTank(materials: Materials, cache: GeometryCache, options: TankOptions): TankModel {
  const R = TANK.radius;
  const group = new THREE.Group();
  group.name = `tanque-${options.fluid}`;

  // Costado + tampos elípticos.
  const body = mesh(
    cache.get('vtank-body', () => {
      const points: THREE.Vector2[] = [];
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * (Math.PI / 2);
        points.push(new THREE.Vector2(Math.max(0.0001, R * Math.sin(t)), SHELL_BOTTOM - TANK.dish * Math.cos(t)));
      }
      for (let i = steps; i >= 0; i--) {
        const t = (i / steps) * (Math.PI / 2);
        points.push(new THREE.Vector2(Math.max(0.0001, R * Math.sin(t)), SHELL_TOP + TANK.dish * Math.cos(t)));
      }
      return new THREE.LatheGeometry(points, 128);
    }),
    materials.steelVertical,
  );
  group.add(body);

  // Cordões de solda tampo/costado.
  const weld = cache.get('vtank-weld', () => {
    const g = new THREE.TorusGeometry(R + 0.0006, 0.0022, 8, 128);
    g.rotateX(Math.PI / 2);
    return g;
  });
  for (const y of [SHELL_BOTTOM, SHELL_TOP]) {
    const w = mesh(weld, materials.weld);
    w.position.y = y;
    group.add(w);
  }

  // Três pés com sapatas niveladoras, afastados da frente para liberar a saída.
  const legTop = SHELL_BOTTOM + 0.075;
  const footH = 0.032;
  const legGeometry = cache.get('vtank-leg', () => new THREE.CylinderGeometry(0.016, 0.016, legTop - footH, 24));
  const padGeometry = cache.get('vtank-leg-pad', () => new RoundedBoxGeometry(0.05, 0.09, 0.006, 2, 0.002));
  const footGeometry = cache.get('vtank-foot', () =>
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0001, 0),
        new THREE.Vector2(0.034, 0),
        new THREE.Vector2(0.034, 0.005),
        new THREE.Vector2(0.024, 0.009),
        new THREE.Vector2(0.012, 0.012),
        new THREE.Vector2(0.012, footH - 0.006),
        new THREE.Vector2(0.018, footH - 0.006),
        new THREE.Vector2(0.018, footH),
        new THREE.Vector2(0.0001, footH),
      ],
      32,
    ),
  );
  const footNut = cache.get('vtank-foot-nut', () => hexNut(0.015, 0.008));
  const legRadius = R + 0.017;
  for (const angle of [Math.PI / 3, Math.PI, (5 * Math.PI) / 3]) {
    const x = Math.sin(angle) * legRadius;
    const z = Math.cos(angle) * legRadius;
    const leg = mesh(legGeometry, materials.steelSatin);
    leg.position.set(x, footH + (legTop - footH) / 2, z);
    group.add(leg);
    const pad = mesh(padGeometry, materials.steelSatin);
    pad.position.set(Math.sin(angle) * (R + 0.003), legTop - 0.04, Math.cos(angle) * (R + 0.003));
    pad.rotation.y = angle;
    group.add(pad);
    const foot = mesh(footGeometry, materials.steelPolished);
    foot.position.set(x, 0, z);
    group.add(foot);
    const nut = mesh(footNut, materials.steelPolished);
    nut.position.set(x, footH + 0.004, z);
    group.add(nut);
  }

  // Saída pelo fundo: curva de 90° para a frente, válvula borboleta e união DIN.
  const outletPipe = mesh(
    cache.get('vtank-outlet', () =>
      pipeRunGeometry(
        [new THREE.Vector3(0, TANK.apexY + 0.008, 0), new THREE.Vector3(0, TANK.outletY, 0), new THREE.Vector3(0, TANK.outletY, TANK.valveZ - 0.048)],
        DIN.pipeRadius,
        0.045,
      ),
    ),
    materials.steelPolished,
  );
  group.add(outletPipe);
  const apexWeld = mesh(
    cache.get('vtank-apex-weld', () => {
      const g = new THREE.TorusGeometry(DIN.pipeRadius + 0.001, 0.0025, 8, 36);
      g.rotateX(Math.PI / 2);
      return g;
    }),
    materials.weld,
  );
  apexWeld.position.y = TANK.apexY + 0.003;
  group.add(apexWeld);

  const valve = butterflyValve(materials, cache, options.accent, { open: 0, closed: Math.PI / 2 });
  valve.group.rotation.y = X_TO_FRONT;
  valve.group.position.set(0, TANK.outletY, TANK.valveZ);
  tagPick(valve.group, {
    id: `valvula-${options.fluid}`,
    title: `Válvula de saída inferior — ${options.name}`,
    description: 'Válvula borboleta de 2" no ponto mais baixo do tanque: abre a linha e permite esvaziar o tanque por completo. Clique para abrir esta linha.',
    action: `linha-${options.fluid}`,
  });
  group.add(valve.group);

  const union = dinUnion(materials, cache);
  union.rotation.y = X_TO_FRONT;
  union.position.set(0, TANK.outletY, TANK.valveZ + 0.05);
  tagPick(union, {
    id: 'din',
    title: 'União sanitária DIN 11851 de 2"',
    description: 'Macho roscado Rd 78 × 1/6", porca ranhurada e espigão com luva prensada para a mangueira — na frente da base, à mão para conectar e drenar.',
  });
  group.add(union);

  const hosePort = new THREE.Object3D();
  hosePort.rotation.y = X_TO_FRONT;
  hosePort.position.set(0, TANK.outletY, TANK.valveZ + 0.05 + DIN.unionLength);
  group.add(hosePort);

  // Boca de visita com abraçadeira no topo.
  const manway = new THREE.Group();
  manway.position.y = topHeadY(0) - 0.012;
  const ferrule = mesh(cache.get('vtank-manway-ferrule', () => new THREE.CylinderGeometry(0.056, 0.058, 0.03, 48)), materials.steelPolished);
  ferrule.position.y = 0.015;
  manway.add(ferrule);
  const lid = mesh(
    cache.get('vtank-manway-lid', () => new THREE.SphereGeometry(0.06, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2.6)),
    materials.steelPolished,
  );
  lid.scale.y = 0.45;
  lid.position.y = 0.03;
  manway.add(lid);
  const clamp = mesh(
    cache.get('vtank-manway-clamp', () => {
      const g = new THREE.TorusGeometry(0.062, 0.006, 10, 48);
      g.rotateX(Math.PI / 2);
      return g;
    }),
    materials.steelSatin,
  );
  clamp.position.y = 0.03;
  manway.add(clamp);
  const wing = mesh(cache.get('vtank-manway-wing', () => new RoundedBoxGeometry(0.03, 0.012, 0.008, 2, 0.002)), materials.steelPolished);
  wing.position.set(0.072, 0.03, 0);
  manway.add(wing);
  group.add(manway);

  // Manômetro e engate de CO₂ num tê sobre o tampo, voltados para a frente.
  const gaugeZ = 0.118;
  const riserBase = topHeadY(gaugeZ) - 0.004;
  const riser = mesh(cache.get('vtank-gauge-riser', () => new THREE.CylinderGeometry(0.0085, 0.0085, 0.05, 20)), materials.steelPolished);
  riser.position.set(0, riserBase + 0.025, gaugeZ);
  group.add(riser);
  const tee = mesh(cache.get('vtank-gauge-tee', () => new THREE.CylinderGeometry(0.0125, 0.0125, 0.034, 24)), materials.steelPolished);
  tee.position.set(0, riserBase + 0.05, gaugeZ);
  group.add(tee);
  const gauge = pressureGauge(materials, cache, 'CO₂');
  gauge.group.position.set(0, riserBase + 0.05 + 0.075, gaugeZ + 0.004);
  tagPick(gauge.group, {
    id: `manometro-${options.fluid}`,
    title: `Manômetro de CO₂ — tanque ${options.name}`,
    description: 'Transferência por pressão de gás: sem bomba e sem cabos. O regulador mantém a pressão para a vazão pedida.',
  });
  group.add(gauge.group);
  const coupler = new THREE.Group();
  coupler.position.set(0, riserBase + 0.05, gaugeZ);
  coupler.rotation.y = X_TO_FRONT;
  const couplerStem = mesh(
    cache.get('tank-coupler-stem', () => {
      const g = new THREE.CylinderGeometry(0.0065, 0.0065, 0.03, 16);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, -0.025);
      return g;
    }),
    materials.steelPolished,
  );
  coupler.add(couplerStem);
  const couplerBody = mesh(
    cache.get('tank-coupler-body', () => {
      const g = new THREE.CylinderGeometry(0.012, 0.0105, 0.032, 24);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, -0.054);
      return g;
    }),
    materials.quickCoupler,
  );
  coupler.add(couplerBody);
  const couplerCap = mesh(
    cache.get('tank-coupler-cap', () => {
      const g = new THREE.CylinderGeometry(0.0085, 0.0085, 0.01, 20);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, -0.075);
      return g;
    }),
    materials.accentWater,
  );
  coupler.add(couplerCap);
  group.add(coupler);

  // Válvula de alívio de pressão.
  const prv = new THREE.Group();
  const prvX = -0.1;
  const prvZ = -0.085;
  prv.position.set(prvX, topHeadY(Math.hypot(prvX, prvZ)) - 0.003, prvZ);
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

  // Cinta de fixação com fecho rápido na frente e braço até a travessa do fundo.
  const band = mesh(
    cache.get('vtank-band', () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(R + 0.0005, -0.016),
          new THREE.Vector2(R + 0.0045, -0.016),
          new THREE.Vector2(R + 0.0045, 0.016),
          new THREE.Vector2(R + 0.0005, 0.016),
        ],
        128,
      ),
    ),
    materials.steelPolished,
  );
  band.position.y = TANK.bandY;
  group.add(band);
  const bandLiner = mesh(
    cache.get('vtank-band-liner', () => new THREE.CylinderGeometry(R + 0.0012, R + 0.0012, 0.038, 128, 1, true)),
    materials.gasket,
    { cast: false },
  );
  bandLiner.position.y = TANK.bandY;
  group.add(bandLiner);
  const latchAngle = 0.4;
  const latch = mesh(cache.get('vtank-latch', () => new RoundedBoxGeometry(0.04, 0.026, 0.016, 2, 0.003)), materials.steelSatin);
  latch.position.set(Math.sin(latchAngle) * (R + 0.012), TANK.bandY, Math.cos(latchAngle) * (R + 0.012));
  latch.rotation.y = latchAngle;
  group.add(latch);
  const latchLever = mesh(cache.get('vtank-latch-lever', () => new RoundedBoxGeometry(0.008, 0.05, 0.008, 2, 0.002)), materials.steelPolished);
  latchLever.position.set(Math.sin(latchAngle) * (R + 0.024), TANK.bandY + 0.012, Math.cos(latchAngle) * (R + 0.024));
  latchLever.rotation.set(0, latchAngle, -0.5);
  group.add(latchLever);
  const armLength = Math.abs(options.backRailZ) - (R + 0.0045) - 0.016;
  const arm = mesh(new RoundedBoxGeometry(0.03, 0.024, armLength, 2, 0.003), materials.steelSatin);
  arm.position.set(0, TANK.bandY, -(R + 0.0045 + armLength / 2));
  group.add(arm);
  const armPlate = mesh(cache.get('vtank-arm-plate', () => new RoundedBoxGeometry(0.06, 0.05, 0.005, 2, 0.002)), materials.steelSatin);
  armPlate.position.set(0, TANK.bandY, -(R + 0.0045 + armLength + 0.0025));
  group.add(armPlate);

  // Rótulo esmaltado curvado na frente do tanque.
  const labelCenter = 0.53;
  const labelTheta = -0.05;
  const label = mesh(
    cache.get('vtank-label', () => new THREE.CylinderGeometry(R + 0.0018, R + 0.0018, 0.235, 72, 1, true, labelTheta - 0.8, 1.6)),
    new THREE.MeshPhysicalMaterial({ map: labelTexture(options), roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.18 }),
  );
  label.position.y = labelCenter;
  group.add(label);
  const rivet = cache.get('tank-rivet', () => new THREE.SphereGeometry(0.0035, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  for (const dy of [-0.105, 0.105]) {
    for (const dt of [-0.76, 0.76]) {
      const theta = labelTheta + dt;
      const rr = R + 0.0022;
      const r = mesh(rivet, materials.steelPolished);
      r.position.set(Math.sin(theta) * rr, labelCenter + dy, Math.cos(theta) * rr);
      r.lookAt(new THREE.Vector3(Math.sin(theta) * 2, labelCenter + dy, Math.cos(theta) * 2));
      r.rotateX(Math.PI / 2);
      group.add(r);
    }
  }

  const labelAnchor = new THREE.Object3D();
  labelAnchor.position.set(Math.sin(labelTheta - 0.45) * (R + 0.02), labelCenter + 0.15, Math.cos(labelTheta - 0.45) * (R + 0.02));
  group.add(labelAnchor);
  const outletAnchor = new THREE.Object3D();
  outletAnchor.position.set(0, TANK.outletY + 0.06, TANK.valveZ + 0.1);
  group.add(outletAnchor);

  const info = {
    id: `tanque-${options.fluid}`,
    title: `Tanque ${options.name} — ${TANK.capacity} L, em pé`,
    description: options.description,
    action: `linha-${options.fluid}`,
  };
  tagPick(body, info);
  tagPick(label, info);

  return { group, fluid: options.fluid, hosePort, valve, gauge, labelAnchor, outletAnchor };
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
  ctx.fillText('Saída inferior 2" · DIN 11851', W - 70, 750);

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
