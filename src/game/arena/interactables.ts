import * as THREE from 'three';

export type InteractableTag =
  | 'burnable'
  | 'destructible'
  | 'pushable'
  | 'climbable'
  | 'toggleable'
  | 'explosive';

export type Interactable = {
  id: string;
  tags: Set<InteractableTag>;
  active: boolean;
  mesh: THREE.Object3D;

  hp?: number;
  maxHp?: number;
  isBurning?: boolean;
  burnTimeLeft?: number;
};

export type InteractableEvent =
  | { type: 'damage'; amount: number; sourceId?: string }
  | { type: 'ignite'; sourceId?: string }
  | { type: 'toggle'; sourceId?: string };

export function applyInteractableEvent(interactable: Interactable, event: InteractableEvent): void {
  if (!interactable.active) return;

  if (event.type === 'damage') {
    if (interactable.hp === undefined) return;
    interactable.hp = Math.max(0, interactable.hp - event.amount);
    if (interactable.hp === 0) {
      interactable.active = false;
      interactable.mesh.visible = false;
    }
    return;
  }

  if (event.type === 'ignite') {
    if (!interactable.tags.has('burnable')) return;
    interactable.isBurning = true;
    interactable.burnTimeLeft = Math.max(interactable.burnTimeLeft ?? 0, 3);
    return;
  }

  if (event.type === 'toggle') {
    if (!interactable.tags.has('toggleable')) return;
    interactable.active = !interactable.active;
    interactable.mesh.visible = interactable.active;
  }
}

export function updateInteractables(interactables: Interactable[], dt: number): void {
  for (const item of interactables) {
    if (!item.active) continue;
    if (item.isBurning && item.burnTimeLeft !== undefined) {
      item.burnTimeLeft = Math.max(0, item.burnTimeLeft - dt);
      if (item.burnTimeLeft === 0) {
        item.isBurning = false;
      }
    }
  }
}

