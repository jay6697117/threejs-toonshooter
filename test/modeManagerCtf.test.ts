import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchRuntime, updateMatch } from '../src/game/modes/modeManager';
import { createTestEntity, createWorldWithArena } from './testUtils';

test('ctf: score reaches win condition', () => {
  const world = createWorldWithArena('ctf');
  const runtime = createMatchRuntime('ctf', 'p1');
  const state = runtime.state;
  assert.equal(state.modeId, 'ctf');
  if (state.modeId !== 'ctf') throw new Error('Expected CTF state');

  const red = createTestEntity({ id: 'p1', team: 'red', isAI: false });
  const blue = createTestEntity({ id: 'p2', team: 'blue', isAI: true });
  world.entities.push(red, blue);

  updateMatch(world, runtime, 0.016);

  for (let i = 0; i < 3; i += 1) {
    red.position.copy(state.flags.blue.pos);
    updateMatch(world, runtime, 0.016);
    assert.equal(red.carryingFlag, 'blue');

    red.position.copy(state.flags.red.basePos);
    updateMatch(world, runtime, 0.016);
    assert.equal(state.score.red, i + 1);
    assert.equal(red.carryingFlag, null);
  }

  assert.equal(state.phase, 'ended');
  assert.equal(state.winnerTeam, 'red');
});

