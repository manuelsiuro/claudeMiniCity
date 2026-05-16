import type { Store } from '../../sim/Store';

const STEPS = [
  { hint: 'Tap a building below — start with a House.', match: 'select' },
  { hint: 'Now tap a green grass tile to place it.',     match: 'placed' },
  { hint: 'Select Forester and place it next to a forest.', match: 'forester' },
  { hint: 'Select Farm and place it on grass for food.',     match: 'farm' },
  { hint: 'Open the menu — Well prevents plague later.',     match: 'well' },
];

export class Tutorial {
  private el: HTMLDivElement;
  private unsub: () => void;

  constructor(root: HTMLElement, private store: Store) {
    this.el = document.createElement('div');
    this.el.className = 'tutorial';
    this.el.style.display = 'none';
    root.appendChild(this.el);

    this.unsub = store.subscribe('tutorial', this.render);
    this.render();
  }

  private render = (): void => {
    const s = this.store.state.tutorial;
    if (s.done || s.step >= STEPS.length) {
      this.el.style.display = 'none';
      return;
    }
    const cur = STEPS[s.step];
    this.el.style.display = 'block';
    this.el.innerHTML = `<div class="step">STEP ${s.step + 1} / ${STEPS.length}</div><div>${cur.hint}</div>`;
  };

  destroy(): void {
    this.unsub();
    this.el.remove();
  }
}

export function tutorialAdvance(store: Store, hint: 'select' | 'placed' | 'forester' | 'farm' | 'well'): void {
  const s = store.state.tutorial;
  if (s.done) return;
  const step = STEPS[s.step];
  if (!step) return;
  if (step.match === hint) {
    s.step++;
    if (s.step >= STEPS.length) s.done = true;
    store.notify('tutorial');
  }
}
