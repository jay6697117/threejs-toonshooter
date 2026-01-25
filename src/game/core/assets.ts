import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type AssetManifest = {
  assets: Record<string, Record<string, Record<string, string>>>;
  summary?: unknown;
};

export type LoadedGltf = {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
  hasSkinned: boolean;
};

export type ClonedGltf = {
  root: THREE.Object3D;
  animations: THREE.AnimationClip[];
};

function detectSkinned(root: THREE.Object3D): boolean {
  let hasSkinned = false;
  root.traverse((obj) => {
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) hasSkinned = true;
  });
  return hasSkinned;
}

export class Assets {
  private manifest: AssetManifest | null = null;
  private readonly loader = new GLTFLoader();

  private readonly gltfCache = new Map<string, Promise<LoadedGltf>>();

  async loadManifest(url = '/assets.json'): Promise<AssetManifest> {
    if (this.manifest) return this.manifest;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load manifest: ${url} (${res.status})`);
    const json = (await res.json()) as AssetManifest;
    this.manifest = json;
    return json;
  }

  getManifestPath(namespace: string, category: string, key: string): string | null {
    if (!this.manifest) return null;
    return this.manifest.assets?.[namespace]?.[category]?.[key] ?? null;
  }

  loadGltf(path: string): Promise<LoadedGltf> {
    const cached = this.gltfCache.get(path);
    if (cached) return cached;

    const promise = new Promise<LoadedGltf>((resolve, reject) => {
      this.loader.load(
        path,
        (gltf) => {
          resolve({
            scene: gltf.scene,
            animations: gltf.animations ?? [],
            hasSkinned: detectSkinned(gltf.scene)
          });
        },
        undefined,
        (err) => reject(err)
      );
    });

    this.gltfCache.set(path, promise);
    return promise;
  }

  async cloneGltf(path: string): Promise<ClonedGltf> {
    const loaded = await this.loadGltf(path);
    const root = loaded.hasSkinned || loaded.animations.length > 0 ? cloneSkinned(loaded.scene) : loaded.scene.clone(true);
    return { root, animations: loaded.animations };
  }

  createPlaceholderMesh(options?: { color?: number; radius?: number; height?: number }): THREE.Mesh {
    const radius = options?.radius ?? 0.35;
    const height = options?.height ?? 0.9;
    const geo = new THREE.CapsuleGeometry(radius, height, 6, 12);
    const mat = new THREE.MeshStandardMaterial({ color: options?.color ?? 0x8cff75, roughness: 0.7, metalness: 0.05 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }
}

