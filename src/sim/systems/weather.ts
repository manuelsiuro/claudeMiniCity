import type { GameState } from '../../types';
import { DAY_CYCLE_TICKS, WEATHER_CYCLE_TICKS } from '../../config/balance';
import { pushToast } from '../../ui/panels/EventToast';
import type { Store } from '../Store';

export function tickWeather(state: GameState, store: Store): void {
  const scale = state.dayCycleScale ?? 1;
  state.daytime = (((state.ticks * scale) % DAY_CYCLE_TICKS) / DAY_CYCLE_TICKS);

  state.weatherTicksLeft--;
  if (state.weatherTicksLeft <= 0) {
    const r = Math.random();
    const prev = state.weather;
    state.weather = r < 0.55 ? 'clear' : r < 0.85 ? 'rain' : 'storm';
    state.weatherTicksLeft = WEATHER_CYCLE_TICKS;
    if (prev !== state.weather) {
      if (state.weather === 'rain') pushToast(store, '🌧 Rain begins to fall.', 'info');
      else if (state.weather === 'storm') pushToast(store, '⚡ A storm rolls in!', 'warn');
      else if (prev !== 'clear') pushToast(store, '☀ Skies clear.', 'info');
      store.notify('weather');
    }
  }
}
