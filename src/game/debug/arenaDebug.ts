import * as THREE from 'three';
import type { World } from '../core/world';

export type ArenaDebug = {
  setEnabled: (value: boolean) => void;
  update: (world: World) => void;
  dispose: () => void;
};

export function createArenaDebug(scene: THREE.Scene): ArenaDebug {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  let lastSceneId: string | null = null;
  let lastCoverCount = -1;
  let lastActiveCoverCount = -1;
  const boxHelpers: THREE.Box3Helper[] = [];

  const rebuild = (world: World): void => {
    for (const obj of [...boxHelpers, ...group.children]) {
      group.remove(obj);
    }
    boxHelpers.length = 0;

    if (!world.arena) return;

    for (const cover of world.covers) {
      if (!cover.active) continue;
      const color = cover.toggleable ? 0x79d5ff : cover.pushable ? 0xffc44d : cover.blocksProjectiles === false ? 0xff6b6b : 0x8cff75;
      const helper = new THREE.Box3Helper(cover.box, new THREE.Color(color));
      boxHelpers.push(helper);
      group.add(helper);
    }

    const spawns = [
      ...world.arena.ffaSpawns.map((p) => ({ p, color: 0xffc44d })),
      ...world.arena.redSpawns.map((p) => ({ p, color: 0xff6b6b })),
      ...world.arena.blueSpawns.map((p) => ({ p, color: 0x79d5ff }))
    ];
    for (const s of spawns) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 12),
        new THREE.MeshBasicMaterial({ color: s.color })
      );
      mesh.position.copy(s.p);
      mesh.position.y = 0.2;
      group.add(mesh);
    }

    const siege = world.arena.objectives?.siege;
    if (siege) {
      const circle = createCircleLine(siege.captureRadius, 0x8cff75);
      circle.position.copy(siege.capturePoint);
      circle.position.y = 0.06;
      group.add(circle);
    }

    const ctf = world.arena.objectives?.ctf;
    if (ctf) {
      const red = createCircleLine(1.2, 0xff6b6b);
      red.position.copy(ctf.redFlagBase);
      red.position.y = 0.06;
      group.add(red);

      const blue = createCircleLine(1.2, 0x79d5ff);
      blue.position.copy(ctf.blueFlagBase);
      blue.position.y = 0.06;
      group.add(blue);
    }
  };

  const setEnabled = (value: boolean): void => {
    group.visible = value;
  };

  const update = (world: World): void => {
    const sceneId = world.arena?.sceneId ?? null;
    const coverCount = world.covers.length;
    const activeCoverCount = world.covers.reduce((acc, c) => acc + (c.active ? 1 : 0), 0);
    if (sceneId !== lastSceneId) {
      lastSceneId = sceneId;
      lastCoverCount = coverCount;
      lastActiveCoverCount = activeCoverCount;
      rebuild(world);
    }
    if (coverCount !== lastCoverCount || activeCoverCount !== lastActiveCoverCount) {
      lastCoverCount = coverCount;
      lastActiveCoverCount = activeCoverCount;
      rebuild(world);
    }

    if (!group.visible) return;
    for (const helper of boxHelpers) {
      helper.updateMatrixWorld(true);
    }
  };

  const dispose = (): void => {
    scene.remove(group);
  };

  return { setEnabled, update, dispose };
}

function createCircleLine(radius: number, color: number): THREE.Line {
  const points: THREE.Vector3[] = [];
  const segs = 48;
  for (let i = 0; i <= segs; i += 1) {
    const t = (i / segs) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(t) * radius, 0, Math.sin(t) * radius));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
  return new THREE.Line(geo, mat);
}
