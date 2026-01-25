import * as THREE from 'three';
import type { ArenaBounds } from './sceneDefinitions';
import type { Cover } from './cover';

export type NavGrid = {
  bounds: ArenaBounds;
  cellSize: number;
  cols: number;
  rows: number;
  originX: number;
  originZ: number;
  walkable: Uint8Array;
};

export function buildNavGrid(bounds: ArenaBounds, covers: Cover[], options?: { cellSize?: number; agentRadius?: number }): NavGrid {
  const cellSize = options?.cellSize ?? 2.0;
  const agentRadius = options?.agentRadius ?? 0.55;

  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const cols = Math.max(1, Math.floor(width / cellSize));
  const rows = Math.max(1, Math.floor(depth / cellSize));

  const originX = bounds.minX + cellSize * 0.5;
  const originZ = bounds.minZ + cellSize * 0.5;

  const walkable = new Uint8Array(cols * rows);
  walkable.fill(1);

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = originX + c * cellSize;
      const z = originZ + r * cellSize;
      const idx = r * cols + c;

      for (const cover of covers) {
        if (!cover.active) continue;
        const box = cover.aabb;
        const minX = box.minX - agentRadius;
        const maxX = box.maxX + agentRadius;
        const minZ = box.minZ - agentRadius;
        const maxZ = box.maxZ + agentRadius;
        if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
          walkable[idx] = 0;
          break;
        }
      }
    }
  }

  return { bounds, cellSize, cols, rows, originX, originZ, walkable };
}

export function findPath(grid: NavGrid, start: THREE.Vector3, goal: THREE.Vector3): THREE.Vector3[] {
  const startCell = worldToCell(grid, start);
  const goalCell = worldToCell(grid, goal);

  const startId = startCell.r * grid.cols + startCell.c;
  const goalId = goalCell.r * grid.cols + goalCell.c;

  if (!grid.walkable[startId] || !grid.walkable[goalId]) {
    return [goal.clone()];
  }

  const n = grid.cols * grid.rows;
  const cameFrom = new Int32Array(n);
  cameFrom.fill(-1);

  const g = new Float32Array(n);
  const f = new Float32Array(n);
  const inOpen = new Uint8Array(n);
  const inClosed = new Uint8Array(n);

  for (let i = 0; i < n; i += 1) {
    g[i] = Number.POSITIVE_INFINITY;
    f[i] = Number.POSITIVE_INFINITY;
  }

  g[startId] = 0;
  f[startId] = heuristic(grid, startId, goalId);
  const open: number[] = [startId];
  inOpen[startId] = 1;

  while (open.length > 0) {
    const current = popBest(open, f);
    if (current === goalId) break;
    inOpen[current] = 0;
    inClosed[current] = 1;

    const { r, c } = idToCell(grid, current);
    const neighbors = [
      { r: r - 1, c },
      { r: r + 1, c },
      { r, c: c - 1 },
      { r, c: c + 1 }
    ];

    for (const nb of neighbors) {
      if (nb.r < 0 || nb.r >= grid.rows || nb.c < 0 || nb.c >= grid.cols) continue;
      const nid = nb.r * grid.cols + nb.c;
      if (!grid.walkable[nid]) continue;
      if (inClosed[nid]) continue;

      const tentativeG = g[current] + 1;
      if (tentativeG >= g[nid]) continue;

      cameFrom[nid] = current;
      g[nid] = tentativeG;
      f[nid] = tentativeG + heuristic(grid, nid, goalId);
      if (!inOpen[nid]) {
        open.push(nid);
        inOpen[nid] = 1;
      }
    }
  }

  if (cameFrom[goalId] < 0) return [goal.clone()];

  const cells: number[] = [];
  let cur = goalId;
  cells.push(cur);
  while (cur !== startId) {
    cur = cameFrom[cur];
    if (cur < 0) break;
    cells.push(cur);
  }
  cells.reverse();

  const points: THREE.Vector3[] = [];
  for (const id of cells) {
    const p = cellToWorld(grid, idToCell(grid, id));
    points.push(p);
  }
  if (points.length > 0) {
    points[0] = start.clone();
    points[points.length - 1] = goal.clone();
  }
  return points;
}

function heuristic(grid: NavGrid, a: number, b: number): number {
  const ac = idToCell(grid, a);
  const bc = idToCell(grid, b);
  return Math.abs(ac.c - bc.c) + Math.abs(ac.r - bc.r);
}

function popBest(open: number[], score: Float32Array): number {
  let bestIdx = 0;
  let best = score[open[0]];
  for (let i = 1; i < open.length; i += 1) {
    const s = score[open[i]];
    if (s < best) {
      best = s;
      bestIdx = i;
    }
  }
  const id = open[bestIdx];
  open.splice(bestIdx, 1);
  return id;
}

function worldToCell(grid: NavGrid, pos: THREE.Vector3): { r: number; c: number } {
  const c = Math.max(0, Math.min(grid.cols - 1, Math.round((pos.x - grid.originX) / grid.cellSize)));
  const r = Math.max(0, Math.min(grid.rows - 1, Math.round((pos.z - grid.originZ) / grid.cellSize)));
  return { r, c };
}

function idToCell(grid: NavGrid, id: number): { r: number; c: number } {
  return { r: Math.floor(id / grid.cols), c: id % grid.cols };
}

function cellToWorld(grid: NavGrid, cell: { r: number; c: number }): THREE.Vector3 {
  return new THREE.Vector3(grid.originX + cell.c * grid.cellSize, 0.95, grid.originZ + cell.r * grid.cellSize);
}

