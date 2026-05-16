// World-anchored DOM floats: "+N wood" rising and fading above a world point.
// CSS-animated; one-shot.

import * as THREE from 'three';

export type FloatKind = 'wood' | 'stone' | 'food' | 'coins' | 'wheat' | 'goods' | 'pop' | 'bad';

const KIND_GLYPH: Record<FloatKind, string> = {
  wood: '🪵', stone: '🪨', food: '🍞', coins: '🪙', wheat: '🌾', goods: '📦',
  pop: '👤', bad: '⚠',
};

export class FloatTextLayer {
  private el: HTMLDivElement;
  private camera: THREE.Camera | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private active: Array<{ node: HTMLDivElement; world: THREE.Vector3; t: number; ttl: number }> = [];
  private scratch = new THREE.Vector3();

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'float-layer';
    root.appendChild(this.el);
  }

  setCamera(camera: THREE.Camera, canvas: HTMLCanvasElement): void {
    this.camera = camera;
    this.canvas = canvas;
  }

  spawn(wx: number, wy: number, wz: number, text: string, kind: FloatKind): void {
    if (this.active.length > 30) return; // soft cap
    const node = document.createElement('div');
    node.className = `float ${kind === 'bad' ? 'bad' : 'good'}`;
    node.innerHTML = `${KIND_GLYPH[kind]} ${text}`;
    this.el.appendChild(node);
    this.active.push({
      node,
      world: new THREE.Vector3(wx, wy, wz),
      t: 0,
      ttl: 1.6,
    });
  }

  update(dt: number): void {
    if (!this.camera || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.t += dt;
      if (a.t >= a.ttl) {
        a.node.remove();
        this.active.splice(i, 1);
        continue;
      }
      // Project world → screen
      this.scratch.copy(a.world);
      this.scratch.y += a.t * 1.6; // float up in world space
      this.scratch.project(this.camera);
      const x = (this.scratch.x * 0.5 + 0.5) * rect.width;
      const y = (1 - (this.scratch.y * 0.5 + 0.5)) * rect.height;
      a.node.style.left = `${x}px`;
      a.node.style.top = `${y}px`;
      const u = a.t / a.ttl;
      a.node.style.opacity = String(1 - u);
    }
  }

  destroy(): void {
    for (const a of this.active) a.node.remove();
    this.active.length = 0;
    this.el.remove();
  }
}
