import type { Store } from '../../sim/Store';

export class WonderProgress {
  private el: HTMLDivElement;
  private bar: HTMLDivElement;
  private unsubs: Array<() => void> = [];

  constructor(root: HTMLElement, private store: Store) {
    this.el = document.createElement('div');
    this.el.className = 'tutorial'; // reuse styling
    this.el.style.display = 'none';
    this.el.style.bottom = '180px';
    this.el.innerHTML = `
      <div class="step">WONDER UNDER CONSTRUCTION</div>
      <div style="width:200px;height:10px;background:rgba(255,255,255,0.1);border-radius:5px;overflow:hidden;margin:6px auto 0">
        <div data-bar style="height:100%;width:0%;background:#f2c84b;transition:width 200ms"></div>
      </div>
    `;
    root.appendChild(this.el);
    this.bar = this.el.querySelector('[data-bar]')!;
    this.unsubs.push(store.subscribe('wonder', this.render));
    this.unsubs.push(store.subscribe('end', this.render));
    this.render();
  }

  private render = (): void => {
    const w = this.store.state.wonder;
    if (this.store.state.ended || w.buildingId === null) {
      this.el.style.display = 'none';
      return;
    }
    this.el.style.display = 'block';
    const pct = Math.min(100, (w.progress / w.total) * 100);
    this.bar.style.width = pct.toFixed(1) + '%';
  };

  destroy(): void {
    for (const u of this.unsubs) u();
    this.el.remove();
  }
}
