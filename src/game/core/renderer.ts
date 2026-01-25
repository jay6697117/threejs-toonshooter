import * as THREE from 'three';

export type RendererOptions = {
  maxDpr?: number;
  shadows?: boolean;
};

export function createRenderer(canvas: HTMLCanvasElement, options?: RendererOptions): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  const maxDpr = options?.maxDpr ?? 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = options?.shadows ?? true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}
