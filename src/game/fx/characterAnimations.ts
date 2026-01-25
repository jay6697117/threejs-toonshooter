import * as THREE from 'three';
import type { Entity } from '../entities/entityBase';

export type CharacterAnimationSystem = {
  update: (entities: Entity[], dt: number) => void;
  dispose: () => void;
};

type MixerRecord = {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  action: THREE.AnimationAction;
};

export function createCharacterAnimationSystem(): CharacterAnimationSystem {
  const mixers = new Map<string, MixerRecord>();

  const update = (entities: Entity[], dt: number): void => {
    const seen = new Set<string>();

    for (const entity of entities) {
      if (entity.eliminated) continue;
      const clips = getAnimationClips(entity.mesh);
      if (!clips || clips.length === 0) continue;

      seen.add(entity.id);
      ensureMixer(entity.id, entity.mesh, clips);
    }

    for (const [id, record] of mixers) {
      if (!seen.has(id)) {
        disposeRecord(record);
        mixers.delete(id);
        continue;
      }
      record.mixer.update(dt);
    }
  };

  const dispose = (): void => {
    for (const record of mixers.values()) {
      disposeRecord(record);
    }
    mixers.clear();
  };

  const ensureMixer = (entityId: string, root: THREE.Object3D, clips: THREE.AnimationClip[]): void => {
    const existing = mixers.get(entityId);
    if (existing && existing.root === root) return;

    if (existing) {
      disposeRecord(existing);
      mixers.delete(entityId);
    }

    const mixer = new THREE.AnimationMixer(root);
    const clip = selectIdleClip(clips);
    const action = mixer.clipAction(clip);
    action.play();
    mixers.set(entityId, { root, mixer, action });
  };

  return { update, dispose };
}

function getAnimationClips(root: THREE.Object3D): THREE.AnimationClip[] | null {
  const data = root.userData as { animationClips?: unknown };
  const clips = data.animationClips;
  if (!Array.isArray(clips)) return null;
  return clips.filter((c): c is THREE.AnimationClip => c instanceof THREE.AnimationClip);
}

function selectIdleClip(clips: THREE.AnimationClip[]): THREE.AnimationClip {
  const idle = clips.find((c) => c.name.toLowerCase().includes('idle'));
  if (idle) return idle;
  return clips[0];
}

function disposeRecord(record: MixerRecord): void {
  record.action.stop();
  record.mixer.stopAllAction();
  record.mixer.uncacheRoot(record.root);
}

