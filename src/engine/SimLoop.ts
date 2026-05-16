export class SimLoop {
  private intervalId: number | null = null;
  private paused = false;
  private speed = 1;

  constructor(
    private tick: () => void,
    private baseIntervalMs: number,
  ) {}

  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = window.setInterval(() => {
      if (!this.paused) this.tick();
    }, this.baseIntervalMs / this.speed);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  setSpeed(speed: number): void {
    if (speed === this.speed) return;
    this.speed = speed;
    if (this.intervalId !== null) {
      this.stop();
      this.start();
    }
  }

  getSpeed(): number {
    return this.speed;
  }
}
