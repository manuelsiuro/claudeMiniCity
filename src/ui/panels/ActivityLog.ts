// Persistent activity log of recent events.  Hidden behind a bell button
// that shows an unread badge when new events arrive while closed.

import type { Store } from '../../sim/Store';
import { getToastHistory } from './EventToast';

export class ActivityLog {
  private btn: HTMLButtonElement;
  private panel: HTMLDivElement;
  private list: HTMLDivElement;
  private badge: HTMLSpanElement;
  private open = false;
  private unread = 0;
  private unsubs: Array<() => void> = [];

  constructor(root: HTMLElement, store: Store) {
    this.btn = document.createElement('button');
    this.btn.className = 'log-btn';
    this.btn.title = 'Activity log';
    this.btn.innerHTML = `<span>🔔</span><span class="badge"></span>`;
    this.badge = this.btn.querySelector('.badge')!;
    this.btn.addEventListener('click', () => this.toggle());
    root.appendChild(this.btn);

    this.panel = document.createElement('div');
    this.panel.className = 'log-panel';
    this.panel.style.display = 'none';
    this.panel.innerHTML = `
      <div class="hdr">
        <span class="name">🔔 Activity</span>
        <button data-act="close" title="Close">×</button>
      </div>
      <div class="list"></div>
    `;
    this.list = this.panel.querySelector('.list')!;
    this.panel.querySelector('[data-act="close"]')!.addEventListener('click', () => this.toggle(false));
    root.appendChild(this.panel);

    this.unsubs.push(store.subscribe('toast', this.onToast));
    this.render();
  }

  private onToast = (): void => {
    if (this.open) this.render();
    else { this.unread = Math.min(99, this.unread + 1); this.updateBadge(); }
  };

  private toggle(force?: boolean): void {
    this.open = force === undefined ? !this.open : force;
    this.panel.style.display = this.open ? 'flex' : 'none';
    if (this.open) {
      this.unread = 0;
      this.updateBadge();
      this.render();
    }
  }

  private updateBadge(): void {
    if (this.unread > 0) {
      this.badge.textContent = String(this.unread);
      this.badge.classList.add('on');
    } else {
      this.badge.textContent = '';
      this.badge.classList.remove('on');
    }
  }

  private render(): void {
    const entries = getToastHistory();
    if (!entries.length) {
      this.list.innerHTML = `<div class="empty">No events yet — get building!</div>`;
      return;
    }
    const html = entries.map(e => {
      const kindCls = e.kind === 'good' ? 'good' : e.kind === 'warn' ? 'warn' : e.kind === 'bad' ? 'bad' : '';
      const t = new Date(e.ts);
      const time = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`;
      return `<div class="row ${kindCls}"><span class="time">${time}</span><span class="msg">${escapeHtml(e.msg)}</span></div>`;
    }).join('');
    this.list.innerHTML = html;
  }

  destroy(): void {
    for (const u of this.unsubs) u();
    this.btn.remove();
    this.panel.remove();
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
