import { CanvasTexture, Mesh, MeshStandardMaterial, NearestFilter, PlaneGeometry, RepeatWrapping, SRGBColorSpace } from 'three';

/** Temporary checker ground (default 40x40 m), replaced once voxel terrain exists. 2 m squares. */
export function createGround(size = 40): Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 2;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6b8f4e';
  g.fillRect(0, 0, 2, 2);
  g.fillStyle = '#5f8244';
  g.fillRect(0, 0, 1, 1);
  g.fillRect(1, 1, 1, 1);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.magFilter = NearestFilter;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(size / 2, size / 2);
  const mesh = new Mesh(new PlaneGeometry(size, size), new MeshStandardMaterial({ map: tex }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}
