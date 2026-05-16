import type { Store } from '../../sim/Store';

export type ToastKind = 'info' | 'good' | 'warn' | 'bad';

export type ToastEntry = { msg: string; kind: ToastKind; ts: number };
const QUEUE: ToastEntry[] = [];
const HISTORY: ToastEntry[] = [];
const HISTORY_CAP = 50;

export function pushToast(store: Store, msg: string, kind: ToastKind = 'info'): void {
  const entry: ToastEntry = { msg, kind, ts: Date.now() };
  QUEUE.push(entry);
  HISTORY.unshift(entry);
  if (HISTORY.length > HISTORY_CAP) HISTORY.length = HISTORY_CAP;
  store.notify('toast');
}

export function getToastHistory(): ToastEntry[] {
  return HISTORY;
}

export class EventToast {
  private el: HTMLDivElement;
  private unsub: () => void;

  constructor(root: HTMLElement, store: Store) {
    this.el = document.createElement('div');
    this.el.className = 'toast-stack';
    root.appendChild(this.el);

    this.unsub = store.subscribe('toast', () => {
      while (QUEUE.length) {
        const t = QUEUE.shift()!;
        this.spawn(t);
      }
    });
  }

  private spawn(t: ToastEntry): void {
    const node = document.createElement('div');
    node.className = `toast ${t.kind === 'info' ? '' : t.kind}`;
    node.textContent = t.msg;
    this.el.appendChild(node);
    window.setTimeout(() => node.remove(), 3800);
  }

  destroy(): void {
    this.unsub();
    this.el.remove();
  }
}
