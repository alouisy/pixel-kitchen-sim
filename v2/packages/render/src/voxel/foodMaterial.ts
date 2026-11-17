import {
  DataTexture,
  MeshStandardMaterial,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';

/** Structural subset of `@ga/content` Material (kept structural so render needs no content dependency). */
export interface RampMaterial {
  index: number;
  colors: { raw: string; cooked: string; charred: string };
}

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 256x3 RGBA8 ramp: row 0 raw, row 1 cooked, row 2 charred; x = material index. Unknown indices are magenta. */
export function createRampTexture(materials: readonly RampMaterial[]): DataTexture {
  const data = new Uint8Array(256 * 3 * 4);
  for (let row = 0; row < 3; row++) {
    for (let x = 1; x < 256; x++) {
      const o = (row * 256 + x) * 4;
      data[o] = 255;
      data[o + 1] = 0;
      data[o + 2] = 255;
      data[o + 3] = 255;
    }
  }
  const keys = ['raw', 'cooked', 'charred'] as const;
  for (const m of materials) {
    if (m.index < 1 || m.index > 255) continue;
    for (let row = 0; row < 3; row++) {
      const [r, g, b] = parseHex(m.colors[keys[row]!]);
      const o = (row * 256 + m.index) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
  const tex = new DataTexture(data, 256, 3, RGBAFormat, UnsignedByteType);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const VERT_DECL = /* glsl */ `
attribute vec4 aAttr;
flat varying float vMat;
varying float vAo;
varying float vDone;
varying float vChar;
varying vec3 vVoxPos;
flat varying vec3 vVoxNrm;
`;

const VERT_BODY = /* glsl */ `
vMat = aAttr.x;
vAo = aAttr.y;
vDone = aAttr.z / 255.0;
vChar = aAttr.w / 255.0;
vVoxPos = position;
vVoxNrm = normal;
`;

const FRAG_DECL = /* glsl */ `
uniform sampler2D uRamp;
flat varying float vMat;
varying float vAo;
varying float vDone;
varying float vChar;
varying vec3 vVoxPos;
flat varying vec3 vVoxNrm;
float gaHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
`;

const FRAG_BODY = /* glsl */ `
{
  float rx = (vMat + 0.5) / 256.0;
  vec3 rawC = texture(uRamp, vec2(rx, 0.5 / 3.0)).rgb;
  vec3 cookedC = texture(uRamp, vec2(rx, 1.5 / 3.0)).rgb;
  vec3 charC = texture(uRamp, vec2(rx, 2.5 / 3.0)).rgb;
  vec3 col = mix(mix(rawC, cookedC, smoothstep(0.15, 0.85, vDone)), charC, smoothstep(0.1, 0.9, vChar));
  // Cell hash evaluated per fragment: merged quads span many cells, so a per-vertex hash cannot work.
  vec3 cell = floor(vVoxPos - vVoxNrm * 0.5);
  col *= 1.0 + (gaHash(cell) - 0.5) * 0.08;
  // Piecewise-linear through [0.5, 0.65, 0.8, 1.0] at ao = 0..3.
  float aoF = vAo < 2.0 ? mix(mix(0.5, 0.65, vAo), 0.8, max(vAo - 1.0, 0.0)) : mix(0.8, 1.0, vAo - 2.0);
  diffuseColor.rgb = col * aoF;
}
`;

/** One shared material for all voxel geometry. Patches chunks: common, begin_vertex (vertex); common, color_fragment (fragment). */
export function createVoxelMaterial(ramp: DataTexture): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ roughness: 0.85, metalness: 0, flatShading: false, vertexColors: false });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRamp = { value: ramp };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_DECL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_BODY}`);
  };
  mat.customProgramCacheKey = () => 'ga-voxel-food-v1';
  return mat;
}
