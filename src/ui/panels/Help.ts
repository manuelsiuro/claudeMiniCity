// Reference / glossary modal explaining the rules of the game.
// Opened from Settings → Help.

export class Help {
  private el: HTMLDivElement;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'help-modal';
    this.el.style.display = 'none';
    this.el.innerHTML = `
      <div class="card">
        <div class="hdr">
          <span class="name">📖 How to play</span>
          <button data-act="close">×</button>
        </div>
        <h3>The goal</h3>
        <p>Grow your city to <b>population 250</b>, build the <b>Wonder</b>,
        and survive while it constructs. Wonder build = win.</p>

        <h3>Controls</h3>
        <ul>
          <li>👆 <b>Drag</b> to pan · <b>pinch / wheel</b> to zoom</li>
          <li><span class="kbd">Q</span> / <span class="kbd">E</span> rotate the camera 90°</li>
          <li><span class="kbd">Space</span> pause · <span class="kbd">T</span> speed 1×/2×/4× · <span class="kbd">M</span> mute</li>
          <li><span class="kbd">B</span> cycle build-menu category · <span class="kbd">L</span> log · <span class="kbd">H</span> settings</li>
          <li><span class="kbd">Esc</span> deselects the current build tool</li>
          <li>Tap an empty tile with no tool selected to see <b>tile info</b>; tap a building for its <b>info panel</b></li>
          <li>Click the mini-map to jump across the city</li>
        </ul>

        <h3>Resources</h3>
        <ul>
          <li>🪵 Wood — Forester near forest</li>
          <li>🪨 Stone — Quarry near hill</li>
          <li>🌾 Wheat → 🍞 Food — Farm + Bakery</li>
          <li>📦 Goods — Workshop (consumes wood + stone)</li>
          <li>🪙 Coins — Market sells food + goods, Bank generates income</li>
          <li>👥 Population grows in housing if happiness ≥ 40</li>
        </ul>

        <h3>Roads</h3>
        <p>Every non-housing production / service building needs a Road tile
        adjacent. Connected runs of road give a +10% bonus to neighbouring
        producers.</p>

        <h3>Milestones (tiers)</h3>
        <ul>
          <li><b>0:</b> House, Forester, Farm, Well, Road</li>
          <li><b>25:</b> Cottage, Quarry, Bakery, Market, Park, Fire Station</li>
          <li><b>75:</b> Workshop, School, Watchtower</li>
          <li><b>150:</b> Tenement, Hospital, Bank, Stadium</li>
          <li><b>250:</b> Wonder — build to win</li>
        </ul>

        <h3>Disasters</h3>
        <ul>
          <li>🔥 <b>Fire</b> ignites and spreads — Fire Station prevents and puts out fires.</li>
          <li>☣ <b>Plague</b> (tier 150+) — dense housing without Well coverage. Hospital cures.</li>
          <li>⚔ <b>Bandit raids</b> (pop 75+) — telegraphed by a red marker at the map edge. Watchtower blocks within its range.</li>
        </ul>

        <h3>Tips</h3>
        <ul>
          <li>Food drops if your population outpaces your bakeries. Watch the <b>−N/s</b> trends.</li>
          <li>Houses keep happiness up; Parks and Schools add joy auras.</li>
          <li>Use ⏸ pause + 1×/2×/4× speed to plan or skip ahead.</li>
        </ul>
      </div>
    `;
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.dataset.act === 'close' || t === this.el) this.toggle(false);
    });
  }

  toggle(open: boolean): void {
    this.el.style.display = open ? 'flex' : 'none';
  }

  destroy(): void {
    this.el.remove();
  }
}
