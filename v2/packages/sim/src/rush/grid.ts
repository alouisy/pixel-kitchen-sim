import { clamp, fsqrt } from '@ga/shared';

export interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Push a circle (x, z, r) out of an axis-aligned box. Returns the corrected position through `out`. */
export function pushOutOfBox(x: number, z: number, r: number, b: Box, out: { x: number; z: number }): void {
  const cx = clamp(x, b.x0, b.x1);
  const cz = clamp(z, b.z0, b.z1);
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) {
    out.x = x;
    out.z = z;
    return;
  }
  if (d2 > 1e-12) {
    const d = fsqrt(d2);
    out.x = cx + (dx / d) * r;
    out.z = cz + (dz / d) * r;
    return;
  }
  // Centre inside the box: leave by the nearest side.
  const l = x - b.x0;
  const rr = b.x1 - x;
  const t = z - b.z0;
  const bt = b.z1 - z;
  const m = Math.min(l, rr, t, bt);
  out.x = x;
  out.z = z;
  if (m === l) out.x = b.x0 - r;
  else if (m === rr) out.x = b.x1 + r;
  else if (m === t) out.z = b.z0 - r;
  else out.z = b.z1 + r;
}

/** Distance from point to box (0 inside). */
export function distToBox(x: number, z: number, b: Box): number {
  const dx = x - clamp(x, b.x0, b.x1);
  const dz = z - clamp(z, b.z0, b.z1);
  return fsqrt(dx * dx + dz * dz);
}

/**
 * Walk grid (cell = 0.5 m). A cell is walkable when a chef standing at its centre clears every obstacle.
 * Pathing is a deterministic Dijkstra over 8 neighbours with integer costs (ties broken by the lower cell index).
 */
export class WalkGrid {
  readonly cols: number;
  readonly rows: number;
  readonly blocked: Uint8Array;

  constructor(
    private readonly bounds: Box,
    readonly cell: number,
    obstacles: ReadonlyArray<Box>,
    clearance: number,
  ) {
    this.cols = Math.round((bounds.x1 - bounds.x0) / cell);
    this.rows = Math.round((bounds.z1 - bounds.z0) / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const x = this.cx(c);
        const z = this.cz(r);
        let bad = x - clearance < bounds.x0 || x + clearance > bounds.x1 || z - clearance < bounds.z0 || z + clearance > bounds.z1;
        for (const o of obstacles) if (!bad && distToBox(x, z, o) < clearance) bad = true;
        this.blocked[r * this.cols + c] = bad ? 1 : 0;
      }
  }

  cx(c: number): number {
    return this.bounds.x0 + (c + 0.5) * this.cell;
  }
  cz(r: number): number {
    return this.bounds.z0 + (r + 0.5) * this.cell;
  }

  cellOf(x: number, z: number): number {
    const c = clamp(Math.floor((x - this.bounds.x0) / this.cell), 0, this.cols - 1);
    const r = clamp(Math.floor((z - this.bounds.z0) / this.cell), 0, this.rows - 1);
    return r * this.cols + c;
  }

  /** Nearest walkable cell to (x, z) (the cell itself when free). -1 when the grid has none. */
  nearestFree(x: number, z: number): number {
    const start = this.cellOf(x, z);
    if (!this.blocked[start]) return start;
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < this.blocked.length; i++) {
      if (this.blocked[i]) continue;
      const dx = this.cx(i % this.cols) - x;
      const dz = this.cz(Math.floor(i / this.cols)) - z;
      const d = dx * dx + dz * dz;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  /** Cheapest path (cell indices, start excluded) from `start` to any cell flagged in `goal`. Empty when unreachable or already there. */
  path(start: number, goal: Uint8Array): number[] {
    const n = this.blocked.length;
    const dist = new Int32Array(n).fill(0x3fffffff);
    const prev = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    dist[start] = 0;
    let target = -1;
    for (;;) {
      let u = -1;
      let best = 0x3fffffff;
      for (let i = 0; i < n; i++) {
        if (!done[i] && dist[i]! < best) {
          best = dist[i]!;
          u = i;
        }
      }
      if (u < 0) break;
      done[u] = 1;
      if (goal[u]) {
        target = u;
        break;
      }
      const uc = u % this.cols;
      const ur = Math.floor(u / this.cols);
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const c = uc + dc;
          const r = ur + dr;
          if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
          const v = r * this.cols + c;
          if (this.blocked[v] || done[v]) continue;
          if (dr !== 0 && dc !== 0 && (this.blocked[ur * this.cols + c] || this.blocked[r * this.cols + uc])) continue; // no corner cutting
          const nd = dist[u]! + (dr !== 0 && dc !== 0 ? 14 : 10);
          if (nd < dist[v]!) {
            dist[v] = nd;
            prev[v] = u;
          }
        }
    }
    if (target < 0 || target === start) return [];
    const out: number[] = [];
    for (let v = target; v !== start && v >= 0; v = prev[v]!) out.push(v);
    return out.reverse();
  }
}
