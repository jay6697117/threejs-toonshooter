import type { SanguoShooterUiState } from '../app/uiState';

export type ScreenFx = {
  update: (state: SanguoShooterUiState) => void;
  dispose: () => void;
};

export function createScreenFx(root: HTMLElement, canvas: HTMLCanvasElement): ScreenFx {
  const el = document.createElement('div');
  el.dataset.ui = 'screenFx';
  el.style.position = 'absolute';
  el.style.inset = '0';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '8';
  root.appendChild(el);

  const hitFlash = document.createElement('div');
  hitFlash.style.position = 'absolute';
  hitFlash.style.inset = '0';
  hitFlash.style.background = 'rgba(255, 255, 255, 1)';
  hitFlash.style.opacity = '0';
  el.appendChild(hitFlash);

  const vignette = document.createElement('div');
  vignette.style.position = 'absolute';
  vignette.style.inset = '0';
  vignette.style.background = 'radial-gradient(circle at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.6) 100%)';
  vignette.style.opacity = '0.0';
  el.appendChild(vignette);

  const slowmoTint = document.createElement('div');
  slowmoTint.style.position = 'absolute';
  slowmoTint.style.inset = '0';
  slowmoTint.style.background = 'linear-gradient(180deg, rgba(40, 80, 160, 0.28) 0%, rgba(0, 0, 0, 0) 70%)';
  slowmoTint.style.opacity = '0';
  el.appendChild(slowmoTint);

  const nearMiss = document.createElement('div');
  nearMiss.style.position = 'absolute';
  nearMiss.style.inset = '0';
  nearMiss.style.background = 'radial-gradient(circle at center, rgba(0,0,0,0) 42%, rgba(35, 222, 255, 0.18) 78%, rgba(35, 222, 255, 0.32) 100%)';
  nearMiss.style.opacity = '0';
  el.appendChild(nearMiss);

  let lastHp = Number.NaN;
  let hitFlashAmount = 0;
  let lastTimeMs = performance.now();

  const update = (state: SanguoShooterUiState): void => {
    const now = performance.now();
    const dt = Math.max(0, (now - lastTimeMs) / 1000);
    lastTimeMs = now;

    const hp = state.human.hp;
    if (Number.isFinite(lastHp) && hp < lastHp - 0.01) {
      hitFlashAmount = Math.max(hitFlashAmount, 0.85);
    }
    lastHp = hp;

    hitFlashAmount = Math.max(0, hitFlashAmount - dt * 2.6);
    hitFlash.style.opacity = String(hitFlashAmount);

    const hpPct = state.human.maxHp > 0 ? Math.max(0, Math.min(1, state.human.hp / state.human.maxHp)) : 0;
    const vignetteAmount = Math.max(0, Math.min(1, (0.55 - hpPct) / 0.55));
    vignette.style.opacity = String(vignetteAmount * 0.65);

    const slowmoAmount = state.timeScale < 0.999 ? Math.max(0, Math.min(1, (1 - state.timeScale) / 0.75)) : 0;
    slowmoTint.style.opacity = String(slowmoAmount * 0.22);

    const nearMissAmount = Math.max(0, Math.min(1, state.nearMissAmount));
    nearMiss.style.opacity = String(nearMissAmount * 0.75);

    const blind = state.human.statuses.filter((s) => s.id === 'blind').reduce((m, s) => Math.max(m, s.timeLeft), 0);
    if (blind > 0) {
      const blur = 3 + Math.min(6, blind * 1.2);
      canvas.style.filter = `blur(${blur.toFixed(1)}px) brightness(1.05)`;
    } else {
      canvas.style.filter = '';
    }
  };

  const dispose = (): void => {
    canvas.style.filter = '';
    el.remove();
  };

  return { update, dispose };
}
