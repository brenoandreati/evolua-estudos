import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Materials } from './materials';
import { DIN, GeometryCache, cylinderX, dinUnion, latheX, mesh, tagPick } from './parts';
import { DISPLAY_SIZE, drawDisplay, type DisplayData } from './display';
import { createFluidMaterial, remapCylinderUv, type FluidMaterial } from './fluid';

/**
 * Medidor de vazão eletromagnético compacto (representação ilustrativa de um Picomag DN50).
 * Origem no eixo do tubo de medição; escoamento de +X (entrada) para −X (saída); display para +Z.
 */

export const METER = {
  /** Comprimento do núcleo visível (entre os colarinhos). */
  coreLength: 0.17,
  /** Distância do centro até o início do macho roscado de cada lado. */
  stub: 0.095,
};

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

export function createPicomag(materials: Materials, cache: GeometryCache, lightDir: THREE.Vector3): PicomagModel {
  const group = new THREE.Group();
  group.name = 'picomag';
  const pick = {
    id: 'picomag',
    title: 'Picomag DN50 — medidor de vazão eletromagnético',
    description: 'Mede vazão (até 42 m³/h), temperatura e condutividade sem partes móveis. Bateria interna e Bluetooth: nenhum cabo no carrinho. Clique para ligar/desligar o fluxo.',
    action: 'alternar-fluxo',
  };

  // Materiais próprios (ficam translúcidos no modo raio-X).
  const body = materials.meterBody.clone();
  const bezel = materials.meterBezel.clone();
  const xrayMaterials: THREE.Material[] = [body, bezel];

  const housing = mesh(new RoundedBoxGeometry(0.17, 0.2, 0.108, 5, 0.024), body);
  housing.position.y = 0.045;
  group.add(housing);

  // Colarinhos de inox onde o tubo sai da carcaça.
  const collar = latheX([
    [DIN.pipeRadius, 0],
    [0.038, 0],
    [0.04, 0.003],
    [0.04, 0.012],
    [0.034, 0.016],
    [DIN.pipeRadius, 0.016],
  ]);
  for (const side of [1, -1]) {
    const c = mesh(collar, materials.steelPolished);
    c.position.x = side * 0.081;
    c.scale.x = side;
    group.add(c);
    const stub = mesh(cylinderX(DIN.pipeRadius, 0.012, 0, 32), materials.steelPolished);
    stub.position.x = side > 0 ? 0.084 : -0.096;
    group.add(stub);
  }

  // Entrada: macho DIN voltado para +X, recebe a porca do manifold.
  const inletUnion = dinUnion(materials, cache);
  inletUnion.position.x = METER.stub;
  // A união da entrada leva um tubo liso em vez de espigão.
  inletUnion.children[2].visible = false;
  group.add(inletUnion);
  const inletLiner = mesh(cylinderX(DIN.pipeRadius, 0.07, METER.stub + 0.045, 32), materials.steelPolished);
  group.add(inletLiner);
  const inletPort = new THREE.Object3D();
  inletPort.position.x = METER.stub + 0.11;
  group.add(inletPort);

  // Saída: macho voltado para −X com a união da mangueira de saída.
  const outletUnion = dinUnion(materials, cache);
  outletUnion.rotation.y = Math.PI;
  outletUnion.position.x = -METER.stub;
  tagPick(outletUnion, {
    id: 'din',
    title: 'União sanitária DIN 11851 DN50 (2")',
    description: 'Porca ranhurada sobre o macho roscado do medidor; a mangueira de saída leva o produto até o ponto de descarga.',
  });
  group.add(outletUnion);
  const outletPort = new THREE.Object3D();
  outletPort.position.x = -(METER.stub + DIN.unionLength);
  outletPort.rotation.y = Math.PI;
  group.add(outletPort);

  // Frente: moldura, display e vidro.
  const bezelMesh = mesh(new RoundedBoxGeometry(0.13, 0.092, 0.008, 3, 0.007), bezel);
  bezelMesh.position.set(0, 0.086, 0.0525);
  group.add(bezelMesh);

  const displayCanvas = document.createElement('canvas');
  displayCanvas.width = DISPLAY_SIZE.width;
  displayCanvas.height = DISPLAY_SIZE.height;
  const displayContext = displayCanvas.getContext('2d')!;
  const displayTexture = new THREE.CanvasTexture(displayCanvas);
  displayTexture.colorSpace = THREE.SRGBColorSpace;
  displayTexture.anisotropy = 8;
  const displayMaterial = new THREE.MeshBasicMaterial({ map: displayTexture, toneMapped: false });
  displayMaterial.color.setScalar(0.02);
  const display = new THREE.Mesh(new THREE.PlaneGeometry(0.112, 0.07), displayMaterial);
  display.position.set(0, 0.086, 0.0568);
  group.add(display);
  // Brilho suave da retroiluminação em volta da tela.
  const glowMaterial = new THREE.MeshBasicMaterial({
    map: glowTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
    toneMapped: false,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.105), glowMaterial);
  glow.position.set(0, 0.086, 0.0578);
  glow.renderOrder = 4;
  group.add(glow);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.122, 0.082), materials.glass);
  glass.position.set(0, 0.086, 0.0574);
  glass.renderOrder = 3;
  group.add(glass);

  // Impressão da carcaça.
  const print = new THREE.Mesh(
    new THREE.PlaneGeometry(0.15, 0.06),
    new THREE.MeshStandardMaterial({ map: faceplateTexture(), transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  print.position.set(0, 0.004, 0.0542);
  group.add(print);
  xrayMaterials.push(print.material as THREE.Material);

  // LED de status.
  const ledMaterial = new THREE.MeshStandardMaterial({ color: 0x0f2a1d, emissive: 0x20d38a, emissiveIntensity: 0, roughness: 0.3 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), ledMaterial);
  led.rotation.x = Math.PI / 2;
  led.position.set(0.054, 0.139, 0.0538);
  group.add(led);

  // Tampa da bateria no topo, com serrilhado.
  const cap = new THREE.Group();
  cap.position.set(0.02, 0.145, 0);
  const capBody = mesh(new THREE.CylinderGeometry(0.022, 0.023, 0.012, 40), materials.steelSatin);
  capBody.position.y = 0.006;
  cap.add(capBody);
  const ribGeometry = new THREE.BoxGeometry(0.003, 0.01, 0.004);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const rib = mesh(ribGeometry, materials.steelSatin, { cast: false });
    rib.position.set(Math.cos(a) * 0.0228, 0.006, Math.sin(a) * 0.0228);
    rib.rotation.y = -a;
    cap.add(rib);
  }
  const capTop = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.002, 32), materials.steelPolished);
  capTop.position.y = 0.0125;
  cap.add(capTop);
  group.add(cap);

  // ——— Interior (visível no modo raio-X) ———
  const internals = new THREE.Group();
  internals.name = 'interior';
  internals.visible = false;
  group.add(internals);
  const liner = new THREE.Mesh(cylinderX(0.0262, METER.coreLength, -METER.coreLength / 2, 40, true), materials.meterLiner);
  liner.renderOrder = 1;
  internals.add(liner);
  const fluidMaterial = createFluidMaterial(METER.coreLength, { lightDir });
  const fluid = new THREE.Mesh(remapCylinderUv(cylinderX(0.0236, METER.coreLength, -METER.coreLength / 2, 32, true), true), fluidMaterial);
  fluid.name = 'liquido-medidor';
  internals.add(fluid);

  const coilGeometry = new THREE.TorusGeometry(0.03, 0.0065, 12, 40);
  coilGeometry.rotateX(Math.PI / 2);
  coilGeometry.scale(1.25, 1, 0.9);
  const shoeGeometry = new RoundedBoxGeometry(0.085, 0.004, 0.05, 2, 0.0015);
  for (const s of [1, -1]) {
    const coil = mesh(coilGeometry, materials.copper);
    coil.position.y = s * 0.046;
    internals.add(coil);
    const shoe = mesh(shoeGeometry, materials.steelSatin);
    shoe.position.y = s * 0.031;
    internals.add(shoe);
  }
  const electrodeMaterial = new THREE.MeshStandardMaterial({ color: 0xd8c27a, metalness: 1, roughness: 0.25, emissive: 0x36d6ff, emissiveIntensity: 0 });
  const electrodeGeometry = new THREE.CylinderGeometry(0.0035, 0.0035, 0.014, 16);
  electrodeGeometry.rotateX(Math.PI / 2);
  for (const s of [1, -1]) {
    const e = new THREE.Mesh(electrodeGeometry, electrodeMaterial);
    e.position.z = s * 0.029;
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
  // Placa eletrônica e bateria de lítio.
  const pcb = mesh(new RoundedBoxGeometry(0.12, 0.07, 0.003, 2, 0.001), new THREE.MeshStandardMaterial({ color: 0x1f6b44, roughness: 0.6 }));
  pcb.position.set(0, 0.088, 0.036);
  internals.add(pcb);
  for (let i = 0; i < 6; i++) {
    const chip = mesh(new THREE.BoxGeometry(0.012 + (i % 3) * 0.005, 0.008, 0.003), new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.5 }));
    chip.position.set(-0.04 + (i % 3) * 0.035, 0.07 + Math.floor(i / 3) * 0.03, 0.0335);
    internals.add(chip);
  }
  const battery = mesh(cylinderX(0.0165, 0.07, -0.035, 32), new THREE.MeshPhysicalMaterial({ color: 0x1c4f8f, roughness: 0.35, clearcoat: 0.6 }));
  battery.position.set(0, 0.12, -0.012);
  internals.add(battery);
  const batteryCap = mesh(cylinderX(0.009, 0.005, 0.035, 20), materials.steelPolished);
  batteryCap.position.set(0, 0.12, -0.012);
  internals.add(batteryCap);

  const displayAnchor = new THREE.Object3D();
  displayAnchor.position.set(0, 0.14, 0.06);
  group.add(displayAnchor);

  for (const child of [housing, bezelMesh, print, display, glass, capBody, led]) tagPick(child, pick);
  tagPick(internals, pick);

  let lastDraw = -1;
  const update = (data: DisplayData, brightness: number, flowing: number, time: number) => {
    // Redesenha a ~20 Hz (a tela de um medidor a bateria não precisa de mais).
    if (time - lastDraw > 0.05 || data.mode === 'boot') {
      drawDisplay(displayContext, data);
      displayTexture.needsUpdate = true;
      lastDraw = time;
    }
    displayMaterial.color.setScalar(0.03 + brightness * 0.97);
    glowMaterial.opacity = brightness * 0.22;
    const blink = data.measuring ? (Math.sin(time * 6) > -0.2 ? 1 : 0.15) : data.mode === 'on' ? 0.35 : 0;
    ledMaterial.emissiveIntensity = blink * 2.2;
    fieldMaterial.uniforms.uTime.value = time;
    fieldMaterial.uniforms.uStrength.value = data.mode === 'sleep' ? 0.0 : 0.35 + 0.65 * Math.min(1, flowing);
    electrodeMaterial.emissiveIntensity = Math.min(1, flowing) * 1.5;
  };

  const setXray = (on: boolean) => {
    internals.visible = on;
    for (const material of xrayMaterials) {
      material.transparent = on || material === print.material;
      material.opacity = on ? (material === print.material ? 0.25 : 0.14) : 1;
      material.depthWrite = !on;
      material.needsUpdate = true;
    }
    housing.castShadow = !on;
  };

  return { group, inletPort, outletPort, displayAnchor, fluid, fluidMaterial, update, setXray };
}

function glowTexture(): THREE.CanvasTexture {
  const element = document.createElement('canvas');
  element.width = 256;
  element.height = 180;
  const ctx = element.getContext('2d')!;
  ctx.filter = 'blur(14px)';
  ctx.fillStyle = 'rgba(120,200,255,0.9)';
  ctx.beginPath();
  ctx.roundRect(36, 30, 184, 120, 12);
  ctx.fill();
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function faceplateTexture(): THREE.CanvasTexture {
  const W = 900;
  const H = 360;
  const element = document.createElement('canvas');
  element.width = W;
  element.height = H;
  const ctx = element.getContext('2d')!;
  const font = '"Inter Variable", "Inter", system-ui, sans-serif';
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.font = `700 96px ${font}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('Picomag', 60, 120);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `500 40px ${font}`;
  ctx.fillText('DN50 · 2"   IP67', 64, 210);
  ctx.fillText('Endress+Hauser', 64, 268);
  // Seta do sentido do escoamento (da direita para a esquerda).
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(840, 200);
  ctx.lineTo(640, 200);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(600, 200);
  ctx.lineTo(660, 160);
  ctx.lineTo(660, 240);
  ctx.closePath();
  ctx.fill();
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
