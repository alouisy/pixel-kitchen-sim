/**
 * SoA components for bitECS 0.4: plain objects of typed arrays indexed by entity id.
 * Created per world (never module-global) so several SimWorlds can coexist in one
 * process, e.g. in tests or a headless verifier.
 * Capacity is fixed in P0 (chefs only); raise MAX_ENTITIES when more entity kinds land.
 */
export const MAX_ENTITIES = 256;

export function createComponents() {
  return {
    Transform: {
      x: new Float32Array(MAX_ENTITIES),
      y: new Float32Array(MAX_ENTITIES),
      z: new Float32Array(MAX_ENTITIES),
      yaw: new Float32Array(MAX_ENTITIES),
    },
    Velocity: {
      x: new Float32Array(MAX_ENTITIES),
      y: new Float32Array(MAX_ENTITIES),
      z: new Float32Array(MAX_ENTITIES),
    },
    Chef: {
      slot: new Uint8Array(MAX_ENTITIES),
    },
  };
}

export type Components = ReturnType<typeof createComponents>;
