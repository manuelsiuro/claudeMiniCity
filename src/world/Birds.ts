// Ambient voxel birds drifting on smooth closed curves above the map.
// Each bird is a small Group with a body + two wings; wings rotate
// around their inner edge to fake a flap.

import * as THREE from 'three';
import { GRID_SIZE, TILE_SIZE } from '../config/constants';

const COUNT = 12;

type Bird = {
  group: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  curve: THREE.CatmullRomCurve3;
  u: number;          // current position along curve, [0,1]
  speed: number;      // u-units / sec
  bobPhase: number;
  flapPhase: number;
  flapSpeed: number;
};

const SHARED = (() => {
  // pivot translations so each wing rotates around its inner edge (the body).
  const wingW = 0.36, wingH = 0.03, wingD = 0.10;
  const left = new THREE.BoxGeometry(wingW, wingH, wingD);
  left.translate(-wingW / 2, 0, 0);
  const right = new THREE.BoxGeometry(wingW, wingH, wingD);
  right.translate(wingW / 2, 0, 0);
  const body = new THREE.BoxGeometry(0.12, 0.08, 0.18);

  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1c, flatShading: true });
  const wingMat = new THREE.MeshLambertMaterial({ color: 0xf2eee4, flatShading: true });

  return { left, right, body, bodyMat, wingMat };
})();

export class Birds {
  readonly group = new THREE.Group();
  private birds: Bird[] = [];
  private time = 0;

  constructor() {
    this.group.name = 'birds';

    for (let i = 0; i < COUNT; i++) {
      const g = new THREE.Group();

      const body = new THREE.Mesh(SHARED.body, SHARED.bodyMat);
      body.castShadow = false;
      g.add(body);

      const leftWing = new THREE.Mesh(SHARED.left, SHARED.wingMat);
      leftWing.position.set(-0.06, 0.02, 0);
      leftWing.castShadow = false;
      g.add(leftWing);

      const rightWing = new THREE.Mesh(SHARED.right, SHARED.wingMat);
      rightWing.position.set(0.06, 0.02, 0);
      rightWing.castShadow = false;
      g.add(rightWing);

      this.group.add(g);
      this.birds.push({
        group: g,
        leftWing,
        rightWing,
        curve: makeRandomCurve(),
        u: Math.random(),
        speed: 0.025 + Math.random() * 0.025,
        bobPhase: Math.random() * Math.PI * 2,
        flapPhase: Math.random() * Math.PI * 2,
        flapSpeed: 7 + Math.random() * 4,
      });
    }
  }

  update(dt: number): void {
    this.time += dt;
    const pos = new THREE.Vector3();
    const tan = new THREE.Vector3();
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      b.u = (b.u + b.speed * dt) % 1;
      b.curve.getPointAt(b.u, pos);
      b.curve.getTangentAt(b.u, tan);

      // Gentle vertical bob on top of the curve's own altitude.
      pos.y += Math.sin(this.time * 1.2 + b.bobPhase) * 0.18;

      b.group.position.copy(pos);
      b.group.rotation.y = Math.atan2(tan.x, tan.z);

      // Flap: symmetric rotation around local Z, ±0.5 rad.
      const flap = Math.sin(this.time * b.flapSpeed + b.flapPhase) * 0.5;
      b.leftWing.rotation.z =  flap;
      b.rightWing.rotation.z = -flap;
    }
  }

  dispose(): void {
    // Shared geometries/materials are module-level singletons; only
    // dispose them when the last Birds instance goes away. In practice
    // this app keeps one Birds instance for the lifetime of the game.
    SHARED.body.dispose();
    SHARED.left.dispose();
    SHARED.right.dispose();
    SHARED.bodyMat.dispose();
    SHARED.wingMat.dispose();
  }
}

function makeRandomCurve(): THREE.CatmullRomCurve3 {
  // 4–6 control points sampled around the island perimeter at altitude 7–11.
  const n = 4 + Math.floor(Math.random() * 3);
  const cx = (GRID_SIZE / 2) * TILE_SIZE;
  const cz = (GRID_SIZE / 2) * TILE_SIZE;
  const radius = GRID_SIZE * 0.45 + Math.random() * GRID_SIZE * 0.15;
  const altBase = 7 + Math.random() * 3;
  const startAng = Math.random() * Math.PI * 2;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const ang = startAng + dir * (i / n) * Math.PI * 2;
    const jitter = 0.7 + Math.random() * 0.6;
    const r = radius * jitter;
    pts.push(new THREE.Vector3(
      cx + Math.cos(ang) * r,
      altBase + Math.sin(ang * 2) * 1.2,
      cz + Math.sin(ang) * r,
    ));
  }
  return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
}
