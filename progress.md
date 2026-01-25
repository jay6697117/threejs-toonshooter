# 进度日志

## 2026-01-25
- 创建 planning 文件：`task_plan.md`、`findings.md`、`progress.md`
- 落地可执行行动清单：`docs/plans/2026-01-25-sanguo-shooter-implementation-plan.md`
- 引入 Vite/TS 基线：`package.json`、`tsconfig.json`、`vite.config.ts`
- 配置 Vite multi-page：根 `index.html`（landing）+ `sanguo-shooter/index.html`（新游戏入口）
- 新增 TS 入口：`src/landing/main.ts`、`src/game/main.ts`
- 避免入口冲突：`public/index.html` → `public/landing-legacy.html`
- 路由/构建验收：`npm run build` 产物 `dist/` 可访问 `/`、`/sanguo-shooter/`、`/toonshooter/`、`/assets.json`

- Phase 1（core runtime）placeholder 骨架：
  - 输入：`src/game/core/input.ts`
  - 相机：`src/game/core/camera.ts`
  - 资源：`src/game/core/assets.ts`
  - 设置：`src/game/core/storage.ts`
  - 音频：`src/game/core/audio.ts`
  - 固定步长循环：`src/game/core/loop.ts`
  - app 粘合：`src/game/app/createSanguoShooterApp.ts`

- Phase 2（world/entities/collision/pickups）第一版可玩骨架：
  - 数值：`src/game/config/game.ts`
  - 鼠标地面拾取：`src/game/core/picking.ts`
  - 碰撞：`src/game/combat/collision.ts`
  - 玩家移动+dash：`src/game/entities/player.ts`
  - 掩体：`src/game/arena/cover.ts`
  - 拾取：`src/game/arena/pickups.ts`（3-slot 主武器 + 2-slot 副武器）
  - 交互框架：`src/game/arena/interactables.ts`

- Phase 3（combat foundation）补齐关键缺口：
  - hitscan：`src/game/combat/raycast.ts` 增加 multi-hit（穿透）
  - projectile：`src/game/weapons/projectile.ts` 增加 returning/bouncy/grapple 行为与移除策略
  - AOE：`src/game/combat/areaDamage.ts` 支持爆炸附带状态效果（用于 `fireArrow` / `siegeCrossbow` / `thunderBomb`）

- Phase 4（weapons）first playable pass：
  - 武器运行时：`src/game/weapons/weaponState.ts` + `src/game/weapons/weaponManager.ts`（弹药/换弹/蓄力/冷却 + `burstAll`）
  - 发射链路：`src/game/weapons/fireWeapon.ts`（pellets、doubleShot、penetrate、charge damage/range、projectile damage snapshot）
  - 特殊机制落地：
    - `siegeCrossbow`：命中生成临时障碍（`Cover.timeLeftSeconds`）
    - `grapplingHook`：命中触发机动位移（复用 dash）
    - `boomerangBlade`：返回并限制同一目标命中次数

- Phase 5（throwables）first playable pass：
  - 运行时：`src/game/throwables/throwableManager.ts` + `src/game/throwables/types.ts`（投掷/放置、延迟爆炸、烟雾/毒雾、陷阱触发、持续区域）
  - World 集成：`src/game/core/world.ts` 增加 `throwableProjectiles/smokes/areas/traps`
  - 输入接入：`src/game/app/createSanguoShooterApp.ts`（右键循环副武器槽，`G` 使用）

- 行动清单回写：
  - `docs/plans/2026-01-25-sanguo-shooter-implementation-plan.md` 已更新 Phase 0-5 的勾选状态
  - `docs/plans/行动清单.md` 标记为 legacy 参考（以 Vite/TS 版清单为准）

- Phase 6-9（场景/模式/AI/UI）补齐（placeholder but verifiable）：
  - 10 场景 placeholder defs：`src/game/arena/sceneDefinitions.ts`
  - 场景运行时与机制：`src/game/arena/arenaManager.ts`（zones / wind / global dark / lightning / trap）
  - 掩体扩展：`src/game/arena/cover.ts`（pushable/toggleable/climbable/blocksProjectiles/onDestroyedSpawnCover）
  - 调试可视化：`src/game/debug/arenaDebug.ts`（covers AABB / spawns / objectives）
  - 模式与胜负：`src/game/modes/modeManager.ts` + `src/game/modes/spawnPlayers.ts`（duel/ffa/siege/ctf、AI fill、respawn/score）
  - AI：`src/game/entities/aiController.ts` + `src/game/ai/**` + `src/game/arena/navGraph.ts`（A*、目标、投掷物占位策略）
  - UI：`src/game/ui/index.ts` + `src/game/ui/hud.ts` + `src/game/ui/menu.ts` + `src/game/ui/overlays.ts`

- Phase 10（VFX/SFX）反馈链补齐：
  - Tracers：`src/game/fx/tracers.ts`（weapon styles + cap + pool）
  - Particles：`src/game/fx/particles.ts`（explosion/smoke/fire/poison/petals + cap + pool）
  - Screen FX：`src/game/fx/screenFx.ts`（near-miss/slowmo overlay + hit/vignette + blind blur）
  - Audio：`src/game/core/audio.ts` + `src/game/audio/sfxMap.ts`（weapon/impact/nearMiss/slowmo）
  - Slowmo/Hitstop（step-based timeScale）：`src/game/core/loop.ts` + `src/game/app/createSanguoShooterApp.ts`

- Phase 11（Content Assets）部分接入：
  - `public/assets.json` 增加 `sanguoShooter` 命名空间（复用 toonshooter glTF 作 placeholder）
  - per-scene preload groups：`src/game/arena/sceneDefinitions.ts` + `src/game/arena/arenaManager.ts`
  - 角色 glTF placeholder 替换：`src/game/modes/spawnPlayers.ts`

- Phase 11（Content Assets）补齐：
  - 角色骨骼与动画共享：`src/game/fx/characterAnimations.ts` + `src/game/app/createSanguoShooterApp.ts`（step-based 更新）
  - 场景资产替换与碰撞校准：`src/game/arena/sceneDefinitions.ts`（cover 绑定 env glTF）+ `src/game/arena/arenaManager.ts`（异步替换 + `updateCoverAabb`）

- Phase 12（验证/回归/性能）补齐：
  - seedable RNG：`src/game/core/rng.ts` + 全局替换 `Math.random`（除纯视觉 shake）
  - record/replay：`src/game/replay/replay.ts` + `src/game/core/stepInput.ts`
  - 单测：`test/*.test.ts`（通过 `node --test --import tsx`）
  - perf budget：对象池/上限/卸载释放：`src/game/fx/*` + `src/game/core/dispose.ts` + `src/game/arena/arenaManager.ts` + `src/game/entities/aiController.ts`
  - projectile mesh pool：`src/game/weapons/projectile.ts`（`acquire/release/dispose`）+ `src/game/weapons/fireWeapon.ts` + `src/game/app/createSanguoShooterApp.ts`
  - weapons wall（smoke）：`/sanguo-shooter/?weaponsWall=1`
  - Vercel smoke checklist：`docs/plans/2026-01-25-sanguo-shooter-implementation-plan.md`

## 未完成项（待推进）
- 无（清单项已全部勾选）
