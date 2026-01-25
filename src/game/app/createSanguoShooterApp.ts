import * as THREE from 'three';
import { createRenderer } from '../core/renderer';
import { resizeRendererToDisplaySize } from '../core/resize';

export type SanguoShooterApp = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  step: (fixedDt: number) => void;
  frame: (alpha: number) => void;
};

export function createSanguoShooterApp(canvas: HTMLCanvasElement): SanguoShooterApp {
  const renderer = createRenderer(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f1c);

  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);
  camera.position.set(0, 4.2, 6.8);
  camera.lookAt(0, 0.9, 0);

  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x7a5b3a, 0.65);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xfff2d6, 1.05);
  dir.position.set(6, 10, 8);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 40;
  dir.shadow.camera.left = -12;
  dir.shadow.camera.right = 12;
  dir.shadow.camera.top = 12;
  dir.shadow.camera.bottom = -12;
  scene.add(dir);

  const groundGeo = new THREE.PlaneGeometry(24, 18);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x263143, roughness: 0.95, metalness: 0.0 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const playerGeo = new THREE.CapsuleGeometry(0.35, 0.9, 6, 12);
  const playerMat = new THREE.MeshStandardMaterial({ color: 0x45d16e, roughness: 0.65, metalness: 0.1 });
  const player = new THREE.Mesh(playerGeo, playerMat);
  player.position.set(0, 0.95, 0);
  player.castShadow = true;
  scene.add(player);

  let spin = 0;

  const step = (fixedDt: number): void => {
    spin += fixedDt * 0.8;
  };

  const frame = (_alpha: number): void => {
    player.rotation.y = spin;

    if (resizeRendererToDisplaySize(renderer)) {
      const { clientWidth, clientHeight } = renderer.domElement;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
  };

  return { renderer, scene, camera, step, frame };
}
