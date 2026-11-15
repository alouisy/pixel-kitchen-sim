/**
 * Deterministic math. Only + - * / and Math.floor/Math.sqrt are used, which are
 * exactly specified by IEEE-754 and therefore identical in every JS engine.
 *
 * Q8 CONVENTION: heat, doneness and other cooking quantities are stored as
 * integers in Q8 fixed point (value * 256). Use toFx / fxMul for them.
 */

export const fsqrt = Math.sqrt;

const PI = 3.141592653589793;
const TWO_PI = 6.283185307179586;
const HALF_PI = 1.5707963267948966;

/** Reduce x to [-PI, PI] using only basic ops. */
function reduce(x: number): number {
  return x - TWO_PI * Math.floor((x + PI) / TWO_PI);
}

/** Odd polynomial for sin on [-PI/2, PI/2] (degree 11 Taylor). */
function sinCore(x: number): number {
  const x2 = x * x;
  // x - x^3/6 + x^5/120 - x^7/5040 + x^9/362880 - x^11/39916800
  return (
    x *
    (1 +
      x2 *
        (-1 / 6 +
          x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880 + x2 * (-1 / 39916800))))))
  );
}

/** Deterministic sine. Max abs error < 1e-6. */
export function fsin(x: number): number {
  let r = reduce(x);
  // Fold into [-PI/2, PI/2] using sin(PI - r) = sin(r).
  if (r > HALF_PI) r = PI - r;
  else if (r < -HALF_PI) r = -PI - r;
  return sinCore(r);
}

/** Deterministic cosine. */
export function fcos(x: number): number {
  return fsin(x + HALF_PI);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Float to Q8 fixed point (integer). */
export function toFx(x: number): number {
  return Math.round(x * 256) | 0;
}

/** Q8 * Q8 -> Q8. */
export function fxMul(a: number, b: number): number {
  return (a * b) >> 8;
}
