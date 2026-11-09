import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { StudentProfile } from '../types/game';

export type MultiplayerPlayerStatus = 'active' | 'stunned' | 'reviving';

export interface LiveArenaPlayer {
  playerId: string;
  studentName: string;
  className: string;
  x: number;
  y: number;
  z: number;
  aimX: number;
  aimY: number;
  weaponId: string;
  hp: number;
  maxHp: number;
  status: MultiplayerPlayerStatus;
  kills: number;
  deaths: number;
  score: number;
  isReady: boolean;
  shotSeq: number;
  grenadeSeq: number;
  lastHitByName?: string;
  lastHitWeapon?: string;
  lastHitDamage?: number;
  lastHitSeq?: number;
  lastPing: number;
}

export interface ArenaKillfeedEvent {
  id: string;
  killerName: string;
  victimName: string;
  weaponName: string;
  isHeadshot?: boolean;
  timestamp: number;
}

const PLAYER_ID_STORAGE_KEY = 'bio_ops_mp_player_id_v1';

export function getOrCreateMultiplayerPlayerId(): string {
  try {
    const existing = sessionStorage.getItem(PLAYER_ID_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]+$/.test(existing)) {
      return existing;
    }
    const created = `stu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    sessionStorage.setItem(PLAYER_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return `stu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }
}

export function sanitizeRoomCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 16);
  return cleaned.length >= 2 ? cleaned : 'BIO-FFA';
}

// Local BroadcastChannel for zero-latency cross-tab multiplayer on the same machine alongside Firestore cloud sync
class RoomBroadcastBus {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(msg: any) => void> = new Set();

  constructor(roomCode: string) {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(`bio_ops_mp_room_${roomCode}`);
        this.channel.onmessage = (ev) => {
          if (ev.data) {
            this.listeners.forEach((fn) => fn(ev.data));
          }
        };
      } catch {
        this.channel = null;
      }
    }
  }

  post(data: any) {
    try {
      this.channel?.postMessage(data);
    } catch {
      // Ignore broadcast errors
    }
  }

  subscribe(fn: (msg: any) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  close() {
    try {
      this.channel?.close();
    } catch {
      // Ignore close errors
    }
    this.listeners.clear();
  }
}

const activeBuses = new Map<string, RoomBroadcastBus>();

function getBus(roomCode: string): RoomBroadcastBus {
  const code = sanitizeRoomCode(roomCode);
  let bus = activeBuses.get(code);
  if (!bus) {
    bus = new RoomBroadcastBus(code);
    activeBuses.set(code, bus);
  }
  return bus;
}

export async function joinDeathmatchRoom(
  rawRoomCode: string,
  profile: StudentProfile | null,
  weaponId: string,
  initialStatus: MultiplayerPlayerStatus = 'active'
): Promise<{ roomCode: string; playerId: string; initialPlayer: LiveArenaPlayer }> {
  const roomCode = sanitizeRoomCode(rawRoomCode);
  const playerId = getOrCreateMultiplayerPlayerId();
  const studentName = (profile?.name || 'Operative').trim().slice(0, 32) || 'Operative';
  const className = (profile?.className || 'Science Unit').trim().slice(0, 32) || 'Science Unit';
  const now = Date.now();

  // Randomize initial lateral lane so joining students don't stack on the exact same X coordinate
  const spawnX = Number(((Math.random() - 0.5) * 5.2).toFixed(2));
  const spawnZ = Number(((Math.random() - 0.5) * 2.4).toFixed(2));

  const initialPlayer: LiveArenaPlayer = {
    playerId,
    studentName,
    className,
    x: spawnX,
    y: 0,
    z: spawnZ,
    aimX: 0,
    aimY: 0,
    weaponId,
    hp: 100,
    maxHp: 100,
    status: initialStatus,
    kills: 0,
    deaths: 0,
    score: 0,
    isReady: true,
    shotSeq: 0,
    grenadeSeq: 0,
    lastHitSeq: 0,
    lastPing: now,
  };

  getBus(roomCode).post({ type: 'PLAYER_STATE', player: initialPlayer });
  getBus(roomCode).post({ type: 'REQUEST_ROOM_SYNC', requesterId: playerId });

  try {
    const roomRef = doc(db, 'multiplayer_rooms', roomCode);
    await setDoc(
      roomRef,
      {
        roomCode,
        hostName: studentName,
        stage: 'Open-World Deathmatch',
        status: 'combat',
        currentRound: 1,
        totalRounds: 99,
        lastUpdated: now,
        updatedAtServer: serverTimestamp(),
      },
      { merge: true }
    );

    const playerRef = doc(db, 'multiplayer_rooms', roomCode, 'players', playerId);
    await setDoc(playerRef, initialPlayer, { merge: true });
  } catch (err) {
    console.warn('Multiplayer Firestore join fallback (using local bus):', err);
  }

  return { roomCode, playerId, initialPlayer };
}

export async function syncLocalPlayerState(
  rawRoomCode: string,
  playerState: LiveArenaPlayer
): Promise<void> {
  const roomCode = sanitizeRoomCode(rawRoomCode);
  const updated: LiveArenaPlayer = {
    ...playerState,
    lastPing: Date.now(),
  };

  // Immediate 0ms broadcast to local tabs
  getBus(roomCode).post({ type: 'PLAYER_STATE', player: updated });

  try {
    const playerRef = doc(db, 'multiplayer_rooms', roomCode, 'players', playerState.playerId);
    await setDoc(playerRef, updated, { merge: true });
  } catch {
    // Offline or transient network error — ignore so gameplay never stutters
  }
}

export async function sendPlayerHitEvent(
  rawRoomCode: string,
  targetPlayerId: string,
  targetCurrentHp: number,
  damage: number,
  attackerId: string,
  attackerName: string,
  weaponName: string,
  isHeadshot: boolean = false
): Promise<{ newHp: number; eliminated: boolean }> {
  const roomCode = sanitizeRoomCode(rawRoomCode);
  const newHp = Math.max(0, Math.round(targetCurrentHp - damage));
  const eliminated = targetCurrentHp > 0 && newHp <= 0;
  const hitSeq = Date.now();

  const hitPayload = {
    type: 'PLAYER_HIT',
    targetPlayerId,
    attackerId,
    attackerName,
    weaponName,
    damage,
    newHp,
    eliminated,
    isHeadshot,
    hitSeq,
    timestamp: hitSeq,
  };

  getBus(roomCode).post(hitPayload);

  try {
    const targetRef = doc(db, 'multiplayer_rooms', roomCode, 'players', targetPlayerId);
    const updateData: Record<string, any> = {
      hp: newHp,
      lastHitByName: attackerName.slice(0, 32),
      lastHitWeapon: weaponName.slice(0, 32),
      lastHitDamage: damage,
      lastHitSeq: hitSeq,
      lastPing: hitSeq,
    };
    if (eliminated) {
      updateData.status = 'reviving';
    }
    await setDoc(targetRef, updateData, { merge: true });
  } catch {
    // Ignore network glitch
  }

  return { newHp, eliminated };
}

export async function leaveDeathmatchRoom(rawRoomCode: string, playerId: string): Promise<void> {
  const roomCode = sanitizeRoomCode(rawRoomCode);
  getBus(roomCode).post({ type: 'PLAYER_LEFT', playerId });
  try {
    const playerRef = doc(db, 'multiplayer_rooms', roomCode, 'players', playerId);
    await deleteDoc(playerRef);
  } catch {
    // Ignore cleanup errors
  }
}

export function subscribeToDeathmatchRoom(
  rawRoomCode: string,
  localPlayerId: string,
  onUpdate: (players: LiveArenaPlayer[]) => void,
  onLocalHitReceived?: (hit: {
    attackerName: string;
    weaponName: string;
    damage: number;
    newHp: number;
    eliminated: boolean;
    isHeadshot?: boolean;
    hitSeq: number;
  }) => void,
  onKillfeedEvent?: (event: ArenaKillfeedEvent) => void
): () => void {
  const roomCode = sanitizeRoomCode(rawRoomCode);
  const playersMap = new Map<string, LiveArenaPlayer>();
  let lastProcessedHitSeq = 0;

  const emitPlayers = () => {
    const now = Date.now();
    const activeList: LiveArenaPlayer[] = [];
    playersMap.forEach((p) => {
      // Keep players who pinged within the last 45 seconds
      if (now - (p.lastPing || 0) < 45000) {
        activeList.push(p);
      }
    });
    activeList.sort((a, b) => b.kills - a.kills || b.score - a.score);
    onUpdate(activeList);
  };

  // 1. Subscribe to instant BroadcastChannel messages
  const bus = getBus(roomCode);
  const unsubBus = bus.subscribe((msg) => {
    if (msg.type === 'PLAYER_STATE' && msg.player) {
      const p = msg.player as LiveArenaPlayer;
      playersMap.set(p.playerId, p);
      emitPlayers();
    } else if (msg.type === 'REQUEST_ROOM_SYNC' && msg.requesterId !== localPlayerId) {
      const me = playersMap.get(localPlayerId);
      if (me) {
        bus.post({ type: 'PLAYER_STATE', player: { ...me, lastPing: Date.now() } });
      }
    } else if (msg.type === 'PLAYER_LEFT' && msg.playerId) {
      playersMap.delete(msg.playerId);
      emitPlayers();
    } else if (msg.type === 'PLAYER_HIT') {
      const existing = playersMap.get(msg.targetPlayerId);
      if (existing) {
        existing.hp = msg.newHp;
        if (msg.eliminated) {
          existing.status = 'reviving';
        }
        playersMap.set(msg.targetPlayerId, { ...existing });
        emitPlayers();
      }
      if (msg.targetPlayerId === localPlayerId && msg.hitSeq > lastProcessedHitSeq) {
        lastProcessedHitSeq = msg.hitSeq;
        onLocalHitReceived?.({
          attackerName: msg.attackerName,
          weaponName: msg.weaponName,
          damage: msg.damage,
          newHp: msg.newHp,
          eliminated: msg.eliminated,
          isHeadshot: msg.isHeadshot,
          hitSeq: msg.hitSeq,
        });
      }
      if (msg.eliminated && onKillfeedEvent) {
        const victimName = existing?.studentName || 'Operative';
        onKillfeedEvent({
          id: `${msg.hitSeq}_${msg.targetPlayerId}`,
          killerName: msg.attackerName,
          victimName,
          weaponName: msg.weaponName,
          isHeadshot: msg.isHeadshot,
          timestamp: msg.timestamp || Date.now(),
        });
      }
    }
  });

  // 2. Subscribe to Firebase Firestore real-time collection snapshot
  const playersCol = collection(db, 'multiplayer_rooms', roomCode, 'players');
  const unsubFirestore = onSnapshot(
    playersCol,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data() as LiveArenaPlayer;
        if (change.type === 'removed') {
          playersMap.delete(change.doc.id);
        } else if (data && data.playerId) {
          playersMap.set(data.playerId, data);

          // Check if local player received a hit via Firestore from a remote device
          if (
            data.playerId === localPlayerId &&
            data.lastHitSeq &&
            data.lastHitSeq > lastProcessedHitSeq &&
            data.lastHitByName
          ) {
            lastProcessedHitSeq = data.lastHitSeq;
            onLocalHitReceived?.({
              attackerName: data.lastHitByName,
              weaponName: data.lastHitWeapon || 'Rifle',
              damage: data.lastHitDamage || 25,
              newHp: data.hp,
              eliminated: data.hp <= 0 || data.status === 'reviving',
              hitSeq: data.lastHitSeq,
            });
          }
        }
      });
      emitPlayers();
    },
    (err) => {
      console.warn('Firestore multiplayer room snapshot warning:', err);
    }
  );

  // Periodic stale player pruning
  const pruneTimer = setInterval(emitPlayers, 5000);

  return () => {
    clearInterval(pruneTimer);
    unsubBus();
    unsubFirestore();
  };
}
