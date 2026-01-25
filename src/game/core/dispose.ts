import * as THREE from 'three';

export function disposeObject3D(
  root: THREE.Object3D,
  options?: { geometries?: boolean; materials?: boolean }
): void {
  const disposeGeometries = options?.geometries ?? true;
  const disposeMaterials = options?.materials ?? true;

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;

    if (disposeGeometries) {
      const geometry = (mesh as unknown as { geometry?: THREE.BufferGeometry }).geometry;
      geometry?.dispose?.();
    }

    if (disposeMaterials) {
      const material = (mesh as unknown as { material?: THREE.Material | THREE.Material[] }).material;
      if (Array.isArray(material)) {
        for (const m of material) m.dispose?.();
      } else {
        material?.dispose?.();
      }
    }
  });
}

