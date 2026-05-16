import type { Store } from '../sim/Store';
import type { Actions } from '../sim/actions';
import { ResourceBar } from './panels/ResourceBar';
import { BuildMenu } from './panels/BuildMenu';
import { SideControls } from './controls/RotateButton';
import { EventToast } from './panels/EventToast';
import { Tutorial } from './panels/Tutorial';
import { WonderProgress } from './panels/WonderProgress';
import { Endgame } from './panels/Endgame';
import { BuildingInfo } from './panels/BuildingInfo';
import { Settings } from './panels/Settings';
import { Splash } from './panels/Splash';
import { MilestoneBanner } from './panels/MilestoneBanner';
import { MiniMap } from './panels/MiniMap';
import { ActivityLog } from './panels/ActivityLog';
import { Help } from './panels/Help';
import { Achievements } from './panels/Achievements';

export class HUDRoot {
  private resourceBar: ResourceBar;
  private buildMenu: BuildMenu;
  private side: SideControls;
  private toast: EventToast;
  private tutorial: Tutorial;
  private wonder: WonderProgress;
  private endgame: Endgame;
  private info: BuildingInfo;
  private settings: Settings;
  private splash: Splash;
  private banner: MilestoneBanner;
  private minimap: MiniMap;
  private activity: ActivityLog;
  private help: Help;
  private achievements: Achievements;
  private pauseOverlay: HTMLDivElement;
  private pauseUnsub: () => void;

  constructor(
    root: HTMLElement,
    store: Store,
    actions: Actions,
    callbacks: {
      onRotate: (dir: 1 | -1) => void;
      onZoom: (dir: 1 | -1) => void;
      onMute: () => void;
      onReset: () => void;
      onMuteChange?: (muted: boolean) => void;
      onShowTutorial?: () => void;
      onPause?: () => boolean;
      onSpeed?: () => number;
      onMiniMapClick?: (x: number, y: number) => void;
      getCamera?: () => { x: number; z: number; rotation: 0|1|2|3 };
    },
  ) {
    this.resourceBar = new ResourceBar(root, store);
    this.toast = new EventToast(root, store);
    this.buildMenu = new BuildMenu(root, store, actions);
    this.side = new SideControls(root, callbacks);
    this.tutorial = new Tutorial(root, store);
    this.wonder = new WonderProgress(root, store);
    this.endgame = new Endgame(root, store, callbacks.onReset);
    this.info = new BuildingInfo(root, store, actions);
    this.help = new Help(root);
    this.achievements = new Achievements(root, store);
    this.settings = new Settings(root, store, {
      onResetGame: callbacks.onReset,
      onMuteChange: (m) => callbacks.onMuteChange?.(m),
      onShowTutorial: () => callbacks.onShowTutorial?.(),
      onShowHelp: () => this.help.toggle(true),
      onShowAchievements: () => this.achievements.toggle(true),
    });
    this.splash = new Splash(root, {
      onBegin: () => { /* nothing extra — game already running behind splash */ },
    });
    this.banner = new MilestoneBanner(root, store);
    this.minimap = new MiniMap(root, store, {
      onTileClick: callbacks.onMiniMapClick,
      getCamera: callbacks.getCamera,
    });
    this.activity = new ActivityLog(root, store);

    // Paused overlay
    this.pauseOverlay = document.createElement('div');
    this.pauseOverlay.className = 'paused-overlay';
    this.pauseOverlay.innerHTML = `<div class="badge">⏸ PAUSED<span class="hint">Click anywhere to resume</span></div>`;
    this.pauseOverlay.addEventListener('click', () => {
      if (store.state.paused) callbacks.onPause?.();
    });
    root.appendChild(this.pauseOverlay);
    const renderPause = () => {
      this.pauseOverlay.classList.toggle('on', store.state.paused === true);
    };
    this.pauseUnsub = store.subscribe('toast', renderPause); // any notify will refresh
    // Re-render on every notify('city') / 'menu' too since paused doesn't have own slice.
    const t = window.setInterval(renderPause, 500);
    const origUnsub = this.pauseUnsub;
    this.pauseUnsub = () => { origUnsub(); clearInterval(t); };
  }

  destroy(): void {
    this.resourceBar.destroy();
    this.buildMenu.destroy();
    this.side.destroy();
    this.toast.destroy();
    this.tutorial.destroy();
    this.wonder.destroy();
    this.endgame.destroy();
    this.info.destroy();
    this.settings.destroy();
    this.splash.destroy();
    this.banner.destroy();
    this.minimap.destroy();
    this.activity.destroy();
    this.help.destroy();
    this.achievements.destroy();
    this.pauseUnsub();
    this.pauseOverlay.remove();
  }
}
