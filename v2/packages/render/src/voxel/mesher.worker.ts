import { meshVolume } from './greedyMesher.js';
import type { MeshData, MeshInput } from './types.js';

export interface MesherRequest {
  jobId: number;
  key: number;
  input: MeshInput;
}
export interface MesherResponse {
  jobId: number;
  key: number;
  data: MeshData;
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<MesherRequest>) => void) | null;
  postMessage(msg: MesherResponse, transfer: Transferable[]): void;
};

ctx.onmessage = (e) => {
  const { jobId, key, input } = e.data;
  const data = meshVolume(input);
  ctx.postMessage({ jobId, key, data }, [
    data.positions.buffer,
    data.normals.buffer,
    data.attrs.buffer,
    data.indices.buffer,
  ]);
};
