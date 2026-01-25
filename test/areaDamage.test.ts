import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyExplosion } from '../src/game/combat/areaDamage';
import { createTestEntity } from './testUtils';

test('applyExplosion: linear falloff and radius cull', () => {
  const center = new THREE.Vector3(0, 0, 0);
  const radius = 10;
  const maxDamage = 50;

  const e0 = createTestEntity({ id: 'e0', team: 'p1', isAI: true, pos: new THREE.Vector3(0, 0, 0) });
  const eEdge = createTestEntity({ id: 'e1', team: 'p1', isAI: true, pos: new THREE.Vector3(10, 0, 0) });
  const eOut = createTestEntity({ id: 'e2', team: 'p1', isAI: true, pos: new THREE.Vector3(10.01, 0, 0) });

  applyExplosion([e0, eEdge, eOut], center, radius, maxDamage);

  assert.equal(e0.hp, 50);
  assert.equal(eEdge.hp, 100);
  assert.equal(eOut.hp, 100);
});

