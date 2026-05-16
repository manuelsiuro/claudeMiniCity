// Small canvas-rendered minimap in the top-right.  Re-renders on building
// changes / camera moves.  Click pans the camera to the chosen tile.

import type { Store } from '../../sim/Store';
import { GRID_SIZE } from '../../config/constants';
import { BUILDINGS, paletteSwatch } from '../../config/buildings';

const TILE_PX = 5;
const SIZE = GRID_SIZE * TILE_PX;
const BIOME_COLORS: Record<string, string> = {
  grass:  '#4a9b3a',
  hill:   '#8aa055',
  forest: '#2d5a1f',
  sand:   '#d6c388',
  water:  '#2f6fbc',
};

export class MiniMap {
  private el: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private unsubs: Array<() => void> = [];
  private onTileClick?: (x: number, y: number) => void;
  private getCamera?: () => { x: number; z: number; rotation: 0|1|2|3 };

  constructor(
    root: HTMLElement,
    private store: Store,
    callbacks: {
      onTileClick?: (x: number, y: number) => void;
      getCamera?: () => { x: number; z: number; rotation: 0|1|2|3 };
    },
  ) {
    this.onTileClick = callbacks.onTileClick;
    this.getCamera = callbacks.getCamera;
    this.el = document.createElement('div');
    this.el.className = 'minimap';
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.canvas.style.width = SIZE + 'px';
    this.canvas.style.height = SIZE + 'px';
    this.el.appendChild(this.canvas);
    root.appendChild(this.el);
    this.ctx = this.canvas.getContext('2d')!;

    this.canvas.addEventListener('click', (e) => {
      const r = this.canvas.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const tx = Math.floor(px * GRID_SIZE);
      const ty = Math.floor(py * GRID_SIZE);
      this.onTileClick?.(tx, ty);
    });

    this.unsubs.push(store.subscribe('buildings', this.render));
    this.render();

    // Re-render every 250ms so camera viewport rect tracks pans.
    const t = window.setInterval(this.render, 250);
    this.unsubs.push(() => clearInterval(t));
  }

  private render = (): void => {
    const ctx = this.ctx;
    const s = this.store.state;
    if (!s.tiles.length) return;
    // 1. biome layer
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const t = s.tiles[y * GRID_SIZE + x];
        ctx.fillStyle = BIOME_COLORS[t.biome] ?? '#333';
        ctx.fillRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
      }
    }
    // 2. buildings layer
    for (const b of s.buildings.values()) {
      const fp = BUILDINGS[b.type].footprint;
      const c = paletteSwatch(b.type);
      ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`;
      const px = b.x * TILE_PX;
      const py = b.y * TILE_PX;
      ctx.fillRect(px, py, TILE_PX * fp, TILE_PX * fp);
      if (b.burning !== undefined) {
        ctx.fillStyle = 'rgba(255,80,40,0.85)';
        ctx.fillRect(px, py, TILE_PX * fp, TILE_PX * fp);
      }
    }
    // 3. camera viewport indicator (rectangle showing where camera is looking)
    if (this.getCamera) {
      const cam = this.getCamera();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.5;
      const vx = cam.x * TILE_PX;
      const vy = cam.z * TILE_PX;
      ctx.beginPath();
      ctx.arc(vx, vy, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  destroy(): void {
    for (const u of this.unsubs) u();
    this.el.remove();
  }
}
