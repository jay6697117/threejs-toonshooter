import * as THREE from 'three';
import type { Cover } from '../arena/cover';
import type { Entity, TeamId } from '../entities/entityBase';

export type RaycastHit =
  | { type: 'entity'; entity: Entity; point: THREE.Vector3; distance: number }
  | { type: 'cover'; cover: Cover; point: THREE.Vector3; distance: number };

export function raycast(options: {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  maxDistance: number;
  entities: Entity[];
  covers: Cover[];
  ignoreTeam?: TeamId;
}): RaycastHit | null {
  const dir = options.direction.clone().normalize();
  const ray = new THREE.Ray(options.origin.clone(), dir);

  let best: RaycastHit | null = null;

  for (const entity of options.entities) {
    if (entity.eliminated) continue;
    if (options.ignoreTeam && entity.team === options.ignoreTeam) continue;
    const t = intersectRaySphere(ray, entity.position, entity.hurtRadius);
    if (t === null || t > options.maxDistance) continue;
    if (!best || t < best.distance) {
      const point = ray.at(t, new THREE.Vector3());
      best = { type: 'entity', entity, point, distance: t };
    }
  }

  for (const cover of options.covers) {
    if (!cover.active) continue;
    if (cover.blocksProjectiles === false) continue;
    const point = ray.intersectBox(cover.box, new THREE.Vector3());
    if (!point) continue;
    const t = options.origin.distanceTo(point);
    if (t > options.maxDistance) continue;
    if (!best || t < best.distance) {
      best = { type: 'cover', cover, point, distance: t };
    }
  }

  return best;
}

export function raycastAll(options: {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  maxDistance: number;
  entities: Entity[];
  covers: Cover[];
  ignoreTeam?: TeamId;
}): RaycastHit[] {
  const dir = options.direction.clone().normalize();
  const ray = new THREE.Ray(options.origin.clone(), dir);

  const hits: RaycastHit[] = [];

  for (const entity of options.entities) {
    if (entity.eliminated) continue;
    if (options.ignoreTeam && entity.team === options.ignoreTeam) continue;
    const t = intersectRaySphere(ray, entity.position, entity.hurtRadius);
    if (t === null || t > options.maxDistance) continue;
    const point = ray.at(t, new THREE.Vector3());
    hits.push({ type: 'entity', entity, point, distance: t });
  }

  for (const cover of options.covers) {
    if (!cover.active) continue;
    if (cover.blocksProjectiles === false) continue;
    const point = ray.intersectBox(cover.box, new THREE.Vector3());
    if (!point) continue;
    const t = options.origin.distanceTo(point);
    if (t > options.maxDistance) continue;
    hits.push({ type: 'cover', cover, point, distance: t });
  }

  hits.sort((a, b) => a.distance - b.distance);
  return hits;
}

function intersectRaySphere(ray: THREE.Ray, center: THREE.Vector3, radius: number): number | null {
  const oc = ray.origin.clone().sub(center);
  const b = oc.dot(ray.direction);
  const c = oc.dot(oc) - radius * radius;
  const h = b * b - c;
  if (h < 0) return null;
  const sqrtH = Math.sqrt(h);
  let t = -b - sqrtH;
  if (t < 0) t = -b + sqrtH;
  if (t < 0) return null;
  return t;
}
