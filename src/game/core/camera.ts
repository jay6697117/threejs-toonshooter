import * as THREE from 'three';

export type CameraRigOptions = {
  fov: number;
  near: number;
  far: number;
  offset: THREE.Vector3;
  lookAtOffset: THREE.Vector3;
};

export type ScreenShakeOptions = {
  durationSeconds: number;
  intensityMeters: number;
};

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;

  private readonly offset: THREE.Vector3;
  private readonly lookAtOffset: THREE.Vector3;

  private targetPos = new THREE.Vector3();

  private shakeTimeLeft = 0;
  private shakeDuration = 0;
  private shakeIntensity = 0;

  private fovBase: number;
  private fovPulseTimeLeft = 0;
  private fovPulseDuration = 0;
  private fovPulseAmount = 0;

  constructor(options: CameraRigOptions) {
    this.camera = new THREE.PerspectiveCamera(options.fov, 16 / 9, options.near, options.far);
    this.offset = options.offset.clone();
    this.lookAtOffset = options.lookAtOffset.clone();
    this.fovBase = options.fov;
  }

  setTargetPosition(pos: THREE.Vector3): void {
    this.targetPos.copy(pos);
  }

  addScreenShake(options: ScreenShakeOptions): void {
    this.shakeDuration = Math.max(this.shakeDuration, options.durationSeconds);
    this.shakeTimeLeft = Math.max(this.shakeTimeLeft, options.durationSeconds);
    this.shakeIntensity = Math.max(this.shakeIntensity, options.intensityMeters);
  }

  pulseFov(amount: number, durationSeconds: number): void {
    this.fovPulseAmount = Math.max(this.fovPulseAmount, amount);
    this.fovPulseDuration = Math.max(this.fovPulseDuration, durationSeconds);
    this.fovPulseTimeLeft = this.fovPulseDuration;
  }

  update(dt: number): void {
    if (this.shakeTimeLeft > 0) {
      this.shakeTimeLeft = Math.max(0, this.shakeTimeLeft - dt);
      if (this.shakeTimeLeft === 0) {
        this.shakeDuration = 0;
        this.shakeIntensity = 0;
      }
    }

    if (this.fovPulseTimeLeft > 0) {
      this.fovPulseTimeLeft = Math.max(0, this.fovPulseTimeLeft - dt);
    }
  }

  applyToCamera(): void {
    const shake = this.getShakeOffset();
    const desiredPos = this.targetPos.clone().add(this.offset).add(shake);
    this.camera.position.copy(desiredPos);

    const lookAtPos = this.targetPos.clone().add(this.lookAtOffset);
    this.camera.lookAt(lookAtPos);

    this.camera.fov = this.fovBase + this.getFovPulseOffset();
    this.camera.updateProjectionMatrix();
  }

  private getShakeOffset(): THREE.Vector3 {
    if (this.shakeTimeLeft <= 0 || this.shakeIntensity <= 0) return ZERO;
    const timeRatio = this.shakeDuration > 0 ? this.shakeTimeLeft / this.shakeDuration : 0;
    const amount = this.shakeIntensity * Math.max(0, Math.min(1, timeRatio));
    return new THREE.Vector3(
      (Math.random() * 2 - 1) * amount,
      (Math.random() * 2 - 1) * amount,
      (Math.random() * 2 - 1) * amount
    );
  }

  private getFovPulseOffset(): number {
    if (this.fovPulseDuration <= 0 || this.fovPulseAmount <= 0) return 0;
    if (this.fovPulseTimeLeft <= 0) return 0;
    const t = 1 - this.fovPulseTimeLeft / this.fovPulseDuration;
    const eased = 1 - (1 - t) * (1 - t);
    return this.fovPulseAmount * (1 - eased);
  }
}

const ZERO = new THREE.Vector3(0, 0, 0);
