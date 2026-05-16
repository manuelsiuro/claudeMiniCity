// Achievement list modal — shows unlocked / locked badges.

import type { Store } from '../../sim/Store';
import { ACHIEVEMENTS } from '../../config/achievements';

export class Achievements {
  private el: HTMLDivElement;
  private unsub: () => void;

  constructor(root: HTMLElement, private store: Store) {
    this.el = document.createElement('div');
    this.el.className = 'achievements-modal';
    this.el.style.display = 'none';
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.dataset.act === 'close' || t === this.el) this.toggle(false);
    });
    this.unsub = store.subscribe('achievement', this.render);
    this.render();
  }

  private render = (): void => {
    const ach = this.store.state.achievements ?? {};
    const unlocked = ACHIEVEMENTS.filter(a => ach[a.id]).length;
    const items = ACHIEVEMENTS.map(a => {
      const got = !!ach[a.id];
      return `
        <div class="row ${got ? 'got' : 'lock'}">
          <span class="ico">${got ? a.icon : '🔒'}</span>
          <span class="text">
            <span class="title">${a.title}</span>
            <span class="desc">${a.desc}</span>
          </span>
        </div>
      `;
    }).join('');
    this.el.innerHTML = `
      <div class="card">
        <div class="hdr">
          <span class="name">🏅 Achievements <span class="count">${unlocked} / ${ACHIEVEMENTS.length}</span></span>
          <button data-act="close">×</button>
        </div>
        <div class="grid">${items}</div>
      </div>
    `;
  };

  toggle(open: boolean): void {
    this.el.style.display = open ? 'flex' : 'none';
    if (open) this.render();
  }

  destroy(): void {
    this.unsub();
    this.el.remove();
  }
}
