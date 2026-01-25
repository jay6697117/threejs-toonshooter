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
