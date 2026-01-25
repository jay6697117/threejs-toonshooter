import type { SanguoShooterUiState } from '../app/uiState';

export type HudUi = {
  update: (state: SanguoShooterUiState) => void;
  dispose: () => void;
};

export function createHud(root: HTMLElement): HudUi {
  const el = document.createElement('div');
  el.dataset.ui = 'hud';
  el.style.position = 'absolute';
  el.style.inset = '0';
  el.style.zIndex = '5';
  el.style.pointerEvents = 'none';
  el.style.userSelect = 'none';
  root.appendChild(el);

  const topLeft = document.createElement('div');
  topLeft.style.position = 'absolute';
  topLeft.style.left = '12px';
  topLeft.style.top = '12px';
  topLeft.style.display = 'grid';
  topLeft.style.gap = '8px';
  el.appendChild(topLeft);

  const panel = document.createElement('div');
  panel.style.background = 'rgba(6, 13, 33, 0.72)';
  panel.style.border = '1px solid rgba(255, 255, 255, 0.08)';
  panel.style.borderRadius = '12px';
  panel.style.padding = '10px 12px';
  panel.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.25)';
  panel.style.minWidth = '280px';
  topLeft.appendChild(panel);

  const title = document.createElement('div');
  title.style.fontWeight = '700';
  title.style.letterSpacing = '0.08em';
  title.style.textTransform = 'uppercase';
  title.style.fontSize = '12px';
  title.textContent = 'HUD';
  panel.appendChild(title);

  const lines = document.createElement('div');
  lines.style.marginTop = '8px';
  lines.style.display = 'grid';
  lines.style.gap = '4px';
  lines.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
  lines.style.fontSize = '12px';
  panel.appendChild(lines);

  const hpLine = document.createElement('div');
  const weaponLine = document.createElement('div');
  const ammoLine = document.createElement('div');
  const throwableLine = document.createElement('div');
  const dashLine = document.createElement('div');
  const statusLine = document.createElement('div');
  const modeLine = document.createElement('div');

  for (const node of [modeLine, hpLine, weaponLine, ammoLine, throwableLine, dashLine, statusLine]) {
    lines.appendChild(node);
  }

  const crosshair = document.createElement('div');
  crosshair.dataset.ui = 'crosshair';
  crosshair.style.position = 'absolute';
  crosshair.style.left = '50%';
  crosshair.style.top = '50%';
  crosshair.style.transform = 'translate(-50%, -50%)';
  crosshair.style.width = '8px';
  crosshair.style.height = '8px';
  crosshair.style.borderRadius = '999px';
  crosshair.style.border = '1px solid rgba(248, 251, 255, 0.75)';
  crosshair.style.boxShadow = '0 0 0 2px rgba(0, 0, 0, 0.35)';
  el.appendChild(crosshair);

  const update = (state: SanguoShooterUiState): void => {
    const h = state.human;
    const hpPct = h.maxHp > 0 ? Math.max(0, Math.min(1, h.hp / h.maxHp)) : 0;
    const hpBar = `${'█'.repeat(Math.round(hpPct * 12)).padEnd(12, '░')}`;

    modeLine.textContent = `mode=${state.modeId} scene=${state.sceneId} difficulty=${new URLSearchParams(window.location.search).get('difficulty') ?? 'normal'}`;
    hpLine.textContent = `hp=${h.hp.toFixed(0)}/${h.maxHp.toFixed(0)} [${hpBar}] lives=${h.livesLeft} k/d=${h.kills}/${h.deaths} score=${h.score}`;
    weaponLine.textContent = `weapon=${h.activeWeaponId ?? 'none'} slot=${h.activeWeaponSlot + 1}`;

    const ws = h.activeWeaponState;
    const ammo = ws ? `${ws.ammo}/${ws.reserve}` : '-/-';
    const reload = ws ? ws.reloadTimer.toFixed(2) : '0.00';
    const charge = ws ? ws.chargeSeconds.toFixed(2) : '0.00';
    ammoLine.textContent = `ammo=${ammo} reload=${reload}s charge=${charge}s`;

    throwableLine.textContent = `throwable=${h.activeThrowable ? `${h.activeThrowable.id} x${h.activeThrowable.count}` : 'none'} slot=${h.activeThrowableSlot + 1}`;
    dashLine.textContent = `dash: cd=${h.dashCooldown.toFixed(2)}s timer=${h.dashTimer.toFixed(2)}s water=${h.isInWater ? '1' : '0'} dark=${h.isInDark ? '1' : '0'}`;

    const statuses = h.statuses
      .slice()
      .sort((a, b) => b.timeLeft - a.timeLeft)
      .map((s) => `${s.id}:${s.timeLeft.toFixed(1)}`)
      .join(' ');
    statusLine.textContent = `status=${statuses || 'none'}`;

    crosshair.style.opacity = h.eliminated ? '0.2' : '1.0';
  };

  const dispose = (): void => {
    el.remove();
  };

  return { update, dispose };
}
