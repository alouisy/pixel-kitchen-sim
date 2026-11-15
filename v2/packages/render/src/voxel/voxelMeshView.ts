import { BufferAttribute, BufferGeometry, Mesh, type Material, type Scene } from 'three';
import type { MeshData } from './types.js';

export function toBufferGeometry(data: MeshData): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(data.positions, 3));
  g.setAttribute('normal', new BufferAttribute(data.normals, 3, false));
  g.setAttribute('aAttr', new BufferAttribute(data.attrs, 4, false));
  const vertexCount = data.positions.length / 3;
  g.setIndex(new BufferAttribute(vertexCount < 65536 ? new Uint16Array(data.indices) : data.indices, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/** One THREE.Mesh per id, all sharing one material. */
export class VoxelMeshView {
  private readonly meshes = new Map<number, Mesh>();

  constructor(
    private readonly scene: Scene,
    private readonly material: Material,
    private readonly voxelSize: number,
  ) {}

  upsert(id: number, data: MeshData, originVoxels: [number, number, number]): void {
    let mesh = this.meshes.get(id);
    if (!mesh) {
      mesh = new Mesh(undefined, this.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.meshes.set(id, mesh);
    } else {
      mesh.geometry.dispose();
    }
    mesh.geometry = toBufferGeometry(data);
    mesh.scale.setScalar(this.voxelSize);
    mesh.position.set(originVoxels[0] * this.voxelSize, originVoxels[1] * this.voxelSize, originVoxels[2] * this.voxelSize);
  }

  remove(id: number): void {
    const mesh = this.meshes.get(id);
    if (!mesh) return;
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    this.meshes.delete(id);
  }

  dispose(): void {
    for (const id of [...this.meshes.keys()]) this.remove(id);
  }
}
