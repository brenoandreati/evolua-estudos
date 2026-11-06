import * as THREE from 'three';
import { formatFlow, formatTemperature, formatTotal, formatInteger } from './display';
import type { PickInfo } from './parts';
import type { CalloutAnchor } from './scene';
import { MAX_FLOW, type FlowSimulation, type FluidId } from './simulation';

/** Ligações do painel HTML com a cena. */

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemento #${id} não encontrado.`);
  return element as T;
};

export interface PanelHandlers {
  toggleFlow(): void;
  selectSource(id: FluidId): void;
  setSetpoint(value: number): void;
  setXray(on: boolean): void;
  setLabels(on: boolean): void;
  setExploded(on: boolean): void;
  setRotate(on: boolean): void;
  resetView(): void;
  resetTotalizer(): void;
}

export type ToggleName = 'xray' | 'labels' | 'explode' | 'rotate';

const PLAY = 'M8 5.5v13l10.5-6.5z';
const STOP = 'M7 7h10v10H7z';

export class ControlPanel {
  readonly panel = document.querySelector<HTMLElement>('.cc-panel')!;
  private readonly cta = byId<HTMLButtonElement>('flow-toggle');
  private readonly ctaLabel = this.cta.querySelector('span')!;
  private readonly ctaIcon = this.cta.querySelector('path')!;
  private readonly status = byId<HTMLParagraphElement>('status');
  private readonly setpoint = byId<HTMLInputElement>('setpoint');
  private readonly setpointValue = byId<HTMLOutputElement>('setpoint-value');
  private readonly sources = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-source]'));
  private readonly toggles: Record<ToggleName, HTMLButtonElement> = {
    xray: byId('toggle-xray'),
    labels: byId('toggle-labels'),
    explode: byId('toggle-explode'),
    rotate: byId('toggle-rotate'),
  };
  private readonly meterState = byId<HTMLSpanElement>('meter-state');
  private readonly telemetry = {
    flow: byId<HTMLSpanElement>('t-flow'),
    temp: byId<HTMLSpanElement>('t-temp'),
    total: byId<HTMLSpanElement>('t-total'),
    cond: byId<HTMLSpanElement>('t-cond'),
    vel: byId<HTMLSpanElement>('t-vel'),
    press: byId<HTMLSpanElement>('t-press'),
  };
  private readonly details = byId<HTMLDetailsElement>('telemetry');
  private running: boolean | null = null;
  private statusText = '';

  constructor(handlers: PanelHandlers) {
    this.cta.addEventListener('click', () => handlers.toggleFlow());
    for (const button of this.sources) {
      button.addEventListener('click', () => handlers.selectSource(button.dataset.source as FluidId));
      button.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          const next = button.dataset.source === 'agua' ? 'cerveja' : 'agua';
          handlers.selectSource(next);
          this.sources.find((b) => b.dataset.source === next)?.focus();
        }
      });
    }
    this.setpoint.addEventListener('input', () => {
      const value = Number(this.setpoint.value);
      this.setpointValue.textContent = `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³/h`;
      handlers.setSetpoint(value);
    });
    this.toggles.xray.addEventListener('click', () => handlers.setXray(!this.isOn('xray')));
    this.toggles.labels.addEventListener('click', () => handlers.setLabels(!this.isOn('labels')));
    this.toggles.explode.addEventListener('click', () => handlers.setExploded(!this.isOn('explode')));
    this.toggles.rotate.addEventListener('click', () => handlers.setRotate(!this.isOn('rotate')));
    byId('reset-view').addEventListener('click', () => handlers.resetView());
    byId('reset-total').addEventListener('click', () => handlers.resetTotalizer());
    if (matchMedia('(max-width: 760px)').matches) this.details.open = false;
  }

  isOn(name: ToggleName): boolean {
    return this.toggles[name].getAttribute('aria-pressed') === 'true';
  }

  setToggle(name: ToggleName, on: boolean): void {
    this.toggles[name].setAttribute('aria-pressed', String(on));
  }

  setSource(id: FluidId): void {
    for (const button of this.sources) {
      const active = button.dataset.source === id;
      button.setAttribute('aria-checked', String(active));
      button.tabIndex = active ? 0 : -1;
    }
  }

  setRunning(running: boolean): void {
    if (running === this.running) return;
    this.running = running;
    this.cta.setAttribute('aria-pressed', String(running));
    this.ctaLabel.textContent = running ? 'Parar fluxo' : 'Iniciar fluxo';
    this.ctaIcon.setAttribute('d', running ? STOP : PLAY);
  }

  setStatus(text: string): void {
    if (text === this.statusText) return;
    this.statusText = text;
    this.status.textContent = text;
  }

  updateTelemetry(sim: FlowSimulation): void {
    const on = sim.meterMode === 'on';
    this.telemetry.flow.textContent = on && sim.meterFull ? formatFlow(sim.displayFlow) : on ? '– –' : '0,00';
    this.telemetry.temp.textContent = formatTemperature(sim.sensorTemperature);
    this.telemetry.total.textContent = formatTotal(sim.totalizer);
    this.telemetry.cond.textContent = Number.isNaN(sim.conductivity) ? '– – –' : formatInteger(sim.conductivity);
    this.telemetry.vel.textContent = sim.velocity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    this.telemetry.press.textContent = sim.pressure[sim.source].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let state = 'Display desligado';
    let tone = '';
    if (sim.meterMode === 'boot') state = 'Autoteste…';
    else if (on && !sim.meterFull) {
      state = 'Tubo vazio';
      tone = 'warn';
    } else if (on && sim.displayFlow > 0) {
      state = 'Medindo';
      tone = 'on';
    } else if (on) state = 'Em espera';
    if (this.meterState.textContent !== state) this.meterState.textContent = state;
    this.meterState.dataset.state = tone;
  }
}

/** Gráfico da vazão nos últimos 30 s. */
export class Sparkline {
  private readonly canvas = byId<HTMLCanvasElement>('spark');
  private readonly ctx = this.canvas.getContext('2d')!;
  private readonly samples: number[] = [];
  private readonly capacity = 300;
  private accumulator = 0;

  push(dt: number, value: number): boolean {
    this.accumulator += dt;
    if (this.accumulator < 0.1) return false;
    this.accumulator = 0;
    this.samples.push(value);
    if (this.samples.length > this.capacity) this.samples.shift();
    return true;
  }

  draw(color: string): void {
    const { width: W, height: H } = this.canvas;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(20,32,43,0.08)';
    ctx.lineWidth = 2;
    for (const f of [0.25, 0.5, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(0, H - f * H);
      ctx.lineTo(W, H - f * H);
      ctx.stroke();
    }
    if (this.samples.length < 2) return;
    const pad = 8;
    const x = (i: number) => W - ((this.samples.length - 1 - i) / (this.capacity - 1)) * W;
    const y = (v: number) => H - pad - (Math.min(v, MAX_FLOW) / MAX_FLOW) * (H - pad * 2);
    ctx.beginPath();
    ctx.moveTo(x(0), H);
    this.samples.forEach((v, i) => ctx.lineTo(x(i), y(v)));
    ctx.lineTo(x(this.samples.length - 1), H);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, hexToRgba(color, 0.28));
    gradient.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.beginPath();
    this.samples.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Etiquetas numeradas presas a pontos do modelo. */
export class Callouts {
  private readonly container = byId<HTMLDivElement>('callouts');
  private readonly items: Array<{ anchor: CalloutAnchor; element: HTMLButtonElement; occluded: boolean }> = [];
  private readonly v = new THREE.Vector3();

  constructor(anchors: CalloutAnchor[], onSelect: (anchor: CalloutAnchor) => void) {
    anchors.forEach((anchor, i) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'cc-callout';
      element.setAttribute('aria-label', `${i + 1}. ${anchor.label} — focar a câmera`);
      const number = document.createElement('b');
      number.textContent = String(i + 1);
      const text = document.createElement('span');
      text.textContent = anchor.label;
      element.append(number, text);
      element.addEventListener('click', () => onSelect(anchor));
      this.container.append(element);
      this.items.push({ anchor, element, occluded: false });
    });
  }

  setVisible(visible: boolean): void {
    this.container.hidden = !visible;
  }

  /** `freeWidth`/`freeHeight`: área da tela fora do painel de controles. */
  update(
    camera: THREE.Camera,
    width: number,
    height: number,
    freeWidth: number,
    freeHeight: number,
    isOccluded?: (world: THREE.Vector3) => boolean,
  ): void {
    if (this.container.hidden) return;
    for (const item of this.items) {
      item.anchor.object.getWorldPosition(this.v);
      if (isOccluded) item.occluded = isOccluded(this.v);
      this.v.project(camera);
      const x = ((this.v.x + 1) / 2) * width;
      const y = ((1 - this.v.y) / 2) * height;
      const hidden = this.v.z > 1 || x < 8 || y < 40 || x > freeWidth - 70 || y > freeHeight - 8;
      item.element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, calc(-100% - 10px))`;
      item.element.dataset.hidden = String(hidden);
      item.element.dataset.occluded = String(item.occluded);
      item.element.tabIndex = hidden ? -1 : 0;
    }
  }
}

/** Dica flutuante ao passar o mouse sobre uma peça. */
export class Tooltip {
  private readonly element = byId<HTMLDivElement>('tooltip');
  private current: PickInfo | null = null;
  private hintText = '';

  show(x: number, y: number, info: PickInfo, hint: string): void {
    if (info !== this.current || hint !== this.hintText) {
      this.current = info;
      this.hintText = hint;
      this.element.replaceChildren();
      const title = document.createElement('strong');
      title.textContent = info.title;
      this.element.append(title, document.createTextNode(info.description));
      if (hint) {
        const em = document.createElement('em');
        em.textContent = hint;
        this.element.append(em);
      }
    }
    this.element.hidden = false;
    const rect = this.element.getBoundingClientRect();
    const left = Math.min(x + 16, window.innerWidth - rect.width - 12);
    const top = Math.min(y + 18, window.innerHeight - rect.height - 12);
    this.element.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
  }

  hide(): void {
    this.element.hidden = true;
    this.current = null;
  }
}
