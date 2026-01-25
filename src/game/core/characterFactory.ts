import * as THREE from 'three';

export interface CharacterMeshOptions {
  color: number;
  radius?: number; // default 0.35
  height?: number; // default 1.35 (total height)
  castShadow?: boolean;
}

/**
 * Creates a more detailed character mesh group containing:
 * - Body (Capsule)
 * - Eyes (Glow/Reflection)
 * - Backpack/Jetpack (Box)
 */
export function createCharacterMesh(options: CharacterMeshOptions): THREE.Group {
  const group = new THREE.Group();

  const radius = options.radius ?? 0.35;
  const height = options.height ?? 0.9; // Capsule cylinder height
  const color = options.color;

  // 1. Body
  // CapsuleGeometry(radius, length, capSegments, radialSegments)
  const bodyGeo = new THREE.CapsuleGeometry(radius, height, 4, 16);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.3, // Shinier
    metalness: 0.1,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  // Body center is at (0,0,0). Capsule total height = height + 2*radius.
  // We want the pivot at the bottom center or center?
  // Existing logic likely expects center at position.
  // Let's keep pivot at center of capsule for now.
  group.add(body);

  // 2. Head band / Visor area (simulated with geometry or material?)
  // Let's add simple Eyes.
  // Direction: +Z is forward in many Three.js configs, but let's check player.ts.
  // player.ts: dashDir: new THREE.Vector3(0, 0, 1) -> +Z seems to be forward default or initial?
  // Actually, usually characters face +Z or -Z. logic often rotates them.
  // Let's assume +Z is "front" for now based on `dir.z -= 1` for moveForward in player.ts usually means -Z is forward.
  // Wait, player.ts: if (input.isDown('moveForward')) dir.z -= 1;
  // This implies -Z is "Forward" in world space.
  // So we should put eyes on -Z side.

  const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.5,
    roughness: 0.1
  });

  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);

  // Position eyes
  // Body radius is 0.35.
  // Y: somewhat up. Total height approx 0.9 (cyl) + 0.35*2 (caps) = 1.6?
  // Wait, assets.ts createPlaceholderMesh used height 0.9 for capsule cylinder?
  // CapsGeo params: radius, length. Total h = length + 2r.
  // 0.9 + 0.7 = 1.6m tall.
  // Eyes should be around Y=0.3-0.4? (Center is 0).
  const eyeY = 0.4;
  const eyeZ = -radius * 0.85; // Slightly protruding or embedded
  const eyeX = 0.12;

  leftEye.position.set(-eyeX, eyeY, eyeZ);
  rightEye.position.set(eyeX, eyeY, eyeZ);

  group.add(leftEye);
  group.add(rightEye);

  // 3. Backpack / Jetpack
  const packGeo = new THREE.BoxGeometry(0.4, 0.5, 0.2);
  const packMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.7
  });
  const backpack = new THREE.Mesh(packGeo, packMat);
  // Put on back (+Z)
  backpack.position.set(0, 0.1, radius * 0.8);
  backpack.castShadow = true;
  backpack.receiveShadow = true;
  group.add(backpack);

  // 4. Antenna / Detail on top (optional, makes it look like a robot/alien)
  const antPoleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3);
  const antPoleMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
  const antenna = new THREE.Mesh(antPoleGeo, antPoleMat);
  antenna.position.set(0, 0.9 / 2 + radius + 0.15, 0); // Top of capsule
  // group.add(antenna); // Optional, maybe too noisy

  if (options.castShadow) {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  }

  return group;
}
