import { describe, expect, it } from 'vitest';
import { Prng } from '@ga/shared';
import { meshVolume } from './greedyMesher.js';
import { MesherPool } from './mesherPool.js';
import type { MesherRequest } from './mesher.worker.js';
import type { MeshInput } from './types.js';

function vol(dims: [number, number, number], fill: (x: number, y: number, z: number) => number): MeshInput {
  const [dx, dy, dz] = dims;
  const material = new Uint8Array(dx * dy * dz);
  for (let z = 0; z < dz; z++)
    for (let y = 0; y < dy; y++) for (let x = 0; x < dx; x++) material[x + dx * (y + dy * z)] = fill(x, y, z);
  return { dims, material };
}

describe('greedy mesher', () => {
  it('single voxel: 6 quads, 24 verts, 36 indices, AO 3', () => {
    const m = meshVolume(vol([1, 1, 1], () => 1));
    expect(m.quadCount).toBe(6);
    expect(m.positions.length / 3).toBe(24);
    expect(m.indices.length).toBe(36);
    for (let i = 0; i < 24; i++) expect(m.attrs[i * 4 + 1]).toBe(3);
  });

  it('solid 10^3 -> 6 quads', () => {
    expect(meshVolume(vol([10, 10, 10], () => 1)).quadCount).toBe(6);
  });

  it('2x1x1 with two materials -> 10 quads', () => {
    expect(meshVolume(vol([2, 1, 1], (x) => x + 1)).quadCount).toBe(10);
  });

  it('doneness bands split merging', () => {
    const input = vol([4, 1, 1], () => 1);
    input.doneness = new Uint8Array([0, 0, 200, 200]);
    const m = meshVolume(input);
    let top = 0;
    for (let q = 0; q < m.positions.length / 12; q++) if (m.normals[q * 12 + 1] === 1) top++;
    expect(top).toBe(2);
    // band center: 200>>4 = 12 -> 200; 0 -> 8
    const ds = new Set<number>();
    for (let i = 0; i < m.attrs.length / 4; i++) ds.add(m.attrs[i * 4 + 2]!);
    expect([...ds].sort((a, b) => a - b)).toEqual([8, 200]);
  });

  it('AO at the inner corner of an L on a floor slab', () => {
    // 4x1x4 slab at y=0, L at y=1: (1,1,1), (2,1,1), (1,1,2).
    const L = new Set(['1,1,1', '2,1,1', '1,1,2']);
    const m = meshVolume(vol([4, 2, 4], (x, y, z) => (y === 0 || L.has(`${x},${y},${z}`) ? 1 : 0)));
    // Slab cell (2,0,2) is the only uncovered top face touching the point (2,1,2). In its front layer (y=1) the
    // neighbors at -x ((1,1,2)) and -z ((2,1,1)) are both solid, so the corner AO is 0 (fully occluded).
    const aos: number[] = [];
    for (let i = 0; i < m.positions.length / 3; i++) {
      if (m.normals[i * 3 + 1] === 1 && m.positions[i * 3] === 2 && m.positions[i * 3 + 1] === 1 && m.positions[i * 3 + 2] === 2)
        aos.push(m.attrs[i * 4 + 1]!);
    }
    expect(aos).toEqual([0]);
  });

  it('winding matches stored normal', () => {
    const rng = new Prng(7);
    const input = vol([8, 8, 8], () => (rng.nextFloat() < 0.5 ? 1 : 0));
    const m = meshVolume(input);
    expect(m.indices.length).toBeGreaterThan(0);
    const P = m.positions;
    for (let t = 0; t < m.indices.length; t += 3) {
      const a = m.indices[t]! * 3, b = m.indices[t + 1]! * 3, c = m.indices[t + 2]! * 3;
      const e1 = [P[b]! - P[a]!, P[b + 1]! - P[a + 1]!, P[b + 2]! - P[a + 2]!];
      const e2 = [P[c]! - P[a]!, P[c + 1]! - P[a + 1]!, P[c + 2]! - P[a + 2]!];
      const cr = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
      const dot = cr[0]! * m.normals[a]! + cr[1]! * m.normals[a + 1]! + cr[2]! * m.normals[a + 2]!;
      expect(dot).toBeGreaterThan(0);
    }
  });

  it('perf', () => {
    const rng = new Prng(1);
    const rand = vol([16, 16, 16], () => (rng.nextFloat() < 0.5 ? 1 : 0));
    const solid = vol([24, 24, 24], () => 1);
    meshVolume(rand);
    meshVolume(solid);
    const N = 50;
    let t0 = performance.now();
    for (let i = 0; i < N; i++) meshVolume(rand);
    const tRand = (performance.now() - t0) / N;
    t0 = performance.now();
    for (let i = 0; i < N; i++) meshVolume(solid);
    const tSolid = (performance.now() - t0) / N;
    console.info(`perf: 16^3 50% random ${tRand.toFixed(3)} ms, 24^3 solid ${tSolid.toFixed(3)} ms`);
    expect(tRand).toBeGreaterThan(0);
  });
});

class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  static posted = 0;
  postMessage(msg: MesherRequest): void {
    FakeWorker.posted++;
    queueMicrotask(() => {
      const data = meshVolume(msg.input);
      this.onmessage?.({ data: { jobId: msg.jobId, key: msg.key, data } } as MessageEvent);
    });
  }
  terminate(): void {}
}

describe('MesherPool', () => {
  it('coalesces queued requests for the same key', async () => {
    FakeWorker.posted = 0;
    const pool = new MesherPool(() => new FakeWorker() as unknown as Worker, 1);
    const blocker = pool.request(100, vol([1, 1, 1], () => 1)); // occupies the single worker
    const first = pool.request(1, vol([1, 1, 1], () => 1)); // queued
    const second = pool.request(1, vol([2, 1, 1], () => 1)); // supersedes
    expect(await first).toBeNull();
    expect((await blocker)?.quadCount).toBe(6);
    const d = await second;
    expect(d?.quadCount).toBe(6);
    expect(d!.positions.length / 3).toBe(24);
    expect(FakeWorker.posted).toBe(2);
    expect(pool.meshSync(vol([1, 1, 1], () => 1)).quadCount).toBe(6);
    pool.dispose();
  });
});
