import * as THREE from 'three';
import { applyClearTubeShader, type Materials } from './materials';
import { DIN, mesh, tagPick, type PickInfo } from './parts';
import { createFluidMaterial, type FluidMaterial } from './fluid';

/** Mangueira cristal de 2" com espiral de aço, e o líquido dentro dela. */

export interface HoseModel {
  group: THREE.Group;
  curve: THREE.Curve<THREE.Vector3>;
  length: number;
  fluid: THREE.Mesh;
  fluidMaterial: FluidMaterial;
  /** Materiais que esmaecem na vista explodida. */
  fadeMaterials: THREE.Material[];
}

/** Curva de uma porta (posição + direção de saída) até outra, passando por pontos intermediários. */
export function hoseCurve(
  start: { position: THREE.Vector3; direction: THREE.Vector3 },
  waypoints: THREE.Vector3[],
  end: { position: THREE.Vector3; direction: THREE.Vector3 },
): THREE.CatmullRomCurve3 {
  const points = [
    start.position.clone(),
    start.position.clone().addScaledVector(start.direction, 0.03),
    start.position.clone().addScaledVector(start.direction, 0.075),
    ...waypoints,
    end.position.clone().addScaledVector(end.direction, 0.075),
    end.position.clone().addScaledVector(end.direction, 0.03),
    end.position.clone(),
  ];
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  curve.arcLengthDivisions = 1200;
  return curve;
}

/** Espiral que acompanha a curva da mangueira, a um raio fixo. */
class HelixCurve extends THREE.Curve<THREE.Vector3> {
  private readonly frames: { tangents: THREE.Vector3[]; normals: THREE.Vector3[]; binormals: THREE.Vector3[] };
  private readonly n = new THREE.Vector3();
  private readonly b = new THREE.Vector3();

  constructor(
    private readonly base: THREE.Curve<THREE.Vector3>,
    private readonly radius: number,
    private readonly turns: number,
    private readonly samples: number,
  ) {
    super();
    this.frames = base.computeFrenetFrames(samples, false);
  }

  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const f = THREE.MathUtils.clamp(t, 0, 1) * this.samples;
    const i = Math.min(Math.floor(f), this.samples - 1);
    const k = f - i;
    this.n.copy(this.frames.normals[i]).lerp(this.frames.normals[i + 1], k).normalize();
    this.b.copy(this.frames.binormals[i]).lerp(this.frames.binormals[i + 1], k).normalize();
    const angle = t * this.turns * Math.PI * 2;
    this.base.getPointAt(THREE.MathUtils.clamp(t, 0, 1), target);
    return target.addScaledVector(this.n, Math.cos(angle) * this.radius).addScaledVector(this.b, Math.sin(angle) * this.radius);
  }

  override getPointAt(u: number, target?: THREE.Vector3): THREE.Vector3 {
    return this.getPoint(u, target);
  }

  override getTangentAt(u: number, target?: THREE.Vector3): THREE.Vector3 {
    return this.getTangent(u, target);
  }
}

export function createHose(
  curve: THREE.Curve<THREE.Vector3>,
  materials: Materials,
  options: { lightDir: THREE.Vector3; pick: PickInfo },
): HoseModel {
  const group = new THREE.Group();
  group.name = 'mangueira';
  const length = curve.getLength();
  const segments = Math.max(64, Math.round(length * 150));

  const hoseMaterial = applyClearTubeShader(materials.hose.clone());
  const outer = mesh(new THREE.TubeGeometry(curve, segments, DIN.hoseRadius, 32, false), hoseMaterial, { cast: true, receive: false });
  outer.renderOrder = 2;
  group.add(outer);

  const pitch = 0.017;
  const turns = Math.round(length / pitch);
  const helix = new HelixCurve(curve, DIN.hoseRadius - 0.0024, turns, Math.max(200, turns * 6));
  const wireMaterial = materials.hoseWire.clone();
  const wire = mesh(new THREE.TubeGeometry(helix, turns * 12, 0.0009, 4, false), wireMaterial, { cast: false, receive: false });
  group.add(wire);

  const fluidMaterial = createFluidMaterial(length, { lightDir: options.lightDir });
  const fluid = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, DIN.hoseRadius - 0.0062, 24, false), fluidMaterial);
  fluid.name = 'liquido';
  group.add(fluid);

  tagPick(outer, options.pick);
  tagPick(wire, options.pick);
  tagPick(fluid, options.pick);

  return { group, curve, length, fluid, fluidMaterial, fadeMaterials: [hoseMaterial, wireMaterial] };
}
