// Lightweight aggregate jobs model: city has total job slots and total workers.
// Production scales by employment ratio. No per-citizen pathing.

import type { GameState } from '../../types';
import { BUILDINGS } from '../../config/buildings';

export type JobsSnapshot = {
  totalJobs: number;
  totalWorkers: number;
  ratio: number;
};

export function computeJobs(state: GameState): JobsSnapshot {
  let totalJobs = 0;
  for (const b of state.buildings.values()) {
    if (b.idle) continue;
    if (b.burning !== undefined) continue;
    totalJobs += BUILDINGS[b.type].jobs;
  }
  const totalWorkers = Math.min(totalJobs, state.city.pop);
  const ratio = totalJobs > 0 ? totalWorkers / totalJobs : 1;
  return { totalJobs, totalWorkers, ratio };
}
