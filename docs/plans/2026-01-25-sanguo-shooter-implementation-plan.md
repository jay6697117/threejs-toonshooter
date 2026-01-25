# 三国卡通射击对战（Sanguo Shooter）- 完整实施计划（Vite + TypeScript）

> 本文档是“可执行的行动清单”，用于把 `docs/plans/2026-01-25-sanguo-shooter-design.md` 的完整内容落地到工程。  
> 约束：不做 MVP 裁剪；允许 placeholder 资产先行；组队模式默认 1P + AI 补齐。

---

## 0. 关键结论（先读这个）

1. **从 Day 1 使用 Vite + TypeScript（strict）**：保证模块边界清晰、可重构、可扩展。
2. **保留 legacy 原型（`public/toonshooter/`）**：不在其上“边跑边改”，而是在新入口里重建架构并逐步吸收成熟实现。
3. **内容完全数据驱动**：武器/副武器/场景/角色/模式/状态效果全部配置化；逻辑与资源解耦，允许 placeholder → glTF 替换。
4. **交付方式**：先把“引擎底座”和“全量玩法骨架”做完整（即使都是 placeholder），再逐步补齐资产与调参。

---

## 1. 已确认决策与约束

### 1.1 决策
- 工程：**Vite + TypeScript**（strict）。
- 组队模式（`siege`/`ctf`）：默认 **1 human player + AI fill**。
- 资产：允许 **placeholder-first**（逻辑完整）→ 后续替换最终 glTF。

### 1.2 约束
- 静态部署：目标是 `npm run build` 产物可直接静态托管（Vercel/任意静态服务器）。
- 语言规范：本文档用中文；代码/标识符/注释/字符串全部用 English。

---

## 2. 全量功能清单（不可裁剪）

> 本节用于“验收对照”：任何阶段都不能悄悄删减这些内容，只能推迟到后续阶段实现。

### 2.1 主武器（15）

| Category | Weapon (CN) | `weaponId` |
|---|---|---|
| Melee | 飞刀 | `flyingKnife` |
| Melee | 飞镖 | `flyingDart` |
| Melee | 袖箭 | `sleeveArrow` |
| Melee | 回旋刃 | `boomerangBlade` |
| Mid | 猎弓 | `huntingBow` |
| Mid | 连弩 | `repeatingCrossbow` |
| Mid | 火箭 | `fireArrow` |
| Mid | 铁骨朵 | `ironMace` |
| Ranged | 强弓 | `strongBow` |
| Ranged | 重弩 | `heavyCrossbow` |
| Ranged | 床弩 | `siegeCrossbow` |
| Ranged | 毒弩 | `poisonCrossbow` |
| Special | 诸葛连弩 | `zhugeRepeater` |
| Special | 飞爪钩索 | `grapplingHook` |
| Special | 雷火弹 | `thunderBomb` |

### 2.2 副武器 / 投掷物（9）

| Category | Item (CN) | `throwableId` |
|---|---|---|
| Explosive | 震天雷 | `thunderGrenade` |
| Explosive | 火药包 | `gunpowderPack` |
| Explosive | 烟雾弹 | `smokeBomb` |
| Traps | 绊马索 | `tripWire` |
| Traps | 铁蒺藜 | `caltrops` |
| Traps | 捕兽夹 | `bearTrap` |
| Utility | 石灰包 | `limePowder` |
| Utility | 油壶 | `oilPot` |
| Utility | 毒烟罐 | `poisonSmoke` |

### 2.3 场景（10）

| Scene (CN) | `sceneId` | Mechanic Keywords |
|---|---|---|
| 校场点兵 | `trainingGround` | burnable |
| 长坂古道 | `changbanRoad` | breakableBridge, fallingTree |
| 洛阳街巷 | `luoyangStreets` | pushableCart, explosiveJars |
| 赤壁战船 | `chibiShips` | waterSlow, fireSpread |
| 虎牢关 | `hulaoPass` | gateToggle, ladders, traps |
| 桃园结义 | `peachGarden` | petalsCover, burnableHut |
| 铜雀台 | `tongqueTerrace` | lightDarkZones |
| 五丈原 | `wuzhangyuanCamp` | windBallistics, globalDarkEvent |
| 白帝城 | `baidicheng` | lightningEvent, cliffFall |
| 许昌擂台 | `xuchangArena` | centerDamageBuff, flashBlind |

### 2.4 武将（12，纯外观差异）

| Faction | Character (CN) | `characterId` |
|---|---|---|
| Shu | 刘备 | `liuBei` |
| Shu | 关羽 | `guanYu` |
| Shu | 张飞 | `zhangFei` |
| Shu | 诸葛亮 | `zhugeLiang` |
| Wei | 夏侯惇 | `xiahouDun` |
| Wei | 张辽 | `zhangLiao` |
| Wei | 曹操 | `caoCao` |
| Wei | 典韦 | `dianWei` |
| Wu | 甘宁 | `ganNing` |
| Wu | 孙尚香 | `sunShangxiang` |
| Wu | 周瑜 | `zhouYu` |
| Wu | 太史慈 | `taiShiCi` |

### 2.5 模式（4）

| Mode (CN) | `modeId` | Core Rules |
|---|---|---|
| 单挑 | `duel` | best of 5, 105s per round |
| 混战 | `ffa` | 4 players, 3 lives, 180s |
| 攻城战 | `siege` | attack/defend, 120s, defender respawns 3 |
| 夺旗战 | `ctf` | score to 3, 300s, carrier cannot use weapons |

### 2.6 状态效果（8 核心 + 机制控制态）

**Core 8（按设计文档）：**
- `burn`
- `poison`
- `slow`
- `stun`
- `knockback`
- `bleed`
- `armorBreak`
- `blind`

**Extra Control States（为陷阱/场景/床弩机制补齐，不计入核心 8 的平衡表）：**
- `root` (e.g. `bearTrap`, `siegeCrossbow` pin)
- `knockdown` (e.g. `tripWire`)

---

## 3. 技术架构（Vite + TypeScript）

### 3.1 顶层原则（强制）

1. **数据驱动优先**：任何“内容差异”优先进入 config，不要散落在 if/else。
2. **低耦合模块边界**：按目录划分职责，禁止跨层随意互相引用（用接口/事件/依赖注入）。
3. **可观测性**：调试面板 + 可复现（seed RNG）是长期提效核心，不是“最后再说”。
4. **性能预算从一开始就存在**：对象池、上限、分帧更新策略在框架层留口子。

### 3.2 建议目录结构（落地目标）

```
.
├─ index.html
├─ sanguo-shooter/
│  └─ index.html
├─ src/
│  ├─ landing/
│  │  └─ main.ts
│  └─ game/
│     ├─ main.ts
│     ├─ app/
│     ├─ core/
│     ├─ config/
│     ├─ entities/
│     ├─ weapons/
│     ├─ throwables/
│     ├─ arena/
│     ├─ combat/
│     ├─ modes/
│     ├─ fx/
│     ├─ ui/
│     └─ debug/
├─ public/
│  ├─ assets.json
│  ├─ assets/
│  └─ toonshooter/
│     └─ index.html
└─ vercel.json
```

### 3.3 依赖方向（建议强约束）

- `src/game/core/**`：只依赖 `three` 与 `src/game/config/**`（以及极少量 `shared` 工具）。
- `src/game/entities/**`：依赖 `core + config + combat`（不要直接依赖 `ui`）。
- `src/game/weapons/**`：依赖 `core + config + combat + fx`（不要依赖 `ui`，通过事件/状态暴露）。
- `src/game/throwables/**`：同 weapons。
- `src/game/arena/**`：依赖 `core + config + combat`（场景机制通过组件化/事件化）。
- `src/game/modes/**`：依赖 `entities + arena + weapons + throwables + combat`。
- `src/game/ui/**`：只读订阅 `GameState`/`WorldState`，不直接改仿真数据（通过命令/事件提交）。
- `src/game/debug/**`：可读所有状态，但写入必须走受控接口（避免调试代码污染逻辑）。

---

## 4. 阶段化实施（带验收标准）

> 每个 Phase 都要有“可跑、可验证”的完成条件。  
> 验收建议先以 `npm run dev` + 人工 smoke 为主，再逐步补齐 `node --test` 纯逻辑单测。

### Phase 0：工程与入口（Vite/TS + multi-page）

**目标：** 新入口能跑（哪怕全是 placeholder），并且 legacy 原型仍可访问。

**Checklist：**
- [x] 新增/完善工程文件：`package.json`、`tsconfig.json`、`vite.config.ts`
- [x] 处理 landing page：把 `public/index.html` 的内容迁移为根 `index.html`（Vite 入口）
- [x] 新增第二入口：`sanguo-shooter/index.html`（Vite multi-page input）
- [x] 新增 TS 入口：
  - [x] `src/landing/main.ts`
  - [x] `src/game/main.ts`
- [x] 保留 legacy：
  - [x] `public/toonshooter/` 不改动
  - [x] landing 保留 `/toonshooter/` 链接
- [x] 更新静态部署配置：
  - [x] `vercel.json` output 指向 `dist`
  - [x] 确保 `/assets/**` 长缓存仍生效（Vite 会复制 `public/assets/**` 到 `dist/assets/**`）

**Done Criteria（必须同时满足）：**
- `npm run dev` 下：
  - `/` 打开 landing
  - `/toonshooter/` 打开 legacy 原型
  - `/sanguo-shooter/` 打开新入口
- `npm run build` 后 `npm run preview` 下同样可访问上述 3 个路径

**Validation Commands：**
```bash
npm install
npm run dev
npm run build
npm run preview
```

---

### Phase 1：Core Runtime（渲染/相机/输入/循环/资源/存档/音频骨架）

**目标：** 形成稳定“游戏内核”，后续任何玩法只是在其上添加系统，而不是反复改内核。

**Checklist：**
- [x] `core/renderer.ts`：DPR 限制、色彩空间、shadow、resize、quality presets
- [x] `core/camera.ts`：俯视跟随、screen shake、FOV pulse、timeScale hooks
- [x] `core/input.ts`：键位表 + justPressed/pressed/justReleased
- [x] `core/loop.ts`：fixed timestep + render interpolation
- [x] `core/assets.ts`：`assets.json` 加载、GLTF cache、clone（SkeletonUtils）
- [x] `core/storage.ts`：settings schema + migration + defaults
- [x] `core/audio.ts`：unlock + buses + volume settings（资源后补）

**Done Criteria：**
- 主循环稳定、不会随帧率改变运动速度（fixedDt）。
- 输入采样正确（快速点按不丢、持续按压不抖）。
- 资源系统可加载 manifest 并返回占位资产（即使没有新 glTF）。

---

### Phase 2：World & Entities（移动/碰撞/拾取）

**目标：** 玩家、AI（先 dummy）可在场地内移动、碰撞、拾取。

**Checklist：**
- [x] `core/world.ts`：集中存放实体数组与系统集合
- [x] `entities/entityBase.ts`：统一字段（hp, velocity, yaw, cooldowns, statuses, inventory）
- [x] `entities/player.ts`：WASD 移动、dash（按设计数值）、受控态门禁
- [x] `combat/collision.ts`：bounds + circle/aabb + circle/circle
- [x] `arena/pickups.ts`：武器/副武器拾取、2-slot 限制

**Done Criteria：**
- 玩家不会穿墙/穿掩体；边界约束正确。
- dash 冷却/持续时间正确。
- 拾取逻辑稳定（替换规则、满背包规则明确可预测）。

---

### Phase 3：Combat Foundation（射线/弹体/爆炸/伤害/状态）

**目标：** 战斗结算链路完整（无论武器是否全实现）。

**Checklist：**
- [x] `combat/raycast.ts`：hitscan（first hit）
- [x] `combat/raycast.ts`：multi-hit（用于 `heavyCrossbow` 穿透）
- [x] `weapons/projectile.ts`：直线/抛物线/弹跳（基础）
- [x] `weapons/projectile.ts`：返回（用于 `boomerangBlade`）
- [x] `weapons/projectile.ts`：grapple（用于 `grapplingHook`）
- [ ] `weapons/projectile.ts`：对象池化（后续性能阶段）
- [x] `combat/areaDamage.ts`：AOE + falloff + friendly-fire multiplier（可配）
- [x] `combat/damage.ts`：伤害结算 + difficulty tuning
- [x] `combat/statusEffects.ts`：Core 8 + `root/knockdown`

**Done Criteria：**
- 任何命中路径（hitscan/projectile/aoe）都能统一触发：伤害 → 状态 → 击退 → VFX/SFX hooks。
- 状态刷新/不叠加规则符合设计（stun 不叠加，其余刷新时间）。

---

### Phase 4：Weapons（15）

**目标：** 15 把武器全部可用，机制完整；资产可先 placeholder。

**Checklist（强制按类别逐把验收）：**
- [x] `weapons/weaponManager.ts`：weapon slots + switching + reload + charge states
- [x] `config/weapons.ts`：15 weapons config（严格按 `weaponId`）
- [ ] 逐把实现（每把都要有 smoke 用例）：
  - [x] melee（first playable pass）: `flyingKnife` `flyingDart` `sleeveArrow` `boomerangBlade`
  - [x] mid（first playable pass）: `huntingBow` `repeatingCrossbow` `fireArrow` `ironMace`
  - [x] ranged（first playable pass）: `strongBow` `heavyCrossbow` `siegeCrossbow` `poisonCrossbow`
  - [x] special（first playable pass）: `zhugeRepeater` `grapplingHook` `thunderBomb`
  - [ ] per-weapon smoke checklist（ammo/reload/charge/special + edge cases）
  - [x] special acquisition gating（airdrop/treasure only；当前以 timed airdrop 为主，treasure 可后补）

**Done Criteria：**
- 15 把武器“数值、弹药、换弹、蓄力、状态效果、特殊机制”都可跑通。
- `special` 只能通过空投/宝箱获取（规则可先简化为测试按钮，但必须有真正入口）。

---

### Phase 5：Throwables（9）

**目标：** 9 个副武器全部可用；携带 2 格；放置/投掷预览可用。

**Checklist：**
- [x] `throwables/throwableManager.ts`：2-slot inventory + preview + throw/place
- [x] 9 items implementation（first playable pass）：
  - [x] explosive（first playable pass）: `thunderGrenade` `gunpowderPack` `smokeBomb`
  - [x] traps（first playable pass）: `tripWire` `caltrops` `bearTrap`
  - [x] utility（first playable pass）: `limePowder` `oilPot` `poisonSmoke`
- [x] 规则联动：
  - [x] smoke/poison smoke 影响 LoS/AI 感知（已用于 AI 命中率/开火置信度降级）
  - [x] oil ignitable（placeholder：燃烧单位接触油区则点燃）

---

### Phase 6：Arenas（10）

**目标：** 10 个场景全部可跑，且每个场景的“核心机制”存在并可验证。

**Checklist：**
- [x] `arena/arenaManager.ts`：load/unload（`clearArena`）+ scene events/zones（placeholder 机制）
- [ ] `arena/arenaManager.ts`：per-scene preload groups（assets integration，placeholder-first）
- [ ] `arena/cover.ts`：destructible/burnable/pushable/climbable/toggleable（climbable 仍待补齐）
- [x] `arena/sceneDefinitions.ts`：10 scene defs（spawn points, cover placements, events）
- [x] `debug/arenaDebug.ts`：展示 AABB、spawn、objectives

---

### Phase 7：Modes（4）

**目标：** 4 种模式胜负逻辑完整，UI 可用，AI 有目标。

**Checklist：**
- [x] `modes/modeManager.ts`：统一 match lifecycle
- [x] `modes/modeManager.ts`：duel（best of 5 + sudden death）
- [x] `modes/modeManager.ts`：ffa（4 players + 3 lives + time tiebreak）
- [x] `modes/modeManager.ts`：siege（attack/defend + capture progress + defender respawns）
- [x] `modes/modeManager.ts`：ctf（flag carrier restrictions + score to win + return rules）

---

### Phase 8：AI（难度/战术/模式目标）

**目标：** AI 从“能走能打”升级到“会用掩体、会用投掷物、会做目标”。

**Checklist：**
- [x] `entities/aiController.ts`：think loop + steering + shooting intent（placeholder）
- [x] `arena/navGraph.ts`：grid-based A* + dynamic obstacle sampling（covers rebuild）
- [x] `ai/behaviors/*.ts`：targeting/pickups/throwables（placeholder）
- [x] `ai/modeObjectives/*.ts`：siege/ctf objective logic（placeholder）
- [x] `config/difficulty.ts`：easy/normal/hard tuning

---

### Phase 9：UI/HUD（菜单/战斗 HUD/覆盖层）

**目标：** UI 只读订阅状态，输入走 command，不直接改仿真数据。

**Checklist：**
- [x] `ui/menu.ts`：mode/scene/difficulty/character selection（URL params）
- [x] `ui/hud.ts`：hp/ammo/throwables/dash/status/crosshair
- [x] `ui/overlays.ts`：pause/match end/scoreboard/killfeed

---

### Phase 10：VFX/SFX（完整反馈链）

**目标：** “命中反馈”闭环：视觉 + 声音 + 镜头 + UI 提示一致且可配置强度。

**Checklist：**
- [ ] `fx/tracers.ts`：weapon-specific tracer styles
- [ ] `fx/particles.ts`：explosion/smoke/fire/poison/petals
- [ ] `fx/screenFx.ts`：hit flash/vignette/near-miss/slowmo/shake/blind blur
- [ ] `core/audio.ts` + `audio/sfxMap.ts`：weapon/impact/ambient

---

### Phase 11：Content Assets（12 角色 + 场景/武器资源替换）

**目标：** placeholder 替换为最终 glTF/贴图，同时保持碰撞与 gameplay 不回归。

**Checklist：**
- [ ] `public/assets.json` 扩展 `sanguoShooter` 命名空间
- [ ] 角色骨骼与动画共享（12 皮肤 + 1 套动画）
- [ ] 场景资产与碰撞盒校准

---

### Phase 12：验证/回归/性能/发布

**目标：** 可复现、可回归、可持续迭代。

**Checklist：**
- [ ] seedable RNG + basic record/replay（至少记录 input + key events）
- [ ] `node --test`：纯逻辑单测（status stacking, aoe falloff, win conditions）
- [ ] perf budget：object pools + cap limits + AI throttling + scene unload
- [ ] Vercel smoke checklist（路径、缓存头、资源 404）

---

## 5. 与现有文档的关系

- 设计规格：`docs/plans/2026-01-25-sanguo-shooter-design.md`
- 参考原型拆解：`docs/ANALYSIS.md`
- Agent 执行跟踪（工作内存）：`task_plan.md` / `findings.md` / `progress.md`
