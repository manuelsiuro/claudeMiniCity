import type { Store } from '../../sim/Store';

export type SettingsCallbacks = {
  onResetGame: () => void;
  onMuteChange: (muted: boolean) => void;
  onShowTutorial: () => void;
  onShowHelp?: () => void;
  onShowAchievements?: () => void;
};

export class Settings {
  private el: HTMLDivElement;
  private btn: HTMLButtonElement;
  private unsubs: Array<() => void> = [];

  constructor(root: HTMLElement, private store: Store, private cb: SettingsCallbacks) {
    // Gear button — placed in DOM as a small floating button.
    this.btn = document.createElement('button');
    this.btn.className = 'settings-btn';
    this.btn.title = 'Settings';
    this.btn.textContent = '⚙';
    this.btn.addEventListener('click', () => this.toggle(true));
    root.appendChild(this.btn);

    this.el = document.createElement('div');
    this.el.className = 'settings-modal';
    this.el.style.display = 'none';
    root.appendChild(this.el);
    this.render();
  }

  private render(): void {
    const s = this.store.state;
    this.el.innerHTML = `
      <div class="card">
        <div class="hdr">
          <span class="name">⚙ Settings</span>
          <button data-act="close">×</button>
        </div>
        <div class="row">
          <span class="label">Audio</span>
          <label class="toggle">
            <input type="checkbox" data-act="mute" ${s.muted ? '' : 'checked'}>
            <span>${s.muted ? 'Muted' : 'On'}</span>
          </label>
        </div>
        <div class="row">
          <span class="label">Day cycle</span>
          <div class="seg" data-act="speed-group">
            <button data-act="speed" data-v="0.5" class="${s.dayCycleScale === 0.5 ? 'on' : ''}">Slow</button>
            <button data-act="speed" data-v="1"   class="${s.dayCycleScale === 1   ? 'on' : ''}">Normal</button>
            <button data-act="speed" data-v="2"   class="${s.dayCycleScale === 2   ? 'on' : ''}">Fast</button>
          </div>
        </div>
        <div class="row">
          <span class="label">Tutorial</span>
          <button class="ghost" data-act="tut">Replay first steps</button>
        </div>
        <div class="row">
          <span class="label">Help</span>
          <button class="ghost" data-act="help">How to play</button>
        </div>
        <div class="row">
          <span class="label">Badges</span>
          <button class="ghost" data-act="ach">Achievements</button>
        </div>
        <div class="row danger">
          <span class="label">Reset</span>
          <button class="bad" data-act="reset">New Game</button>
        </div>
      </div>
    `;
    this.el.addEventListener('click', this.onClick);
  }

  private onClick = (e: Event): void => {
    const t = e.target as HTMLElement;
    const act = t.dataset?.act;
    if (!act) {
      // background dismiss
      if (t === this.el) this.toggle(false);
      return;
    }
    if (act === 'close') this.toggle(false);
    else if (act === 'mute') {
      const checked = (t as HTMLInputElement).checked;
      this.store.state.muted = !checked;
      this.cb.onMuteChange(!checked);
      this.render();
    } else if (act === 'speed') {
      const v = parseFloat(t.dataset.v ?? '1');
      this.store.state.dayCycleScale = v;
      this.render();
    } else if (act === 'tut') {
      this.cb.onShowTutorial();
      this.toggle(false);
    } else if (act === 'help') {
      this.cb.onShowHelp?.();
      this.toggle(false);
    } else if (act === 'ach') {
      this.cb.onShowAchievements?.();
      this.toggle(false);
    } else if (act === 'reset') {
      if (confirm('Wipe the save and start a fresh city?')) {
        this.cb.onResetGame();
      }
    }
  };

  toggle(open: boolean): void {
    this.el.style.display = open ? 'flex' : 'none';
    if (open) this.render();
  }

  destroy(): void {
    for (const u of this.unsubs) u();
    this.btn.remove();
    this.el.remove();
  }
}
