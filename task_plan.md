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
- [ ] 最小可运行：新入口能在浏览器打开、渲染 Three.js 场景、响应 resize、主循环稳定运行

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
