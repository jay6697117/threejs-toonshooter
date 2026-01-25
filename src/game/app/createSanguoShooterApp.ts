import * as THREE from 'three';
import { createBoxCover, updateCoverAabb, type Cover } from '../arena/cover';
import { createWeaponPickup, updatePickups } from '../arena/pickups';
import { loadArena, updateArena } from '../arena/arenaManager';
import { buildNavGrid, type NavGrid } from '../arena/navGraph';
import { applyExplosion } from '../combat/areaDamage';
import { clampToBounds, resolveCircleVsAabb, resolveCircleVsCircle } from '../combat/collision';
import { applyDamageToCover } from '../combat/coverDamage';
import { dealDamage } from '../combat/damage';
import { updateStatusEffects } from '../combat/statusEffects';
import { DIFFICULTY_CONFIGS, DIFFICULTY_IDS, type DifficultyId } from '../config/difficulty';
import { GAME_CONFIG } from '../config/game';
import { MODE_CONFIGS } from '../config/modes';
import { CHARACTER_IDS, MODE_IDS, SCENE_IDS, type CharacterId, type ModeId, type SceneId, type WeaponId } from '../config/ids';
import { WEAPON_CONFIGS } from '../config/weapons';
import { AudioManager } from '../core/audio';
import { Assets } from '../core/assets';
import { CameraRig } from '../core/camera';
import { createRenderer } from '../core/renderer';
import { InputManager } from '../core/input';
import { GroundPicker } from '../core/picking';
import { resizeRendererToDisplaySize } from '../core/resize';
import { loadSettings, saveSettings } from '../core/storage';
import { createWorld, type World } from '../core/world';
import { createDefaultSeed, hashStringToSeed } from '../core/rng';
import { createArenaDebug } from '../debug/arenaDebug';
import { createTracerSystem } from '../fx/tracers';
import { createParticleSystem } from '../fx/particles';
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
  const { modeId, sceneId, difficultyId, characterId, seed } = resolveInitialMatchFromUrl();
  const world = createWorld(scene, { seed });
  const arenaDebug = createArenaDebug(scene);
  let debugEnabled = false;
  const tracers = createTracerSystem(scene);
  const particles = createParticleSystem(scene);

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

  const difficulty = DIFFICULTY_CONFIGS[difficultyId];
  const arenaScale = modeId === 'ffa' ? MODE_CONFIGS.ffa.arenaScale : 1;
  loadArena(scene, world, modeId, sceneId, { arenaScale });

  const match = createMatchRuntime(modeId, 'p1');
  const { human } = spawnPlayersForMode(scene, world, assets, modeId, { humanId: match.humanId, humanCharacterId: characterId ?? undefined });
  initializeMatchPlayers(world, match);
  const aiStates = new Map<string, AiControllerState>();
  let lastHumanHp = human.hp;

  let nextAirdropTimeSeconds = 18;
  let airdropSerial = 0;
  let navGrid: NavGrid | null = null;
  let nextNavRebuildTimeSeconds = 0;

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
  let frameInteractPressed = false;

  const beginFrame = (_frameDt: number): void => {
    if (input.wasPressed('pause')) {
      paused = !paused;
      audio.playSfx('uiToggle');
    }

    if (input.wasPressed('toggleVisual')) {
      debugEnabled = !debugEnabled;
      arenaDebug.setEnabled(debugEnabled);
      audio.playSfx('uiToggle');
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
    frameInteractPressed = frameInteractPressed || input.wasPressed('interact');
  };

  const step = (fixedDt: number): void => {
    if (paused) {
      dashRequested = false;
      frameFirePressed = false;
      frameFireReleased = false;
      frameReloadPressed = false;
      frameThrowPressed = false;
      frameInteractPressed = false;
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

    const carrierRestricted =
      match.state.modeId === 'ctf' && MODE_CONFIGS.ctf.carrierCanUseWeapons === false && human.carryingFlag !== null;

    const weaponResult = updateWeapons(
      human,
      {
        fireDown: carrierRestricted ? false : input.isDown('fire'),
        firePressed: carrierRestricted ? false : frameFirePressed,
        fireReleased: carrierRestricted ? false : frameFireReleased,
        reloadPressed: carrierRestricted ? false : frameReloadPressed
      },
      aimPoint,
      fixedDt,
      { scene, entities: world.entities, covers: world.covers, projectiles: world.projectiles, rng: world.rng }
    );
    frameFirePressed = false;
    frameFireReleased = false;
    frameReloadPressed = false;
    if (weaponResult.shotsFired > 0) {
      audio.playSfx('weaponFire');
      const weaponId = human.weaponSlots[human.activeWeaponSlot];
      if (weaponId && aimPoint) {
        const muzzle = human.position.clone();
        muzzle.y += 1.1;
        const end = aimPoint.clone();
        end.y = muzzle.y;
        tracers.spawn(muzzle, end, { color: tracerColorForWeapon(weaponId), width: 1, durationSeconds: 0.08 });
      }
    }

    if (frameThrowPressed && !carrierRestricted) {
      tryUseActiveThrowable(human, aimPoint, {
        scene,
        entities: world.entities,
        throwableProjectiles: world.throwableProjectiles,
        smokes: world.smokes,
        areas: world.areas,
        traps: world.traps,
        rng: world.rng
      });
    }
    frameThrowPressed = false;

    if (world.arena && world.timeSeconds >= nextNavRebuildTimeSeconds) {
      navGrid = buildNavGrid(world.arena.bounds, world.covers, { cellSize: 2.1, agentRadius: human.radius });
      nextNavRebuildTimeSeconds = world.timeSeconds + 0.75;
    }

    for (const entity of world.entities) {
      if (!entity.isAI) continue;
      const ai = ensureAiControllerState(aiStates, entity.id, world.rng);
      const aiFrame = computeAiFrame(entity, ai, world, match, difficulty, fixedDt, navGrid, world.rng);
      updateCharacterMovement(entity, aiFrame.moveDir, aiFrame.aimPoint, fixedDt, aiFrame.dashRequested);
      const aiWeaponResult = updateWeapons(entity, aiFrame.weaponInput, aiFrame.aimPoint, fixedDt, { scene, entities: world.entities, covers: world.covers, projectiles: world.projectiles, rng: world.rng });
      if (aiWeaponResult.shotsFired > 0) {
        const weaponId = entity.weaponSlots[entity.activeWeaponSlot];
        if (weaponId && aiFrame.aimPoint) {
          const muzzle = entity.position.clone();
          muzzle.y += 1.1;
          const end = aiFrame.aimPoint.clone();
          end.y = muzzle.y;
          tracers.spawn(muzzle, end, { color: tracerColorForWeapon(weaponId), width: 1, durationSeconds: 0.08 });
        }
      }
      if (aiFrame.throwRequested) {
        tryUseActiveThrowable(entity, aiFrame.throwAimPoint, {
          scene,
          entities: world.entities,
          throwableProjectiles: world.throwableProjectiles,
          smokes: world.smokes,
          areas: world.areas,
          traps: world.traps,
          rng: world.rng
        });
      }
    }

    updateThrowables(
      {
        scene,
        entities: world.entities,
        throwableProjectiles: world.throwableProjectiles,
        smokes: world.smokes,
        areas: world.areas,
        traps: world.traps,
        rng: world.rng
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
    const allowCliffFall = world.arena?.sceneId === 'baidicheng';

    for (const entity of world.entities) {
      if (entity.eliminated) continue;

      if (allowCliffFall) {
        const out =
          entity.position.x < bounds.minX - entity.radius ||
          entity.position.x > bounds.maxX + entity.radius ||
          entity.position.z < bounds.minZ - entity.radius ||
          entity.position.z > bounds.maxZ + entity.radius;
        if (out) {
          entity.hp = 0;
          entity.eliminated = true;
          continue;
        }
      } else {
        clampToBounds(entity.position, bounds, entity.radius);
      }

      for (const cover of world.covers) {
        if (!cover.active) continue;
        const collided = resolveCircleVsAabb(entity.position, entity.radius, cover.aabb);
        if (collided && cover.pushable) {
          const dir = entity.velocity.clone();
          dir.y = 0;
          if (dir.lengthSq() > 1e-6) {
            dir.normalize();
            cover.mesh.position.addScaledVector(dir, 1.2 * fixedDt);
            updateCoverAabb(cover);

            const size = new THREE.Vector3();
            cover.box.getSize(size);
            const halfX = size.x * 0.5;
            const halfZ = size.z * 0.5;
            cover.mesh.position.x = Math.max(bounds.minX + halfX, Math.min(bounds.maxX - halfX, cover.mesh.position.x));
            cover.mesh.position.z = Math.max(bounds.minZ + halfZ, Math.min(bounds.maxZ - halfZ, cover.mesh.position.z));
            updateCoverAabb(cover);
          }
        }
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

    if (match.state.phase === 'playing' && world.timeSeconds >= nextAirdropTimeSeconds) {
      spawnAirdropWeapon(scene, world, airdropSerial);
      airdropSerial += 1;
      nextAirdropTimeSeconds = world.timeSeconds + world.rng.nextRange(25, 35);
      audio.playSfx('airdrop');
    }

    if (frameInteractPressed) {
      const toggled = tryToggleNearestCover(world.covers, human.position);
      if (toggled) audio.playSfx('uiClick');
      frameInteractPressed = false;
    }

    const wind = world.arena?.wind;
    if (wind && wind.lengthSq() > 1e-6) {
      for (const p of world.projectiles) {
        if (p.kind !== 'ballistic' && p.kind !== 'bouncy') continue;
        p.velocity.x += wind.x * fixedDt;
        p.velocity.z += wind.z * fixedDt;
      }
    }

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
          particles.spawnImpact(h.point, { color: tracerColorForWeapon(p.weaponId) });
        }
        if (h.type === 'cover') {
          const ignite = weaponCfg.onHitEffects?.some((eff) => eff.kind === 'status' && eff.id === 'burn') ?? false;
          applyDamageToCover(scene, world.entities, world.covers, h.cover, p.damageAmount, {
            ignite,
            attackerId: p.attackerId,
            attackerTeam: p.attackerTeam,
            rng: world.rng
          });
          particles.spawnImpact(h.point, { color: 0x9aa5b4 });
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
          particles.spawnExplosion(impactPoint, { color: tracerColorForWeapon(p.weaponId), radius: weaponCfg.splash.radiusMeters });
          if (human.position.distanceToSquared(impactPoint) < 10 * 10) audio.playSfx('explosion');
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
    arenaDebug.update(world);
    tracers.update(fixedDt);
    particles.update(fixedDt);

    if (!human.eliminated && human.hp < lastHumanHp - 1e-3) {
      cameraRig.addScreenShake({ durationSeconds: 0.12, intensityMeters: 0.18 });
      cameraRig.pulseFov(2.2, 0.12);
    }
    lastHumanHp = human.hp;

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
    arenaDebug.dispose();
    tracers.dispose();
    particles.dispose();
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
        lastAttackerId: human.lastAttackerId,
        lastWeaponId: human.lastWeaponId,
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
        carryingFlag: e.carryingFlag,
        lastAttackerId: e.lastAttackerId,
        lastWeaponId: e.lastWeaponId
      }))
    };
  };

  const setPaused = (value: boolean): void => {
    paused = value;
  };

  return { renderer, scene, camera, input, assets, audio, beginFrame, step, frame, getUiState, setPaused, dispose };
}

function spawnAirdropWeapon(scene: THREE.Scene, world: World, serial: number): void {
  const bounds = world.arena?.bounds ?? { minX: -10, maxX: 10, minZ: -7, maxZ: 7 };
  const x = bounds.minX + 2 + world.rng.nextFloat() * (bounds.maxX - bounds.minX - 4);
  const z = bounds.minZ + 2 + world.rng.nextFloat() * (bounds.maxZ - bounds.minZ - 4);

  const special: WeaponId[] = ['zhugeRepeater', 'grapplingHook', 'thunderBomb'];
  const weaponId = special[world.rng.nextInt(special.length)] ?? special[0];

  const pickup = createWeaponPickup({ id: `airdrop_${serial}`, weaponId, pos: new THREE.Vector3(x, 0.2, z), color: 0xff6b6b });
  scene.add(pickup.mesh);
  world.pickups.push(pickup);
}

function tryToggleNearestCover(covers: Cover[], pos: THREE.Vector3): boolean {
  let best: { cover: Cover; distSq: number } | null = null;

  for (const cover of covers) {
    if (!cover.toggleable) continue;
    if (!cover.mesh.parent) continue;
    const dx = cover.mesh.position.x - pos.x;
    const dz = cover.mesh.position.z - pos.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > 2.2 * 2.2) continue;
    if (!best || distSq < best.distSq) best = { cover, distSq };
  }

  if (!best) return false;
  best.cover.active = !best.cover.active;
  best.cover.mesh.visible = best.cover.active;
  if (best.cover.active) updateCoverAabb(best.cover);
  return true;
}

function tracerColorForWeapon(weaponId: WeaponId): number {
  const cfg = WEAPON_CONFIGS[weaponId];
  if (cfg.category === 'melee') return 0xbcc6d8;
  if (cfg.category === 'mid') return 0x79d5ff;
  if (cfg.category === 'ranged') return 0xffc44d;
  return 0xff6b6b;
}

function resolveInitialMatchFromUrl(): {
  modeId: ModeId;
  sceneId: SceneId;
  difficultyId: DifficultyId;
  characterId: CharacterId | null;
  seed: number;
} {
  const params = new URLSearchParams(window.location.search);
  const modeRaw = params.get('mode');
  const sceneRaw = params.get('scene');
  const difficultyRaw = params.get('difficulty');
  const characterRaw = params.get('character');
  const seedRaw = params.get('seed');
  const modeId = isModeId(modeRaw) ? modeRaw : 'duel';
  const sceneId = isSceneId(sceneRaw) ? sceneRaw : 'trainingGround';
  const difficultyId = isDifficultyId(difficultyRaw) ? difficultyRaw : 'normal';
  const characterId = isCharacterId(characterRaw) ? characterRaw : null;
  const seed = resolveSeed(seedRaw);
  return { modeId, sceneId, difficultyId, characterId, seed };
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

function resolveSeed(seedRaw: string | null): number {
  if (!seedRaw) return createDefaultSeed();
  const asNumber = Number(seedRaw);
  if (Number.isFinite(asNumber)) return (Math.floor(asNumber) >>> 0) || 0x12345678;
  return hashStringToSeed(seedRaw);
}
