import type { SanguoShooterUiState } from '../app/uiState';
import type { MatchState } from '../modes/modeManager';

export type OverlayCallbacks = {
  onResume: () => void;
  onRestart: () => void;
  onOpenMenu: () => void;
  onBack: () => void;
};

export type OverlaysUi = {
  update: (state: SanguoShooterUiState) => void;
  dispose: () => void;
};

type KillEvent = { timeSeconds: number; killerId: string | null; victimId: string; weaponId: string | null };

export function createOverlays(root: HTMLElement, callbacks: OverlayCallbacks): OverlaysUi {
  const el = document.createElement('div');
  el.dataset.ui = 'overlays';
  el.style.position = 'absolute';
  el.style.inset = '0';
  el.style.zIndex = '10';
  el.style.pointerEvents = 'none';
  el.style.userSelect = 'none';
  root.appendChild(el);

  const killfeedEl = document.createElement('div');
  killfeedEl.style.position = 'absolute';
  killfeedEl.style.right = '12px';
  killfeedEl.style.top = '12px';
  killfeedEl.style.display = 'grid';
  killfeedEl.style.gap = '6px';
  el.appendChild(killfeedEl);

  const scoreboardEl = document.createElement('div');
  scoreboardEl.style.position = 'absolute';
  scoreboardEl.style.inset = '0';
  scoreboardEl.style.display = 'none';
  scoreboardEl.style.placeItems = 'center';
  scoreboardEl.style.background = 'rgba(2, 3, 8, 0.55)';
  scoreboardEl.style.backdropFilter = 'blur(8px)';
  scoreboardEl.style.pointerEvents = 'none';
  el.appendChild(scoreboardEl);

  const scoreboardCard = document.createElement('div');
  scoreboardCard.style.width = 'min(92vw, 860px)';
  scoreboardCard.style.maxHeight = 'min(86vh, 720px)';
  scoreboardCard.style.overflow = 'auto';
  scoreboardCard.style.borderRadius = '18px';
  scoreboardCard.style.background = 'rgba(6, 13, 33, 0.82)';
  scoreboardCard.style.border = '1px solid rgba(255, 255, 255, 0.08)';
  scoreboardCard.style.boxShadow = '0 40px 80px rgba(0, 0, 0, 0.45)';
  scoreboardCard.style.padding = '18px';
  scoreboardEl.appendChild(scoreboardCard);

  const scoreboardTitle = document.createElement('div');
  scoreboardTitle.style.fontWeight = '800';
  scoreboardTitle.style.letterSpacing = '0.08em';
  scoreboardTitle.style.textTransform = 'uppercase';
  scoreboardTitle.textContent = 'Scoreboard';
  scoreboardCard.appendChild(scoreboardTitle);

  const scoreboardMeta = document.createElement('div');
  scoreboardMeta.style.marginTop = '8px';
  scoreboardMeta.style.color = 'rgba(248, 251, 255, 0.72)';
  scoreboardMeta.style.fontSize = '13px';
  scoreboardMeta.style.display = 'flex';
  scoreboardMeta.style.justifyContent = 'space-between';
  scoreboardMeta.style.gap = '12px';
  scoreboardMeta.style.flexWrap = 'wrap';
  scoreboardCard.appendChild(scoreboardMeta);

  const scoreboardTable = document.createElement('table');
  scoreboardTable.style.width = '100%';
  scoreboardTable.style.marginTop = '12px';
  scoreboardTable.style.borderCollapse = 'collapse';
  scoreboardTable.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
  scoreboardTable.style.fontSize = '12px';
  scoreboardCard.appendChild(scoreboardTable);

  const pauseEl = document.createElement('div');
  pauseEl.style.position = 'absolute';
  pauseEl.style.inset = '0';
  pauseEl.style.display = 'none';
  pauseEl.style.placeItems = 'center';
  pauseEl.style.background = 'rgba(2, 3, 8, 0.62)';
  pauseEl.style.backdropFilter = 'blur(10px)';
  pauseEl.style.pointerEvents = 'auto';
  el.appendChild(pauseEl);

  const pauseCard = document.createElement('div');
  pauseCard.style.width = 'min(92vw, 520px)';
  pauseCard.style.borderRadius = '18px';
  pauseCard.style.background = 'rgba(6, 13, 33, 0.82)';
  pauseCard.style.border = '1px solid rgba(255, 255, 255, 0.08)';
  pauseCard.style.boxShadow = '0 40px 80px rgba(0, 0, 0, 0.45)';
  pauseCard.style.padding = '18px';
  pauseEl.appendChild(pauseCard);

  const pauseTitle = document.createElement('div');
  pauseTitle.textContent = 'Paused';
  pauseTitle.style.fontWeight = '800';
  pauseTitle.style.letterSpacing = '0.08em';
  pauseTitle.style.textTransform = 'uppercase';
  pauseCard.appendChild(pauseTitle);

  const pauseButtons = document.createElement('div');
  pauseButtons.style.marginTop = '14px';
  pauseButtons.style.display = 'grid';
  pauseButtons.style.gridTemplateColumns = '1fr 1fr';
  pauseButtons.style.gap = '10px';
  pauseCard.appendChild(pauseButtons);

  const resumeBtn = createButton('Resume', true);
  const restartBtn = createButton('Restart', false);
  const menuBtn = createButton('Menu', false);
  const backBtn = createButton('Back', false);
  pauseButtons.appendChild(resumeBtn);
  pauseButtons.appendChild(restartBtn);
  pauseButtons.appendChild(menuBtn);
  pauseButtons.appendChild(backBtn);

  resumeBtn.addEventListener('click', () => callbacks.onResume());
  restartBtn.addEventListener('click', () => callbacks.onRestart());
  menuBtn.addEventListener('click', () => callbacks.onOpenMenu());
  backBtn.addEventListener('click', () => callbacks.onBack());

  const matchEndEl = document.createElement('div');
  matchEndEl.style.position = 'absolute';
  matchEndEl.style.inset = '0';
  matchEndEl.style.display = 'none';
  matchEndEl.style.placeItems = 'center';
  matchEndEl.style.background = 'rgba(2, 3, 8, 0.7)';
  matchEndEl.style.backdropFilter = 'blur(10px)';
  matchEndEl.style.pointerEvents = 'auto';
  el.appendChild(matchEndEl);

  const matchEndCard = document.createElement('div');
  matchEndCard.style.width = 'min(92vw, 520px)';
  matchEndCard.style.borderRadius = '18px';
  matchEndCard.style.background = 'rgba(6, 13, 33, 0.82)';
  matchEndCard.style.border = '1px solid rgba(255, 255, 255, 0.08)';
  matchEndCard.style.boxShadow = '0 40px 80px rgba(0, 0, 0, 0.45)';
  matchEndCard.style.padding = '18px';
  matchEndEl.appendChild(matchEndCard);

  const matchEndTitle = document.createElement('div');
  matchEndTitle.textContent = 'Match Ended';
  matchEndTitle.style.fontWeight = '800';
  matchEndTitle.style.letterSpacing = '0.08em';
  matchEndTitle.style.textTransform = 'uppercase';
  matchEndCard.appendChild(matchEndTitle);

  const matchEndDesc = document.createElement('div');
  matchEndDesc.style.marginTop = '10px';
  matchEndDesc.style.color = 'rgba(248, 251, 255, 0.75)';
  matchEndDesc.style.fontSize = '13px';
  matchEndDesc.style.lineHeight = '1.5';
  matchEndCard.appendChild(matchEndDesc);

  const matchEndButtons = document.createElement('div');
  matchEndButtons.style.marginTop = '14px';
  matchEndButtons.style.display = 'grid';
  matchEndButtons.style.gridTemplateColumns = '1fr 1fr';
  matchEndButtons.style.gap = '10px';
  matchEndCard.appendChild(matchEndButtons);

  const endRestartBtn = createButton('Restart', true);
  const endBackBtn = createButton('Back', false);
  matchEndButtons.appendChild(endBackBtn);
  matchEndButtons.appendChild(endRestartBtn);
  endRestartBtn.addEventListener('click', () => callbacks.onRestart());
  endBackBtn.addEventListener('click', () => callbacks.onBack());

  const deathsSeen = new Map<string, number>();
  const killEvents: KillEvent[] = [];

  const updateKillfeed = (state: SanguoShooterUiState): void => {
    for (const e of state.entities) {
      const prev = deathsSeen.get(e.id) ?? 0;
      if (e.deaths <= prev) continue;

      killEvents.push({
        timeSeconds: state.timeSeconds,
        killerId: e.lastAttackerId,
        victimId: e.id,
        weaponId: e.lastWeaponId
      });
      deathsSeen.set(e.id, e.deaths);
    }

    while (killEvents.length > 8) killEvents.shift();

    killfeedEl.textContent = '';
    const now = state.timeSeconds;
    const active = killEvents.filter((k) => now - k.timeSeconds < 6);
    for (const k of active.slice().reverse()) {
      const row = document.createElement('div');
      row.style.background = 'rgba(6, 13, 33, 0.72)';
      row.style.border = '1px solid rgba(255, 255, 255, 0.08)';
      row.style.borderRadius = '12px';
      row.style.padding = '8px 10px';
      row.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.25)';
      row.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
      row.style.fontSize = '12px';
      row.style.color = 'rgba(248, 251, 255, 0.92)';
      const age = now - k.timeSeconds;
      row.style.opacity = String(Math.max(0, Math.min(1, 1 - age / 6)));
      row.textContent = `${k.killerId ?? 'unknown'} > ${k.victimId}${k.weaponId ? ` (${k.weaponId})` : ''}`;
      killfeedEl.appendChild(row);
    }
  };

  const updateScoreboard = (state: SanguoShooterUiState): void => {
    const show = state.scoreboardHeld || state.match.phase === 'ended';
    scoreboardEl.style.display = show ? 'grid' : 'none';

    const modeLabel = `mode=${state.modeId} scene=${state.sceneId}`;
    const timeLabel = describeMatchTime(state.match);
    scoreboardMeta.textContent = '';
    const left = document.createElement('div');
    left.textContent = `${modeLabel} ${timeLabel}`.trim();
    const right = document.createElement('div');
    right.textContent = state.match.phase === 'ended' ? 'ended' : 'playing';
    scoreboardMeta.appendChild(left);
    scoreboardMeta.appendChild(right);

    scoreboardTable.textContent = '';
    const header = document.createElement('tr');
    for (const label of ['id', 'team', 'hp', 'lives', 'k', 'd', 'score', 'flag', 'ai']) {
      const th = document.createElement('th');
      th.textContent = label;
      th.style.textAlign = 'left';
      th.style.padding = '8px 6px';
      th.style.borderBottom = '1px solid rgba(255, 255, 255, 0.12)';
      th.style.color = 'rgba(248, 251, 255, 0.72)';
      header.appendChild(th);
    }
    scoreboardTable.appendChild(header);

    const rows = state.entities
      .slice()
      .sort((a, b) => b.score * 1000 + b.kills * 10 + b.hp - (a.score * 1000 + a.kills * 10 + a.hp));
    for (const rowData of rows) {
      const tr = document.createElement('tr');
      tr.style.opacity = rowData.eliminated ? '0.6' : '1.0';
      tr.style.color = rowData.id === state.humanId ? 'rgba(140, 255, 117, 0.95)' : 'rgba(248, 251, 255, 0.92)';
      for (const val of [
        rowData.id,
        rowData.team,
        `${rowData.hp.toFixed(0)}/${rowData.maxHp.toFixed(0)}`,
        `${rowData.livesLeft}`,
        `${rowData.kills}`,
        `${rowData.deaths}`,
        `${rowData.score}`,
        rowData.carryingFlag ?? '-',
        rowData.isAI ? '1' : '0'
      ]) {
        const td = document.createElement('td');
        td.textContent = val;
        td.style.padding = '7px 6px';
        td.style.borderBottom = '1px solid rgba(255, 255, 255, 0.06)';
        tr.appendChild(td);
      }
      scoreboardTable.appendChild(tr);
    }
  };

  const updatePauseOverlay = (state: SanguoShooterUiState): void => {
    pauseEl.style.display = state.paused && state.match.phase !== 'ended' ? 'grid' : 'none';
  };

  const updateMatchEnd = (state: SanguoShooterUiState): void => {
    if (state.match.phase !== 'ended') {
      matchEndEl.style.display = 'none';
      return;
    }

    matchEndEl.style.display = 'grid';
    matchEndDesc.textContent = describeWinner(state.match);
  };

  const update = (state: SanguoShooterUiState): void => {
    el.style.pointerEvents = state.paused || state.match.phase === 'ended' ? 'auto' : 'none';
    updateKillfeed(state);
    updateScoreboard(state);
    updatePauseOverlay(state);
    updateMatchEnd(state);
  };

  const dispose = (): void => {
    el.remove();
  };

  return { update, dispose };
}

function describeMatchTime(match: MatchState): string {
  if (match.modeId === 'duel') {
    return match.intermissionLeft > 0 ? `intermission=${match.intermissionLeft.toFixed(1)}s` : `round=${match.roundIndex} t=${match.roundTimeLeft.toFixed(1)}s`;
  }
  if (match.modeId === 'ffa') return `t=${match.timeLeft.toFixed(1)}s`;
  if (match.modeId === 'siege') return `t=${match.timeLeft.toFixed(1)}s cap=${match.captureProgress.toFixed(2)} respawns=${match.defenderRespawnsLeft}`;
  return `t=${match.timeLeft.toFixed(1)}s score=${match.score.red}-${match.score.blue}`;
}

function describeWinner(match: MatchState): string {
  if (match.modeId === 'duel') {
    return match.winnerId ? `winner=${match.winnerId}` : 'winner=draw';
  }
  if (match.modeId === 'ffa') {
    return match.winnerId ? `winner=${match.winnerId}` : 'winner=draw';
  }
  if (match.modeId === 'siege') {
    return match.winnerTeam ? `winnerTeam=${match.winnerTeam}` : 'winnerTeam=draw';
  }
  return match.winnerTeam ? `winnerTeam=${match.winnerTeam}` : 'winnerTeam=draw';
}

function createButton(label: string, primary: boolean): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.style.padding = '10px 14px';
  btn.style.borderRadius = '12px';
  btn.style.border = '1px solid rgba(255, 255, 255, 0.12)';
  btn.style.background = primary ? 'linear-gradient(135deg, rgba(140, 255, 117, 0.28), rgba(121, 213, 255, 0.12))' : 'rgba(0, 0, 0, 0.25)';
  btn.style.color = 'rgba(248, 251, 255, 0.95)';
  btn.style.letterSpacing = '0.08em';
  btn.style.textTransform = 'uppercase';
  btn.style.cursor = 'pointer';
  return btn;
}
