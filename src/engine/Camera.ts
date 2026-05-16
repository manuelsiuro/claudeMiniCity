import * as THREE from 'three';
import {
  GRID_SIZE,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_DEFAULT,
  CAMERA_PITCH,
} from '../config/constants';

const PAN_PADDING = 6;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export class IsoCamera {
  readonly camera: THREE.OrthographicCamera;
  target = new THREE.Vector3(GRID_SIZE / 2, 0, GRID_SIZE / 2);

  yawIndex: 0 | 1 | 2 | 3 = 0;
  private yawCurrent = 0;
  private yawTarget = 0;

  zoom = CAMERA_ZOOM_DEFAULT;
  private zoomTarget = CAMERA_ZOOM_DEFAULT;

  private aspect = 1;

  private _right = new THREE.Vector3();
  private _ground = new THREE.Vector3();

  private shake = 0;
  private shakeOff = new THREE.Vector3();

  constructor(width: number, height: number) {
    this.aspect = width / height;
    this.camera = new THREE.OrthographicCamera(
      -this.zoom * this.aspect,
      this.zoom * this.aspect,
      this.zoom,
      -this.zoom,
      0.1,
      400,
    );
    this.applyProjection();
    this.applyPose();
  }

  setViewport(width: number, height: number): void {
    this.aspect = width / height;
    this.applyProjection();
  }

  pan(screenDxPx: number, screenDyPx: number, viewportH: number): void {
    // World units per pixel (vertical because frustum top/bottom = ±zoom)
    const worldPerPx = (this.zoom * 2) / viewportH;

    // Camera right vector projected on ground (XZ).
    this.camera.getWorldDirection(this._ground);          // forward
    this._right.setFromMatrixColumn(this.camera.matrix, 0); // camera local +X
    this._right.y = 0;
    this._right.normalize();

    // Forward-on-ground = perpendicular to right in XZ plane.
    const fwdX = -this._right.z;
    const fwdZ = this._right.x;

    // Drag right → world moves right under finger → target moves LEFT.
    // Drag down (positive screenDy) → world moves down → target moves toward camera (toward viewer).
    const k = worldPerPx;
    this.target.x += (-screenDxPx * this._right.x + screenDyPx * -fwdX) * k;
    this.target.z += (-screenDxPx * this._right.z + screenDyPx * -fwdZ) * k;
    this.target.x = clamp(this.target.x, -PAN_PADDING, GRID_SIZE + PAN_PADDING);
    this.target.z = clamp(this.target.z, -PAN_PADDING, GRID_SIZE + PAN_PADDING);
  }

  zoomBy(factor: number): void {
    this.zoomTarget = clamp(this.zoomTarget * factor, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
  }

  zoomTo(value: number): void {
    this.zoomTarget = clamp(value, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
  }

  shakePulse(intensity: number): void {
    this.shake = Math.min(2.0, Math.max(this.shake, intensity));
  }

  snapRotate(dir: 1 | -1): void {
    this.yawIndex = (((this.yawIndex + dir) % 4) + 4) % 4 as 0 | 1 | 2 | 3;
    // Target accumulates so we always rotate the short way.
    this.yawTarget += dir * Math.PI / 2;
  }

  update(dt: number): void {
    // Smooth yaw + zoom toward targets.
    const ya = 1 - Math.exp(-dt * 9);
    this.yawCurrent += (this.yawTarget - this.yawCurrent) * ya;
    const za = 1 - Math.exp(-dt * 7);
    const newZoom = this.zoom + (this.zoomTarget - this.zoom) * za;
    if (Math.abs(newZoom - this.zoom) > 0.0005) {
      this.zoom = newZoom;
      this.applyProjection();
    }
    // Decay shake.
    this.shake *= Math.exp(-dt * 5);
    if (this.shake > 0.01) {
      this.shakeOff.set(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
      );
    } else {
      this.shake = 0;
      this.shakeOff.set(0, 0, 0);
    }
    this.applyPose();
  }

  private applyProjection(): void {
    this.camera.left = -this.zoom * this.aspect;
    this.camera.right = this.zoom * this.aspect;
    this.camera.top = this.zoom;
    this.camera.bottom = -this.zoom;
    this.camera.updateProjectionMatrix();
  }

  private applyPose(): void {
    const dist = 80;
    const cosP = Math.cos(CAMERA_PITCH);
    const sinP = Math.sin(CAMERA_PITCH);
    const ox = dist * cosP * Math.sin(this.yawCurrent);
    const oz = dist * cosP * Math.cos(this.yawCurrent);
    const oy = dist * sinP;
    this.camera.position.set(
      this.target.x + ox + this.shakeOff.x,
      this.target.y + oy + this.shakeOff.y,
      this.target.z + oz + this.shakeOff.z,
    );
    this.camera.lookAt(this.target);
  }
}
