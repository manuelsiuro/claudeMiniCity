// Connectivity-aware road stripes drawn on top of the basic road slab.
// For each road tile, emits one short stripe in every cardinal direction
// where the 4-neighbour is also a road.  The result is a network that
// reads as a network — straights through, L-corners, T-junctions, X-crosses.

import * as THREE from 'three';
import type { GameState } from '../types';
import { GRID_SIZE, TILE_SIZE, COLOR } from '../config/constants';
import { footprintHeight, getTile } from './Grid';

const MAX_SPOKES = GRID_SIZE * GRID_SIZE * 4;

export class RoadOverlay {
  readonly group = new THREE.Group();
  private spoke: THREE.InstancedMesh;
  private centre: THREE.InstancedMesh;
  private scratchM = new THREE.Matrix4();
  private scratchP = new THREE.Vector3();
  private scratchQ = new THREE.Quaternion();
  private scratchE = new THREE.Euler();
  private scratchS = new THREE.Vector3(1, 1, 1);

  constructor() {
    this.group.name = 'roadOverlay';

    // Spoke geometry: a thin yellow stripe extending in +Z from origin.
    const spokeGeo = new THREE.BoxGeometry(0.08, 0.015, 0.55);
    spokeGeo.translate(0, 0, 0.275);
    const spokeMat = new THREE.MeshBasicMaterial({
      color: COLOR.yellow,
      transparent: false,
    });
    this.spoke = new THREE.InstancedMesh(spokeGeo, spokeMat, MAX_SPOKES);
    this.spoke.count = 0;
    this.spoke.frustumCulled = false;
    this.group.add(this.spoke);

    // Centre patch: shown on isolated roads (so they're still readable).
    const centreGeo = new THREE.BoxGeometry(0.20, 0.015, 0.20);
    const centreMat = new THREE.MeshBasicMaterial({ color: COLOR.yellow });
    this.centre = new THREE.InstancedMesh(centreGeo, centreMat, GRID_SIZE * GRID_SIZE);
    this.centre.count = 0;
    this.centre.frustumCulled = false;
    this.group.add(this.centre);
  }

  sync(state: GameState): void {
    let sCount = 0;
    let cCount = 0;
    for (const b of state.buildings.values()) {
      if (b.type !== 'road') continue;
      const baseY = footprintHeight(state.tiles, b.x, b.y, 1) + 0.055;
      const cx = (b.x + 0.5) * TILE_SIZE;
      const cz = (b.y + 0.5) * TILE_SIZE;

      // Directions: dx, dz, yaw about Y.  Default geometry points +Z.
      //   +Z  (south, dz= +1)  yaw  = 0
      //   -Z  (north, dz= -1)  yaw  = π
      //   +X  (east,  dx= +1)  yaw  = -π/2  (rotate +Z to +X is -π/2 about Y)
      //   -X  (west,  dx= -1)  yaw  = +π/2
      const dirs: Array<[number, number, number]> = [
        [0, 1, 0],
        [0, -1, Math.PI],
        [1, 0, -Math.PI / 2],
        [-1, 0, Math.PI / 2],
      ];
      let neighbourCount = 0;
      for (const [dx, dz, yaw] of dirs) {
        const t = getTile(state.tiles, b.x + dx, b.y + dz);
        if (!t || t.buildingId === null) continue;
        const nb = state.buildings.get(t.buildingId);
        if (!nb || nb.type !== 'road') continue;
        neighbourCount++;
        // Place a spoke pointing toward this neighbour.
        this.scratchP.set(cx, baseY, cz);
        this.scratchE.set(0, yaw, 0);
        this.scratchQ.setFromEuler(this.scratchE);
        this.scratchM.compose(this.scratchP, this.scratchQ, this.scratchS);
        if (sCount < MAX_SPOKES) {
          this.spoke.setMatrixAt(sCount++, this.scratchM);
        }
      }

      if (neighbourCount === 0) {
        // Isolated road — show centre pip so the slab doesn't look blank.
        this.scratchP.set(cx, baseY, cz);
        this.scratchQ.identity();
        this.scratchM.compose(this.scratchP, this.scratchQ, this.scratchS);
        this.centre.setMatrixAt(cCount++, this.scratchM);
      }
    }
    this.spoke.count = sCount;
    this.centre.count = cCount;
    this.spoke.instanceMatrix.needsUpdate = true;
    this.centre.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    (this.spoke.geometry as THREE.BufferGeometry).dispose();
    (this.spoke.material as THREE.Material).dispose();
    (this.centre.geometry as THREE.BufferGeometry).dispose();
    (this.centre.material as THREE.Material).dispose();
  }
}
