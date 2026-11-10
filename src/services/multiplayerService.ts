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

export const AFK_TIMEOUT_MS = 60_000; // 1 minute (60 seconds) without movement, actions, or solving questions

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
  lastPing: number;
  receivedAt?: number;
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
 * Predicts a remote player's current world-space position (X, Y, Z) and aiming angles
 * using sub-frame velocity + aim-rate extrapolation in the shared 1:1 arena coordinate frame.
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
  const packetAgeSec = Math.min(
    0.15,
    Math.max(0, (nowPerf - (rp.receivedAt || nowPerf)) / 1000)
  );
  // Apply velocity damping over prediction horizon so extrapolation never overshoots stops
  const horizonDamp = 1 - packetAgeSec * 1.8;
  const effAge = packetAgeSec * Math.max(0.35, horizonDamp);

  const worldX = rp.x + (rp.vx || 0) * effAge;
  const worldY = typeof rp.y === 'number' && Number.isFinite(rp.y) ? rp.y : 0;
  const worldZ = rp.z + (rp.vz || 0) * effAge;
  const aimX = Math.max(-1, Math.min(1, (rp.aimX || 0) + (rp.vAimX || 0) * effAge * 0.5));
  const aimY = Math.max(-1, Math.min(1, (rp.aimY || 0) + (rp.vAimY || 0) * effAge * 0.5));
  const yaw = (rp.yaw || 0) + (rp.vYaw || 0) * effAge * 0.6;

  return { worldX, worldY, worldZ, aimX, aimY, yaw };
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
  spawnCoords?: { x: number; z: number }
): Promise<{ roomCode: string; playerId: string; initialPlayer: LiveArenaPlayer }> {
  const roomCode = sanitizeRoomCode(rawRoomCode);
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
    lastPing: now,
  };

  getBus(roomCode).post({ type: 'PLAYER_STATE', player: initialPlayer });
  getBus(roomCode).post({ type: 'REQUEST_ROOM_SYNC', requesterId: playerId });

  // Perform cloud Firestore registration asynchronously so local spawn is instantaneous with zero teleportation
  void (async () => {
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
    } catch {
      // Fallback to local BroadcastChannel bus silently if offline
    }
  })();

  return { roomCode, playerId, initialPlayer };
}

const FIRESTORE_MIN_SYNC_INTERVAL_MS = 240;
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
    Math.abs(next.x - prev.x) >= 0.03 ||
    Math.abs(next.z - prev.z) >= 0.03 ||
    Math.abs(next.y - prev.y) >= 0.03 ||
    Math.abs((next.vx || 0) - (prev.vx || 0)) >= 0.15 ||
    Math.abs((next.vz || 0) - (prev.vz || 0)) >= 0.15 ||
    Math.abs(next.aimX - prev.aimX) >= 0.03 ||
    Math.abs(next.aimY - prev.aimY) >= 0.03 ||
    Math.abs((next.yaw || 0) - (prev.yaw || 0)) >= 0.03
  ) {
    return true;
  }
  // Periodic heartbeat every 3.5s when completely idle
  return now - lastFirestoreSyncAt >= 3500;
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
    state.kills !== lastSyncedState.kills;

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
      }, Math.max(25, FIRESTORE_MIN_SYNC_INTERVAL_MS - elapsed));
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
  const updated: LiveArenaPlayer = {
    ...playerState,
    lastPing: now,
  };

  // Immediate 0ms broadcast to local tabs
  getBus(roomCode).post({ type: 'PLAYER_STATE', player: updated });

  // Non-blocking cloud sync throttled to 240ms to keep main UI thread 100% stutter-free
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
  onRemoteAfkKicked?: (playerId: string, studentName: string) => void
): () => void {
  const roomCode = sanitizeRoomCode(rawRoomCode);
  const playersMap = new Map<string, LiveArenaPlayer>();
  let lastProcessedHitSeq = 0;

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

    return {
      ...incoming,
      vx,
      vz,
      vAimX,
      vAimY,
      vYaw,
      lastActivityAt,
      lastPing: isValidEpochTimestamp(incoming.lastPing) ? incoming.lastPing : nowEpoch,
      receivedAt: nowPerf,
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

    activeList.sort((a, b) => b.kills - a.kills || b.score - a.score);
    onUpdate(activeList);
  };

  // 1. Subscribe to instant BroadcastChannel messages
  const bus = getBus(roomCode);
  const unsubBus = bus.subscribe((msg) => {
    if (msg.type === 'PLAYER_STATE' && msg.player) {
      const incoming = msg.player as LiveArenaPlayer;
      const p = stampIncomingPlayer(incoming);
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
        // Skip local pending writes so local setDoc() never triggers main-thread snapshot churn
        if (change.doc.id === localPlayerId && change.doc.metadata.hasPendingWrites) {
          return;
        }
        const data = change.doc.data() as LiveArenaPlayer;
        if (change.type === 'removed') {
          playersMap.delete(change.doc.id);
          hasMeaningfulRemoteChange = true;
        } else if (data && data.playerId) {
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
