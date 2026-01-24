# 🎮 Tiny Toon Duel - Three.js 卡通射击游戏深度分析文档

> 本文档用于项目复刻和重构参考

## 📁 项目结构总览

```
public/
├── index.html                    # 项目落地页/入口页面
├── assets.json                   # 资源清单配置文件
├── toonshooter/
│   ├── index.html               # 🎯 游戏主文件 (单文件架构,~3000行)
│   └── design-markedup.jpeg     # 设计稿图片
└── assets/toonshooter/
    ├── Characters/glTF/         # 角色模型 (3个)
    ├── Guns/glTF/               # 武器模型 (16个)
    └── Environment/glTF/        # 环境模型 (55个)
```

---

## 🏗️ 一、架构设计分析

### 1.1 整体架构模式: **单文件游戏架构 (Single-File Game Architecture)**

游戏采用单HTML文件包含所有逻辑的架构:
- **HTML**: UI结构 (HUD、菜单、弹窗)
- **CSS**: 内嵌样式 (~700行)
- **JavaScript**: ES Modules 游戏逻辑 (~2300行)

### 1.2 技术栈

| 技术 | 版本/用途 |
|------|----------|
| Three.js | v0.160.0 (通过 unpkg CDN) |
| GLTFLoader | 加载3D模型 |
| SkeletonUtils | 克隆带骨骼的模型 |
| Import Maps | ES模块路径映射 |
| LocalStorage | 持久化设置和最佳成绩 |

### 1.3 核心数据结构

```javascript
// 全局配置对象
const CONFIG = {
  render: { referenceWidth, referenceHeight, maxDpr },
  arena: { width, depth, bounds },
  camera: { fov, near, far, position, lookAt },
  lighting: { ambient, hemi, dir },
  movement: { accel, maxSpeed, turnSpeed, dashSpeed, dashDuration, dashCooldown },
  weapons: { pistol, smg, shotgun },  // 武器配置
  grenade: { ... },                    // 手雷配置
  kick: { ... },                       // 踢击配置
  cover: { types: {...} },             // 掩体配置
  barrel: { hp, explosionRadius, maxDamage },
  difficulty: { presets: { easy, normal, hard } },
  match: { totalTime: 105, roundsToWin: 3 },
  gameModes: { duel, deathmatch }
};

// 世界状态对象
const world = {
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  clock: THREE.Clock,
  mixers: [],           // 动画混合器
  entities: [],         // 玩家/AI实体
  cover: [],            // 掩体对象
  barrels: [],          // 爆炸桶
  grenades: [],         // 手雷
  pickups: [],          // 拾取物
  fallingCrates: [],    // 空投箱
  fxLines: [],          // 子弹轨迹
  fxSprites: [],        // 枪口火焰
  fxParticles: [],      // 粒子效果
  nodes: []             // AI导航节点
};

// 游戏状态对象
const state = {
  mode: 'loading' | 'menu' | 'playing' | 'paused' | 'matchOver' | 'killCam',
  gameMode: 'duel' | 'deathmatch',
  timeLeft: number,
  round: number,
  wins: { p1, p2 },
  suddenDeath: boolean,
  bestWinTime: number | null
};
```

---

## 🎯 二、核心系统深度分析

### 2.1 渲染系统 (Rendering System)

```javascript
// 渲染器设置
function setupRenderer() {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,    // 开启抗锯齿
    alpha: false        // 不需要透明背景
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));  // 限制最大DPR
  renderer.outputColorSpace = THREE.SRGBColorSpace;               // sRGB色彩空间
  renderer.toneMapping = THREE.ACESFilmicToneMapping;             // 电影级色调映射
  renderer.shadowMap.enabled = true;                              // 启用阴影
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;               // 软阴影
}

// 光照设置: 三点光源系统
function setupLights() {
  AmbientLight(0xffffff, 0.35);                           // 环境光
  HemisphereLight(0xffffff, 0x96754b, 0.65);             // 半球光(天空/地面)
  DirectionalLight(0xfff2d6, 1.05);                       // 主方向光(带阴影)
}
```

### 2.2 资源管理系统 (Asset Management)

```javascript
// 资源缓存架构
const assets = {
  cache: new Map(),     // 路径 -> { scene, animations, hasSkinned }
  manifest: null        // assets.json 内容
};

// 资源加载流程
async function loadAssets() {
  const manifest = await fetch('../assets.json');
  // 并行加载所有必需资源
  await Promise.all(requests.map(path => loadGltf(path)));
}

// GLTF加载 + 缓存
async function loadGltf(path) {
  if (assets.cache.has(path)) return assets.cache.get(path);
  const loader = new GLTFLoader();
  // ... 加载并缓存
}

// 智能克隆 (支持骨骼动画)
function cloneAsset(path) {
  const entry = assets.cache.get(path);
  if (entry.hasSkinned || entry.animations.length) {
    return { root: SkeletonUtils.clone(entry.scene), animations };
  }
  return { root: entry.scene.clone(true), animations };
}
```

### 2.3 实体系统 (Entity System)

```javascript
// 实体数据结构
const entity = {
  id: 'p1',
  team: 'p1',
  color: 0x45D16E,
  group: THREE.Group,        // 实体容器
  root: THREE.Object3D,      // 模型根节点
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  yaw: number,               // 朝向角度
  hp: 100,

  // 武器系统
  weapon: {
    id: 'pistol',
    pending: null,           // 切换中的武器
    switchTimer: 0,
    states: {
      pistol: { ammo, reserve, reloadTimer, unlocked },
      smg: { ... },
      shotgun: { ... }
    }
  },

  // 状态计时器
  fireCooldown: 0,
  dashTimer: 0,
  dashCooldown: 0,
  kickCooldown: 0,
  stunTimer: 0,
  grenadeAmmo: 2,

  // AI专属
  isAI: boolean,
  ai: {
    thinkTimer: 0,
    strafeDir: 1,
    targetNode: null,
    burstCount: 0,
    burstCooldown: 0,
    desiredMove: null,
    fireIntent: false
  },

  // 视觉系统
  visuals: { gltf: null, placeholder: null },
  activeVisual: 'gltf' | 'placeholder',
  mixers: { mixer, actions, current }
};
```

### 2.4 武器系统 (Weapon System)

```javascript
// 武器配置详解
weapons: {
  pistol: {
    name: 'Pistol',
    fireRate: 2.1,           // 射速 (发/秒)
    fireRateAI: 2.0,         // AI射速
    damage: 16,              // 伤害值
    magSize: 8,              // 弹匣容量
    reserveMax: 32,          // 最大备弹
    reserveStart: 24,        // 初始备弹
    reload: 0.9,             // 换弹时间
    reloadType: 'mag',       // 换弹类型: 整弹匣
    spreadPlayer: 0.7,       // 玩家散布(度)
    spreadAI: 1.8,           // AI散布(度)
    range: 34,               // 射程
    auto: false,             // 非自动武器
    knockback: 0.45,         // 击退力
    tracer: 0xffd24d         // 弹道颜色
  },
  smg: {
    fireRate: 10,
    damage: 8,
    magSize: 30,
    spreadPlayer: 4.0,
    auto: true               // 自动武器
  },
  shotgun: {
    fireRate: 1.2,
    damage: 12,
    pellets: 6,              // 霰弹数量
    spreadPlayer: 12,
    reloadType: 'shell',     // 逐发换弹
    knockback: 2.5
  }
}
```

### 2.5 AI系统 (AI System)

```javascript
function updateAI(entity, dt) {
  // 1. 思考计时器 (决策频率)
  entity.ai.thinkTimer -= dt;
  if (entity.ai.thinkTimer <= 0) {
    thinkAI(entity);
    entity.ai.thinkTimer = aiThinkBase + random() * aiThinkJitter;
  }

  // 2. 执行移动意图
  if (entity.ai.desiredMove) {
    moveToward(entity, entity.ai.desiredMove, dt);
  }

  // 3. 执行射击意图
  if (entity.ai.fireIntent) {
    tryFire(entity, target);
  }
}

function thinkAI(entity) {
  // 寻找最近敌人
  const target = findNearestEnemy(entity);

  // 决策: 战斗 vs 躲避 vs 拾取
  if (shouldSeekCover(entity, target)) {
    entity.ai.targetNode = findBestCoverNode(entity, target);
  } else if (shouldSeekPickup(entity)) {
    entity.ai.targetNode = findNearestPickup(entity);
  } else {
    entity.ai.fireIntent = hasLineOfSight(entity, target);
  }
}
```

### 2.6 物理/碰撞系统 (Physics/Collision)

```javascript
// 移动 + 碰撞检测
function moveEntity(entity, dt) {
  // 1. 应用速度
  entity.position.addScaledVector(entity.velocity, dt);

  // 2. 竞技场边界约束
  clampToBounds(entity.position, CONFIG.arena.bounds, CONFIG.player.radius);

  // 3. 掩体碰撞 (AABB vs Circle)
  for (const cover of world.cover) {
    if (!cover.active) continue;
    resolveCircleAABB(entity.position, CONFIG.player.radius, cover);
  }

  // 4. 实体间碰撞
  for (const other of world.entities) {
    if (other === entity || other.isDead) continue;
    resolveCircleCircle(entity.position, other.position, CONFIG.player.radius);
  }
}

// 射线检测 (子弹命中)
function raycast(origin, direction, maxDistance, ignoreTeam) {
  // 1. 检测实体命中
  for (const entity of world.entities) {
    const hit = rayIntersectsSphere(origin, direction, entity.position, CONFIG.player.hurtRadius);
    if (hit && hit.distance < maxDistance) {
      return { type: 'entity', entity, distance: hit.distance };
    }
  }

  // 2. 检测掩体命中
  for (const cover of world.cover) {
    const hit = rayIntersectsAABB(origin, direction, cover);
    if (hit) return { type: 'cover', cover, distance: hit.distance };
  }

  // 3. 检测爆炸桶命中
  for (const barrel of world.barrels) {
    // ...
  }
}
```

### 2.7 视觉效果系统 (VFX System)

```javascript
// 屏幕效果
const fx = {
  shakeTime: 0,           // 屏幕震动
  shakeIntensity: 0,
  fovPulse: 0,            // FOV脉冲
  hitFlashTimer: 0,       // 受击闪烁
  nearMissTimer: 0,       // 近失弹闪烁
  dramaticTimer: 0,       // 戏剧化慢动作
  timeScale: 1,           // 时间缩放
  hitstopTimer: 0         // 命中停顿
};

// 子弹轨迹
function spawnTracer(start, end, color) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({ color, transparent: true });
  const line = new THREE.Line(geometry, material);
  line.userData = { life: 0.12, maxLife: 0.12 };
  world.fxLines.push(line);
}

// 枪口火焰
function showMuzzleFlash(entity) {
  entity.muzzle.visible = true;
  entity.muzzle.scale.setScalar(weaponConfig.muzzleSize * (0.8 + Math.random() * 0.4));
  entity.firedRecentlyTimer = 0.08;
}

// 击中粒子
function spawnHitParticles(position, count, color) {
  for (let i = 0; i < count; i++) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.08),
      new THREE.MeshBasicMaterial({ color })
    );
    particle.position.copy(position);
    particle.userData = {
      velocity: randomDirection().multiplyScalar(5 + Math.random() * 5),
      life: 0.3 + Math.random() * 0.2
    };
    world.fxParticles.push(particle);
  }
}
```

### 2.8 动画系统 (Animation System)

```javascript
function setupAnimations(root, animations) {
  const mixer = new THREE.AnimationMixer(root);

  // 智能动画查找
  const findClip = (tokens) =>
    animations.find(clip => tokens.some(t => clip.name.toLowerCase().includes(t)));

  const actions = {
    idle: mixer.clipAction(findClip(['idle', 'stand'])),
    run: mixer.clipAction(findClip(['run', 'walk'])),
    shoot: mixer.clipAction(findClip(['shoot', 'fire'])),
    reload: mixer.clipAction(findClip(['reload'])),
    hit: mixer.clipAction(findClip(['hit', 'hurt', 'stun'])),
    death: mixer.clipAction(findClip(['death', 'die']))
  };

  // 配置动画行为
  actions.shoot.setLoop(THREE.LoopOnce, 1);
  actions.death.clampWhenFinished = true;

  return { mixer, actions, current: 'idle' };
}

function transitionTo(entity, animName) {
  const mixerEntry = entity.mixers;
  const current = mixerEntry.actions[mixerEntry.current];
  const next = mixerEntry.actions[animName];

  current?.fadeOut(0.15);
  next?.reset().fadeIn(0.15).play();
  mixerEntry.current = animName;
}
```

---

## 🎨 三、UI/HUD 系统分析

### 3.1 CSS 变量系统

```css
:root {
  /* 背景色 */
  --bg-top: #cfe6ff;
  --bg-horizon: #efd9b1;

  /* 玩家颜色 */
  --p1: #45d16e;     /* 绿色 - 玩家1 */
  --p2: #e84c4c;     /* 红色 - 玩家2/AI */
  --p3: #4da3ff;     /* 蓝色 - 玩家3 */
  --p4: #f6d64a;     /* 金色 - 玩家4 */

  /* UI元素 */
  --panel: rgba(15, 18, 22, 0.82);
  --panel-border: rgba(255, 255, 255, 0.12);

  /* 字体 */
  --font-display: 'Bangers', 'Barlow Condensed', sans-serif;
  --font-body: 'Barlow', system-ui, sans-serif;
}
```

### 3.2 HUD 组件结构

```html
<div id="hud" data-mode="menu">
  <!-- 玩家面板 (动态生成) -->
  <div id="playerPanels">
    <div class="playerPanel pos-tl">
      <div class="nameTag p1">Player 1</div>
      <div class="livesInfo">Lives: 3</div>
      <div class="hpWrap">
        <div class="hpBar"><!-- 10个血条段 --></div>
      </div>
      <div class="weaponInfo">
        <span class="weaponIcon">🔫</span>
        <span class="weaponName">Pistol</span>
        <span class="weaponAmmo">8</span>
        <span class="weaponReserve">/24</span>
      </div>
    </div>
  </div>

  <!-- 计时器 -->
  <div id="timerPanel">
    <div id="timer">TIME: 01:45</div>
    <div id="roundPips"><!-- 回合指示器 --></div>
  </div>

  <!-- 底部控制提示 -->
  <div id="bottomBar">
    <div id="controls">WASD Move · Mouse Aim · Click Fire...</div>
    <div id="dash">Dash<div class="cooldown"></div></div>
  </div>

  <!-- 覆盖层 -->
  <div id="menuOverlay" class="overlay visible">...</div>
  <div id="pauseOverlay" class="overlay">...</div>
  <div id="matchOverlay" class="overlay">...</div>

  <!-- 视觉效果层 -->
  <div id="nearMissFlash"></div>
  <div id="hitFlash"></div>
  <div id="lowHpVignette"></div>
  <div id="dramaticOverlay"></div>
</div>
```

---

## 🗺️ 四、竞技场系统 (Arena System)

### 4.1 竞技场布局

```javascript
const BASE_ARENA = {
  width: 26,
  depth: 18,
  bounds: { minX: -13, maxX: 13, minZ: -9, maxZ: 9 },
  ground: { width: 36, depth: 26 }
};

// 主要掩体配置 (可碰撞)
const placements = [
  // 中央坦克 (永久掩体)
  { key: 'Tank', pos: [0, 0, -0.6], rot: Math.PI * 0.6, collide: true },

  // 出生点掩体 (永久)
  { key: 'Barrier_Large', pos: [-11.2, 0, -4.2], rot: Math.PI / 2 },
  { key: 'Barrier_Large', pos: [11.2, 0, 4.2], rot: -Math.PI / 2 },

  // 可破坏掩体
  { key: 'Crate', pos: [-3.2, 0, 0], hp: 30 },
  { key: 'Sofa', pos: [-8.3, 0, 5.9], hp: 40 },
  // ...
];

// 装饰物 (不可碰撞)
const decorativePlacements = [
  { key: 'CardboardBoxes_1', pos: [-11, 0, 5] },
  { key: 'TrafficCone', pos: [-2, 0, -2] },
  { key: 'Debris_Pile', pos: [-10, 0, 2] },
  // ...
];
```

### 4.2 掩体数据结构

```javascript
const cover = {
  key: 'Crate',
  assetPath: 'assets/toonshooter/Environment/glTF/Crate.gltf',
  mesh: THREE.Mesh,

  // 碰撞盒 (AABB)
  minX, maxX, minZ, maxZ, minY, maxY,

  // 状态
  active: true,
  destructible: true,
  hp: 30,
  maxHp: 30,
  kickable: true,
  kickState: null,      // 被踢飞时的状态

  // 视觉
  visuals: { gltf, placeholder },
  activeVisual: 'gltf',
  flashTimer: 0         // 受击闪白
};
```

---

## 💥 五、战斗系统详解

### 5.1 射击流程

```javascript
function tryFire(entity, targetPos) {
  // 1. 前置检查
  if (entity.fireCooldown > 0) return;
  if (entity.stunTimer > 0) return;
  if (entity.weapon.switchTimer > 0) return;

  const weaponState = getWeaponState(entity);
  if (weaponState.ammo <= 0) {
    startReload(entity);
    return;
  }

  // 2. 消耗弹药
  weaponState.ammo--;
  entity.fireCooldown = 1 / getFireRate(entity);

  // 3. 计算射击方向
  const direction = targetPos.clone().sub(entity.position).normalize();
  const spread = getSpread(entity);
  applySpread(direction, spread);

  // 4. 射线检测
  const hit = raycast(getMuzzlePos(entity), direction, weaponConfig.range, entity.team);

  // 5. 处理命中
  if (hit?.type === 'entity') {
    dealDamage(hit.entity, weaponConfig.damage, entity);
    applyKnockback(hit.entity, direction, weaponConfig.knockback);
    spawnHitParticles(hit.point, 5, hit.entity.color);
  } else if (hit?.type === 'cover') {
    damageCover(hit.cover, weaponConfig.damage);
  } else if (hit?.type === 'barrel') {
    damageBarrel(hit.barrel, weaponConfig.damage, entity.team);
  }

  // 6. 视觉效果
  spawnTracer(getMuzzlePos(entity), hit?.point || getMaxRangePoint(), weaponConfig.tracer);
  showMuzzleFlash(entity);
  triggerShootAnimation(entity);
  addScreenShake(0.02);
}
```

### 5.2 伤害处理

```javascript
function dealDamage(target, amount, source) {
  if (target.isDead) return;

  // 应用难度修正
  if (source?.isAI) {
    amount *= getAiTuning(source).aiDamageMul;
  }

  target.hp -= amount;
  target.flashTimer = CONFIG.cover.flashTime;

  // 近失弹检测 (戏剧化效果)
  if (!target.isAI && amount > 0 && target.hp > 0) {
    checkNearMiss(target, source);
  }

  // 死亡处理
  if (target.hp <= 0) {
    target.hp = 0;
    killEntity(target, source);
  }
}

function killEntity(entity, killer) {
  entity.isDead = true;
  entity.lives--;

  // 触发死亡动画
  transitionTo(entity, 'death');

  // 掉落武器拾取物
  dropWeaponPickup(entity);

  // 击杀摄像机
  if (!entity.isAI) {
    triggerKillCam(entity, killer);
  }

  // 检查回合/比赛结束
  checkRoundEnd();
}
```

### 5.3 爆炸系统

```javascript
function explodeBarrel(barrel) {
  barrel.alive = false;
  barrel.mesh.visible = false;

  // 显示爆炸后的桶
  spawnSpilledBarrel(barrel.position);

  // 范围伤害
  const radius = CONFIG.barrel.explosionRadius;
  const maxDmg = CONFIG.barrel.maxDamage;

  for (const entity of world.entities) {
    const dist = entity.position.distanceTo(barrel.position);
    if (dist > radius) continue;

    // 线性衰减伤害
    const falloff = 1 - (dist / radius);
    const damage = maxDmg * falloff;

    dealDamage(entity, damage, { team: barrel.lastDamagedByTeam });

    // 击退
    const knockDir = entity.position.clone().sub(barrel.position).normalize();
    applyKnockback(entity, knockDir, 15 * falloff);
  }

  // 视觉效果
  spawnExplosionParticles(barrel.position);
  addScreenShake(0.15);
  fx.hitFlashTimer = 0.1;
}

function explodeGrenade(grenade) {
  // 类似爆炸桶,但伤害更高,有眩晕效果
  const radius = CONFIG.grenade.explosionRadius;
  const maxDmg = CONFIG.grenade.maxDamage;

  for (const entity of world.entities) {
    // 友军伤害减少
    const isFriendly = entity.team === grenade.throwerTeam;
    const dmgMul = isFriendly ? 0.5 : 1.0;

    const damage = calculateFalloffDamage(entity, grenade.position, radius, maxDmg) * dmgMul;
    if (damage > 0) {
      dealDamage(entity, damage, grenade);
      entity.stunTimer = CONFIG.grenade.stun * (damage / maxDmg);
    }
  }
}
```

---

## 🎮 六、游戏模式系统

### 6.1 模式配置

```javascript
gameModes: {
  duel: {
    name: '1v1 Duel',
    playerCount: 2,
    arenaScale: 1.0,
    aiCount: 1,
    // 五局三胜制
  },
  deathmatch: {
    name: '4-Player FFA',
    playerCount: 4,
    arenaScale: 1.3,      // 更大的竞技场
    aiCount: 3,
    lives: 3              // 每人3条命
  }
}
```

### 6.2 难度系统

```javascript
difficulty: {
  presets: {
    easy: {
      aiHp: 80,              // AI血量
      aiDamageMul: 0.75,     // AI伤害倍率
      aiFireRateMul: 0.82,   // AI射速倍率
      aiSpreadMul: 1.8,      // AI散布倍率
      aiThinkBase: 0.62,     // AI决策间隔
      aiThinkJitter: 0.45
    },
    normal: {
      aiHp: 100,
      aiDamageMul: 1.0,
      aiFireRateMul: 1.0,
      aiSpreadMul: 1.0,
      aiThinkBase: 0.35,
      aiThinkJitter: 0.30
    },
    hard: {
      aiHp: 110,
      aiDamageMul: 1.05,
      aiFireRateMul: 1.12,
      aiSpreadMul: 0.9,
      aiThinkBase: 0.26,
      aiThinkJitter: 0.22
    }
  }
}
```

---

## 🔄 七、游戏循环 (Game Loop)

```javascript
function animate() {
  requestAnimationFrame(animate);
  const rawDt = world.clock.getDelta();

  // 1. 更新效果计时器 (始终运行)
  updateFxTimers(rawDt);

  // 2. 根据游戏状态更新
  switch (state.mode) {
    case 'playing':
      updateGame(rawDt);
      break;
    case 'killCam':
      updateKillCam(rawDt);
      break;
    case 'menu':
      updateIdle(rawDt);
      break;
  }

  // 3. 视觉更新 (应用时间缩放)
  const simDt = rawDt * getSimTimeScale();
  updateMixers(simDt);
  updateTracers(simDt);
  updateSprites(simDt);
  updateParticles(simDt);
  updateCameraFx(rawDt);

  // 4. 重置输入状态
  input.mouse.justPressed = false;

  // 5. 渲染
  world.renderer.render(world.scene, world.camera);
}

function updateGame(dt) {
  const scaledDt = fx.hitstopTimer > 0 ? 0 : dt * fx.timeScale;

  updateTimer(scaledDt);
  updateSkyDrops(scaledDt);
  updateFallingCrates(scaledDt);
  updatePickups(scaledDt);
  updateRollingBarrels(scaledDt);
  updateCoverStates(scaledDt);
  updateGrenades(scaledDt);

  world.entities.forEach((entity) => {
    if (entity.eliminated) return;
    if (entity.isAI) {
      updateAI(entity, scaledDt);
    } else {
      updatePlayer(entity, scaledDt);
    }
  });

  updateRespawns(scaledDt);
  updatePopups(dt);
  updateHUD();
}
```

---

## 📦 八、资源清单 (assets.json)

```json
{
  "assets": {
    "toonshooter": {
      "characters": {
        "Character_Enemy": "assets/toonshooter/Characters/glTF/Character_Enemy.gltf",
        "Character_Hazmat": "assets/toonshooter/Characters/glTF/Character_Hazmat.gltf",
        "Character_Soldier": "assets/toonshooter/Characters/glTF/Character_Soldier.gltf"
      },
      "guns": {
        "AK": "...", "Pistol": "...", "SMG": "...", "Shotgun": "...",
        "Grenade": "...", "RocketLauncher": "..."
      },
      "environment": {
        "Tank": "...", "Crate": "...", "ExplodingBarrel": "..."
      }
    }
  },
  "summary": { "total": 74 }
}
```

---

## 🔧 九、复刻/重构指南

### 9.1 核心依赖

```html
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>
```

### 9.2 初始化流程

```javascript
async function init() {
  setupRenderer();      // 1. 创建渲染器
  setupScene();         // 2. 创建场景 (背景、雾)
  setupCamera();        // 3. 创建相机
  setupLights();        // 4. 创建光源
  bindInput();          // 5. 绑定输入事件
  await loadAssets();   // 6. 加载3D资源
  setupVisualToggle();  // 7. 视觉切换按钮
  setupMenuModes();     // 8. 菜单模式选择
  applyGameMode();      // 9. 应用游戏模式
  createReticle();      // 10. 创建准星
  setMode('menu');      // 11. 进入菜单
  animate();            // 12. 启动游戏循环
}
```

### 9.3 关键重构建议

1. **模块化拆分**: 将单文件拆分为多个模块
   ```
   src/
   ├── core/
   │   ├── renderer.js
   │   ├── camera.js
   │   └── input.js
   ├── entities/
   │   ├── player.js
   │   ├── ai.js
   │   └── entity-base.js
   ├── weapons/
   │   ├── weapon-system.js
   │   └── projectile.js
   ├── arena/
   │   ├── arena-builder.js
   │   └── cover.js
   ├── fx/
   │   ├── particles.js
   │   └── screen-effects.js
   └── main.js
   ```

2. **状态管理**: 使用状态机模式
   ```javascript
   const StateMachine = {
     states: { menu, playing, paused, matchOver, killCam },
     current: 'menu',
     transition(newState) { ... }
   };
   ```

3. **事件系统**: 解耦组件通信
   ```javascript
   EventBus.on('entity:damaged', (entity, damage, source) => { ... });
   EventBus.on('round:end', (winner) => { ... });
   ```

4. **对象池**: 优化频繁创建/销毁的对象
   ```javascript
   const ParticlePool = {
     pool: [],
     get() { return this.pool.pop() || createNew(); },
     release(particle) { this.pool.push(particle); }
   };
   ```

---

## 🎯 十、控制键位

| 按键 | 功能 |
|------|------|
| WASD | 移动 |
| 鼠标 | 瞄准 |
| 左键 | 射击 |
| 1/2/3 | 切换武器 |
| R | 换弹 |
| Space | 冲刺 |
| E/F | 踢击 |
| G | 投掷手雷 |
| Tab | 排行榜 |
| P/Esc | 暂停 |
| V | 切换视觉模式 |
| Enter | 开始/重新开始 |

---

## ✅ 总结

这是一个**完整的、生产就绪的 Three.js 射击游戏**,包含:

| 系统 | 完成度 | 复杂度 |
|------|--------|--------|
| 渲染系统 | ✅ 完整 | 中等 |
| 资源管理 | ✅ 完整 | 中等 |
| 实体系统 | ✅ 完整 | 高 |
| 武器系统 | ✅ 完整 | 高 |
| AI系统 | ✅ 完整 | 高 |
| 物理/碰撞 | ✅ 完整 | 中等 |
| 动画系统 | ✅ 完整 | 中等 |
| UI/HUD | ✅ 完整 | 中等 |
| 视觉效果 | ✅ 完整 | 中等 |
| 游戏模式 | ✅ 完整 | 中等 |

**代码特点**:
- 单文件架构,便于快速原型
- 良好的配置驱动设计
- 支持GLTF/占位符双模式切换
- 完整的游戏循环和状态管理
- 响应式UI设计

---

*文档生成时间: 2026-01-25*
