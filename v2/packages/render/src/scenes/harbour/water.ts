import { Color, Mesh, PlaneGeometry, ShaderMaterial } from 'three';

const VERT = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying float vWave;
void main() {
  vec3 p = position;
  float w = sin(p.x * 0.9 + uTime * 1.3) * 0.5 + sin(p.y * 1.1 - uTime * 1.0) * 0.5 + sin((p.x + p.y) * 0.5 + uTime * 0.7) * 0.5;
  p.z += w * 0.07;
  vWave = w;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const FRAG = /* glsl */ `
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uFog;
uniform float uTime;
varying vec3 vWorld;
varying float vWave;
void main() {
  vec3 view = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - clamp(view.y, 0.0, 1.0), 3.0);
  vec3 base = mix(uDeep, uShallow, clamp(0.5 + vWave * 0.25, 0.0, 1.0));
  // Cheap moving glints.
  float g = sin(vWorld.x * 3.1 + uTime * 1.7) * sin(vWorld.z * 2.7 - uTime * 1.3);
  float glint = smoothstep(0.82, 1.0, g) * 0.35;
  vec3 col = mix(base, uSky, fres * 0.75) + glint;
  float dist = length(cameraPosition - vWorld);
  float f = smoothstep(26.0, 80.0, dist);
  col = mix(col, uFog, f);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/** Animated water plane: vertex wobble, fresnel tint toward the sky, fog to the horizon. */
export class Water {
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;

  constructor(size = 240, segments = 120) {
    this.mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new Color(0x1b6f9a) },
        uShallow: { value: new Color(0x39b3c9) },
        uSky: { value: new Color(0xcfeaf7) },
        uFog: { value: new Color(0xbfe3f5) },
      },
    });
    this.mesh = new Mesh(new PlaneGeometry(size, size, segments, segments), this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = -0.4;
  }

  update(time: number): void {
    this.mat.uniforms.uTime!.value = time;
  }
}
