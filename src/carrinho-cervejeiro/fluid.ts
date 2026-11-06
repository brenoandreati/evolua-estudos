import * as THREE from 'three';
import type { FluidId, SegmentState } from './simulation';

/** Aparência de cada produto dentro da mangueira cristal. */
export interface FluidLook {
  color: THREE.Color;
  deep: THREE.Color;
  bubbles: number;
  foam: number;
}

export const FLUID_LOOKS: Record<FluidId, FluidLook> = {
  agua: { color: new THREE.Color('#9fd3f0'), deep: new THREE.Color('#2a7fbf'), bubbles: 0.18, foam: 0.25 },
  cerveja: { color: new THREE.Color('#e8941c'), deep: new THREE.Color('#6e3303'), bubbles: 0.65, foam: 1 },
};

const vertexShader = /* glsl */ `
  uniform float uWobble;
  uniform float uTime;
  uniform float uLength;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec3 p = position;
    if (uWobble > 0.0) {
      float w = sin(uv.x * uLength * 70.0 - uTime * 38.0) * 0.5 + sin(uv.y * 6.2831 * 3.0 + uTime * 9.0) * 0.5;
      p += normal * w * uWobble * (0.4 + uv.x);
    }
    vec4 world = modelMatrix * vec4(p, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uFill;
  uniform float uFront;
  uniform float uTail;
  uniform float uOffset;
  uniform float uLength;
  uniform float uTime;
  uniform float uSpeed;
  uniform vec3 uColorA;
  uniform vec3 uDeepA;
  uniform float uBubblesA;
  uniform float uFoamA;
  uniform vec3 uColorB;
  uniform vec3 uDeepB;
  uniform float uBubblesB;
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
                   mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                   mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  // Bolhas pequenas carregadas pelo escoamento (grade periódica ao redor do tubo).
  float bubbleField(float x, float around, float density) {
    const float ROWS = 18.0;
    vec2 cell = vec2(x * 52.0, around * ROWS);
    vec2 id = floor(cell);
    id.y = mod(id.y, ROWS);
    vec2 f = fract(cell) - 0.5;
    float h = hash2(id);
    if (h > density) return 0.0;
    vec2 jitter = vec2(hash2(id + 4.1), hash2(id + 9.7)) - 0.5;
    float radius = 0.08 + 0.14 * hash2(id + 2.3);
    float d = length((f - jitter * 0.5) * vec2(1.0, 0.75));
    return smoothstep(radius, radius * 0.45, d) * (0.55 + 0.45 * hash2(id + 7.9));
  }

  void main() {
    float u = vUv.x;
    if (u > uFill || u < uTail) discard;

    float s = u * uLength;
    float x = s - uOffset;
    float a = vUv.y * 6.2831853;
    vec3 cyl = vec3(x, cos(a) * 0.35, sin(a) * 0.35);

    // Fluido novo até a frente; o anterior depois dela (transição de ~2 cm).
    float w = 0.02 / uLength;
    float k = smoothstep(uFront - w, uFront + w, u);
    vec3 color = mix(uColorA, uColorB, k);
    vec3 deep = mix(uDeepA, uDeepB, k);
    float bubbles = mix(uBubblesA, uBubblesB, k);

    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewDir);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    // Mais espesso nas bordas: cor mais profunda.
    vec3 col = mix(deep, color, pow(ndv, 0.7));

    // Estrias de escoamento.
    float streak = noise(cyl * vec3(7.0, 6.0, 6.0)) * 0.6 + noise(cyl * vec3(19.0, 14.0, 14.0)) * 0.4;
    col *= 0.86 + 0.28 * streak;
    float caustic = smoothstep(0.62, 0.95, noise(cyl * vec3(11.0, 9.0, 9.0) + vec3(0.0, uTime * 0.15, 0.0)));
    col += caustic * 0.18 * color;

    // Bolhas (gás carbônico na cerveja, micro-bolhas na água).
    float b = bubbleField(x + uTime * 0.012, vUv.y, bubbles * 0.3);
    col = mix(col, vec3(1.0, 0.96, 0.86), b * 0.7);

    // Espuma na frente do líquido enquanto a mangueira enche.
    if (uFill < 0.999) {
      float distanceToFront = (uFill - u) * uLength;
      float foam = smoothstep(0.08, 0.0, distanceToFront) * uFoamA;
      foam *= 0.75 + 0.25 * noise(cyl * 40.0);
      col = mix(col, vec3(1.0, 0.97, 0.9), foam);
    }

    vec3 L = normalize(uLightDir);
    float diffuse = 0.62 + 0.38 * max(dot(N, L), 0.0);
    col *= diffuse;
    vec3 H = normalize(L + V);
    col += pow(max(dot(N, H), 0.0), 70.0) * 0.55;
    col += pow(1.0 - ndv, 3.0) * 0.12;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export type FluidMaterial = THREE.ShaderMaterial & {
  uniforms: Record<
    | 'uFill'
    | 'uFront'
    | 'uTail'
    | 'uOffset'
    | 'uLength'
    | 'uTime'
    | 'uSpeed'
    | 'uWobble'
    | 'uColorA'
    | 'uDeepA'
    | 'uBubblesA'
    | 'uFoamA'
    | 'uColorB'
    | 'uDeepB'
    | 'uBubblesB'
    | 'uLightDir',
    THREE.IUniform
  >;
};

export function createFluidMaterial(length: number, options: { wobble?: number; lightDir: THREE.Vector3 }): FluidMaterial {
  const look = FLUID_LOOKS.agua;
  return new THREE.ShaderMaterial({
    name: 'fluido',
    vertexShader,
    fragmentShader,
    uniforms: {
      uFill: { value: 0 },
      uFront: { value: 0 },
      uTail: { value: 0 },
      uOffset: { value: 0 },
      uLength: { value: length },
      uTime: { value: 0 },
      uSpeed: { value: 0 },
      uWobble: { value: options.wobble ?? 0 },
      uColorA: { value: look.color.clone() },
      uDeepA: { value: look.deep.clone() },
      uBubblesA: { value: look.bubbles },
      uFoamA: { value: look.foam },
      uColorB: { value: look.color.clone() },
      uDeepB: { value: look.deep.clone() },
      uBubblesB: { value: look.bubbles },
      uLightDir: { value: options.lightDir.clone().normalize() },
    },
  }) as FluidMaterial;
}

/** Copia o estado de um trecho da simulação para o material do fluido. */
export function syncFluidMaterial(material: FluidMaterial, segment: SegmentState, time: number): void {
  const u = material.uniforms;
  u.uFill.value = segment.fill;
  u.uFront.value = segment.front;
  u.uTail.value = segment.tail;
  u.uOffset.value = segment.offset;
  u.uTime.value = time;
  const current = FLUID_LOOKS[segment.fluid ?? 'agua'];
  const previous = FLUID_LOOKS[segment.prev ?? segment.fluid ?? 'agua'];
  (u.uColorA.value as THREE.Color).copy(current.color);
  (u.uDeepA.value as THREE.Color).copy(current.deep);
  u.uBubblesA.value = current.bubbles;
  u.uFoamA.value = current.foam;
  (u.uColorB.value as THREE.Color).copy(previous.color);
  (u.uDeepB.value as THREE.Color).copy(previous.deep);
  u.uBubblesB.value = previous.bubbles;
}

/**
 * Reorganiza as UVs de um cilindro ao longo do eixo (após `rotateZ`) para que `uv.x`
 * percorra o comprimento — na mesma convenção da TubeGeometry. Com `reverse`, o
 * escoamento vai do topo/+X para a base/−X.
 */
export function remapCylinderUv(geometry: THREE.BufferGeometry, reverse: boolean): THREE.BufferGeometry {
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const around = uv.getX(i);
    const along = uv.getY(i);
    uv.setXY(i, reverse ? 1 - along : along, around);
  }
  uv.needsUpdate = true;
  return geometry;
}
