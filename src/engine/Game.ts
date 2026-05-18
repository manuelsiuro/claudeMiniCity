import * as THREE from 'three';

import { TICK_MS } from '../config/constants';
import { createInitialState, Store } from '../sim/Store';
import { Actions } from '../sim/actions';
import { tickEconomy } from '../sim/systems/economy';
import { tickPopulation } from '../sim/systems/population';
import { tickDisasters } from '../sim/systems/disasters';
import { tickMilestones, tickWonder } from '../sim/systems/milestones';
import { checkAchievements, ACHIEVEMENTS } from '../config/achievements';
import { tickWeather } from '../sim/systems/weather';

import { RenderLoop } from './RenderLoop';
import { SimLoop } from './SimLoop';
import { IsoCamera } from './Camera';
import { Picker } from './Picker';
import { InputManager } from './Input';
import { AudioBus } from './AudioBus';

import { SceneRoot } from '../world/SceneRoot';
import { generateTerrain, findStarterTile } from '../world/Terrain';
import { buildTerrainMeshes } from '../world/TerrainMesh';
import { Water } from '../world/Water';
import { InstancedBuildings } from '../world/InstancedBuildings';
import { FireVfx } from '../world/FireVfx';
import { PlacementVfx } from '../world/PlacementVfx';
import { RoadOverlay } from '../world/RoadOverlay';
import { Citizens } from '../world/Citizens';
import { ChimneyVfx } from '../world/ChimneyVfx';
import { Flags } from '../world/Flags';
import { DisasterVfx } from '../world/DisasterVfx';
import { Confetti } from '../world/Confetti';
import { Birds } from '../world/Birds';
import { Wind } from '../world/Wind';
import { footprintTilesAt, footprintHeight } from '../world/Grid';

import { HUDRoot } from '../ui/HUDRoot';
import { pushToast } from '../ui/panels/EventToast';
import { FloatTextLayer, type FloatKind } from '../ui/FloatText';
import { tutorialAdvance } from '../ui/panels/Tutorial';

import { loadOrNull, saveTo, wipeSave } from '../io/Save';
import { resetSplashDismissed } from '../ui/panels/Splash';
import { BUILDINGS } from '../config/buildings';

const AUTOSAVE_EVERY_TICKS = 120;

export class Game {
  private store: Store;
  private actions: Actions;

  private renderer: THREE.WebGLRenderer;
  private scene: SceneRoot;
  private camera: IsoCamera;
  private buildings: InstancedBuildings;
  private water!: Water;
  private fireVfx!: FireVfx;
  private placementVfx!: PlacementVfx;
  private roadOverlay!: RoadOverlay;
  private citizens!: Citizens;
  private citizensSyncAcc = 0;
  private chimney!: ChimneyVfx;
  private floats!: FloatTextLayer;
  private flags!: Flags;
  private disasterVfx!: DisasterVfx;
  private confetti!: Confetti;
  private birds!: Birds;
  private wind!: Wind;
  private elapsed = 0;
  private lastTier = 0;
  private wonFireworks: { time: number; remaining: number } | null = null;
  private lastEnded: 'won' | null = null;
  private picker!: Picker;
  private input: InputManager;
  private hud: HUDRoot;
  private audio: AudioBus;

  private renderLoop: RenderLoop;
  private simLoop: SimLoop;

  private cursorTime = 0;
  private hovered: { x: number; y: number } | null = null;
  private wonderScaleCurrent = 0.05;

  constructor(mount: HTMLElement, hudMount: HTMLElement) {
    const loaded = loadOrNull();
    const initial = loaded ?? createInitialState();
    if (!loaded) {
      initial.tiles = generateTerrain(initial.seed);
    }
    this.store = new Store(initial);
    this.actions = new Actions(this.store);

    // --- Renderer ---
    this.renderer = new THREE.WebGLRenderer({
      antialias: window.devicePixelRatio < 2,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(this.renderer.domElement);

    // --- Scene ---
    this.scene = new SceneRoot();
    const terrain = buildTerrainMeshes(this.store.state.tiles);
    this.water = new Water();
    this.scene.scene.add(terrain.ground, this.water.mesh, terrain.decor);

    // --- Camera ---
    this.camera = new IsoCamera(window.innerWidth, window.innerHeight);
    // Restore camera state if loaded
    this.camera.target.x = initial.camera.targetX;
    this.camera.target.z = initial.camera.targetZ;
    this.camera.zoom = initial.camera.zoom;
    this.camera.zoomTo(initial.camera.zoom);
    while (this.camera.yawIndex !== initial.camera.rotation) {
      this.camera.snapRotate(1);
    }
    this.camera.update(1); // settle

    // --- Buildings ---
    this.buildings = new InstancedBuildings();
    this.scene.scene.add(this.buildings.group);

    // --- Fire VFX ---
    this.fireVfx = new FireVfx(this.scene.scene);
    // --- Placement particles ---
    this.placementVfx = new PlacementVfx(this.scene.scene);
    // --- Road overlay (connectivity stripes) ---
    this.roadOverlay = new RoadOverlay();
    this.scene.scene.add(this.roadOverlay.group);
    this.roadOverlay.sync(this.store.state);

    // --- Walking citizens ---
    this.citizens = new Citizens();
    this.scene.scene.add(this.citizens.group);
    this.citizens.sync(this.store.state);

    // --- Chimney smoke ---
    this.chimney = new ChimneyVfx();
    this.scene.scene.add(this.chimney.group);

    // --- Float text layer ---
    this.floats = new FloatTextLayer(hudMount);
    this.floats.setCamera(this.camera.camera, this.renderer.domElement);

    // --- Animated flags ---
    this.flags = new Flags();
    this.scene.scene.add(this.flags.group);
    this.flags.sync(this.store.state);

    // --- Raid + plague visuals ---
    this.disasterVfx = new DisasterVfx();
    this.scene.scene.add(this.disasterVfx.group);

    // --- Confetti ---
    this.confetti = new Confetti();
    this.scene.scene.add(this.confetti.group);
    this.lastTier = this.store.state.city.tier;

    // --- Birds ---
    this.birds = new Birds();
    this.scene.scene.add(this.birds.group);

    // --- Wind streaks ---
    this.wind = new Wind();
    this.scene.scene.add(this.wind.group);

// Rebuild instances for loaded buildings
    for (const b of this.store.state.buildings.values()) {
      this.buildings.add(b, this.store.state.tiles);
    }

    // Place starter house if fresh state
    if (!loaded && this.store.state.buildings.size === 0) {
      const start = findStarterTile(this.store.state.tiles);
      this.placeStarter(start.x, start.y);
    }

    // --- Picker ---
    this.picker = new Picker(this.camera.camera, terrain.ground);

    // --- Audio ---
    this.audio = new AudioBus();

    // --- Input ---
    this.input = new InputManager(this.renderer.domElement, {
      onTap: (x, y) => this.handleTap(x, y),
      onDragMove: (dx, dy) => this.camera.pan(dx, dy, this.renderer.domElement.clientHeight),
      onPinch: (s) => this.camera.zoomBy(1 / s),
      onWheel: (dy) => this.camera.zoomBy(dy > 0 ? 1.08 : 1 / 1.08),
      onKey: (k) => this.handleKey(k),
      onHover: (x, y) => this.handleHover(x, y),
      onHoverEnd: () => { this.hovered = null; this.scene.cursor.visible = false; },
    });

    // --- HUD ---
    this.hud = new HUDRoot(hudMount, this.store, this.actions, {
      onRotate: (d) => { this.camera.snapRotate(d); this.audio.play('click'); },
      onZoom: (d) => { this.camera.zoomBy(d > 0 ? 1 / 1.2 : 1.2); this.audio.play('click'); },
      onMute: () => { this.audio.setMuted(false); this.audio.play('click'); },
      onReset: () => { wipeSave(); resetSplashDismissed(); window.location.reload(); },
      onMuteChange: (m) => { this.audio.setMuted(m); },
      onShowTutorial: () => {
        this.store.state.tutorial = { step: 0, done: false };
        this.store.notify('tutorial');
      },
      onPause: () => {
        this.store.state.paused = !this.store.state.paused;
        if (this.store.state.paused) this.simLoop.pause();
        else this.simLoop.resume();
        return this.store.state.paused;
      },
      onSpeed: () => {
        const cur = this.store.state.simSpeed ?? 1;
        const next: 1 | 2 | 4 = cur === 1 ? 2 : cur === 2 ? 4 : 1;
        this.store.state.simSpeed = next;
        this.simLoop.setSpeed(next);
        return next;
      },
      onMiniMapClick: (x, y) => {
        this.camera.target.x = x + 0.5;
        this.camera.target.z = y + 0.5;
      },
      getCamera: () => ({
        x: this.camera.target.x,
        z: this.camera.target.z,
        rotation: this.camera.yawIndex,
      }),
    });

    // --- Loops ---
    this.renderLoop = new RenderLoop((dt) => this.onRenderTick(dt));
    this.simLoop = new SimLoop(() => this.onSimTick(), TICK_MS);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('beforeunload', () => this.persist());
  }

  start(): void {
    this.renderLoop.start();
    this.simLoop.start();
    if (this.store.state.tutorial.step === 0) {
      this.store.notify('tutorial');
    }
  }

  // ---------------------------------------------------------------------------

  private placeStarter(x: number, y: number): void {
    // place a House at the starter spot for free
    const cost = BUILDINGS.house.cost;
    this.store.state.resources.wood += cost.wood;
    this.store.state.resources.stone += cost.stone;
    this.store.state.resources.coins += cost.coins;
    const r = this.actions.placeBuilding('house', x, y);
    if (r.ok) this.buildings.add(r.building, this.store.state.tiles);
  }

  // ---------------------------------------------------------------------------
  // Sim tick
  // ---------------------------------------------------------------------------

  private onSimTick(): void {
    if (this.store.state.ended) return;

    const s = this.store.state;
    s.ticks++;

    tickWeather(s, this.store);
    tickEconomy(s, {
      onProduce: (b, kind, amount) => {
        if (amount < 0.5) return;
        const def = BUILDINGS[b.type];
        const cx = (b.x + def.footprint / 2);
        const cz = (b.y + def.footprint / 2);
        const baseY = footprintHeight(s.tiles, b.x, b.y, def.footprint) + 1.2;
        this.floats.spawn(cx, baseY, cz, `+${amount.toFixed(amount < 10 ? 1 : 0)}`, kind as FloatKind);
      },
    });
    tickPopulation(s);
    tickMilestones(s, this.store);

    const events = {
      onFireStart: (_b: any) => {
        this.audio.play('fire');
        this.camera.shakePulse(0.6);
      },
      onBuildingDestroyed: (b: any) => {
        // remove from store + scene
        this.buildings.remove(b.id, b.type);
        this.actions.removeBuilding(b);
        this.roadOverlay.sync(this.store.state);
        this.audio.play('demolish');
        this.camera.shakePulse(0.9);
      },
      onRaid: () => {
        this.audio.play('raid');
        this.camera.shakePulse(0.4);
      },
    };
    tickDisasters(s, this.store, events);

    if (tickWonder(s, this.store)) {
      this.audio.play('win');
    }

    // Achievements
    checkAchievements(s, (a) => {
      this.audio.play('milestone');
      pushToast(this.store, `🏅 ${a.title} — ${a.desc}`, 'good');
      this.store.notify('achievement');
      // small confetti burst at city centre
      this.confetti.burst(this.camera.target.x, 2, this.camera.target.z);
    });
    void ACHIEVEMENTS;

    // periodic UI refresh
    if (s.ticks % 4 === 0) {
      if (s.dirty.resources) { this.store.notify('resources'); s.dirty.resources = false; }
      if (s.dirty.city) { this.store.notify('city'); s.dirty.city = false; }
    }

    // autosave
    if (s.ticks % AUTOSAVE_EVERY_TICKS === 0) this.persist();
  }

  // ---------------------------------------------------------------------------
  // Render tick
  // ---------------------------------------------------------------------------

  private onRenderTick(dt: number): void {
    this.camera.update(dt);
    const s = this.store.state;
    this.scene.setDaylight(s.daytime, s.weather);

    // Selection ring follows the building opened in the info panel.
    if (s.selectedBuildingId !== null) {
      const b = s.buildings.get(s.selectedBuildingId);
      if (b) {
        const fp = BUILDINGS[b.type].footprint;
        const c = InstancedBuildings.footprintCenter(b.x, b.y, fp);
        const baseY = footprintHeight(s.tiles, b.x, b.y, fp);
        const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.06;
        this.scene.selRing.position.set(c.cx, baseY + 0.04, c.cz);
        this.scene.selRing.scale.set(fp * 1.05 * pulse, 1, fp * 1.05 * pulse);
        (this.scene.selRing.material as THREE.MeshBasicMaterial).opacity =
          0.55 + 0.3 * Math.sin(performance.now() * 0.005);
        this.scene.selRing.visible = true;
      } else {
        this.scene.selRing.visible = false;
      }
    } else {
      this.scene.selRing.visible = false;
    }
    this.fireVfx.sync(s);
    this.fireVfx.update(dt);
    this.water.update(dt);
    this.placementVfx.update(dt);

    // Citizens: re-allocate count occasionally; animate every frame.
    this.citizensSyncAcc += dt;
    if (this.citizensSyncAcc > 0.5) {
      this.citizens.sync(s);
      this.citizensSyncAcc = 0;
    }
    this.citizens.update(dt, s);
    this.chimney.update(dt, s);
    this.floats.update(dt);
    this.flags.update(dt);
    this.disasterVfx.update(dt, s);
    this.confetti.update(dt);
    this.birds.update(dt);
    this.elapsed += dt;
    this.wind.update(dt, this.elapsed);

    // Wonder-completion fireworks: multi-burst over the Wonder.
    if (s.ended === 'won' && this.lastEnded !== 'won') {
      this.lastEnded = 'won';
      const w = s.buildings.get(s.wonder.buildingId!);
      if (w) {
        const cx = (w.x + 1.5) * 1;
        const cz = (w.y + 1.5) * 1;
        this.wonFireworks = { time: 0, remaining: 6 };
        this.confetti.burst(cx, 4, cz);
      }
    }
    if (this.wonFireworks && this.wonFireworks.remaining > 0) {
      this.wonFireworks.time += dt;
      if (this.wonFireworks.time > 0.45) {
        const w = s.buildings.get(s.wonder.buildingId!);
        if (w) {
          const jx = (w.x + 1.5) + (Math.random() - 0.5) * 4;
          const jz = (w.y + 1.5) + (Math.random() - 0.5) * 4;
          this.confetti.burst(jx, 3 + Math.random() * 2, jz);
          this.audio.play('milestone');
        }
        this.wonFireworks.time = 0;
        this.wonFireworks.remaining -= 1;
      }
    }

    // Tier change → confetti burst at city centre.
    if (s.city.tier !== this.lastTier && s.city.tier > this.lastTier) {
      const cx = (this.camera.target.x);
      const cz = (this.camera.target.z);
      this.confetti.burst(cx, 2, cz);
      this.audio.play('milestone');
      this.lastTier = s.city.tier;
    }

    // Wonder grow animation: scale Y from 0.05 → 1 as it builds.
    const w = s.wonder;
    if (w.buildingId !== null) {
      const b = s.buildings.get(w.buildingId);
      if (b) {
        const fp = BUILDINGS[b.type].footprint;
        const baseY = footprintHeight(s.tiles, b.x, b.y, fp);
        const target = Math.max(0.05, Math.min(1, w.progress / w.total));
        // Smooth lerp toward target so it grows gradually within a tick.
        this.wonderScaleCurrent += (target - this.wonderScaleCurrent) * Math.min(1, dt * 4);
        this.buildings.updateScale(b.id, b.type, b.x, b.y, fp, baseY, this.wonderScaleCurrent);
      }
    } else {
      this.wonderScaleCurrent = 1;
    }
    if (this.cursorTime > 0) {
      this.cursorTime -= dt;
      const m = this.scene.cursor.material as THREE.MeshBasicMaterial;
      m.opacity = Math.max(0, 0.7 * (this.cursorTime / 0.4));
      if (this.cursorTime <= 0 && !this.hovered) this.scene.cursor.visible = false;
    } else if (this.hovered && s.selectedBuildType) {
      // pulse the hover cursor
      const m = this.scene.cursor.material as THREE.MeshBasicMaterial;
      m.opacity = 0.32 + 0.18 * (0.5 + 0.5 * Math.sin(performance.now() * 0.006));
    }
    this.renderer.render(this.scene.scene, this.camera.camera);
  }

  // ---------------------------------------------------------------------------

  private handleTap(screenX: number, screenY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const hit = this.picker.pickTile(screenX - rect.left, screenY - rect.top, rect.width, rect.height);
    if (!hit) return;

    const state = this.store.state;
    const sel = state.selectedBuildType;

    if (sel === null) {
      // info panel on tap
      const tile = state.tiles[hit.y * 24 + hit.x];
      if (tile.buildingId !== null) {
        this.store.state.selectedBuildingId = tile.buildingId;
        this.store.notify('info');
        this.flashCursor(hit.x, hit.y, 1);
      } else {
        this.store.state.selectedBuildingId = null;
        this.store.notify('info');
        pushToast(this.store, `${tile.biome} tile (${hit.x},${hit.y})`, 'info');
        this.flashCursor(hit.x, hit.y, 1);
      }
      return;
    }

    if (sel === 'demolish') {
      const ok = this.actions.demolish(hit.x, hit.y);
      if (ok) {
        // re-sync visuals: easier to just rebuild the type's instances.
        this.rebuildInstances();
        this.roadOverlay.sync(this.store.state);
        this.flags.sync(this.store.state);
        this.audio.play('demolish');
        pushToast(this.store, 'Demolished.', 'info');
        const center = InstancedBuildings.footprintCenter(hit.x, hit.y, 1);
        this.placementVfx.emit(center.cx, this.cursorY(hit.x, hit.y, 1), center.cz, 0x8a8478, 1);
      } else {
        this.audio.play('bad');
      }
      return;
    }

    const def = BUILDINGS[sel];
    // place
    const result = this.actions.placeBuilding(sel, hit.x, hit.y);
    if (result.ok) {
      this.buildings.add(result.building, this.store.state.tiles);
      if (sel === 'road') this.roadOverlay.sync(this.store.state);
      this.flags.sync(this.store.state);
      this.audio.play('place');
      this.flashCursor(hit.x, hit.y, def.footprint);
      const center = InstancedBuildings.footprintCenter(hit.x, hit.y, def.footprint);
      // dust puff tinted by terrain (warm tan)
      this.placementVfx.emit(center.cx, this.cursorY(hit.x, hit.y, def.footprint), center.cz, 0xc9a472, def.footprint);
      // advance tutorial
      if (sel === 'forester') tutorialAdvance(this.store, 'forester');
      else if (sel === 'farm') tutorialAdvance(this.store, 'farm');
      else if (sel === 'well') tutorialAdvance(this.store, 'well');
      else tutorialAdvance(this.store, 'placed');
    } else {
      this.audio.play('bad');
      pushToast(this.store, result.reason, 'warn');
    }
  }

  private rebuildInstances(): void {
    this.buildings.clearAll();
    for (const b of this.store.state.buildings.values()) {
      this.buildings.add(b, this.store.state.tiles);
    }
  }

  private handleHover(screenX: number, screenY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const hit = this.picker.pickTile(screenX - rect.left, screenY - rect.top, rect.width, rect.height);
    const sel = this.store.state.selectedBuildType;
    if (!hit || !sel) {
      this.scene.cursor.visible = false;
      this.hovered = null;
      return;
    }
    if (this.hovered && this.hovered.x === hit.x && this.hovered.y === hit.y) return;
    this.hovered = { x: hit.x, y: hit.y };
    const fp = sel === 'demolish' ? 1 : BUILDINGS[sel].footprint;
    const ok = sel === 'demolish'
      ? this.store.state.tiles[hit.y * 24 + hit.x].buildingId !== null
      : this.actions.canPlace(sel, hit.x, hit.y).ok;
    const center = InstancedBuildings.footprintCenter(hit.x, hit.y, fp);
    this.scene.cursor.position.set(center.cx, this.cursorY(hit.x, hit.y, fp) + 0.02, center.cz);
    this.scene.cursor.scale.set(fp, 1, fp);
    const mat = this.scene.cursor.material as THREE.MeshBasicMaterial;
    mat.color.setHex(ok ? 0x74d36f : 0xff6f6f);
    mat.opacity = 0.45;
    this.scene.cursor.visible = true;
  }

  private flashCursor(x: number, y: number, footprint: number): void {
    const center = InstancedBuildings.footprintCenter(x, y, footprint);
    this.scene.cursor.position.set(center.cx, this.cursorY(x, y, footprint) + 0.02, center.cz);
    this.scene.cursor.scale.set(footprint, 1, footprint);
    this.scene.cursor.visible = true;
    this.cursorTime = 0.4;
  }

  private cursorY(x: number, y: number, footprint: number): number {
    let maxH = 0;
    for (const t of footprintTilesAt(x, y, footprint)) {
      const tile = this.store.state.tiles[t.y * 24 + t.x];
      if (tile && tile.biome !== 'water' && tile.height > maxH) maxH = tile.height;
    }
    return maxH;
  }

  private handleKey(k: string): void {
    if (k === 'q' || k === 'Q') this.camera.snapRotate(-1);
    else if (k === 'e' || k === 'E') this.camera.snapRotate(1);
    else if (k === '+' || k === '=') this.camera.zoomBy(1 / 1.2);
    else if (k === '-') this.camera.zoomBy(1.2);
    else if (k === 'Escape') this.actions.selectBuildType(null);
    else if (k === ' ') (document.querySelector('[data-act="p"]') as HTMLButtonElement | null)?.click();
    else if (k === 't' || k === 'T') (document.querySelector('[data-act="s"]') as HTMLButtonElement | null)?.click();
    else if (k === 'h' || k === 'H') (document.querySelector('.settings-btn') as HTMLButtonElement | null)?.click();
    else if (k === 'l' || k === 'L') (document.querySelector('.log-btn') as HTMLButtonElement | null)?.click();
    else if (k === 'b' || k === 'B') {
      // cycle to next build-menu category
      const tabs = [...document.querySelectorAll<HTMLElement>('.build-menu .build-tabs .tab')];
      const i = tabs.findIndex(t => t.classList.contains('on'));
      const next = tabs[(i + 1) % tabs.length];
      next?.click();
    }
    else if (k === 'm' || k === 'M') (document.querySelector('[data-act="m"]') as HTMLButtonElement | null)?.click();
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.setViewport(w, h);
  };

  private persist(): void {
    const s = this.store.state;
    s.camera.targetX = this.camera.target.x;
    s.camera.targetZ = this.camera.target.z;
    s.camera.zoom = this.camera.zoom;
    s.camera.rotation = this.camera.yawIndex;
    saveTo(s);
  }

  destroy(): void {
    this.renderLoop.stop();
    this.simLoop.stop();
    this.input.destroy();
    this.hud.destroy();
    this.buildings.dispose();
    this.renderer.dispose();
    window.removeEventListener('resize', this.onResize);
  }
}
