import type { Entity } from '../../entities/entityBase';

export function pickNearestEnemy(self: Entity, entities: Entity[]): Entity | null {
  let best: Entity | null = null;
  let bestDistSq = Number.POSITIVE_INFINITY;

  for (const e of entities) {
    if (e.eliminated) continue;
    if (e.team === self.team) continue;
    const dx = e.position.x - self.position.x;
    const dz = e.position.z - self.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = e;
    }
  }

  return best;
}

