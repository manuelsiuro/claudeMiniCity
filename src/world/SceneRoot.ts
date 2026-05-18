import * as THREE from 'three';
import { GRID_SIZE, COLOR } from '../config/constants';

export class SceneRoot {
  readonly scene = new THREE.Scene();
  readonly ambient: THREE.AmbientLight;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly cursor: THREE.Mesh;
  readonly selRing: THREE.Mesh;
  readonly sunDisc: THREE.Mesh;
  readonly moonDisc: THREE.Mesh;
  private starsMat?: THREE.PointsMaterial;
  private stars?: THREE.Points;

  constructor() {
    this.scene.background = new THREE.Color(0x8FBAC2);
    this.scene.fog = new THREE.FogExp2(0x8FBAC2, 0.012);

    this.ambient = new THREE.AmbientLight(0xa8c7ff, 0.55);
    this.hemi = new THREE.HemisphereLight(0xbcd2ff, 0x44391c, 0.6);
    this.sun = new THREE.DirectionalLight(0xffddb1, 1.8);
    this.sun.position.set(GRID_SIZE * 1.0, 50, GRID_SIZE * 0.5);
    this.sun.target.position.set(GRID_SIZE / 2, 0, GRID_SIZE / 2);

    // Shadows — soft PCF, ortho frustum sized to the grid.
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const o = GRID_SIZE; // 24
    this.sun.shadow.camera.left   = -o;
    this.sun.shadow.camera.right  =  o;
    this.sun.shadow.camera.top    =  o;
    this.sun.shadow.camera.bottom = -o;
    this.sun.shadow.camera.near   = 1;
    this.sun.shadow.camera.far    = 200;
    this.sun.shadow.bias          = -0.0003;
    this.sun.shadow.normalBias    =  0.02;

    this.scene.add(this.ambient, this.hemi, this.sun, this.sun.target);

    // selection cursor (a thin glowing square plane)
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({
      color: COLOR.fireBright,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.cursor = new THREE.Mesh(g, m);
    this.cursor.name = 'cursor';
    this.cursor.visible = false;
    this.scene.add(this.cursor);

    // Persistent selection ring: rendered when a building is opened in
    // the info panel.  Outline-only square, animated pulse.
    const ringGeo = new THREE.RingGeometry(0.5, 0.62, 4, 1);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd24a,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.selRing = new THREE.Mesh(ringGeo, ringMat);
    this.selRing.name = 'selRing';
    this.selRing.visible = false;
    this.scene.add(this.selRing);

    // Sun disc: a billboarded glow sphere positioned far away
    const sunGeo = new THREE.SphereGeometry(2.8, 16, 12);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffe89c });
    this.sunDisc = new THREE.Mesh(sunGeo, sunMat);
    this.sunDisc.name = 'sunDisc';
    this.sunDisc.frustumCulled = false;
    this.scene.add(this.sunDisc);

    // Moon disc
    const moonGeo = new THREE.SphereGeometry(2.0, 14, 10);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xe6ebff });
    this.moonDisc = new THREE.Mesh(moonGeo, moonMat);
    this.moonDisc.name = 'moonDisc';
    this.moonDisc.frustumCulled = false;
    this.scene.add(this.moonDisc);

    // Stars
    const starCount = 140;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * Math.PI * 0.45 + Math.PI * 0.05;
      const r = 120;
      starPos[i * 3] = Math.cos(u) * Math.sin(v) * r + GRID_SIZE / 2;
      starPos[i * 3 + 1] = Math.cos(v) * r;
      starPos[i * 3 + 2] = Math.sin(u) * Math.sin(v) * r + GRID_SIZE / 2;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starsMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0.0,
    });
    this.stars = new THREE.Points(starGeo, this.starsMat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  setDaylight(t: number, weather: 'clear' | 'rain' | 'storm'): void {
    // t in [0,1]: 0/1 = midnight, 0.5 = noon
    const noon = 1 - Math.abs(t - 0.5) * 2; // 1 at noon, 0 at midnight
    const warm = new THREE.Color(0xffddb1);
    const cool = new THREE.Color(0x2a3654);
    const tint = warm.clone().lerp(cool, 1 - noon);
    this.sun.color.copy(tint);
    this.sun.intensity = 0.6 + noon * 1.4;
    this.ambient.intensity = 0.2 + noon * 0.3;

    // Move sun + moon across the sky.  Daytime = t in [0,1], sun angle =
    // t * 2π so it rises in the east and sets in the west.
    const cx = GRID_SIZE / 2;
    const cz = GRID_SIZE / 2;
    const radius = 80;
    const sunAng = (t - 0.5) * Math.PI; // -π/2 at midnight, 0 at noon, π/2 at next midnight
    const sx = cx + Math.cos(sunAng + Math.PI / 2) * radius;
    const sy = Math.sin(sunAng + Math.PI / 2) * radius;
    const sz = cz - radius * 0.4;
    this.sun.position.set(sx, Math.max(sy, 0.5), sz);
    this.sun.target.position.set(cx, 0, cz);
    this.sunDisc.position.set(sx, sy, sz);
    this.sunDisc.visible = sy > -2;
    // Moon opposite the sun.
    const mx = cx - Math.cos(sunAng + Math.PI / 2) * radius;
    const my = -Math.sin(sunAng + Math.PI / 2) * radius;
    const mz = cz + radius * 0.4;
    this.moonDisc.position.set(mx, my, mz);
    this.moonDisc.visible = my > -2;
    if (this.starsMat) this.starsMat.opacity = (1 - noon) * 0.85;

    // sky / fog colour: warm dawn, blue day, indigo dusk, dark night
    let bg: THREE.ColorRepresentation;
    if (weather === 'storm') bg = 0x4a5266;
    else if (weather === 'rain') bg = 0x6a7a90;
    else if (noon < 0.05) bg = 0x12152a;            // night
    else if (t < 0.3 || t > 0.7) bg = 0x2a3654;     // dusk/dawn
    else bg = 0x86b8e0;                              // day
    (this.scene.background as THREE.Color).set(bg);
    if (this.scene.fog) {
      const fog = this.scene.fog as THREE.FogExp2;
      fog.color.set(bg);
      fog.density = weather === 'storm' ? 0.018 : weather === 'rain' ? 0.014 : 0.012;
    }
  }
}
