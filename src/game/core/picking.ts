import * as THREE from 'three';

export type GroundHit = {
  point: THREE.Vector3;
  distance: number;
};

export class GroundPicker {
  private readonly raycaster = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly tmpPoint = new THREE.Vector3();
  private readonly tmpNdc = new THREE.Vector2();

  setGroundY(y: number): void {
    this.plane.constant = -y;
  }

  pick(camera: THREE.Camera, ndcX: number, ndcY: number): GroundHit | null {
    this.tmpNdc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.tmpNdc, camera);
    const ray = this.raycaster.ray;
    const hit = ray.intersectPlane(this.plane, this.tmpPoint);
    if (!hit) return null;
    const distance = ray.origin.distanceTo(this.tmpPoint);
    return { point: this.tmpPoint.clone(), distance };
  }
}
