// Minimal MagicaVoxel .vox reader (single model). Returns { size, voxels:[{x,y,z,i}], palette }.
// palette[k] is the {r,g,b,a} of color index k+1 (index 0 is unused in .vox).
import { readFileSync } from 'node:fs';

export function parseVox(buf) {
  if (buf.toString('latin1', 0, 4) !== 'VOX ') throw new Error('bad magic');
  const version = buf.readInt32LE(4);
  if (buf.toString('latin1', 8, 12) !== 'MAIN') throw new Error('missing MAIN');
  let size = null, voxels = [], palette = null;
  const walk = (start, end) => {
    let p = start;
    while (p < end) {
      const id = buf.toString('latin1', p, p + 4);
      const n = buf.readInt32LE(p + 4);
      const m = buf.readInt32LE(p + 8);
      const c = p + 12;
      if (id === 'MAIN') walk(c + n, c + n + m);
      else if (id === 'SIZE') size = [buf.readInt32LE(c), buf.readInt32LE(c + 4), buf.readInt32LE(c + 8)];
      else if (id === 'XYZI') {
        const count = buf.readInt32LE(c);
        for (let k = 0; k < count; k++) {
          const o = c + 4 + k * 4;
          voxels.push({ x: buf[o], y: buf[o + 1], z: buf[o + 2], i: buf[o + 3] });
        }
      } else if (id === 'RGBA') {
        palette = [];
        for (let k = 0; k < 256; k++) palette.push({ r: buf[c + k * 4], g: buf[c + k * 4 + 1], b: buf[c + k * 4 + 2], a: buf[c + k * 4 + 3] });
      }
      p = c + n + m;
    }
  };
  walk(8, buf.length);
  return { version, size, voxels, palette };
}

export function readVox(file) { return parseVox(readFileSync(file)); }
