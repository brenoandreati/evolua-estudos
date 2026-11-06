import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Materials } from './materials';
import {
  DIN,
  type ButterflyValve,
  GeometryCache,
  butterflyValve,
  dinUnion,
  latheX,
  mesh,
  pipeRunGeometry,
  tagPick,
} from './parts';
import { createFluidMaterial, remapCylinderUv, type FluidMaterial } from './fluid';
import type { FluidId } from './simulation';
import { CART } from './cart';
import { METER } from './picomag';

/** Altura do eixo do medidor e do topo do coletor. */
export const PIPE_Y = 0.66;
/** Centro do medidor, no vão aberto da base, na ponta oposta ao puxador. */
export const METER_X = 0.655;
/** Coletor vertical entre o tanque da direita e o medidor. */
const HEADER_X = 0.38;
const HEADER_BOTTOM = 0.385;
const LINE_Y: Record<FluidId, number> = { agua: 0.56, cerveja: 0.42 };
const VALVE_Z = 0.1;

export interface ManifoldModel {
  group: THREE.Group;
  ports: Record<FluidId, THREE.Object3D>;
  valves: Record<FluidId, ButterflyValve>;
  /** Comprimentos internos (para a simulação), em metros. */
  lengths: { branch: Record<FluidId, number>; header: number };
  anchor: THREE.Object3D;
}

/**
 * Coletor vertical: as duas entradas (com válvula borboleta e união DIN voltadas para a frente)
 * sobem por um tubo que faz a curva para o medidor — escoamento ascendente, que mantém o tubo
 * de medição sempre cheio.
 */
export function createManifold(materials: Materials, cache: GeometryCache): ManifoldModel {
  const group = new THREE.Group();
  group.name = 'manifold';
  const accent: Record<FluidId, THREE.Material> = { agua: materials.accentWater, cerveja: materials.accentBeer };
  const meterInletX = METER_X - (METER.stub + 0.11);

  const header = pipeRunGeometry(
    [new THREE.Vector3(HEADER_X, HEADER_BOTTOM, 0), new THREE.Vector3(HEADER_X, PIPE_Y, 0), new THREE.Vector3(meterInletX, PIPE_Y, 0)],
    DIN.pipeRadius,
    0.055,
  );
  group.add(mesh(header, materials.steelPolished));

  // Tampa com abraçadeira no fundo do coletor (dreno).
  const capFerrule = mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.012, 32), materials.steelPolished);
  capFerrule.position.set(HEADER_X, HEADER_BOTTOM - 0.002, 0);
  group.add(capFerrule);
  const capClamp = new THREE.TorusGeometry(0.036, 0.0045, 8, 32);
  capClamp.rotateX(Math.PI / 2);
  const clampMesh = mesh(capClamp, materials.steelSatin);
  clampMesh.position.set(HEADER_X, HEADER_BOTTOM - 0.004, 0);
  group.add(clampMesh);
  const capPlate = mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.008, 32), materials.steelPolished);
  capPlate.position.set(HEADER_X, HEADER_BOTTOM - 0.012, 0);
  group.add(capPlate);

  // Pé do coletor parafusado na base.
  const postBottom = CART.deckTop;
  const postTop = HEADER_BOTTOM - 0.016;
  const post = mesh(new RoundedBoxGeometry(0.03, postTop - postBottom, 0.03, 2, 0.003), materials.steelSatin);
  post.position.set(HEADER_X, (postTop + postBottom) / 2, 0);
  group.add(post);
  const foot = mesh(new RoundedBoxGeometry(0.08, 0.006, 0.08, 2, 0.002), materials.steelSatin);
  foot.position.set(HEADER_X, postBottom + 0.003, 0);
  group.add(foot);

  const weldGeometry = new THREE.TorusGeometry(DIN.pipeRadius + 0.001, 0.0022, 8, 36);
  const stubGeometry = new THREE.CylinderGeometry(DIN.pipeRadius, DIN.pipeRadius, VALVE_Z - 0.049, 36);
  stubGeometry.rotateX(Math.PI / 2);
  stubGeometry.translate(0, 0, (VALVE_Z - 0.049) / 2);

  const ports = {} as Record<FluidId, THREE.Object3D>;
  const valves = {} as Record<FluidId, ButterflyValve>;
  const branchLengths = {} as Record<FluidId, number>;
  for (const id of ['agua', 'cerveja'] as FluidId[]) {
    const y = LINE_Y[id];
    const stub = mesh(stubGeometry, materials.steelPolished);
    stub.position.set(HEADER_X, y, 0);
    group.add(stub);
    const weld = mesh(weldGeometry, materials.weld);
    weld.position.set(HEADER_X, y, DIN.pipeRadius + 0.001);
    group.add(weld);

    const valve = butterflyValve(materials, cache, accent[id], { open: 0, closed: Math.PI / 2 });
    valve.group.rotation.y = -Math.PI / 2;
    valve.group.position.set(HEADER_X, y, VALVE_Z);
    tagPick(valve.group, {
      id: `valvula-manifold-${id}`,
      title: `Válvula da linha ${id === 'agua' ? 'ÁGUA' : 'CERVEJA'} no coletor`,
      description: 'Seleciona qual tanque alimenta o medidor. Clique para trocar a linha ativa.',
      action: `linha-${id}`,
    });
    group.add(valve.group);
    valves[id] = valve;

    const union = dinUnion(materials, cache);
    union.rotation.y = -Math.PI / 2;
    union.position.set(HEADER_X, y, VALVE_Z + 0.05);
    tagPick(union, {
      id: 'din',
      title: 'União sanitária DIN 11851 de 2"',
      description: 'Conexão higiênica desmontável entre a mangueira e o coletor — sem ferramentas especiais além da chave de gancho.',
    });
    group.add(union);
    const port = new THREE.Object3D();
    port.rotation.y = -Math.PI / 2;
    port.position.set(HEADER_X, y, VALVE_Z + 0.05 + DIN.unionLength);
    group.add(port);
    ports[id] = port;
    branchLengths[id] = DIN.unionLength + 0.1 + (VALVE_Z - 0.05) + (PIPE_Y - y);
  }

  const anchor = new THREE.Object3D();
  anchor.position.set(HEADER_X, LINE_Y.agua + 0.13, VALVE_Z);
  group.add(anchor);

  return {
    group,
    ports,
    valves,
    lengths: { branch: branchLengths, header: 0.08 + (meterInletX - HEADER_X) + 0.12 },
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

export function createDischarge(materials: Materials, cache: GeometryCache, lightDir: THREE.Vector3, drainLength = 0.8): DischargeModel {
  const group = new THREE.Group();
  group.name = 'descarga';
  const drain = new THREE.Group();
  drain.name = 'ralo';

  // Ralo linear de piso em inox.
  const cx = -1.01;
  const cz = 0.32;
  const L = drainLength;
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
  const barCount = Math.round(62 * (L / 0.8));
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
