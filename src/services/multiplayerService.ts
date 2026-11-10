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

export const AFK_TIMEOUT_MS = 60_000; // 1 minute (60 seconds) without movement, actions, or solving questions
export const MAX_PLAYERS_PER_ROOM = 5; // Each room holds up to 5 players; when full, new rooms (Room 2, Room 3, ...) are created automatically

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

    const ackCmd = this.pendingInputs[ackIndex];
    // Remove all acknowledged commands up to and including ackSeq
    this.pendingInputs.splice(0, ackIndex + 1);

    // Check if the server-acknowledged state at ackSeq matches our historical prediction at ackSeq
    const serverAckDivergence = Math.hypot(
      serverState.x - ackCmd.predictedX,
      serverState.z - ackCmd.predictedZ
    );
    const serverAimDivergence = Math.hypot(
      serverState.aimX - ackCmd.aimX,
      serverState.aimY - ackCmd.aimY
    );

    if (serverAckDivergence < 0.08 && serverAimDivergence < 0.025) {
      // Prediction matched authoritative server state — zero correction needed
      return { snapRequired: false, x: currentLocal.x, z: currentLocal.z };
    }

    // Replay all unacknowledged input commands on top of the authoritative server state
    let simX = serverState.x;
    let simZ = serverState.z;
    let prevPredX = ackCmd.predictedX;
    let prevPredZ = ackCmd.predictedZ;
    let simAimX = serverState.aimX;
    let simAimY = serverState.aimY;
    let simYaw = serverState.yaw ?? currentLocal.yaw;

    for (let i = 0; i < this.pendingInputs.length; i++) {
      const cmd = this.pendingInputs[i];
      const stepDx = cmd.predictedX - prevPredX;
      const stepDz = cmd.predictedZ - prevPredZ;
      prevPredX = cmd.predictedX;
      prevPredZ = cmd.predictedZ;

      if (stepSimulator) {
        const next = stepSimulator(
          simX,
          simZ,
          cmd.worldMoveX,
          cmd.worldMoveZ,
          cmd.moveSpeed,
          cmd.dt
        );
        simX = next.x;
        simZ = next.z;
      } else {
        simX += stepDx;
        simZ += stepDz;
      }
      simAimX = cmd.aimX;
      simAimY = cmd.aimY;
      simYaw = cmd.yaw;
    }

    const errX = simX - currentLocal.x;
    const errZ = simZ - currentLocal.z;
    const posErrorMag = Math.hypot(errX, errZ);

    if (posErrorMag > 3.5) {
      // Hard snap only on extreme desync / teleport boundary
      this.corrX = 0;
      this.corrZ = 0;
      return { snapRequired: true, x: simX, z: simZ };
    }

    if (posErrorMag >= 0.06) {
      this.corrX = errX;
      this.corrZ = errZ;
    }

    const errAimX = simAimX - currentLocal.aimX;
    const errAimY = simAimY - currentLocal.aimY;
    if (Math.hypot(errAimX, errAimY) >= 0.03) {
      this.corrAimX = errAimX * 0.5;
      this.corrAimY = errAimY * 0.5;
    }

    const errYaw = Math.atan2(Math.sin(simYaw - currentLocal.yaw), Math.cos(simYaw - currentLocal.yaw));
    if (Math.abs(errYaw) >= 0.03) {
      this.corrYaw = errYaw * 0.5;
    }

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
      const extraSec = Math.min(0.25, Math.max(0, (renderTime - newest.t) / 1000));
      const damp = 1 - extraSec * 1.5;
      const effExtra = extraSec * Math.max(0.3, damp);

      const worldX = newest.x + newest.vx * effExtra;
      const worldY = newest.y;
      const worldZ = newest.z + newest.vz * effExtra;
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
    0.2,
    Math.max(0, (refClock - (rp.receivedAt || refClock)) / 1000)
  );
  const horizonDamp = 1 - packetAgeSec * 1.35;
  const effAge = packetAgeSec * Math.max(0.4, horizonDamp);

  const worldX = rp.x + (rp.vx || 0) * effAge;
  const worldY = typeof rp.y === 'number' && Number.isFinite(rp.y) ? rp.y : 0;
  const worldZ = rp.z + (rp.vz || 0) * effAge;
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
  return `${safeBase}-${idx}`;
}

export function getRoomIndexFromCode(roomCode: string): number {
  const match = sanitizeRoomCode(roomCode).match(/-(\d+)$/);
  return match ? Math.max(1, parseInt(match[1], 10)) : 1;
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

export function getInitialArenaSpawn(playerId: string): { x: number; z: number } {
  let hash = 2166136261;
  for (let i = 0; i < playerId.length; i++) {
    hash ^= playerId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const normX = ((hash >>> 0) % 1000) / 1000;
  const normZ = (((hash >>> 10) & 0x3ff) % 1000) / 1000;
  // Safe open fighting courtyard in South sector (clear of Central Bunker at Z=-22, Watchtower at X=14, and Cover Clusters)
  const rawX = (normX - 0.5) * 18.0;
  const x = Math.abs(rawX) < 2.2 ? (rawX < 0 ? -3.4 : 3.4) : rawX;
  const z = -9.2 + normZ * 3.8; // Z in [-9.2, -5.4]
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

  const initialPlayer: LiveArenaPlayer = {
    playerId,
    studentName,
    className,
    x: safeSpawn.x,
    y: 0,
    z: safeSpawn.z,
    vx: 0,
    vz: 0,
    aimX: 0,
    aimY: 0,
    yaw: 0,
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

  // Auto-scaling 5-player room matchmaking:
  // Check Room 1 (e.g. BIO-FFA-1); if it has 5 active players, check Room 2 (BIO-FFA-2), then Room 3 (BIO-FFA-3), and so on.
  let assignedRoomCode = formatIndexedRoomCode(basePrefix, Math.max(1, minRoomIndex));
  try {
    for (let idx = Math.max(1, minRoomIndex); idx <= 50; idx++) {
      const candidateCode = formatIndexedRoomCode(basePrefix, idx);
      const playersCol = collection(db, 'multiplayer_rooms', candidateCode, 'players');
      const snap = await Promise.race([
        getDocs(playersCol),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      if (!snap) {
        assignedRoomCode = candidateCode;
        break;
      }

      const checkNow = Date.now();
      let activeOthersCount = 0;
      let alreadyInRoom = false;

      snap.docs.forEach((docSnap) => {
        const p = docSnap.data() as LiveArenaPlayer;
        if (!p || !p.playerId) return;
        if (p.playerId === playerId) {
          alreadyInRoom = true;
          return;
        }
        const pingAge = checkNow - (p.lastPing || 0);
        const activityAge = checkNow - (p.lastActivityAt || p.lastPing || 0);
        if (pingAge < AFK_TIMEOUT_MS && activityAge < AFK_TIMEOUT_MS) {
          activeOthersCount += 1;
        } else {
          // Prune stale/disconnected player doc so it never blocks room capacity
          void deleteDoc(docSnap.ref).catch(() => {});
        }
      });

      if (alreadyInRoom || activeOthersCount < MAX_PLAYERS_PER_ROOM) {
        assignedRoomCode = candidateCode;
        break;
      }
    }
  } catch {
    // Fallback to assignedRoomCode if offline
  }

  getBus(assignedRoomCode).post({ type: 'PLAYER_STATE', player: initialPlayer });
  getBus(assignedRoomCode).post({ type: 'REQUEST_ROOM_SYNC', requesterId: playerId });

  try {
    const roomRef = doc(db, 'multiplayer_rooms', assignedRoomCode);
    void setDoc(
      roomRef,
      {
        roomCode: assignedRoomCode,
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

    const playerRef = doc(db, 'multiplayer_rooms', assignedRoomCode, 'players', playerId);
    await setDoc(playerRef, initialPlayer, { merge: true });
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
    Math.abs((next.yaw || 0) - (prev.yaw || 0)) >= 0.025
  ) {
    return true;
  }
  // Periodic heartbeat every 3.0s when completely idle
  return now - lastFirestoreSyncAt >= 3000;
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
    const playerRef = doc(db, 'multiplayer_rooms', roomCode, 'players', state.playerId);
    await setDoc(playerRef, state, { merge: true });
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

  // Immediate 0ms broadcast to local tabs
  getBus(roomCode).post({ type: 'PLAYER_STATE', player: updated });

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
      lastHitTargetHp: newHp,
      lastHitHeadshot: isHeadshot,
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
  if (pendingFlushTimer) {
    clearTimeout(pendingFlushTimer);
    pendingFlushTimer = null;
  }
  pendingSyncPayload = null;
  getBus(roomCode).post({ type: 'PLAYER_LEFT', playerId });
  try {
    const playerRef = doc(db, 'multiplayer_rooms', roomCode, 'players', playerId);
    await deleteDoc(playerRef);
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
  getBus(roomCode).post({
    type: 'PLAYER_AFK_KICK',
    playerId,
    studentName,
    timestamp: Date.now(),
  });
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
  onKillfeedEvent?: (event: ArenaKillfeedEvent) => void,
  onServerReconcileLocal?: (authoritativeLocal: LiveArenaPlayer) => void,
  onRemoteAfkKicked?: (playerId: string, studentName: string) => void,
  onRoomOverflow?: (nextMinRoomIndex: number) => void,
  initialLocalPlayer?: LiveArenaPlayer
): () => void {
  const roomCode = sanitizeRoomCode(rawRoomCode);
  const playersMap = new Map<string, LiveArenaPlayer>();
  if (initialLocalPlayer && initialLocalPlayer.playerId === localPlayerId) {
    playersMap.set(localPlayerId, {
      ...initialLocalPlayer,
      receivedAt: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    });
  }
  let lastProcessedHitSeq = 0;
  let overflowTriggered = false;

  const stampIncomingPlayer = (incoming: LiveArenaPlayer): LiveArenaPlayer => {
    const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const nowEpoch = Date.now();
    const prev = playersMap.get(incoming.playerId);
    let vx = incoming.vx ?? 0;
    let vz = incoming.vz ?? 0;
    let vAimX = 0;
    let vAimY = 0;
    let vYaw = 0;
    const isValidEpochTimestamp = (ts?: number): ts is number =>
      typeof ts === 'number' && Number.isFinite(ts) && ts > 1_700_000_000_000 && ts <= nowEpoch + 60_000;

    let lastActivityAt = isValidEpochTimestamp(incoming.lastActivityAt)
      ? incoming.lastActivityAt
      : nowEpoch;

    // On initial snapshot of a player (before any local session delta), start their local AFK window from nowEpoch
    if (!prev) {
      lastActivityAt = nowEpoch;
    } else {
      const dtSec = prev.receivedAt ? (nowPerf - prev.receivedAt) / 1000 : 0;
      if (dtSec > 0.012 && dtSec < 0.5) {
        const dx = incoming.x - prev.x;
        const dz = incoming.z - prev.z;
        if (Math.abs(vx) < 0.01 && Math.abs(vz) < 0.01 && Math.hypot(dx, dz) > 0.03) {
          vx = dx / dtSec;
          vz = dz / dtSec;
        }
        vAimX = (incoming.aimX - prev.aimX) / dtSec;
        vAimY = (incoming.aimY - prev.aimY) / dtSec;
        vYaw = ((incoming.yaw || 0) - (prev.yaw || 0)) / dtSec;
      }

      // Detect whether this player performed any movement, aiming, shooting, or quiz answer action
      const hasMovedOrAimed =
        Math.abs(incoming.x - prev.x) > 0.02 ||
        Math.abs(incoming.z - prev.z) > 0.02 ||
        Math.abs(incoming.y - prev.y) > 0.02 ||
        Math.abs(incoming.aimX - prev.aimX) > 0.015 ||
        Math.abs(incoming.aimY - prev.aimY) > 0.015 ||
        Math.abs((incoming.yaw || 0) - (prev.yaw || 0)) > 0.015;
      const hasPerformedAction =
        incoming.shotSeq !== prev.shotSeq ||
        incoming.grenadeSeq !== prev.grenadeSeq ||
        incoming.status !== prev.status ||
        incoming.score !== prev.score ||
        incoming.kills !== prev.kills ||
        incoming.weaponId !== prev.weaponId ||
        incoming.isCrouched !== prev.isCrouched;

      if (
        isValidEpochTimestamp(incoming.lastActivityAt) &&
        incoming.lastActivityAt > (prev.lastActivityAt || 0)
      ) {
        lastActivityAt = incoming.lastActivityAt;
      } else if (hasMovedOrAimed || hasPerformedAction) {
        lastActivityAt = nowEpoch;
      } else {
        lastActivityAt = isValidEpochTimestamp(prev.lastActivityAt)
          ? prev.lastActivityAt
          : nowEpoch;
      }
    }

    // Maintain a rolling history of snapshots for state snapshot interpolation
    const snapshotHistory: PlayerSnapshot[] = prev?.snapshotHistory ? [...prev.snapshotHistory] : [];
    snapshotHistory.push({
      t: nowPerf,
      x: incoming.x,
      y: incoming.y ?? 0,
      z: incoming.z,
      yaw: incoming.yaw ?? 0,
      pitch: incoming.pitch ?? 0,
      aimX: incoming.aimX ?? 0,
      aimY: incoming.aimY ?? 0,
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

    return {
      ...incoming,
      vx,
      vz,
      vAimX,
      vAimY,
      vYaw,
      joinedAt: isValidEpochTimestamp(incoming.joinedAt)
        ? incoming.joinedAt
        : prev?.joinedAt || nowEpoch,
      lastActivityAt,
      lastPing: isValidEpochTimestamp(incoming.lastPing) ? incoming.lastPing : nowEpoch,
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
          void deleteDoc(doc(db, 'multiplayer_rooms', roomCode, 'players', v.playerId)).catch(() => {});
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

  // 1. Subscribe to instant BroadcastChannel messages
  const bus = getBus(roomCode);
  const unsubBus = bus.subscribe((msg) => {
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
        if (!data || !data.playerId) return;

        // For the local player: ensure playersMap always tracks localPlayerId for accurate room count,
        // while skipping redundant pending-write churn when localPlayerId is already registered.
        if (change.doc.id === localPlayerId && change.doc.metadata.hasPendingWrites) {
          const prevLocal = playersMap.get(localPlayerId);
          if (
            !prevLocal ||
            prevLocal.status !== data.status ||
            prevLocal.kills !== data.kills
          ) {
            playersMap.set(localPlayerId, stampIncomingPlayer(data));
            hasMeaningfulRemoteChange = true;
          }
          return;
        }

        const stamped = stampIncomingPlayer(data);
        playersMap.set(data.playerId, stamped);
        hasMeaningfulRemoteChange = true;

        if (data.playerId === localPlayerId) {
          onServerReconcileLocal?.(stamped);
        }

        // Check if local player received a hit via Firestore from a remote device
        if (
          data.playerId === localPlayerId &&
          data.lastHitSeq &&
          data.lastHitSeq > lastProcessedHitSeq &&
          data.lastHitByName
        ) {
          lastProcessedHitSeq = data.lastHitSeq;
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
      });
      if (hasMeaningfulRemoteChange) {
        emitPlayers();
      }
    },
    (err) => {
      console.warn('Firestore multiplayer room snapshot warning:', err);
    }
  );

  // Periodic stale & AFK player check every 3 seconds
  const pruneTimer = setInterval(emitPlayers, 3000);

  return () => {
    clearInterval(pruneTimer);
    unsubBus();
    unsubFirestore();
  };
}
