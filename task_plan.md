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

## Phase 状态概览（2026-01-25）
- Phase 0-5：已完成（工程/内核/世界/战斗底座/15 武器/9 副武器 first playable pass）
- Phase 6：部分完成（场景/掩体/事件/调试已落地；仍缺 `climbable` 与 `per-scene preload groups`）
- Phase 7-9：已完成（4 模式 + AI + UI）
- Phase 10：部分完成（tracer/particles/screenFx/audio 占位已起；仍缺 near-miss/slowmo/更多粒子与音频覆盖）
- Phase 11：未开始（`public/assets.json` 的 `sanguoShooter` 命名空间 + 12 角色皮肤/动画/场景资产替换）
- Phase 12：未开始（seedable RNG + record/replay + 单测 + 性能预算 + 发布验收）

## 当前阶段（Phase 10-12）
目标：把“可复现/可回归/可持续迭代”的工程能力补齐，确保后续替换 glTF 资产时不会回归玩法。

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

## Phase 10-12 - Checklist（待完成）

### Phase 10（VFX/SFX）
- [ ] `fx/tracers.ts`：weapon-specific tracer styles（当前仅按 category 上色）
- [ ] `fx/particles.ts`：explosion/smoke/fire/poison/petals（当前仅 impact/explosion puff）
- [ ] `fx/screenFx.ts`：hit flash/vignette/near-miss/slowmo/shake/blind blur（当前缺 near-miss/slowmo 等）
- [ ] `core/audio.ts` + `audio/sfxMap.ts`：weapon/impact/ambient（当前仅 beep-based 占位）

### Phase 11（Content Assets）
- [ ] `public/assets.json` 扩展 `sanguoShooter` 命名空间
- [ ] 角色骨骼与动画共享（12 皮肤 + 1 套动画）
- [ ] 场景资产与碰撞盒校准

### Phase 12（验证/回归/性能/发布）
- [ ] seedable RNG + basic record/replay（至少记录 input + key events）
- [ ] `node --test`：纯逻辑单测（status stacking, aoe falloff, win conditions）
- [ ] perf budget：object pools + cap limits + AI throttling + scene unload
- [ ] Vercel smoke checklist（路径、缓存头、资源 404）

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
