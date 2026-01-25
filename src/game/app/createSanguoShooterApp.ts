import * as THREE from 'three';
import { createBoxCover } from '../arena/cover';
import { updatePickups } from '../arena/pickups';
import { loadArena, updateArena } from '../arena/arenaManager';
import { applyExplosion } from '../combat/areaDamage';
import { clampToBounds, resolveCircleVsAabb, resolveCircleVsCircle } from '../combat/collision';
import { applyDamageToCover } from '../combat/coverDamage';
import { dealDamage } from '../combat/damage';
import { updateStatusEffects } from '../combat/statusEffects';
import { DIFFICULTY_CONFIGS, DIFFICULTY_IDS, type DifficultyId } from '../config/difficulty';
import { GAME_CONFIG } from '../config/game';
import { MODE_CONFIGS } from '../config/modes';
import { CHARACTER_IDS, MODE_IDS, SCENE_IDS, type CharacterId, type ModeId, type SceneId } from '../config/ids';
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
import { updatePlayer } from '../entities/player';
import { updateCharacterMovement } from '../entities/movement';
import { ensureAiControllerState, computeAiFrame, type AiControllerState } from '../entities/aiController';
import { createMatchRuntime, initializeMatchPlayers, processDeaths, updateMatch, applyRespawns } from '../modes/modeManager';
import { spawnPlayersForMode } from '../modes/spawnPlayers';
import { applyWeaponHitToEntity } from '../weapons/fireWeapon';
import { type Projectile, updateProjectiles } from '../weapons/projectile';
import { updateWeapons } from '../weapons/weaponManager';
import { cycleActiveThrowableSlot, tryUseActiveThrowable, updateThrowables } from '../throwables/throwableManager';
import type { SanguoShooterUiState } from './uiState';

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
  getUiState: () => SanguoShooterUiState;
  setPaused: (value: boolean) => void;
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

  const { modeId, sceneId, difficultyId, characterId } = resolveInitialMatchFromUrl();
  const difficulty = DIFFICULTY_CONFIGS[difficultyId];
  const arenaScale = modeId === 'ffa' ? MODE_CONFIGS.ffa.arenaScale : 1;
  loadArena(scene, world, modeId, sceneId, { arenaScale });

  const match = createMatchRuntime(modeId, 'p1');
  const { human } = spawnPlayersForMode(scene, world, assets, modeId, { humanId: match.humanId });
  initializeMatchPlayers(world, match);
  const aiStates = new Map<string, AiControllerState>();

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

    if (input.wasPressed('weaponSlot1')) human.activeWeaponSlot = 0;
    if (input.wasPressed('weaponSlot2')) human.activeWeaponSlot = 1;
    if (input.wasPressed('weaponSlot3')) human.activeWeaponSlot = 2;
    if (input.wasPressed('aimSecondary')) cycleActiveThrowableSlot(human);

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
    updatePlayer(human, input, aimPoint, fixedDt, dashRequested);
    dashRequested = false;

    const weaponResult = updateWeapons(
      human,
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
      tryUseActiveThrowable(human, aimPoint, {
        scene,
        entities: world.entities,
        throwableProjectiles: world.throwableProjectiles,
        smokes: world.smokes,
        areas: world.areas,
        traps: world.traps
      });
      frameThrowPressed = false;
    }

    for (const entity of world.entities) {
      if (!entity.isAI) continue;
      const ai = ensureAiControllerState(aiStates, entity.id);
      const aiFrame = computeAiFrame(entity, ai, world, match, difficulty, fixedDt);
      updateCharacterMovement(entity, aiFrame.moveDir, aiFrame.aimPoint, fixedDt, aiFrame.dashRequested);
      updateWeapons(entity, aiFrame.weaponInput, aiFrame.aimPoint, fixedDt, { scene, entities: world.entities, covers: world.covers, projectiles: world.projectiles });
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

    updateArena(world, fixedDt);

    for (const cover of world.covers) {
      if (!cover.active) continue;
      if (cover.timeLeftSeconds === undefined) continue;
      cover.timeLeftSeconds = Math.max(0, cover.timeLeftSeconds - fixedDt);
      if (cover.timeLeftSeconds <= 0) {
        cover.active = false;
        scene.remove(cover.mesh);
      }
    }

    const bounds = world.arena?.bounds ?? GAME_CONFIG.arena.bounds;
    for (const entity of world.entities) {
      if (entity.eliminated) continue;
      clampToBounds(entity.position, bounds, entity.radius);
      for (const cover of world.covers) {
        if (!cover.active) continue;
        resolveCircleVsAabb(entity.position, entity.radius, cover.aabb);
      }
    }
    for (let i = 0; i < world.entities.length; i += 1) {
      const a = world.entities[i];
      if (a.eliminated) continue;
      for (let j = i + 1; j < world.entities.length; j += 1) {
        const b = world.entities[j];
        if (b.eliminated) continue;
        resolveCircleVsCircle(a.position, a.radius, b.position, b.radius);
      }
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
        const attacker = world.entities.find((e) => e.id === p.attackerId) ?? human;
        const dir = p.velocity.clone();
        if (dir.lengthSq() > 1e-6) dir.normalize();

        if (h.type === 'entity') {
          applyWeaponHitToEntity(attacker, p.weaponId, h.entity, dir, { damageAmount: p.damageAmount });
        }
        if (h.type === 'cover') {
          const ignite = weaponCfg.onHitEffects?.some((eff) => eff.kind === 'status' && eff.id === 'burn') ?? false;
          applyDamageToCover(scene, world.entities, h.cover, p.damageAmount, {
            ignite,
            attackerId: p.attackerId,
            attackerTeam: p.attackerTeam
          });
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

    processDeaths(world, match);
    updateMatch(world, match, fixedDt);
    applyRespawns(world, match, fixedDt);

    cameraRig.setTargetPosition(human.position);
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

  const getUiState = (): SanguoShooterUiState => {
    const activeWeaponId = human.weaponSlots[human.activeWeaponSlot] ?? null;
    const activeWeaponState = human.weaponSlotStates[human.activeWeaponSlot];
    const activeThrowable = human.throwableSlots[human.activeThrowableSlot];

    return {
      modeId: match.modeId,
      sceneId: world.arena?.sceneId ?? sceneId,
      paused,
      scoreboardHeld: input.isDown('scoreboard'),
      match: match.state,
      timeSeconds: world.timeSeconds,
      humanId: human.id,
      human: {
        id: human.id,
        team: human.team,
        isAI: human.isAI,
        hp: human.hp,
        maxHp: human.maxHp,
        eliminated: human.eliminated,
        livesLeft: human.livesLeft,
        kills: human.kills,
        deaths: human.deaths,
        score: human.score,
        carryingFlag: human.carryingFlag,
        characterId,
        damageDealtMultiplier: human.damageDealtMultiplier,
        isInDark: human.isInDark,
        isInWater: human.isInWater,
        dashTimer: human.dashTimer,
        dashCooldown: human.dashCooldown,
        weaponSlots: human.weaponSlots.slice(),
        activeWeaponSlot: human.activeWeaponSlot,
        activeWeaponId,
        activeWeaponState: activeWeaponState
          ? {
              weaponId: activeWeaponState.weaponId,
              ammo: activeWeaponState.ammo,
              reserve: activeWeaponState.reserve,
              reloadTimer: activeWeaponState.reloadTimer,
              cooldownTimer: activeWeaponState.cooldownTimer,
              chargeSeconds: activeWeaponState.chargeSeconds,
              burstShotsRemaining: activeWeaponState.burstShotsRemaining
            }
          : null,
        throwableSlots: human.throwableSlots.slice(),
        activeThrowableSlot: human.activeThrowableSlot,
        activeThrowable: activeThrowable ? { id: activeThrowable.id, count: activeThrowable.count } : null,
        statuses: Array.from(human.statuses.values()).map((s) => ({ id: s.id, timeLeft: s.timeLeft }))
      },
      entities: world.entities.map((e) => ({
        id: e.id,
        team: e.team,
        isAI: e.isAI,
        hp: e.hp,
        maxHp: e.maxHp,
        eliminated: e.eliminated,
        livesLeft: e.livesLeft,
        kills: e.kills,
        deaths: e.deaths,
        score: e.score,
        carryingFlag: e.carryingFlag
      }))
    };
  };

  const setPaused = (value: boolean): void => {
    paused = value;
  };

  return { renderer, scene, camera, input, assets, audio, beginFrame, step, frame, getUiState, setPaused, dispose };
}

function resolveInitialMatchFromUrl(): { modeId: ModeId; sceneId: SceneId; difficultyId: DifficultyId; characterId: CharacterId | null } {
  const params = new URLSearchParams(window.location.search);
  const modeRaw = params.get('mode');
  const sceneRaw = params.get('scene');
  const difficultyRaw = params.get('difficulty');
  const characterRaw = params.get('character');
  const modeId = isModeId(modeRaw) ? modeRaw : 'duel';
  const sceneId = isSceneId(sceneRaw) ? sceneRaw : 'trainingGround';
  const difficultyId = isDifficultyId(difficultyRaw) ? difficultyRaw : 'normal';
  const characterId = isCharacterId(characterRaw) ? characterRaw : null;
  return { modeId, sceneId, difficultyId, characterId };
}

function isModeId(value: string | null): value is ModeId {
  if (!value) return false;
  return (MODE_IDS as readonly string[]).includes(value);
}

function isSceneId(value: string | null): value is SceneId {
  if (!value) return false;
  return (SCENE_IDS as readonly string[]).includes(value);
}

function isDifficultyId(value: string | null): value is DifficultyId {
  if (!value) return false;
  return (DIFFICULTY_IDS as readonly string[]).includes(value);
}

function isCharacterId(value: string | null): value is CharacterId {
  if (!value) return false;
  return (CHARACTER_IDS as readonly string[]).includes(value);
}
