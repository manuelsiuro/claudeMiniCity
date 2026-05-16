import { Game } from './engine/Game';

const mount = document.getElementById('app') as HTMLElement;
const hudMount = document.getElementById('hud') as HTMLElement;

const game = new Game(mount, hudMount);
game.start();

// expose for dev console poking
(window as unknown as { __game?: Game }).__game = game;
