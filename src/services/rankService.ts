import { RankInfo } from '../types/game';

export const RANKS: RankInfo[] = [
  { level: 1, title: 'RECRUIT LEUKOCYTE', code: 'REC-1', minXp: 0, nextXp: 600, color: '#94a3b8', stars: 1 },
  { level: 2, title: 'PRIVATE PHAGOCYTE', code: 'PVT-2', minXp: 600, nextXp: 1600, color: '#38bdf8', stars: 1 },
  { level: 3, title: 'CORPORAL NEUTROPHIL', code: 'CPL-3', minXp: 1600, nextXp: 3600, color: '#4ade80', stars: 2 },
  { level: 4, title: 'SERGEANT MACROPHAGE', code: 'SGT-4', minXp: 3600, nextXp: 7200, color: '#facc15', stars: 2 },
  { level: 5, title: 'LIEUTENANT DENDRITIC', code: 'LT-5', minXp: 7200, nextXp: 13000, color: '#fb923c', stars: 3 },
  { level: 6, title: 'CAPTAIN CYTOTOXIC', code: 'CPT-6', minXp: 13000, nextXp: 22000, color: '#f87171', stars: 3 },
  { level: 7, title: 'MAJOR PERFORIN', code: 'MAJ-7', minXp: 22000, nextXp: 36000, color: '#c084fc', stars: 4 },
  { level: 8, title: 'GENERAL SUPREME IMMUNITY', code: 'GEN-8', minXp: 36000, nextXp: 999999, color: '#e879f9', stars: 5 },
];

export function calculatePlayerRank(xp: number): { currentRank: RankInfo; nextRank: RankInfo | null; progressPercent: number } {
  let currentRank = RANKS[0];
  let nextRank: RankInfo | null = RANKS[1];

  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].minXp) {
      currentRank = RANKS[i];
      nextRank = i < RANKS.length - 1 ? RANKS[i + 1] : null;
    }
  }

  let progressPercent = 100;
  if (nextRank) {
    const range = nextRank.minXp - currentRank.minXp;
    const gained = xp - currentRank.minXp;
    progressPercent = Math.min(100, Math.max(0, Math.round((gained / range) * 100)));
  }

  return { currentRank, nextRank, progressPercent };
}
