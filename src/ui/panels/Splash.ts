// Title-screen overlay shown on first load (no save) or when explicitly invoked.

const STORAGE_KEY = 'minicity:splash-dismissed';

export class Splash {
  private el: HTMLDivElement;
  private callbacks: { onBegin: () => void };

  constructor(root: HTMLElement, callbacks: { onBegin: () => void }) {
    this.callbacks = callbacks;

    this.el = document.createElement('div');
    this.el.className = 'splash';
    this.el.innerHTML = `
      <div class="card">
        <div class="logo">
          <span class="cube a"></span>
          <span class="cube b"></span>
          <span class="cube c"></span>
        </div>
        <h1>Mini City</h1>
        <p class="tag">A voxel city builder · build wonders, dodge disasters.</p>
        <ul class="hints">
          <li>👆 Drag to pan · 🔍 pinch / wheel to zoom · ↺ rotate · ⚙ settings</li>
          <li>Reach <b>pop 250</b> and build the <b>Wonder</b> to win.</li>
        </ul>
        <button class="cta" data-act="begin">▶ Begin</button>
      </div>
    `;
    root.appendChild(this.el);

    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.dataset.act === 'begin' || t === this.el) this.dismiss();
    });

    if (this.shouldShow()) {
      this.el.style.display = 'flex';
    } else {
      this.el.style.display = 'none';
    }
  }

  private shouldShow(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== '1';
    } catch {
      return true;
    }
  }

  show(): void {
    this.el.style.display = 'flex';
  }

  private dismiss(): void {
    this.el.style.display = 'none';
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    this.callbacks.onBegin();
  }

  destroy(): void {
    this.el.remove();
  }
}

export function resetSplashDismissed(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
