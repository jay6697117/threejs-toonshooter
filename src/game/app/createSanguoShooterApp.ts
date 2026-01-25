import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createBoxCover, updateCoverAabb, type Cover } from '../arena/cover';
import { createWeaponPickup, updatePickups } from '../arena/pickups';
import { clearArena, loadArena, updateArena } from '../arena/arenaManager';
import { buildNavGrid, type NavGrid } from '../arena/navGraph';
import { applyExplosion } from '../combat/areaDamage';
import { clampToBounds, resolveCircleVsAabb, resolveCircleVsCircle } from '../combat/collision';
import { applyDamageToCover } from '../combat/coverDamage';
import { dealDamage } from '../combat/damage';
import { updateStatusEffects } from '../combat/statusEffects';
import { DIFFICULTY_CONFIGS, DIFFICULTY_IDS, type DifficultyId } from '../config/difficulty';
import { GAME_CONFIG } from '../config/game';
import { MODE_CONFIGS } from '../config/modes';
import { CHARACTER_IDS, MODE_IDS, SCENE_IDS, WEAPON_IDS, type CharacterId, type ModeId, type SceneId, type WeaponId } from '../config/ids';
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
import { createStepInputBuffer } from '../core/stepInput';
import { disposeObject3D } from '../core/dispose';
import { createReplayPlayer, createReplayRecorder, loadReplayFromStorage, saveReplayToStorage } from '../replay/replay';
import { createArenaDebug } from '../debug/arenaDebug';
import { createTracerSystem, getTracerStyleForWeapon } from '../fx/tracers';
import { createParticleSystem } from '../fx/particles';
import { createCharacterAnimationSystem } from '../fx/characterAnimations';
import { syncVisual } from '../entities/entityBase';
import { updatePlayer } from '../entities/player';
import { updateCharacterMovement } from '../entities/movement';
import { ensureAiControllerState, computeAiFrameThrottled, type AiControllerState } from '../entities/aiController';
import { createMatchRuntime, initializeMatchPlayers, processDeaths, updateMatch, applyRespawns } from '../modes/modeManager';
import { spawnPlayersForMode } from '../modes/spawnPlayers';
import { applyWeaponHitToEntity } from '../weapons/fireWeapon';
import { disposeProjectileMeshPool, releaseProjectileMesh, type Projectile, updateProjectiles } from '../weapons/projectile';
import { updateWeapons } from '../weapons/weaponManager';
import { cycleActiveThrowableSlot, tryUseActiveThrowable, updateThrowables, type ThrowablesFxEvent } from '../throwables/throwableManager';
import type { SanguoShooterUiState } from './uiState';

export type SanguoShooterApp = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  input: InputManager;
  assets: Assets;
  audio: AudioManager;
  getTimeScale: () => number;
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

  // Disable default antialias as we might use post-processing (though FXAA/SMAA would be better, relying on high DPR for now)
  const renderer = createRenderer(canvas, { maxDpr: settings.graphics.maxDpr, shadows: settings.graphics.shadows });

  // Post-processing setup
  const composer = new EffectComposer(renderer);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f1c);
  scene.fog = new THREE.FogExp2(0x0b0f1c, 0.02); // Add atmosphere

  const cameraRig = new CameraRig({
    fov: 50,
    near: 0.1,
    far: 200,
    offset: new THREE.Vector3(0, 4.2, 6.8),
    lookAtOffset: new THREE.Vector3(0, 0.9, 0)
  });
  const camera = cameraRig.camera;

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  bloomPass.threshold = 0.8; // Only very bright things glow
  bloomPass.strength = 1.2;
  bloomPass.radius = 0.5;
  composer.addPass(bloomPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  const urlMatch = resolveInitialMatchFromUrl();
  const replayMode = resolveReplayModeFromUrl();
  const debugWeaponsWall = resolveDebugWeaponsWallFromUrl();
  const replayData = replayMode === 'play' ? loadReplayFromStorage() : null;
  const effectiveMatch = replayData
    ? {
        modeId: replayData.modeId,
        sceneId: replayData.sceneId,
        difficultyId: replayData.difficultyId,
        characterId: replayData.characterId,
        seed: replayData.seed
      }
    : urlMatch;
  const world = createWorld(scene, { seed: effectiveMatch.seed });
  const arenaDebug = createArenaDebug(scene);
  let debugEnabled = false;
  const tracers = createTracerSystem(scene);
  const particles = createParticleSystem(scene);
  const characterAnimations = createCharacterAnimationSystem();
  const stepInput = createStepInputBuffer();
  const replayRecorder = replayMode === 'record' ? createReplayRecorder() : null;
  const replayPlayer = replayMode === 'play' && replayData ? createReplayPlayer(replayData) : null;
  let replaySaved = false;
  let replayFinished = false;

  const ambient = new THREE.AmbientLight(0xffffff, 0.6); // Increased ambient for perception
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xffeeb1, 0x080820, 0.8); // Warm sky, dark ground
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xfff2d6, 1.5); // Stronger key light
  dir.position.set(8, 12, 5);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048); // Higher quality shadows
  dir.shadow.bias = -0.0005;
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 40;
  dir.shadow.camera.left = -14;
  dir.shadow.camera.right = 14;
  dir.shadow.camera.top = 14;
  dir.shadow.camera.bottom = -14;
  scene.add(dir);

  if (!replayData) {
    ensureSeedInUrl(world.seed);
  }

  const difficulty = DIFFICULTY_CONFIGS[effectiveMatch.difficultyId];
  const arenaScale = effectiveMatch.modeId === 'ffa' ? MODE_CONFIGS.ffa.arenaScale : 1;
  loadArena(scene, world, effectiveMatch.modeId, effectiveMatch.sceneId, { arenaScale, assets });

  const match = createMatchRuntime(effectiveMatch.modeId, 'p1');
  const { human } = spawnPlayersForMode(scene, world, assets, effectiveMatch.modeId, { humanId: match.humanId, humanCharacterId: effectiveMatch.characterId ?? undefined });
  initializeMatchPlayers(world, match);
  if (debugWeaponsWall && !replayPlayer) {
    spawnWeaponWall(scene, world);
  }
  const aiStates = new Map<string, AiControllerState>();
  let lastHumanHp = human.hp;
  let lastMatchPhase: 'playing' | 'ended' = match.state.phase;
  let lastHumanKills = human.kills;
  let lastHumanDeaths = human.deaths;

  const HITSTOP_STEPS = 6;
  const HITSTOP_SCALE = 0;
  const SLOWMO_STEPS_ON_KILL = 22;
  const SLOWMO_STEPS_ON_DEATH = 26;
  const SLOWMO_SCALE = 0.35;
  const NEAR_MISS_THRESHOLD_METERS = 0.85;
  const NEAR_MISS_COOLDOWN_STEPS = 10;

  let hitstopStepsLeft = 0;
  let slowmoStepsLeft = 0;
  let currentTimeScale = 1;
  let nearMissAmount = 0;
  let nearMissCooldownStepsLeft = 0;

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

  const emitThrowableFx = (event: ThrowablesFxEvent): void => {
    const distSq = human.position.distanceToSquared(event.pos);
    const audible = distSq < 12 * 12;

    if (event.type === 'explosion') {
      particles.spawnExplosion(event.pos, { radius: event.radius });
      if (audible) audio.playSfx('explosion');
      return;
    }

    if (event.type === 'smoke') {
      if (event.smokeType === 'poison') particles.spawnPoison(event.pos, { radius: event.radius * 0.35 });
      else particles.spawnSmoke(event.pos, { radius: event.radius * 0.35 });
      if (audible) audio.playSfx('smoke');
      return;
    }

    if (event.type === 'area') {
      particles.spawnSmoke(event.pos, { radius: event.radius * 0.25 });
      return;
    }

    if (event.type === 'areaIgnite') {
      particles.spawnFire(event.pos, { radius: event.radius * 0.3 });
      if (audible) audio.playSfx('explosion');
      return;
    }

    if (event.type === 'trapTrigger') {
      particles.spawnImpact(event.pos, { color: 0xff6b6b });
      if (audible) audio.playSfx('trapTrigger');
    }
  };

  const getTimeScale = (): number => currentTimeScale;

  const beginFrame = (_frameDt: number): void => {
    if (replayPlayer) return;

    const pointer = input.getPointerNdc();
    const hit = pointer.insideCanvas ? picker.pick(camera, pointer.x, pointer.y) : null;
    const aimPoint = hit?.point ?? null;
    stepInput.setFromSnapshot(input.snapshot(), aimPoint);
  };

  const step = (dt: number): void => {
    const stepIndex = world.stepIndex;
    world.stepIndex += 1;

    if (replayPlayer) {
      stepInput.setFromReplayStep(replayPlayer.getStepState(stepIndex));
      if (!replayFinished && replayPlayer.isEnded(stepIndex)) {
        replayFinished = true;
        paused = true;
      }
    }

    if (replayRecorder) {
      replayRecorder.captureStep(stepIndex, {
        down: stepInput.getDownMap(),
        pressed: stepInput.getPressedMap(),
        released: stepInput.getReleasedMap(),
        aimPoint: stepInput.getAimPoint()
      });
    }

    if (stepInput.consumePressed('pause')) {
      paused = !paused;
      audio.playSfx('uiToggle');
    }

    if (stepInput.consumePressed('toggleVisual')) {
      debugEnabled = !debugEnabled;
      arenaDebug.setEnabled(debugEnabled);
      audio.playSfx('uiToggle');
    }

    if (paused) {
      void stepInput.consumePressed('dash');
      void stepInput.consumePressed('weaponSlot1');
      void stepInput.consumePressed('weaponSlot2');
      void stepInput.consumePressed('weaponSlot3');
      void stepInput.consumePressed('aimSecondary');
      void stepInput.consumePressed('reload');
      void stepInput.consumePressed('throw');
      void stepInput.consumePressed('interact');
      void stepInput.consumePressed('fire');
      void stepInput.consumeReleased('fire');
      stepInput.endStep();
      return;
    }
    if (currentTimeScale === HITSTOP_SCALE && hitstopStepsLeft > 0) hitstopStepsLeft = Math.max(0, hitstopStepsLeft - 1);
    if (currentTimeScale === SLOWMO_SCALE && slowmoStepsLeft > 0) slowmoStepsLeft = Math.max(0, slowmoStepsLeft - 1);
    if (nearMissCooldownStepsLeft > 0) nearMissCooldownStepsLeft = Math.max(0, nearMissCooldownStepsLeft - 1);
    nearMissAmount = Math.max(0, nearMissAmount - dt * 2.0);

    world.timeSeconds += dt;

    for (const entity of world.entities) {
      if (entity.eliminated) continue;
      updateStatusEffects(entity, dt, (amount) => dealDamage(entity, amount, { isDot: true }));
    }

    if (stepInput.consumePressed('weaponSlot1')) human.activeWeaponSlot = 0;
    if (stepInput.consumePressed('weaponSlot2')) human.activeWeaponSlot = 1;
    if (stepInput.consumePressed('weaponSlot3')) human.activeWeaponSlot = 2;
    if (stepInput.consumePressed('aimSecondary')) cycleActiveThrowableSlot(human);

    const aimPoint = stepInput.getAimPoint();
    const dashRequested = stepInput.consumePressed('dash');
    updatePlayer(human, stepInput, aimPoint, dt, dashRequested);

    const carrierRestricted =
      match.state.modeId === 'ctf' && MODE_CONFIGS.ctf.carrierCanUseWeapons === false && human.carryingFlag !== null;

    const weaponResult = updateWeapons(
      human,
      {
        fireDown: carrierRestricted ? false : stepInput.isDown('fire'),
        firePressed: carrierRestricted ? false : stepInput.consumePressed('fire'),
        fireReleased: carrierRestricted ? false : stepInput.consumeReleased('fire'),
        reloadPressed: carrierRestricted ? false : stepInput.consumePressed('reload')
      },
      aimPoint,
      dt,
      { scene, entities: world.entities, covers: world.covers, projectiles: world.projectiles, rng: world.rng }
    );
    if (weaponResult.shotsFired > 0) {
      audio.playSfx('weaponFire');
      const weaponId = human.weaponSlots[human.activeWeaponSlot];
      if (weaponId) {
        const muzzle = human.position.clone();
        muzzle.y += 1.1;
        const style = getTracerStyleForWeapon(weaponId);
        for (const result of weaponResult.fireResults) {
          if (result.type !== 'hitscan') continue;
          tracers.spawn(muzzle, result.tracerEnd, style);
          if (result.impactPoint) {
            particles.spawnImpact(result.impactPoint, { color: style.color });
            if (result.hit === 'entity') audio.playSfx('weaponHit');
            if (result.hit === 'cover') audio.playSfx('weaponImpact');
          }
        }
      }
    }

    if (stepInput.consumePressed('throw') && !carrierRestricted) {
      const used = tryUseActiveThrowable(human, aimPoint, {
        scene,
        entities: world.entities,
        throwableProjectiles: world.throwableProjectiles,
        smokes: world.smokes,
        areas: world.areas,
        traps: world.traps,
        rng: world.rng,
        emitFx: emitThrowableFx
      });
      if (used) audio.playSfx('throw');
    }

    if (world.arena && world.timeSeconds >= nextNavRebuildTimeSeconds) {
      navGrid = buildNavGrid(world.arena.bounds, world.covers, { cellSize: 2.1, agentRadius: human.radius });
      nextNavRebuildTimeSeconds = world.timeSeconds + 0.75;
    }

    for (const entity of world.entities) {
      if (!entity.isAI) continue;
      const ai = ensureAiControllerState(aiStates, entity.id, world.rng);
      const weaponId = entity.weaponSlots[entity.activeWeaponSlot];
      const thinkIntervalSteps = weaponId && WEAPON_CONFIGS[weaponId].charge ? 1 : difficulty.aiThinkIntervalSteps;
      const aiFrame = computeAiFrameThrottled(entity, ai, world, match, difficulty, dt, navGrid, world.rng, { stepIndex, thinkIntervalSteps });
      updateCharacterMovement(entity, aiFrame.moveDir, aiFrame.aimPoint, dt, aiFrame.dashRequested);
      const aiWeaponResult = updateWeapons(entity, aiFrame.weaponInput, aiFrame.aimPoint, dt, {
        scene,
        entities: world.entities,
        covers: world.covers,
        projectiles: world.projectiles,
        rng: world.rng
      });
      if (aiWeaponResult.shotsFired > 0) {
        if (weaponId) {
          const muzzle = entity.position.clone();
          muzzle.y += 1.1;
          const style = getTracerStyleForWeapon(weaponId);

          for (const result of aiWeaponResult.fireResults) {
            if (result.type !== 'hitscan') continue;
            tracers.spawn(muzzle, result.tracerEnd, style);

            if (!human.eliminated && entity.team !== human.team) {
              const distSq = distanceSqPointToSegmentXZ(human.position, muzzle, result.tracerEnd);
              if (distSq <= NEAR_MISS_THRESHOLD_METERS * NEAR_MISS_THRESHOLD_METERS) {
                const dist = Math.sqrt(distSq);
                const intensity = 1 - dist / Math.max(1e-6, NEAR_MISS_THRESHOLD_METERS);
                nearMissAmount = Math.min(1, nearMissAmount + intensity * 0.7);
                if (nearMissCooldownStepsLeft <= 0) {
                  audio.playSfx('nearMiss');
                  nearMissCooldownStepsLeft = NEAR_MISS_COOLDOWN_STEPS;
                }
              }
            }
          }
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
          rng: world.rng,
          emitFx: emitThrowableFx
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
        rng: world.rng,
        emitFx: emitThrowableFx
      },
      dt,
      world.timeSeconds
    );

    updateArena(world, dt);

    for (const cover of world.covers) {
      if (!cover.active) continue;
      if (cover.timeLeftSeconds === undefined) continue;
      cover.timeLeftSeconds = Math.max(0, cover.timeLeftSeconds - dt);
      if (cover.timeLeftSeconds <= 0) {
        cover.active = false;
        scene.remove(cover.mesh);
        disposeObject3D(cover.mesh);
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
            cover.mesh.position.addScaledVector(dir, 1.2 * dt);
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

    updatePickups(world.pickups, world.entities, dt, world.timeSeconds);

    if (match.state.phase === 'playing' && world.timeSeconds >= nextAirdropTimeSeconds) {
      spawnAirdropWeapon(scene, world, airdropSerial);
      airdropSerial += 1;
      nextAirdropTimeSeconds = world.timeSeconds + world.rng.nextRange(25, 35);
      audio.playSfx('airdrop');
    }

    if (stepInput.consumePressed('interact')) {
      const toggled = tryToggleNearestCover(world.covers, human.position);
      if (toggled) {
        audio.playSfx('uiClick');
      } else {
        const climbed = tryClimbNearestCover(world.covers, bounds, human);
        if (climbed) audio.playSfx('uiClick');
      }
    }

    const wind = world.arena?.wind;
    if (wind && wind.lengthSq() > 1e-6) {
      for (const p of world.projectiles) {
        if (p.kind !== 'ballistic' && p.kind !== 'bouncy') continue;
        p.velocity.x += wind.x * dt;
        p.velocity.z += wind.z * dt;
      }
    }

    const projUpdates = updateProjectiles(world.projectiles, world.entities, world.covers, dt);
    const remaining: Projectile[] = [];
    for (const u of projUpdates) {
      const { projectile: p, hit: h, remove } = u;
      if (!h && !remove) {
        remaining.push(p);
        continue;
      }

      const weaponCfg = WEAPON_CONFIGS[p.weaponId];
      const weaponStyle = getTracerStyleForWeapon(p.weaponId);

      if (h) {
        const attacker = world.entities.find((e) => e.id === p.attackerId) ?? human;
        const dir = p.velocity.clone();
        if (dir.lengthSq() > 1e-6) dir.normalize();

        if (h.type === 'entity') {
          applyWeaponHitToEntity(attacker, p.weaponId, h.entity, dir, { damageAmount: p.damageAmount });
          particles.spawnImpact(h.point, { color: weaponStyle.color });
          if (human.position.distanceToSquared(h.point) < 10 * 10) audio.playSfx('weaponHit');
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
          if (human.position.distanceToSquared(h.point) < 10 * 10) audio.playSfx('weaponImpact');
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
          particles.spawnExplosion(impactPoint, { color: weaponStyle.color, radius: weaponCfg.splash.radiusMeters });
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
        releaseProjectileMesh(p.mesh);
      } else {
        remaining.push(p);
      }
    }
    world.projectiles = remaining;

    processDeaths(world, match);
    updateMatch(world, match, dt);
    applyRespawns(world, match, dt);
    arenaDebug.update(world);
    tracers.update(dt);
    particles.update(dt);
    characterAnimations.update(world.entities, dt);

    if (!human.eliminated && human.hp < lastHumanHp - 1e-3) {
      cameraRig.addScreenShake({ durationSeconds: 0.12, intensityMeters: 0.18 });
      cameraRig.pulseFov(2.2, 0.12);
      hitstopStepsLeft = Math.max(hitstopStepsLeft, HITSTOP_STEPS);
    }
    lastHumanHp = human.hp;

    if (human.kills > lastHumanKills) {
      slowmoStepsLeft = Math.max(slowmoStepsLeft, SLOWMO_STEPS_ON_KILL);
    }
    if (human.deaths > lastHumanDeaths) {
      slowmoStepsLeft = Math.max(slowmoStepsLeft, SLOWMO_STEPS_ON_DEATH);
    }
    lastHumanKills = human.kills;
    lastHumanDeaths = human.deaths;

    cameraRig.setTargetPosition(human.position);
    cameraRig.update(dt);

    const nextTimeScale = hitstopStepsLeft > 0 ? HITSTOP_SCALE : slowmoStepsLeft > 0 ? SLOWMO_SCALE : 1;
    if (currentTimeScale >= 0.999 && nextTimeScale < 0.999 && nextTimeScale > 0) audio.playSfx('slowmo');
    currentTimeScale = nextTimeScale;

    if (replayRecorder && !replaySaved && lastMatchPhase !== 'ended' && match.state.phase === 'ended') {
      const data = replayRecorder.finalize(stepIndex, {
        modeId: effectiveMatch.modeId,
        sceneId: effectiveMatch.sceneId,
        difficultyId: effectiveMatch.difficultyId,
        characterId: effectiveMatch.characterId,
        seed: world.seed,
        fixedDt: dt
      });
      saveReplayToStorage(data);
      replaySaved = true;
      audio.playSfx('matchEnd');
    }
    lastMatchPhase = match.state.phase;
    stepInput.endStep();
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
      composer.setSize(clientWidth, clientHeight);
    }

    composer.render();
    input.endFrame();
  };

  const dispose = (): void => {
    clearArena(scene, world);
    arenaDebug.dispose();
    tracers.dispose();
    particles.dispose();
    characterAnimations.dispose();
    disposeProjectileMeshPool();
    input.dispose();
    renderer.dispose();
    saveSettings(settings);
  };

  const getUiState = (): SanguoShooterUiState => {
    const activeWeaponId = human.weaponSlots[human.activeWeaponSlot] ?? null;
    const activeWeaponState = human.weaponSlotStates[human.activeWeaponSlot];
    const activeThrowable = human.throwableSlots[human.activeThrowableSlot];

    return {
      modeId: match.modeId,
      sceneId: world.arena?.sceneId ?? effectiveMatch.sceneId,
      difficultyId: effectiveMatch.difficultyId,
      seed: world.seed,
      timeScale: currentTimeScale,
      nearMissAmount,
      paused,
      scoreboardHeld: stepInput.isDown('scoreboard'),
      match: match.state,
      timeSeconds: world.timeSeconds,
      stepIndex: world.stepIndex,
      replay: replayPlayer
        ? { mode: 'play', endStepIndex: replayPlayer.replay.endStepIndex }
        : replayRecorder
          ? { mode: 'record', endStepIndex: null }
          : { mode: 'none', endStepIndex: null },
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
        characterId: effectiveMatch.characterId,
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

  return { renderer, scene, camera, input, assets, audio, getTimeScale, beginFrame, step, frame, getUiState, setPaused, dispose };
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

function spawnWeaponWall(scene: THREE.Scene, world: World): void {
  if (!world.arena) return;
  const bounds = world.arena.bounds;
  const z = bounds.maxZ - 1.1;
  const spacing = 1.3;
  const startX = -((WEAPON_IDS.length - 1) * spacing) / 2;

  for (let i = 0; i < WEAPON_IDS.length; i += 1) {
    const weaponId = WEAPON_IDS[i];
    const x = startX + i * spacing;
    const id = `debug_weapon_${weaponId}`;
    const pickup = createWeaponPickup({ id, weaponId, pos: new THREE.Vector3(x, 0.2, z), color: 0x79d5ff });
    scene.add(pickup.mesh);
    world.pickups.push(pickup);
  }
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

function tryClimbNearestCover(
  covers: Cover[],
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  entity: { position: THREE.Vector3; radius: number; velocity: THREE.Vector3 }
): boolean {
  let best: { cover: Cover; distSq: number } | null = null;

  for (const cover of covers) {
    if (!cover.climbable) continue;
    if (!cover.active) continue;
    if (!cover.mesh.parent) continue;
    const dx = cover.mesh.position.x - entity.position.x;
    const dz = cover.mesh.position.z - entity.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > 2.0 * 2.0) continue;
    if (!best || distSq < best.distSq) best = { cover, distSq };
  }

  if (!best) return false;

  const aabb = best.cover.aabb;
  const margin = 0.25;
  const radius = entity.radius;

  const dLeft = Math.abs(entity.position.x - aabb.minX);
  const dRight = Math.abs(aabb.maxX - entity.position.x);
  const dBottom = Math.abs(entity.position.z - aabb.minZ);
  const dTop = Math.abs(aabb.maxZ - entity.position.z);

  let targetX = entity.position.x;
  let targetZ = entity.position.z;

  const min = Math.min(dLeft, dRight, dBottom, dTop);
  if (min === dLeft) {
    targetX = aabb.maxX + radius + margin;
    targetZ = Math.max(aabb.minZ - radius, Math.min(aabb.maxZ + radius, entity.position.z));
  } else if (min === dRight) {
    targetX = aabb.minX - radius - margin;
    targetZ = Math.max(aabb.minZ - radius, Math.min(aabb.maxZ + radius, entity.position.z));
  } else if (min === dBottom) {
    targetZ = aabb.maxZ + radius + margin;
    targetX = Math.max(aabb.minX - radius, Math.min(aabb.maxX + radius, entity.position.x));
  } else {
    targetZ = aabb.minZ - radius - margin;
    targetX = Math.max(aabb.minX - radius, Math.min(aabb.maxX + radius, entity.position.x));
  }

  entity.position.x = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, targetX));
  entity.position.z = Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, targetZ));
  entity.velocity.x = 0;
  entity.velocity.z = 0;
  return true;
}

function distanceSqPointToSegmentXZ(point: THREE.Vector3, segStart: THREE.Vector3, segEnd: THREE.Vector3): number {
  const ax = segStart.x;
  const az = segStart.z;
  const bx = segEnd.x;
  const bz = segEnd.z;
  const px = point.x;
  const pz = point.z;

  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const abLenSq = abx * abx + abz * abz;
  if (abLenSq <= 1e-8) return apx * apx + apz * apz;

  const t = Math.max(0, Math.min(1, (apx * abx + apz * abz) / abLenSq));
  const cx = ax + abx * t;
  const cz = az + abz * t;
  const dx = px - cx;
  const dz = pz - cz;
  return dx * dx + dz * dz;
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

function resolveReplayModeFromUrl(): 'none' | 'record' | 'play' {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('replay');
  if (raw === 'record') return 'record';
  if (raw === 'play') return 'play';
  return 'none';
}

function resolveDebugWeaponsWallFromUrl(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('weaponsWall') === '1';
}

function ensureSeedInUrl(seed: number): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get('seed')) return;
  url.searchParams.set('seed', String(seed >>> 0));
  window.history.replaceState({}, '', url.toString());
}
