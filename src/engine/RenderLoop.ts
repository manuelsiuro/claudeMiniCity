export class RenderLoop {
  private running = false;
  private last = 0;
  private rafId = 0;

  constructor(private update: (dt: number) => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  private tick = (): void => {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.update(dt);
    this.rafId = requestAnimationFrame(this.tick);
  };
}
