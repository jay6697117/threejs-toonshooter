import * as THREE from 'three';

// Create a 3-tone gradient map for toon shading
function createGradientMap(): THREE.Texture {
  const colors = [
    new THREE.Color(0x444444), // Dark shadow
    new THREE.Color(0xaaaaaa), // Mid-tone
    new THREE.Color(0xffffff)  // Highlight
  ];

  const size = 128; // Higher resolution for smoother transitions if needed, but 3 colors implies stepped
  // Actually for toon, we want hard steps.
  // Let's manually create a tiny texture with 3 pixels or just use a small canvas

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  // Fill gradient
  // 0.0 - 0.5: Dark
  // 0.5 - 0.9: Mid
  // 0.9 - 1.0: Highlight

  const gradient = ctx.createLinearGradient(0, 0, size, 0);
  gradient.addColorStop(0.00, '#666666');
  gradient.addColorStop(0.50, '#666666');
  gradient.addColorStop(0.50, '#cccccc');
  gradient.addColorStop(0.90, '#cccccc');
  gradient.addColorStop(0.90, '#ffffff');
  gradient.addColorStop(1.00, '#ffffff');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.NoColorSpace; // Gradient maps are data
  return texture;
}

const sharedGradientMap = createGradientMap();

export type ToonMaterialOptions = {
  color: THREE.ColorRepresentation;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
};

export function createToonMaterial(options: ToonMaterialOptions): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color: options.color,
    gradientMap: sharedGradientMap,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1.0,
  });
}
