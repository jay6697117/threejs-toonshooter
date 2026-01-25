export type InputAction =
  | 'moveForward'
  | 'moveBackward'
  | 'moveLeft'
  | 'moveRight'
  | 'dash'
  | 'fire'
  | 'aimSecondary'
  | 'interact'
  | 'reload'
  | 'throw'
  | 'weaponSlot1'
  | 'weaponSlot2'
  | 'weaponSlot3'
  | 'scoreboard'
  | 'pause'
  | 'toggleVisual'
  | 'start';

export type InputSnapshot = Readonly<{
  down: Record<InputAction, boolean>;
  justPressed: Record<InputAction, boolean>;
  justReleased: Record<InputAction, boolean>;
  pointer: {
    clientX: number;
    clientY: number;
    ndcX: number;
    ndcY: number;
    insideCanvas: boolean;
  };
}>;

const DEFAULT_KEY_BINDINGS: Record<string, InputAction> = {
  KeyW: 'moveForward',
  KeyS: 'moveBackward',
  KeyA: 'moveLeft',
  KeyD: 'moveRight',
  Space: 'dash',
  KeyE: 'interact',
  KeyR: 'reload',
  KeyG: 'throw',
  Digit1: 'weaponSlot1',
  Digit2: 'weaponSlot2',
  Digit3: 'weaponSlot3',
  Tab: 'scoreboard',
  KeyP: 'pause',
  Escape: 'pause',
  KeyV: 'toggleVisual',
  Enter: 'start'
};

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

export class InputManager {
  private readonly canvas: HTMLCanvasElement;
  private readonly keyBindings: Record<string, InputAction>;

  private readonly down = createActionMap(false);
  private readonly justPressed = createActionMap(false);
  private readonly justReleased = createActionMap(false);

  private pointerClientX = 0;
  private pointerClientY = 0;
  private pointerNdcX = 0;
  private pointerNdcY = 0;
  private pointerInsideCanvas = false;

  private disposed = false;

  constructor(canvas: HTMLCanvasElement, options?: { keyBindings?: Partial<Record<string, InputAction>> }) {
    this.canvas = canvas;
    this.keyBindings = { ...DEFAULT_KEY_BINDINGS, ...(options?.keyBindings ?? {}) };

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);
    this.onBlur = this.onBlur.bind(this);

    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp, { passive: false });
    window.addEventListener('blur', this.onBlur);

    this.canvas.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp, { passive: false });
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  endFrame(): void {
    for (const key of Object.keys(this.justPressed) as InputAction[]) {
      this.justPressed[key] = false;
      this.justReleased[key] = false;
    }
  }

  snapshot(): InputSnapshot {
    return {
      down: { ...this.down },
      justPressed: { ...this.justPressed },
      justReleased: { ...this.justReleased },
      pointer: {
        clientX: this.pointerClientX,
        clientY: this.pointerClientY,
        ndcX: this.pointerNdcX,
        ndcY: this.pointerNdcY,
        insideCanvas: this.pointerInsideCanvas
      }
    };
  }

  getPointerNdc(): { x: number; y: number; insideCanvas: boolean } {
    return { x: this.pointerNdcX, y: this.pointerNdcY, insideCanvas: this.pointerInsideCanvas };
  }

  isDown(action: InputAction): boolean {
    return this.down[action];
  }

  wasPressed(action: InputAction): boolean {
    return this.justPressed[action];
  }

  wasReleased(action: InputAction): boolean {
    return this.justReleased[action];
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);

    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }

  private setActionDown(action: InputAction, isDown: boolean): void {
    const wasDown = this.down[action];
    if (isDown && !wasDown) this.justPressed[action] = true;
    if (!isDown && wasDown) this.justReleased[action] = true;
    this.down[action] = isDown;
  }

  private onKeyDown(e: KeyboardEvent): void {
    const action = this.keyBindings[e.code];
    if (!action) return;
    if (action === 'scoreboard') e.preventDefault();
    if (action === 'pause') e.preventDefault();
    this.setActionDown(action, true);
  }

  private onKeyUp(e: KeyboardEvent): void {
    const action = this.keyBindings[e.code];
    if (!action) return;
    if (action === 'scoreboard') e.preventDefault();
    if (action === 'pause') e.preventDefault();
    this.setActionDown(action, false);
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button === 0) {
      this.setActionDown('fire', true);
    } else if (e.button === 2) {
      this.setActionDown('aimSecondary', true);
    }
    this.updatePointer(e);
    this.canvas.focus();
    e.preventDefault();
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.button === 0) {
      this.setActionDown('fire', false);
    } else if (e.button === 2) {
      this.setActionDown('aimSecondary', false);
    }
    this.updatePointer(e);
  }

  private onPointerMove(e: PointerEvent): void {
    this.updatePointer(e);
  }

  private onContextMenu(e: MouseEvent): void {
    e.preventDefault();
  }

  private onBlur(): void {
    for (const key of Object.keys(this.down) as InputAction[]) {
      this.down[key] = false;
      this.justPressed[key] = false;
      this.justReleased[key] = false;
    }
  }

  private updatePointer(e: PointerEvent | MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.pointerClientX = e.clientX;
    this.pointerClientY = e.clientY;
    this.pointerInsideCanvas = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;

    const nx = rect.width > 0 ? (x / rect.width) * 2 - 1 : 0;
    const ny = rect.height > 0 ? -(y / rect.height) * 2 + 1 : 0;

    this.pointerNdcX = nx;
    this.pointerNdcY = ny;
  }
}
