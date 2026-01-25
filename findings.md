# 调研记录

## 仓库现状（引入 Vite 前）
- 静态托管结构：`public/` 下的内容可直接部署。
- legacy 可玩原型：`public/toonshooter/index.html`（单文件 Three.js app，importmap + CDN）。
- 资产清单：`public/assets.json` 提供 `assets/toonshooter/**` 路径。
- Vercel 配置：`vercel.json` 原本指向 `outputDirectory: public`，并对 `/assets/**` 下发长缓存。

## 已确认并执行的关键约束
- 从 Day 1 使用 `Vite + TypeScript`（`strict`）。
- 保持 legacy 原型可访问（不重构/不重写 `public/toonshooter/`）。
- 允许 placeholder-first：先保证玩法逻辑完整，再逐步替换最终 glTF 资产。
- 组队模式默认输入假设：`1 human + AI fill`。

## 工程层面的直接影响
- `public/index.html` 会与 Vite 的根 `index.html` 约定冲突：需要移动或重命名。
- 需要 multi-page build 同时承载：
  - landing：`/`
  - 新游戏：`/sanguo-shooter/`
  - legacy 原型：`/toonshooter/`（静态复制自 `public/`）
- 可执行行动清单：`docs/plans/2026-01-25-sanguo-shooter-implementation-plan.md`。

## 清单验收（2026-01-25）
- Phase 0：已完成（Vite + TS、多入口、保留 legacy、build+preview 路由 OK）。
- Phase 1-4：已完成 first playable pass（core runtime、world/entities、combat 基础、15 武器第一版）。
- Phase 5：已完成 first playable pass（9 throwables + smoke/poison/areas/traps）。
- Phase 6：部分完成（10 场景 defs + 场景事件/区域 + debug；仍缺 `climbable` 与 per-scene preload groups）。
- Phase 7-9：已完成（4 modes + AI（含 nav/A*）+ UI/HUD/overlays）。
- Phase 10-12：仍待推进（更完整 VFX/SFX、`assets.json` 扩展与资产替换、seedable RNG+replay、单测、性能预算）。
- 配置基线已固化并在启动时校验：
  - IDs: `src/game/config/ids.ts`
  - Weapons: `src/game/config/weapons.ts`
  - Throwables: `src/game/config/throwables.ts`
  - Scenes: `src/game/config/scenes.ts`
  - Modes: `src/game/config/modes.ts`
  - Status effects: `src/game/config/statusEffects.ts`
  - Validation: `src/game/config/validate.ts`
