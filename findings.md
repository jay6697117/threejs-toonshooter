# Findings

## Repo Snapshot (Pre-Vite)
- Static hosting layout: everything under `public/` is deployable.
- Legacy playable prototype lives at `public/toonshooter/index.html` (single-file Three.js app, importmap CDN).
- Asset manifest: `public/assets.json` provides paths under `assets/toonshooter/**`.
- Vercel config: `vercel.json` currently targets `outputDirectory: public` with long-cache headers for `/assets/**`.

## Key Constraints Applied
- Use Vite + TypeScript from day 1 (strict mode).
- Keep legacy prototype accessible (no refactor/rewrites of `public/toonshooter/`).
- Placeholder-first is allowed for new Sanguo content (logic complete, assets can be swapped later).
- For team modes, assume `1 human + AI fill` by default.

## Immediate Implications
- `public/index.html` conflicts with Vite’s root `index.html` convention; must be moved or renamed.
- Multi-page build is required to host:
  - Landing page at `/`
  - New game at `/sanguo-shooter/`
  - Legacy prototype at `/toonshooter/` (static, copied from `public/`)
- Action checklist is documented at `docs/plans/2026-01-25-sanguo-shooter-implementation-plan.md`.
