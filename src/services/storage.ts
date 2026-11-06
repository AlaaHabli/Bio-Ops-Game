import { PlayerStats } from '../types/game';

const STORAGE_KEY = 'bio_ops_save_data_v1';

const DEFAULT_STATS: PlayerStats = {
  unlockedLevelIndex: 0,
  highScores: {},
  starsEarned: {},
  totalKills: 0,
  questionsAnswered: 0,
  questionsCorrect: 0,
  selectedWeaponId: 'scar_bio',
  soundEnabled: true,
  rankXp: 0,
};

export function loadPlayerStats(): PlayerStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATS,
      ...parsed,
      soundEnabled: true,
    };
  } catch {
    return DEFAULT_STATS;
  }
}

export function savePlayerStats(stats: PlayerStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error('Failed to save progress locally:', e);
  }
}
