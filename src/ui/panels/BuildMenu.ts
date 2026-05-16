import type { Store } from '../../sim/Store';
import type { Actions } from '../../sim/actions';
import { BUILDINGS, paletteSwatch } from '../../config/buildings';
import { type BuildingType } from '../../types';
import { unlockedTypes } from '../../config/milestones';

const ICONS: Record<BuildingType, string> = {
  house: '🏠', cottage: '🏡', tenement: '🏢',
  forester: '🌲', quarry: '⛏️', farm: '🌾', bakery: '🍞', workshop: '🔨',
  market: '🛒', school: '🏫', hospital: '🏥', well: '💧', bank: '🏦',
  stadium: '🏟️', park: '🌳',
  watchtower: '🗼', fireStation: '🚒',
  road: '🛣️', wonder: '🏛️',
};

type Category = 'homes' | 'production' | 'services' | 'civic' | 'defense' | 'roads';

const CATEGORIES: Array<{ id: Category; icon: string; label: string; types: BuildingType[] }> = [
  { id: 'homes',      icon: '🏠', label: 'Homes',     types: ['house', 'cottage', 'tenement'] },
  { id: 'production', icon: '🌾', label: 'Production',types: ['forester', 'quarry', 'farm', 'bakery', 'workshop'] },
  { id: 'services',   icon: '🛒', label: 'Services',  types: ['market', 'school', 'hospital', 'well', 'bank'] },
  { id: 'civic',      icon: '🌳', label: 'Civic',     types: ['park', 'stadium', 'wonder'] },
  { id: 'defense',    icon: '🛡', label: 'Defense',   types: ['watchtower', 'fireStation'] },
  { id: 'roads',      icon: '🛣', label: 'Roads',     types: ['road'] },
];

export class BuildMenu {
  private el: HTMLDivElement;
  private tabsEl: HTMLDivElement;
  private itemsEl: HTMLDivElement;
  private items = new Map<BuildingType | 'demolish', HTMLDivElement>();
  private tabs = new Map<Category, HTMLDivElement>();
  private unsubs: Array<() => void> = [];

  constructor(root: HTMLElement, private store: Store, private actions: Actions) {
    this.el = document.createElement('div');
    this.el.className = 'build-menu has-tabs';
    root.appendChild(this.el);

    // Category tabs
    this.tabsEl = document.createElement('div');
    this.tabsEl.className = 'build-tabs';
    for (const cat of CATEGORIES) {
      const tab = document.createElement('div');
      tab.className = 'tab';
      tab.dataset.cat = cat.id;
      tab.innerHTML = `<span class="gly">${cat.icon}</span><span class="lbl">${cat.label}</span>`;
      tab.title = cat.label;
      tab.addEventListener('click', () => this.setCategory(cat.id));
      this.tabsEl.appendChild(tab);
      this.tabs.set(cat.id, tab);
    }
    this.el.appendChild(this.tabsEl);

    // Items row
    this.itemsEl = document.createElement('div');
    this.itemsEl.className = 'build-items';
    this.el.appendChild(this.itemsEl);

    // demolish stays as a pinned action on the left
    const dem = document.createElement('div');
    dem.className = 'demolish';
    dem.innerHTML = `<div>🔨</div><div>Demolish</div>`;
    dem.addEventListener('click', () => this.toggleSelect('demolish'));
    this.itemsEl.appendChild(dem);
    this.items.set('demolish', dem);

    // Build per-type items for ALL types, attach to itemsEl, show/hide by category.
    for (const cat of CATEGORIES) {
      for (const t of cat.types) {
        const def = BUILDINGS[t];
        const item = document.createElement('div');
        item.className = 'item';
        item.tabIndex = 0;
        item.dataset.cat = cat.id;
        const sw = `#${paletteSwatch(t).toString(16).padStart(6, '0')}`;
        const costs: string[] = [];
        if (def.cost.wood) costs.push(`${def.cost.wood}🪵`);
        if (def.cost.stone) costs.push(`${def.cost.stone}🪨`);
        if (def.cost.coins) costs.push(`${def.cost.coins}🪙`);
        item.innerHTML = `
          <div class="swatch" style="background:${sw}">${ICONS[t]}</div>
          <div class="name">${def.name}</div>
          <div class="cost">${costs.join(' ') || '—'}</div>
        `;
        item.title = def.desc + (def.tier ? ` (unlocks at pop ${def.tier})` : '');
        item.addEventListener('click', () => this.toggleSelect(t));
        this.itemsEl.appendChild(item);
        this.items.set(t, item);
      }
    }

    this.setCategory('homes');
    this.render();
    this.unsubs.push(store.subscribe('menu', this.render));
    this.unsubs.push(store.subscribe('city', this.render));
    this.unsubs.push(store.subscribe('resources', this.render));
  }

  private setCategory(id: Category): void {
    for (const [k, t] of this.tabs.entries()) t.classList.toggle('on', k === id);
    for (const [k, it] of this.items.entries()) {
      if (k === 'demolish') continue;
      it.style.display = (it.dataset.cat === id) ? '' : 'none';
    }
  }

  private toggleSelect(t: BuildingType | 'demolish'): void {
    const cur = this.store.state.selectedBuildType;
    if (cur === t) this.actions.selectBuildType(null);
    else this.actions.selectBuildType(t);
  }

  private render = (): void => {
    const s = this.store.state;
    const unlocked = unlockedTypes(s.city.pop);
    const selected = s.selectedBuildType;

    for (const [t, item] of this.items.entries()) {
      const isSel = t === selected;
      item.classList.toggle('selected', isSel);
      if (t === 'demolish') continue;
      const def = BUILDINGS[t];
      const isLocked = !unlocked.has(t);
      item.classList.toggle('locked', isLocked);
      const tooExpensive =
        !isLocked &&
        (s.resources.wood < def.cost.wood ||
          s.resources.stone < def.cost.stone ||
          s.resources.coins < def.cost.coins);
      item.classList.toggle('too-expensive', tooExpensive);
    }
  };

  destroy(): void {
    for (const u of this.unsubs) u();
    this.el.remove();
  }
}
