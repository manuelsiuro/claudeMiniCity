// Side-mounted controls: rotate, zoom, mute.

type Callbacks = {
  onRotate: (dir: 1 | -1) => void;
  onZoom: (dir: 1 | -1) => void;
  onMute: () => void;
  onPause?: () => boolean;
  onSpeed?: () => number;  // returns new speed
};

export class SideControls {
  private el: HTMLDivElement;

  constructor(root: HTMLElement, cb: Callbacks) {
    this.el = document.createElement('div');
    this.el.className = 'side-controls';
    this.el.innerHTML = `
      <button data-act="rL" title="Rotate left">↺</button>
      <button data-act="rR" title="Rotate right">↻</button>
      <button data-act="zI" title="Zoom in">+</button>
      <button data-act="zO" title="Zoom out">−</button>
      <button data-act="p"  title="Pause / resume">⏸</button>
      <button data-act="s"  title="Speed 1× / 2× / 4×">1×</button>
      <button data-act="m"  title="Mute">🔊</button>
    `;
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const act = t.dataset?.act;
      if (!act) return;
      if (act === 'rL') cb.onRotate(-1);
      else if (act === 'rR') cb.onRotate(1);
      else if (act === 'zI') cb.onZoom(1);
      else if (act === 'zO') cb.onZoom(-1);
      else if (act === 'p') {
        const paused = cb.onPause?.() ?? false;
        t.textContent = paused ? '▶' : '⏸';
        t.classList.toggle('active', paused);
      } else if (act === 's') {
        const speed = cb.onSpeed?.() ?? 1;
        t.textContent = `${speed}×`;
        t.classList.toggle('active', speed > 1);
      } else if (act === 'm') {
        cb.onMute();
        t.textContent = t.textContent === '🔊' ? '🔇' : '🔊';
      }
    });
  }

  destroy(): void {
    this.el.remove();
  }
}
