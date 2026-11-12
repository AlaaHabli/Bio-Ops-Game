import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { StudentProfile } from '../types/game';

export type MultiplayerPlayerStatus = 'active' | 'stunned' | 'reviving';

export type MultiplayerAvatarType =
  | 'leukocyte'
  | 'rbc'
  | 'platelet'
  | 'dendrite'
  | 'antibody'
  | 'mucus';

export const MULTIPLAYER_AVATAR_TYPES: MultiplayerAvatarType[] = [
  'leukocyte',
  'rbc',
  'platelet',
  'dendrite',
  'antibody',
  'mucus',
];

export const AFK_TIMEOUT_MS = 60_000; // 1 minute (60 seconds) without movement, actions, or solving questions
export const MAX_PLAYERS_PER_ROOM = 5; // Each room holds up to 5 players; when full, new rooms (Room 2, Room 3, ...) are created automatically
export const MATCH_KILL_LIMIT = 10; // 10-kill threshold triggers Match End Victory Podium
export const MATCH_DURATION_SECONDS = 300; // 5-minute match countdown timer (300 seconds)

export function getAvatarDisplayInfo(avatarType?: MultiplayerAvatarType | string): {
  id: MultiplayerAvatarType;
  title: string;
  shortTitle: string;
  accentHex: string;
  badgeClass: string;
} {
  switch (avatarType) {
    case 'rbc':
      return {
        id: 'rbc',
        title: 'Red Blood Cell Fighter',
        shortTitle: 'ERYTHROCYTE',
        accentHex: '#f43f5e',
        badgeClass: 'bg-rose-950/90 border-rose-400 text-rose-200',
      };
    case 'platelet':
      return {
        id: 'platelet',
        title: 'Platelet Fighter',
        shortTitle: 'THROMBOCYTE',
        accentHex: '#fbbf24',
        badgeClass: 'bg-amber-950/90 border-amber-400 text-amber-200',
      };
    case 'dendrite':
      return {
        id: 'dendrite',
        title: 'Dendrite Fighter',
        shortTitle: 'DENDRITIC CELL',
        accentHex: '#c084fc',
        badgeClass: 'bg-purple-950/90 border-purple-400 text-purple-200',
      };
    case 'antibody':
      return {
        id: 'antibody',
        title: 'Antibody Fighter',
        shortTitle: 'IMMUNOGLOBULIN-G',
        accentHex: '#38bdf8',
        badgeClass: 'bg-sky-950/90 border-sky-400 text-sky-200',
      };
    case 'mucus':
      return {
        id: 'mucus',
        title: 'Mucus Cell Fighter',
        shortTitle: 'GOBLET CELL',
        accentHex: '#34d399',
        badgeClass: 'bg-emerald-950/90 border-emerald-400 text-emerald-200',
      };
    case 'leukocyte':
    default:
      return {
        id: 'leukocyte',
        title: 'White Leukocyte Fighter',
        shortTitle: 'LEUKOCYTE WBC',
        accentHex: '#e2e8f0',
        badgeClass: 'bg-slate-900/90 border-cyan-300 text-cyan-100',
      };
  }
}

export interface PlayerSnapshot {
  t: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  aimX: number;
  aimY: number;
  vx: number;
  vz: number;
}

export interface LiveArenaPlayer {
  playerId: string;
  studentName: string;
  className: string;
  avatarType?: MultiplayerAvatarType;
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
  accuracy?: number;
  isReady: boolean;
  shotSeq: number;
  grenadeSeq: number;
  isCrouched?: boolean;
  vx?: number;
  vz?: number;
  yaw?: number;
  pitch?: number;
  vAimX?: number;
  vAimY?: number;
  vYaw?: number;
  inputSeq?: number;
  lastActivityAt?: number;
  lastHitByName?: string;
  lastHitWeapon?: string;
  lastHitDamage?: number;
  lastHitTargetHp?: number;
  lastHitHeadshot?: boolean;
  lastHitSeq?: number;
  joinedAt?: number;
  lastPing: number;
  receivedAt?: number;
  rawRemotePing?: number;
  rawRemoteActivityAt?: number;
  snapshotHistory?: PlayerSnapshot[];
}

export interface PredictedInputCommand {
  seq: number;
  timestamp: number;
  dt: number;
  worldMoveX: number;
  worldMoveZ: number;
  moveSpeed: number;
  aimX: number;
  aimY: number;
  yaw: number;
  pitch: number;
  predictedX: number;
  predictedY: number;
  predictedZ: number;
}

export type StepCollisionSimulator = (
  prevX: number,
  prevZ: number,
  worldMoveX: number,
  worldMoveZ: number,
  moveSpeed: number,
  dt: number
) => { x: number; z: number };

/**
 * Client-Side Prediction & Server Reconciliation Engine for Player Movement and Aiming.
 * Executes local movement and aiming inputs immediately (0ms latency), stores unacknowledged
 * input commands in a ring buffer, and reconciles authoritative server snapshots by replaying
 * unacknowledged inputs and smoothly decaying any positional/aiming drift.
 */
export class ClientPredictionEngine {
  private currentSeq = 0;
  private lastAckSeq = 0;
  private pendingInputs: PredictedInputCommand[] = [];
  private readonly maxBufferSize = 120;

  private corrX = 0;
  private corrZ = 0;
  private corrAimX = 0;
  private corrAimY = 0;
  private corrYaw = 0;

  public getCurrentSeq(): number {
    return this.currentSeq;
  }

  public reset(): void {
    this.currentSeq = 0;
    this.lastAckSeq = 0;
    this.pendingInputs.length = 0;
    this.corrX = 0;
    this.corrZ = 0;
    this.corrAimX = 0;
    this.corrAimY = 0;
    this.corrYaw = 0;
  }

  public recordInputStep(cmd: Omit<PredictedInputCommand, 'seq'>): number {
    this.currentSeq += 1;
    const entry: PredictedInputCommand = {
      ...cmd,
      seq: this.currentSeq,
    };
    this.pendingInputs.push(entry);
    if (this.pendingInputs.length > this.maxBufferSize) {
      this.pendingInputs.splice(0, this.pendingInputs.length - this.maxBufferSize);
    }
    return this.currentSeq;
  }

  public reconcileServerState(
    serverState: LiveArenaPlayer,
    currentLocal: {
      x: number;
      y: number;
      z: number;
      aimX: number;
      aimY: number;
      yaw: number;
      pitch: number;
    },
    stepSimulator?: StepCollisionSimulator
  ): { snapRequired: boolean; x: number; z: number } {
    const ackSeq = serverState.inputSeq ?? 0;
    if (ackSeq <= 0 || ackSeq <= this.lastAckSeq) {
      return { snapRequired: false, x: currentLocal.x, z: currentLocal.z };
    }

    const ackIndex = this.pendingInputs.findIndex((c) => c.seq === ackSeq);
    this.lastAckSeq = ackSeq;

    if (ackIndex === -1) {
      // Discard older commands if any
      this.pendingInputs = this.pendingInputs.filter((c) => c.seq > ackSeq);
      return { snapRequired: false, x: currentLocal.x, z: currentLocal.z };
    }

    // Remove all acknowledged commands up to and including ackSeq
    this.pendingInputs.splice(0, ackIndex + 1);
    this.corrX = 0;
    this.corrZ = 0;
    this.corrAimX = 0;
    this.corrAimY = 0;
    this.corrYaw = 0;

    return { snapRequired: false, x: currentLocal.x, z: currentLocal.z };
  }

  public consumeFrameCorrection(dt: number): {
    dx: number;
    dz: number;
    dAimX: number;
    dAimY: number;
    dYaw: number;
  } {
    const blend = Math.min(1, dt * 18);
    const dx = this.corrX * blend;
    const dz = this.corrZ * blend;
    const dAimX = this.corrAimX * blend;
    const dAimY = this.corrAimY * blend;
    const dYaw = this.corrYaw * blend;

    this.corrX -= dx;
    this.corrZ -= dz;
    this.corrAimX -= dAimX;
    this.corrAimY -= dAimY;
    this.corrYaw -= dYaw;

    if (Math.abs(this.corrX) < 0.001) this.corrX = 0;
    if (Math.abs(this.corrZ) < 0.001) this.corrZ = 0;
    if (Math.abs(this.corrAimX) < 0.0005) this.corrAimX = 0;
    if (Math.abs(this.corrAimY) < 0.0005) this.corrAimY = 0;
    if (Math.abs(this.corrYaw) < 0.0005) this.corrYaw = 0;

    return { dx, dz, dAimX, dAimY, dYaw };
  }
}

/**
 * State Snapshot Interpolation Buffer delay in milliseconds (100ms render delay).
 * Provides continuous, buttery-smooth linear interpolation between consecutive authoritative
 * server snapshots, completely eliminating position rubber-banding, teleporting, and spatial divergence.
 */
export const SNAPSHOT_INTERPOLATION_DELAY_MS = 100;

/**
 * Interpolates a remote player's authoritative world-space position (X, Y, Z) and aiming angles
 * using Hermite/linear snapshot interpolation with sub-frame velocity extrapolation fallback.
 * Resolves perspective mismatches where players appeared in different relative locations.
 */
export function predictRemoteEntityState(
  rp: LiveArenaPlayer,
  nowPerf: number
): {
  worldX: number;
  worldY: number;
  worldZ: number;
  aimX: number;
  aimY: number;
  yaw: number;
} {
  const history = rp.snapshotHistory;
  if (history && history.length >= 2) {
    // Render time delayed by SNAPSHOT_INTERPOLATION_DELAY_MS to guarantee smooth interpolation between two snapshots
    const renderTime = nowPerf - SNAPSHOT_INTERPOLATION_DELAY_MS;

    // Find the two consecutive snapshots bounding renderTime
    let olderSnap: PlayerSnapshot | null = null;
    let newerSnap: PlayerSnapshot | null = null;

    for (let i = history.length - 1; i >= 0; i--) {
      const snap = history[i];
      if (snap.t <= renderTime) {
        olderSnap = snap;
        newerSnap = history[i + 1] || null;
        break;
      }
    }

    if (olderSnap && newerSnap) {
      const span = Math.max(0.001, newerSnap.t - olderSnap.t);
      const alpha = THREE_Math_clamp((renderTime - olderSnap.t) / span, 0, 1);

      // Lerp position smoothly
      const worldX = olderSnap.x + (newerSnap.x - olderSnap.x) * alpha;
      const worldY = olderSnap.y + (newerSnap.y - olderSnap.y) * alpha;
      const worldZ = olderSnap.z + (newerSnap.z - olderSnap.z) * alpha;

      // Slerp / shortest-path angle interpolation for yaw
      const yawDiff = Math.atan2(
        Math.sin(newerSnap.yaw - olderSnap.yaw),
        Math.cos(newerSnap.yaw - olderSnap.yaw)
      );
      const yaw = olderSnap.yaw + yawDiff * alpha;

      const aimX = olderSnap.aimX + (newerSnap.aimX - olderSnap.aimX) * alpha;
      const aimY = olderSnap.aimY + (newerSnap.aimY - olderSnap.aimY) * alpha;

      return { worldX, worldY, worldZ, aimX, aimY, yaw };
    } else if (history.length > 0) {
      // Extrapolate from newest snapshot if renderTime is past the latest snapshot
      const newest = history[history.length - 1];
      const extraSec = Math.min(0.12, Math.max(0, (renderTime - newest.t) / 1000));
      const damp = 1 - extraSec * 1.5;
      const effExtra = extraSec * Math.max(0.3, damp);

      const safeVx = THREE_Math_clamp(newest.vx || 0, -14.0, 14.0);
      const safeVz = THREE_Math_clamp(newest.vz || 0, -14.0, 14.0);
      const worldX = newest.x + safeVx * effExtra;
      const worldY = newest.y;
      const worldZ = newest.z + safeVz * effExtra;
      const aimX = newest.aimX;
      const aimY = newest.aimY;
      const yaw = newest.yaw;

      return { worldX, worldY, worldZ, aimX, aimY, yaw };
    }
  }

  // Fallback to velocity-based extrapolation when snapshot history has not accumulated yet
  const refClock =
    nowPerf > 1_000_000_000_000 && (rp.receivedAt || 0) < 1_000_000_000_000
      ? typeof performance !== 'undefined'
        ? performance.now()
        : nowPerf
      : nowPerf;
  const packetAgeSec = Math.min(
    0.12,
    Math.max(0, (refClock - (rp.receivedAt || refClock)) / 1000)
  );
  const horizonDamp = 1 - packetAgeSec * 1.35;
  const effAge = packetAgeSec * Math.max(0.4, horizonDamp);

  const safeRx = typeof rp.x === 'number' && Number.isFinite(rp.x) ? rp.x : 0;
  const safeRz = typeof rp.z === 'number' && Number.isFinite(rp.z) ? rp.z : -7.2;
  const safeVx = THREE_Math_clamp(rp.vx || 0, -14.0, 14.0);
  const safeVz = THREE_Math_clamp(rp.vz || 0, -14.0, 14.0);
  const worldX = safeRx + safeVx * effAge;
  const worldY = typeof rp.y === 'number' && Number.isFinite(rp.y) ? rp.y : 0;
  const worldZ = safeRz + safeVz * effAge;
  const aimX = Math.max(-1, Math.min(1, (rp.aimX || 0) + (rp.vAimX || 0) * effAge * 0.55));
  const aimY = Math.max(-1, Math.min(1, (rp.aimY || 0) + (rp.vAimY || 0) * effAge * 0.55));
  const yaw = (rp.yaw || 0) + (rp.vYaw || 0) * effAge * 0.65;

  return { worldX, worldY, worldZ, aimX, aimY, yaw };
}

function THREE_Math_clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
const PLAYER_AVATAR_STORAGE_KEY = 'bio_ops_mp_avatar_type_v1';

export function resolvePlayerAvatarType(
  playerId: string,
  explicitAvatar?: MultiplayerAvatarType
): MultiplayerAvatarType {
  if (explicitAvatar && MULTIPLAYER_AVATAR_TYPES.includes(explicitAvatar)) {
    return explicitAvatar;
  }
  let hash = 2166136261;
  for (let i = 0; i < playerId.length; i++) {
    hash ^= playerId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return MULTIPLAYER_AVATAR_TYPES[(hash >>> 0) % MULTIPLAYER_AVATAR_TYPES.length];
}

export function getOrCreateMultiplayerAvatar(playerId?: string): MultiplayerAvatarType {
  try {
    const existing = sessionStorage.getItem(PLAYER_AVATAR_STORAGE_KEY) as MultiplayerAvatarType | null;
    if (existing && MULTIPLAYER_AVATAR_TYPES.includes(existing)) {
      return existing;
    }
    const randomPick =
      MULTIPLAYER_AVATAR_TYPES[Math.floor(Math.random() * MULTIPLAYER_AVATAR_TYPES.length)];
    sessionStorage.setItem(PLAYER_AVATAR_STORAGE_KEY, randomPick);
    return randomPick;
  } catch {
    return playerId
      ? resolvePlayerAvatarType(playerId)
      : MULTIPLAYER_AVATAR_TYPES[Math.floor(Math.random() * MULTIPLAYER_AVATAR_TYPES.length)];
  }
}

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

export function getBaseRoomPrefix(raw: string): string {
  const cleaned = sanitizeRoomCode(raw);
  const stripped = cleaned.replace(/-\d+$/, '');
  return (stripped.length >= 2 ? stripped : 'BIO-FFA').slice(0, 12);
}

export function formatIndexedRoomCode(basePrefix: string, roomIndex: number): string {
  const safeBase = getBaseRoomPrefix(basePrefix);
  const idx = Math.max(1, Math.floor(roomIndex));
  return idx === 1 ? safeBase : `${safeBase}-${idx}`;
}

export function getRoomIndexFromCode(roomCode: string): number {
  const match = sanitizeRoomCode(roomCode).match(/-(\d+)$/);
  return match ? Math.max(1, parseInt(match[1], 10)) : 1;
}

/**
 * Returns all equivalent Firestore room document IDs for a given room code so that
 * Room 1 ('BIO-FFA') and legacy indexed Room 1 ('BIO-FFA-1') are seamlessly bridged
 * across separate devices regardless of cached bundles or room input format.
 */
function getEquivalentRoomCodes(rawRoomCode: string): string[] {
  const code = sanitizeRoomCode(rawRoomCode);
  const base = getBaseRoomPrefix(code);
  const idx = getRoomIndexFromCode(code);
  if (idx === 1) {
    const legacyIndexed = `${base}-1`;
    return code === base ? [base, legacyIndexed] : [code, base];
  }
  return [code];
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

function postToEquivalentBuses(rawRoomCode: string, data: any) {
  const codes = getEquivalentRoomCodes(rawRoomCode);
  for (let i = 0; i < codes.length; i++) {
    getBus(codes[i]).post(data);
  }
}

export function getInitialArenaSpawn(playerId: string): { x: number; z: number } {
  let hash = 2166136261;
  for (let i = 0; i < playerId.length; i++) {
    hash ^= playerId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const normX = ((hash >>> 0) % 1000) / 1000;
  const normZ = (((hash >>> 10) & 0x3ff) % 1000) / 1000;
  // Unobstructed central fighting courtyard in South sector (clear of cover clusters at z=-3.8 and z=-10.5)
  const side = (hash & 1) === 0 ? -1 : 1;
  const x = side * (2.2 + normX * 2.4); // X in [-4.6, -2.2] or [2.2, 4.6]
  const z = -8.5 + normZ * 2.5; // Z in [-8.5, -6.0]
  return {
    x: Number(x.toFixed(2)),
    z: Number(z.toFixed(2)),
  };
}

export async function joinDeathmatchRoom(
  rawRoomCode: string,
  profile: StudentProfile | null,
  weaponId: string,
  initialStatus: MultiplayerPlayerStatus = 'active',
  spawnCoords?: { x: number; z: number },
  minRoomIndex: number = 1
): Promise<{ roomCode: string; playerId: string; initialPlayer: LiveArenaPlayer }> {
  const basePrefix = getBaseRoomPrefix(rawRoomCode);
  const playerId = getOrCreateMultiplayerPlayerId();
  const studentName = (profile?.name || 'Operative').trim().slice(0, 32) || 'Operative';
  const className = (profile?.className || 'Science Unit').trim().slice(0, 32) || 'Science Unit';
  const now = Date.now();

  const safeSpawn = spawnCoords || getInitialArenaSpawn(playerId);
  // Orient initial yaw toward courtyard center (0, -7.2) so players immediately see each other on join
  const initialYaw = Number(Math.atan2(-safeSpawn.x, -(-7.2 - safeSpawn.z)).toFixed(3));

  const initialPlayer: LiveArenaPlayer = {
    playerId,
    studentName,
    className,
    avatarType: getOrCreateMultiplayerAvatar(playerId),
    x: safeSpawn.x,
    y: 0,
    z: safeSpawn.z,
    vx: 0,
    vz: 0,
    aimX: 0,
    aimY: 0,
    yaw: initialYaw,
    pitch: 0,
    inputSeq: 0,
    lastActivityAt: now,
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
    joinedAt: now,
    lastPing: now,
  };

  // Reset module-level sync state so fresh joins always push immediately
  lastFirestoreSyncAt = 0;
  lastSyncedState = null;

  // Auto-scaling 5-player room matchmaking:
  // Check Room 1 (e.g. BIO-FFA / BIO-FFA-1); if it has 5 active players, check Room 2 (BIO-FFA-2), etc.
  let assignedRoomCode = formatIndexedRoomCode(basePrefix, Math.max(1, minRoomIndex));
  try {
    for (let idx = Math.max(1, minRoomIndex); idx <= 50; idx++) {
      const candidateCode = formatIndexedRoomCode(basePrefix, idx);
      const eqCodes = getEquivalentRoomCodes(candidateCode);
      const snaps = await Promise.race([
        Promise.all(eqCodes.map((c) => getDocs(collection(db, 'multiplayer_rooms', c, 'players')))),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      if (!snaps) {
        assignedRoomCode = candidateCode;
        break;
      }

      const checkNow = Date.now();
      const activeOtherIds = new Set<string>();
      let alreadyInRoom = false;

      snaps.forEach((snap) => {
        snap.docs.forEach((docSnap) => {
          const p = docSnap.data() as LiveArenaPlayer;
          if (!p || !p.playerId) return;
          if (p.playerId === playerId) {
            alreadyInRoom = true;
            return;
          }
          const pingAge = checkNow - (p.lastPing || 0);
          // Tolerate up to 2 minutes of cross-device clock skew when checking active room capacity
          if (Math.abs(pingAge) < 120_000) {
            activeOtherIds.add(p.playerId);
          } else if (pingAge > 600_000) {
            // Only prune very old (>10 min) abandoned docs so clock skew between devices never deletes an active player!
            void deleteDoc(docSnap.ref).catch(() => {});
          }
        });
      });

      if (alreadyInRoom || activeOtherIds.size < MAX_PLAYERS_PER_ROOM) {
        assignedRoomCode = candidateCode;
        break;
      }
    }
  } catch {
    // Fallback to assignedRoomCode if offline
  }

  postToEquivalentBuses(assignedRoomCode, { type: 'PLAYER_STATE', player: initialPlayer });
  postToEquivalentBuses(assignedRoomCode, { type: 'REQUEST_ROOM_SYNC', requesterId: playerId });

  try {
    const eqCodes = getEquivalentRoomCodes(assignedRoomCode);
    await Promise.all(
      eqCodes.map(async (code) => {
        const roomRef = doc(db, 'multiplayer_rooms', code);
        void setDoc(
          roomRef,
          {
            roomCode: code,
            hostName: studentName,
            stage: 'Open-World Deathmatch',
            status: 'combat',
            currentRound: 1,
            totalRounds: 99,
            lastUpdated: Date.now(),
            updatedAtServer: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});

        const playerRef = doc(db, 'multiplayer_rooms', code, 'players', playerId);
        await setDoc(playerRef, initialPlayer, { merge: true });
      })
    );
  } catch {
    // Fallback to local BroadcastChannel bus silently if offline
  }

  return { roomCode: assignedRoomCode, playerId, initialPlayer };
}

const FIRESTORE_MIN_SYNC_INTERVAL_MS = 95;
let lastFirestoreSyncAt = 0;
let lastSyncedState: LiveArenaPlayer | null = null;
let isFirestoreWriteInFlight = false;
let pendingSyncPayload: { roomCode: string; state: LiveArenaPlayer } | null = null;
let pendingFlushTimer: ReturnType<typeof setTimeout> | null = null;

function hasMeaningfulStateDelta(prev: LiveArenaPlayer | null, next: LiveArenaPlayer, now: number): boolean {
  if (!prev) return true;
  if (
    next.status !== prev.status ||
    next.kills !== prev.kills ||
    next.deaths !== prev.deaths ||
    next.shotSeq !== prev.shotSeq ||
    next.grenadeSeq !== prev.grenadeSeq ||
    next.isCrouched !== prev.isCrouched ||
    next.weaponId !== prev.weaponId ||
    next.avatarType !== prev.avatarType ||
    next.hp !== prev.hp
  ) {
    return true;
  }
  if (
    Math.abs(next.x - prev.x) >= 0.025 ||
    Math.abs(next.z - prev.z) >= 0.025 ||
    Math.abs(next.y - prev.y) >= 0.025 ||
    Math.abs((next.vx || 0) - (prev.vx || 0)) >= 0.12 ||
    Math.abs((next.vz || 0) - (prev.vz || 0)) >= 0.12 ||
    Math.abs(next.aimX - prev.aimX) >= 0.025 ||
    Math.abs(next.aimY - prev.aimY) >= 0.025 ||
    Math.abs((next.yaw || 0) - (prev.yaw || 0)) >= 0.025 ||
    Math.abs((next.pitch || 0) - (prev.pitch || 0)) >= 0.025
  ) {
    return true;
  }
  // Periodic heartbeat every 2.0s when completely idle
  return now - lastFirestoreSyncAt >= 2000;
}

async function flushFirestorePlayerWrite(roomCode: string, state: LiveArenaPlayer): Promise<void> {
  if (isFirestoreWriteInFlight) {
    pendingSyncPayload = { roomCode, state };
    return;
  }

  const now = Date.now();
  const isCritical =
    !lastSyncedState ||
    state.status !== lastSyncedState.status ||
    state.kills !== lastSyncedState.kills ||
    state.weaponId !== lastSyncedState.weaponId ||
    state.shotSeq !== lastSyncedState.shotSeq ||
    state.grenadeSeq !== lastSyncedState.grenadeSeq;

  const elapsed = now - lastFirestoreSyncAt;
  if (!isCritical && elapsed < FIRESTORE_MIN_SYNC_INTERVAL_MS) {
    pendingSyncPayload = { roomCode, state };
    if (!pendingFlushTimer) {
      pendingFlushTimer = setTimeout(() => {
        pendingFlushTimer = null;
        if (pendingSyncPayload) {
          const next = pendingSyncPayload;
          pendingSyncPayload = null;
          void flushFirestorePlayerWrite(next.roomCode, next.state);
        }
      }, Math.max(20, FIRESTORE_MIN_SYNC_INTERVAL_MS - elapsed));
    }
    return;
  }

  if (!isCritical && !hasMeaningfulStateDelta(lastSyncedState, state, now)) {
    return;
  }

  if (pendingFlushTimer) {
    clearTimeout(pendingFlushTimer);
    pendingFlushTimer = null;
  }

  lastFirestoreSyncAt = now;
  lastSyncedState = state;
  isFirestoreWriteInFlight = true;

  try {
    const eqCodes = getEquivalentRoomCodes(roomCode);
    await Promise.all(
      eqCodes.map((code) => {
        const playerRef = doc(db, 'multiplayer_rooms', code, 'players', state.playerId);
        return setDoc(playerRef, state, { merge: true });
      })
    );
  } catch {
    // Offline or transient network error — ignore so gameplay never stutters
  } finally {
    isFirestoreWriteInFlight = false;
    if (pendingSyncPayload) {
      const next = pendingSyncPayload;
      pendingSyncPayload = null;
      void flushFirestorePlayerWrite(next.roomCode, next.state);
    }
  }
}

export async function syncLocalPlayerState(
  rawRoomCode: string,
  playerState: LiveArenaPlayer
): Promise<void> {
  const roomCode = sanitizeRoomCode(rawRoomCode);
  const now = Date.now();
  const existingJoinedAt = lastSyncedState?.playerId === playerState.playerId ? lastSyncedState.joinedAt : undefined;
  const updated: LiveArenaPlayer = {
    ...playerState,
    joinedAt: playerState.joinedAt || existingJoinedAt || now,
    lastPing: now,
  };

  // Immediate 0ms broadcast to local tabs across equivalent room channels
  postToEquivalentBuses(roomCode, { type: 'PLAYER_STATE', player: updated });

  // Non-blocking single-flight cloud sync (~10.5Hz) for low-latency cross-phone gameplay without UI stutter
  void flushFirestorePlayerWrite(roomCode, updated);
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
  const hitSeq = Date.now() * 1000 + Math.floor(Math.random() * 1000);

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
    timestamp: Date.now(),
  };

  postToEquivalentBuses(roomCode, hitPayload);

  try {
    // Do NOT overwrite lastPing on the target's document so cross-device clock differences never reject hits or movement
    const updateData: Record<string, any> = {
      hp: newHp,
      lastHitByName: attackerName.slice(0, 32),
      lastHitWeapon: weaponName.slice(0, 32),
      lastHitDamage: damage,
      lastHitTargetHp: newHp,
      lastHitHeadshot: isHeadshot,
      lastHitSeq: hitSeq,
    };
    if (eliminated) {
      updateData.status = 'reviving';
    }
    const eqCodes = getEquivalentRoomCodes(roomCode);
    await Promise.all(
      eqCodes.map((code) => {
        const targetRef = doc(db, 'multiplayer_rooms', code, 'players', targetPlayerId);
        return setDoc(targetRef, updateData, { merge: true });
      })
    );
  } catch {
    // Ignore network glitch
  }

  return { newHp, eliminated };
}

export async function leaveDeathmatchRoom(rawRoomCode: string, playerId: string): Promise<void> {
  const roomCode = sanitizeRoomCode(rawRoomCode);
  if (pendingFlushTimer) {
    clearTimeout(pendingFlushTimer);
    pendingFlushTimer = null;
  }
  pendingSyncPayload = null;
  postToEquivalentBuses(roomCode, { type: 'PLAYER_LEFT', playerId });
  try {
    const eqCodes = getEquivalentRoomCodes(roomCode);
    await Promise.all(
      eqCodes.map((code) => {
        const playerRef = doc(db, 'multiplayer_rooms', code, 'players', playerId);
        return deleteDoc(playerRef);
      })
    );
  } catch {
    // Ignore cleanup errors
  }
}

export async function kickAfkPlayerFromRoom(
  rawRoomCode: string,
  playerId: string,
  studentName: string = 'Operative'
): Promise<void> {
  const roomCode = sanitizeRoomCode(rawRoomCode);
  if (pendingFlushTimer) {
    clearTimeout(pendingFlushTimer);
    pendingFlushTimer = null;
  }
  pendingSyncPayload = null;
  postToEquivalentBuses(roomCode, {
    type: 'PLAYER_AFK_KICK',
    playerId,
    studentName,
    timestamp: Date.now(),
  });
  try {
    const eqCodes = getEquivalentRoomCodes(roomCode);
    await Promise.all(
      eqCodes.map((code) => {
        const playerRef = doc(db, 'multiplayer_rooms', code, 'players', playerId);
        return deleteDoc(playerRef);
      })
    );
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
  onKillfeedEvent?: (event: ArenaKillfeedEvent) => void,
  onServerReconcileLocal?: (authoritativeLocal: LiveArenaPlayer) => void,
  onRemoteAfkKicked?: (playerId: string, studentName: string) => void,
  onRoomOverflow?: (nextMinRoomIndex: number) => void,
  initialLocalPlayer?: LiveArenaPlayer
): () => void {
  const roomCode = sanitizeRoomCode(rawRoomCode);
  const eqCodes = getEquivalentRoomCodes(roomCode);
  const playersMap = new Map<string, LiveArenaPlayer>();
  if (initialLocalPlayer && initialLocalPlayer.playerId === localPlayerId) {
    const nowEpoch = Date.now();
    playersMap.set(localPlayerId, {
      ...initialLocalPlayer,
      lastPing: nowEpoch,
      lastActivityAt: nowEpoch,
      receivedAt: typeof performance !== 'undefined' ? performance.now() : nowEpoch,
    });
  }
  const processedHitSeqs = new Set<number>();
  const processedKillfeedSeqs = new Set<number>();
  if (initialLocalPlayer?.lastHitSeq) {
    processedHitSeqs.add(initialLocalPlayer.lastHitSeq);
    processedKillfeedSeqs.add(initialLocalPlayer.lastHitSeq);
  }
  let overflowTriggered = false;

  const stampIncomingPlayer = (incoming: LiveArenaPlayer): LiveArenaPlayer => {
    const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const nowEpoch = Date.now();
    const prev = playersMap.get(incoming.playerId);

    const fallbackSpawn = getInitialArenaSpawn(incoming.playerId || 'stu_default');
    const safeX =
      typeof incoming.x === 'number' && Number.isFinite(incoming.x)
        ? incoming.x
        : prev?.x ?? fallbackSpawn.x;
    const safeY =
      typeof incoming.y === 'number' && Number.isFinite(incoming.y) ? incoming.y : prev?.y ?? 0;
    const safeZ =
      typeof incoming.z === 'number' && Number.isFinite(incoming.z)
        ? incoming.z
        : prev?.z ?? fallbackSpawn.z;
    const safeYaw =
      typeof incoming.yaw === 'number' && Number.isFinite(incoming.yaw)
        ? incoming.yaw
        : prev?.yaw ?? 0;
    const safePitch =
      typeof incoming.pitch === 'number' && Number.isFinite(incoming.pitch)
        ? incoming.pitch
        : prev?.pitch ?? 0;
    const safeAimX =
      typeof incoming.aimX === 'number' && Number.isFinite(incoming.aimX)
        ? incoming.aimX
        : prev?.aimX ?? 0;
    const safeAimY =
      typeof incoming.aimY === 'number' && Number.isFinite(incoming.aimY)
        ? incoming.aimY
        : prev?.aimY ?? 0;
    const safeHp =
      typeof incoming.hp === 'number' && Number.isFinite(incoming.hp)
        ? incoming.hp
        : prev?.hp ?? 100;

    let vx =
      typeof incoming.vx === 'number' && Number.isFinite(incoming.vx)
        ? THREE_Math_clamp(incoming.vx, -14.0, 14.0)
        : 0;
    let vz =
      typeof incoming.vz === 'number' && Number.isFinite(incoming.vz)
        ? THREE_Math_clamp(incoming.vz, -14.0, 14.0)
        : 0;
    let vAimX = 0;
    let vAimY = 0;
    let vYaw = 0;

    // Always track AFK & ping relative to the local device's clock (nowEpoch) so clock skew between 2 devices never kicks active players!
    let lastActivityAt = nowEpoch;

    if (!prev) {
      lastActivityAt = nowEpoch;
    } else {
      const dtSec = prev.receivedAt ? (nowPerf - prev.receivedAt) / 1000 : 0;
      if (dtSec > 0.05 && dtSec < 0.5) {
        const dx = safeX - prev.x;
        const dz = safeZ - prev.z;
        if (Math.abs(vx) < 0.01 && Math.abs(vz) < 0.01 && Math.hypot(dx, dz) > 0.03) {
          vx = THREE_Math_clamp(dx / dtSec, -14.0, 14.0);
          vz = THREE_Math_clamp(dz / dtSec, -14.0, 14.0);
        }
        vAimX = (safeAimX - prev.aimX) / dtSec;
        vAimY = (safeAimY - prev.aimY) / dtSec;
        vYaw = (safeYaw - (prev.yaw || 0)) / dtSec;
      }

      // Detect whether this player performed any movement, aiming, shooting, or quiz answer action
      const hasMovedOrAimed =
        Math.abs(safeX - prev.x) > 0.015 ||
        Math.abs(safeZ - prev.z) > 0.015 ||
        Math.abs(safeY - prev.y) > 0.015 ||
        Math.abs(safeAimX - prev.aimX) > 0.012 ||
        Math.abs(safeAimY - prev.aimY) > 0.012 ||
        Math.abs(safeYaw - (prev.yaw || 0)) > 0.012 ||
        Math.abs(safePitch - (prev.pitch || 0)) > 0.012;
      const hasPerformedAction =
        incoming.shotSeq !== prev.shotSeq ||
        incoming.grenadeSeq !== prev.grenadeSeq ||
        incoming.status !== prev.status ||
        incoming.score !== prev.score ||
        incoming.kills !== prev.kills ||
        incoming.weaponId !== prev.weaponId ||
        incoming.isCrouched !== prev.isCrouched;
      const remoteActivityAdvanced =
        typeof incoming.lastActivityAt === 'number' &&
        typeof prev.rawRemoteActivityAt === 'number' &&
        incoming.lastActivityAt > prev.rawRemoteActivityAt;

      if (hasMovedOrAimed || hasPerformedAction || remoteActivityAdvanced) {
        lastActivityAt = nowEpoch;
      } else {
        lastActivityAt = prev.lastActivityAt || nowEpoch;
      }
    }

    // Maintain a rolling history of snapshots for state snapshot interpolation
    const snapshotHistory: PlayerSnapshot[] = prev?.snapshotHistory ? [...prev.snapshotHistory] : [];
    const isDuplicateMirrorSnapshot =
      prev &&
      typeof incoming.lastPing === 'number' &&
      incoming.lastPing === prev.rawRemotePing &&
      Math.abs(safeX - prev.x) < 0.001 &&
      Math.abs(safeZ - prev.z) < 0.001 &&
      Math.abs(safeYaw - (prev.yaw || 0)) < 0.001;

    if (!isDuplicateMirrorSnapshot) {
      snapshotHistory.push({
        t: nowPerf,
        x: safeX,
        y: safeY,
        z: safeZ,
        yaw: safeYaw,
        pitch: safePitch,
        aimX: safeAimX,
        aimY: safeAimY,
        vx,
        vz,
      });
      // Keep snapshots from the last 1500ms (max 30 snapshots)
      const cutoff = nowPerf - 1500;
      while (snapshotHistory.length > 2 && snapshotHistory[0].t < cutoff) {
        snapshotHistory.shift();
      }
      if (snapshotHistory.length > 30) {
        snapshotHistory.splice(0, snapshotHistory.length - 30);
      }
    }

    return {
      ...incoming,
      studentName: incoming.studentName || prev?.studentName || 'Operative',
      className: incoming.className || prev?.className || 'Science Unit',
      status: incoming.status || prev?.status || 'active',
      weaponId: incoming.weaponId || prev?.weaponId || 'scar_bio',
      x: safeX,
      y: safeY,
      z: safeZ,
      yaw: safeYaw,
      pitch: safePitch,
      aimX: safeAimX,
      aimY: safeAimY,
      hp: safeHp,
      maxHp: incoming.maxHp || 100,
      kills: typeof incoming.kills === 'number' ? incoming.kills : prev?.kills ?? 0,
      deaths: typeof incoming.deaths === 'number' ? incoming.deaths : prev?.deaths ?? 0,
      score: typeof incoming.score === 'number' ? incoming.score : prev?.score ?? 0,
      shotSeq: typeof incoming.shotSeq === 'number' ? incoming.shotSeq : prev?.shotSeq ?? 0,
      grenadeSeq: typeof incoming.grenadeSeq === 'number' ? incoming.grenadeSeq : prev?.grenadeSeq ?? 0,
      avatarType: incoming.avatarType || prev?.avatarType || resolvePlayerAvatarType(incoming.playerId),
      vx,
      vz,
      vAimX,
      vAimY,
      vYaw,
      joinedAt: prev?.joinedAt || nowEpoch,
      lastActivityAt,
      lastPing: nowEpoch,
      rawRemotePing: incoming.lastPing,
      rawRemoteActivityAt: incoming.lastActivityAt,
      receivedAt: nowPerf,
      snapshotHistory,
    };
  };

  const emitPlayers = () => {
    const now = Date.now();
    const activeList: LiveArenaPlayer[] = [];
    const afkVictims: { playerId: string; studentName: string }[] = [];

    playersMap.forEach((p) => {
      if (p.playerId === localPlayerId) {
        activeList.push(p);
        return;
      }
      const idleDurationMs = now - (p.lastActivityAt || now);
      const disconnectDurationMs = now - (p.lastPing || now);

      // Kick any remote player who has had zero movement, actions, or question answers for 1 minute (60,000ms)
      if (idleDurationMs >= AFK_TIMEOUT_MS || disconnectDurationMs >= AFK_TIMEOUT_MS) {
        afkVictims.push({ playerId: p.playerId, studentName: p.studentName });
      } else {
        activeList.push(p);
      }
    });

    if (afkVictims.length > 0) {
      afkVictims.forEach((v) => {
        playersMap.delete(v.playerId);
        onRemoteAfkKicked?.(v.playerId, v.studentName);
        if (v.playerId !== localPlayerId) {
          eqCodes.forEach((code) => {
            void deleteDoc(doc(db, 'multiplayer_rooms', code, 'players', v.playerId)).catch(() => {});
          });
        }
      });
    }

    // If simultaneous joins caused > MAX_PLAYERS_PER_ROOM (5) players in the same room,
    // overflow the newest joiner(s) into the next room automatically!
    if (activeList.length > MAX_PLAYERS_PER_ROOM && !overflowTriggered && onRoomOverflow) {
      const byJoinOrder = [...activeList].sort(
        (a, b) =>
          (a.joinedAt || a.lastPing || 0) - (b.joinedAt || b.lastPing || 0) ||
          a.playerId.localeCompare(b.playerId)
      );
      const myRank = byJoinOrder.findIndex((p) => p.playerId === localPlayerId);
      if (myRank >= MAX_PLAYERS_PER_ROOM) {
        overflowTriggered = true;
        const currentRoomIdx = getRoomIndexFromCode(roomCode);
        onRoomOverflow(currentRoomIdx + 1);
        return;
      }
    }

    activeList.sort((a, b) => b.kills - a.kills || b.score - a.score);
    onUpdate(activeList);
  };

  // Emit initial player list immediately if seeded
  if (playersMap.size > 0) {
    emitPlayers();
  }

  // 1. Subscribe to instant BroadcastChannel messages across all equivalent room codes
  const unsubBuses = eqCodes.map((code) => {
    const bus = getBus(code);
    return bus.subscribe((msg) => {
      if (msg.type === 'PLAYER_STATE' && msg.player) {
        const incoming = msg.player as LiveArenaPlayer;
        const p = stampIncomingPlayer(incoming);
        playersMap.set(p.playerId, p);
        emitPlayers();
      } else if (msg.type === 'REQUEST_ROOM_SYNC' && msg.requesterId !== localPlayerId) {
        const me = playersMap.get(localPlayerId) || lastSyncedState;
        if (me && me.playerId === localPlayerId) {
          bus.post({ type: 'PLAYER_STATE', player: { ...me, lastPing: Date.now() } });
        }
      } else if (msg.type === 'PLAYER_LEFT' && msg.playerId) {
        playersMap.delete(msg.playerId);
        emitPlayers();
      } else if (msg.type === 'PLAYER_AFK_KICK' && msg.playerId) {
        playersMap.delete(msg.playerId);
        onRemoteAfkKicked?.(msg.playerId, msg.studentName || 'Operative');
        emitPlayers();
      } else if (msg.type === 'PLAYER_HIT') {
        const existing = playersMap.get(msg.targetPlayerId);
        if (existing && existing.status !== 'active') {
          return;
        }
        if (existing) {
          existing.hp = msg.newHp;
          if (msg.eliminated) {
            existing.status = 'reviving';
          }
          playersMap.set(msg.targetPlayerId, { ...existing });
          emitPlayers();
        }
        if (msg.targetPlayerId === localPlayerId && msg.hitSeq && !processedHitSeqs.has(msg.hitSeq)) {
          processedHitSeqs.add(msg.hitSeq);
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
        if (
          msg.eliminated &&
          onKillfeedEvent &&
          (!msg.hitSeq || !processedKillfeedSeqs.has(msg.hitSeq))
        ) {
          if (msg.hitSeq) processedKillfeedSeqs.add(msg.hitSeq);
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
  });

  // 2. Subscribe to Firebase Firestore real-time collection snapshots across all equivalent room codes
  const unsubFirestores = eqCodes.map((code) => {
    const playersCol = collection(db, 'multiplayer_rooms', code, 'players');
    return onSnapshot(
      playersCol,
      (snapshot) => {
        let hasMeaningfulRemoteChange = false;
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data() as LiveArenaPlayer;
          if (change.type === 'removed') {
            if (change.doc.id !== localPlayerId) {
              playersMap.delete(change.doc.id);
              hasMeaningfulRemoteChange = true;
            }
            return;
          }
          const resolvedId = data?.playerId || change.doc.id;
          if (!data || !resolvedId) return;
          data.playerId = resolvedId;

          const existingPlayer = playersMap.get(resolvedId);

          // Seed historical lastHitSeq on initial document load so old kills prior to joining don't replay
          if (change.type === 'added' && data.lastHitSeq && !existingPlayer) {
            processedKillfeedSeqs.add(data.lastHitSeq);
            if (resolvedId === localPlayerId) {
              processedHitSeqs.add(data.lastHitSeq);
            }
          }

          // 1. ALWAYS process incoming hits on the local player first, BEFORE any pending-write or mirror-ping filtering!
          if (
            resolvedId === localPlayerId &&
            data.lastHitSeq &&
            !processedHitSeqs.has(data.lastHitSeq) &&
            data.lastHitByName
          ) {
            processedHitSeqs.add(data.lastHitSeq);
            const resolvedHp =
              typeof data.lastHitTargetHp === 'number' ? data.lastHitTargetHp : data.hp;
            onLocalHitReceived?.({
              attackerName: data.lastHitByName,
              weaponName: data.lastHitWeapon || 'Rifle',
              damage: data.lastHitDamage || 25,
              newHp: resolvedHp,
              eliminated: resolvedHp <= 0 || data.status === 'reviving',
              isHeadshot: data.lastHitHeadshot,
              hitSeq: data.lastHitSeq,
            });
          }

          // 1b. Emit real-time cross-device killfeed event whenever any operative in the room is neutralized!
          if (
            data.lastHitSeq &&
            !processedKillfeedSeqs.has(data.lastHitSeq) &&
            data.lastHitByName &&
            onKillfeedEvent
          ) {
            const resolvedTargetHp =
              typeof data.lastHitTargetHp === 'number' ? data.lastHitTargetHp : data.hp;
            const isElimination = resolvedTargetHp <= 0 || data.status === 'reviving';
            if (isElimination) {
              processedKillfeedSeqs.add(data.lastHitSeq);
              const victimName =
                data.studentName || existingPlayer?.studentName || 'Operative';
              onKillfeedEvent({
                id: `${data.lastHitSeq}_${resolvedId}`,
                killerName: data.lastHitByName,
                victimName,
                weaponName: data.lastHitWeapon || 'SCAR-H Bio-Rifle',
                isHeadshot: Boolean(data.lastHitHeadshot),
                timestamp: Date.now(),
              });
            }
          }

          // 2. Ignore older mirror snapshots only when no combat state (kills, status, lastHitSeq) changed
          if (
            existingPlayer &&
            typeof existingPlayer.rawRemotePing === 'number' &&
            typeof data.lastPing === 'number' &&
            data.lastPing < existingPlayer.rawRemotePing &&
            data.kills === existingPlayer.kills &&
            data.status === existingPlayer.status &&
            data.lastHitSeq === existingPlayer.lastHitSeq
          ) {
            return;
          }

          // 3. For the local player: ensure playersMap always tracks localPlayerId for accurate room count & scoreboard
          if (resolvedId === localPlayerId && change.doc.metadata.hasPendingWrites) {
            const prevLocal = playersMap.get(localPlayerId);
            if (
              !prevLocal ||
              prevLocal.status !== data.status ||
              prevLocal.kills !== data.kills ||
              prevLocal.score !== data.score
            ) {
              playersMap.set(localPlayerId, stampIncomingPlayer(data));
              hasMeaningfulRemoteChange = true;
            }
            return;
          }

          const stamped = stampIncomingPlayer(data);
          playersMap.set(resolvedId, stamped);
          hasMeaningfulRemoteChange = true;

          if (resolvedId === localPlayerId) {
            onServerReconcileLocal?.(stamped);
          }
        });
        if (hasMeaningfulRemoteChange) {
          emitPlayers();
        }
      },
      (err) => {
        console.warn('Firestore multiplayer room snapshot warning:', err);
      }
    );
  });

  // Periodic stale & AFK player check every 3 seconds
  const pruneTimer = setInterval(emitPlayers, 3000);

  return () => {
    clearInterval(pruneTimer);
    unsubBuses.forEach((u) => u());
    unsubFirestores.forEach((u) => u());
  };
}

