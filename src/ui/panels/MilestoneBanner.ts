// Centered "tier reached" banner that animates in/out for ~3s.

import type { Store } from '../../sim/Store';
import { MILESTONES } from '../../config/milestones';

export class MilestoneBanner {
  private el: HTMLDivElement;
  private unsub: () => void;
  private lastTier: number;
  private hideTimer: number | null = null;

  constructor(root: HTMLElement, private store: Store) {
    this.el = document.createElement('div');
    this.el.className = 'milestone-banner';
    this.el.style.display = 'none';
    root.appendChild(this.el);
    this.lastTier = store.state.city.tier;
    this.unsub = store.subscribe('city', this.check);
    this.unsub; // captured below for destroy
  }

  private check = (): void => {
    const tier = this.store.state.city.tier;
    if (tier === this.lastTier) return;
    this.lastTier = tier;
    if (tier === 0) return;
    const m = MILESTONES.find(x => x.tier === tier);
    if (!m) return;
    this.show(m.title, m.body);
  };

  show(title: string, body: string): void {
    this.el.style.display = 'flex';
    this.el.innerHTML = `
      <div class="card">
        <div class="hat">🎉 NEW TIER UNLOCKED</div>
        <div class="title">${title}</div>
        <div class="body">${body}</div>
      </div>
    `;
    void this.el.offsetWidth; // restart animation
    this.el.classList.remove('out');
    this.el.classList.add('in');
    if (this.hideTimer !== null) clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => {
      this.el.classList.remove('in');
      this.el.classList.add('out');
      window.setTimeout(() => { this.el.style.display = 'none'; }, 500);
    }, 2800);
  }

  destroy(): void {
    this.unsub();
    if (this.hideTimer !== null) clearTimeout(this.hideTimer);
    this.el.remove();
  }
}
