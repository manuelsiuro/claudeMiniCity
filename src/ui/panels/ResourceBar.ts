import type { Store } from '../../sim/Store';
import { MILESTONES } from '../../config/milestones';
import type { GameState } from '../../types';
import { BUILDINGS } from '../../config/buildings';
import { FOOD_PER_POP_PER_TICK, DAY_CYCLE_TICKS } from '../../config/balance';

const FMT = (v: number): string => {
  const r = Math.floor(v);
  if (r >= 1000) return (r / 1000).toFixed(1) + 'k';
  return String(r);
};

type Rates = { wood: number; stone: number; food: number; coins: number; wheat: number; goods: number };

function computeRates(state: GameState): Rates {
  const r: Rates = { wood: 0, stone: 0, food: 0, coins: 0, wheat: 0, goods: 0 };
  // Employment ratio
  let totalJobs = 0;
  for (const b of state.buildings.values()) {
    if (b.idle || b.burning !== undefined) continue;
    totalJobs += BUILDINGS[b.type].jobs;
  }
  const employed = Math.min(totalJobs, state.city.pop);
  const ratio = totalJobs > 0 ? employed / totalJobs : 1;

  for (const b of state.buildings.values()) {
    if (b.burning !== undefined) continue;
    const def = BUILDINGS[b.type];
    if (def.upkeep && !b.idle) r.coins -= def.upkeep;
    if (def.produces && !b.idle) {
      const eff = def.jobs > 0 ? ratio : 1;
      r[def.produces.out] += def.produces.perTick * eff;
      if (def.produces.consume) {
        for (const [k, v] of Object.entries(def.produces.consume)) {
          (r as Record<string, number>)[k] -= (v ?? 0) * eff;
        }
      }
    }
  }
  // Food consumption: pop × FOOD_PER_POP_PER_TICK / 4 per tick × 3 calls/sec
  // = pop × FOOD_PER_POP_PER_TICK × 0.75 per second.
  r.food -= state.city.pop * FOOD_PER_POP_PER_TICK * 0.75;
  // Wonder drains coins each sim tick (4/sec).
  if (state.wonder.buildingId !== null) r.coins -= 5 * 4;
  return r;
}

function fmtRate(v: number): string {
  if (Math.abs(v) < 0.05) return '';
  const sign = v > 0 ? '+' : '−';
  const a = Math.abs(v);
  return `${sign}${a >= 10 ? a.toFixed(0) : a.toFixed(1)}/s`;
}

function nextMilestone(pop: number): { current: number; next: number; title: string } {
  let cur = 0, nxt = MILESTONES[MILESTONES.length - 1].pop;
  let title = MILESTONES[0].title;
  for (let i = 0; i < MILESTONES.length; i++) {
    if (pop >= MILESTONES[i].pop) {
      cur = MILESTONES[i].pop;
      title = MILESTONES[i].title;
      nxt = i + 1 < MILESTONES.length ? MILESTONES[i + 1].pop : MILESTONES[i].pop;
    }
  }
  return { current: cur, next: nxt, title };
}

export class ResourceBar {
  private el: HTMLDivElement;
  private spans: Record<string, HTMLSpanElement> = {};
  private unsubs: Array<() => void> = [];

  constructor(root: HTMLElement, private store: Store) {
    this.el = document.createElement('div');
    this.el.className = 'resource-bar';
    this.el.innerHTML = `
      <span class="res day"   title="In-game day"><span class="gly">☀</span><span class="v" data-k="day">Day 1</span></span>
      <span class="res pop"   title="Population / housing"><span class="gly">👥</span><span class="v" data-k="pop">0</span><span class="dim">/0</span></span>
      <span class="res happy" title="Happiness"><span class="gly">🙂</span><span class="v" data-k="happy">0</span></span>
      <span class="res wood"  title="Wood"><span class="gly">🪵</span><span class="v" data-k="wood">0</span><span class="rate" data-k="wood-rate"></span></span>
      <span class="res stone" title="Stone"><span class="gly">🪨</span><span class="v" data-k="stone">0</span><span class="rate" data-k="stone-rate"></span></span>
      <span class="res food"  title="Food"><span class="gly">🍞</span><span class="v" data-k="food">0</span><span class="rate" data-k="food-rate"></span></span>
      <span class="res coins" title="Coins"><span class="gly">🪙</span><span class="v" data-k="coins">0</span><span class="rate" data-k="coins-rate"></span></span>
      <span class="res tier"  title="Milestone tier">
        <span class="gly">🏷</span>
        <span class="tier-track"><span class="tier-fill" data-k="tier-fill"></span></span>
        <span class="v" data-k="tier-label">Settlement</span>
      </span>
    `;
    for (const v of this.el.querySelectorAll<HTMLSpanElement>('span.v[data-k]')) {
      this.spans[v.dataset.k!] = v;
    }
    root.appendChild(this.el);
    this.render();
    this.unsubs.push(store.subscribe('resources', this.render));
    this.unsubs.push(store.subscribe('city', this.render));
    this.unsubs.push(store.subscribe('weather', this.render));
    // Tick day counter every couple of seconds without needing a slice.
    const dayTimer = window.setInterval(this.render, 1000);
    this.unsubs.push(() => clearInterval(dayTimer));
  }

  private render = (): void => {
    const s = this.store.state;
    // Day counter, ticks → days (one day = DAY_CYCLE_TICKS).
    const day = Math.floor(s.ticks / DAY_CYCLE_TICKS) + 1;
    if (this.spans.day) this.spans.day.textContent = `Day ${day}`;
    // Day icon: sun by day, moon at night.
    const dayEl = this.el.querySelector<HTMLElement>('.res.day .gly');
    if (dayEl) dayEl.textContent = s.daytime > 0.25 && s.daytime < 0.75 ? '☀' : '🌙';
    this.spans.pop.textContent = String(s.city.pop);
    const popHousing = this.el.querySelector<HTMLElement>('.res.pop .dim');
    if (popHousing) popHousing.textContent = '/' + s.city.housing;
    this.spans.happy.textContent = String(Math.round(s.city.happiness));
    this.spans.happy.className = 'v ' + (s.city.happiness < 30 ? 'lo' : s.city.happiness > 70 ? 'hi' : '');
    this.spans.wood.textContent = FMT(s.resources.wood);
    this.spans.stone.textContent = FMT(s.resources.stone);
    this.spans.food.textContent = FMT(s.resources.food);
    this.spans.food.className = 'v ' + (s.resources.food < 5 ? 'lo' : '');
    this.spans.coins.textContent = FMT(s.resources.coins);
    this.spans.coins.className = 'v ' + (s.resources.coins < 0 ? 'lo' : '');

    // Tier progress
    const ms = nextMilestone(s.city.pop);
    const span = ms.next - ms.current;
    const into = s.city.pop - ms.current;
    const pct = span > 0 ? Math.min(100, (into / span) * 100) : 100;
    const fill = this.el.querySelector<HTMLElement>('[data-k="tier-fill"]');
    const label = this.el.querySelector<HTMLElement>('[data-k="tier-label"]');
    if (fill) fill.style.width = pct.toFixed(1) + '%';
    if (label) label.textContent = `${ms.title} ${s.city.pop}/${ms.next}`;

    // Production trend rates
    const rates = computeRates(s);
    const setRate = (key: keyof Rates, dataKey: string) => {
      const el = this.el.querySelector<HTMLElement>(`[data-k="${dataKey}"]`);
      if (!el) return;
      el.textContent = fmtRate(rates[key]);
      el.classList.remove('up', 'down');
      if (rates[key] > 0.05) el.classList.add('up');
      else if (rates[key] < -0.05) el.classList.add('down');
    };
    setRate('wood', 'wood-rate');
    setRate('stone', 'stone-rate');
    setRate('food', 'food-rate');
    setRate('coins', 'coins-rate');
  };

  destroy(): void {
    for (const u of this.unsubs) u();
    this.el.remove();
  }
}
