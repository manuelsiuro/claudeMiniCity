import * as THREE from 'three';
import { GRID_SIZE, TILE_SIZE } from '../config/constants';

export type TileHit = { x: number; y: number; worldY: number };

export class Picker {
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();

  constructor(
    private camera: THREE.Camera,
    private terrain: THREE.Object3D,
  ) {}

  pickTile(screenX: number, screenY: number, w: number, h: number): TileHit | null {
    this.ndc.x = (screenX / w) * 2 - 1;
    this.ndc.y = -(screenY / h) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.terrain, true);
    if (!hits.length) return null;
    const p = hits[0].point;
    const x = Math.floor(p.x / TILE_SIZE);
    const y = Math.floor(p.z / TILE_SIZE);
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return null;
    return { x, y, worldY: p.y };
  }
}
