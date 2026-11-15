import { Vector3, type Camera } from 'three';
import type { CookGauge } from '@ga/sim';
import { T, ingIcon } from './strings.js';

const FV = 1 / 16;

interface Anchor {
  el: HTMLDivElement;
  pos: Vector3;
}

/** Screen-space labels pinned to world points (station names) and cooking gauges over food on the hot stone. */
export class WorldLabels {
  private readonly layer = document.createElement('div');
  private readonly anchors: Anchor[] = [];
  private readonly gauges = new Map<number, { el: HTMLDivElement; fill: HTMLDivElement; text: HTMLSpanElement; pos: Vector3 }>();
  private readonly v = new Vector3();

  constructor() {
    this.layer.className = 'world-labels';
    document.body.appendChild(this.layer);
  }

  /** x/y/z in food voxels. */
  add(text: string, x: number, y: number, z: number, cls = ''): void {
    const el = document.createElement('div');
    el.className = `world-label ${cls}`;
    el.textContent = text;
    this.layer.appendChild(el);
    this.anchors.push({ el, pos: new Vector3(x * FV, y * FV, z * FV) });
  }

  setGauges(list: readonly CookGauge[]): void {
    const seen = new Set<number>();
    for (const g of list) {
      seen.add(g.id);
      let rec = this.gauges.get(g.id);
      if (!rec) {
        const el = document.createElement('div');
        el.className = 'gauge';
        const bar = document.createElement('div');
        bar.className = 'gauge-bar';
        const zone = document.createElement('div');
        zone.className = 'gauge-zone';
        const fill = document.createElement('div');
        fill.className = 'gauge-fill';
        bar.append(zone, fill);
        const text = document.createElement('span');
        text.className = 'gauge-text';
        el.append(bar, text);
        this.layer.appendChild(el);
        rec = { el, fill, text, pos: new Vector3() };
        this.gauges.set(g.id, rec);
        const z = zone;
        // Green zone = between "cooked" and "burnt"; the bar shows progress toward burnt on the same 0..1 scale.
        z.style.left = `${Math.round(g.cookedAt * 100)}%`;
        z.style.width = `${Math.round((1 - g.cookedAt) * 0.75 * 100)}%`;
      }
      rec.pos.set(g.pos[0] * FV, g.pos[1] * FV + 0.12, g.pos[2] * FV);
      // Progress: doneness up to "cooked", then char toward "burnt".
      const cooked = g.done >= g.cookedAt;
      const burnt = g.char >= g.burntAt;
      const p = cooked ? g.cookedAt + (1 - g.cookedAt) * Math.min(1, g.char / g.burntAt) : (g.done / g.cookedAt) * g.cookedAt;
      rec.fill.style.width = `${Math.round(Math.min(1, p) * 100)}%`;
      rec.fill.style.background = burnt ? '#2b1d18' : cooked ? (g.char / g.burntAt > 0.75 ? '#f4a259' : '#6fd36f') : '#e8c07a';
      rec.text.textContent = `${ingIcon(g.material)} ${burnt ? T.gauge.burnt : cooked ? T.gauge.ok : T.gauge.raw}`;
      rec.el.classList.toggle('ok', cooked && !burnt);
      rec.el.classList.toggle('burnt', burnt);
    }
    for (const [id, rec] of this.gauges)
      if (!seen.has(id)) {
        rec.el.remove();
        this.gauges.delete(id);
      }
  }

  update(camera: Camera, w: number, h: number): void {
    camera.updateMatrixWorld();
    const place = (el: HTMLElement, pos: Vector3): void => {
      this.v.copy(pos).project(camera);
      const visible = this.v.z < 1 && this.v.x > -1.2 && this.v.x < 1.2 && this.v.y > -1.2 && this.v.y < 1.2;
      el.style.display = visible ? '' : 'none';
      el.style.transform = `translate(-50%, -100%) translate(${((this.v.x + 1) / 2) * w}px, ${((1 - this.v.y) / 2) * h}px)`;
    };
    for (const a of this.anchors) place(a.el, a.pos);
    for (const g of this.gauges.values()) place(g.el, g.pos);
  }
}
