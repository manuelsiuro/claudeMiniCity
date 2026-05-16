import type { BuildingType, Tier } from '../types';

export type Milestone = {
  tier: Tier;
  pop: number;
  unlocks: BuildingType[];
  title: string;
  body: string;
};

export const MILESTONES: Milestone[] = [
  {
    tier: 0,
    pop: 0,
    unlocks: ['house', 'forester', 'farm', 'well', 'road'],
    title: 'Settlement',
    body: 'Place houses, harvest wood, and feed your people.',
  },
  {
    tier: 25,
    pop: 25,
    unlocks: ['cottage', 'quarry', 'bakery', 'market', 'park', 'fireStation'],
    title: 'Village',
    body: 'Trade goods at the market — and keep fires under control.',
  },
  {
    tier: 75,
    pop: 75,
    unlocks: ['workshop', 'school', 'watchtower'],
    title: 'Town',
    body: 'Bandits raid the outskirts. Build watchtowers to defend.',
  },
  {
    tier: 150,
    pop: 150,
    unlocks: ['tenement', 'hospital', 'bank', 'stadium'],
    title: 'City',
    body: 'Density brings plague. Hospitals and wells keep citizens safe.',
  },
  {
    tier: 250,
    pop: 250,
    unlocks: ['wonder'],
    title: 'Metropolis',
    body: 'Build the Wonder to secure your legacy.',
  },
];

export function tierForPop(pop: number): Tier {
  let t: Tier = 0;
  for (const m of MILESTONES) if (pop >= m.pop) t = m.tier;
  return t;
}

export function unlockedTypes(pop: number): Set<BuildingType> {
  const set = new Set<BuildingType>();
  for (const m of MILESTONES) {
    if (pop >= m.pop) for (const t of m.unlocks) set.add(t);
  }
  return set;
}
