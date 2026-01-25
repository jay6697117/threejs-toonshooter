import * as THREE from 'three';
import { computeAabbFromBox3, type Aabb2 } from '../combat/collision';

export type CoverId = string;

export type CoverExplosion = {
  radiusMeters: number;
  damage: number;
  statusEffects?: Array<{ id: 'slow' | 'burn' | 'blind'; durationSeconds?: number }>;
  knockbackDistance?: number;
};

export type Cover = {
  id: CoverId;
  mesh: THREE.Object3D;
  box: THREE.Box3;
  aabb: Aabb2;
  active: boolean;
  timeLeftSeconds?: number;
  destructible: boolean;
  hp: number;
  maxHp: number;
  burnable?: boolean;
  burnTimeLeftSeconds?: number;
  burnSeconds?: number;
  burnRadiusMeters?: number;
  burnDamagePerSecond?: number;
  onDestroyedExplosion?: CoverExplosion;
};

export function createBoxCover(options: {
  id: string;
  size: THREE.Vector3;
  pos: THREE.Vector3;
  color?: number;
  hp?: number;
}): Cover {
  const geo = new THREE.BoxGeometry(options.size.x, options.size.y, options.size.z);
  const mat = new THREE.MeshStandardMaterial({ color: options.color ?? 0x6f7a86, roughness: 0.9, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(options.pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const box3 = new THREE.Box3().setFromObject(mesh);
  const aabb = computeAabbFromBox3(box3);

  const hp = options.hp ?? 40;
  return {
    id: options.id,
    mesh,
    box: box3,
    aabb,
    active: true,
    destructible: true,
    hp,
    maxHp: hp,
    burnable: false,
    burnTimeLeftSeconds: 0
  };
}

export function updateCoverAabb(cover: Cover): void {
  cover.box = new THREE.Box3().setFromObject(cover.mesh);
  cover.aabb = computeAabbFromBox3(cover.box);
}
