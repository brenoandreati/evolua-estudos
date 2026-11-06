import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Materials } from './materials';
import { GeometryCache, hexNut, mesh, pipeRunGeometry, tagPick } from './parts';

/** Medidas do carrinho, em metros. */
export const CART = {
  length: 1.1,
  width: 0.62,
  /** Altura da face superior de cada prateleira (inferior, intermediária, superior). */
  shelves: [0.19, 0.6, 1.01] as const,
  lip: 0.035,
  post: 0.032,
  casterHeight: 0.175,
  wheelRadius: 0.0625,
  /** Centro das colunas. */
  postX: 0.537,
  postZ: 0.297,
};

export interface CartModel {
  group: THREE.Group;
  frame: THREE.Group;
  posts: THREE.Group[];
  shelves: THREE.Group[];
  handle: THREE.Group;
  casters: THREE.Group[];
}

export function createCart(materials: Materials, cache: GeometryCache): CartModel {
  const group = new THREE.Group();
  group.name = 'carrinho';

  const frame = new THREE.Group();
  frame.name = 'estrutura';
  group.add(frame);

  const shelves = CART.shelves.map((y, index) => {
    const shelf = createShelf(materials, cache, y, index === 2);
    tagPick(shelf, {
      id: 'estrutura',
      title: index === 2 ? 'Prateleira superior com borda de contenção' : index === 1 ? 'Prateleira intermediária reforçada' : 'Prateleira inferior reforçada',
      description: 'Chapa de aço inox AISI 304 escovado, bordas dobradas e perfis de reforço sob a chapa (carga de até 150 kg por prateleira).',
    });
    group.add(shelf);
    return shelf;
  });

  const posts: THREE.Group[] = [];
  const postHeight = CART.shelves[2] + 0.022 - 0.155;
  const postGeometry = new RoundedBoxGeometry(CART.post, postHeight, CART.post, 2, 0.004);
  const capGeometry = new RoundedBoxGeometry(CART.post + 0.002, 0.008, CART.post + 0.002, 2, 0.003);
  const bumperGeometry = new THREE.CylinderGeometry(0.029, 0.029, 0.03, 32);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Group();
      post.name = 'coluna';
      post.position.set(sx * CART.postX, 0, sz * CART.postZ);
      const tube = mesh(postGeometry, materials.steelVertical);
      tube.position.y = 0.155 + postHeight / 2;
      post.add(tube);
      const cap = mesh(capGeometry, materials.gripFoam);
      cap.position.y = 0.155 + postHeight + 0.003;
      post.add(cap);
      const foot = mesh(capGeometry, materials.gripFoam);
      foot.position.y = 0.152;
      post.add(foot);
      // Para-choque de borracha na base da coluna.
      const bumper = mesh(bumperGeometry, materials.rubber);
      bumper.position.y = 0.172;
      post.add(bumper);
      tagPick(post, {
        id: 'estrutura',
        title: 'Coluna em tubo quadrado 32 mm',
        description: 'Aço inox AISI 304 soldado às prateleiras, com para-choque de borracha na base.',
      });
      frame.add(post);
      posts.push(post);
    }
  }

  const handle = createHandle(materials);
  tagPick(handle, {
    id: 'estrutura',
    title: 'Puxador tubular com manopla',
    description: 'Tubo de 1" em inox curvado, fixado nas colunas por abraçadeiras.',
  });
  group.add(handle);

  const casters: THREE.Group[] = [];
  const swivels = [0.35, -0.2, 2.8, 3.4];
  let i = 0;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const caster = createCaster(materials, cache, { brake: sx < 0, swivel: swivels[i++] });
      caster.position.set(sx * 0.49, CART.casterHeight, sz * 0.255);
      tagPick(caster, {
        id: 'rodizios',
        title: sx < 0 ? 'Rodízio giratório Ø125 mm com freio' : 'Rodízio giratório Ø125 mm',
        description: 'Garfo em inox, rolamento de esferas duplo na giratória e roda de borracha atóxica sobre cubo de poliamida.',
      });
      group.add(caster);
      casters.push(caster);
    }
  }

  return { group, frame, posts, shelves, handle, casters };
}

function createShelf(materials: Materials, cache: GeometryCache, y: number, rim: boolean): THREE.Group {
  const shelf = new THREE.Group();
  shelf.name = 'prateleira';
  shelf.position.y = y;
  const { length: L, width: W, lip } = CART;
  const t = 0.003;

  const panel = mesh(cache.get('shelf-panel', () => new THREE.BoxGeometry(L, t, W)), materials.steel);
  panel.position.y = -t / 2;
  shelf.add(panel);

  const lipX = cache.get('shelf-lip-x', () => new THREE.BoxGeometry(L, lip, t));
  const lipZ = cache.get('shelf-lip-z', () => new THREE.BoxGeometry(t, lip, W - 2 * t));
  for (const s of [-1, 1]) {
    const front = mesh(lipX, materials.steel);
    front.position.set(0, -lip / 2, s * (W / 2 - t / 2));
    shelf.add(front);
    const side = mesh(lipZ, materials.steel);
    side.position.set(s * (L / 2 - t / 2), -lip / 2, 0);
    shelf.add(side);
  }

  // Bainha dobrada na borda inferior das abas.
  const hemX = cache.get('shelf-hem-x', () => {
    const g = new THREE.CylinderGeometry(0.0032, 0.0032, L, 12);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const hemZ = cache.get('shelf-hem-z', () => {
    const g = new THREE.CylinderGeometry(0.0032, 0.0032, W, 12);
    g.rotateX(Math.PI / 2);
    return g;
  });
  for (const s of [-1, 1]) {
    const a = mesh(hemX, materials.steelSatin);
    a.position.set(0, -lip, s * (W / 2 - 0.0035));
    shelf.add(a);
    const b = mesh(hemZ, materials.steelSatin);
    b.position.set(s * (L / 2 - 0.0035), -lip, 0);
    shelf.add(b);
  }

  // Perfis ômega de reforço sob a chapa.
  const channel = cache.get('shelf-channel', () => new RoundedBoxGeometry(L - 0.03, 0.022, 0.04, 2, 0.003));
  for (const z of [-0.17, 0.17]) {
    const c = mesh(channel, materials.steelSatin);
    c.position.set(0, -t - 0.011, z);
    shelf.add(c);
  }
  const cross = cache.get('shelf-cross', () => new RoundedBoxGeometry(0.04, 0.02, W - 0.03, 2, 0.003));
  for (const x of [-0.27, 0, 0.27]) {
    const c = mesh(cross, materials.steelSatin);
    c.position.set(x, -t - 0.01, 0);
    shelf.add(c);
  }

  if (rim) {
    // Borda de contenção voltada para cima, com aresta enrolada.
    const rimH = 0.022;
    const rimX = cache.get('shelf-rim-x', () => new THREE.BoxGeometry(L, rimH, t));
    const rimZ = cache.get('shelf-rim-z', () => new THREE.BoxGeometry(t, rimH, W - 2 * t));
    const rollX = cache.get('shelf-roll-x', () => {
      const g = new THREE.CylinderGeometry(0.0042, 0.0042, L, 14);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    const rollZ = cache.get('shelf-roll-z', () => {
      const g = new THREE.CylinderGeometry(0.0042, 0.0042, W, 14);
      g.rotateX(Math.PI / 2);
      return g;
    });
    for (const s of [-1, 1]) {
      const a = mesh(rimX, materials.steel);
      a.position.set(0, rimH / 2, s * (W / 2 - t / 2));
      shelf.add(a);
      const b = mesh(rimZ, materials.steel);
      b.position.set(s * (L / 2 - t / 2), rimH / 2, 0);
      shelf.add(b);
      const c = mesh(rollX, materials.steelPolished);
      c.position.set(0, rimH, s * (W / 2 - 0.002));
      shelf.add(c);
      const d = mesh(rollZ, materials.steelPolished);
      d.position.set(s * (L / 2 - 0.002), rimH, 0);
      shelf.add(d);
    }
  }
  return shelf;
}

function createHandle(materials: Materials): THREE.Group {
  const handle = new THREE.Group();
  handle.name = 'puxador';
  const x0 = -0.578;
  const x1 = -0.625;
  const z = 0.26;
  const points = [
    new THREE.Vector3(x0, 0.84, -z),
    new THREE.Vector3(x0, 1.06, -z),
    new THREE.Vector3(x1, 1.15, -z),
    new THREE.Vector3(x1, 1.15, z),
    new THREE.Vector3(x0, 1.06, z),
    new THREE.Vector3(x0, 0.84, z),
  ];
  handle.add(mesh(pipeRunGeometry(points, 0.0127, 0.06, 20), materials.steelPolished));
  // Tampões nas pontas do tubo.
  const plug = new THREE.CylinderGeometry(0.0128, 0.0128, 0.006, 20);
  for (const s of [-1, 1]) {
    const p = mesh(plug, materials.gripFoam);
    p.position.set(x0, 0.837, s * z);
    handle.add(p);
  }
  const grip = mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.36, 32), materials.gripFoam);
  grip.rotation.x = Math.PI / 2;
  grip.position.set(x1, 1.15, 0);
  handle.add(grip);
  const collarGeometry = new THREE.CylinderGeometry(0.0205, 0.0205, 0.008, 32);
  for (const ring of [-0.18, 0.18]) {
    const collar = mesh(collarGeometry, materials.steelPolished);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(x1, 1.15, ring);
    handle.add(collar);
  }
  // Abraçadeiras que prendem o puxador às colunas.
  const clampPlate = new RoundedBoxGeometry(0.03, 0.04, 0.03, 2, 0.004);
  const clampRing = new THREE.TorusGeometry(0.0145, 0.0035, 10, 24);
  clampRing.rotateX(Math.PI / 2);
  const bolt = hexNut(0.005, 0.006);
  bolt.rotateZ(Math.PI / 2);
  for (const s of [-1, 1]) {
    for (const y of [0.88, 1.0]) {
      const plate = mesh(clampPlate, materials.steelSatin);
      plate.position.set(-0.562, y, s * z);
      handle.add(plate);
      const ring = mesh(clampRing, materials.steelSatin);
      ring.position.set(x0, y, s * z);
      handle.add(ring);
      const b = mesh(bolt, materials.steelPolished);
      b.position.set(-0.5765, y, s * (z + 0.0185));
      handle.add(b);
    }
  }
  return handle;
}

interface CasterOptions {
  brake: boolean;
  swivel: number;
}

/** Rodízio giratório industrial Ø125 mm. Origem no topo da placa de fixação. */
function createCaster(materials: Materials, cache: GeometryCache, options: CasterOptions): THREE.Group {
  const caster = new THREE.Group();
  caster.name = 'rodizio';
  const H = CART.casterHeight;
  const axle = new THREE.Vector2(0.038, -(H - CART.wheelRadius));

  // Calço de fixação sob a prateleira e placa do rodízio.
  const pad = mesh(cache.get('caster-pad', () => new RoundedBoxGeometry(0.115, 0.012, 0.1, 2, 0.003)), materials.steelSatin);
  pad.position.y = 0.006;
  caster.add(pad);
  const plate = mesh(cache.get('caster-plate', () => new RoundedBoxGeometry(0.1, 0.007, 0.085, 2, 0.0025)), materials.steelSatin);
  plate.position.y = -0.0035;
  caster.add(plate);
  const nut = cache.get('caster-nut', () => hexNut(0.0055, 0.006));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const n = mesh(nut, materials.steelPolished);
      n.position.set(sx * 0.038, -0.009, sz * 0.03);
      caster.add(n);
    }
  }
  const race = mesh(
    cache.get('caster-race', () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.0001, -0.025),
          new THREE.Vector2(0.03, -0.025),
          new THREE.Vector2(0.0395, -0.022),
          new THREE.Vector2(0.042, -0.0165),
          new THREE.Vector2(0.0395, -0.0115),
          new THREE.Vector2(0.033, -0.007),
          new THREE.Vector2(0.0001, -0.007),
        ],
        40,
      ),
    ),
    materials.steelPolished,
  );
  caster.add(race);
  const kingpin = mesh(cache.get('caster-kingpin', () => hexNut(0.009, 0.006)), materials.steelPolished);
  kingpin.position.y = -0.03;
  caster.add(kingpin);

  const swivel = new THREE.Group();
  swivel.name = 'giratoria';
  swivel.rotation.y = options.swivel;
  caster.add(swivel);

  const crown = mesh(cache.get('caster-crown', () => new RoundedBoxGeometry(0.076, 0.005, 0.066, 2, 0.002)), materials.steelSatin);
  crown.position.y = -0.0275;
  swivel.add(crown);

  const legGeometry = cache.get('caster-leg', () => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.034, -0.026);
    shape.lineTo(0.03, -0.026);
    shape.lineTo(0.0525, axle.y + 0.0075);
    const r = Math.hypot(0.0145, 0.0075);
    shape.absarc(axle.x, axle.y, r, Math.atan2(0.0075, 0.0145), 2.54, true);
    shape.lineTo(-0.012, -0.058);
    shape.lineTo(-0.034, -0.042);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: true, bevelSize: 0.0008, bevelThickness: 0.0008, bevelSegments: 1, curveSegments: 16 });
    g.computeVertexNormals();
    return g;
  });
  for (const z of [0.0225, -0.0265]) {
    const leg = mesh(legGeometry, materials.steelSatin);
    leg.position.z = z;
    swivel.add(leg);
  }

  const axleGeometry = cache.get('caster-axle', () => {
    const g = new THREE.CylinderGeometry(0.0055, 0.0055, 0.068, 16);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const axleMesh = mesh(axleGeometry, materials.steelPolished);
  axleMesh.position.set(axle.x, axle.y, 0);
  swivel.add(axleMesh);
  const axleNut = cache.get('caster-axle-nut', () => {
    const g = hexNut(0.0085, 0.006);
    g.rotateX(Math.PI / 2);
    return g;
  });
  for (const z of [0.0315, -0.0315]) {
    const n = mesh(axleNut, materials.steelPolished);
    n.position.set(axle.x, axle.y, z);
    swivel.add(n);
  }

  const wheel = new THREE.Group();
  wheel.name = 'roda';
  wheel.position.set(axle.x, axle.y, 0);
  const tread = mesh(
    cache.get('caster-tread', () => {
      const R = CART.wheelRadius;
      const g = new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.046, -0.019),
          new THREE.Vector2(R - 0.0045, -0.019),
          new THREE.Vector2(R - 0.001, -0.0155),
          new THREE.Vector2(R, -0.009),
          new THREE.Vector2(R, 0.009),
          new THREE.Vector2(R - 0.001, 0.0155),
          new THREE.Vector2(R - 0.0045, 0.019),
          new THREE.Vector2(0.046, 0.019),
        ],
        56,
      );
      g.rotateX(Math.PI / 2);
      return g;
    }),
    materials.rubber,
  );
  wheel.add(tread);
  const hub = mesh(
    cache.get('caster-hub', () => {
      const g = new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.0085, -0.0205),
          new THREE.Vector2(0.016, -0.0205),
          new THREE.Vector2(0.0185, -0.0165),
          new THREE.Vector2(0.041, -0.0145),
          new THREE.Vector2(0.0468, -0.0175),
          new THREE.Vector2(0.0468, 0.0175),
          new THREE.Vector2(0.041, 0.0145),
          new THREE.Vector2(0.0185, 0.0165),
          new THREE.Vector2(0.016, 0.0205),
          new THREE.Vector2(0.0085, 0.0205),
        ],
        48,
      );
      g.rotateX(Math.PI / 2);
      return g;
    }),
    materials.wheelHub,
  );
  wheel.add(hub);
  // Nervuras do cubo.
  const rib = cache.get('caster-rib', () => new THREE.BoxGeometry(0.022, 0.004, 0.026));
  for (let k = 0; k < 6; k++) {
    const r = mesh(rib, materials.wheelHub);
    const a = (k / 6) * Math.PI * 2;
    r.position.set(Math.cos(a) * 0.03, Math.sin(a) * 0.03, 0);
    r.rotation.z = a;
    wheel.add(r);
  }
  wheel.rotation.z = options.swivel * 1.7;
  swivel.add(wheel);

  if (options.brake) {
    const lever = mesh(cache.get('caster-brake-lever', () => new THREE.BoxGeometry(0.05, 0.004, 0.03)), materials.steelSatin);
    lever.position.set(-0.054, -0.038, 0);
    lever.rotation.z = 0.32;
    swivel.add(lever);
    const pedal = mesh(cache.get('caster-brake-pedal', () => new RoundedBoxGeometry(0.03, 0.009, 0.036, 2, 0.003)), materials.brakeRed);
    pedal.position.set(-0.077, -0.044, 0);
    pedal.rotation.z = 0.32;
    swivel.add(pedal);
    const shoe = mesh(cache.get('caster-brake-shoe', () => new THREE.BoxGeometry(0.022, 0.006, 0.03)), materials.steelSatin);
    const a = (122 * Math.PI) / 180;
    shoe.position.set(axle.x + Math.cos(a) * (CART.wheelRadius + 0.003), axle.y + Math.sin(a) * (CART.wheelRadius + 0.003), 0);
    shoe.rotation.z = a - Math.PI / 2;
    swivel.add(shoe);
  }
  return caster;
}
