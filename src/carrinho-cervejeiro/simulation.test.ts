import { describe, expect, it } from 'vitest';
import { FLUIDS, FlowSimulation, MAX_FLOW, SLEEP_AFTER, velocityFromFlow, type FluidId } from './simulation';

function createSimulation() {
  return new FlowSimulation({
    segments: [
      { id: 'supply-agua', length: 1.6 },
      { id: 'supply-cerveja', length: 1.2 },
      { id: 'manifold-agua', length: 0.25 },
      { id: 'manifold-cerveja', length: 0.25 },
      { id: 'meter', length: 0.22 },
      { id: 'outlet', length: 1.5 },
      { id: 'stream', length: 0.3 },
    ],
    paths: {
      agua: ['supply-agua', 'manifold-agua', 'meter', 'outlet', 'stream'],
      cerveja: ['supply-cerveja', 'manifold-cerveja', 'meter', 'outlet', 'stream'],
    },
    meterSegment: 'meter',
    streamSegment: 'stream',
    random: () => 0.5,
  });
}

function run(sim: FlowSimulation, seconds: number, dt = 1 / 60) {
  for (let t = 0; t < seconds; t += dt) sim.step(dt);
}

function primeWith(sim: FlowSimulation, source: FluidId, seconds = 12) {
  sim.setSource(source);
  sim.start();
  run(sim, seconds);
}

describe('FlowSimulation', () => {
  it('começa com as linhas vazias e o display dormindo', () => {
    const sim = createSimulation();
    expect(sim.meterMode).toBe('sleep');
    expect(sim.meterFull).toBe(false);
    expect(sim.segment('supply-cerveja').fill).toBe(0);
  });

  it('enche a linha escolhida, acorda o medidor e mede a vazão pedida', () => {
    const sim = createSimulation();
    sim.setSetpoint(24);
    sim.setSource('cerveja');
    sim.start();

    run(sim, 0.3);
    expect(sim.meterMode).toBe('boot');
    expect(sim.segment('supply-cerveja').fill).toBeGreaterThan(0);
    expect(sim.meterFull).toBe(false);
    expect(sim.displayFlow).toBe(0);

    run(sim, 12);
    expect(sim.meterMode).toBe('on');
    for (const id of sim.path('cerveja')) expect(sim.segment(id).fill).toBe(1);
    expect(sim.segment('supply-agua').fill).toBe(0);
    expect(sim.measuredFlow).toBeCloseTo(24, 1);
    expect(sim.meterFluid).toBe('cerveja');
    expect(sim.sensorTemperature).toBeLessThan(FLUIDS.cerveja.temperature + 1);
    expect(sim.conductivity).toBeCloseTo(FLUIDS.cerveja.conductivity, -1);
    expect(sim.totalizer).toBeGreaterThan(0);
  });

  it('não indica vazão enquanto o tubo de medição não está cheio', () => {
    const sim = createSimulation();
    sim.setSource('agua');
    sim.start();
    let sawEmptyWithFlow = false;
    for (let i = 0; i < 600; i++) {
      sim.step(1 / 60);
      if (!sim.meterFull) {
        expect(sim.displayFlow).toBe(0);
        if (sim.trueFlow > 1) sawEmptyWithFlow = true;
      }
    }
    expect(sawEmptyWithFlow).toBe(true);
  });

  it('para o fluxo, fecha as válvulas e mantém as mangueiras cheias', () => {
    const sim = createSimulation();
    primeWith(sim, 'agua');
    sim.stop();
    run(sim, 4);
    expect(sim.valve.agua).toBe(0);
    expect(sim.trueFlow).toBe(0);
    expect(sim.displayFlow).toBe(0);
    expect(sim.segment('outlet').fill).toBe(1);
    // O jato de saída escorre quando o fluxo para.
    expect(sim.segment('stream').fill).toBe(0);

    const total = sim.totalizer;
    run(sim, 2);
    expect(sim.totalizer).toBe(total);
  });

  it('ao trocar de produto, o novo fluido empurra o anterior pelo medidor', () => {
    const sim = createSimulation();
    primeWith(sim, 'agua');
    expect(sim.meterFluid).toBe('agua');

    sim.setSource('cerveja');
    run(sim, 0.8);
    // A cerveja ainda está enchendo a própria mangueira; o medidor segue com água.
    expect(sim.meterFluid).toBe('agua');
    expect(sim.segment('outlet').fluid).toBe('agua');

    run(sim, 14);
    expect(sim.meterFluid).toBe('cerveja');
    expect(sim.segment('outlet').fluid).toBe('cerveja');
    expect(sim.segment('outlet').front).toBe(1);
    expect(sim.segment('supply-agua').fluid).toBe('agua');
  });

  it('limita a vazão alvo ao fundo de escala do medidor', () => {
    const sim = createSimulation();
    sim.setSetpoint(99);
    expect(sim.setpoint).toBe(MAX_FLOW);
    sim.setSetpoint(-3);
    expect(sim.setpoint).toBe(0);
    sim.setSetpoint(Number.NaN);
    expect(sim.setpoint).toBe(0);
  });

  it('pressuriza o tanque da linha ativa e alivia ao parar', () => {
    const sim = createSimulation();
    sim.setSetpoint(42);
    primeWith(sim, 'cerveja', 6);
    expect(sim.pressure.cerveja).toBeGreaterThan(2.4);
    expect(sim.pressure.agua).toBeCloseTo(1, 2);
    sim.stop();
    run(sim, 6);
    expect(sim.pressure.cerveja).toBeCloseTo(1, 1);
  });

  it('o display volta a dormir depois de um tempo parado e acorda com um toque', () => {
    const sim = createSimulation();
    primeWith(sim, 'agua', 6);
    sim.stop();
    run(sim, SLEEP_AFTER + 6);
    expect(sim.meterMode).toBe('sleep');
    sim.wake();
    expect(sim.meterMode).toBe('boot');
  });

  it('calcula a velocidade num tubo DN50', () => {
    // 42 m³/h num tubo de 50,8 mm ≈ 5,76 m/s.
    expect(velocityFromFlow(42)).toBeCloseTo(5.76, 2);
  });
});
