import '@fontsource-variable/inter';
import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { contactShadowTexture, createMaterials, studioEnvironment } from './materials';
import { buildBreweryCart, type CalloutAnchor } from './scene';
import { syncFluidMaterial } from './fluid';
import { BOOT_DURATION, FLUIDS, FLUID_IDS, FlowSimulation, MAX_FLOW, type FluidId } from './simulation';
import { formatFlow } from './display';
import type { PickInfo } from './parts';
import { Callouts, ControlPanel, Sparkline, Tooltip } from './ui';

const LINE_COLORS: Record<FluidId, string> = { agua: '#1f6fd1', cerveja: '#c97a06' };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobileQuery = matchMedia('(max-width: 760px)');

async function loadFonts(): Promise<void> {
  const fonts = ['500 40px "Inter Variable"', '600 40px "Inter Variable"', '700 40px "Inter Variable"'];
  try {
    await Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f))), new Promise((resolve) => setTimeout(resolve, 1500))]);
  } catch {
    // Sem a fonte, os textos usam a fonte do sistema.
  }
}

function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer | null {
  try {
    return new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  } catch {
    return null;
  }
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

async function start(): Promise<void> {
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const loading = document.getElementById('loading')!;
  const created = createRenderer(canvas);
  if (!created) {
    document.getElementById('fallback')!.hidden = false;
    loading.dataset.done = 'true';
    return;
  }
  const renderer = created;
  await loadFonts();

  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // As sombras só são recalculadas quando alguma peça se move.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  // ——— Cena, luz e ambiente ———
  const scene = new THREE.Scene();
  const background = new THREE.Color('#e8ebef');
  scene.background = background;
  scene.fog = new THREE.Fog(background, 7, 17);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studioEnvironment(), 0.02).texture;
  scene.environmentIntensity = 1;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(2.2, 4.4, 2.8);
  key.target.position.set(-0.25, 0.45, 0.05);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -1.75, right: 1.75, top: 1.75, bottom: -1.75, near: 1.5, far: 9.5 });
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 3;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.55);
  fill.position.set(-3, 2.2, -1.6);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9cdd2, 0.3));
  const lightDir = key.position.clone().sub(key.target.position).normalize();

  const materials = createMaterials(renderer);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), materials.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 1.05),
    new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, opacity: 0.5 }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(-0.02, 0.0015, 0);
  scene.add(contact);

  const model = buildBreweryCart(materials, lightDir);
  scene.add(model.root);

  const sim = new FlowSimulation({ segments: model.segments, paths: model.paths, meterSegment: 'meter', streamSegment: 'stream' });

  // ——— Câmera e controles ———
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.4;
  controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.minPolarAngle = 0.12;
  controls.autoRotateSpeed = 0.6;
  controls.zoomSpeed = 0.9;

  const HOME = {
    target: new THREE.Vector3(-0.2, 0.58, 0.08),
    targetMobile: new THREE.Vector3(-0.08, 0.6, 0.06),
    azimuth: THREE.MathUtils.degToRad(36),
    elevation: THREE.MathUtils.degToRad(19),
  };
  const layout = { width: 1, height: 1, offsetX: 0, offsetY: 0, fit: 4 };

  const homeTarget = () => (mobileQuery.matches ? HOME.targetMobile : HOME.target);
  const spherical = (target: THREE.Vector3, azimuth: number, elevation: number, distance: number) =>
    new THREE.Vector3(
      target.x + Math.sin(azimuth) * Math.cos(elevation) * distance,
      target.y + Math.sin(elevation) * distance,
      target.z + Math.cos(azimuth) * Math.cos(elevation) * distance,
    );
  const homeView = () => {
    const target = homeTarget().clone();
    return { target, position: spherical(target, HOME.azimuth, HOME.elevation, layout.fit) };
  };

  let userMovedCamera = false;
  const panelElement = document.querySelector<HTMLElement>('.cc-panel')!;
  const brandElement = document.querySelector<HTMLElement>('.cc-brand')!;
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const rect = panelElement.getBoundingClientRect();
    const mobile = mobileQuery.matches;
    // Área livre: à esquerda do painel (computador) ou entre o título e a folha inferior (celular).
    const sheet = mobile ? Math.max(0, Math.round(h - rect.top)) : 0;
    const title = mobile ? Math.round(brandElement.getBoundingClientRect().bottom) : 0;
    layout.width = w;
    layout.height = h;
    layout.offsetX = mobile ? 0 : Math.max(0, Math.round(w - rect.left));
    layout.offsetY = sheet;
    const shiftY = Math.max(0, sheet - title);
    const VW = w + layout.offsetX;
    const VH = h + shiftY;
    camera.aspect = VW / VH;
    camera.setViewOffset(VW, VH, layout.offsetX, shiftY, w, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    // Distância que enquadra o carrinho na área livre da tela.
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const visibleW = w - layout.offsetX;
    const visibleH = h - sheet - title;
    const half = Math.min(Math.atan((t * visibleW) / VH), Math.atan((t * visibleH) / VH));
    const radius = mobile ? 1.0 : 1.02;
    layout.fit = radius / Math.sin(half);
    if (!userMovedCamera && !tween) {
      const view = homeView();
      camera.position.copy(view.position);
      controls.target.copy(view.target);
    }
  }

  // ——— Transições de câmera ———
  let tween: { fromPos: THREE.Vector3; fromTarget: THREE.Vector3; toPos: THREE.Vector3; toTarget: THREE.Vector3; t: number; duration: number } | null = null;
  const flyTo = (position: THREE.Vector3, target: THREE.Vector3, duration = 1.2) => {
    tween = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos: position, toTarget: target, t: 0, duration };
  };
  controls.addEventListener('start', () => {
    tween = null;
    userMovedCamera = true;
    fadeHint();
  });

  resize();
  window.addEventListener('resize', resize);
  mobileQuery.addEventListener('change', resize);

  // Abertura: câmera mais distante enquanto o carrinho se monta.
  if (!reducedMotion) {
    model.assembly.progress = 0;
    model.assembly.target = 0;
    const view = homeView();
    camera.position.copy(spherical(view.target, HOME.azimuth - 0.55, HOME.elevation + 0.22, layout.fit * 1.28));
    controls.target.copy(view.target).add(new THREE.Vector3(0, 0.18, 0));
  }
  model.assembly.apply(model.assembly.progress);

  // ——— Interface ———
  let pendingStart = false;
  let everRan = false;
  let xray = false;

  const panel = new ControlPanel({
    toggleFlow,
    selectSource,
    setSetpoint: (value) => sim.setSetpoint(value),
    setXray,
    setLabels,
    setExploded,
    setRotate: (on) => {
      controls.autoRotate = on;
      panel.setToggle('rotate', on);
    },
    resetView: () => {
      const view = homeView();
      flyTo(view.position, view.target);
    },
    resetTotalizer: () => sim.resetTotalizer(),
  });
  panel.setSource(sim.source);
  sim.setSetpoint(Number((document.getElementById('setpoint') as HTMLInputElement).value));

  const sparkline = new Sparkline();
  const tooltip = new Tooltip();
  const callouts = new Callouts(model.callouts, focusOn);
  let labelsOn = true;

  function startFlow() {
    if (!model.assembly.assembled) {
      setExploded(false);
      pendingStart = true;
      return;
    }
    sim.start();
    everRan = true;
  }
  function stopFlow() {
    pendingStart = false;
    sim.stop();
  }
  function toggleFlow() {
    if (sim.running || pendingStart) stopFlow();
    else startFlow();
  }
  function selectSource(id: FluidId) {
    sim.setSource(id);
    panel.setSource(id);
  }
  function setXray(on: boolean) {
    xray = on;
    model.picomag.setXray(on);
    panel.setToggle('xray', on);
  }
  function setLabels(on: boolean) {
    labelsOn = on;
    panel.setToggle('labels', on);
  }
  function setExploded(on: boolean) {
    if (on) stopFlow();
    if (model.assembly.target !== (on ? 0 : 1)) {
      // Afasta a câmera para caber a vista explodida (e volta ao montar).
      const view = homeView();
      const position = on ? spherical(view.target, HOME.azimuth, HOME.elevation + 0.08, layout.fit * 1.32).add(new THREE.Vector3(0, 0.2, 0)) : view.position;
      const target = on ? view.target.clone().add(new THREE.Vector3(0, 0.2, 0)) : view.target;
      flyTo(position, target, 1.4);
    }
    model.assembly.target = on ? 0 : 1;
    panel.setToggle('explode', on);
  }
  function focusOn(anchor: CalloutAnchor) {
    const target = anchor.object.getWorldPosition(new THREE.Vector3());
    const direction = camera.position.clone().sub(controls.target).normalize();
    direction.y = THREE.MathUtils.clamp(direction.y, 0.12, 0.6);
    direction.normalize();
    const scale = layout.fit / 3.7;
    flyTo(target.clone().addScaledVector(direction, anchor.focusDistance * Math.max(1, scale)), target, 1.1);
    userMovedCamera = true;
    fadeHint();
  }

  const hint = document.getElementById('hint')!;
  let hintFaded = false;
  if (mobileQuery.matches) window.setTimeout(fadeHint, 4000);
  function fadeHint() {
    if (hintFaded) return;
    hintFaded = true;
    window.setTimeout(() => (hint.dataset.faded = 'true'), 2500);
  }

  // ——— Seleção de peças com o mouse/toque ———
  const pickables: THREE.Object3D[] = [];
  model.root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh && findPick(object)) pickables.push(object);
  });
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function findPick(object: THREE.Object3D): PickInfo | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.userData.pick) return current.userData.pick as PickInfo;
      current = current.parent;
    }
    return null;
  }
  function isVisible(object: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (!current.visible) return false;
      current = current.parent;
    }
    return true;
  }
  function intersect(clientX: number, clientY: number) {
    pointer.set((clientX / layout.width) * 2 - 1, -(clientY / layout.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    for (const hit of hits) {
      if (!isVisible(hit.object)) continue;
      const info = findPick(hit.object);
      if (info) return { info, hit };
    }
    return null;
  }

  function actionHint(info: PickInfo): string {
    if (!info.action) return '';
    if (info.action === 'alternar-fluxo') return sim.running ? 'Clique para parar o fluxo' : 'Clique para iniciar o fluxo';
    if (info.id.startsWith('valvula')) {
      const id = info.action.replace('linha-', '') as FluidId;
      return sim.running && sim.source === id ? 'Clique para fechar a linha' : `Clique para abrir a linha ${FLUIDS[id].name}`;
    }
    return 'Clique para selecionar este produto';
  }

  function runAction(info: PickInfo) {
    if (!info.action) return;
    if (info.action === 'alternar-fluxo') {
      sim.wake();
      toggleFlow();
      return;
    }
    if (info.action.startsWith('linha-')) {
      const id = info.action.replace('linha-', '') as FluidId;
      if (info.id.startsWith('valvula')) {
        if (sim.running && sim.source === id) stopFlow();
        else {
          selectSource(id);
          startFlow();
        }
      } else selectSource(id);
    }
  }

  let hover: { x: number; y: number; mouse: boolean } | null = null;
  let hoverDirty = false;
  let down: { x: number; y: number; time: number } | null = null;
  canvas.addEventListener('pointermove', (event) => {
    hover = { x: event.clientX, y: event.clientY, mouse: event.pointerType === 'mouse' };
    hoverDirty = true;
  });
  canvas.addEventListener('pointerleave', () => {
    hover = null;
    tooltip.hide();
    canvas.style.cursor = '';
  });
  canvas.addEventListener('pointerdown', (event) => {
    down = { x: event.clientX, y: event.clientY, time: performance.now() };
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!down) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    const quick = performance.now() - down.time < 450;
    down = null;
    if (moved > 6 || !quick) return;
    const result = intersect(event.clientX, event.clientY);
    if (result) {
      runAction(result.info);
      if (event.pointerType !== 'mouse') {
        tooltip.show(event.clientX, event.clientY, result.info, actionHint(result.info));
        window.setTimeout(() => tooltip.hide(), 2600);
      }
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    const onButton = target instanceof HTMLButtonElement || target.tagName === 'SUMMARY';
    switch (event.key.toLowerCase()) {
      case ' ':
        if (onButton) return;
        event.preventDefault();
        toggleFlow();
        break;
      case 'a':
        selectSource('agua');
        break;
      case 'c':
        selectSource('cerveja');
        break;
      case 'x':
        setXray(!xray);
        break;
      case 'e':
        setExploded(model.assembly.target === 1);
        break;
      case 'l':
        setLabels(!labelsOn);
        break;
      case 'r': {
        const view = homeView();
        flyTo(view.position, view.target);
        break;
      }
    }
  });

  // ——— Laço de animação ———
  const timer = new THREE.Timer();
  timer.connect(document);
  let elapsed = 0;
  let introStarted = reducedMotion;
  let displayBrightness = 0;
  let frameCount = 0;
  let uiTimer = 0;
  const hoseBaseOpacity = materials.hose.opacity;
  const tmp = new THREE.Vector3();

  function updateStatus() {
    const name = FLUIDS[sim.source].name;
    let text: string;
    if (!model.assembly.assembled) {
      text = model.assembly.target === 0 ? 'Vista explodida: peças separadas. Clique em “Vista explodida” de novo para montar.' : 'Montando o carrinho…';
    } else if (sim.running) {
      if (!sim.meterFull) text = `Escorvando a linha ${name}: o medidor indica tubo vazio até o produto chegar.`;
      else if (sim.meterFluid && sim.meterFluid !== sim.source) text = `Trocando de produto: a ${name} está empurrando o produto anterior pelo medidor.`;
      else text = `Transferindo ${name} a ${formatFlow(sim.displayFlow)} m³/h — vazão e temperatura ao vivo no Picomag.`;
    } else if (sim.trueFlow > 0) text = 'Fechando as válvulas…';
    else if (!everRan) text = 'Linhas vazias. Escolha o produto e clique em Iniciar fluxo — ou clique no Picomag.';
    else text = 'Fluxo parado. As mangueiras continuam cheias; o display dorme após 30 s.';
    panel.setStatus(text);
  }

  function frame(timestamp: number) {
    timer.update(timestamp);
    const dt = Math.min(timer.getDelta(), 0.1);
    elapsed += dt;
    frameCount++;

    if (!introStarted && elapsed > 0.35) {
      introStarted = true;
      model.assembly.target = 1;
      const view = homeView();
      flyTo(view.position, view.target, 3.4);
    }
    model.assembly.update(dt, reducedMotion ? 0.001 : 3.0);
    if (pendingStart && model.assembly.assembled) {
      pendingStart = false;
      sim.start();
      everRan = true;
    }

    sim.step(dt);

    // Mangueiras aparecem só com tudo encaixado.
    const hoseOpacity = model.assembly.hoseOpacity;
    for (const hose of Object.values(model.hoses)) {
      hose.group.visible = hoseOpacity > 0.01;
      const [hoseMaterial, wireMaterial] = hose.fadeMaterials;
      hoseMaterial.opacity = hoseBaseOpacity * hoseOpacity;
      wireMaterial.transparent = hoseOpacity < 0.999;
      wireMaterial.opacity = hoseOpacity;
    }
    for (const binding of model.bindings) {
      const segment = sim.segment(binding.segment);
      binding.mesh.visible = hoseOpacity > 0.9 && segment.fill > 0.0005;
      syncFluidMaterial(binding.material, segment, elapsed);
    }

    const valvesMoving = FLUID_IDS.some((id) => sim.valve[id] > 0 && sim.valve[id] < 1);
    if (model.assembly.animating || valvesMoving || frameCount < 3) renderer.shadowMap.needsUpdate = true;
    for (const id of FLUID_IDS) {
      model.tanks[id].valve.setOpen(sim.valve[id]);
      model.manifold.valves[id].setOpen(sim.valve[id]);
      model.tanks[id].gauge.setPressure(sim.pressure[id]);
    }

    const stream = sim.segment('stream');
    const splashIntensity = hoseOpacity > 0.9 && stream.fill >= 1 && stream.tail === 0 ? THREE.MathUtils.clamp(sim.trueFlow / 24, 0.35, 1.4) : 0;
    model.splash.update(dt, splashIntensity, stream.fluid, elapsed);

    const targetBrightness = sim.meterMode === 'sleep' ? 0 : sim.meterMode === 'boot' ? Math.min(1, (sim.bootElapsed / BOOT_DURATION) * 3) : 1;
    displayBrightness += (targetBrightness - displayBrightness) * (1 - Math.exp(-dt / 0.12));
    model.picomag.update(
      {
        mode: sim.meterMode,
        boot: Math.min(1, sim.bootElapsed / BOOT_DURATION),
        flow: sim.displayFlow,
        maxFlow: MAX_FLOW,
        temperature: sim.sensorTemperature,
        totalizer: sim.totalizer,
        conductivity: sim.conductivity,
        velocity: sim.velocity,
        emptyPipe: !sim.meterFull,
        measuring: sim.meterFull && sim.displayFlow > 0,
        line: FLUIDS[sim.source].name,
        lineColor: LINE_COLORS[sim.source],
        battery: sim.battery,
        time: elapsed,
      },
      displayBrightness,
      sim.trueFlow / 20,
      elapsed,
    );

    if (tween) {
      tween.t = Math.min(1, tween.t + dt / tween.duration);
      const e = ease(tween.t);
      camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
      if (tween.t >= 1) tween = null;
    }
    controls.update(dt);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0.03, 1.6);

    renderer.render(scene, camera);

    if (frameCount === 2) loading.dataset.done = 'true';

    // Legendas: escondidas enquanto as peças se movem.
    const showCallouts = labelsOn && model.assembly.assembled;
    callouts.setVisible(showCallouts);
    const checkOcclusion = frameCount % 8 === 0;
    callouts.update(
      camera,
      layout.width,
      layout.height,
      layout.width - layout.offsetX,
      layout.height - layout.offsetY,
      checkOcclusion
        ? (world) => {
            tmp.copy(world).sub(camera.position);
            const distance = tmp.length();
            raycaster.set(camera.position, tmp.normalize());
            raycaster.far = distance;
            const blocked = raycaster.intersectObjects(pickables, false).some((hit) => isVisible(hit.object) && hit.distance < distance - 0.04);
            raycaster.far = Infinity;
            return blocked;
          }
        : undefined,
    );

    if (hover && !down && (hoverDirty || frameCount % 15 === 0)) {
      hoverDirty = false;
      const result = intersect(hover.x, hover.y);
      canvas.style.cursor = result?.info.action ? 'pointer' : '';
      if (result && hover.mouse) tooltip.show(hover.x, hover.y, result.info, actionHint(result.info));
      else if (hover.mouse) tooltip.hide();
    } else if (down) {
      tooltip.hide();
    }

    uiTimer += dt;
    const sampled = sparkline.push(dt, sim.meterMode === 'on' ? sim.displayFlow : 0);
    if (uiTimer > 0.1) {
      uiTimer = 0;
      panel.setRunning(sim.running || pendingStart);
      panel.updateTelemetry(sim);
      updateStatus();
    }
    if (sampled) sparkline.draw(LINE_COLORS[sim.source]);
  }

  renderer.setAnimationLoop(frame);
}

void start();
