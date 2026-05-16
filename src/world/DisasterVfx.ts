// In-world visuals for pending raids + active plague.
// Re-uses simple meshes; updated each render frame from state.

import * as THREE from 'three';
import type { GameState } from '../types';
import { BUILDINGS } from '../config/buildings';
import { GRID_SIZE, TILE_SIZE, COLOR } from '../config/constants';
import { footprintHeight } from './Grid';

export class DisasterVfx {
  readonly group = new THREE.Group();

  // Raid marker: a tall pyramid mounted on the edge of the map.
  private raidMarker: THREE.Mesh;
  private raidVisible = false;

  // Raid beam: a thin line connecting the marker to the threatened building.
  private raidBeam: THREE.Mesh;

  // Plague mist: green dome over the city.
  private plagueDome: THREE.Mesh;
  private plagueVisible = false;

  private scratch = new THREE.Vector3();

  constructor() {
    this.group.name = 'disasterVfx';

    // Raid marker — red cone above a small plinth.
    const markerGroup = new THREE.Group();
    const coneGeo = new THREE.ConeGeometry(0.45, 1.0, 6);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xff3a3a,
      transparent: true,
      opacity: 0.92,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = 0.9;
    markerGroup.add(cone);
    const baseGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.30, 8);
    const baseMat = new THREE.MeshBasicMaterial({ color: 0x8a1010, transparent: true, opacity: 0.95 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.15;
    markerGroup.add(base);
    markerGroup.visible = false;
    this.group.add(markerGroup);
    this.raidMarker = markerGroup as unknown as THREE.Mesh;

    // Raid beam — a thin red strip from marker to target.
    const beamGeo = new THREE.PlaneGeometry(1, 0.06);
    beamGeo.translate(0.5, 0, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xff5a4a,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.raidBeam = new THREE.Mesh(beamGeo, beamMat);
    this.raidBeam.visible = false;
    this.group.add(this.raidBeam);

    // Plague dome — green hemisphere.
    const domeGeo = new THREE.SphereGeometry(8, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x6cd66f,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.plagueDome = new THREE.Mesh(domeGeo, domeMat);
    this.plagueDome.visible = false;
    this.group.add(this.plagueDome);
  }

  update(_dt: number, state: GameState): void {
    const t = performance.now() * 0.003;
    // ---- RAID ----
    const raid = state.disasters.find(d => d.kind === 'raid' && d.data?.phase === 0);
    if (raid && raid.data && raid.data.targetId !== undefined) {
      const tgt = state.buildings.get(raid.data.targetId!);
      if (tgt) {
        const fp = BUILDINGS[tgt.type].footprint;
        const tx = (tgt.x + fp / 2) * TILE_SIZE;
        const tz = (tgt.y + fp / 2) * TILE_SIZE;
        // Project to nearest edge.
        let ex = tx, ez = tz;
        const dxLeft = tx;
        const dxRight = GRID_SIZE - tx;
        const dzTop = tz;
        const dzBottom = GRID_SIZE - tz;
        const m = Math.min(dxLeft, dxRight, dzTop, dzBottom);
        if (m === dxLeft) ex = -0.5;
        else if (m === dxRight) ex = GRID_SIZE + 0.5;
        else if (m === dzTop) ez = -0.5;
        else ez = GRID_SIZE + 0.5;
        const baseY = footprintHeight(state.tiles, Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(ex))), Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(ez))), 1);
        this.raidMarker.position.set(ex, baseY, ez);
        const bob = 1 + Math.sin(t * 2) * 0.06;
        this.raidMarker.scale.set(bob, bob, bob);
        this.raidMarker.visible = true;
        // pulse opacity of cone
        const ch = this.raidMarker as unknown as THREE.Group;
        const cone = ch.children[0] as THREE.Mesh;
        (cone.material as THREE.MeshBasicMaterial).opacity = 0.7 + 0.3 * Math.abs(Math.sin(t * 3));

        // Beam to target
        this.scratch.set(tx - ex, 0, tz - ez);
        const len = this.scratch.length();
        const yaw = Math.atan2(this.scratch.x, this.scratch.z);
        this.raidBeam.position.set(ex, baseY + 0.6, ez);
        this.raidBeam.rotation.set(0, yaw - Math.PI / 2, 0);
        this.raidBeam.scale.set(len, 1, 1);
        (this.raidBeam.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.25 * Math.abs(Math.sin(t * 4));
        this.raidBeam.visible = true;
        this.raidVisible = true;
      }
    } else if (this.raidVisible) {
      this.raidMarker.visible = false;
      this.raidBeam.visible = false;
      this.raidVisible = false;
    }

    // ---- PLAGUE ----
    const plague = state.disasters.find(d => d.kind === 'plague');
    if (plague) {
      // centre on average house position
      let sx = 0, sz = 0, n = 0;
      for (const b of state.buildings.values()) {
        if (BUILDINGS[b.type].housing > 0) {
          sx += b.x; sz += b.y; n++;
        }
      }
      if (n > 0) {
        const cx = sx / n + 0.5;
        const cz = sz / n + 0.5;
        this.plagueDome.position.set(cx, 0, cz);
        const pulse = 1 + 0.04 * Math.sin(t * 1.3);
        this.plagueDome.scale.setScalar(pulse);
        (this.plagueDome.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.06 * Math.sin(t * 1.5);
        this.plagueDome.visible = true;
        this.plagueVisible = true;
      }
    } else if (this.plagueVisible) {
      this.plagueDome.visible = false;
      this.plagueVisible = false;
    }
  }

  dispose(): void {
    // Geometries / materials are simple — let Three.js GC handle on scene removal.
    void COLOR;
  }
}
