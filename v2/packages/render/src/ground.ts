import { CanvasTexture, Mesh, MeshStandardMaterial, NearestFilter, PlaneGeometry, RepeatWrapping, SRGBColorSpace } from 'three';

/** Temporary 40x40 m checker ground, replaced once voxel terrain exists. */
export function createGround(): Mesh {
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
  tex.repeat.set(20, 20); // 2 m squares
  const mesh = new Mesh(new PlaneGeometry(40, 40), new MeshStandardMaterial({ map: tex }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}
