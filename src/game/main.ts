import * as THREE from 'three';
import { createSanguoShooterApp } from './app/createSanguoShooterApp';
import { validateStaticConfigs } from './config/validate';
import { getRequiredCanvas } from './core/dom';
import { startFixedLoop } from './core/loop';
import { createSanguoShooterUi } from './ui';

validateStaticConfigs();

const canvas = getRequiredCanvas('gameCanvas');
const app = createSanguoShooterApp(canvas);
const ui = createSanguoShooterUi(canvas.parentElement ?? document.body, app);

const clock = new THREE.Clock();
const stop = startFixedLoop(
  { clock, fixedDt: 1 / 120 },
  {
    onBeginFrame: (frameDt) => app.beginFrame(frameDt),
    onStep: (fixedDt) => app.step(fixedDt),
    onFrame: (alpha) => {
      app.frame(alpha);
      ui.update(app.getUiState());
    }
  }
);

window.addEventListener('beforeunload', () => {
  stop();
  ui.dispose();
  app.dispose();
});
