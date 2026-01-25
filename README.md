# 三国卡通射击对战（Three.js + Vite + TypeScript）

本仓库包含两部分：
- `Sanguo Shooter`：三国主题的完整重制版（Vite + TypeScript + Three.js），面向长期可维护与扩展。
- `Tiny Toon Duel`：legacy 单文件原型（纯静态 `public/toonshooter/index.html`），用于参考与对照。

<p align="center">
  <img src="public/toonshooter/design-markedup.jpeg" alt="Tiny Toon Duel design" width="720" />
</p>

## 项目结构

```
index.html                  # Landing page (Vite entry)
sanguo-shooter/index.html   # Sanguo Shooter entry (Vite multi-page)
src/                        # TypeScript source
public/                     # Static assets copied to dist
├─ assets.json              # Asset manifest (legacy + shared)
├─ assets/                  # GLTF models / textures referenced by the manifest
└─ toonshooter/             # Legacy prototype (static)
   └─ index.html
vercel.json                 # Vercel static config (clean URLs, caching)
```

说明：
- Vite 构建产物输出到 `dist/`，并会把 `public/` 原样复制到 `dist/` 根目录。
- 为避免与 `public/assets/` 冲突，Vite 打包生成的前端资源目录使用 `vite-assets/`（见 `vite.config.ts`）。

## 本地运行

```bash
npm install
npm run dev
```

访问：
- `http://localhost:5173/` — landing page
- `http://localhost:5173/sanguo-shooter/` — Sanguo Shooter
- `http://localhost:5173/toonshooter/` — legacy prototype（会加载 `/assets.json` 与 `/assets/**`）

## 部署（Vercel）

1. 在 Vercel dashboard 用该仓库创建项目。
2. Framework preset 选择 **Vite**（或 **Other** 也可，但需配置 build/output）。
3. Build Command：`npm run build`
4. Output Directory：`dist`（也可直接依赖 `vercel.json` 的 `outputDirectory`）
5. 部署后可访问：
   - `/` landing
   - `/sanguo-shooter/` 新游戏
   - `/toonshooter/` legacy 原型

缓存策略：
- `/assets/**` 与 `/vite-assets/**` 使用长缓存 `Cache-Control: public,max-age=31536000,immutable`（见 `vercel.json`）。

## 资产管理

- `public/assets.json` 是资产路径的入口（legacy 与新游戏都可以复用/扩展）。
- 新游戏允许 placeholder 先行：逻辑配置先完整，后续再替换为最终 glTF 与贴图。

## 开发备注

- `docs/plans/2026-01-25-sanguo-shooter-design.md`：完整设计规格
- `docs/plans/2026-01-25-sanguo-shooter-implementation-plan.md`：可执行行动清单（分阶段）
- `docs/ANALYSIS.md`：legacy 原型拆解参考
