/** Input volume for the mesher. Field names match the sim's food volume so objects pass straight through. */
export interface MeshInput {
  /** Each 1..64 (food bodies <= 24, terrain chunks 32). */
  dims: [number, number, number];
  /** idx = x + dx*(y + dy*z); 0 = empty. */
  material: Uint8Array;
  /** 0..255 per cell, null = all 0. */
  doneness?: Uint8Array | null;
  /** 0..255 per cell, null = all 0. */
  char?: Uint8Array | null;
}

export interface MeshData {
  /** xyz per vertex, in VOXEL units (scale the object by voxelSize). */
  positions: Float32Array;
  /** xyz per vertex (-1/0/1). */
  normals: Int8Array;
  /** 4 per vertex: [materialIndex, ao 0..3 (3 = lit), doneness, char] (doneness/char are band centers). */
  attrs: Uint8Array;
  indices: Uint32Array;
  quadCount: number;
}
