import type { GameState } from '../../types';
import { tierForPop, MILESTONES } from '../../config/milestones';
import { pushToast } from '../../ui/panels/EventToast';
import type { Store } from '../Store';

export function tickMilestones(state: GameState, store: Store): void {
  const t = tierForPop(state.city.pop);
  if (t !== state.city.tier) {
    state.city.tier = t;
    const m = MILESTONES.find(m => m.tier === t)!;
    pushToast(store, `🎉 ${m.title} — ${m.body}`, 'good');
    state.dirty.menu = true;
    store.notify('menu');
  }
}

export function tickWonder(state: GameState, store: Store): boolean {
  const w = state.wonder;
  if (w.buildingId === null) return false;
  // drain coins, advance progress
  state.resources.coins -= 5;
  w.progress += 1;
  store.notify('wonder');
  if (w.progress >= w.total) {
    state.ended = 'won';
    store.notify('end');
    pushToast(store, '🏆 The Wonder is complete. Your city is legend.', 'good');
    return true;
  }
  return false;
}
