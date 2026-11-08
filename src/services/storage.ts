import { collection, doc, limit, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { LeaderboardEntry, PlayerStats, StudentProfile } from '../types/game';
import { db, handleFirestoreError, OperationType } from './firebase';

const STORAGE_KEY = 'bio_ops_save_data_v1';
const LEADERBOARD_KEY = 'bio_ops_leaderboard_v1';
const PROFILE_KEY = 'bio_ops_student_profile_v1';
const SEEN_CONCEPTS_KEY = 'bio_ops_seen_concepts_v1';

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
    levelTitle: 'Operation Cell Recon',
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
    levelTitle: 'Operation Gastro-Shield',
    stage: 'Stage 8',
    date: 'Nov 5',
    timestamp: Date.now() - 1000 * 60 * 900,
    rankTitle: 'Sergeant',
    isVictory: true,
  },
];

export function loadSeenConcepts(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_CONCEPTS_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set<string>(parsed.filter((x) => typeof x === 'string'));
    }
    return new Set<string>();
  } catch {
    return new Set<string>();
  }
}

export function markConceptAsSeen(conceptId: string): void {
  try {
    const current = loadSeenConcepts();
    current.add(conceptId);
    localStorage.setItem(SEEN_CONCEPTS_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {
    console.error('Failed to save seen biology concept:', e);
  }
}

export function resetSeenConcepts(): void {
  try {
    localStorage.removeItem(SEEN_CONCEPTS_KEY);
  } catch {
    // ignore
  }
}

export function loadStudentProfile(): StudentProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.name === 'string' && parsed.name.trim().length > 0) {
      return {
        name: parsed.name.trim(),
        className: (parsed.className || 'Science Unit').trim(),
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

export function mergeLeaderboardLists(...lists: LeaderboardEntry[][]): LeaderboardEntry[] {
  const byId = new Map<string, LeaderboardEntry>();
  for (const list of lists) {
    for (const item of list) {
      if (!item || !item.id) continue;
      const existing = byId.get(item.id);
      if (!existing || item.score > existing.score) {
        byId.set(item.id, item);
      }
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 150);
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
      return mergeLeaderboardLists(parsed, DEFAULT_LEADERBOARD_ENTRIES);
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
  const bestByStudent = new Map<string, LeaderboardEntry>();

  for (const entry of entries) {
    const normalizedName = entry.studentName.trim().toLowerCase();
    const existing = bestByStudent.get(normalizedName);
    if (!existing || entry.score > existing.score) {
      bestByStudent.set(normalizedName, entry);
    }
  }

  return Array.from(bestByStudent.values()).sort((a, b) => b.score - a.score);
}

/**
 * Subscribes to real-time synchronized cloud leaderboard in Firestore.
 * Automatically merges with local cache so no student score is ever lost.
 */
export function subscribeToLeaderboard(
  onUpdate: (entries: LeaderboardEntry[], isLiveCloud: boolean) => void
): () => void {
  const cached = loadLeaderboard();
  onUpdate(cached, false);

  const path = 'leaderboard';
  try {
    const q = query(collection(db, path), orderBy('score', 'desc'), limit(100));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
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

        const merged = mergeLeaderboardLists(cloudEntries, loadLeaderboard(), DEFAULT_LEADERBOARD_ENTRIES);
        try {
          localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(merged));
        } catch {
          // ignore
        }

        onUpdate(merged, true);
      },
      (error) => {
        console.warn('Firebase sync notice (using local storage fallback):', error.message);
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

  const cleanStudentName = (entry.studentName || 'Field Operative').trim().slice(0, 64);
  const cleanClassName = (entry.className || 'Science Unit').trim().slice(0, 64);

  const newEntry: LeaderboardEntry = {
    ...entry,
    studentName: cleanStudentName,
    className: cleanClassName,
    id: entryId,
    timestamp: Date.now(),
    date: dateStr,
  };

  // 1. Immediately update local storage cache for instant UI feedback
  const updated = mergeLeaderboardLists([newEntry], current);

  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to update local leaderboard:', e);
  }

  // 2. Synchronize to shared Firebase Firestore database
  const cleanDoc = {
    studentName: cleanStudentName,
    className: cleanClassName,
    score: Math.min(1000000, Math.max(0, Math.round(newEntry.score))),
    kills: Math.min(5000, Math.max(0, Math.round(newEntry.kills))),
    levelTitle: (newEntry.levelTitle || 'Operation Cell Recon').slice(0, 128),
    stage: (newEntry.stage || 'Stage 7').slice(0, 32),
    date: newEntry.date.slice(0, 32),
    timestamp: newEntry.timestamp,
    isVictory: Boolean(newEntry.isVictory),
  };

  try {
    await setDoc(doc(db, 'leaderboard', entryId), cleanDoc);

    // Also update deterministic Personal Best document in Firestore if this is the student's highest score!
    const safeSlug = cleanStudentName.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 48) || 'operative';
    const bestDocId = `best_${safeSlug}`;
    const existingBest = current
      .filter((e) => e.studentName.trim().toLowerCase() === cleanStudentName.toLowerCase())
      .reduce((max, item) => Math.max(max, item.score), 0);

    if (cleanDoc.score >= existingBest) {
      await setDoc(doc(db, 'leaderboard', bestDocId), cleanDoc);
    }
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
