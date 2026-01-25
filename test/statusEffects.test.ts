import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStatus, computeStatusDerived, updateStatusEffects } from '../src/game/combat/statusEffects';
import { createTestEntity } from './testUtils';

test('status stacking: refresh vs none', () => {
  const entity = createTestEntity({ id: 'p1', team: 'p1', isAI: false });

  applyStatus(entity, 'burn', 3);
  assert.equal(entity.statuses.get('burn')?.timeLeft, 3);

  updateStatusEffects(entity, 1, () => void 0);
  const burnAfter1s = entity.statuses.get('burn')?.timeLeft ?? 0;
  assert.ok(burnAfter1s > 1.9 && burnAfter1s < 2.1);

  applyStatus(entity, 'burn', 5);
  assert.ok((entity.statuses.get('burn')?.timeLeft ?? 0) > burnAfter1s);

  applyStatus(entity, 'stun', 0.8);
  updateStatusEffects(entity, 0.4, () => void 0);
  const stunRemaining = entity.statuses.get('stun')?.timeLeft ?? 0;
  assert.ok(stunRemaining > 0.3 && stunRemaining < 0.5);

  applyStatus(entity, 'stun', 2.0);
  assert.ok((entity.statuses.get('stun')?.timeLeft ?? 0) <= stunRemaining + 1e-6);
});

test('dot damage and derived flags', () => {
  const entity = createTestEntity({ id: 'p1', team: 'p1', isAI: false });

  let dealt = 0;
  applyStatus(entity, 'poison', 2);
  const derived = computeStatusDerived(entity);
  assert.equal(derived.blocksHealing, true);

  updateStatusEffects(entity, 1, (amount) => {
    dealt += amount;
  });

  assert.ok(dealt > 0);
});

