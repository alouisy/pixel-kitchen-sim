import { parseVox, type VoxModel } from '@ga/render';

/** Paint a .vox model as a small oblique-projection icon (used for ticket pictures). */
export function voxIcon(model: VoxModel, px: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d')!;
  const [sx, sy, sz] = model.size; // file axes: z is up
  const unit = Math.floor((px * 0.9) / (sx + sy * 0.5 + sz * 0.9)) || 1;
  const ox = Math.round(px * 0.05 + sy * unit * 0.25);
  const oy = px - Math.round(px * 0.06);
  const shade = (hex: string, f: number): string => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    const gg = Math.min(255, Math.round(((n >> 8) & 255) * f));
    const b = Math.min(255, Math.round((n & 255) * f));
    return `rgb(${r},${gg},${b})`;
  };
  const sorted = [...model.voxels].sort((a, b) => a[2] - b[2] || b[1] - a[1] || a[0] - b[0]);
  for (const [x, y, z, ci] of sorted) {
    const hex = model.palette[ci - 1] ?? '#ff00ff';
    const X = ox + x * unit + y * unit * 0.5;
    const Y = oy - z * unit - y * unit * 0.5 - unit;
    g.fillStyle = shade(hex, 1);
    g.fillRect(X, Y, unit, unit);
    g.fillStyle = shade(hex, 1.18);
    g.fillRect(X, Y - Math.max(1, unit * 0.45), unit, Math.max(1, unit * 0.45));
    g.fillStyle = shade(hex, 0.78);
    g.fillRect(X + unit, Y - Math.max(1, unit * 0.2), Math.max(1, unit * 0.45), unit);
  }
  return c;
}

export { parseVox };
