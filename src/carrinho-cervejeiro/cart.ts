import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Materials } from './materials';
import { GeometryCache, hexNut, mesh, pipeRunGeometry, tagPick } from './parts';

/**
 * Carrinho de estrutura aberta: uma única base baixa (bandeja com borda de contenção),
 * colunas nos cantos, travessas só no fundo e nas cabeceiras — a frente fica livre para
 * colocar, retirar e drenar os tanques — puxador e quatro rodízios giratórios reforçados.
 * Medidas em metros.
 */
export const CART = {
  /** Comprimento (X) e largura (Z) da base. */
  length: 1.44,
  width: 0.62,
  /** Altura da face superior da base. */
  deckTop: 0.21,
  /** Altura da borda de contenção da base. */
  lip: 0.026,
  casterHeight: 0.175,
  wheelRadius: 0.0625,
  post: 0.035,
  /** Centro das colunas: o quadro envolve os tanques; depois dele fica o vão do medidor. */
  postXLeft: -0.7,
  postXRight: 0.3,
  postZ: 0.29,
  /** Altura das travessas superiores. */
  railY: 0.92,
  /** Travessa intermediária (só no fundo). */
  midRailY: 0.52,
  casterX: 0.62,
  casterZ: 0.235,
};

export interface CartModel {
  group: THREE.Group;
  deck: THREE.Group;
  posts: THREE.Group[];
  rails: THREE.Group;
  handle: THREE.Group;
  casters: THREE.Group[];
}

export function createCart(materials: Materials, cache: GeometryCache): CartModel {
  const group = new THREE.Group();
  group.name = 'carrinho';

  const deck = createDeck(materials, cache);
  tagPick(deck, {
    id: 'estrutura',
    title: 'Base única de perfil baixo',
    description: 'Bandeja de inox AISI 304 sobre quadro de tubo retangular, a 21 cm do piso, com borda de contenção e bujão de dreno. Os dois tanques ficam em pé sobre ela.',
  });
  group.add(deck);

  const posts: THREE.Group[] = [];
  const postHeight = CART.railY + CART.post / 2 - CART.deckTop;
  const postGeometry = new RoundedBoxGeometry(CART.post, postHeight, CART.post, 2, 0.004);
  const capGeometry = new RoundedBoxGeometry(CART.post + 0.002, 0.008, CART.post + 0.002, 2, 0.003);
  const footGeometry = new RoundedBoxGeometry(0.07, 0.006, 0.07, 2, 0.002);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Group();
      post.name = 'coluna';
      post.position.set(sx < 0 ? CART.postXLeft : CART.postXRight, 0, sz * CART.postZ);
      const tube = mesh(postGeometry, materials.steelVertical);
      tube.position.y = CART.deckTop + postHeight / 2;
      post.add(tube);
      const cap = mesh(capGeometry, materials.gripFoam);
      cap.position.y = CART.deckTop + postHeight + 0.003;
      post.add(cap);
      const foot = mesh(footGeometry, materials.steelSatin);
      foot.position.y = CART.deckTop + 0.003;
      post.add(foot);
      tagPick(post, {
        id: 'estrutura',
        title: 'Coluna em tubo quadrado 35 mm',
        description: 'Estrutura aberta de aço inox AISI 304: sem prateleiras, com a frente livre para acesso aos tanques.',
      });
      group.add(post);
      posts.push(post);
    }
  }

  const rails = createRails(materials);
  tagPick(rails, {
    id: 'estrutura',
    title: 'Travessas do fundo e das cabeceiras',
    description: 'Fecham o quadro sem dividir o espaço: a frente fica aberta para colocar, inspecionar e drenar os tanques. As cintas dos tanques se prendem à travessa do fundo.',
  });
  group.add(rails);

  const handle = createHandle(materials);
  tagPick(handle, {
    id: 'estrutura',
    title: 'Puxador tubular com manopla',
    description: 'Tubo de 1" em inox curvado, fixado nas colunas da cabeceira por abraçadeiras.',
  });
  group.add(handle);

  const casters: THREE.Group[] = [];
  const swivels = [0.35, -0.2, 2.8, 3.4];
  let i = 0;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const caster = createCaster(materials, cache, { brake: sx < 0, swivel: swivels[i++] });
      caster.position.set(sx * CART.casterX, CART.casterHeight, sz * CART.casterZ);
      tagPick(caster, {
        id: 'rodizios',
        title: sx < 0 ? 'Rodízio giratório reforçado Ø125 mm com freio' : 'Rodízio giratório reforçado Ø125 mm',
        description: 'Garfo em inox, rolamento de esferas duplo na giratória e roda de borracha atóxica sobre cubo de poliamida.',
      });
      group.add(caster);
      casters.push(caster);
    }
  }

  return { group, deck, posts, rails, handle, casters };
}

/** Base: quadro de tubo retangular, chapa e borda de contenção com bujão de dreno. */
function createDeck(materials: Materials, cache: GeometryCache): THREE.Group {
  const deck = new THREE.Group();
  deck.name = 'base';
  const { length: L, width: W, deckTop: top, lip } = CART;
  const plateT = 0.006;
  const frameH = 0.028;
  const frameY = top - plateT - frameH / 2;

  const plate = mesh(new THREE.BoxGeometry(L, plateT, W), materials.steel);
  plate.position.y = top - plateT / 2;
  deck.add(plate);

  // Quadro de tubo retangular 50 × 30 mm e travessas.
  const longTube = new RoundedBoxGeometry(L, frameH, 0.05, 2, 0.003);
  const shortTube = new RoundedBoxGeometry(0.05, frameH, W - 0.1, 2, 0.003);
  for (const s of [-1, 1]) {
    const a = mesh(longTube, materials.steelSatin);
    a.position.set(0, frameY, s * (W / 2 - 0.025));
    deck.add(a);
  }
  for (const x of [-L / 2 + 0.025, -0.24, 0.24, L / 2 - 0.025]) {
    const b = mesh(shortTube, materials.steelSatin);
    b.position.set(x, frameY, 0);
    deck.add(b);
  }

  // Calços onde os rodízios são parafusados.
  const spacer = new RoundedBoxGeometry(0.118, top - plateT - (CART.casterHeight + 0.012), 0.102, 2, 0.003);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const block = mesh(spacer, materials.steelSatin);
      block.position.set(sx * CART.casterX, (top - plateT + CART.casterHeight + 0.012) / 2, sz * CART.casterZ);
      deck.add(block);
    }
  }

  // Borda de contenção dobrada para cima, com aresta enrolada.
  const t = 0.003;
  const lipX = new THREE.BoxGeometry(L, lip, t);
  const lipZ = new THREE.BoxGeometry(t, lip, W - 2 * t);
  const rollX = new THREE.CylinderGeometry(0.0042, 0.0042, L, 14);
  rollX.rotateZ(Math.PI / 2);
  const rollZ = new THREE.CylinderGeometry(0.0042, 0.0042, W, 14);
  rollZ.rotateX(Math.PI / 2);
  for (const s of [-1, 1]) {
    const a = mesh(lipX, materials.steel);
    a.position.set(0, top + lip / 2, s * (W / 2 - t / 2));
    deck.add(a);
    const b = mesh(lipZ, materials.steel);
    b.position.set(s * (L / 2 - t / 2), top + lip / 2, 0);
    deck.add(b);
    const c = mesh(rollX, materials.steelPolished);
    c.position.set(0, top + lip, s * (W / 2 - 0.002));
    deck.add(c);
    const d = mesh(rollZ, materials.steelPolished);
    d.position.set(s * (L / 2 - 0.002), top + lip, 0);
    deck.add(d);
  }

  // Bujão de dreno da bandeja (canto dianteiro, lado do puxador).
  const drain = mesh(cache.get('deck-drain', () => new THREE.CylinderGeometry(0.016, 0.018, 0.008, 24)), materials.steelPolished);
  drain.position.set(-L / 2 + 0.06, top + 0.004, W / 2 - 0.06);
  deck.add(drain);
  const drainNut = mesh(cache.get('deck-drain-nut', () => hexNut(0.009, 0.006)), materials.steelPolished);
  drainNut.position.set(-L / 2 + 0.06, top + 0.011, W / 2 - 0.06);
  deck.add(drainNut);
  return deck;
}

/** Travessas superiores (fundo e laterais do quadro) e intermediária do fundo. A frente fica aberta. */
function createRails(materials: Materials): THREE.Group {
  const rails = new THREE.Group();
  rails.name = 'travessas';
  const s = 0.03;
  const spanX = CART.postXRight - CART.postXLeft;
  const midX = (CART.postXRight + CART.postXLeft) / 2;
  const spanZ = 2 * CART.postZ;
  const back = new RoundedBoxGeometry(spanX, s, s, 2, 0.004);
  for (const y of [CART.railY, CART.midRailY]) {
    const r = mesh(back, materials.steel);
    r.position.set(midX, y, -CART.postZ);
    rails.add(r);
  }
  const end = new RoundedBoxGeometry(s, s, spanZ, 2, 0.004);
  for (const x of [CART.postXLeft, CART.postXRight]) {
    const r = mesh(end, materials.steel);
    r.position.set(x, CART.railY, 0);
    rails.add(r);
  }
  // Cantoneiras soldadas nas uniões.
  const gusset = new RoundedBoxGeometry(0.05, 0.05, 0.006, 2, 0.002);
  for (const [x, inward] of [[CART.postXLeft, 1], [CART.postXRight, -1]]) {
    for (const y of [CART.railY - 0.035]) {
      const g = mesh(gusset, materials.steelSatin);
      g.position.set(x + inward * 0.035, y, -CART.postZ + 0.019);
      rails.add(g);
    }
  }
  return rails;
}

function createHandle(materials: Materials): THREE.Group {
  const handle = new THREE.Group();
  handle.name = 'puxador';
  const x0 = -0.742;
  const x1 = -0.79;
  const z = CART.postZ;
  const yTop = 1.13;
  const points = [
    new THREE.Vector3(x0, 0.66, -z),
    new THREE.Vector3(x0, 1.04, -z),
    new THREE.Vector3(x1, yTop, -z),
    new THREE.Vector3(x1, yTop, z),
    new THREE.Vector3(x0, 1.04, z),
    new THREE.Vector3(x0, 0.66, z),
  ];
  handle.add(mesh(pipeRunGeometry(points, 0.0127, 0.06, 20), materials.steelPolished));
  const plug = new THREE.CylinderGeometry(0.0128, 0.0128, 0.006, 20);
  for (const s of [-1, 1]) {
    const p = mesh(plug, materials.gripFoam);
    p.position.set(x0, 0.657, s * z);
    handle.add(p);
  }
  const grip = mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.4, 32), materials.gripFoam);
  grip.rotation.x = Math.PI / 2;
  grip.position.set(x1, yTop, 0);
  handle.add(grip);
  const collarGeometry = new THREE.CylinderGeometry(0.0205, 0.0205, 0.008, 32);
  for (const ring of [-0.2, 0.2]) {
    const collar = mesh(collarGeometry, materials.steelPolished);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(x1, yTop, ring);
    handle.add(collar);
  }
  // Abraçadeiras que prendem o puxador às colunas da cabeceira.
  const clampPlate = new RoundedBoxGeometry(0.026, 0.04, 0.03, 2, 0.004);
  const clampRing = new THREE.TorusGeometry(0.0145, 0.0035, 10, 24);
  clampRing.rotateX(Math.PI / 2);
  const bolt = hexNut(0.005, 0.006);
  bolt.rotateX(Math.PI / 2);
  for (const s of [-1, 1]) {
    for (const y of [0.7, 0.9]) {
      const plate = mesh(clampPlate, materials.steelSatin);
      plate.position.set(-0.729, y, s * z);
      handle.add(plate);
      const ring = mesh(clampRing, materials.steelSatin);
      ring.position.set(x0, y, s * z);
      handle.add(ring);
      const b = mesh(bolt, materials.steelPolished);
      b.position.set(-0.729, y, s * (z + 0.018));
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

  // Calço de fixação sob a base e placa do rodízio.
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
