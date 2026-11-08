import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { Question } from '../types/game';
import { CURRICULUM_LEVELS } from '../data/curriculumData';

export interface ArenaPlayer {
  playerId: string;
  studentName: string;
  className: string;
  score: number;
  kills: number;
  hp: number;
  isReady: boolean;
  hasAnswered: boolean;
  isCorrect: boolean;
  selectedAnswer: number;
  lastPing: number;
}

export interface MultiplayerRoom {
  id: string;
  roomCode: string;
  hostId: string;
  hostName: string;
  stage: 'Grade 5' | 'Stage 7' | 'Stage 8' | string;
  status: 'lobby' | 'quiz' | 'combat' | 'podium';
  currentRound: number;
  totalRounds: number;
  currentQuestionIndex: number;
  questionStartTime: number;
  combatStartTime: number;
  lastUpdated: number;
  activeQuestion?: Question;
}

// Generate human-friendly 4-letter room code (e.g. CELL, WAR, BIO, WBC, LUNG)
export function generateRoomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

// Pick a random question pool for the selected stage
export function getQuestionsForStage(stage: string): Question[] {
  const matchingLevels = CURRICULUM_LEVELS.filter((lvl) => {
    if (stage === 'Grade 5') return lvl.stage === 'Grade 5';
    if (stage === 'Stage 8') return lvl.stage === 'Stage 8';
    return lvl.stage === 'Stage 7';
  });

  const allQuestions: Question[] = [];
  matchingLevels.forEach((l) => {
    allQuestions.push(...l.questions);
  });

  // Fallback to all questions if none found
  if (allQuestions.length === 0) {
    CURRICULUM_LEVELS.forEach((l) => allQuestions.push(...l.questions));
  }

  // Shuffle and pick 10
  const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 10);
}

// Global cached question list for current room
const roomQuestionsMap = new Map<string, Question[]>();

export function getCachedRoomQuestion(roomId: string, index: number, stage: string): Question {
  let list = roomQuestionsMap.get(roomId);
  if (!list || list.length === 0) {
    list = getQuestionsForStage(stage);
    roomQuestionsMap.set(roomId, list);
  }
  return list[index % list.length];
}

/**
 * Creates a new multiplayer deathmatch room hosted by the student
 */
export async function createMultiplayerRoom(
  hostName: string,
  className: string,
  stage: 'Grade 5' | 'Stage 7' | 'Stage 8'
): Promise<{ roomId: string; playerId: string }> {
  const roomCode = generateRoomCode();
  const roomId = `room_${roomCode}`;
  const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

  const initialQuestions = getQuestionsForStage(stage);
  roomQuestionsMap.set(roomId, initialQuestions);

  const roomDoc: MultiplayerRoom = {
    id: roomId,
    roomCode,
    hostId: playerId,
    hostName: hostName.trim() || 'Student Host',
    stage,
    status: 'lobby',
    currentRound: 1,
    totalRounds: 3,
    currentQuestionIndex: 0,
    questionStartTime: 0,
    combatStartTime: 0,
    lastUpdated: Date.now(),
    activeQuestion: initialQuestions[0],
  };

  const hostPlayer: ArenaPlayer = {
    playerId,
    studentName: hostName.trim() || 'Student Host',
    className: className.trim() || 'Science Unit',
    score: 0,
    kills: 0,
    hp: 100,
    isReady: true,
    hasAnswered: false,
    isCorrect: false,
    selectedAnswer: -1,
    lastPing: Date.now(),
  };

  await setDoc(doc(db, 'multiplayer_rooms', roomId), roomDoc);
  await setDoc(doc(db, 'multiplayer_rooms', roomId, 'players', playerId), hostPlayer);

  return { roomId, playerId };
}

/**
 * Joins an existing multiplayer deathmatch room using a 4-letter code
 */
export async function joinMultiplayerRoom(
  roomCodeInput: string,
  studentName: string,
  className: string
): Promise<{ roomId: string; playerId: string; room: MultiplayerRoom }> {
  const code = roomCodeInput.trim().toUpperCase();
  const roomId = code.startsWith('room_') ? code : `room_${code}`;

  const roomSnap = await getDoc(doc(db, 'multiplayer_rooms', roomId));
  if (!roomSnap.exists()) {
    throw new Error(`Room Code "${code}" was not found. Check with your classmate or teacher.`);
  }

  const roomData = roomSnap.data() as MultiplayerRoom;
  const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

  const playerDoc: ArenaPlayer = {
    playerId,
    studentName: studentName.trim() || 'Operative',
    className: className.trim() || 'Science Unit',
    score: 0,
    kills: 0,
    hp: 100,
    isReady: true,
    hasAnswered: false,
    isCorrect: false,
    selectedAnswer: -1,
    lastPing: Date.now(),
  };

  await setDoc(doc(db, 'multiplayer_rooms', roomId, 'players', playerId), playerDoc);

  return { roomId, playerId, room: roomData };
}

/**
 * List recently active public rooms in Firestore so students can see and join with 1 click
 */
export async function listActiveRooms(): Promise<MultiplayerRoom[]> {
  try {
    const q = query(collection(db, 'multiplayer_rooms'), limit(15));
    const snaps = await getDocs(q);
    const rooms: MultiplayerRoom[] = [];
    const tenMinutesAgo = Date.now() - 1000 * 60 * 10;
    snaps.forEach((d) => {
      const data = d.data() as MultiplayerRoom;
      if (data && data.lastUpdated > tenMinutesAgo) {
        rooms.push(data);
      }
    });
    return rooms.sort((a, b) => b.lastUpdated - a.lastUpdated);
  } catch (e) {
    console.warn('Could not list active rooms:', e);
    return [];
  }
}

/**
 * Real-time subscription to room state and player roster
 */
export function subscribeToMultiplayerRoom(
  roomId: string,
  onRoomUpdate: (room: MultiplayerRoom | null) => void,
  onPlayersUpdate: (players: ArenaPlayer[]) => void
): () => void {
  // 1. Listen to room doc
  const unsubRoom = onSnapshot(
    doc(db, 'multiplayer_rooms', roomId),
    (snap) => {
      if (!snap.exists()) {
        onRoomUpdate(null);
        return;
      }
      const data = snap.data() as MultiplayerRoom;
      onRoomUpdate(data);
    },
    (err) => {
      console.warn('Room sync error:', err.message);
    }
  );

  // 2. Listen to players subcollection
  const unsubPlayers = onSnapshot(
    collection(db, 'multiplayer_rooms', roomId, 'players'),
    (snap) => {
      const players: ArenaPlayer[] = [];
      snap.forEach((d) => {
        players.push(d.data() as ArenaPlayer);
      });
      // Sort by score descending (Live leaderboard!)
      players.sort((a, b) => b.score - a.score || b.kills - a.kills);
      onPlayersUpdate(players);
    },
    (err) => {
      console.warn('Players subcollection sync error:', err.message);
    }
  );

  return () => {
    unsubRoom();
    unsubPlayers();
  };
}

/**
 * Host starts the multiplayer match (triggers Round 1 Quiz Freeze for everyone)
 */
export async function startMultiplayerMatch(roomId: string, stage: string): Promise<void> {
  const question = getCachedRoomQuestion(roomId, 0, stage);
  await updateDoc(doc(db, 'multiplayer_rooms', roomId), {
    status: 'quiz',
    currentRound: 1,
    currentQuestionIndex: 0,
    questionStartTime: Date.now(),
    activeQuestion: question,
    lastUpdated: Date.now(),
  });
}

/**
 * Student submits their answer during the Quiz Freeze phase
 */
export async function submitPlayerAnswer(
  roomId: string,
  playerId: string,
  selectedIndex: number,
  isCorrect: boolean,
  timeTakenSec: number
): Promise<number> {
  // Speed bonus: answering faster yields up to 500 combat points + 100 Shield!
  const bonus = isCorrect ? Math.max(150, Math.round(500 - timeTakenSec * 25)) : 0;

  await updateDoc(doc(db, 'multiplayer_rooms', roomId, 'players', playerId), {
    hasAnswered: true,
    isCorrect,
    selectedAnswer: selectedIndex,
    score: (isCorrect ? bonus : 0),
    hp: isCorrect ? 150 : 80, // Over-shield for correct answer
    lastPing: Date.now(),
  });

  return bonus;
}

/**
 * Advances room from Quiz Freeze to 3D Combat Wave
 */
export async function advanceToCombatWave(roomId: string): Promise<void> {
  await updateDoc(doc(db, 'multiplayer_rooms', roomId), {
    status: 'combat',
    combatStartTime: Date.now(),
    lastUpdated: Date.now(),
  });
}

/**
 * Updates a player's live combat kills and score during the arena battle
 */
export async function updatePlayerCombatStats(
  roomId: string,
  playerId: string,
  earnedKills: number,
  earnedScore: number,
  currentHp: number
): Promise<void> {
  const pRef = doc(db, 'multiplayer_rooms', roomId, 'players', playerId);
  const snap = await getDoc(pRef);
  if (!snap.exists()) return;
  const cur = snap.data() as ArenaPlayer;

  await updateDoc(pRef, {
    score: cur.score + earnedScore,
    kills: cur.kills + earnedKills,
    hp: Math.max(0, currentHp),
    lastPing: Date.now(),
  });
}

/**
 * Advances to next round quiz freeze or to final victory podium
 */
export async function advanceNextRoundOrPodium(
  roomId: string,
  currentRound: number,
  totalRounds: number,
  stage: string
): Promise<void> {
  if (currentRound < totalRounds) {
    const nextRound = currentRound + 1;
    const nextQ = getCachedRoomQuestion(roomId, nextRound - 1, stage);

    // Reset player answer states for new round
    const playersSnap = await getDocs(collection(db, 'multiplayer_rooms', roomId, 'players'));
    const updates = playersSnap.docs.map((d) =>
      updateDoc(d.ref, {
        hasAnswered: false,
        isCorrect: false,
        selectedAnswer: -1,
      })
    );
    await Promise.all(updates);

    await updateDoc(doc(db, 'multiplayer_rooms', roomId), {
      status: 'quiz',
      currentRound: nextRound,
      currentQuestionIndex: nextRound - 1,
      questionStartTime: Date.now(),
      activeQuestion: nextQ,
      lastUpdated: Date.now(),
    });
  } else {
    // Podium Victory!
    await updateDoc(doc(db, 'multiplayer_rooms', roomId), {
      status: 'podium',
      lastUpdated: Date.now(),
    });
  }
}

/**
 * Leaves or deletes room
 */
export async function leaveMultiplayerRoom(roomId: string, playerId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'multiplayer_rooms', roomId, 'players', playerId));
  } catch {
    // ignore
  }
}
