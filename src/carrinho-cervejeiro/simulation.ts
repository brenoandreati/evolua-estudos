/**
 * Simulação do circuito do carrinho cervejeiro (sem dependência de 3D).
 *
 * O circuito é uma sequência de trechos (mangueiras, manifold, medidor, saída).
 * Cada trecho guarda quanto já está cheio de líquido (`fill`) e até onde o fluido
 * novo já chegou (`front`) — assim, ao trocar de ÁGUA para CERVEJA, a cerveja
 * empurra a água que estava no medidor e na mangueira de saída.
 *
 * O medidor segue o comportamento de um medidor eletromagnético a bateria:
 * acorda ao detectar fluxo, faz o autoteste, indica "tubo vazio" enquanto o tubo
 * de medição não está cheio e volta a dormir depois de um tempo parado.
 */

export type FluidId = 'agua' | 'cerveja';

export interface FluidSpec {
  id: FluidId;
  /** Nome como aparece no rótulo do tanque e no display. */
  name: string;
  /** Temperatura do produto na linha, em °C. */
  temperature: number;
  /** Condutividade típica, em µS/cm (o medidor eletromagnético exige > 20 µS/cm). */
  conductivity: number;
}

export const FLUIDS: Record<FluidId, FluidSpec> = {
  agua: { id: 'agua', name: 'ÁGUA', temperature: 12.0, conductivity: 480 },
  cerveja: { id: 'cerveja', name: 'CERVEJA', temperature: 2.5, conductivity: 1650 },
};

export const FLUID_IDS: FluidId[] = ['agua', 'cerveja'];

/** Fundo de escala do medidor DN50, em m³/h. */
export const MAX_FLOW = 42;
/** Diâmetro interno da mangueira de 2", em metros. */
export const HOSE_ID = 0.0508;
export const AMBIENT_TEMPERATURE = 21;
/** Pressão estática de CO₂ nos tanques parados, em bar. */
export const STATIC_PRESSURE = 1.0;
/** Corte de vazão baixa do medidor (abaixo disso o display mostra 0). */
export const LOW_FLOW_CUTOFF = 0.08;

export const BOOT_DURATION = 1.6;
export const SLEEP_AFTER = 30;

const HOSE_AREA = Math.PI * (HOSE_ID / 2) ** 2;

/** Velocidade média do líquido num tubo DN50 para uma vazão em m³/h. */
export function velocityFromFlow(flow: number): number {
  return flow / 3600 / HOSE_AREA;
}

/** Pressão de CO₂ que o regulador mantém para empurrar a vazão pedida. */
export function pressureForFlow(flow: number): number {
  return STATIC_PRESSURE + 1.6 * (flow / MAX_FLOW);
}

export interface SegmentSpec {
  id: string;
  /** Comprimento do trecho, em metros. */
  length: number;
}

export interface SegmentState {
  readonly id: string;
  readonly length: number;
  /** Fração cheia de líquido, a partir da entrada (0 a 1). */
  fill: number;
  /** Até onde o fluido `fluid` já chegou (0 a 1); depois disso está `prev`. */
  front: number;
  fluid: FluidId | null;
  prev: FluidId | null;
  /** Só no jato de saída: fração que já caiu depois que o fluxo parou. */
  tail: number;
  /** Distância percorrida pelo líquido (para animar a textura do fluido), em metros. */
  offset: number;
}

export type MeterMode = 'sleep' | 'boot' | 'on';

export interface SimulationOptions {
  segments: SegmentSpec[];
  paths: Record<FluidId, string[]>;
  meterSegment: string;
  /** Trecho final (jato), que escorre quando o fluxo para. */
  streamSegment?: string;
  /** Fator de câmera lenta aplicado ao deslocamento visual do líquido. */
  visualScale?: number;
  random?: () => number;
}

export class FlowSimulation {
  running = false;
  source: FluidId = 'cerveja';
  setpoint = 24;
  /** Vazão real no circuito, em m³/h. */
  trueFlow = 0;
  /** Vazão indicada pelo medidor, em m³/h. */
  measuredFlow = 0;
  /** Temperatura no sensor do medidor, em °C. */
  sensorTemperature = AMBIENT_TEMPERATURE;
  /** Condutividade medida, em µS/cm (NaN com o tubo vazio). */
  conductivity = Number.NaN;
  /** Volume acumulado, em litros. */
  totalizer = 0;
  battery = 97;
  readonly valve: Record<FluidId, number> = { agua: 0, cerveja: 0 };
  readonly pressure: Record<FluidId, number> = { agua: STATIC_PRESSURE, cerveja: STATIC_PRESSURE };
  meterMode: MeterMode = 'sleep';
  bootElapsed = 0;
  idleElapsed = 0;
  time = 0;

  readonly segments = new Map<string, SegmentState>();
  private readonly paths: Record<FluidId, string[]>;
  private readonly meterSegment: string;
  private readonly streamSegment?: string;
  private readonly visualScale: number;
  private readonly random: () => number;
  private noise = 0;

  constructor(options: SimulationOptions) {
    for (const spec of options.segments) {
      if (!(spec.length > 0)) throw new Error(`Trecho ${spec.id} sem comprimento.`);
      this.segments.set(spec.id, {
        id: spec.id,
        length: spec.length,
        fill: 0,
        front: 0,
        fluid: null,
        prev: null,
        tail: 0,
        offset: 0,
      });
    }
    for (const id of FLUID_IDS) {
      for (const segmentId of options.paths[id]) {
        if (!this.segments.has(segmentId)) throw new Error(`Trecho desconhecido: ${segmentId}`);
      }
    }
    if (!this.segments.has(options.meterSegment)) throw new Error('Trecho do medidor desconhecido.');
    this.paths = options.paths;
    this.meterSegment = options.meterSegment;
    this.streamSegment = options.streamSegment;
    this.visualScale = options.visualScale ?? 0.35;
    this.random = options.random ?? Math.random;
  }

  // ——— Comandos ———

  start(): void {
    this.running = true;
    this.wake();
  }

  stop(): void {
    this.running = false;
  }

  toggle(): void {
    if (this.running) this.stop();
    else this.start();
  }

  setSource(id: FluidId): void {
    this.source = id;
  }

  setSetpoint(flow: number): void {
    this.setpoint = Math.min(MAX_FLOW, Math.max(0, Number.isFinite(flow) ? flow : 0));
  }

  /** Acorda o display (toque no medidor ou fluxo detectado). */
  wake(): void {
    this.idleElapsed = 0;
    if (this.meterMode === 'sleep') {
      this.meterMode = 'boot';
      this.bootElapsed = 0;
    }
  }

  resetTotalizer(): void {
    this.totalizer = 0;
  }

  // ——— Leituras ———

  segment(id: string): SegmentState {
    const segment = this.segments.get(id);
    if (!segment) throw new Error(`Trecho desconhecido: ${id}`);
    return segment;
  }

  path(id: FluidId): string[] {
    return this.paths[id];
  }

  get meterFull(): boolean {
    return this.segment(this.meterSegment).fill >= 0.999;
  }

  /** Fluido que está sobre os eletrodos (meio do tubo de medição). */
  get meterFluid(): FluidId | null {
    const meter = this.segment(this.meterSegment);
    if (meter.fill < 0.5) return null;
    if (meter.front >= 0.5) return meter.fluid;
    return meter.prev ?? meter.fluid;
  }

  get displayOn(): boolean {
    return this.meterMode === 'on';
  }

  /** Velocidade real do líquido nas mangueiras, em m/s. */
  get velocity(): number {
    return velocityFromFlow(this.measuredFlow);
  }

  /** Vazão indicada já com o corte de vazão baixa. */
  get displayFlow(): number {
    return this.measuredFlow < LOW_FLOW_CUTOFF ? 0 : this.measuredFlow;
  }

  // ——— Passo de tempo ———

  step(rawDt: number): void {
    const dt = Math.min(Math.max(rawDt, 0), 0.1);
    if (dt === 0) return;
    this.time += dt;

    // Válvulas: abrem/fecham em ~0,6 s.
    for (const id of FLUID_IDS) {
      const target = this.running && this.source === id ? 1 : 0;
      const delta = dt / 0.6;
      this.valve[id] = target > this.valve[id] ? Math.min(target, this.valve[id] + delta) : Math.max(target, this.valve[id] - delta);
    }

    // Vazão real: o regulador de CO₂ empurra o líquido; a válvula limita.
    const flowTarget = this.setpoint * smooth(this.valve[this.source]);
    this.trueFlow = approach(this.trueFlow, flowTarget, dt, 0.5);
    if (flowTarget === 0 && this.trueFlow < 0.05) this.trueFlow = 0;

    const distance = velocityFromFlow(this.trueFlow) * this.visualScale * dt;
    if (distance > 0) {
      this.advance(this.paths[this.source], distance, this.source);
      for (const id of this.paths[this.source]) this.segment(id).offset += distance;
    }
    this.updateStream(dt);

    // Medidor.
    const full = this.meterFull;
    const reading = full ? this.trueFlow : 0;
    this.noise = approach(this.noise, (this.random() - 0.5) * 2, dt, 0.25);
    const noisy = reading > LOW_FLOW_CUTOFF ? reading * (1 + this.noise * 0.004) : reading;
    this.measuredFlow = Math.max(0, approach(this.measuredFlow, noisy, dt, 0.35));
    if (reading === 0 && this.measuredFlow < 0.005) this.measuredFlow = 0;
    this.totalizer += (this.displayFlow / 3.6) * dt;

    const fluid = this.meterFluid;
    if (full && fluid) {
      const spec = FLUIDS[fluid];
      const flowing = this.trueFlow > 0.5;
      this.sensorTemperature = approach(this.sensorTemperature, spec.temperature, dt, flowing ? 2.5 : 180);
      this.conductivity = Number.isNaN(this.conductivity)
        ? spec.conductivity
        : approach(this.conductivity, spec.conductivity, dt, 1.2);
    } else {
      this.sensorTemperature = approach(this.sensorTemperature, AMBIENT_TEMPERATURE, dt, 40);
      this.conductivity = Number.NaN;
    }

    for (const id of FLUID_IDS) {
      const target = this.running && this.source === id ? pressureForFlow(this.setpoint) : STATIC_PRESSURE;
      this.pressure[id] = approach(this.pressure[id], target, dt, 0.8);
    }

    // Display a bateria.
    if (this.running || this.trueFlow > 0.05) this.wake();
    if (this.meterMode === 'boot') {
      this.bootElapsed += dt;
      if (this.bootElapsed >= BOOT_DURATION) this.meterMode = 'on';
    } else if (this.meterMode === 'on' && !this.running && this.trueFlow === 0) {
      this.idleElapsed += dt;
      if (this.idleElapsed >= SLEEP_AFTER) this.meterMode = 'sleep';
    }
  }

  /** Empurra o líquido `distance` metros pelo caminho. */
  private advance(pathIds: string[], distance: number, incoming: FluidId): void {
    const path = pathIds.map((id) => this.segment(id));

    // 1) A borda do líquido avança no primeiro trecho que ainda não está cheio.
    let remaining = distance;
    for (let i = 0; i < path.length && remaining > 0; i++) {
      const seg = path[i];
      if (seg.fill >= 1) continue;
      if (seg.fill === 0 && seg.tail === 0) {
        const upstream = i === 0 ? incoming : outgoingFluid(path[i - 1]);
        seg.fluid = upstream;
        seg.prev = upstream;
        seg.front = 0;
      }
      const capacity = (1 - seg.fill) * seg.length;
      if (remaining <= capacity) {
        seg.fill += remaining / seg.length;
        remaining = 0;
      } else {
        seg.fill = 1;
        remaining -= capacity;
      }
    }

    // 2) A frente do fluido novo avança (não passa da borda do líquido).
    remaining = distance;
    for (const seg of path) {
      if (remaining <= 0) break;
      if (seg.fill <= 0) break;
      if (seg.fluid !== incoming) {
        seg.prev = seg.fluid ?? incoming;
        seg.fluid = incoming;
        seg.front = 0;
      }
      if (seg.front >= 1) continue;
      const before = seg.front;
      seg.front = Math.min(seg.fill, seg.front + remaining / seg.length);
      if (seg.front >= 1) {
        seg.front = 1;
        seg.prev = incoming;
        remaining -= (1 - before) * seg.length;
      } else {
        break;
      }
    }
  }

  /** O jato de saída cai quando o fluxo para. */
  private updateStream(dt: number): void {
    if (!this.streamSegment) return;
    const stream = this.segment(this.streamSegment);
    if (this.trueFlow < 0.5) {
      if (stream.fill > 0) {
        stream.tail = Math.min(stream.fill, stream.tail + dt * 2.6);
        if (stream.tail >= stream.fill) {
          stream.fill = 0;
          stream.tail = 0;
          stream.front = 0;
          stream.fluid = null;
          stream.prev = null;
        }
      }
    } else if (stream.tail > 0) {
      stream.tail = 0;
      stream.fill = 0;
      stream.front = 0;
    }
  }
}

/** Fluido que sai pela ponta de um trecho. */
function outgoingFluid(seg: SegmentState): FluidId | null {
  if (seg.fill <= 0) return null;
  if (seg.front >= 1) return seg.fluid;
  return seg.prev ?? seg.fluid;
}

/** Aproximação de primeira ordem com constante de tempo `tau` (s). */
export function approach(current: number, target: number, dt: number, tau: number): number {
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

function smooth(x: number): number {
  return x * x * (3 - 2 * x);
}
