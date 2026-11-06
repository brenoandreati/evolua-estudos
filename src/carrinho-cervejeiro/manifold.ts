import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Materials } from './materials';
import {
  DIN,
  type ButterflyValve,
  GeometryCache,
  butterflyValve,
  cylinderX,
  dinUnion,
  latheX,
  mesh,
  pipeRunGeometry,
  tagPick,
} from './parts';
import { createFluidMaterial, remapCylinderUv, type FluidMaterial } from './fluid';
import type { FluidId } from './simulation';

/** Altura do eixo da tubulação sobre a prateleira superior. */
export const PIPE_Y = 1.1;
export const METER_X = -0.02;

export interface ManifoldModel {
  group: THREE.Group;
  ports: Record<FluidId, THREE.Object3D>;
  valves: Record<FluidId, ButterflyValve>;
  /** Comprimentos internos (para a simulação), em metros. */
  lengths: { branch: Record<FluidId, number>; header: number };
  anchor: THREE.Object3D;
}

/** Manifold com duas válvulas borboleta e um tê que alimenta o medidor. */
export function createManifold(materials: Materials, cache: GeometryCache): ManifoldModel {
  const group = new THREE.Group();
  group.name = 'manifold';
  const y = PIPE_Y;
  const teeX = 0.3;
  const valveX = 0.42;
  const lineZ: Record<FluidId, number> = { agua: 0.12, cerveja: -0.12 };
  const accent: Record<FluidId, THREE.Material> = { agua: materials.accentWater, cerveja: materials.accentBeer };

  // Base parafusada na prateleira superior e suportes com abraçadeira.
  const base = mesh(new RoundedBoxGeometry(0.2, 0.006, 0.34, 2, 0.002), materials.steelSatin);
  base.position.set(0.36, 1.013, 0);
  group.add(base);
  const postHeight = y - DIN.pipeRadius - 0.004 - 1.016;
  const post = new RoundedBoxGeometry(0.024, postHeight, 0.024, 2, 0.003);
  const clamp = new THREE.TorusGeometry(DIN.pipeRadius + 0.003, 0.0035, 8, 24, Math.PI);
  clamp.rotateZ(Math.PI);
  const supports: Array<{ x: number; z: number; alongX: boolean }> = [
    { x: teeX, z: 0, alongX: false },
    { x: 0.35, z: lineZ.agua, alongX: true },
    { x: 0.35, z: lineZ.cerveja, alongX: true },
  ];
  for (const s of supports) {
    const p = mesh(post, materials.steelSatin);
    p.position.set(s.x, 1.016 + postHeight / 2, s.z);
    group.add(p);
    const c = mesh(clamp, materials.steelPolished);
    c.position.set(s.x, y, s.z);
    if (s.alongX) c.rotation.y = Math.PI / 2;
    group.add(c);
  }

  // Tê sanitário e ramal para o medidor.
  const teeGeometry = new THREE.CylinderGeometry(DIN.pipeRadius + 0.003, DIN.pipeRadius + 0.003, 0.075, 36);
  teeGeometry.rotateX(Math.PI / 2);
  const tee = mesh(teeGeometry, materials.steelPolished);
  tee.position.set(teeX, y, 0);
  group.add(tee);
  const branchStart = METER_X + 0.205;
  const branch = mesh(cylinderX(DIN.pipeRadius, teeX - branchStart, branchStart, 36), materials.steelPolished);
  branch.position.y = y;
  group.add(branch);
  const weldGeometry = new THREE.TorusGeometry(DIN.pipeRadius + 0.001, 0.0022, 8, 36);
  for (const z of [-0.0375, 0.0375]) {
    const w = mesh(weldGeometry, materials.weld);
    w.position.set(teeX, y, z);
    group.add(w);
  }

  const ports = {} as Record<FluidId, THREE.Object3D>;
  const valves = {} as Record<FluidId, ButterflyValve>;
  const branchLengths = {} as Record<FluidId, number>;
  for (const id of ['agua', 'cerveja'] as FluidId[]) {
    const z = lineZ[id];
    const s = Math.sign(z);
    const run = pipeRunGeometry(
      [new THREE.Vector3(teeX, y, s * 0.0375), new THREE.Vector3(teeX, y, z), new THREE.Vector3(valveX - 0.049, y, z)],
      DIN.pipeRadius,
      0.05,
    );
    group.add(mesh(run, materials.steelPolished));
    const valve = butterflyValve(materials, cache, accent[id], { open: 0, closed: -Math.PI / 2 });
    valve.group.position.set(valveX, y, z);
    tagPick(valve.group, {
      id: `valvula-manifold-${id}`,
      title: `Válvula da linha ${id === 'agua' ? 'ÁGUA' : 'CERVEJA'} no manifold`,
      description: 'Seleciona qual tanque alimenta o medidor. Clique para trocar a linha ativa.',
      action: `linha-${id}`,
    });
    group.add(valve.group);
    valves[id] = valve;

    const union = dinUnion(materials, cache);
    union.position.set(valveX + 0.05, y, z);
    tagPick(union, {
      id: 'din',
      title: 'União sanitária DIN 11851 DN50 (2")',
      description: 'Conexão higiênica desmontável entre a mangueira e o manifold — sem ferramentas especiais além da chave de gancho.',
    });
    group.add(union);
    const port = new THREE.Object3D();
    port.position.set(valveX + 0.05 + DIN.unionLength, y, z);
    group.add(port);
    ports[id] = port;
    branchLengths[id] = DIN.unionLength + 0.1 + run.parameters.path.getLength() + 0.0375;
  }

  const anchor = new THREE.Object3D();
  anchor.position.set(valveX, y + 0.09, lineZ.cerveja);
  group.add(anchor);

  return {
    group,
    ports,
    valves,
    lengths: { branch: branchLengths, header: 0.0375 + (teeX - branchStart) + 0.12 },
    anchor,
  };
}

// ——— Ponto de descarga ———

export interface DischargeModel {
  group: THREE.Group;
  drain: THREE.Group;
  port: THREE.Object3D;
  stream: THREE.Mesh;
  streamMaterial: FluidMaterial;
  streamLength: number;
  /** Comprimento interno da união e da bica (para a simulação). */
  spoutLength: number;
  splashOrigin: THREE.Vector3;
  anchor: THREE.Object3D;
}

export function createDischarge(materials: Materials, cache: GeometryCache, lightDir: THREE.Vector3): DischargeModel {
  const group = new THREE.Group();
  group.name = 'descarga';
  const drain = new THREE.Group();
  drain.name = 'ralo';

  // Ralo linear de piso em inox.
  const cx = -1.0;
  const cz = 0.32;
  const L = 0.8;
  const Wd = 0.16;
  const longSide = new THREE.BoxGeometry(L, 0.008, 0.012);
  const shortSide = new THREE.BoxGeometry(0.012, 0.008, Wd);
  for (const s of [-1, 1]) {
    const a = mesh(longSide, materials.steelSatin);
    a.position.set(cx, 0.004, cz + s * (Wd / 2 - 0.006));
    drain.add(a);
    const b = mesh(shortSide, materials.steelSatin);
    b.position.set(cx + s * (L / 2 - 0.006), 0.004, cz);
    drain.add(b);
  }
  const channel = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.02, Wd - 0.02), materials.darkSlot);
  channel.rotation.x = -Math.PI / 2;
  channel.position.set(cx, 0.0012, cz);
  channel.receiveShadow = true;
  drain.add(channel);
  const barCount = 62;
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0042, 0.006, Wd - 0.024), materials.steelSatin, barCount);
  const m = new THREE.Matrix4();
  for (let i = 0; i < barCount; i++) {
    m.makeTranslation(cx - L / 2 + 0.018 + (i * (L - 0.036)) / (barCount - 1), 0.004, cz);
    bars.setMatrixAt(i, m);
  }
  bars.castShadow = true;
  bars.receiveShadow = true;
  drain.add(bars);
  const rail = new THREE.BoxGeometry(L - 0.02, 0.005, 0.005);
  for (const s of [-0.035, 0.035]) {
    const r = mesh(rail, materials.steelSatin);
    r.position.set(cx, 0.0035, cz + s);
    drain.add(r);
  }
  tagPick(drain, {
    id: 'descarga',
    title: 'Ralo linear sanitário',
    description: 'Recebe o produto na descarga — o circuito fecha sem bomba elétrica nem cabos.',
  });

  // Suporte de mangueira e bica de descarga.
  const spoutX = -1.01;
  const spoutTop = 0.4;
  const spoutEnd = 0.27;
  const stand = new THREE.Group();
  const standZ = 0.12;
  const baseDisk = mesh(
    latheX([
      [0, 0],
      [0.1, 0],
      [0.1, 0.006],
      [0.094, 0.012],
      [0, 0.012],
    ], 48),
    materials.steelSatin,
  );
  baseDisk.rotation.z = Math.PI / 2;
  baseDisk.position.set(spoutX, 0, standZ);
  stand.add(baseDisk);
  const pole = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.46, 24), materials.steelPolished);
  pole.position.set(spoutX, 0.012 + 0.23, standZ);
  stand.add(pole);
  const poleCap = mesh(new THREE.SphereGeometry(0.017, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), materials.steelPolished);
  poleCap.position.set(spoutX, 0.472, standZ);
  stand.add(poleCap);
  const collar = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 24), materials.steelSatin);
  collar.position.set(spoutX, 0.35, standZ);
  stand.add(collar);
  const arm = mesh(new RoundedBoxGeometry(0.026, 0.018, cz - standZ - 0.03, 2, 0.004), materials.steelSatin);
  arm.position.set(spoutX, 0.35, (cz + standZ) / 2 - 0.012);
  stand.add(arm);
  const ringGeometry = new THREE.TorusGeometry(DIN.pipeRadius + 0.004, 0.004, 8, 32);
  ringGeometry.rotateX(Math.PI / 2);
  const ring = mesh(ringGeometry, materials.steelSatin);
  ring.position.set(spoutX, 0.35, cz);
  stand.add(ring);
  group.add(stand);

  const unionX = -0.952;
  const spout = mesh(
    pipeRunGeometry(
      [new THREE.Vector3(unionX + 0.002, spoutTop, cz), new THREE.Vector3(spoutX, spoutTop, cz), new THREE.Vector3(spoutX, spoutEnd, cz)],
      DIN.pipeRadius,
      0.055,
    ),
    materials.steelPolished,
  );
  stand.add(spout);
  const lipGeometry = new THREE.TorusGeometry(DIN.pipeRadius - 0.001, 0.0022, 8, 32);
  lipGeometry.rotateX(Math.PI / 2);
  const lip = mesh(lipGeometry, materials.steelPolished);
  lip.position.set(spoutX, spoutEnd, cz);
  stand.add(lip);
  const union = dinUnion(materials, cache);
  union.position.set(unionX, spoutTop, cz);
  stand.add(union);
  tagPick(stand, {
    id: 'descarga',
    title: 'Bica de descarga com suporte',
    description: 'Ponta da mangueira de saída presa num suporte de piso, com união DIN 11851 e curva de 90°.',
  });
  const port = new THREE.Object3D();
  port.position.set(unionX + DIN.unionLength, spoutTop, cz);
  group.add(port);

  // Jato de saída até o ralo.
  const streamLength = spoutEnd - 0.004;
  const streamGeometry = remapCylinderUv(new THREE.CylinderGeometry(0.0205, 0.0135, streamLength, 28, 40, true), true);
  const streamMaterial = createFluidMaterial(streamLength, { lightDir, wobble: 0.0016 });
  const stream = new THREE.Mesh(streamGeometry, streamMaterial);
  stream.position.set(spoutX, 0.004 + streamLength / 2, cz);
  stream.name = 'jato';
  group.add(stream);
  group.add(drain);

  const anchor = new THREE.Object3D();
  anchor.position.set(spoutX, 0.47, cz);
  group.add(anchor);

  return {
    group,
    drain,
    port,
    stream,
    streamMaterial,
    streamLength,
    spoutLength: DIN.unionLength + 0.06 + (spoutTop - spoutEnd),
    splashOrigin: new THREE.Vector3(spoutX, 0.006, cz),
    anchor,
  };
}
