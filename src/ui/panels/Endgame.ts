import type { Store } from '../../sim/Store';

export class Endgame {
  private el: HTMLDivElement;
  private unsub: () => void;

  constructor(root: HTMLElement, private store: Store, onReset: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'endgame';
    this.el.style.display = 'none';
    this.el.innerHTML = `
      <h1>🏆 Wonder Complete</h1>
      <p>Your city has been written into legend. The metropolis will be remembered.</p>
      <button data-act="reset">New Game</button>
    `;
    this.el.querySelector('button')!.addEventListener('click', () => {
      onReset();
    });
    root.appendChild(this.el);
    this.unsub = store.subscribe('end', this.render);
    this.render();
  }

  private render = (): void => {
    this.el.style.display = this.store.state.ended === 'won' ? 'flex' : 'none';
  };

  destroy(): void {
    this.unsub();
    this.el.remove();
  }
}
