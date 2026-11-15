import { meshVolume } from './greedyMesher.js';
import type { MesherRequest, MesherResponse } from './mesher.worker.js';
import type { MeshData, MeshInput } from './types.js';

interface Queued {
  input: MeshInput;
  resolve: (d: MeshData | null) => void;
  reject: (e: unknown) => void;
}
interface InFlight {
  key: number;
  resolve: (d: MeshData | null) => void;
  reject: (e: unknown) => void;
}

function defaultSize(): number {
  const hc = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return Math.min(4, Math.max(1, hc - 1));
}

/**
 * Worker pool for meshing. Input arrays are TRANSFERRED to the worker (detached on the caller's side).
 * Requests for a key still queued are coalesced: the older promise resolves null. A result whose key has since
 * been dispatched again also resolves null (stale).
 */
export class MesherPool {
  private readonly workers: Worker[] = [];
  private readonly busy: (InFlight | null)[] = [];
  private readonly queue = new Map<number, Queued>();
  private readonly latestJob = new Map<number, number>();
  private nextJob = 1;
  private rr = 0;

  constructor(workerFactory: () => Worker, size: number = defaultSize()) {
    for (let i = 0; i < size; i++) {
      const w = workerFactory();
      const slot = i;
      w.onmessage = (e: MessageEvent<MesherResponse>) => this.onResult(slot, e.data);
      w.onerror = (e) => this.onError(slot, e);
      this.workers.push(w);
      this.busy.push(null);
    }
  }

  request(key: number, input: MeshInput): Promise<MeshData | null> {
    return new Promise((resolve, reject) => {
      const prev = this.queue.get(key);
      if (prev) prev.resolve(null);
      this.queue.delete(key); // re-insert so ordering reflects latest request
      this.queue.set(key, { input, resolve, reject });
      this.pump();
    });
  }

  /** Main-thread fallback (tests, no Worker support). */
  meshSync(input: MeshInput): MeshData {
    return meshVolume(input);
  }

  dispose(): void {
    for (const w of this.workers) w.terminate();
    this.workers.length = 0;
    for (const q of this.queue.values()) q.resolve(null);
    this.queue.clear();
    for (let i = 0; i < this.busy.length; i++) {
      this.busy[i]?.resolve(null);
      this.busy[i] = null;
    }
  }

  private pump(): void {
    const n = this.workers.length;
    for (let t = 0; t < n && this.queue.size > 0; t++) {
      const slot = (this.rr + t) % n;
      if (this.busy[slot]) continue;
      const first = this.queue.entries().next().value as [number, Queued];
      const [key, q] = first;
      this.queue.delete(key);
      const jobId = this.nextJob++;
      this.latestJob.set(key, jobId);
      this.busy[slot] = { key, resolve: q.resolve, reject: q.reject };
      this.rr = (slot + 1) % n;
      const input = q.input;
      const buffers = new Set<ArrayBufferLike>([input.material.buffer]);
      if (input.doneness) buffers.add(input.doneness.buffer);
      if (input.char) buffers.add(input.char.buffer);
      const msg: MesherRequest = { jobId, key, input };
      this.workers[slot]!.postMessage(msg, [...buffers] as Transferable[]);
    }
  }

  private onResult(slot: number, res: MesherResponse): void {
    const f = this.busy[slot];
    this.busy[slot] = null;
    if (f) f.resolve(this.latestJob.get(res.key) === res.jobId ? res.data : null);
    this.pump();
  }

  private onError(slot: number, e: unknown): void {
    const f = this.busy[slot];
    this.busy[slot] = null;
    f?.reject(e);
    this.pump();
  }
}
