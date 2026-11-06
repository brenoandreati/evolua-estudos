import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Materials } from './materials';
import { DIN, GeometryCache, cylinderX, dinUnion, latheX, mesh, tagPick } from './parts';
import { DISPLAY_SIZE, drawDisplay, type DisplayData } from './display';
import { createFluidMaterial, remapCylinderUv, type FluidMaterial } from './fluid';

/**
 * Medidor de vazão eletromagnético compacto, no formato do Picomag: corpo de inox escovado
 * com seção quadrada arredondada, anel azul numa das pontas, display colorido na lateral,
 * marcações gravadas no topo, sextavados nas conexões e conector M12 por baixo.
 * Origem no eixo do tubo de medição; escoamento de +X (entrada) para −X (saída); display para +Z.
 */

/** Medidas do corpo, em metros. */
const BODY = {
  length: 0.15,
  height: 0.108,
  depth: 0.104,
  radius: 0.016,
};

export const METER = {
  /** Comprimento do núcleo de medição dentro do corpo. */
  coreLength: BODY.length,
  /** Distância do centro até o início do macho roscado de cada lado. */
  stub: 0.095,
};

/** Display na lateral: um pouco à direita do centro, como no aparelho. */
const SCREEN = { x: 0.011, y: 0.0005, width: 0.068, height: 0.0544 };

export interface PicomagModel {
  group: THREE.Group;
  inletPort: THREE.Object3D;
  outletPort: THREE.Object3D;
  displayAnchor: THREE.Object3D;
  fluid: THREE.Mesh;
  fluidMaterial: FluidMaterial;
  update(data: DisplayData, brightness: number, flowing: number, time: number): void;
  setXray(on: boolean): void;
}

/**
 * `flow`: sentido do escoamento ao longo de X (+1 = da esquerda para a direita de quem olha o display).
 * O anel azul fica sempre na ponta esquerda, como no aparelho.
 */
export function createPicomag(materials: Materials, cache: GeometryCache, lightDir: THREE.Vector3, flow: 1 | -1 = -1): PicomagModel {
  const inSide = -flow;
  const outSide = flow;
  const group = new THREE.Group();
  group.name = 'picomag';
  const pick = {
    id: 'picomag',
    title: 'Picomag DN50 — medidor de vazão eletromagnético',
    description: 'Mede vazão (até 42 m³/h), temperatura e condutividade sem partes móveis. Bateria interna e Bluetooth: nenhum cabo no carrinho. Clique para ligar/desligar o fluxo.',
    action: 'alternar-fluxo',
  };
  const halfL = BODY.length / 2;
  const halfH = BODY.height / 2;
  const halfD = BODY.depth / 2;

  // ——— Corpo em inox escovado no sentido do tubo ———
  const bodyMaterial = materials.steel.clone();
  bodyMaterial.name = 'picomag-inox';
  bodyMaterial.color.set(0xe7eaed);
  bodyMaterial.roughness = 0.24;
  bodyMaterial.anisotropy = 0.85;
  bodyMaterial.clearcoat = 0.25;
  bodyMaterial.clearcoatRoughness = 0.2;
  const ringMaterial = new THREE.MeshPhysicalMaterial({
    name: 'picomag-anel-azul',
    color: 0x2c9fe0,
    emissive: 0x0b4f80,
    emissiveIntensity: 0.25,
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
  });
  const xrayMaterials: THREE.Material[] = [bodyMaterial, ringMaterial];

  const housing = mesh(new RoundedBoxGeometry(BODY.length, BODY.height, BODY.depth, 6, BODY.radius), bodyMaterial);
  group.add(housing);

  // Anel azul junto à ponta de saída.
  const ring = mesh(
    new RoundedBoxGeometry(0.008, BODY.height + 0.003, BODY.depth + 0.003, 5, BODY.radius + 0.0015),
    ringMaterial,
  );
  ring.position.x = -halfL + 0.011;
  group.add(ring);

  // Sextavados e pescoços das conexões de processo (as duas pontas).
  const hexGeometry = cylinderX(0.04, 0.017, 0, 6);
  const neckGeometry = latheX([
    [0.034, 0],
    [0.034, 0.002],
    [0.03, 0.004],
    [DIN.pipeRadius + 0.001, 0.004],
    [DIN.pipeRadius + 0.001, 0.0075],
  ]);
  for (const side of [1, -1]) {
    const hex = mesh(hexGeometry, materials.steelPolished);
    hex.position.x = side > 0 ? halfL - 0.002 : -halfL + 0.002 - 0.017;
    group.add(hex);
    const neck = mesh(neckGeometry, materials.steelPolished);
    neck.position.x = side * (halfL + 0.015);
    neck.scale.x = side;
    group.add(neck);
  }

  // Entrada: porca DIN do coletor sobre o macho do medidor (tubo liso em vez de espigão).
  const inletUnion = dinUnion(materials, cache);
  inletUnion.position.x = inSide * METER.stub;
  inletUnion.rotation.y = inSide > 0 ? 0 : Math.PI;
  inletUnion.children[2].visible = false;
  group.add(inletUnion);
  const inletLiner = mesh(cylinderX(DIN.pipeRadius, 0.07, inSide > 0 ? METER.stub + 0.045 : -(METER.stub + 0.115), 32), materials.steelPolished);
  group.add(inletLiner);
  const inletPort = new THREE.Object3D();
  inletPort.position.x = inSide * (METER.stub + 0.11);
  inletPort.rotation.y = inSide > 0 ? 0 : Math.PI;
  group.add(inletPort);

  // Saída: união da mangueira de saída.
  const outletUnion = dinUnion(materials, cache);
  outletUnion.rotation.y = outSide > 0 ? 0 : Math.PI;
  outletUnion.position.x = outSide * METER.stub;
  tagPick(outletUnion, {
    id: 'din',
    title: 'União sanitária DIN 11851 DN50 (2")',
    description: 'Porca ranhurada sobre o macho roscado do medidor; a mangueira de saída leva o produto até o ponto de descarga.',
  });
  group.add(outletUnion);
  const outletPort = new THREE.Object3D();
  outletPort.position.x = outSide * (METER.stub + DIN.unionLength);
  outletPort.rotation.y = outSide > 0 ? 0 : Math.PI;
  group.add(outletPort);

  // Conector M12 por baixo — sem cabo: o medidor funciona com a bateria interna.
  const m12 = new THREE.Group();
  m12.position.y = -halfH;
  const m12Hex = mesh(new THREE.CylinderGeometry(0.0115, 0.0115, 0.006, 6), materials.steelPolished);
  m12Hex.position.y = -0.003;
  m12.add(m12Hex);
  const thread: THREE.Vector2[] = [new THREE.Vector2(0.0001, -0.006), new THREE.Vector2(0.0082, -0.006)];
  for (let i = 0; i < 9; i++) {
    const y = -0.0065 - i * 0.0016;
    thread.push(new THREE.Vector2(0.0092, y), new THREE.Vector2(0.0084, y - 0.0008));
  }
  thread.push(new THREE.Vector2(0.0084, -0.0215), new THREE.Vector2(0.0001, -0.0215));
  const m12Body = mesh(new THREE.LatheGeometry(thread.reverse(), 32), materials.steelPolished);
  m12.add(m12Body);
  const m12Insert = new THREE.Mesh(new THREE.CircleGeometry(0.0062, 24), materials.gasket);
  m12Insert.rotation.x = Math.PI / 2;
  m12Insert.position.y = -0.0217;
  m12.add(m12Insert);
  group.add(m12);

  // ——— Lateral: moldura, display e vidro ———
  const frontZ = halfD;
  const bezelMaterial = new THREE.MeshPhysicalMaterial({ name: 'picomag-moldura', color: 0x050608, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
  xrayMaterials.push(bezelMaterial);
  const bezel = mesh(new RoundedBoxGeometry(SCREEN.width + 0.0045, SCREEN.height + 0.0045, 0.003, 3, 0.0035), bezelMaterial, { cast: false });
  bezel.position.set(SCREEN.x, SCREEN.y, frontZ + 0.0002);
  group.add(bezel);

  const displayCanvas = document.createElement('canvas');
  displayCanvas.width = DISPLAY_SIZE.width;
  displayCanvas.height = DISPLAY_SIZE.height;
  const displayContext = displayCanvas.getContext('2d')!;
  const displayTexture = new THREE.CanvasTexture(displayCanvas);
  displayTexture.colorSpace = THREE.SRGBColorSpace;
  displayTexture.anisotropy = 8;
  const displayMaterial = new THREE.MeshBasicMaterial({ map: displayTexture, toneMapped: false });
  displayMaterial.color.setScalar(0.02);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.width, SCREEN.height), displayMaterial);
  display.position.set(SCREEN.x, SCREEN.y, frontZ + 0.0019);
  group.add(display);
  const glass = new THREE.Mesh(new RoundedBoxGeometry(SCREEN.width + 0.005, SCREEN.height + 0.005, 0.0006, 2, 0.0003), materials.glass);
  glass.position.set(SCREEN.x, SCREEN.y, frontZ + 0.0024);
  glass.renderOrder = 3;
  group.add(glass);

  // Gravações: marca e nome na lateral, certificações e dados no topo.
  const flatL = BODY.length - 2 * BODY.radius;
  const sidePrint = new THREE.Mesh(
    new THREE.PlaneGeometry(flatL, BODY.height - 2 * BODY.radius),
    new THREE.MeshStandardMaterial({ map: sidePrintTexture(flatL, BODY.height - 2 * BODY.radius), transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  sidePrint.position.set(0, 0, frontZ + 0.00015);
  group.add(sidePrint);
  const topPrint = new THREE.Mesh(
    new THREE.PlaneGeometry(flatL, BODY.depth - 2 * BODY.radius),
    new THREE.MeshStandardMaterial({ map: topPrintTexture(), transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  topPrint.rotation.x = -Math.PI / 2;
  topPrint.position.set(0, halfH + 0.00015, 0);
  group.add(topPrint);
  xrayMaterials.push(sidePrint.material as THREE.Material, topPrint.material as THREE.Material);

  // ——— Interior (visível no modo raio-X) ———
  const internals = new THREE.Group();
  internals.name = 'interior';
  internals.visible = false;
  group.add(internals);
  const liner = new THREE.Mesh(cylinderX(0.0262, METER.coreLength, -METER.coreLength / 2, 40, true), materials.meterLiner);
  liner.renderOrder = 1;
  internals.add(liner);
  const fluidMaterial = createFluidMaterial(METER.coreLength, { lightDir });
  const fluid = new THREE.Mesh(remapCylinderUv(cylinderX(0.0236, METER.coreLength, -METER.coreLength / 2, 32, true), flow < 0), fluidMaterial);
  fluid.name = 'liquido-medidor';
  internals.add(fluid);

  const coilGeometry = new THREE.TorusGeometry(0.03, 0.0065, 12, 40);
  coilGeometry.rotateX(Math.PI / 2);
  coilGeometry.scale(1.25, 1, 0.9);
  const shoeGeometry = new RoundedBoxGeometry(0.085, 0.004, 0.05, 2, 0.0015);
  for (const s of [1, -1]) {
    const coil = mesh(coilGeometry, materials.copper);
    coil.position.y = s * 0.04;
    internals.add(coil);
    const shoe = mesh(shoeGeometry, materials.steelSatin);
    shoe.position.y = s * 0.031;
    internals.add(shoe);
  }
  const electrodeMaterial = new THREE.MeshStandardMaterial({ color: 0xd8c27a, metalness: 1, roughness: 0.25, emissive: 0x36d6ff, emissiveIntensity: 0 });
  const electrodeGeometry = new THREE.CylinderGeometry(0.0035, 0.0035, 0.01, 16);
  electrodeGeometry.rotateX(Math.PI / 2);
  for (const s of [1, -1]) {
    const e = new THREE.Mesh(electrodeGeometry, electrodeMaterial);
    e.position.z = s * 0.028;
    internals.add(e);
  }
  // Linhas do campo magnético B (vertical), animadas.
  const fieldMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uStrength: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vY;
      void main() {
        vY = uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uStrength;
      varying float vY;
      void main() {
        float dash = smoothstep(0.35, 0.5, fract(vY * 5.0 + uTime * 1.6));
        float edge = smoothstep(0.0, 0.12, vY) * smoothstep(1.0, 0.88, vY);
        gl_FragColor = vec4(vec3(0.55, 0.42, 1.0) * (0.35 + dash), uStrength * edge * (0.25 + 0.75 * dash));
      }
    `,
  });
  const fieldGeometry = new THREE.CylinderGeometry(0.0012, 0.0012, 0.064, 6, 1, true);
  for (let i = 0; i < 5; i++) {
    for (const z of [-0.012, 0.012]) {
      const line = new THREE.Mesh(fieldGeometry, fieldMaterial);
      line.position.set(-0.04 + i * 0.02, 0, z);
      internals.add(line);
    }
  }
  // Placa eletrônica atrás do display e bateria de lítio na parte de trás.
  const pcb = mesh(new RoundedBoxGeometry(0.11, 0.07, 0.003, 2, 0.001), new THREE.MeshStandardMaterial({ color: 0x1f6b44, roughness: 0.6 }));
  pcb.position.set(SCREEN.x * 0.5, 0, 0.044);
  internals.add(pcb);
  for (let i = 0; i < 6; i++) {
    const chip = mesh(new THREE.BoxGeometry(0.012 + (i % 3) * 0.005, 0.008, 0.003), new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.5 }));
    chip.position.set(-0.035 + (i % 3) * 0.035, -0.018 + Math.floor(i / 3) * 0.036, 0.0415);
    internals.add(chip);
  }
  const battery = mesh(cylinderX(0.0085, 0.08, -0.04, 32), new THREE.MeshPhysicalMaterial({ color: 0x1c4f8f, roughness: 0.35, clearcoat: 0.6 }));
  battery.position.set(0, 0, -0.043);
  internals.add(battery);
  const batteryCap = mesh(cylinderX(0.0045, 0.004, 0.04, 20), materials.steelPolished);
  batteryCap.position.set(0, 0, -0.043);
  internals.add(batteryCap);

  const displayAnchor = new THREE.Object3D();
  displayAnchor.position.set(SCREEN.x, halfH + 0.012, halfD * 0.6);
  group.add(displayAnchor);

  for (const child of [housing, ring, bezel, sidePrint, topPrint, display, glass, m12]) tagPick(child, pick);
  tagPick(internals, pick);

  let lastDraw = -1;
  const update = (data: DisplayData, brightness: number, flowing: number, time: number) => {
    // Redesenha a ~20 Hz (a tela de um medidor a bateria não precisa de mais).
    if (time - lastDraw > 0.05 || data.mode === 'boot') {
      drawDisplay(displayContext, data);
      displayTexture.needsUpdate = true;
      lastDraw = time;
    }
    displayMaterial.color.setScalar(0.02 + brightness * 0.98);
    fieldMaterial.uniforms.uTime.value = time;
    fieldMaterial.uniforms.uStrength.value = data.mode === 'sleep' ? 0.0 : 0.35 + 0.65 * Math.min(1, flowing);
    electrodeMaterial.emissiveIntensity = Math.min(1, flowing) * 1.5;
  };

  const printMaterials = new Set<THREE.Material>([sidePrint.material as THREE.Material, topPrint.material as THREE.Material]);
  const setXray = (on: boolean) => {
    internals.visible = on;
    for (const material of xrayMaterials) {
      const isPrint = printMaterials.has(material);
      material.transparent = on || isPrint;
      material.opacity = on ? (isPrint ? 0.3 : 0.14) : 1;
      material.depthWrite = !on;
      material.needsUpdate = true;
    }
    housing.castShadow = !on;
  };

  return { group, inletPort, outletPort, displayAnchor, fluid, fluidMaterial, update, setXray };
}

const PRINT = '#4b5158';
const FONT = '"Inter Variable", "Inter", system-ui, sans-serif';

function printCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const ctx = element.getContext('2d')!;
  ctx.clearRect(0, 0, width, height);
  return [element, ctx];
}

function canvasTexture(element: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Marca acima do display e nome do aparelho abaixo dele (lateral). */
function sidePrintTexture(planeWidth: number, planeHeight: number): THREE.CanvasTexture {
  const scale = 12000; // pixels por metro
  const W = Math.round(planeWidth * scale);
  const H = Math.round(planeHeight * scale);
  const [element, ctx] = printCanvas(W, H);
  const toX = (x: number) => (x + planeWidth / 2) * scale;
  const toY = (y: number) => (planeHeight / 2 - y) * scale;
  const left = toX(SCREEN.x - SCREEN.width / 2);
  const right = toX(SCREEN.x + SCREEN.width / 2);
  const top = toY(SCREEN.y + SCREEN.height / 2);
  const bottom = toY(SCREEN.y - SCREEN.height / 2);

  ctx.fillStyle = PRINT;
  ctx.textBaseline = 'alphabetic';
  // Logotipo: caixa com as iniciais.
  const box = 50;
  const boxX = right - box;
  const boxY = top - 58 - box;
  ctx.fillRect(boxX, boxY, box, box);
  ctx.fillStyle = '#e8ebee';
  ctx.font = `800 34px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('EH', boxX + box / 2, boxY + box - 14);
  ctx.fillStyle = PRINT;
  ctx.font = `500 46px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('Endress+Hauser', boxX - 12, boxY + box - 8);

  ctx.textAlign = 'left';
  ctx.font = `500 48px ${FONT}`;
  ctx.fillText('Picomag', left + 4, bottom + 92);
  return canvasTexture(element);
}

/** Certificações e dados técnicos gravados no topo. */
function topPrintTexture(): THREE.CanvasTexture {
  const W = 1420;
  const H = 860;
  const [element, ctx] = printCanvas(W, H);
  ctx.fillStyle = 'rgba(75,81,88,0.78)';
  ctx.strokeStyle = 'rgba(75,81,88,0.78)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Linhas de dados da placa (o lado de baixo do canvas fica voltado para o display).
  ctx.font = `500 30px ${FONT}`;
  const lines = [
    'Medidor de vazão eletromagnético · DN50 (2")',
    'Faixa 0…42 m³/h · temperatura · condutividade',
    'Conexões DIN 11851 · IP67',
    'Alimentação: bateria interna de lítio',
  ];
  lines.forEach((line, i) => ctx.fillText(line, 70, 110 + i * 46));

  ctx.font = `600 70px ${FONT}`;
  ctx.fillText('CE', 70, 470);
  // Símbolo de atenção.
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(250, 470);
  ctx.lineTo(290, 405);
  ctx.lineTo(330, 470);
  ctx.closePath();
  ctx.stroke();
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText('!', 283, 462);
  ctx.font = `600 64px ${FONT}`;
  ctx.fillText('EAC', 1180, 470);

  // Bluetooth e IO-Link.
  const bt = (x: number, y: number, s: number) => {
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - s * 0.4, y - s * 0.35);
    ctx.lineTo(x + s * 0.35, y + s * 0.35);
    ctx.lineTo(x, y + s * 0.7);
    ctx.lineTo(x, y - s * 0.7);
    ctx.lineTo(x + s * 0.35, y - s * 0.35);
    ctx.lineTo(x - s * 0.4, y + s * 0.35);
    ctx.stroke();
  };
  bt(110, 650, 34);
  ctx.font = `500 58px ${FONT}`;
  ctx.fillText('Bluetooth®', 160, 672);
  ctx.beginPath();
  ctx.arc(860, 650, 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillText('IO-Link', 905, 672);
  return canvasTexture(element);
}
