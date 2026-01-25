import * as THREE from 'three';
import { createSanguoShooterApp } from './app/createSanguoShooterApp';
import { validateStaticConfigs } from './config/validate';
import { getRequiredCanvas } from './core/dom';
import { startFixedLoop } from './core/loop';

validateStaticConfigs();

const canvas = getRequiredCanvas('gameCanvas');
const app = createSanguoShooterApp(canvas);

const clock = new THREE.Clock();
startFixedLoop(
  { clock, fixedDt: 1 / 120 },
  {
    onStep: (fixedDt) => app.step(fixedDt),
    onFrame: (alpha) => app.frame(alpha)
  }
);
