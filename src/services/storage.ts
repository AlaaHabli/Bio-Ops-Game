import { collection, doc, limit, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { LeaderboardEntry, PlayerStats, StudentProfile } from '../types/game';
import { db, handleFirestoreError, OperationType } from './firebase';

const STORAGE_KEY = 'bio_ops_save_data_v1';
const LEADERBOARD_KEY = 'bio_ops_leaderboard_v1';
const PROFILE_KEY = 'bio_ops_student_profile_v1';

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

// Starter sample records so the classroom leaderboard is never empty on day 1
export const DEFAULT_LEADERBOARD_ENTRIES: LeaderboardEntry[] = [
  {
    id: 'sample-1',
    studentName: 'Zaid A.',
    className: 'Class 8-A',
    score: 4850,
    kills: 38,
    levelTitle: 'Cell Structure & Organelles',
    stage: 'Stage 7',
    date: 'Nov 6',
    timestamp: Date.now() - 1000 * 60 * 180,
    rankTitle: 'Major',
    isVictory: true,
  },
  {
    id: 'sample-2',
    studentName: 'Maya K.',
    className: 'Class 8-B',
    score: 4220,
    kills: 32,
    levelTitle: 'Gas Exchange & Respiration',
    stage: 'Stage 8',
    date: 'Nov 6',
    timestamp: Date.now() - 1000 * 60 * 360,
    rankTitle: 'Captain',
    isVictory: true,
  },
  {
    id: 'sample-3',
    studentName: 'Nour T.',
    className: 'Class 7-A',
    score: 3650,
    kills: 28,
    levelTitle: 'Microorganisms & Defense',
    stage: 'Stage 7',
    date: 'Nov 5',
    timestamp: Date.now() - 1000 * 60 * 600,
    rankTitle: 'Lieutenant',
    isVictory: true,
  },
  {
    id: 'sample-4',
    studentName: 'Omar S.',
    className: 'Class 8-A',
    score: 3100,
    kills: 24,
    levelTitle: 'Digestive Enzymes & Acid',
    stage: 'Stage 8',
    date: 'Nov 5',
    timestamp: Date.now() - 1000 * 60 * 900,
    rankTitle: 'Sergeant',
    isVictory: true,
  },
];

export function loadStudentProfile(): StudentProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.name === 'string' && parsed.name.trim().length > 0) {
      return {
        name: parsed.name.trim(),
        className: (parsed.className || '').trim(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStudentProfile(profile: StudentProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save student profile locally:', e);
  }
}

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(DEFAULT_LEADERBOARD_ENTRIES));
      return DEFAULT_LEADERBOARD_ENTRIES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.sort((a, b) => b.score - a.score);
    }
    return DEFAULT_LEADERBOARD_ENTRIES;
  } catch {
    return DEFAULT_LEADERBOARD_ENTRIES;
  }
}

/**
 * Filters the leaderboard to show only the all-time personal best score for each unique student.
 */
export function getBestScoresPerStudent(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const seenStudents = new Set<string>();
  const bestScores: LeaderboardEntry[] = [];

  // Sort descending by score first
  const sorted = [...entries].sort((a, b) => b.score - a.score);

  for (const entry of sorted) {
    const normalizedName = entry.studentName.trim().toLowerCase();
    if (!seenStudents.has(normalizedName)) {
      seenStudents.add(normalizedName);
      bestScores.push(entry);
    }
  }

  return bestScores;
}

/**
 * Subscribes to real-time synchronized cloud leaderboard in Firestore.
 * Automatically falls back to local cache if offline.
 */
export function subscribeToLeaderboard(
  onUpdate: (entries: LeaderboardEntry[], isLiveCloud: boolean) => void
): () => void {
  // Immediately provide current cached entries so UI is responsive
  const cached = loadLeaderboard();
  onUpdate(cached, false);

  const path = 'leaderboard';
  try {
    const q = query(collection(db, path), orderBy('score', 'desc'), limit(100));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const cloudEntries: LeaderboardEntry[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as Omit<LeaderboardEntry, 'id'>;
            cloudEntries.push({
              id: d.id,
              studentName: data.studentName || 'Operative',
              className: data.className || 'Science Unit',
              score: Number(data.score) || 0,
              kills: Number(data.kills) || 0,
              levelTitle: data.levelTitle || 'Classroom Mission',
              stage: data.stage || 'Stage 7',
              date: data.date || '',
              timestamp: Number(data.timestamp) || Date.now(),
              isVictory: Boolean(data.isVictory),
              rankTitle: data.rankTitle,
            });
          });

          // Sort descending and save to local storage cache
          cloudEntries.sort((a, b) => b.score - a.score);
          try {
            localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(cloudEntries));
          } catch {
            // ignore
          }

          onUpdate(cloudEntries, true);
        } else {
          // If the cloud database is brand new, seed with defaults and notify
          onUpdate(DEFAULT_LEADERBOARD_ENTRIES, true);
        }
      },
      (error) => {
        console.warn('Firebase sync notice (using local storage fallback):', error.message);
        // Fall back to local storage
        onUpdate(loadLeaderboard(), false);
        try {
          handleFirestoreError(error, OperationType.GET, path);
        } catch {
          // Keep running in offline fallback mode
        }
      }
    );

    return unsubscribe;
  } catch (error) {
    console.warn('Firebase initialization notice, using local cache:', error);
    onUpdate(cached, false);
    return () => {};
  }
}

/**
 * Records score both to real-time cloud Firebase Firestore and local browser cache.
 */
export async function recordScoreToLeaderboard(
  entry: Omit<LeaderboardEntry, 'id' | 'timestamp' | 'date'>
): Promise<LeaderboardEntry> {
  const current = loadLeaderboard();
  const dateStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const entryId = 'score_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

  const newEntry: LeaderboardEntry = {
    ...entry,
    id: entryId,
    timestamp: Date.now(),
    date: dateStr,
  };

  // 1. Immediately update local storage cache for instant UI feedback
  const updated = [newEntry, ...current.filter((e) => e.id !== entryId)]
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to update local leaderboard:', e);
  }

  // 2. Synchronize to shared Firebase Firestore database
  const cleanDoc = {
    studentName: newEntry.studentName.slice(0, 64),
    className: newEntry.className.slice(0, 64),
    score: Math.min(1000000, Math.max(0, Math.round(newEntry.score))),
    kills: Math.min(5000, Math.max(0, Math.round(newEntry.kills))),
    levelTitle: newEntry.levelTitle.slice(0, 128),
    stage: newEntry.stage.slice(0, 32),
    date: newEntry.date.slice(0, 32),
    timestamp: newEntry.timestamp,
    isVictory: Boolean(newEntry.isVictory),
  };

  try {
    await setDoc(doc(db, 'leaderboard', entryId), cleanDoc);
  } catch (error) {
    console.warn('Could not sync score to cloud (saved to local cache):', error);
  }

  return newEntry;
}

export function resetLeaderboardToDefaults(): LeaderboardEntry[] {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(DEFAULT_LEADERBOARD_ENTRIES));
  } catch {
    // ignore
  }
  return DEFAULT_LEADERBOARD_ENTRIES;
}

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
