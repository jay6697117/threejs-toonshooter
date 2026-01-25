# 三国卡通射击对战（Sanguo Shooter）- 实施计划（Vite + TypeScript）

## 目标
在保持“纯静态可部署（Vercel/任意静态托管）”的前提下，将 `docs/plans/2026-01-25-sanguo-shooter-design.md` 的完整功能（非 MVP 裁剪）落地为 **可长期维护** 的模块化工程：
- 15 种主武器
- 9 种副武器/投掷物
- 10 个场景（含场景机制与可互动掩体）
- 12 个武将（纯外观差异）
- 4 种模式（duel/ffa/siege/ctf）
- 8 种核心状态效果（并补齐陷阱所需控制态）

## 关键约束 / 已确认决策
- 工程：一开始引入 `Vite + TypeScript`，`tsconfig` 采用 `strict`。
- 模式：组队模式（`siege`/`ctf`）默认 `1 human player + AI fill`。
- 资产：允许 “placeholder（逻辑完整）→ 最终 glTF 替换” 的交付节奏。
- 交互语言：所有交互/说明使用中文；代码/标识符/字符串/注释使用 English。

## 当前阶段（Phase 0）
把工程跑通并固化架构边界，确保后续扩展不会反复推翻基础设施。

### Phase 0 - Checklist
- [x] 新增 Vite/TS 工程文件：`package.json`、`vite.config.ts`、`tsconfig.json` 等
- [x] 迁移/改造入口：根 `index.html` 作为 landing；新增 `sanguo-shooter/index.html` 作为新游戏入口（multi-page build）
- [x] 保留 legacy：`public/toonshooter/` 继续作为静态可访问的旧原型（不参与 Vite 构建）
- [x] 建立 `src/game/**` 模块骨架：core/entities/weapons/throwables/arena/combat/fx/ui/modes
- [x] 固化“数据驱动”基础：ID 类型 + 配置 Schema + 运行时校验入口
- [x] 最小可运行：新入口能在浏览器打开、渲染 Three.js 场景、响应 resize、主循环稳定运行

## 当前阶段（Phase 1）
核心运行时（渲染/相机/输入/循环/资源/存档/音频）落地为可扩展模块。

### Phase 1 - Checklist
- [x] `core/renderer.ts`：DPR 限制、色彩空间、阴影、Resize、性能开关（可配置）
- [x] `core/camera.ts`：俯视跟随骨架、screen shake、FOV pulse 接口
- [x] `core/input.ts`：键位映射 + justPressed/justReleased
- [x] `core/loop.ts`：fixed timestep + render interpolation（已支持 `onBeginFrame` 钩子）
- [x] `core/assets.ts`：manifest 加载 + GLTF cache/clone + placeholder mesh
- [x] `core/storage.ts`：设置版本化 + defaults + clamp
- [x] `core/audio.ts`：WebAudio unlock + buses + placeholder beep

## 当前阶段（Phase 2）
世界与实体（移动/碰撞/拾取/基础交互）落地为“可玩”的基础。

### Phase 2 - Checklist
- [x] `core/world.ts`：世界容器 + 统一 update 顺序（entities/cover/projectiles/throwables/fx）
- [x] `entities/entityBase.ts`：实体基类字段（对齐拆解文档核心字段）
- [x] `entities/player.ts`：移动 + dash（按设计数值：`6m/s`、`12m/s`、`0.3s`、`3s`）
- [x] `combat/collision.ts`：bounds + Circle-vs-AABB + Circle-vs-Circle
- [x] `arena/pickups.ts`：拾取/掉落/空投（含 2-slot 副武器限制）
- [x] `arena/interactables.ts`：可燃烧/可破坏/可推动/可攀爬/可开关 的组件化框架

## 当前阶段（Phase 3）
战斗底座（射线/弹体/爆炸/伤害/状态效果）落地为可复用的结算链路。

### Phase 3 - Checklist
- [x] `combat/raycast.ts`：实体 Sphere 命中 + 掩体 Box 命中 + multi-hit（穿透）
- [x] `weapons/projectile.ts`：弹体更新（linear/ballistic/bouncy/returning/grapple）+ 事件回传 + 移除策略
- [x] `combat/areaDamage.ts`：AOE 衰减伤害 + 击退
- [x] `combat/damage.ts`：伤害结算（含 bleed 伤害放大）
- [x] `combat/statusEffects.ts`：状态应用/刷新/不叠加 + DOT tick + 派生属性

## 当前阶段（Phase 4）
主武器系统（15）落地为“first playable pass”：弹药/换弹/蓄力/特殊机制先完整，数值与美术后续迭代。

### Phase 4 - Checklist
- [x] `weapons/weaponState.ts`：weapon slot runtime（ammo/reserve/reload/cooldown/charge）
- [x] `weapons/weaponManager.ts`：switch/reload/charge/burstAll（输入边沿不丢帧）
- [x] `weapons/fireWeapon.ts`：pellets/doubleShot/penetrate/charge damage snapshot

## 后续阶段（Phase 1+，仅做路线图）
> 说明：每个阶段的“完成条件”必须可验证（可运行/可复现/可回归），避免只写代码不形成可用增量。

### Phase 1 - Core Runtime
- 渲染器/相机/输入/主循环（fixed timestep + render interpolation）
- 资源系统（manifest + glTF cache + per-scene preload groups）
- 存档设置（版本化 default + migration）
- 音频骨架（SFX/Music buses + unlock）

### Phase 2 - World & Entities
- Entity 基类（玩家/AI 共用字段）
- Movement + Collision（Circle-vs-AABB/Circle-vs-Circle + bounds）
- Pickups/Drop/Airdrop（可配置规则）

### Phase 3 - Combat Foundation
- Hitscan + Projectile + AOE
- Damage pipeline + Difficulty tuning
- Status effects（8 core + trap control states）

### Phase 4 - Weapons (15)
- Weapon manager + weapon state machine
- 15 主武器配置落地 + 行为实现 + VFX hooks

### Phase 5 - Throwables (9)
- 2-slot inventory + preview + placement + triggers
- 9 副武器实现 + AI 使用策略

### Phase 6 - Arenas (10)
- Arena manager + cover/interactable components
- 10 场景配置 + 机关/事件 + AI 导航图

### Phase 7 - Modes (4)
- Mode manager
- duel/ffa/siege/ctf 胜负逻辑 + UI + AI 目标

### Phase 8 - Polish
- VFX/SFX 完整链路
- 调试面板、回放/种子化 RNG、性能预算与回归

## 风险清单（持续更新）
| 风险 | 触发点 | 影响 | 缓解策略 |
|------|--------|------|----------|
| Vite multi-page 构建路径错误 | 子目录入口引用路径 | 构建后资源 404 | 统一使用绝对导入 `/src/...` + 在 `vite.config.ts` 明确 rollup input |
| legacy 静态文件与新构建冲突 | `public/index.html` 与根 `index.html` 同名 | 构建产物覆盖/不可预期 | 移除/重命名 `public/index.html`，以根 `index.html` 为唯一入口 |
| 状态效果与陷阱控制态冲突 | 只实现 8 个效果但陷阱需要定身/击倒 | 玩法不完整 | 在同一系统里扩展 `root/knockdown`，UI 可选择不显示或以 icon 归类 |

## 常用命令
```bash
npm install
npm run dev
npm run build
npm run preview
```
