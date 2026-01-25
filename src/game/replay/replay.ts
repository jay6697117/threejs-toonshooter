import * as THREE from 'three';
import type { InputAction, InputSnapshot } from '../core/input';
import type { CharacterId, ModeId, SceneId } from '../config/ids';
import type { DifficultyId } from '../config/difficulty';

export type ReplayEventV1 =
  | { t: number; type: 'press'; action: InputAction }
  | { t: number; type: 'release'; action: InputAction }
  | { t: number; type: 'aim'; has: false }
  | { t: number; type: 'aim'; has: true; x: number; y: number; z: number };

export type ReplayDataV1 = {
  version: 1;
  createdAtIso: string;
  fixedDt: number;
  seed: number;
  modeId: ModeId;
  sceneId: SceneId;
  difficultyId: DifficultyId;
  characterId: CharacterId | null;
  endStepIndex: number;
  initialDown: Record<InputAction, boolean>;
  initialAim: { x: number; y: number; z: number } | null;
  events: ReplayEventV1[];
};

export type ReplayStepState = {
  down: Record<InputAction, boolean>;
  pressed: Record<InputAction, boolean>;
  released: Record<InputAction, boolean>;
  aimPoint: THREE.Vector3 | null;
};

export const REPLAY_STORAGE_KEY = 'sanguoShooterReplay_v1';

function createActionMap(initial: boolean): Record<InputAction, boolean> {
  return {
    moveForward: initial,
    moveBackward: initial,
    moveLeft: initial,
    moveRight: initial,
    dash: initial,
    fire: initial,
    aimSecondary: initial,
    interact: initial,
    reload: initial,
    throw: initial,
    weaponSlot1: initial,
    weaponSlot2: initial,
    weaponSlot3: initial,
    scoreboard: initial,
    pause: initial,
    toggleVisual: initial,
    start: initial
  };
}

export function saveReplayToStorage(replay: ReplayDataV1): void {
  localStorage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(replay));
}

export function loadReplayFromStorage(): ReplayDataV1 | null {
  const raw = localStorage.getItem(REPLAY_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ReplayDataV1;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearReplayFromStorage(): void {
  localStorage.removeItem(REPLAY_STORAGE_KEY);
}

export type ReplayRecorder = {
  captureFrame: (stepIndex: number, snapshot: InputSnapshot, aimPoint: THREE.Vector3 | null) => void;
  finalize: (endStepIndex: number, fallback?: { modeId: ModeId; sceneId: SceneId; difficultyId: DifficultyId; characterId: CharacterId | null; seed: number; fixedDt: number }) => ReplayDataV1;
};

export function createReplayRecorder(): ReplayRecorder {
  const events: ReplayEventV1[] = [];
  let initialized = false;
  const initialDown = createActionMap(false);
  let initialAim: { x: number; y: number; z: number } | null = null;
  let lastAim: THREE.Vector3 | null = null;

  const captureFrame = (stepIndex: number, snapshot: InputSnapshot, aimPoint: THREE.Vector3 | null): void => {
    if (!initialized) {
      for (const key of Object.keys(initialDown) as InputAction[]) {
        initialDown[key] = snapshot.down[key];
      }
      if (aimPoint) {
        initialAim = { x: aimPoint.x, y: aimPoint.y, z: aimPoint.z };
        lastAim = aimPoint.clone();
      }
      initialized = true;
    }

    for (const key of Object.keys(initialDown) as InputAction[]) {
      if (snapshot.justPressed[key]) events.push({ t: stepIndex, type: 'press', action: key });
      if (snapshot.justReleased[key]) events.push({ t: stepIndex, type: 'release', action: key });
    }

    const aimEpsSq = 0.18 * 0.18;
    if (!aimPoint) {
      if (lastAim) {
        events.push({ t: stepIndex, type: 'aim', has: false });
        lastAim = null;
      }
      return;
    }

    if (!lastAim || aimPoint.distanceToSquared(lastAim) > aimEpsSq) {
      events.push({ t: stepIndex, type: 'aim', has: true, x: aimPoint.x, y: aimPoint.y, z: aimPoint.z });
      lastAim = aimPoint.clone();
    }
  };

  const finalize = (
    endStepIndex: number,
    fallback?: { modeId: ModeId; sceneId: SceneId; difficultyId: DifficultyId; characterId: CharacterId | null; seed: number; fixedDt: number }
  ): ReplayDataV1 => {
    if (!fallback) {
      throw new Error('Replay recorder finalize requires fallback meta');
    }

    return {
      version: 1,
      createdAtIso: new Date().toISOString(),
      fixedDt: fallback.fixedDt,
      seed: fallback.seed,
      modeId: fallback.modeId,
      sceneId: fallback.sceneId,
      difficultyId: fallback.difficultyId,
      characterId: fallback.characterId,
      endStepIndex,
      initialDown: { ...initialDown },
      initialAim,
      events
    };
  };

  return { captureFrame, finalize };
}

export type ReplayPlayer = {
  replay: ReplayDataV1;
  getStepState: (stepIndex: number) => ReplayStepState;
  isEnded: (stepIndex: number) => boolean;
};

export function createReplayPlayer(replay: ReplayDataV1): ReplayPlayer {
  const down = { ...replay.initialDown };
  let aimPoint = replay.initialAim ? new THREE.Vector3(replay.initialAim.x, replay.initialAim.y, replay.initialAim.z) : null;
  let eventIndex = 0;
  let lastStepIndex = -1;

  const getStepState = (stepIndex: number): ReplayStepState => {
    if (stepIndex < lastStepIndex) {
      throw new Error(`ReplayPlayer getStepState must be called with non-decreasing stepIndex (got ${stepIndex}, last=${lastStepIndex})`);
    }
    lastStepIndex = stepIndex;

    const pressed = createActionMap(false);
    const released = createActionMap(false);

    while (eventIndex < replay.events.length && replay.events[eventIndex].t <= stepIndex) {
      const ev = replay.events[eventIndex];
      if (ev.type === 'press') {
        down[ev.action] = true;
        if (ev.t === stepIndex) pressed[ev.action] = true;
      } else if (ev.type === 'release') {
        down[ev.action] = false;
        if (ev.t === stepIndex) released[ev.action] = true;
      } else if (ev.type === 'aim') {
        if (!ev.has) aimPoint = null;
        else aimPoint = new THREE.Vector3(ev.x, ev.y, ev.z);
      }
      eventIndex += 1;
    }

    return { down: { ...down }, pressed, released, aimPoint: aimPoint ? aimPoint.clone() : null };
  };

  const isEnded = (stepIndex: number): boolean => stepIndex >= replay.endStepIndex;

  return { replay, getStepState, isEnded };
}

