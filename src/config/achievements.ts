// Persistent achievements unlocked across a playthrough.
// Each has a predicate over GameState; tracked via state.achievements set.

import type { GameState } from '../types';

export type Achievement = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  check: (s: GameState) => boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_home', icon: '🏠',
    title: 'Home Sweet Home',
    desc: 'Found your settlement.',
    check: s => [...s.buildings.values()].some(b => b.type === 'house'),
  },
  {
    id: 'lumberjack', icon: '🌲',
    title: 'Lumberjack',
    desc: 'Build your first Forester.',
    check: s => [...s.buildings.values()].some(b => b.type === 'forester'),
  },
  {
    id: 'breadwinner', icon: '🍞',
    title: 'Breadwinner',
    desc: 'Build your first Bakery.',
    check: s => [...s.buildings.values()].some(b => b.type === 'bakery'),
  },
  {
    id: 'connected', icon: '🛣️',
    title: 'Connected',
    desc: 'Place 5 roads.',
    check: s => [...s.buildings.values()].filter(b => b.type === 'road').length >= 5,
  },
  {
    id: 'pop_25', icon: '👥',
    title: 'Village Elder',
    desc: 'Reach population 25.',
    check: s => s.city.pop >= 25,
  },
  {
    id: 'pop_75', icon: '🏘',
    title: 'Town Crier',
    desc: 'Reach population 75.',
    check: s => s.city.pop >= 75,
  },
  {
    id: 'pop_150', icon: '🏙',
    title: 'City Mayor',
    desc: 'Reach population 150.',
    check: s => s.city.pop >= 150,
  },
  {
    id: 'pop_250', icon: '🌆',
    title: 'Metropolis',
    desc: 'Reach population 250.',
    check: s => s.city.pop >= 250,
  },
  {
    id: 'civic_pride', icon: '🌳',
    title: 'Civic Pride',
    desc: 'Build a Park.',
    check: s => [...s.buildings.values()].some(b => b.type === 'park'),
  },
  {
    id: 'fire_survivor', icon: '🚒',
    title: 'Fire Survivor',
    desc: 'Build a Fire Station while a fire is active.',
    check: s => s.disasters.some(d => d.kind === 'fire') &&
                [...s.buildings.values()].some(b => b.type === 'fireStation'),
  },
  {
    id: 'protector', icon: '🛡',
    title: 'Protector',
    desc: 'Build a Watchtower.',
    check: s => [...s.buildings.values()].some(b => b.type === 'watchtower'),
  },
  {
    id: 'happy_city', icon: '😄',
    title: 'Joyful Citizens',
    desc: 'Reach happiness 90+.',
    check: s => s.city.happiness >= 90,
  },
  {
    id: 'wonder_complete', icon: '🏆',
    title: 'Wonder of the World',
    desc: 'Complete the Wonder.',
    check: s => s.ended === 'won',
  },
];

export function checkAchievements(
  state: GameState,
  onUnlock: (a: Achievement) => void,
): void {
  if (!state.achievements) (state as { achievements?: Record<string, true> }).achievements = {};
  const ach = state.achievements!;
  for (const a of ACHIEVEMENTS) {
    if (ach[a.id]) continue;
    if (a.check(state)) {
      ach[a.id] = true;
      onUnlock(a);
    }
  }
}
