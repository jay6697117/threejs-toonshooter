import * as THREE from 'three';
import { createBoxCover, type Cover } from '../arena/cover';
import { createHealthPickup, createThrowablePickup, createWeaponPickup, updatePickups } from '../arena/pickups';
import { applyExplosion } from '../combat/areaDamage';
import { clampToBounds, resolveCircleVsAabb } from '../combat/collision';
import { dealDamage } from '../combat/damage';
import { updateStatusEffects } from '../combat/statusEffects';
import { GAME_CONFIG } from '../config/game';
import { WEAPON_CONFIGS } from '../config/weapons';
import { AudioManager } from '../core/audio';
import { Assets } from '../core/assets';
import { CameraRig } from '../core/camera';
import { createRenderer } from '../core/renderer';
import { InputManager } from '../core/input';
import { GroundPicker } from '../core/picking';
import { resizeRendererToDisplaySize } from '../core/resize';
import { loadSettings, saveSettings } from '../core/storage';
import { createWorld } from '../core/world';
import { syncVisual } from '../entities/entityBase';
import { createNpcEntity } from '../entities/npc';
import { createPlayerEntity, updatePlayer } from '../entities/player';
import { applyWeaponHitToEntity } from '../weapons/fireWeapon';
import { type Projectile, updateProjectiles } from '../weapons/projectile';
import { updateWeapons } from '../weapons/weaponManager';
import { cycleActiveThrowableSlot, tryUseActiveThrowable, updateThrowables } from '../throwables/throwableManager';

export type SanguoShooterApp = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  input: InputManager;
  assets: Assets;
  audio: AudioManager;
  beginFrame: (frameDt: number) => void;
  step: (fixedDt: number) => void;
  frame: (alpha: number) => void;
  dispose: () => void;
};

export function createSanguoShooterApp(canvas: HTMLCanvasElement): SanguoShooterApp {
  const settings = loadSettings();

  const input = new InputManager(canvas);
  const assets = new Assets();
  const audio = new AudioManager();
  audio.setVolumes(settings.audio);

  const renderer = createRenderer(canvas, { maxDpr: settings.graphics.maxDpr, shadows: settings.graphics.shadows });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f1c);
  const world = createWorld(scene);

  const cameraRig = new CameraRig({
    fov: 50,
    near: 0.1,
    far: 200,
    offset: new THREE.Vector3(0, 4.2, 6.8),
    lookAtOffset: new THREE.Vector3(0, 0.9, 0)
  });
  const camera = cameraRig.camera;

  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x7a5b3a, 0.65);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xfff2d6, 1.05);
  dir.position.set(6, 10, 8);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 40;
  dir.shadow.camera.left = -12;
  dir.shadow.camera.right = 12;
  dir.shadow.camera.top = 12;
  dir.shadow.camera.bottom = -12;
  scene.add(dir);

  const groundGeo = new THREE.PlaneGeometry(24, 18);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x263143, roughness: 0.95, metalness: 0.0 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const player = createPlayerEntity({
    id: 'p1',
    team: 'p1',
    color: 0x45d16e,
    startPos: new THREE.Vector3(0, 0.95, 0),
    mesh: assets.createPlaceholderMesh({ color: 0x45d16e })
  });
  scene.add(player.mesh);
  world.entities.push(player);

  const enemy = createNpcEntity({
    id: 'p2',
    team: 'p2',
    color: 0xe84c4c,
    startPos: new THREE.Vector3(5, 0.95, 0),
    mesh: assets.createPlaceholderMesh({ color: 0xe84c4c })
  });
  scene.add(enemy.mesh);
  world.entities.push(enemy);

  const covers: Cover[] = [
    createBoxCover({ id: 'coverA', size: new THREE.Vector3(2.4, 1.2, 1.2), pos: new THREE.Vector3(-3.2, 0.6, 0) }),
    createBoxCover({ id: 'coverB', size: new THREE.Vector3(2.0, 1.0, 1.6), pos: new THREE.Vector3(3.6, 0.5, -1.8) })
  ];
  for (const cover of covers) scene.add(cover.mesh);
  world.covers.push(...covers);

  const pickups = [
    createWeaponPickup({ id: 'pickup_weapon_a', weaponId: 'boomerangBlade', pos: new THREE.Vector3(-6, 0.2, -3) }),
    createThrowablePickup({ id: 'pickup_throw_a', throwableId: 'smokeBomb', pos: new THREE.Vector3(0, 0.2, 4) }),
    createHealthPickup({ id: 'pickup_health_a', amount: 35, pos: new THREE.Vector3(6, 0.2, 2) })
  ];
  for (const pickup of pickups) scene.add(pickup.mesh);
  world.pickups.push(...pickups);

  const picker = new GroundPicker();
  picker.setGroundY(0);

  const onUnlock = async (): Promise<void> => {
    try {
      await audio.unlock();
    } catch {
      // ignored
    }
    canvas.removeEventListener('pointerdown', onUnlock);
  };
  canvas.addEventListener('pointerdown', onUnlock, { passive: true });

  let paused = false;
  let dashRequested = false;
  let frameAimPoint: THREE.Vector3 | null = null;
  let frameFirePressed = false;
  let frameFireReleased = false;
  let frameReloadPressed = false;
  let frameThrowPressed = false;

  const beginFrame = (_frameDt: number): void => {
    if (input.wasPressed('pause')) {
      paused = !paused;
      audio.playBeep({ frequencyHz: paused ? 260 : 520, durationSeconds: 0.05, bus: 'sfx' });
    }

    dashRequested = dashRequested || input.wasPressed('dash');

    if (input.wasPressed('weaponSlot1')) player.activeWeaponSlot = 0;
    if (input.wasPressed('weaponSlot2')) player.activeWeaponSlot = 1;
    if (input.wasPressed('weaponSlot3')) player.activeWeaponSlot = 2;
    if (input.wasPressed('aimSecondary')) cycleActiveThrowableSlot(player);

    const pointer = input.getPointerNdc();
    const hit = pointer.insideCanvas ? picker.pick(camera, pointer.x, pointer.y) : null;
    frameAimPoint = hit?.point ?? null;

    frameFirePressed = frameFirePressed || input.wasPressed('fire');
    frameFireReleased = frameFireReleased || input.wasReleased('fire');
    frameReloadPressed = frameReloadPressed || input.wasPressed('reload');
    frameThrowPressed = frameThrowPressed || input.wasPressed('throw');
  };

  const step = (fixedDt: number): void => {
    if (paused) {
      dashRequested = false;
      frameFirePressed = false;
      frameFireReleased = false;
      frameReloadPressed = false;
      frameThrowPressed = false;
      return;
    }
    world.timeSeconds += fixedDt;

    for (const entity of world.entities) {
      if (entity.eliminated) continue;
      updateStatusEffects(entity, fixedDt, (amount) => dealDamage(entity, amount, { isDot: true }));
    }

    const aimPoint = frameAimPoint;
    updatePlayer(player, input, aimPoint, fixedDt, dashRequested);
    dashRequested = false;

    const weaponResult = updateWeapons(
      player,
      {
        fireDown: input.isDown('fire'),
        firePressed: frameFirePressed,
        fireReleased: frameFireReleased,
        reloadPressed: frameReloadPressed
      },
      aimPoint,
      fixedDt,
      { scene, entities: world.entities, covers: world.covers, projectiles: world.projectiles }
    );
    frameFirePressed = false;
    frameFireReleased = false;
    frameReloadPressed = false;
    if (weaponResult.shotsFired > 0) {
      audio.playBeep({ frequencyHz: 520, durationSeconds: 0.03, bus: 'sfx' });
    }

    if (frameThrowPressed) {
      tryUseActiveThrowable(player, aimPoint, {
        scene,
        entities: world.entities,
        throwableProjectiles: world.throwableProjectiles,
        smokes: world.smokes,
        areas: world.areas,
        traps: world.traps
      });
      frameThrowPressed = false;
    }

    updateThrowables(
      {
        scene,
        entities: world.entities,
        throwableProjectiles: world.throwableProjectiles,
        smokes: world.smokes,
        areas: world.areas,
        traps: world.traps
      },
      fixedDt,
      world.timeSeconds
    );

    for (const cover of world.covers) {
      if (!cover.active) continue;
      if (cover.timeLeftSeconds === undefined) continue;
      cover.timeLeftSeconds = Math.max(0, cover.timeLeftSeconds - fixedDt);
      if (cover.timeLeftSeconds <= 0) {
        cover.active = false;
        scene.remove(cover.mesh);
      }
    }

    clampToBounds(player.position, GAME_CONFIG.arena.bounds, player.radius);
    for (const cover of world.covers) {
      if (!cover.active) continue;
      resolveCircleVsAabb(player.position, player.radius, cover.aabb);
    }

    updatePickups(world.pickups, world.entities, fixedDt, world.timeSeconds);

    const projUpdates = updateProjectiles(world.projectiles, world.entities, world.covers, fixedDt);
    const remaining: Projectile[] = [];
    for (const u of projUpdates) {
      const { projectile: p, hit: h, remove } = u;
      if (!h && !remove) {
        remaining.push(p);
        continue;
      }

      const weaponCfg = WEAPON_CONFIGS[p.weaponId];

      if (h) {
        const attacker = world.entities.find((e) => e.id === p.attackerId) ?? player;
        const dir = p.velocity.clone();
        if (dir.lengthSq() > 1e-6) dir.normalize();

        if (h.type === 'entity') {
          applyWeaponHitToEntity(attacker, p.weaponId, h.entity, dir, { damageAmount: p.damageAmount });
        }

        const impactPoint = h.type === 'entity' || h.type === 'cover' ? h.point : p.position;
        const isTimeoutExpiry = h.type === 'expired' && h.reason === 'timeout';
        if (weaponCfg.splash && remove) {
          const statusEffects =
            weaponCfg.onHitEffects
              ?.filter((eff) => eff.kind === 'status')
              .map((eff) => ({
                id: eff.id,
                durationSeconds:
                  eff.durationSeconds === undefined
                    ? undefined
                    : typeof eff.durationSeconds === 'number'
                      ? eff.durationSeconds
                      : eff.durationSeconds.max
              })) ?? [];

          applyExplosion(world.entities, impactPoint, weaponCfg.splash.radiusMeters, weaponCfg.splash.damage, {
            attackerId: p.attackerId,
            attackerTeam: p.attackerTeam,
            knockbackDistance: 1.2,
            statusEffects: statusEffects.length > 0 ? statusEffects : undefined
          });
        }

        if (weaponCfg.special.kind === 'spawnObstacleOnImpact' && remove && !isTimeoutExpiry) {
          const obstacle = createBoxCover({
            id: `obstacle_${p.id}`,
            size: new THREE.Vector3(1.3, 1.1, 0.9),
            pos: new THREE.Vector3(impactPoint.x, 0.55, impactPoint.z),
            color: 0x9aa5b4,
            hp: 25
          });
          obstacle.timeLeftSeconds = weaponCfg.special.durationSeconds;
          scene.add(obstacle.mesh);
          world.covers.push(obstacle);
        }

        if (weaponCfg.special.kind === 'mobilityGrapple' && remove && !isTimeoutExpiry) {
          const dx = impactPoint.x - attacker.position.x;
          const dz = impactPoint.z - attacker.position.z;
          const lenSq = dx * dx + dz * dz;
          if (lenSq > 1e-6) {
            attacker.dashTimer = Math.max(attacker.dashTimer, 0.45);
            attacker.dashDir.set(dx, 0, dz).normalize();
          }
        }
      }

      if (remove) {
        scene.remove(p.mesh);
      } else {
        remaining.push(p);
      }
    }
    world.projectiles = remaining;

    cameraRig.setTargetPosition(player.position);
    cameraRig.update(fixedDt);
  };

  const frame = (_alpha: number): void => {
    for (const entity of world.entities) {
      entity.mesh.visible = !entity.eliminated;
      if (!entity.eliminated) syncVisual(entity);
    }
    cameraRig.applyToCamera();

    if (resizeRendererToDisplaySize(renderer)) {
      const { clientWidth, clientHeight } = renderer.domElement;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
    input.endFrame();
  };

  const dispose = (): void => {
    input.dispose();
    saveSettings(settings);
  };

  return { renderer, scene, camera, input, assets, audio, beginFrame, step, frame, dispose };
}
