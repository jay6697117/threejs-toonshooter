import * as THREE from 'three';
import type { InputAction, InputSnapshot } from './input';

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

export type StepInputBuffer = {
  setFromSnapshot: (snapshot: InputSnapshot, aimPoint: THREE.Vector3 | null) => void;
  setFromReplayStep: (state: { down: Record<InputAction, boolean>; pressed: Record<InputAction, boolean>; released: Record<InputAction, boolean>; aimPoint: THREE.Vector3 | null }) => void;
  isDown: (action: InputAction) => boolean;
  consumePressed: (action: InputAction) => boolean;
  consumeReleased: (action: InputAction) => boolean;
  endStep: () => void;
  getAimPoint: () => THREE.Vector3 | null;
  getDownMap: () => Record<InputAction, boolean>;
  getPressedMap: () => Record<InputAction, boolean>;
  getReleasedMap: () => Record<InputAction, boolean>;
};

export function createStepInputBuffer(): StepInputBuffer {
  const down = createActionMap(false);
  const pressed = createActionMap(false);
  const released = createActionMap(false);
  let aimPoint: THREE.Vector3 | null = null;

  const setFromSnapshot = (snapshot: InputSnapshot, nextAimPoint: THREE.Vector3 | null): void => {
    for (const key of Object.keys(down) as InputAction[]) {
      down[key] = snapshot.down[key];
      if (snapshot.justPressed[key]) pressed[key] = true;
      if (snapshot.justReleased[key]) released[key] = true;
    }
    aimPoint = nextAimPoint ? nextAimPoint.clone() : null;
  };

  const setFromReplayStep = (state: { down: Record<InputAction, boolean>; pressed: Record<InputAction, boolean>; released: Record<InputAction, boolean>; aimPoint: THREE.Vector3 | null }): void => {
    for (const key of Object.keys(down) as InputAction[]) {
      down[key] = state.down[key];
      pressed[key] = state.pressed[key];
      released[key] = state.released[key];
    }
    aimPoint = state.aimPoint ? state.aimPoint.clone() : null;
  };

  const isDown = (action: InputAction): boolean => down[action];

  const consumePressed = (action: InputAction): boolean => {
    const value = pressed[action];
    pressed[action] = false;
    return value;
  };

  const consumeReleased = (action: InputAction): boolean => {
    const value = released[action];
    released[action] = false;
    return value;
  };

  const endStep = (): void => {
    for (const key of Object.keys(pressed) as InputAction[]) {
      pressed[key] = false;
      released[key] = false;
    }
  };

  const getAimPoint = (): THREE.Vector3 | null => aimPoint;

  const getDownMap = (): Record<InputAction, boolean> => ({ ...down });
  const getPressedMap = (): Record<InputAction, boolean> => ({ ...pressed });
  const getReleasedMap = (): Record<InputAction, boolean> => ({ ...released });

  return { setFromSnapshot, setFromReplayStep, isDown, consumePressed, consumeReleased, endStep, getAimPoint, getDownMap, getPressedMap, getReleasedMap };
}
