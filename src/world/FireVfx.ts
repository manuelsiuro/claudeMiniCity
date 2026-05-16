// Flickering fire + smoke visual for burning buildings.
// Keeps one tiny group per fire; sync() called every render frame.

import * as THREE from 'three';
import type { GameState } from '../types';
import { BUILDINGS } from '../config/buildings';
import { COLOR, TILE_SIZE } from '../config/constants';
import { footprintHeight } from './Grid';

type Entry = {
  group: THREE.Group;
  flame: THREE.Mesh;
  smoke: THREE.Mesh;
  phase: number;
};

export class FireVfx {
  private root = new THREE.Group();
  private byId = new Map<number, Entry>();
  private flameGeom: THREE.BufferGeometry;
  private smokeGeom: THREE.BufferGeometry;
  private flameMat: THREE.MeshBasicMaterial;
  private smokeMat: THREE.MeshBasicMaterial;

  constructor(parent: THREE.Object3D) {
    this.root.name = 'fireVfx';
    parent.add(this.root);

    this.flameGeom = new THREE.BoxGeometry(0.4, 0.5, 0.4);
    this.flameMat = new THREE.MeshBasicMaterial({
      color: COLOR.fire,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    this.smokeGeom = new THREE.BoxGeometry(0.45, 0.30, 0.45);
    this.smokeMat = new THREE.MeshBasicMaterial({
      color: COLOR.smoke,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
  }

  sync(state: GameState): void {
    // Add for burning
    for (const b of state.buildings.values()) {
      if (b.burning === undefined) {
        if (this.byId.has(b.id)) this.remove(b.id);
        continue;
      }
      if (!this.byId.has(b.id)) this.add(b.id, b, state);
    }
    // Remove vfx for deleted buildings
    for (const [id] of this.byId.entries()) {
      if (!state.buildings.has(id)) this.remove(id);
    }
  }

  update(dt: number): void {
    const t = performance.now() * 0.008;
    for (const e of this.byId.values()) {
      const f = 0.7 + 0.3 * Math.sin(t + e.phase * 3.1);
      e.flame.scale.set(0.9 + 0.4 * f, 1.0 + 0.5 * f, 0.9 + 0.4 * f);
      // bob the flame around a fixed offset, no drift
      e.flame.position.y = 0.6 + 0.04 * Math.sin(t * 2 + e.phase);
      const flMat = e.flame.material as THREE.MeshBasicMaterial;
      const goldMix = 0.5 + 0.5 * Math.sin(t * 3 + e.phase * 5);
      flMat.color.setRGB(1.0, 0.45 + 0.35 * goldMix, 0.15 + 0.15 * goldMix);

      // Smoke rises from baseline 1.0 to 2.2 (local), then resets
      const sMat = e.smoke.material as THREE.MeshBasicMaterial;
      e.smoke.position.y += dt * 0.55;
      const rise = e.smoke.position.y;
      const fade = Math.max(0, Math.min(1, (2.2 - rise) / 1.2));
      sMat.opacity = 0.55 * fade;
      e.smoke.scale.setScalar(1 + (1.2 - fade) * 0.6);
      if (rise > 2.2) {
        e.smoke.position.y = 1.0;
        sMat.opacity = 0.55;
      }
    }
  }

  private add(id: number, b: GameState['buildings'] extends Map<unknown, infer V> ? V : never, state: GameState): void {
    const def = BUILDINGS[b.type];
    const center = {
      cx: (b.x + def.footprint / 2) * TILE_SIZE,
      cz: (b.y + def.footprint / 2) * TILE_SIZE,
    };
    const baseY = footprintHeight(state.tiles, b.x, b.y, def.footprint);

    const group = new THREE.Group();
    group.position.set(center.cx, baseY, center.cz);
    const flame = new THREE.Mesh(this.flameGeom, this.flameMat.clone());
    flame.position.y = 0.6;
    const smoke = new THREE.Mesh(this.smokeGeom, this.smokeMat.clone());
    smoke.position.y = 1.1;
    group.add(flame, smoke);
    this.root.add(group);
    this.byId.set(id, { group, flame, smoke, phase: Math.random() * Math.PI * 2 });
  }

  private remove(id: number): void {
    const e = this.byId.get(id);
    if (!e) return;
    this.root.remove(e.group);
    (e.flame.material as THREE.Material).dispose();
    (e.smoke.material as THREE.Material).dispose();
    this.byId.delete(id);
  }

  dispose(): void {
    for (const id of [...this.byId.keys()]) this.remove(id);
    this.flameGeom.dispose();
    this.smokeGeom.dispose();
    this.flameMat.dispose();
    this.smokeMat.dispose();
  }
}
