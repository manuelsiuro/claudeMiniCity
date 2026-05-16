import type { Store } from '../../sim/Store';
import type { Actions } from '../../sim/actions';
import { BUILDINGS } from '../../config/buildings';

export class BuildingInfo {
  private el: HTMLDivElement;
  private unsubs: Array<() => void> = [];

  constructor(root: HTMLElement, private store: Store, private actions: Actions) {
    this.el = document.createElement('div');
    this.el.className = 'building-info';
    this.el.style.display = 'none';
    root.appendChild(this.el);

    this.unsubs.push(store.subscribe('info', this.render));
    this.unsubs.push(store.subscribe('buildings', this.render));
    this.render();

    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const act = t.dataset?.act;
      if (act === 'close') this.close();
      else if (act === 'demolish') {
        const id = this.store.state.selectedBuildingId;
        if (id === null) return;
        const b = this.store.state.buildings.get(id);
        if (!b) return;
        this.actions.removeBuilding(b);
        this.close();
      }
    });
  }

  private close(): void {
    this.store.state.selectedBuildingId = null;
    this.store.notify('info');
  }

  private render = (): void => {
    const id = this.store.state.selectedBuildingId;
    if (id === null) {
      this.el.style.display = 'none';
      return;
    }
    const b = this.store.state.buildings.get(id);
    if (!b) {
      this.el.style.display = 'none';
      return;
    }
    const def = BUILDINGS[b.type];
    const statusBits: string[] = [];
    if (b.burning !== undefined) statusBits.push('<span class="bad">🔥 burning</span>');
    if (b.idle) statusBits.push('<span class="warn">idle</span>');
    if (def.produces && !b.idle && b.burning === undefined) statusBits.push('<span class="good">producing</span>');
    const statsRows: string[] = [];
    if (def.housing) statsRows.push(`<div><span class="k">Housing</span><span class="v">${def.housing}</span></div>`);
    if (def.jobs) statsRows.push(`<div><span class="k">Jobs</span><span class="v">${def.jobs}</span></div>`);
    if (def.upkeep) statsRows.push(`<div><span class="k">Upkeep</span><span class="v">${def.upkeep}🪙/tick</span></div>`);
    if (def.produces) {
      const p = def.produces;
      let formula = `${p.perTick}/tick → ${p.out}`;
      if (p.consume) {
        const consumes = Object.entries(p.consume).map(([k, v]) => `${v}${k}`).join('+');
        formula = `${consumes} → ${p.perTick}${p.out}/tick`;
      }
      statsRows.push(`<div><span class="k">Produces</span><span class="v">${formula}</span></div>`);
    }
    if (def.service) {
      statsRows.push(`<div><span class="k">Service</span><span class="v">${def.service.kind} r=${def.service.radius}</span></div>`);
    }
    statsRows.push(`<div><span class="k">Tile</span><span class="v">(${b.x},${b.y})</span></div>`);

    this.el.innerHTML = `
      <div class="hdr">
        <span class="name">${def.name}</span>
        <button data-act="close" title="Close">×</button>
      </div>
      ${statusBits.length ? `<div class="status">${statusBits.join(' · ')}</div>` : ''}
      <div class="desc">${def.desc}</div>
      <div class="stats">${statsRows.join('')}</div>
      <div class="actions"><button data-act="demolish">🔨 Demolish</button></div>
    `;
    this.el.style.display = 'block';
  };

  destroy(): void {
    for (const u of this.unsubs) u();
    this.el.remove();
  }
}
