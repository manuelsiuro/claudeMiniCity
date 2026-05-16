// Sole owner of DOM pointer/wheel/key listeners.
// Disambiguates tap vs drag vs pinch and forwards normalized events.

export type InputHandlers = {
  onTap: (screenX: number, screenY: number) => void;
  onDragStart?: () => void;
  onDragMove?: (dxPx: number, dyPx: number) => void;
  onDragEnd?: () => void;
  onPinch?: (scaleDelta: number) => void;
  onWheel?: (deltaY: number) => void;
  onKey?: (key: string) => void;
  onHover?: (screenX: number, screenY: number) => void;
  onHoverEnd?: () => void;
};

const TAP_MAX_MS = 220;
const TAP_MAX_PX = 8;

export class InputManager {
  private pointers = new Map<number, { x: number; y: number; startX: number; startY: number; startT: number }>();
  private lastPinchDist = -1;
  private isDragging = false;

  constructor(
    private el: HTMLElement,
    private handlers: InputHandlers,
  ) {
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('pointerleave', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: true });
    el.addEventListener('contextmenu', this.onContextMenu);
    el.addEventListener('pointerleave', this.onHoverEnd);
    window.addEventListener('keydown', this.onKey);
  }

  private onHoverEnd = (): void => {
    this.handlers.onHoverEnd?.();
  };

  destroy(): void {
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
    this.el.removeEventListener('pointerleave', this.onUp);
    this.el.removeEventListener('wheel', this.onWheel);
    this.el.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('keydown', this.onKey);
  }

  private onDown = (e: PointerEvent): void => {
    if (e.target !== this.el) return;
    this.el.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, {
      x: e.clientX, y: e.clientY,
      startX: e.clientX, startY: e.clientY,
      startT: performance.now(),
    });
    this.lastPinchDist = -1;
    this.isDragging = false;
  };

  private onMove = (e: PointerEvent): void => {
    // Hover (mouse with no buttons pressed)
    if (this.pointers.size === 0 && e.pointerType === 'mouse') {
      this.handlers.onHover?.(e.clientX, e.clientY);
      return;
    }
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const prevX = p.x;
    const prevY = p.y;
    p.x = e.clientX;
    p.y = e.clientY;

    if (this.pointers.size === 2) {
      // pinch
      const pts = [...this.pointers.values()];
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const d = Math.hypot(dx, dy);
      if (this.lastPinchDist > 0 && this.handlers.onPinch) {
        this.handlers.onPinch(d / this.lastPinchDist);
      }
      this.lastPinchDist = d;
      return;
    }

    if (this.pointers.size === 1) {
      const ddx = p.x - p.startX;
      const ddy = p.y - p.startY;
      if (!this.isDragging && (Math.abs(ddx) > TAP_MAX_PX || Math.abs(ddy) > TAP_MAX_PX)) {
        this.isDragging = true;
        this.handlers.onDragStart?.();
      }
      if (this.isDragging && this.handlers.onDragMove) {
        this.handlers.onDragMove(p.x - prevX, p.y - prevY);
      }
    }
  };

  private onUp = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = p.x - p.startX;
    const dy = p.y - p.startY;
    const dt = performance.now() - p.startT;
    const wasTap = !this.isDragging
      && this.pointers.size === 1
      && dt < TAP_MAX_MS
      && Math.abs(dx) < TAP_MAX_PX
      && Math.abs(dy) < TAP_MAX_PX;

    this.pointers.delete(e.pointerId);

    if (this.pointers.size < 2) this.lastPinchDist = -1;

    if (wasTap) {
      this.handlers.onTap(p.x, p.y);
    } else if (this.isDragging && this.pointers.size === 0) {
      this.handlers.onDragEnd?.();
      this.isDragging = false;
    }
  };

  private onWheel = (e: WheelEvent): void => {
    this.handlers.onWheel?.(e.deltaY);
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private onKey = (e: KeyboardEvent): void => {
    this.handlers.onKey?.(e.key);
  };
}
