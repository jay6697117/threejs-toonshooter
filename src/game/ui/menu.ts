import { CHARACTER_CONFIGS } from '../config/characters';
import { DIFFICULTY_CONFIGS, DIFFICULTY_IDS, type DifficultyId } from '../config/difficulty';
import { MODE_CONFIGS } from '../config/modes';
import { SCENE_CONFIGS } from '../config/scenes';
import { CHARACTER_IDS, MODE_IDS, SCENE_IDS, type CharacterId, type ModeId, type SceneId } from '../config/ids';
import type { SanguoShooterUiState } from '../app/uiState';

export type MenuUi = {
  update: (state: SanguoShooterUiState) => void;
  show: (value: boolean) => void;
  dispose: () => void;
};

export function createMenu(root: HTMLElement): MenuUi {
  const el = document.createElement('div');
  el.dataset.ui = 'menu';
  el.style.position = 'absolute';
  el.style.inset = '0';
  el.style.zIndex = '20';
  el.style.display = 'none';
  el.style.placeItems = 'center';
  el.style.background = 'rgba(2, 3, 8, 0.72)';
  el.style.backdropFilter = 'blur(10px)';
  el.style.pointerEvents = 'auto';
  root.appendChild(el);

  const card = document.createElement('div');
  card.style.width = 'min(92vw, 720px)';
  card.style.borderRadius = '18px';
  card.style.background = 'rgba(6, 13, 33, 0.82)';
  card.style.border = '1px solid rgba(255, 255, 255, 0.08)';
  card.style.boxShadow = '0 40px 80px rgba(0, 0, 0, 0.45)';
  card.style.padding = '18px';
  el.appendChild(card);

  const title = document.createElement('div');
  title.textContent = 'Match Setup';
  title.style.fontWeight = '800';
  title.style.letterSpacing = '0.08em';
  title.style.textTransform = 'uppercase';
  card.appendChild(title);

  const desc = document.createElement('div');
  desc.textContent = 'Pick mode, arena, and difficulty. Placeholder assets are expected.';
  desc.style.marginTop = '8px';
  desc.style.color = 'rgba(248, 251, 255, 0.72)';
  desc.style.fontSize = '13px';
  desc.style.lineHeight = '1.4';
  card.appendChild(desc);

  const grid = document.createElement('div');
  grid.style.marginTop = '14px';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = '1fr 1fr';
  grid.style.gap = '12px';
  card.appendChild(grid);

  const modeSelect = createSelectRow<ModeId>('Mode', MODE_IDS, (id) => MODE_CONFIGS[id].name);
  const sceneSelect = createSelectRow<SceneId>('Arena', SCENE_IDS, (id) => SCENE_CONFIGS[id].name);
  const difficultySelect = createSelectRow<DifficultyId>('Difficulty', DIFFICULTY_IDS, (id) => DIFFICULTY_CONFIGS[id].name);
  const characterSelect = createSelectRow<CharacterId>('Character', CHARACTER_IDS, (id) => CHARACTER_CONFIGS[id].name);

  for (const node of [modeSelect.row, sceneSelect.row, difficultySelect.row, characterSelect.row]) {
    grid.appendChild(node);
  }

  const footer = document.createElement('div');
  footer.style.marginTop = '16px';
  footer.style.display = 'flex';
  footer.style.justifyContent = 'space-between';
  footer.style.gap = '12px';
  footer.style.flexWrap = 'wrap';
  card.appendChild(footer);

  const leftHint = document.createElement('div');
  leftHint.textContent = 'Tip: use ?mode=...&scene=... in URL for quick sharing.';
  leftHint.style.color = 'rgba(248, 251, 255, 0.55)';
  leftHint.style.fontSize = '12px';
  leftHint.style.lineHeight = '1.4';
  footer.appendChild(leftHint);

  const buttons = document.createElement('div');
  buttons.style.display = 'flex';
  buttons.style.gap = '10px';
  footer.appendChild(buttons);

  const startBtn = createButton('Start', true);
  const closeBtn = createButton('Close', false);
  buttons.appendChild(closeBtn);
  buttons.appendChild(startBtn);

  const applyAndReload = (): void => {
    const params = new URLSearchParams(window.location.search);
    params.set('mode', modeSelect.get());
    params.set('scene', sceneSelect.get());
    params.set('difficulty', difficultySelect.get());
    params.set('character', characterSelect.get());
    window.location.search = params.toString();
  };

  startBtn.addEventListener('click', () => applyAndReload());
  closeBtn.addEventListener('click', () => show(false));

  let visible = false;
  let needsHydrate = true;

  const show = (value: boolean): void => {
    visible = value;
    needsHydrate = value;
    el.style.display = value ? 'grid' : 'none';
  };

  const update = (state: SanguoShooterUiState): void => {
    if (!visible) return;
    if (!needsHydrate) return;

    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const scene = params.get('scene');
    const difficulty = params.get('difficulty');
    const character = params.get('character');

    if (isModeId(mode)) modeSelect.set(mode);
    else modeSelect.set(state.modeId);

    if (isSceneId(scene)) sceneSelect.set(scene);
    else sceneSelect.set(state.sceneId);

    if (isDifficultyId(difficulty)) difficultySelect.set(difficulty);
    else difficultySelect.set('normal');

    if (isCharacterId(character)) characterSelect.set(character);
    else characterSelect.set('liuBei');

    needsHydrate = false;
  };

  const dispose = (): void => {
    el.remove();
  };

  return { update, show, dispose };
}

function createSelectRow<T extends string>(label: string, ids: readonly T[], getName: (id: T) => string): { row: HTMLDivElement; get: () => T; set: (v: T) => void } {
  const row = document.createElement('div');
  row.style.display = 'grid';
  row.style.gap = '6px';

  const l = document.createElement('div');
  l.textContent = label;
  l.style.fontSize = '12px';
  l.style.letterSpacing = '0.08em';
  l.style.textTransform = 'uppercase';
  l.style.color = 'rgba(248, 251, 255, 0.72)';
  row.appendChild(l);

  const select = document.createElement('select');
  select.style.width = '100%';
  select.style.padding = '10px 10px';
  select.style.borderRadius = '12px';
  select.style.border = '1px solid rgba(255, 255, 255, 0.12)';
  select.style.background = 'rgba(0, 0, 0, 0.25)';
  select.style.color = 'rgba(248, 251, 255, 0.95)';
  select.style.fontSize = '14px';

  for (const id of ids) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `${getName(id)} (${id})`;
    select.appendChild(option);
  }
  row.appendChild(select);

  return {
    row,
    get: () => select.value as T,
    set: (v) => {
      select.value = v;
    }
  };
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

function isModeId(value: string | null): value is ModeId {
  if (!value) return false;
  return (MODE_IDS as readonly string[]).includes(value);
}

function isSceneId(value: string | null): value is SceneId {
  if (!value) return false;
  return (SCENE_IDS as readonly string[]).includes(value);
}

function isDifficultyId(value: string | null): value is DifficultyId {
  if (!value) return false;
  return (DIFFICULTY_IDS as readonly string[]).includes(value);
}

function isCharacterId(value: string | null): value is CharacterId {
  if (!value) return false;
  return (CHARACTER_IDS as readonly string[]).includes(value);
}
