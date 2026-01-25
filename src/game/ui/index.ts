import type { SanguoShooterApp } from '../app/createSanguoShooterApp';
import type { SanguoShooterUiState } from '../app/uiState';
import { createHud } from './hud';
import { createMenu } from './menu';
import { createOverlays } from './overlays';
import { createScreenFx } from '../fx/screenFx';

export type UiManager = {
  update: (state: SanguoShooterUiState) => void;
  dispose: () => void;
};

export function createSanguoShooterUi(root: HTMLElement, app: SanguoShooterApp): UiManager {
  const hud = createHud(root);
  const menu = createMenu(root);
  const overlays = createOverlays(root, {
    onResume: () => app.setPaused(false),
    onRestart: () => window.location.reload(),
    onOpenMenu: () => menu.show(true),
    onBack: () => (window.location.href = '/')
  });
  const canvas = root.querySelector('canvas');
  const screenFx = canvas instanceof HTMLCanvasElement ? createScreenFx(root, canvas) : null;

  const params = new URLSearchParams(window.location.search);
  menu.show(!params.get('mode') && !params.get('scene'));

  return {
    update: (state) => {
      hud.update(state);
      overlays.update(state);
      menu.update(state);
      screenFx?.update(state);
    },
    dispose: () => {
      hud.dispose();
      overlays.dispose();
      menu.dispose();
      screenFx?.dispose();
    }
  };
}
