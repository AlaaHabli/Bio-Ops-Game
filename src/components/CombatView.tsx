import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { LevelConfig, Weapon, HitMarkerInfo, KillfeedEntry, BiologyConceptCard } from '../types/game';
import { sounds } from '../services/soundEffects';
import { voipManager, OrganVoipClip } from '../services/voipManager';
import { ORGAN_THEMES, OrganTheme, getOrganThemeForLevel } from '../services/organThemes';
import { loadSeenConcepts, markConceptAsSeen, loadStudentProfile, recordScoreToLeaderboard } from '../services/storage';
import { WeaponBlockyIcon } from './WeaponBlockyIcon';
import {
  createStreptococcusSoldier,
  createBacillusSoldier,
  createBacteriaTank,
  createPanickingRbc,
  createLeukocyteFPSArms,
  createFortniteWeaponModel,
  createGrenadeModel,
  createSandbagBarricade,
  createEnemyBulletMesh,
  createPlayerBulletTracerMesh,
  setPlayerBulletTracerColor,
  createBossRocketMesh,
  createTacticalAirdropPlane,
  createAlliedWBCCommando,
  createBacteriaHelicopter,
  createBioMechRobot,
  createF16FighterJet,
  createPlateletModel,
  createHeroicAntibodyModel,
  createHeroicMacrophageModel,
  createHeroicDendriticCellModel,
  createPanickingGobletCell,
  createPanickingDigestiveCell,
  createPanickingNeuroneCell,
  createBleriotPlane,
  createMortarBombMesh,
  createOrganEnvironmentProps,
  createMultiplayerStudentOperator,
  updateStudentOperatorBadge,
  updateStudentOperatorAppearance,
  createOpenLungAlveoliLandscape,
  createAnatomicalCoverCluster,
  getArenaSurfaceElevation,
  createBiologicalPowerUpMesh,
  createSupplyTransportHelicopter,
  createSupplyPingBeaconMesh,
  createSupplyCargoNetMesh,
  createAnatomicalLadder,
  disposeSceneGraph,
} from './CellModels';
import {
  joinDeathmatchRoom,
  syncLocalPlayerState,
  sendPlayerHitEvent,
  subscribeToDeathmatchRoom,
  leaveDeathmatchRoom,
  kickAfkPlayerFromRoom,
  getOrCreateMultiplayerPlayerId,
  getOrCreateMultiplayerAvatar,
  resolvePlayerAvatarType,
  getInitialArenaSpawn,
  getBaseRoomPrefix,
  formatIndexedRoomCode,
  AFK_TIMEOUT_MS,
  MAX_PLAYERS_PER_ROOM,
  MATCH_KILL_LIMIT,
  MATCH_DURATION_SECONDS,
  getAvatarDisplayInfo,
  ClientPredictionEngine,
  predictRemoteEntityState,
  LiveArenaPlayer,
  ArenaKillfeedEvent,
  MultiplayerPlayerStatus,
  MultiplayerAvatarType,
} from '../services/multiplayerService';
import { INITIAL_WEAPONS, CURRICULUM_LEVELS, BIOLOGY_CONCEPT_CARDS } from '../data/curriculumData';
import { RankBadge } from './RankBadge';
import {
  Shield,
  Zap,
  Tv,
  RotateCcw,
  Crosshair,
  ChevronRight,
  Bomb,
  Plane,
  Eye,
  Compass,
  Target,
  Skull,
  Flame,
  Volume2,
  VolumeX,
  BookOpen,
  AlertTriangle,
  Pause,
  Play,
  Home,
  Repeat,
  Heart,
  Users,
  Snowflake,
  CheckCircle2,
  XCircle,
  Radio,
  Trophy,
  Award,
  Medal,
} from 'lucide-react';

interface CombatViewProps {
  level: LevelConfig;
  phaseNumber: number; // 1, 2, or 3
  activeWeapon: Weapon;
  soundEnabled: boolean;
  autoAimEnabled?: boolean;
  playerXp: number;
  onPhaseComplete: (scoreEarned: number, killsEarned: number) => void;
  onPhaseDefeat: (scoreEarned?: number, killsEarned?: number) => void;
  onToggleSound?: () => void;
  onToggleAutoAim?: () => void;
  onExitToMenu?: () => void;
  onSelectWeapon?: (weapon: Weapon) => void;
  availableWeapons?: Weapon[];
  isMultiplayerDeathmatch?: boolean;
  multiplayerRoomCode?: string;
  startWithReviveQuiz?: boolean;
}

interface ActiveSoldier {
  id: number;
  type: 'strep' | 'bacillus' | 'boss' | 'tank' | 'helicopter' | 'robot' | 'jet';
  name: string;
  mesh: THREE.Group;
  nucleusMesh?: THREE.Mesh;
  leftLeg?: THREE.Group;
  rightLeg?: THREE.Group;
  leftArm?: THREE.Group;
  rightArm?: THREE.Group;
  turret?: THREE.Group;
  cannon?: THREE.Mesh;
  mainRotor?: THREE.Group;
  tailRotor?: THREE.Group;
  gatling?: THREE.Group;
  coreMesh?: THREE.Mesh;
  afterburnerMesh?: THREE.Mesh;
  hitsLeft: number;
  maxHits: number;
  hp: number;
  maxHp: number;
  speed: number;
  value: number;
  isBoss: boolean;
  isTank: boolean;
  isHelicopter?: boolean;
  isRobot?: boolean;
  isJet?: boolean;
  walkOffset: number;
  lastShootTime: number;
  lastRocketTime?: number;
  hpBarFill?: THREE.Mesh;
  // Tactical Walk -> Reach Firing Line Before Barricade -> Crouch -> Aim & Scope -> Shoot state machine
  stanceState?: 'advancing' | 'crouching' | 'aiming' | 'shooting' | 'firing';
  stanceTimer?: number;
  firingLineZ?: number;
  scopeGlint?: THREE.Mesh;
  cannonRecoil?: number;
  hullRock?: number;
  // Boss evasive dodging state
  dodgeOffsetX?: number;
  dodgeOffsetY?: number;
  dodgeTargetX?: number;
  dodgeTargetY?: number;
  nextDodgeTime?: number;
  // Enemy Airdrop Parachute state
  parachuteGroup?: THREE.Group;
  isParachuting?: boolean;
  landingY?: number;
  // Enhanced Tactical AI state (Flanking, Evasive Juke & Heavy Burst Fire)
  flankTargetX?: number;
  evadeCooldown?: number;
  burstShotsRemaining?: number;
  nextBurstTime?: number;
  // Low-HP Fire & Structural Distress Tracking
  lastDamageFireTime?: number;
  lowHpShatterTriggered?: boolean;
  // Multiplayer Student Operator Fields
  isStudentOperator?: boolean;
  remotePlayerId?: string;
  studentClassName?: string;
  avatarType?: string;
  equippedWeaponId?: string;
  isStunned?: boolean;
  stasisCage?: THREE.Group;
  callsignCanvas?: HTMLCanvasElement;
  callsignTexture?: THREE.CanvasTexture;
  stunTimer?: number;
  lastLocalDamagedAt?: number;
  localEliminatedUntil?: number;
  retreatElapsed?: number;
}

interface ActiveEnemyAirdrop {
  group: THREE.Group;
  propellers: THREE.Mesh[];
  speed: number;
  dropped: boolean;
  dropX: number;
}

interface ActiveBarricadeRefugee {
  mesh: THREE.Group;
  lArm?: THREE.Object3D;
  rArm?: THREE.Object3D;
  lLeg?: THREE.Object3D;
  rLeg?: THREE.Object3D;
  isPlatelet: boolean;
  barricadeIndex: number;
  targetX: number;
  targetZ: number;
  exitX: number;
  exitZ: number;
  state: 'entering' | 'hiding' | 'leaving';
  hideTimer: number;
  speed: number;
  trembleSeed: number;
  hasCried: boolean;
}

interface ActivePlayerTracer {
  mesh: THREE.Group;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface ActiveBossRocket {
  id: number;
  mesh: THREE.Group;
  flame: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  life: number;
}

interface ActiveAirdrop {
  plane: { group: THREE.Group; propellers: THREE.Mesh[] } | null;
  planeSpeed: number;
  alliesDropped: boolean;
  allies: Array<{
    group: THREE.Group;
    parachuteGroup: THREE.Group;
    headGroup: THREE.Group;
    nucleusGroup: THREE.Group;
    assistBadge: THREE.Mesh;
    leftArm: THREE.Group;
    rightArm: THREE.Group;
    leftLeg: THREE.Group;
    rightLeg: THREE.Group;
    leftRifle: THREE.Mesh;
    rightRifle: THREE.Mesh;
    landed: boolean;
    targetY: number;
    x: number;
    z: number;
    lastFireTime: number;
    landedElapsed?: number;
    recoilTimer?: number;
    hasCalledAssist?: boolean;
    dodgeTimer?: number;
    isDodging?: boolean;
    dodgeDirection?: number;
    rollProgress?: number;
  }>;
  activeTimer: number;
}

interface ActiveBleriotRun {
  group: THREE.Group;
  propeller: THREE.Group;
  targetBarricadeIndex: number;
  speed: number;
  bombDropped: boolean;
}

interface ActiveMortarBomb {
  mesh: THREE.Group;
  vx: number;
  vy: number;
  vz: number;
  targetBarricadeIndex: number;
}

interface ActiveEnemyBullet {
  id: number;
  mesh: THREE.Group;
  vx: number;
  vy: number;
  vz: number;
  isTank: boolean;
  damage: number;
  life: number;
}

interface ActiveBarricade {
  group: THREE.Group;
  hpBarFill: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  respawnTimer: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
}

interface ActiveShellCasing {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rotVx: number;
  rotVy: number;
  rotVz: number;
  life: number;
}

interface TargetHudLock {
  id: number;
  name: string;
  dist: number;
  x: number;
  y: number;
  isTank: boolean;
  hpPercent: number;
}

interface ActiveGrenade {
  mesh: THREE.Group;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface ActiveExplosionParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  rotVx?: number;
  rotVy?: number;
  rotVz?: number;
  hasGravity?: boolean;
}

interface DirectionalDamageIndicator {
  id: number;
  angleDeg: number; // 0 = front/top, -45 = front-left, +45 = front-right
  sector: 'left' | 'center' | 'right';
  sourceType: 'MORTAR SPLASH' | 'BOSS MISSILE' | 'TANK SHELL' | 'BALLISTIC HIT' | 'ORGAN HAZARD';
  intensity: number; // 0.35 .. 1.0 (scales up as player HP lowers!)
  isSplash: boolean;
}

interface ActiveOrganHazard {
  group: THREE.Group;
  plumes: THREE.Mesh[];
  warningRing: THREE.Mesh;
  laneIndex: number; // 0 = Left (-2.4), 1 = Center (0), 2 = Right (+2.4)
  laneX: number;
  warningTimer: number; // 2.0s warning before eruption
  activeTimer: number; // 4.5s active hazard duration
  lastDamageTime: number;
  themeId: OrganTheme['id'];
}

// Reusable scratch vectors to eliminate per-frame garbage collection spikes in animate() & executeShot()
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();

/**
 * 2D Spatial Partitioning Hash Grid for high-performance collision culling in the X-Z arena plane.
 * Replaces O(N*M) nested collision checks with localized O(1) grid cell lookups, eliminating
 * frame spikes, micro-stutters, and collision tunneling across solo & multiplayer combat.
 */
export class SpatialPartitionGrid<T> {
  private cellSize: number;
  private cells: Map<number, T[]> = new Map();

  constructor(cellSize: number = 4.0) {
    this.cellSize = cellSize;
  }

  public clear(): void {
    this.cells.clear();
  }

  private hashCoords(cx: number, cz: number): number {
    return (cx * 73856093) ^ (cz * 19349663);
  }

  public insert(x: number, z: number, item: T, radius: number = 0): void {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCz = Math.floor((z - radius) / this.cellSize);
    const maxCz = Math.floor((z + radius) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = this.hashCoords(cx, cz);
        let cell = this.cells.get(key);
        if (!cell) {
          cell = [];
          this.cells.set(key, cell);
        }
        cell.push(item);
      }
    }
  }

  public query(x: number, z: number, radius: number): T[] {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCz = Math.floor((z - radius) / this.cellSize);
    const maxCz = Math.floor((z + radius) / this.cellSize);

    const results: T[] = [];
    const seen = new Set<T>();

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = this.hashCoords(cx, cz);
        const cell = this.cells.get(key);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            const item = cell[i];
            if (!seen.has(item)) {
              seen.add(item);
              results.push(item);
            }
          }
        }
      }
    }
    return results;
  }
}

export const FIXED_DELTA_TIME = 1 / 60; // 0.0166667s (60Hz fixed physics step)
export const MAX_PHYSICS_SUBSTEPS = 4;

// Solid wall & cover collision detection for multiplayer buildings (Bunker at (0, -22), Tower at (14, -11), West Ridge at (-19, -11), and Cover Clusters)
export function applySolidWallCollisions(
  prevPos: { x: number; z: number },
  nextPos: { x: number; z: number },
  currentElevY: number,
  isRooftop: boolean,
  isInside: boolean,
  barricades?: Array<{ x: number; z: number; hp: number }>,
  spatialGrid?: SpatialPartitionGrid<{ x: number; z: number; hp: number }>
): { x: number; z: number; isRooftop: boolean; isInside: boolean; elevationY: number } {
  const ROOF_ELEV = 6.70;
  let x = nextPos.x;
  let z = nextPos.z;

  const surf = getArenaSurfaceElevation(x, z, isRooftop ? ROOF_ELEV : currentElevY);
  let elevationY = surf.elevationY;
  let insideBuilding = surf.isInsideBuilding;
  let rooftop = surf.isRooftop;

  // 1. Central Bunker (Centered at X=0, Z=-22, width=18.0, depth=10.0 -> X in [-9.0, 9.0], Z in [-27.0, -17.0])
  const inBunkerArea = x >= -9.6 && x <= 9.6 && z >= -29.4 && z <= -14.6;

  if (inBunkerArea) {
    if (isRooftop) {
      // Check if player deliberately stepped into the central-south descent slot of the wide roof hatch (X in [-6.8, -4.4], Z in [-23.8, -21.8])
      const inRoofDescentSlot = x >= -6.8 && x <= -4.4 && z >= -23.8 && z <= -21.8;
      if (inRoofDescentSlot) {
        rooftop = false;
        insideBuilding = true;
        elevationY = 0.55;
        z = -21.3; // Place player cleanly inside the ground floor room at the foot of the internal ladder
        return { x, z, isRooftop: false, isInside: true, elevationY };
      }

      // Keep player standing solidly ON THE ROOF (elevationY = 6.70) inside the rooftop parapet walls
      rooftop = true;
      insideBuilding = false;
      elevationY = ROOF_ELEV;
      if (x < -8.55) x = -8.55;
      if (x > 8.55) x = 8.55;
      if (z < -26.55) z = -26.55;
      if (z > -17.45) z = -17.45;
      return { x, z, isRooftop: true, isInside: false, elevationY };
    }

    // Check if player inside the room is on the wide internal sloped ladder-staircase (X in [-7.6, -3.6], Z in [-25.8, -21.2])
    const onInternalLadder = isInside && x >= -7.6 && x <= -3.6 && z >= -25.8 && z <= -21.2;
    if (onInternalLadder) {
      // Keep player within the solid side rails of the wide internal ladder while climbing
      if (x < -7.45) x = -7.45;
      if (x > -3.75) x = -3.75;

      const climbT = THREE.MathUtils.clamp((-21.6 - z) / 3.8, 0, 1);
      const climbElev = 0.55 + climbT * (ROOF_ELEV - 0.55);

      if (climbT >= 0.84 || z <= -24.8) {
        // Reached the top of the wide roof opening! Step cleanly onto the solid roof deck so holding W never drops back down
        rooftop = true;
        insideBuilding = false;
        elevationY = ROOF_ELEV;
        x = Math.max(-3.1, x); // Nudge onto the solid East roof deck clear of the hatch opening
        z = Math.max(-25.8, Math.min(-24.2, z));
        return { x, z, isRooftop: true, isInside: false, elevationY };
      }

      return { x, z, isRooftop: false, isInside: true, elevationY: climbElev };
    }

    // Doorway & Entrance Staircase corridors (South stairs: Z in [-17.55, -14.6], North stairs: Z in [-29.4, -26.45], |X| <= 1.90)
    const inSouthStairDoor = Math.abs(x) <= 1.90 && z >= -17.55 && z <= -14.6;
    const inNorthStairDoor = Math.abs(x) <= 1.90 && z >= -29.4 && z <= -26.45;

    if (inSouthStairDoor || inNorthStairDoor) {
      const enteredRoom = z >= -26.6 && z <= -17.4;
      insideBuilding = enteredRoom;
      rooftop = false;
      elevationY = getArenaSurfaceElevation(x, z, 0.55).elevationY;
      return { x, z, isRooftop: false, isInside: insideBuilding, elevationY };
    }

    if (isInside) {
      // Inside Ground Floor Room: Solid East, West, North, and South walls (windows allow shooting out, not walking through!)
      insideBuilding = true;
      rooftop = false;
      elevationY = 0.55;

      if (x < -8.45) x = -8.45;
      if (x > 8.45) x = 8.45;
      if (z > -17.45 && Math.abs(x) > 1.85) z = -17.45;
      if (z < -26.55 && Math.abs(x) > 1.85) z = -26.55;

      return { x, z, isRooftop: false, isInside: true, elevationY };
    } else {
      // Outside the building: Solid exterior walls prevent ghosting through walls from outside!
      insideBuilding = false;
      rooftop = false;
      if (x > -9.45 && x < 9.45 && z > -27.45 && z < -16.55) {
        if (prevPos.z >= -16.55 && Math.abs(x) > 1.85) {
          z = -16.52;
        } else if (prevPos.z <= -27.45 && Math.abs(x) > 1.85) {
          z = -27.48;
        } else if (prevPos.x <= -9.0) {
          x = -9.48;
        } else if (prevPos.x >= 9.0) {
          x = 9.48;
        } else {
          z = prevPos.z >= -22.0 ? -16.52 : -27.48;
        }
      }
      elevationY = getArenaSurfaceElevation(x, z, 0).elevationY;
      return { x, z, isRooftop: false, isInside: false, elevationY };
    }
  }

  // 2. Standalone Watchtower (Centered at X=14.0, Z=-11.0, size 4.6m x 4.6m -> X in [11.7, 16.3], Z in [-13.3, -8.7])
  const inTowerBounds = x >= 11.4 && x <= 16.6 && z >= -13.6 && z <= -8.0;
  if (inTowerBounds) {
    if (rooftop || surf.elevationY >= 2.2) {
      elevationY = surf.elevationY;
      if (x < 11.85) x = 11.85;
      if (x > 16.15) x = 16.15;
      if (z < -13.15) z = -13.15;
      if (z > -8.85 && Math.abs(x - 14.0) > 1.15) z = -8.85;
      return { x, z, isRooftop: surf.elevationY >= 4.5, isInside: false, elevationY };
    } else {
      const distTower = Math.hypot(x - 14.0, z - (-11.0));
      if (distTower < 2.65 && (z < -9.1 || Math.abs(x - 14.0) > 1.15)) {
        const angle = Math.atan2(z - (-11.0), x - 14.0);
        x = 14.0 + Math.cos(angle) * 2.75;
        z = -11.0 + Math.sin(angle) * 2.75;
      }
    }
  }

  // 3. Solid collision against intact 3D Anatomical Cover Clusters on the ground floor (O(1) Spatial Partitioning)
  if (barricades && elevationY < 1.2) {
    const candidates = spatialGrid ? spatialGrid.query(x, z, 3.2) : barricades;
    for (let i = 0; i < candidates.length; i++) {
      const b = candidates[i];
      if (b.hp <= 0) continue;
      const dx = x - b.x;
      const dz = z - b.z;
      // Cover clusters are ~2.8m wide (X) by ~1.3m deep (Z)
      if (Math.abs(dx) < 1.55 && Math.abs(dz) < 0.85) {
        if (Math.abs(prevPos.z - b.z) >= 0.80) {
          z = b.z + (prevPos.z >= b.z ? 0.86 : -0.86);
        } else {
          x = b.x + (prevPos.x >= b.x ? 1.56 : -1.56);
        }
      }
    }
  }

  return { x, z, isRooftop: rooftop, isInside: insideBuilding, elevationY };
}

export const CombatView: React.FC<CombatViewProps> = ({
  level,
  phaseNumber,
  activeWeapon: initialWeapon,
  soundEnabled,
  autoAimEnabled = true,
  playerXp,
  onPhaseComplete,
  onPhaseDefeat,
  onToggleSound,
  onToggleAutoAim,
  onExitToMenu,
  onSelectWeapon,
  availableWeapons = INITIAL_WEAPONS,
  isMultiplayerDeathmatch = false,
  multiplayerRoomCode = 'BIO-FFA',
  startWithReviveQuiz = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Pause State & Ref
  const [isGamePaused, setIsGamePaused] = useState<boolean>(false);
  const isGamePausedRef = useRef<boolean>(false);
  isGamePausedRef.current = isGamePaused;

  // ============================================================================
  // MULTIPLAYER OPEN-WORLD DEATHMATCH STATE & REFS
  // (1-Minute Active Combat Window -> Die = 3-Q Revive | Survive 1m = Frozen/Stunned 3-Q Unfreeze!)
  // ============================================================================
  const [mpStatus, setMpStatus] = useState<MultiplayerPlayerStatus>(() =>
    isMultiplayerDeathmatch && startWithReviveQuiz ? 'reviving' : 'active'
  );
  const mpStatusRef = useRef<MultiplayerPlayerStatus>(
    isMultiplayerDeathmatch && startWithReviveQuiz ? 'reviving' : 'active'
  );
  mpStatusRef.current = mpStatus;

  const [mpQuizReason, setMpQuizReason] = useState<'deploy' | 'revive' | 'stun'>(() =>
    startWithReviveQuiz ? 'deploy' : 'revive'
  );
  const [mpKilledByInfo, setMpKilledByInfo] = useState<{ killerName: string; weaponName: string } | null>(null);
  const [mpCorrectCount, setMpCorrectCount] = useState<number>(0);
  const [mpQuestionIdx, setMpQuestionIdx] = useState<number>(() =>
    Math.floor(Math.random() * Math.max(1, level.questions.length))
  );
  const [mpSelectedOpt, setMpSelectedOpt] = useState<number | null>(null);
  const [mpFeedback, setMpFeedback] = useState<{ isCorrect: boolean; explanation: string } | null>(null);
  const [mpDeaths, setMpDeaths] = useState<number>(0);
  const mpDeathsRef = useRef<number>(0);
  const [mpOnlinePlayers, setMpOnlinePlayers] = useState<LiveArenaPlayer[]>([]);
  const mpOnlinePlayersRef = useRef<LiveArenaPlayer[]>([]);
  const [mpKillfeed, setMpKillfeed] = useState<ArenaKillfeedEvent[]>([]);
  const pushKillfeedEntryRef = useRef<((entry: ArenaKillfeedEvent) => void) | null>(null);
  const pushKillfeedEntry = (entry: ArenaKillfeedEvent) => {
    const cleanKiller = (entry.killerName || 'Operative').trim();
    const cleanVictim = (entry.victimName || 'Enemy').trim();
    const normKiller = cleanKiller.toUpperCase();
    const normVictim = cleanVictim.toUpperCase();
    const nowTs = entry.timestamp || Date.now();
    setMpKillfeed((prev) => {
      const isDuplicate = prev.some(
        (existing) =>
          existing.id === entry.id ||
          (existing.killerName.trim().toUpperCase() === normKiller &&
            existing.victimName.trim().toUpperCase() === normVictim &&
            Math.abs(nowTs - existing.timestamp) < 2400)
      );
      if (isDuplicate) return prev;
      return [
        {
          ...entry,
          killerName: cleanKiller,
          victimName: cleanVictim,
          timestamp: nowTs,
        },
        ...prev.slice(0, 4),
      ];
    });
  };
  pushKillfeedEntryRef.current = pushKillfeedEntry;

  const [activeRoomCode, setActiveRoomCode] = useState<string>(() =>
    formatIndexedRoomCode(getBaseRoomPrefix(multiplayerRoomCode), 1)
  );
  const activeRoomCodeRef = useRef<string>(
    formatIndexedRoomCode(getBaseRoomPrefix(multiplayerRoomCode), 1)
  );

  const localMpPlayerIdRef = useRef<string>(getOrCreateMultiplayerPlayerId());
  const localMpAvatarRef = useRef<MultiplayerAvatarType>(
    getOrCreateMultiplayerAvatar(localMpPlayerIdRef.current)
  );
  const localShotSeqRef = useRef<number>(0);
  const localGrenadeSeqRef = useRef<number>(0);
  const shotsFiredRef = useRef<number>(0);
  const shotsHitRef = useRef<number>(0);
  const getLocalAccuracyPct = () =>
    shotsFiredRef.current > 0
      ? Math.min(100, Math.round((shotsHitRef.current / shotsFiredRef.current) * 100))
      : 0;

  // Multiplayer 5-Minute Match Countdown Timer & 10-Kill Victory Podium State
  const [mpMatchTimeLeft, setMpMatchTimeLeft] = useState<number>(MATCH_DURATION_SECONDS);
  const mpMatchTimeLeftRef = useRef<number>(MATCH_DURATION_SECONDS);
  const [mpMatchEnded, setMpMatchEnded] = useState<boolean>(false);
  const mpMatchEndedRef = useRef<boolean>(false);
  const [mpMatchEndReason, setMpMatchEndReason] = useState<'kill_limit' | 'time_limit'>('kill_limit');
  const triggerMultiplayerMatchEndRef = useRef<((reason: 'kill_limit' | 'time_limit') => void) | null>(null);

  const playerWorldVelRef = useRef<{ vx: number; vz: number }>({ vx: 0, vz: 0 });
  const pushLocalMpStateNowRef = useRef<(() => void) | null>(null);
  const predictionEngineRef = useRef<ClientPredictionEngine>(new ClientPredictionEngine());
  const lastPlayerActivityRef = useRef<number>(Date.now());
  const afkKickedRef = useRef<boolean>(false);
  const [afkKickedModal, setAfkKickedModal] = useState<boolean>(false);
  const [afkWarningSecondsLeft, setAfkWarningSecondsLeft] = useState<number | null>(null);
  const remoteShotSeqProcessedRef = useRef<Record<string, number>>({});
  const prevMpPlayersKeyRef = useRef<string>('');
  const triggerMpEliminatedStateRef = useRef<((killerName?: string, weaponName?: string) => void) | null>(null);
  const triggerMpStunFreezeStateRef = useRef<(() => void) | null>(null);

  // Multiplayer Crouch [Ctrl] & Sprint [Shift] with Refillable ATP Energy Bar (Must refill to 100% when depleted!)
  const [isCrouching, setIsCrouching] = useState<boolean>(false);
  const isCrouchingRef = useRef<boolean>(false);
  const crouchToggleRef = useRef<boolean>(false);
  const crouchCameraYRef = useRef<number>(0);

  const [isSprinting, setIsSprinting] = useState<boolean>(false);
  const isSprintingRef = useRef<boolean>(false);
  const sprintToggleRef = useRef<boolean>(false);
  const [isSprintExhausted, setIsSprintExhausted] = useState<boolean>(false);
  const isSprintExhaustedRef = useRef<boolean>(false);
  const sprintEnergyRef = useRef<number>(100);
  const sprintBarFillDomRef = useRef<HTMLDivElement | null>(null);
  const sprintBarTextDomRef = useRef<HTMLSpanElement | null>(null);

  // Multiplayer High Ground, Climbable Ramps & Walk-Through Building Physics
  const playerElevationYRef = useRef<number>(0);
  const playerIsRooftopRef = useRef<boolean>(false);
  const playerIsInsideBuildingRef = useRef<boolean>(false);

  // 360-Degree Controlled Camera Rotation & Aiming (Smoothly follows mouse/touch without dizzying auto-spin)
  const initialMpSpawn = isMultiplayerDeathmatch
    ? getInitialArenaSpawn(localMpPlayerIdRef.current)
    : { x: 0, z: 0 };
  const initialMpYaw = isMultiplayerDeathmatch
    ? Math.atan2(-initialMpSpawn.x, -(-7.2 - initialMpSpawn.z))
    : 0;
  const cameraBaseYawOffsetRef = useRef<number>(initialMpYaw);
  const hasLockedOpponentYawRef = useRef<boolean>(false);
  const cameraYawRef = useRef<number>(initialMpYaw);
  const cameraPitchRef = useRef<number>(0);
  const targetCameraYawRef = useRef<number>(initialMpYaw);
  const targetCameraPitchRef = useRef<number>(0);
  const onExitToMenuRef = useRef(onExitToMenu);
  onExitToMenuRef.current = onExitToMenu;

  // Helicopter Supply Drop & Super Ability System State
  // Drop interval: Every 15 seconds into death ground randomly
  // Abilities: Burning Bullets (15s), Supersonic Speed (15s), Immortality (10s), Double XP (30s), Postpone Question (+15s), T-Cytotoxic Laser (10s), Biotoxic RPG (10s)
  const [activeSuperAbilities, setActiveSuperAbilities] = useState<Record<string, number>>({});
  const superAbilitiesRef = useRef<Record<string, number>>({});

  const supplyDropStateRef = useRef<{
    phase: 'idle' | 'pinging' | 'chopper_inbound' | 'dropping' | 'active_crate';
    nextDropTime: number;
    pingStartTime: number;
    targetX: number;
    targetZ: number;
    abilityType?: string;
    abilityLabel?: string;
    beaconMesh?: THREE.Group;
    chopperMesh?: THREE.Group;
    chopperRotor?: THREE.Group;
    chopperTailRotor?: THREE.Group;
    chopperSlungNet?: THREE.Group;
    chopperActive?: boolean;
    chopperStartX?: number;
    chopperStartZ?: number;
    chopperEndX?: number;
    chopperEndZ?: number;
    cargoNetMesh?: THREE.Group;
    crateMesh?: THREE.Group;
    dropY: number;
    dropVy: number;
    lastPingSec?: number;
  }>({
    phase: 'idle',
    nextDropTime: performance.now() + 5000,
    pingStartTime: 0,
    targetX: 0,
    targetZ: -18,
    dropY: 10.5,
    dropVy: 0,
    lastPingSec: -1,
  });

  const [supplyDropPingAlert, setSupplyDropPingAlert] = useState<{
    x: number;
    z: number;
    dist: number;
    secondsLeft: number;
    abilityName: string;
  } | null>(null);

  // Performance-critical direct DOM references (zero React VDOM re-render churn!)
  const liveScoreDomRef = useRef<HTMLSpanElement | null>(null);
  const liveTimerDomRef = useRef<HTMLSpanElement | null>(null);
  const soloWaveTimerDomRef = useRef<HTMLSpanElement | null>(null);
  const mpMatchTimerDomRef = useRef<HTMLSpanElement | null>(null);
  const cachedStudentProfileRef = useRef(loadStudentProfile());

  // Teacher / Spectator Classroom Broadcast Mode
  const [showSpectatorBoard, setShowSpectatorBoard] = useState<boolean>(false);

  // Biological Power-Up Pickup Toast
  const [powerUpToast, setPowerUpToast] = useState<{ text: string; icon: string; color: string } | null>(null);
  const powerUpToastTimerRef = useRef<number | null>(null);

  // Stage-relative level number (1 to 5) so adding new grades/missions never inflates difficulty
  const stageLevels = CURRICULUM_LEVELS.filter((l) => l.stage === level.stage && !l.isSecret);
  const stageIdx = stageLevels.findIndex((l) => l.id === level.id);
  const levelNumber = Math.max(1, Math.min(5, (stageIdx !== -1 ? stageIdx : 0) + 1));

  // Dynamic Organ Theme mapped from the curriculum level & phase (Multiplayer uses the Open Lung & Alveoli Landscape!)
  const [organTheme, setOrganTheme] = useState<OrganTheme>(() =>
    isMultiplayerDeathmatch
      ? ORGAN_THEMES.find((t) => t.id === 'alveoli') || getOrganThemeForLevel(level.id, phaseNumber)
      : getOrganThemeForLevel(level.id, phaseNumber)
  );
  const organThemeRef = useRef<OrganTheme>(organTheme);

  // HUD State
  const [currentWeapon, setCurrentWeapon] = useState<Weapon>(initialWeapon);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [playerHp, setPlayerHp] = useState<number>(100);
  const [currentAmmo, setCurrentAmmo] = useState<number>(initialWeapon.magSize);
  const [reserveAmmo, setReserveAmmo] = useState<number>(initialWeapon.totalReserve);
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [kills, setKills] = useState<number>(0);
  const [hitmarkers, setHitmarkers] = useState<HitMarkerInfo[]>([]);
  const [, setKillfeed] = useState<KillfeedEntry[]>([]);
  const [stimCooldown, setStimCooldown] = useState<number>(0);
  const [grenadeCooldown, setGrenadeCooldown] = useState<number>(0);
  const [reinforceCooldown, setReinforceCooldown] = useState<number>(0);
  const [isAirdropActive, setIsAirdropActive] = useState<boolean>(false);
  const stimCooldownRef = useRef<number>(0);
  const grenadeCooldownRef = useRef<number>(0);
  const reinforceCooldownRef = useRef<number>(0);
  const isAirdropActiveRef = useRef<boolean>(false);
  const phaseCompleteCalledRef = useRef<boolean>(false);
  const handleStimpackRef = useRef<(() => void) | null>(null);
  const handleThrowGrenadeRef = useRef<(() => void) | null>(null);
  const handleAirdropReinforcementsRef = useRef<(() => void) | null>(null);
  const handleSwapWeaponRef = useRef<(() => void) | null>(null);
  const handleSelectWeaponRef = useRef<((w: Weapon) => void) | null>(null);
  const [isPlayerInCover, setIsPlayerInCover] = useState<boolean>(false);
  const [activeCoverHp, setActiveCoverHp] = useState<number>(100);
  const [bleriotAlert, setBleriotAlert] = useState<string | null>(null);
  const [enemyAirdropAlert, setEnemyAirdropAlert] = useState<string | null>(null);
  const [hazardAlert, setHazardAlert] = useState<string | null>(null);
  const [bossDefeatedBanner, setBossDefeatedBanner] = useState<boolean>(false);
  const [isPhase3Retreating, setIsPhase3Retreating] = useState<boolean>(false);
  const isPhase3RetreatingRef = useRef<boolean>(false);
  const [retreatDialogueStep, setRetreatDialogueStep] = useState<number>(0);
  const ensureRetreatStragglersRef = useRef<(() => void) | null>(null);

  // First-Time Biology Concept Popup & Automatic Game Pause State (Max 1 popup per phase, shows once ever per concept!)
  const [activeConceptCard, setActiveConceptCard] = useState<BiologyConceptCard | null>(null);
  const isPausedForConceptRef = useRef<boolean>(false);
  const renderedPausedFrameRef = useRef<boolean>(false);
  const hasShownConceptThisPhaseRef = useRef<boolean>(false);
  const combatStartTimeRef = useRef<number>(performance.now());
  const seenConceptsRef = useRef<Set<string>>(loadSeenConcepts());
  const pendingConceptsQueueRef = useRef<string[]>([]);
  const lastConceptDismissTimeRef = useRef<number>(0);
  const triggerBiologyConceptRef = useRef<((conceptId: string) => void) | null>(null);
  const handleDismissConceptCardRef = useRef<(() => void) | null>(null);

  const triggerBiologyConcept = (conceptId: string) => {
    if (isMultiplayerDeathmatch) return; // Never interrupt simultaneous online PvP deathmatch with solo concept popups!
    // Never show more than 1 concept popup per phase so the student is never spammed!
    if (hasShownConceptThisPhaseRef.current || seenConceptsRef.current.has(conceptId)) return;
    const card = BIOLOGY_CONCEPT_CARDS[conceptId];
    if (!card) return;

    const now = performance.now();
    // Never pause synchronously during initial WebGL mount/warmup (< 3200ms)
    if (now - combatStartTimeRef.current < 3200 || isPausedForConceptRef.current) {
      if (!pendingConceptsQueueRef.current.includes(conceptId)) {
        pendingConceptsQueueRef.current.push(conceptId);
      }
      return;
    }

    hasShownConceptThisPhaseRef.current = true;
    seenConceptsRef.current.add(conceptId);
    markConceptAsSeen(conceptId);

    isPausedForConceptRef.current = true;
    renderedPausedFrameRef.current = false;
    isPointerDownRef.current = false;
    keysDownRef.current = {};
    moveInputRef.current = { x: 0, z: 0 };
    sounds.playRadioChirp();
    setActiveConceptCard(card);
  };
  triggerBiologyConceptRef.current = triggerBiologyConcept;

  const handleDismissConceptCard = () => {
    sounds.playRadioChirp();
    setActiveConceptCard(null);
    isPausedForConceptRef.current = false;
    renderedPausedFrameRef.current = false;
    lastConceptDismissTimeRef.current = performance.now();
  };
  handleDismissConceptCardRef.current = handleDismissConceptCard;

  const [passingRoadSign, setPassingRoadSign] = useState<{
    code: string;
    title: string;
    subtitle: string;
    distance: string;
    style: 'highway' | 'roundabout' | 'warning' | 'landmark';
  } | null>(null);
  const lastRoadSignTitleRef = useRef<string>('');

  // Tactical Reload Progress & Active Reload Sweet-Spot State
  const [reloadProgress, setReloadProgress] = useState<number>(0);
  const [reloadStageLabel, setReloadStageLabel] = useState<string>('EJECTING MAG');
  const [activeReloadBonus, setActiveReloadBonus] = useState<boolean>(false);
  const reloadStartTimeRef = useRef<number>(0);
  const reloadDurationRef = useRef<number>(1400);
  const reloadProgressRef = useRef<number>(0);
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleReloadRef = useRef<(() => void) | null>(null);

  // Incoming Context-Specific VOIP Radio Comms from Organs & Audible Cell/Platelet Distress Banner
  const [organRadioComm, setOrganRadioComm] = useState<OrganVoipClip | null>(null);
  const [cellDistressBanner, setCellDistressBanner] = useState<string | null>(null);

  // Black Ops Sight Scope (ADS) & Target Lock State
  const [isScoped, setIsScoped] = useState<boolean>(false);
  const isScopedRef = useRef<boolean>(false);
  const manualScopeLockRef = useRef<boolean>(false);
  const autoScopedByHoldRef = useRef<boolean>(false);
  const autoAimEnabledRef = useRef<boolean>(autoAimEnabled);
  const [isTargetLocked, setIsTargetLocked] = useState<boolean>(false);
  const lastDamageTakenTimeRef = useRef<number>(0);

  // Dynamic Screen Shake state
  const cameraRollShakeRef = useRef<number>(0);

  useEffect(() => {
    autoAimEnabledRef.current = autoAimEnabled;
  }, [autoAimEnabled]);

  // Scope is available on SCAR-H Bio-Rifle (Holo), Bolt-Action Sniper (8x Scope), and Drum LMG (Reflex), but NOT Pump Shotgun
  const weaponSupportsScope = (wpn: Weapon) => wpn.category !== 'SHOTGUN';

  const syncCrosshairDom = (nx: number, ny: number) => {
    const screenX = isMultiplayerDeathmatch ? 50 : Math.max(4, Math.min(96, (nx + 1) * 50));
    const screenY = isMultiplayerDeathmatch ? 50 : Math.max(5, Math.min(94, (-ny + 1) * 50));
    if (crosshairDomRef.current) {
      crosshairDomRef.current.style.left = `${screenX}%`;
      crosshairDomRef.current.style.top = `${screenY}%`;
    }
  };

  // Zero-lag direct DOM updater for live ammo counters during rapid fire (avoids full React VDOM re-renders on every bullet!)
  const syncLiveAmmoDom = () => {
    const ammo = currentAmmoRef.current;
    const reserve = reserveAmmoRef.current;
    const magSize = Math.max(1, currentWeaponRef.current.magSize);
    if (scopeAmmoArcDomRef.current && !isReloadingRef.current) {
      const ratio = Math.max(0, Math.min(1, ammo / magSize));
      scopeAmmoArcDomRef.current.setAttribute('stroke-dashoffset', String(145 - 145 * ratio));
      scopeAmmoArcDomRef.current.setAttribute('stroke', ammo === 0 ? '#f43f5e' : '#38bdf8');
    }
    if (scopeAmmoTextDomRef.current && !isReloadingRef.current) {
      scopeAmmoTextDomRef.current.textContent = `${ammo}/${reserve}`;
    }
    if (hotbarAmmoTextDomRef.current && !isReloadingRef.current) {
      hotbarAmmoTextDomRef.current.textContent = String(ammo);
    }
  };

  const handleToggleScope = () => {
    if (!weaponSupportsScope(currentWeaponRef.current)) {
      isScopedRef.current = false;
      manualScopeLockRef.current = false;
      autoScopedByHoldRef.current = false;
      setIsScoped(false);
      return;
    }
    const next = !isScopedRef.current;
    if (holdShootTimerRef.current) {
      clearTimeout(holdShootTimerRef.current);
      holdShootTimerRef.current = null;
    }
    // Keep exact same aimPosRef (x, y) when scoping in/out so scope aim is 100% identical to weapon aim!
    baseAimYawRef.current = 0;
    baseAimPitchRef.current = 0;
    syncCrosshairDom(aimPosRef.current.x, aimPosRef.current.y);
    isScopedRef.current = next;
    manualScopeLockRef.current = next;
    autoScopedByHoldRef.current = false;
    setIsScoped(next);
    sounds.playScopeZoom(next);
  };

  // 2-Second Hold-Shoot Optic Scope Deployment (No visual spinner/loop overlay)
  const holdShootTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startHoldShootScopeTimer = () => {
    if (!weaponSupportsScope(currentWeaponRef.current)) return;
    if (isScopedRef.current) return;
    if (holdShootTimerRef.current) {
      clearTimeout(holdShootTimerRef.current);
    }
    holdShootTimerRef.current = setTimeout(() => {
      if (!isScopedRef.current && weaponSupportsScope(currentWeaponRef.current)) {
        baseAimYawRef.current = 0;
        baseAimPitchRef.current = 0;
        syncCrosshairDom(aimPosRef.current.x, aimPosRef.current.y);
        isScopedRef.current = true;
        autoScopedByHoldRef.current = true;
        setIsScoped(true);
        sounds.playScopeZoom(true);
        sounds.triggerHaptic(14, 'medium');
      }
    }, 2000);
  };

  const cancelHoldShootScope = () => {
    if (holdShootTimerRef.current) {
      clearTimeout(holdShootTimerRef.current);
      holdShootTimerRef.current = null;
    }
    if (autoScopedByHoldRef.current && !manualScopeLockRef.current) {
      baseAimYawRef.current = 0;
      baseAimPitchRef.current = 0;
      syncCrosshairDom(aimPosRef.current.x, aimPosRef.current.y);
      isScopedRef.current = false;
      autoScopedByHoldRef.current = false;
      setIsScoped(false);
      sounds.playScopeZoom(false);
    }
  };

  // Black Ops Vision Modes & Thermal Overheat / Cooling System
  const [visionMode, setVisionMode] = useState<'normal' | 'nvg' | 'thermal'>('normal');
  const [opticsTimeRemaining, setOpticsTimeRemaining] = useState<number>(15);
  const [opticsCooldown, setOpticsCooldown] = useState<number>(0);
  const opticsCooldownRef = useRef<number>(0);
  const [radarBlips, setRadarBlips] = useState<Array<{ x: number; y: number; isTank: boolean; isAllied: boolean; callsign?: string }>>([]);
  const [compassBlips, setCompassBlips] = useState<Array<{ id: number; offsetPercent: number; isTank: boolean }>>([]);
  const [targetLocks, setTargetLocks] = useState<TargetHudLock[]>([]);

  // Crosshair Screen Tracking (Crosshair follows exact aiming/shooting point!)
  const [aimScreenPos, setAimScreenPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  // Top Center 2-Second Killstreak System (Double, Triple, Quadra, Penta, Immunoful, Leukocytastic, Bloody Monster!)
  const [activeStreak, setActiveStreak] = useState<{
    count: number;
    label: string;
    sublabel: string;
    color: string;
    id: number;
  } | null>(null);
  const lastKillTimeRef = useRef<number>(0);
  const currentStreakRef = useRef<number>(0);
  const streakTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Phase Boss State & Tracking (Helicopter, Robot, Jet)
  const bossSpawnedRef = useRef<{ helicopter: boolean; robot: boolean; jet: boolean }>({
    helicopter: false,
    robot: false,
    jet: false,
  });
  const [bossInfo, setBossInfo] = useState<{ name: string; hitsLeft: number; maxHits: number } | null>(null);

  // Blériot WW2 Plane Mortar Bombing Schedule (Frequent, visible bombing runs in every phase!)
  const bleriotScheduleRef = useRef<Array<{ triggerTime: number; fired: boolean }>>(
    phaseNumber === 1
      ? [
          { triggerTime: 50, fired: false },
          { triggerTime: 32, fired: false },
          { triggerTime: 16, fired: false },
        ]
      : phaseNumber === 2
      ? [
          { triggerTime: 52, fired: false },
          { triggerTime: 37, fired: false },
          { triggerTime: 23, fired: false },
          { triggerTime: 11, fired: false },
        ]
      : [
          { triggerTime: 53, fired: false },
          { triggerTime: 41, fired: false },
          { triggerTime: 29, fired: false },
          { triggerTime: 17, fired: false },
          { triggerTime: 7, fired: false },
        ]
  );
  const activeBleriotRunsRef = useRef<ActiveBleriotRun[]>([]);
  const activeMortarBombsRef = useRef<ActiveMortarBomb[]>([]);
  const activeBossRocketsRef = useRef<ActiveBossRocket[]>([]);

  // Enemy Troop Airdrop Schedule (1 tank + 2 soldiers on its side: multiple drops in every phase!)
  const enemyAirdropScheduleRef = useRef<Array<{ triggerTime: number; fired: boolean }>>(
    phaseNumber === 1
      ? [
          { triggerTime: 55, fired: false },
          { triggerTime: 26, fired: false },
        ]
      : phaseNumber === 2
      ? [
          { triggerTime: 56, fired: false },
          { triggerTime: 35, fired: false },
          { triggerTime: 16, fired: false },
        ]
      : [
          { triggerTime: 56, fired: false },
          { triggerTime: 40, fired: false },
          { triggerTime: 24, fired: false },
          { triggerTime: 10, fired: false },
        ]
  );
  const activeEnemyAirdropsRef = useRef<ActiveEnemyAirdrop[]>([]);

  // Organ Environmental Hazard Schedule (Interactive 3D anatomical surges in Left/Center/Right lanes!)
  const organHazardScheduleRef = useRef<Array<{ triggerTime: number; fired: boolean }>>(
    phaseNumber === 1
      ? [
          { triggerTime: 46, fired: false },
          { triggerTime: 28, fired: false },
          { triggerTime: 12, fired: false },
        ]
      : phaseNumber === 2
      ? [
          { triggerTime: 47, fired: false },
          { triggerTime: 31, fired: false },
          { triggerTime: 18, fired: false },
        ]
      : [
          { triggerTime: 48, fired: false },
          { triggerTime: 34, fired: false },
          { triggerTime: 21, fired: false },
          { triggerTime: 9, fired: false },
        ]
  );
  const activeOrganHazardsRef = useRef<ActiveOrganHazard[]>([]);
  const barricadeRefugeesRef = useRef<ActiveBarricadeRefugee[]>([]);
  const refugeePoolRef = useRef<
    Array<{
      mesh: THREE.Group;
      lArm?: THREE.Object3D;
      rArm?: THREE.Object3D;
      lLeg?: THREE.Object3D;
      rLeg?: THREE.Object3D;
      isPlatelet: boolean;
      inUse: boolean;
    }>
  >([]);
  const nextRefugeeSceneTimeRef = useRef<number>(3.5);
  const lastAimUiUpdateRef = useRef<number>(0);

  // Dedicated Multi-Touch IDs (Solves phone shooting while moving!)
  const movementTouchIdRef = useRef<number | null>(null);
  const firingTouchIdRef = useRef<number | null>(null);
  const movementTouchStartPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const movementTouchActiveRef = useRef<boolean>(false);

  // Virtual Joystick & Zero-Re-Render Crosshair DOM Refs (Eliminates 25Hz React VDOM re-renders during touch/mouse aim!)
  const joystickCenterRef = useRef<{ x: number; y: number } | null>(null);
  const joystickOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [joystickDisplay, setJoystickDisplay] = useState<{ x: number; y: number } | null>(null);
  const joystickKnobDomRef = useRef<HTMLDivElement | null>(null);
  const crosshairDomRef = useRef<HTMLDivElement | null>(null);
  const scopeReticleDomRef = useRef<HTMLDivElement | null>(null);
  const scopeAmmoArcDomRef = useRef<SVGPathElement | null>(null);
  const scopeAmmoTextDomRef = useRef<HTMLSpanElement | null>(null);
  const hotbarAmmoTextDomRef = useRef<HTMLSpanElement | null>(null);
  const lastHitmarkerUiTimeRef = useRef<number>(0);

  // Mutable Game State in Refs (ensures WebGL never unmounts on state updates!)
  // In Multiplayer Mode, initialize immediately to the player's deterministic safe courtyard spawn so there is ZERO spawn teleportation!
  const playerPosRef = useRef<{ x: number; z: number }>(
    isMultiplayerDeathmatch ? getInitialArenaSpawn(localMpPlayerIdRef.current) : { x: 0, z: 0 }
  );
  const moveInputRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const keysDownRef = useRef<Record<string, boolean>>({});
  const currentWeaponRef = useRef<Weapon>(initialWeapon);
  const weaponSwapAnimRef = useRef<{
    isSwapping: boolean;
    phase: 'lowering' | 'raising';
    progress: number;
    targetWpn: Weapon | null;
  }>({
    isSwapping: false,
    phase: 'lowering',
    progress: 0,
    targetWpn: null,
  });
  const lastWheelTimeRef = useRef<number>(0);
  const currentAmmoRef = useRef<number>(initialWeapon.magSize);
  const reserveAmmoRef = useRef<number>(initialWeapon.totalReserve);
  const isReloadingRef = useRef<boolean>(false);
  const playerHpRef = useRef<number>(100);
  const scoreRef = useRef<number>(0);
  const killsRef = useRef<number>(0);
  const comboStreakRef = useRef<number>(0);
  const aimPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const targetAimPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const baseAimYawRef = useRef<number>(0);
  const baseAimPitchRef = useRef<number>(0);
  const lastFiringTouchPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastMouseClientPosRef = useRef<{ x: number; y: number } | null>(null);
  const isPointerDownRef = useRef<boolean>(false);
  const lastShotTimeRef = useRef<number>(0);
  const nextEnemyIdRef = useRef<number>(1);
  const nextEnemyBulletIdRef = useRef<number>(1);
  const activeSoldiersRef = useRef<ActiveSoldier[]>([]);
  const activeEnemyBulletsRef = useRef<ActiveEnemyBullet[]>([]);
  const barricadesRef = useRef<ActiveBarricade[]>([]);
  const activeBiologicalDropsRef = useRef<
    Array<{
      id: number;
      type: 'atp' | 'shield';
      mesh: THREE.Group;
      active: boolean;
      x: number;
      y: number;
      z: number;
      bobPhase: number;
    }>
  >([]);
  const spawnBiologicalDropRef = useRef<
    ((x: number, z: number, prefType?: 'atp' | 'shield', yOverride?: number) => void) | null
  >(null);
  const activeGrenadesRef = useRef<ActiveGrenade[]>([]);
  const activeParticlesRef = useRef<ActiveExplosionParticle[]>([]);
  const activeShellsRef = useRef<ActiveShellCasing[]>([]);
  const activePlayerTracersRef = useRef<ActivePlayerTracer[]>([]);
  const airdropRef = useRef<ActiveAirdrop | null>(null);
  const panickingRbcsRef = useRef<any[]>([]);
  const panickingPlateletsRef = useRef<any[]>([]);
  const heroicAntibodiesRef = useRef<any[]>([]);
  const organEnvPropsRef = useRef<ReturnType<typeof createOrganEnvironmentProps> | null>(null);
  const openLungLandscapeRef = useRef<ReturnType<typeof createOpenLungAlveoliLandscape> | null>(null);
  const rebuildOrganThemeRef = useRef<((newTheme: OrganTheme) => void) | null>(null);
  const fpsGroupRef = useRef<THREE.Group | null>(null);
  const weaponMeshRef = useRef<THREE.Group | null>(null);
  const activeWeaponSubmeshRef = useRef<THREE.Group | null>(null);
  const prebuiltWeaponsRef = useRef<Record<string, { group: THREE.Group; pumpSlide?: THREE.Mesh }>>({});
  const pumpSlideRef = useRef<THREE.Mesh | null>(null);
  const muzzleFlashRef = useRef<THREE.PointLight | null>(null);
  const muzzleSpriteRef = useRef<THREE.Mesh | null>(null);
  const laserLineRef = useRef<THREE.Line | null>(null);
  const laserGlowLineRef = useRef<THREE.Line | null>(null);
  const laserDotRef = useRef<THREE.Mesh | null>(null);
  const laserRingRef = useRef<THREE.Mesh | null>(null);
  const recoilRef = useRef<{ z: number; rotX: number }>({ z: 0, rotX: 0 });
  const cameraShakeRef = useRef<number>(0);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const executeShotRef = useRef<(() => void) | null>(null);
  const visionModeRef = useRef<'normal' | 'nvg' | 'thermal'>('normal');
  const prebuiltAlliedRef = useRef<{
    plane: ReturnType<typeof createTacticalAirdropPlane>;
    leftAlly: ReturnType<typeof createAlliedWBCCommando>;
    rightAlly: ReturnType<typeof createAlliedWBCCommando>;
  } | null>(null);
  const grenadePoolRef = useRef<THREE.Group[]>([]);

  // Sound state & hardware activation tracking
  const [audioSuspended, setAudioSuspended] = useState<boolean>(() => sounds.isAudioSuspended());
  const audioSuspendedRef = useRef<boolean>(audioSuspended);
  audioSuspendedRef.current = audioSuspended;

  useEffect(() => {
    sounds.setEnabled(soundEnabled);
    if (soundEnabled) {
      sounds.unlockAudio();
      const susp = sounds.isAudioSuspended();
      audioSuspendedRef.current = susp;
      setAudioSuspended(susp);
    }
  }, [soundEnabled]);

  const handleSoundToggle = () => {
    sounds.unlockAudio();
    if (onToggleSound) {
      onToggleSound();
    } else {
      sounds.setEnabled(!soundEnabled);
    }
    audioSuspendedRef.current = false;
    setAudioSuspended(false);
    sounds.playRadioChirp();
  };

  // Lightweight VOIP helper (invoked only on major combat milestones rather than background intervals to prevent WebAudio node accumulation)
  const triggerContextualOrganVoip = (_force: boolean = false) => {
    // No-op background chatter to keep mobile audio thread 100% dedicated to gunfire & haptics
  };

  // Toggle Black Ops Optics (Normal -> NVG -> FLIR Thermal) with Overheat & Cooldown
  const handleToggleVisionMode = () => {
    if (opticsCooldownRef.current > 0) {
      sounds.playDryFire();
      return;
    }
    sounds.playNightVisionToggle();
    setVisionMode((prev) => {
      const next = prev === 'normal' ? 'nvg' : prev === 'nvg' ? 'thermal' : 'normal';
      visionModeRef.current = next;
      if (prev === 'normal' && next !== 'normal') {
        setOpticsTimeRemaining(15);
      }
      return next;
    });
  };

  // Optics Active Timer (15 seconds max use before overheating!)
  useEffect(() => {
    if (visionMode === 'normal') return;
    const timer = setInterval(() => {
      setOpticsTimeRemaining((prev) => {
        if (prev <= 1) {
          // Overheated! Shut down optics and start 9s cooling cycle
          setVisionMode('normal');
          visionModeRef.current = 'normal';
          opticsCooldownRef.current = 9;
          setOpticsCooldown(9);
          sounds.playQuizWrong();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [visionMode]);

  // Optics Overheat Cooling Cooldown
  useEffect(() => {
    if (opticsCooldown > 0) {
      const t = setTimeout(() => {
        const next = opticsCooldown - 1;
        opticsCooldownRef.current = next;
        setOpticsCooldown(next);
        if (next === 0) {
          sounds.playRadioChirp();
        }
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [opticsCooldown]);

  // Low HP heartbeat alert
  useEffect(() => {
    if (playerHp < 35 && playerHp > 0) {
      const interval = setInterval(() => {
        sounds.playHeartbeat();
      }, 850);
      return () => clearInterval(interval);
    }
  }, [playerHp]);

  // Trigger First-Time Biology Concept for the active Organ Theme shortly after entering the arena
  useEffect(() => {
    const organConceptTimer = setTimeout(() => {
      triggerBiologyConceptRef.current?.(`organ_${organThemeRef.current.id}`);
    }, 1100);
    return () => clearTimeout(organConceptTimer);
  }, []);

  // ============================================================================
  // MULTIPLAYER DEATHMATCH: REVIVE (ON DEATH) & BIO-STASIS FREEZE (AFTER 1 MIN)
  // ============================================================================
  const triggerMpEliminatedState = (killerName: string = 'Rival Operative', weaponName: string = 'Bio-Rifle') => {
    if (!isMultiplayerDeathmatch) return;
    if (mpStatusRef.current === 'reviving') return;

    mpStatusRef.current = 'reviving';
    setMpStatus('reviving');
    setMpQuizReason('revive');
    setMpKilledByInfo({ killerName, weaponName });
    setMpCorrectCount(0);
    setMpSelectedOpt(null);
    setMpFeedback(null);
    setMpQuestionIdx((prev) => (prev + 1) % Math.max(1, level.questions.length));

    mpDeathsRef.current += 1;
    setMpDeaths(mpDeathsRef.current);
    playerHpRef.current = 0;
    setPlayerHp(0);

    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    isPointerDownRef.current = false;
    keysDownRef.current = {};
    moveInputRef.current = { x: 0, z: 0 };
    sounds.playQuizWrong();
    sounds.triggerHaptic([60, 40, 80], 'heavy');

    const prof = loadStudentProfile();
    pushKillfeedEntryRef.current?.({
      id: `elim_${Date.now()}_${Math.random()}`,
      killerName: killerName || 'Rival Operative',
      victimName: prof?.name || 'Operative',
      weaponName: weaponName || 'Bio-Rifle',
      timestamp: Date.now(),
    });
    syncLocalPlayerState(activeRoomCodeRef.current, {
      playerId: localMpPlayerIdRef.current,
      studentName: prof?.name || 'Operative',
      className: prof?.className || 'Science Unit',
      avatarType: localMpAvatarRef.current,
      x: playerPosRef.current.x,
      y: Number(playerElevationYRef.current.toFixed(2)),
      z: playerPosRef.current.z,
      aimX: aimPosRef.current.x,
      aimY: aimPosRef.current.y,
      yaw: Number(cameraYawRef.current.toFixed(3)),
      pitch: Number(cameraPitchRef.current.toFixed(3)),
      inputSeq: predictionEngineRef.current.getCurrentSeq(),
      lastActivityAt: lastPlayerActivityRef.current,
      weaponId: currentWeaponRef.current.id,
      hp: 0,
      maxHp: 100,
      status: 'reviving',
      kills: killsRef.current,
      deaths: mpDeathsRef.current,
      score: scoreRef.current,
      isReady: true,
      shotSeq: localShotSeqRef.current,
      grenadeSeq: localGrenadeSeqRef.current,
      lastPing: Date.now(),
    });
  };
  triggerMpEliminatedStateRef.current = triggerMpEliminatedState;

  const triggerMpStunFreezeState = () => {
    if (!isMultiplayerDeathmatch) return;
    if (mpStatusRef.current !== 'active') return;

    mpStatusRef.current = 'stunned';
    setMpStatus('stunned');
    setMpQuizReason('stun');
    setMpKilledByInfo(null);
    setMpCorrectCount(0);
    setMpSelectedOpt(null);
    setMpFeedback(null);
    setMpQuestionIdx((prev) => (prev + 1) % Math.max(1, level.questions.length));

    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    isPointerDownRef.current = false;
    keysDownRef.current = {};
    moveInputRef.current = { x: 0, z: 0 };
    sounds.playCombatAlarm();
    sounds.triggerHaptic([45, 30, 45], 'medium');

    const prof = loadStudentProfile();
    syncLocalPlayerState(activeRoomCodeRef.current, {
      playerId: localMpPlayerIdRef.current,
      studentName: prof?.name || 'Operative',
      className: prof?.className || 'Science Unit',
      avatarType: localMpAvatarRef.current,
      x: playerPosRef.current.x,
      y: Number(playerElevationYRef.current.toFixed(2)),
      z: playerPosRef.current.z,
      aimX: aimPosRef.current.x,
      aimY: aimPosRef.current.y,
      yaw: Number(cameraYawRef.current.toFixed(3)),
      pitch: Number(cameraPitchRef.current.toFixed(3)),
      inputSeq: predictionEngineRef.current.getCurrentSeq(),
      lastActivityAt: lastPlayerActivityRef.current,
      weaponId: currentWeaponRef.current.id,
      hp: playerHpRef.current,
      maxHp: 100,
      status: 'stunned',
      kills: killsRef.current,
      deaths: mpDeathsRef.current,
      score: scoreRef.current,
      isReady: true,
      shotSeq: localShotSeqRef.current,
      grenadeSeq: localGrenadeSeqRef.current,
      lastPing: Date.now(),
    });
  };
  triggerMpStunFreezeStateRef.current = triggerMpStunFreezeState;

  const handleMpAnswerOption = (optIdx: number) => {
    lastPlayerActivityRef.current = Date.now();
    if (mpSelectedOpt !== null) return;
    const questions = level.questions && level.questions.length > 0 ? level.questions : CURRICULUM_LEVELS[0].questions;
    const q = questions[mpQuestionIdx % questions.length];
    if (!q) return;

    sounds.unlockAudio();
    setMpSelectedOpt(optIdx);
    const isCorrect = optIdx === q.correctIndex;

    if (isCorrect) {
      sounds.playQuizCorrect();
      sounds.triggerHaptic([20, 30], 'light');
      const nextCorrect = mpCorrectCount + 1;
      setMpCorrectCount(nextCorrect);
      setMpFeedback({
        isCorrect: true,
        explanation: q.explanation || 'Correct biological verification!',
      });
      scoreRef.current += 100;
      setScore(scoreRef.current);

      setTimeout(() => {
        setMpSelectedOpt(null);
        setMpFeedback(null);
        setMpQuestionIdx((prev) => (prev + 1) % questions.length);

        if (nextCorrect >= 1) {
          // 1 QUESTION ANSWERED CORRECTLY -> REVIVE OR UNFREEZE FOR 1 MINUTE OF COMBAT!
          sounds.playVictory();
          sounds.triggerHaptic([35, 25, 55], 'heavy');
          lastPlayerActivityRef.current = Date.now();
          playerHpRef.current = 100;
          setPlayerHp(100);
          currentAmmoRef.current = currentWeaponRef.current.magSize;
          reserveAmmoRef.current = currentWeaponRef.current.totalReserve;
          setCurrentAmmo(currentAmmoRef.current);
          setReserveAmmo(reserveAmmoRef.current);
          syncLiveAmmoDom();
          timeLeftRef.current = 60;
          setTimeLeft(60);
          mpStatusRef.current = 'active';
          setMpStatus('active');
          setMpKilledByInfo(null);

          // Automatically lock pointer on deploying/reviving into Multiplayer combat
          if (mountRef.current && document.pointerLockElement !== mountRef.current) {
            try {
              const lockPromise = (
                mountRef.current as HTMLElement & { requestPointerLock?: () => Promise<void> | void }
              ).requestPointerLock?.();
              if (lockPromise && typeof (lockPromise as Promise<void>).catch === 'function') {
                (lockPromise as Promise<void>).catch(() => {});
              }
            } catch {
              // Ignore if browser throttles pointer lock
            }
          }

          // Repair sandbag bunkers on revive/unfreeze
          barricadesRef.current.forEach((b) => {
            b.hp = b.maxHp;
            b.group.visible = true;
            if (b.hpBarFill) {
              b.hpBarFill.scale.x = 1;
              b.hpBarFill.position.x = 0;
            }
          });

          const prof = cachedStudentProfileRef.current || loadStudentProfile();
          recordScoreToLeaderboard({
            studentName: prof?.name || 'Operative',
            className: prof?.className || 'Class 7',
            score: scoreRef.current,
            kills: killsRef.current,
            levelTitle: `Arena [${activeRoomCodeRef.current}] PvP`,
            stage: 'Multiplayer',
            rankTitle: 'Commando',
            isVictory: killsRef.current > 0,
          }).catch(() => {});

          syncLocalPlayerState(activeRoomCodeRef.current, {
            playerId: localMpPlayerIdRef.current,
            studentName: prof?.name || 'Operative',
            className: prof?.className || 'Science Unit',
            avatarType: localMpAvatarRef.current,
            x: playerPosRef.current.x,
            y: Number(playerElevationYRef.current.toFixed(2)),
            z: playerPosRef.current.z,
            aimX: aimPosRef.current.x,
            aimY: aimPosRef.current.y,
            yaw: Number(cameraYawRef.current.toFixed(3)),
            pitch: Number(cameraPitchRef.current.toFixed(3)),
            inputSeq: predictionEngineRef.current.getCurrentSeq(),
            lastActivityAt: lastPlayerActivityRef.current,
            weaponId: currentWeaponRef.current.id,
            hp: 100,
            maxHp: 100,
            status: 'active',
            kills: killsRef.current,
            deaths: mpDeathsRef.current,
            score: scoreRef.current,
            isReady: true,
            shotSeq: localShotSeqRef.current,
            grenadeSeq: localGrenadeSeqRef.current,
            lastPing: Date.now(),
          });
        }
      }, 650);
    } else {
      sounds.playQuizWrong();
      sounds.triggerHaptic([45, 35, 45], 'medium');
      setMpFeedback({
        isCorrect: false,
        explanation: q.explanation || 'Review the science concept and try the next question!',
      });
      setTimeout(() => {
        setMpSelectedOpt(null);
        setMpFeedback(null);
        setMpQuestionIdx((prev) => (prev + 1) % questions.length);
      }, 1350);
    }
  };

  const triggerMultiplayerMatchEnd = (reason: 'kill_limit' | 'time_limit') => {
    if (!isMultiplayerDeathmatch || mpMatchEndedRef.current) return;
    mpMatchEndedRef.current = true;
    renderedPausedFrameRef.current = false;
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    isPointerDownRef.current = false;
    keysDownRef.current = {};
    moveInputRef.current = { x: 0, z: 0 };
    setMpMatchEndReason(reason);
    setMpMatchEnded(true);
    sounds.playVictory();
    sounds.triggerHaptic([40, 30, 60], 'heavy');
    pushLocalMpStateNowRef.current?.();

    const prof = loadStudentProfile();
    recordScoreToLeaderboard({
      studentName: prof?.name || 'Operative',
      className: prof?.className || 'Class 7',
      score: scoreRef.current,
      kills: killsRef.current,
      levelTitle: `Arena [${activeRoomCodeRef.current}] PvP`,
      stage: 'Multiplayer',
      rankTitle: 'Commando',
      isVictory: killsRef.current > 0,
    }).catch(() => {});
  };
  triggerMultiplayerMatchEndRef.current = triggerMultiplayerMatchEnd;

  const handlePlayNextMatch = () => {
    sounds.unlockAudio();
    sounds.triggerHaptic([25, 20, 35], 'medium');
    sounds.playCombatAlarm();

    mpMatchEndedRef.current = false;
    setMpMatchEnded(false);
    mpMatchTimeLeftRef.current = MATCH_DURATION_SECONDS;
    setMpMatchTimeLeft(MATCH_DURATION_SECONDS);
    renderedPausedFrameRef.current = false;

    killsRef.current = 0;
    setKills(0);
    scoreRef.current = 0;
    setScore(0);
    mpDeathsRef.current = 0;
    setMpDeaths(0);
    shotsFiredRef.current = 0;
    shotsHitRef.current = 0;
    comboStreakRef.current = 0;
    setMpKillfeed([]);

    playerHpRef.current = 100;
    setPlayerHp(100);
    currentAmmoRef.current = currentWeaponRef.current.magSize;
    reserveAmmoRef.current = currentWeaponRef.current.totalReserve;
    setCurrentAmmo(currentAmmoRef.current);
    setReserveAmmo(reserveAmmoRef.current);
    syncLiveAmmoDom();

    timeLeftRef.current = 60;
    setTimeLeft(60);
    mpStatusRef.current = 'active';
    setMpStatus('active');
    setMpKilledByInfo(null);
    lastPlayerActivityRef.current = Date.now();

    const freshSpawn = getInitialArenaSpawn(`${localMpPlayerIdRef.current}_${Date.now()}`);
    playerPosRef.current = { x: freshSpawn.x, z: freshSpawn.z };

    try {
      sessionStorage.removeItem('BIODEFENSE_MP_AVATAR_V1');
    } catch {
      // Ignore storage restrictions
    }
    localMpAvatarRef.current = getOrCreateMultiplayerAvatar(localMpPlayerIdRef.current);

    pushLocalMpStateNowRef.current?.();
  };

  // Real-Time Online Multiplayer Room Join (Auto-Scaling 5-Player Rooms), Client-Side Prediction & Server Reconciliation, Heartbeat & 1-Min AFK Kick
  useEffect(() => {
    if (!isMultiplayerDeathmatch) return;
    const prof = loadStudentProfile();
    const cachedStudentName = prof?.name || 'Operative';
    const cachedClassName = prof?.className || 'Science Unit';
    const myId = localMpPlayerIdRef.current;

    const sessionStartEpoch = Date.now();
    predictionEngineRef.current.reset();
    lastPlayerActivityRef.current = sessionStartEpoch;
    afkKickedRef.current = false;
    setAfkKickedModal(false);
    setAfkWarningSecondsLeft(null);

    let isCancelled = false;
    let hasJoinedRoom = false;
    let currentUnsub: (() => void) | null = null;

    const pushStateNow = () => {
      if (afkKickedRef.current || isCancelled || !hasJoinedRoom) return;
      syncLocalPlayerState(activeRoomCodeRef.current, {
        playerId: myId,
        studentName: cachedStudentName,
        className: cachedClassName,
        avatarType: localMpAvatarRef.current,
        x: Number(playerPosRef.current.x.toFixed(3)),
        y: Number(playerElevationYRef.current.toFixed(2)),
        z: Number(playerPosRef.current.z.toFixed(3)),
        vx: Number(playerWorldVelRef.current.vx.toFixed(2)),
        vz: Number(playerWorldVelRef.current.vz.toFixed(2)),
        yaw: Number(cameraYawRef.current.toFixed(3)),
        pitch: Number(cameraPitchRef.current.toFixed(3)),
        aimX: Number(aimPosRef.current.x.toFixed(3)),
        aimY: Number(aimPosRef.current.y.toFixed(3)),
        inputSeq: predictionEngineRef.current.getCurrentSeq(),
        lastActivityAt: lastPlayerActivityRef.current,
        weaponId: currentWeaponRef.current.id,
        hp: playerHpRef.current,
        maxHp: 100,
        status: mpStatusRef.current,
        kills: killsRef.current,
        deaths: mpDeathsRef.current,
        score: scoreRef.current,
        accuracy: getLocalAccuracyPct(),
        isReady: true,
        shotSeq: localShotSeqRef.current,
        grenadeSeq: localGrenadeSeqRef.current,
        isCrouched: isCrouchingRef.current,
        lastPing: Date.now(),
      });
    };

    const connectToAvailableRoom = async (minRoomIndex: number = 1) => {
      hasJoinedRoom = false;
      const { roomCode: assignedCode, initialPlayer } = await joinDeathmatchRoom(
        multiplayerRoomCode,
        prof,
        currentWeaponRef.current.id,
        mpStatusRef.current,
        playerPosRef.current,
        minRoomIndex
      );

      if (isCancelled) {
        void leaveDeathmatchRoom(assignedCode, myId);
        return;
      }

      activeRoomCodeRef.current = assignedCode;
      setActiveRoomCode(assignedCode);
      hasJoinedRoom = true;
      pushStateNow();

      if (currentUnsub) {
        currentUnsub();
        currentUnsub = null;
      }

      currentUnsub = subscribeToDeathmatchRoom(
        assignedCode,
        myId,
        (players) => {
          mpOnlinePlayersRef.current = players;
          // Auto-orient initial camera base yaw toward the first connected opponent so both devices immediately see each other
          if (!hasLockedOpponentYawRef.current) {
            const firstOpponent = players.find((p) => p.playerId !== myId);
            if (firstOpponent) {
              hasLockedOpponentYawRef.current = true;
              const oppDx = firstOpponent.x - playerPosRef.current.x;
              const oppDz = firstOpponent.z - playerPosRef.current.z;
              if (Math.hypot(oppDx, oppDz) > 0.1) {
                const faceYaw = Math.atan2(-oppDx, -oppDz);
                cameraBaseYawOffsetRef.current = faceYaw;
                targetCameraYawRef.current = faceYaw;
                cameraYawRef.current = faceYaw;
              }
            }
          }
          const nextKey = players
            .map((p) => `${p.playerId}:${p.status}:${p.kills}:${p.score}:${p.accuracy || 0}:${p.weaponId}`)
            .join('|');
          if (nextKey !== prevMpPlayersKeyRef.current) {
            prevMpPlayersKeyRef.current = nextKey;
            setMpOnlinePlayers(players);
          }
          // Check 10-kill match completion threshold across all operatives in the room
          if (!mpMatchEndedRef.current && players.some((p) => (p.kills || 0) >= MATCH_KILL_LIMIT)) {
            triggerMultiplayerMatchEndRef.current?.('kill_limit');
          }
        },
        (hit) => {
          if (mpMatchEndedRef.current) return;
          // Players inside the freezing bio-stasis shield ('stunned') or reviving cannot be damaged or killed!
          if (mpStatusRef.current !== 'active') return;
          const nextHp = Math.max(0, Math.min(playerHpRef.current, hit.newHp));
          playerHpRef.current = nextHp;
          setPlayerHp(nextHp);
          cameraShakeRef.current = Math.max(cameraShakeRef.current, 0.55);
          sounds.playQuizWrong();
          sounds.triggerHaptic([45, 30, 45], 'heavy');
          if (nextHp <= 0 || hit.eliminated) {
            triggerMpEliminatedStateRef.current?.(hit.attackerName, hit.weaponName);
          } else {
            pushLocalMpStateNowRef.current?.();
          }
        },
        (kfEvent) => {
          pushKillfeedEntryRef.current?.(kfEvent);
        },
        (authoritativeLocal) => {
          if (afkKickedRef.current || mpMatchEndedRef.current) return;
          predictionEngineRef.current.reconcileServerState(
            authoritativeLocal,
            {
              x: playerPosRef.current.x,
              y: playerElevationYRef.current,
              z: playerPosRef.current.z,
              aimX: aimPosRef.current.x,
              aimY: aimPosRef.current.y,
              yaw: cameraYawRef.current,
              pitch: cameraPitchRef.current,
            }
          );
        },
        (_kickedPlayerId, kickedName) => {
          pushKillfeedEntryRef.current?.({
            id: `afk_${Date.now()}_${Math.random()}`,
            killerName: 'COMMAND',
            victimName: kickedName || 'Operative',
            weaponName: 'AFK KICK (1M IDLE)',
            timestamp: Date.now(),
          });
        },
        (nextMinRoomIndex) => {
          if (isCancelled) return;
          void leaveDeathmatchRoom(assignedCode, myId);
          void connectToAvailableRoom(nextMinRoomIndex);
        },
        initialPlayer
      );
    };

    void connectToAvailableRoom(1);

    pushLocalMpStateNowRef.current = pushStateNow;
    const syncTimer = setInterval(pushStateNow, 85);

    // 1-Minute (60s) AFK Watchdog: Kicks player out of server if no movement, combat actions, or question solving occurs for 1 minute
    let afkExitTimeout: ReturnType<typeof setTimeout> | null = null;
    const afkWatchdogTimer = setInterval(() => {
      if (afkKickedRef.current || mpMatchEndedRef.current) return;
      const nowEpoch = Date.now();
      const safeLastActivity =
        lastPlayerActivityRef.current >= sessionStartEpoch &&
        lastPlayerActivityRef.current <= nowEpoch + 5_000
          ? lastPlayerActivityRef.current
          : sessionStartEpoch;
      const idleMs = nowEpoch - safeLastActivity;
      if (idleMs >= AFK_TIMEOUT_MS) {
        afkKickedRef.current = true;
        isGamePausedRef.current = true;
        isPointerDownRef.current = false;
        keysDownRef.current = {};
        setAfkWarningSecondsLeft(null);
        setAfkKickedModal(true);
        clearInterval(syncTimer);
        sounds.playCombatAlarm();
        void kickAfkPlayerFromRoom(activeRoomCodeRef.current, myId, cachedStudentName);
        afkExitTimeout = setTimeout(() => {
          onExitToMenuRef.current?.();
        }, 3200);
      } else if (idleMs >= 45_000) {
        const secsLeft = Math.max(1, Math.ceil((AFK_TIMEOUT_MS - idleMs) / 1000));
        setAfkWarningSecondsLeft((prev) => (prev !== secsLeft ? secsLeft : prev));
      } else {
        setAfkWarningSecondsLeft((prev) => (prev !== null ? null : prev));
      }
    }, 500);

    return () => {
      isCancelled = true;
      hasJoinedRoom = false;
      pushLocalMpStateNowRef.current = null;
      clearInterval(syncTimer);
      clearInterval(afkWatchdogTimer);
      if (afkExitTimeout) clearTimeout(afkExitTimeout);
      if (currentUnsub) currentUnsub();
      void leaveDeathmatchRoom(activeRoomCodeRef.current, myId);
    };
  }, [isMultiplayerDeathmatch, multiplayerRoomCode]);

  // 60-second combat countdown & 5-minute Multiplayer Match Countdown
  const timeLeftRef = useRef<number>(60);
  useEffect(() => {
    sounds.playCombatAlarm();
    timeLeftRef.current = 60;
    const timer = setInterval(() => {
      if (isPausedForConceptRef.current || isGamePausedRef.current) return;
      if (isMultiplayerDeathmatch && mpMatchEndedRef.current) return;

      // Auto-prune expired tactical killfeed entries older than 9.5 seconds
      setMpKillfeed((prev) => {
        if (prev.length === 0) return prev;
        const nowEpoch = Date.now();
        const filtered = prev.filter((item) => nowEpoch - item.timestamp < 9500);
        return filtered.length === prev.length ? prev : filtered;
      });

      // Multiplayer 5-Minute (300s) Match Countdown Timer (direct DOM update except at <=30s warning threshold)
      if (isMultiplayerDeathmatch) {
        if (mpMatchTimeLeftRef.current <= 1) {
          mpMatchTimeLeftRef.current = 0;
          if (mpMatchTimerDomRef.current) {
            mpMatchTimerDomRef.current.textContent = '0:00';
          }
          setMpMatchTimeLeft(0);
          triggerMultiplayerMatchEndRef.current?.('time_limit');
          return;
        } else {
          mpMatchTimeLeftRef.current -= 1;
          const nextMpSec = mpMatchTimeLeftRef.current;
          if (mpMatchTimerDomRef.current) {
            mpMatchTimerDomRef.current.textContent = `${Math.floor(nextMpSec / 60)}:${String(
              nextMpSec % 60
            ).padStart(2, '0')}`;
          }
          if (nextMpSec <= 30) {
            setMpMatchTimeLeft(nextMpSec);
          }
        }
        // Check 10-kill threshold
        if (killsRef.current >= MATCH_KILL_LIMIT) {
          triggerMultiplayerMatchEndRef.current?.('kill_limit');
          return;
        }
      }

      if (isMultiplayerDeathmatch && mpStatusRef.current !== 'active') return;

      // Show at most 1 queued biology concept in this phase after 3.2s warmup (Solo mode only)
      const nowCheck = performance.now();
      if (
        !isMultiplayerDeathmatch &&
        !hasShownConceptThisPhaseRef.current &&
        pendingConceptsQueueRef.current.length > 0 &&
        nowCheck - combatStartTimeRef.current >= 3200
      ) {
        while (pendingConceptsQueueRef.current.length > 0) {
          const nextId = pendingConceptsQueueRef.current.shift();
          if (nextId && !seenConceptsRef.current.has(nextId)) {
            const nextCard = BIOLOGY_CONCEPT_CARDS[nextId];
            if (nextCard) {
              hasShownConceptThisPhaseRef.current = true;
              seenConceptsRef.current.add(nextId);
              markConceptAsSeen(nextId);
              isPausedForConceptRef.current = true;
              renderedPausedFrameRef.current = false;
              isPointerDownRef.current = false;
              keysDownRef.current = {};
              moveInputRef.current = { x: 0, z: 0 };
              sounds.playRadioChirp();
              setActiveConceptCard(nextCard);
              return;
            }
          }
        }
      }

      const prevTime = timeLeftRef.current;
      if (prevTime <= 1) {
        timeLeftRef.current = 0;
        if (liveTimerDomRef.current) liveTimerDomRef.current.textContent = '0S';
        if (soloWaveTimerDomRef.current) soloWaveTimerDomRef.current.textContent = '0:00';
        setTimeLeft(0);
        if (isMultiplayerDeathmatch) {
          // 1-Minute Active Combat Window Reached -> Freeze & Stun Player Until 1 Question Answered!
          setTimeout(() => {
            triggerMpStunFreezeStateRef.current?.();
          }, 0);
        } else {
          clearInterval(timer);
        }
      } else {
        const next = prevTime - 1;
        timeLeftRef.current = next;
        if (liveTimerDomRef.current) {
          liveTimerDomRef.current.textContent = `${next}S`;
        }
        if (soloWaveTimerDomRef.current) {
          soloWaveTimerDomRef.current.textContent = `0:${next < 10 ? `0${next}` : next}`;
        }
        // Only trigger a React state re-render when entering the <=12s warning window
        if (next <= 12) {
          setTimeLeft(next);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isMultiplayerDeathmatch]);

  // Timer complete -> VICTORY! (Solo Mode only; Phase 3 plays natural Enemy Panic & Horizon Retreat before showing Victory Modal!)
  useEffect(() => {
    if (!isMultiplayerDeathmatch && timeLeft === 0 && playerHpRef.current > 0 && !phaseCompleteCalledRef.current) {
      if (phaseNumber >= 3) {
        if (!isPhase3RetreatingRef.current) {
          isPhase3RetreatingRef.current = true;
          setIsPhase3Retreating(true);
          setRetreatDialogueStep(0);
          ensureRetreatStragglersRef.current?.();
          sounds.playRadioChirp();
        }
        return;
      }
      phaseCompleteCalledRef.current = true;
      sounds.playVictory();
      onPhaseComplete(scoreRef.current + 1000, killsRef.current);
    }
  }, [timeLeft, onPhaseComplete, isMultiplayerDeathmatch, phaseNumber]);

  // Phase 3 Natural Enemy Retreat Sequence progression (Panic -> Turn Around & Run -> Disappear in Horizon -> Victory Score & Stars)
  useEffect(() => {
    if (!isPhase3Retreating || isMultiplayerDeathmatch) return;

    const t1 = window.setTimeout(() => {
      setRetreatDialogueStep(1);
      sounds.playRadioChirp();
    }, 1150);

    const t2 = window.setTimeout(() => {
      setRetreatDialogueStep(2);
    }, 2500);

    const t3 = window.setTimeout(() => {
      if (!phaseCompleteCalledRef.current) {
        phaseCompleteCalledRef.current = true;
        sounds.playVictory();
        onPhaseComplete(scoreRef.current + 1000, killsRef.current);
      }
    }, 4200);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [isPhase3Retreating, isMultiplayerDeathmatch, onPhaseComplete]);

  // Cooldown timers (keep React state and synchronous refs strictly synchronized)
  useEffect(() => {
    if (stimCooldown > 0) {
      stimCooldownRef.current = stimCooldown;
      const t = setTimeout(() => {
        setStimCooldown((prev) => {
          const next = Math.max(0, prev - 1);
          stimCooldownRef.current = next;
          return next;
        });
      }, 1000);
      return () => clearTimeout(t);
    } else {
      stimCooldownRef.current = 0;
    }
  }, [stimCooldown]);

  useEffect(() => {
    if (grenadeCooldown > 0) {
      grenadeCooldownRef.current = grenadeCooldown;
      const t = setTimeout(() => {
        setGrenadeCooldown((prev) => {
          const next = Math.max(0, prev - 1);
          grenadeCooldownRef.current = next;
          return next;
        });
      }, 1000);
      return () => clearTimeout(t);
    } else {
      grenadeCooldownRef.current = 0;
    }
  }, [grenadeCooldown]);

  useEffect(() => {
    if (reinforceCooldown > 0) {
      reinforceCooldownRef.current = reinforceCooldown;
      const t = setTimeout(() => {
        setReinforceCooldown((prev) => {
          const next = Math.max(0, prev - 1);
          reinforceCooldownRef.current = next;
          return next;
        });
      }, 1000);
      return () => clearTimeout(t);
    } else {
      reinforceCooldownRef.current = 0;
    }
  }, [reinforceCooldown]);

  // Stimpack Heal (Synchronous ref-guarded cooldown check prevents keyboard bypass)
  const handleStimpack = () => {
    if (isMultiplayerDeathmatch && mpStatusRef.current !== 'active') return;
    if (stimCooldownRef.current > 0 || playerHpRef.current >= 100) return;
    stimCooldownRef.current = 12;
    setStimCooldown(12);
    sounds.playStimInject();
    const newHp = Math.min(100, playerHpRef.current + 40);
    playerHpRef.current = newHp;
    setPlayerHp(newHp);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
  };
  handleStimpackRef.current = handleStimpack;

  // Tactical Reload with 3D Weapon Animation, Multi-Stage Audio & Active Speed-Reload Sweet Spot!
  const finishReloadNow = (grantBonusBullets = false) => {
    if (reloadTimeoutRef.current) {
      clearTimeout(reloadTimeoutRef.current);
      reloadTimeoutRef.current = null;
    }
    const maxMag = currentWeaponRef.current.magSize;
    const needed = maxMag - currentAmmoRef.current;
    const amount = Math.min(needed, reserveAmmoRef.current);
    const bonus = grantBonusBullets ? Math.min(4, Math.ceil(maxMag * 0.15)) : 0;
    currentAmmoRef.current = Math.min(maxMag + bonus, currentAmmoRef.current + amount + bonus);
    reserveAmmoRef.current = Math.max(0, reserveAmmoRef.current - amount);
    setCurrentAmmo(currentAmmoRef.current);
    setReserveAmmo(reserveAmmoRef.current);
    isReloadingRef.current = false;
    setIsReloading(false);
    reloadProgressRef.current = 0;
    setReloadProgress(0);
    syncLiveAmmoDom();
    if (grantBonusBullets) {
      setActiveReloadBonus(true);
      setTimeout(() => setActiveReloadBonus(false), 1800);
    }
  };

  const handleReload = () => {
    if (isMultiplayerDeathmatch && mpStatusRef.current !== 'active') return;
    // If already reloading, pressing R or clicking RELOAD inside the [45%..78%] sweet spot triggers an instant Active Speed-Reload Lock!
    if (isReloadingRef.current) {
      if (reloadProgressRef.current >= 45 && reloadProgressRef.current <= 78) {
        sounds.playActiveReloadLock();
        recoilRef.current.z = 0.22;
        recoilRef.current.rotX = -0.14;
        finishReloadNow(true);
      }
      return;
    }

    if (currentAmmoRef.current >= currentWeaponRef.current.magSize || reserveAmmoRef.current <= 0) return;

    const duration = currentWeaponRef.current.reloadTime;
    isReloadingRef.current = true;
    setIsReloading(true);
    reloadStartTimeRef.current = performance.now();
    reloadDurationRef.current = duration;
    reloadProgressRef.current = 0;
    setReloadProgress(0);
    setReloadStageLabel('1/3 EJECTING MAG');
    sounds.playReload(duration);

    if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
    reloadTimeoutRef.current = setTimeout(() => {
      finishReloadNow(false);
    }, duration);
  };
  handleReloadRef.current = handleReload;

  // Throw Grenade (Smart-arcs toward active enemy cluster along aim line, detonates on contact or ground impact!)
  const handleThrowGrenade = () => {
    if (isMultiplayerDeathmatch && mpStatusRef.current !== 'active') return;
    if (grenadeCooldownRef.current > 0 || !sceneRef.current) return;
    grenadeCooldownRef.current = 10;
    setGrenadeCooldown(10);
    localGrenadeSeqRef.current += 1;
    if (isMultiplayerDeathmatch) {
      pushLocalMpStateNowRef.current?.();
    }
    sounds.playGrenadeThrow();
    sounds.triggerHaptic([25, 30], 'medium');

    const pool = grenadePoolRef.current;
    let grenadeMesh = pool.find((g) => !g.visible) || pool[0];
    if (!grenadeMesh) {
      grenadeMesh = createGrenadeModel();
      sceneRef.current.add(grenadeMesh);
      pool.push(grenadeMesh);
    }
    const startX = playerPosRef.current.x + (isMultiplayerDeathmatch ? 0 : 0.2);
    const startY = (isMultiplayerDeathmatch ? playerElevationYRef.current : 0) - 0.2;
    const startZ = playerPosRef.current.z - (isMultiplayerDeathmatch ? 0 : 0.8);
    grenadeMesh.visible = true;
    grenadeMesh.position.set(startX, startY, startZ);

    if (isMultiplayerDeathmatch && cameraRef.current) {
      const cam = cameraRef.current;
      cam.updateMatrixWorld();
      _v1.set(aimPosRef.current.x, aimPosRef.current.y, 0.5).unproject(cam).sub(cam.position).normalize();
      const throwSpeed = 16.5;
      activeGrenadesRef.current.push({
        mesh: grenadeMesh,
        vx: _v1.x * throwSpeed,
        vy: Math.max(2.4, _v1.y * throwSpeed + 3.4),
        vz: _v1.z * throwSpeed,
        life: 1.35,
      });
      return;
    }

    // Find closest enemy/tank/boss near aim direction so the frag lands right in the enemy pack instead of overshooting!
    const aimWorldX = playerPosRef.current.x + aimPosRef.current.x * 4.2;
    let targetX = Math.max(-3.2, Math.min(3.2, aimWorldX));
    let targetZ = -12.5;
    let bestScore = Infinity;
    for (const s of activeSoldiersRef.current) {
      if (s.hp <= 0 || s.hitsLeft <= 0) continue;
      const dx = Math.abs(s.mesh.position.x - aimWorldX);
      const dz = Math.abs(s.mesh.position.z - (-12));
      const score = dx * 2.2 + dz * 0.35;
      if (score < bestScore) {
        bestScore = score;
        targetX = s.mesh.position.x;
        targetZ = Math.max(-24, Math.min(-4.5, s.mesh.position.z));
      }
    }

    const flightTime = 0.85;
    activeGrenadesRef.current.push({
      mesh: grenadeMesh,
      vx: (targetX - startX) / flightTime,
      vy: 3.6,
      vz: (targetZ - startZ) / flightTime,
      life: flightTime + 0.15,
    });
  };
  handleThrowGrenadeRef.current = handleThrowGrenade;

  // Airdrop WBC Reinforcements Ability (C-130 plane drops 2 pre-allocated allied paratroopers for 10s flank support)
  const handleAirdropReinforcements = () => {
    if (isMultiplayerDeathmatch) return; // Disabled in Multiplayer Open-World Deathmatch!
    if (reinforceCooldownRef.current > 0 || isAirdropActiveRef.current || !sceneRef.current) return;
    reinforceCooldownRef.current = 25;
    setReinforceCooldown(25);
    isAirdropActiveRef.current = true;
    setIsAirdropActive(true);
    sounds.playRadioChirp();
    sounds.playAirdropPlane();
    triggerBiologyConceptRef.current?.('ally_airdrop_marrow');

    // Hide any lingering prior airdrop elements before starting new flight
    if (airdropRef.current) {
      airdropRef.current.allies.forEach((a) => {
        a.group.visible = false;
      });
      if (airdropRef.current.plane) {
        airdropRef.current.plane.group.visible = false;
      }
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([60, 40, 60]);
    }

    const prebuilt = prebuiltAlliedRef.current;
    if (!prebuilt) return;
    prebuilt.plane.group.position.set(0, 5.2, -65);
    prebuilt.plane.group.visible = true;

    airdropRef.current = {
      plane: { group: prebuilt.plane.group, propellers: prebuilt.plane.propellers },
      planeSpeed: 28.0,
      alliesDropped: false,
      allies: [],
      activeTimer: 10.0,
    };
  };
  handleAirdropReinforcementsRef.current = handleAirdropReinforcements;

  const applyWeaponChange = (nextWpn: Weapon) => {
    currentWeaponRef.current = nextWpn;
    currentAmmoRef.current = nextWpn.magSize;
    reserveAmmoRef.current = nextWpn.totalReserve;
    setCurrentWeapon(nextWpn);
    setCurrentAmmo(nextWpn.magSize);
    setReserveAmmo(nextWpn.totalReserve);
    syncLiveAmmoDom();

    if (!weaponSupportsScope(nextWpn) && isScopedRef.current) {
      isScopedRef.current = false;
      manualScopeLockRef.current = false;
      autoScopedByHoldRef.current = false;
      setIsScoped(false);
    }

    const weaponsMap = prebuiltWeaponsRef.current;
    if (weaponsMap && Object.keys(weaponsMap).length > 0) {
      Object.entries(weaponsMap).forEach(([wId, wData]) => {
        wData.group.visible = wId === nextWpn.id;
      });
      const chosen = weaponsMap[nextWpn.id];
      if (chosen) {
        chosen.group.visible = true;
        activeWeaponSubmeshRef.current = chosen.group;
        pumpSlideRef.current = chosen.pumpSlide || null;
      }
    }
    if (fpsGroupRef.current) fpsGroupRef.current.visible = true;
    if (weaponMeshRef.current) weaponMeshRef.current.visible = true;
  };

  const handleSelectWeapon = (nextWpn: Weapon) => {
    if (nextWpn.id === currentWeaponRef.current.id) {
      // Ensure weapon remains visible even if same key is pressed repeatedly
      if (fpsGroupRef.current) fpsGroupRef.current.visible = true;
      if (weaponMeshRef.current) weaponMeshRef.current.visible = true;
      return;
    }
    // Apply weapon change atomically & immediately so rapid switching never hides or desyncs the character/weapon
    applyWeaponChange(nextWpn);
    weaponSwapAnimRef.current = {
      isSwapping: true,
      phase: 'raising',
      progress: 0.45,
      targetWpn: null,
    };
    if (isMultiplayerDeathmatch) {
      pushLocalMpStateNowRef.current?.();
    }
    sounds.playRadioChirp();
    sounds.triggerHaptic([18, 25], 'medium');
  };
  handleSelectWeaponRef.current = handleSelectWeapon;

  // Quick Weapon Swap in Circular Loop
  const handleSwapWeapon = (direction: 'next' | 'prev' = 'next') => {
    const list = availableWeapons && availableWeapons.length > 0 ? availableWeapons : INITIAL_WEAPONS;
    const currentIdx = list.findIndex((w) => w.id === currentWeaponRef.current.id);
    const step = direction === 'next' ? 1 : -1;
    const nextIdx = (currentIdx + step + list.length) % list.length;
    handleSelectWeapon(list[nextIdx]);
  };
  handleSwapWeaponRef.current = () => handleSwapWeapon('next');

  // MAIN THREE.JS SETUP (Runs ONCE on mount!)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(organTheme.fogColor, 0.012);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      65,
      container.clientWidth / container.clientHeight,
      0.05,
      isMultiplayerDeathmatch ? 230 : 140
    );
    camera.rotation.order = 'YXZ';
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    // 2. WebGL Renderer (Optimized pixelRatio & antialias to eliminate GPU fill-rate frame drops!)
    const renderer = new THREE.WebGLRenderer({
      antialias: window.devicePixelRatio <= 1.25,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.15));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.zIndex = '0';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Lighting Rig
    const ambientLight = new THREE.HemisphereLight(organTheme.ambientColor, 0x18181b, 1.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(organTheme.keyLightColor, 2.5);
    keyLight.position.set(5, 12, 6);
    scene.add(keyLight);

    const frontLight = new THREE.DirectionalLight(0xffffff, 1.2);
    frontLight.position.set(0, 2, 2);
    scene.add(frontLight);

    // 3D Tactical MuzzleFlash Starburst Assembly at Weapon Barrel
    const flashGeo = new THREE.PlaneGeometry(0.44, 0.44);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const muzzleSprite = new THREE.Mesh(flashGeo, flashMat);
    const crossFlashA = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.14), flashMat);
    crossFlashA.rotation.y = Math.PI / 2;
    muzzleSprite.add(crossFlashA);
    const crossFlashB = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.36), flashMat);
    crossFlashB.rotation.x = Math.PI / 2;
    muzzleSprite.add(crossFlashB);
    muzzleSprite.position.set(0, 0.03, -1.24);
    muzzleSpriteRef.current = muzzleSprite;

    // Tactical Black Ops AN/PEQ-15 Dual-Core Laser Sight Beam & Target Lock Ring
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0.35, -0.3, -0.9),
      new THREE.Vector3(0, 0, -45),
    ]);
    const laserMat = new THREE.LineBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
    });
    const laserLine = new THREE.Line(laserGeo, laserMat);
    scene.add(laserLine);
    laserLineRef.current = laserLine;

    const laserGlowGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0.35, -0.295, -0.9),
      new THREE.Vector3(0, 0.01, -45),
    ]);
    const laserGlowMat = new THREE.LineBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
    });
    const laserGlowLine = new THREE.Line(laserGlowGeo, laserGlowMat);
    scene.add(laserGlowLine);
    laserGlowLineRef.current = laserGlowLine;

    const dotGeo = new THREE.SphereGeometry(0.055, 10, 10);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x86efac });
    const laserDot = new THREE.Mesh(dotGeo, dotMat);
    scene.add(laserDot);
    laserDotRef.current = laserDot;

    const ringGeo = new THREE.RingGeometry(0.09, 0.14, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const laserRing = new THREE.Mesh(ringGeo, ringMat);
    scene.add(laserRing);
    laserRingRef.current = laserRing;

    // 4. Organ Cavity Tunnel (Solo Mode only; hidden in Open-World Multiplayer Deathmatch!)
    let wallTexture = organTheme.wallTextureGenerator();
    const wallGeo = new THREE.CylinderGeometry(10.5, 10.5, 140, 24, 1, true);
    wallGeo.rotateX(Math.PI / 2);
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTexture,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.BackSide,
    });
    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.position.set(0, 0, -50);
    wallMesh.visible = !isMultiplayerDeathmatch;
    scene.add(wallMesh);

    // 6. Organ Particles (Soft circular bioluminescent spheres instead of default WebGL squares)
    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * (isMultiplayerDeathmatch ? 84 : 18);
      particlePositions[i + 1] = (Math.random() - 0.5) * 16;
      particlePositions[i + 2] = isMultiplayerDeathmatch ? 18 - Math.random() * 88 : -Math.random() * 90;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleCircleTex = (() => {
      const pCanvas = document.createElement('canvas');
      pCanvas.width = 64;
      pCanvas.height = 64;
      const pCtx = pCanvas.getContext('2d');
      if (pCtx) {
        const grad = pCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.75)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        pCtx.fillStyle = grad;
        pCtx.beginPath();
        pCtx.arc(32, 32, 30, 0, Math.PI * 2);
        pCtx.fill();
      }
      const tex = new THREE.CanvasTexture(pCanvas);
      tex.needsUpdate = true;
      return tex;
    })();
    const particleMat = new THREE.PointsMaterial({
      color: organTheme.particleColor,
      size: organTheme.particleSize * 1.15,
      map: particleCircleTex,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
      opacity: 0.78,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 5. Dynamic Theme-Specific Panicking Cells, Heroic Frowning Defenders & 3D Organ Environment Props
    function buildThemeElements(theme: OrganTheme) {
      organThemeRef.current = theme;

      // Clear & dispose previous theme meshes so GPU buffers never leak when switching organ themes
      panickingRbcsRef.current.forEach((r) => {
        disposeSceneGraph(r.mesh);
        scene.remove(r.mesh);
      });
      panickingPlateletsRef.current.forEach((p) => {
        disposeSceneGraph(p.mesh);
        scene.remove(p.mesh);
      });
      barricadeRefugeesRef.current.forEach((br) => {
        scene.remove(br.mesh);
      });
      barricadeRefugeesRef.current = [];
      heroicAntibodiesRef.current.forEach((a) => {
        disposeSceneGraph(a.mesh);
        scene.remove(a.mesh);
      });
      if (organEnvPropsRef.current) {
        disposeSceneGraph(organEnvPropsRef.current.group);
        scene.remove(organEnvPropsRef.current.group);
        organEnvPropsRef.current = null;
      }
      if (openLungLandscapeRef.current) {
        disposeSceneGraph(openLungLandscapeRef.current.group);
        scene.remove(openLungLandscapeRef.current.group);
        openLungLandscapeRef.current = null;
      }

      if (isMultiplayerDeathmatch) {
        // OPEN-WORLD PULMONARY LUNG & ALVEOLI 20-PLAYER BATTLE ROYALE LANDSCAPE!
        wallMesh.visible = false;
        scene.background = new THREE.Color(0x1b0d24);
        scene.fog = new THREE.FogExp2(0x1b0d24, 0.0042);
        ambientLight.color.setHex(0xfda4af);
        keyLight.color.setHex(0xffe4e6);
        particleMat.color.setHex(0x38bdf8);
        particleMat.size = 0.24;

        const lungLandscape = createOpenLungAlveoliLandscape();
        scene.add(lungLandscape.group);
        openLungLandscapeRef.current = lungLandscape;
        panickingRbcsRef.current = [];
        panickingPlateletsRef.current = [];
        heroicAntibodiesRef.current = [];
        refugeePoolRef.current = [];
        return;
      }

      // Solo Mode: Enclosed Organ Tunnel & Anatomical Props
      wallMesh.visible = true;
      scene.background = new THREE.Color(theme.fogColor);
      scene.fog = new THREE.FogExp2(theme.fogColor, theme.fogDensity);
      ambientLight.color.setHex(theme.ambientColor);
      keyLight.color.setHex(theme.keyLightColor);
      particleMat.color.setHex(theme.particleColor);
      particleMat.size = theme.particleSize;

      const nextTex = theme.wallTextureGenerator();
      wallMat.map = nextTex;
      wallMat.needsUpdate = true;
      wallTexture = nextTex;

      // 5a. Spawn 3D Organ Wall & Floor Anatomical Props (Cilia & Mucus, Smooth Muscle & Acid, Microvilli & Bile, or Neurones)
      const envProps = createOrganEnvironmentProps(theme.id);
      scene.add(envProps.group);
      organEnvPropsRef.current = envProps;

      // 5b. Spawn Theme-Specific Panicking Cells in visible left/right flank lanes (2 lightweight cells)
      panickingRbcsRef.current = [];
      for (let i = 0; i < 2; i++) {
        const cellData =
          theme.id === 'alveoli'
            ? createPanickingGobletCell()
            : theme.id === 'stomach'
            ? createPanickingDigestiveCell(false)
            : theme.id === 'intestine'
            ? createPanickingDigestiveCell(true)
            : theme.id === 'brain'
            ? createPanickingNeuroneCell()
            : createPanickingRbc();

        cellData.group.scale.set(0.72, 0.72, 0.72);
        const side = i % 2 === 0 ? -1 : 1;
        cellData.group.position.set(
          side * (3.15 + (i % 2) * 0.65),
          -1.45 - (i % 2) * 0.35,
          -12 - i * 18
        );
        scene.add(cellData.group);
        panickingRbcsRef.current.push({
          mesh: cellData.group,
          lArm: cellData.lArm,
          rArm: cellData.rArm,
          lLeg: cellData.lLeg,
          rLeg: cellData.rLeg,
          speed: 6.2 + (i % 3) * 1.4,
          trembleSeed: i * 11.5 + 3,
          side,
        });
      }

      // 5c. Spawn 2 Panicking Platelets across Organ Themes
      panickingPlateletsRef.current = [];
      const plateletCries = ['HELP! PLATELETS!', 'NEED FIBRIN!'];
      for (let i = 0; i < 2; i++) {
        const plData = createPlateletModel(plateletCries[i % plateletCries.length]);
        const side = i % 2 === 0 ? -1 : 1;
        plData.group.position.set(
          side * (2.35 + (i % 2) * 0.78),
          -1.58 - (i % 2) * 0.28,
          -9 - i * 16
        );
        scene.add(plData.group);
        panickingPlateletsRef.current.push({
          mesh: plData.group,
          lArm: plData.lArm,
          rArm: plData.rArm,
          speed: 6.8 + (i % 3) * 1.5,
          trembleSeed: i * 9.3 + 1,
          side,
        });
      }

      // 5d. Spawn 3 Heroic Frowning Defenders strictly in OUTER FLANK LANES
      heroicAntibodiesRef.current = [];
      for (let i = 0; i < 3; i++) {
        const defenderData =
          theme.id === 'alveoli'
            ? createHeroicMacrophageModel(false)
            : theme.id === 'stomach' || theme.id === 'intestine'
            ? createHeroicMacrophageModel(true)
            : theme.id === 'brain'
            ? createHeroicDendriticCellModel()
            : createHeroicAntibodyModel();

        const laneX = (i % 2 === 0 ? -1 : 1) * (3.85 + (i % 3) * 0.48);
        const laneY = -1.35 + (i % 3) * 0.65;
        defenderData.group.position.set(laneX, laneY, -6.5 - i * 9.5);
        defenderData.group.rotation.y = laneX > 0 ? 0.25 : -0.25;
        scene.add(defenderData.group);
        heroicAntibodiesRef.current.push({
          mesh: defenderData.group,
          baseY: laneY,
          speed: 10.5 + (i % 3) * 2.0,
          trembleSeed: i * 4.2 + 1.5,
        });
      }

      // 5e. Pre-pool 2 Barricade Refugee meshes (1 Platelet + 1 Organ Cell) so mid-combat hiding scenes never allocate CanvasTextures!
      refugeePoolRef.current.forEach((item) => scene.remove(item.mesh));
      refugeePoolRef.current = [];
      const refugeeBadges = ['HIDING IN BUNKER!', 'COVER US WBC!'];
      for (let pIdx = 0; pIdx < 2; pIdx++) {
        if (pIdx === 0) {
          const plData = createPlateletModel(refugeeBadges[pIdx]);
          plData.group.visible = false;
          scene.add(plData.group);
          refugeePoolRef.current.push({
            mesh: plData.group,
            lArm: plData.lArm,
            rArm: plData.rArm,
            isPlatelet: true,
            inUse: false,
          });
        } else {
          const cellData =
            theme.id === 'alveoli'
              ? createPanickingGobletCell()
              : theme.id === 'stomach'
              ? createPanickingDigestiveCell(false)
              : theme.id === 'intestine'
              ? createPanickingDigestiveCell(true)
              : theme.id === 'brain'
              ? createPanickingNeuroneCell()
              : createPanickingRbc();
          cellData.group.scale.set(0.68, 0.68, 0.68);
          cellData.group.visible = false;
          scene.add(cellData.group);
          refugeePoolRef.current.push({
            mesh: cellData.group,
            lArm: cellData.lArm,
            rArm: cellData.rArm,
            lLeg: cellData.lLeg,
            rLeg: cellData.rLeg,
            isPlatelet: false,
            inUse: false,
          });
        }
      }
    }

    buildThemeElements(organThemeRef.current);
    rebuildOrganThemeRef.current = buildThemeElements;

    // 7. FPS White Blood Cell Arms & Pre-Built All 4 Fortnite-Style Weapons (Zero weapon-swap shader stall!)
    const fpsGroup = new THREE.Group();
    const leukocyteArms = createLeukocyteFPSArms(currentWeaponRef.current.color);
    fpsGroup.add(leukocyteArms);

    const weaponsMap: Record<string, { group: THREE.Group; pumpSlide?: THREE.Mesh }> = {};
    INITIAL_WEAPONS.forEach((w) => {
      const model = createFortniteWeaponModel(w.id, w.color);
      model.group.visible = w.id === currentWeaponRef.current.id;
      fpsGroup.add(model.group);
      weaponsMap[w.id] = { group: model.group, pumpSlide: model.pumpSlide };
    });
    prebuiltWeaponsRef.current = weaponsMap;
    const initialWeaponModel = weaponsMap[currentWeaponRef.current.id] || Object.values(weaponsMap)[0];
    activeWeaponSubmeshRef.current = initialWeaponModel.group;
    pumpSlideRef.current = initialWeaponModel.pumpSlide || null;

    fpsGroup.add(muzzleSprite);
    fpsGroup.rotation.order = 'YXZ';
    fpsGroup.position.set(0.34, -0.33, -0.82);
    camera.add(fpsGroup);
    scene.add(camera);
    weaponMeshRef.current = fpsGroup;
    fpsGroupRef.current = fpsGroup;

    // 8. TACTICAL SANDBAG BARRICADES (Solo Mode) & DESTRUCTIBLE ANATOMICAL BIO-COVER STRUCTURES (Multiplayer 20-Player Arena)
    barricadesRef.current = [];
    if (!isMultiplayerDeathmatch) {
      const barricadeConfigs = [
        { x: -2.6, y: -0.92, z: -2.4 },
        { x: 0, y: -0.92, z: -2.4 },
        { x: 2.6, y: -0.92, z: -2.4 },
      ];
      barricadeConfigs.forEach((cfg) => {
        const bObj = createSandbagBarricade();
        bObj.group.position.set(cfg.x, cfg.y, cfg.z);
        scene.add(bObj.group);
        barricadesRef.current.push({
          group: bObj.group,
          hpBarFill: bObj.hpBarFill,
          x: cfg.x,
          y: cfg.y,
          z: cfg.z,
          hp: 70,
          maxHp: 70,
          respawnTimer: 0,
          bounds: bObj.bounds,
        });
      });
    } else {
      // 10 Destructible Anatomical Cover Structures across the wide 20-player Lung & Alveoli Landscape
      // Anchored at y = -1.18 so their base pads (-0.54m) sit 100% flush on the -1.72 arena ground plane (and outside all buildings!)
      const anatomicalCoverConfigs = [
        { x: -13.5, y: -1.18, z: -4.2 },
        { x: 0, y: -1.18, z: -3.8 },
        { x: 13.5, y: -1.18, z: -4.2 },
        { x: -22.5, y: -1.18, z: -13.5 },
        { x: -7.5, y: -1.18, z: -12.5 },
        { x: 7.5, y: -1.18, z: -12.5 },
        { x: 22.5, y: -1.18, z: -13.5 },
        { x: -15.5, y: -1.18, z: -24.0 },
        { x: 0, y: -1.18, z: -10.5 },
        { x: 15.5, y: -1.18, z: -24.0 },
      ];
      anatomicalCoverConfigs.forEach((cfg, idx) => {
        const bioCover = createAnatomicalCoverCluster(idx);
        bioCover.group.position.set(cfg.x, cfg.y, cfg.z);
        scene.add(bioCover.group);
        barricadesRef.current.push({
          group: bioCover.group,
          hpBarFill: bioCover.hpBarFill,
          x: cfg.x,
          y: cfg.y,
          z: cfg.z,
          hp: 95,
          maxHp: 95,
          respawnTimer: 0,
          bounds: bioCover.bounds,
        });
      });
    }

    // 9. BIOLOGICAL POWER-UP POOL (Pre-allocated zero-GC drops: ATP Overcharge & Immunoglobulin Shield)
    activeBiologicalDropsRef.current = [];
    const bioDropPoolSize = 8;
    for (let bi = 0; bi < bioDropPoolSize; bi++) {
      const dropType: 'atp' | 'shield' = bi % 2 === 0 ? 'atp' : 'shield';
      const dropMesh = createBiologicalPowerUpMesh(dropType);
      dropMesh.visible = false;
      scene.add(dropMesh);
      activeBiologicalDropsRef.current.push({
        id: bi + 1,
        type: dropType,
        mesh: dropMesh,
        active: false,
        x: 0,
        y: 0,
        z: 0,
        bobPhase: bi * 1.5,
      });
    }

    const spawnBiologicalDrop = (x: number, z: number, prefType?: 'atp' | 'shield', yOverride?: number) => {
      const drop = activeBiologicalDropsRef.current.find((d) => !d.active);
      if (!drop) return;
      const targetType = prefType || (Math.random() > 0.5 ? 'atp' : 'shield');
      drop.type = targetType;
      drop.x = x;
      drop.z = z;
      const elevY = yOverride !== undefined ? yOverride : getArenaSurfaceElevation(x, z, 0).elevationY;
      drop.y = elevY + 0.35;
      drop.mesh.position.set(drop.x, drop.y, drop.z);
      drop.mesh.visible = true;
      drop.active = true;
    };
    spawnBiologicalDropRef.current = spawnBiologicalDrop;

    // Pre-seed 2 tactical power-up drops on High Grounds (Bunker Rooftop & Watchtower Platform) to reward climbing!
    if (isMultiplayerDeathmatch) {
      spawnBiologicalDrop(0, -22.0, 'shield', 4.35);
      spawnBiologicalDrop(14.0, -11.0, 'atp', 3.45);
    }

    // Helper to attach a compact 3D floating health bar to Tanks and Bosses
    function attachCompactHpBar(parent: THREE.Group, yOffset: number): THREE.Mesh {
      const hpBarGroup = new THREE.Group();
      hpBarGroup.position.set(0, yOffset, 0);

      const hpBgGeo = new THREE.PlaneGeometry(0.86, 0.1);
      const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x09090b, side: THREE.DoubleSide });
      const hpBg = new THREE.Mesh(hpBgGeo, hpBgMat);
      hpBarGroup.add(hpBg);

      const hpFillGeo = new THREE.PlaneGeometry(0.82, 0.068);
      const hpFillMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
      const hpBarFill = new THREE.Mesh(hpFillGeo, hpFillMat);
      hpBarFill.position.z = 0.01;
      hpBarGroup.add(hpBarFill);

      parent.add(hpBarGroup);
      return hpBarFill;
    }

    // Helper: Build a 3D Hostile Military Parachute Canopy + Rigging Cords for Enemy Troop & Tank Airdrops
    function createEnemyParachute(isHeavyTank: boolean): THREE.Group {
      const pGroup = new THREE.Group();
      const canopyRadius = isHeavyTank ? 1.75 : 1.12;
      const canopyY = isHeavyTank ? 2.15 : 1.55;

      const canopyGeo = new THREE.SphereGeometry(
        canopyRadius,
        10,
        6,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.55
      );
      const canopyMat = new THREE.MeshStandardMaterial({
        color: isHeavyTank ? 0x991b1b : 0x3f6212,
        emissive: isHeavyTank ? 0x450a0a : 0x1a2e05,
        emissiveIntensity: 0.45,
        roughness: 0.55,
        side: THREE.DoubleSide,
      });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.set(0, canopyY, 0);
      pGroup.add(canopy);

      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(canopyRadius * 0.72, canopyRadius * 0.98, 0.22, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: isHeavyTank ? 0xfbbf24 : 0xef4444, side: THREE.DoubleSide })
      );
      band.position.set(0, canopyY + canopyRadius * 0.18, 0);
      pGroup.add(band);

      const cordMat = new THREE.MeshBasicMaterial({ color: 0xf4f4f5 });
      const cordGeo = new THREE.CylinderGeometry(0.018, 0.018, canopyY, 4);
      [
        [-0.65, -0.45],
        [0.65, -0.45],
        [-0.65, 0.45],
        [0.65, 0.45],
      ].forEach(([cx, cz]) => {
        const cord = new THREE.Mesh(cordGeo, cordMat);
        cord.position.set(cx * canopyRadius * 0.55, canopyY * 0.5, cz * canopyRadius * 0.55);
        cord.rotation.z = cx * -0.24;
        cord.rotation.x = cz * 0.22;
        pGroup.add(cord);
      });

      return pGroup;
    }

    // ============================================================================
    // OBJECT POOLS FOR ENEMIES, BOSSES, AIRCRAFT, PROJECTILES & DEBRIS PARTICLES
    // Pre-allocated and attached to scene so mid-combat spawning causes ZERO GC or shader compilation spikes!
    // ============================================================================
    interface PooledEnemySlot {
      inUse: boolean;
      type: 'strep' | 'bacillus' | 'tank';
      group: THREE.Group;
      leftLeg?: THREE.Group;
      rightLeg?: THREE.Group;
      leftArm?: THREE.Group;
      rightArm?: THREE.Group;
      scopeGlint?: THREE.Mesh;
      turret?: THREE.Group;
      cannon?: THREE.Mesh;
      hpBarFill: THREE.Mesh;
      parachuteGroup: THREE.Group;
      stasisCage?: THREE.Group;
      callsignCanvas?: HTMLCanvasElement;
      callsignTexture?: THREE.CanvasTexture;
    }

    const enemyPool: PooledEnemySlot[] = [];

    function allocateEnemyPoolSlot(eType: 'strep' | 'bacillus' | 'tank'): PooledEnemySlot {
      let group: THREE.Group;
      let leftLeg: THREE.Group | undefined;
      let rightLeg: THREE.Group | undefined;
      let leftArm: THREE.Group | undefined;
      let rightArm: THREE.Group | undefined;
      let scopeGlint: THREE.Mesh | undefined;
      let turret: THREE.Group | undefined;
      let cannon: THREE.Mesh | undefined;
      let hpBarFill: THREE.Mesh;
      let stasisCage: THREE.Group | undefined;
      let callsignCanvas: HTMLCanvasElement | undefined;
      let callsignTexture: THREE.CanvasTexture | undefined;

      if (isMultiplayerDeathmatch) {
        const studentOp = createMultiplayerStudentOperator(enemyPool.length);
        group = studentOp.group;
        leftLeg = studentOp.leftLeg;
        rightLeg = studentOp.rightLeg;
        leftArm = studentOp.leftArm;
        rightArm = studentOp.rightArm;
        scopeGlint = studentOp.scopeGlint;
        stasisCage = studentOp.stasisCage;
        callsignCanvas = studentOp.callsignCanvas;
        callsignTexture = studentOp.callsignTexture;
        hpBarFill = attachCompactHpBar(group, 1.44);
      } else if (eType === 'tank') {
        const tankData = createBacteriaTank();
        group = tankData.group;
        group.scale.set(1.18, 1.18, 1.18);
        turret = tankData.turret;
        cannon = tankData.cannon;
        hpBarFill = attachCompactHpBar(group, 1.85);
      } else if (eType === 'bacillus') {
        const heavyData = createBacillusSoldier();
        group = heavyData.group;
        leftLeg = heavyData.leftLeg;
        rightLeg = heavyData.rightLeg;
        leftArm = heavyData.leftArm;
        rightArm = heavyData.rightArm;
        scopeGlint = heavyData.scopeGlint;
        hpBarFill = attachCompactHpBar(group, 1.62);
      } else {
        const trooperData = createStreptococcusSoldier();
        group = trooperData.group;
        leftLeg = trooperData.leftLeg;
        rightLeg = trooperData.rightLeg;
        leftArm = trooperData.leftArm;
        rightArm = trooperData.rightArm;
        scopeGlint = trooperData.scopeGlint;
        hpBarFill = attachCompactHpBar(group, 1.48);
      }

      const parachuteGroup = createEnemyParachute(eType === 'tank' && !isMultiplayerDeathmatch);
      parachuteGroup.visible = false;
      group.add(parachuteGroup);
      group.visible = false;
      scene.add(group);

      const slot: PooledEnemySlot = {
        inUse: false,
        type: eType,
        group,
        leftLeg,
        rightLeg,
        leftArm,
        rightArm,
        scopeGlint,
        turret,
        cannon,
        hpBarFill,
        parachuteGroup,
        stasisCage,
        callsignCanvas,
        callsignTexture,
      };
      enemyPool.push(slot);
      return slot;
    }

    function resetAndActivatePoolSlot(slot: PooledEnemySlot): PooledEnemySlot {
      slot.inUse = true;
      slot.group.visible = true;
      slot.group.rotation.set(0, 0, 0);
      slot.group.scale.setScalar(slot.type === 'tank' && !isMultiplayerDeathmatch ? 1.18 : 1.0);
      slot.hpBarFill.scale.set(1, 1, 1);
      slot.hpBarFill.position.x = 0;
      if (slot.parachuteGroup) slot.parachuteGroup.visible = false;
      if (slot.leftLeg) slot.leftLeg.rotation.set(0, 0, 0);
      if (slot.rightLeg) slot.rightLeg.rotation.set(0, 0, 0);
      if (slot.leftArm) {
        slot.leftArm.rotation.set(0, 0, 0);
      }
      if (slot.rightArm) {
        slot.rightArm.rotation.set(0, 0, 0);
      }
      if (slot.turret) slot.turret.rotation.set(0, 0, 0);
      if (slot.cannon) {
        slot.cannon.position.z = 0;
        slot.cannon.rotation.set(0, 0, 0);
      }
      if (slot.scopeGlint) (slot.scopeGlint.material as THREE.MeshBasicMaterial).opacity = 0;
      if (slot.stasisCage) slot.stasisCage.visible = false;
      return slot;
    }

    function acquireEnemyFromPool(eType: 'strep' | 'bacillus' | 'tank'): PooledEnemySlot {
      // 1. Exact type match from free pool
      for (let i = 0; i < enemyPool.length; i++) {
        const slot = enemyPool[i];
        if (!slot.inUse && slot.type === eType) {
          return resetAndActivatePoolSlot(slot);
        }
      }
      // 2. Any free slot in pool (never compile new shaders mid-combat!)
      for (let i = 0; i < enemyPool.length; i++) {
        const slot = enemyPool[i];
        if (!slot.inUse) {
          return resetAndActivatePoolSlot(slot);
        }
      }
      // 3. Recycle oldest slot safely (remove any live soldier using this mesh first so two entries never share a Group!)
      const recycled = enemyPool[0];
      const existingIdx = activeSoldiersRef.current.findIndex((s) => s.mesh === recycled.group);
      if (existingIdx !== -1) {
        activeSoldiersRef.current.splice(existingIdx, 1);
      }
      return resetAndActivatePoolSlot(recycled);
    }

    function releaseSoldierToPool(soldier: ActiveSoldier) {
      soldier.mesh.visible = false;
      if (soldier.parachuteGroup) soldier.parachuteGroup.visible = false;
      if (soldier.stasisCage) soldier.stasisCage.visible = false;
      for (let i = 0; i < enemyPool.length; i++) {
        if (enemyPool[i].group === soldier.mesh) {
          enemyPool[i].inUse = false;
          return;
        }
      }
    }

    // Pre-allocate Fixed Enemy Object Pool (8 Strep + 4 Bacillus in Multiplayer for fast startup and zero frame stutter!)
    const strepPoolCount = isMultiplayerDeathmatch ? 8 : 8;
    const bacillusPoolCount = isMultiplayerDeathmatch ? 4 : 6;
    const tankPoolCount = isMultiplayerDeathmatch ? 0 : 4;
    for (let i = 0; i < strepPoolCount; i++) allocateEnemyPoolSlot('strep');
    for (let i = 0; i < bacillusPoolCount; i++) allocateEnemyPoolSlot('bacillus');
    for (let i = 0; i < tankPoolCount; i++) allocateEnemyPoolSlot('tank');

    // Pre-allocate Multiplayer Supply Helicopter, Beacon, Cargo Net & Super Crate at startup so zero mid-game shader compilation occurs!
    if (isMultiplayerDeathmatch) {
      const dropState = supplyDropStateRef.current;
      const bObj = createSupplyPingBeaconMesh();
      bObj.group.visible = false;
      scene.add(bObj.group);
      dropState.beaconMesh = bObj.group;

      const chopperObj = createSupplyTransportHelicopter();
      chopperObj.group.scale.set(2.35, 2.35, 2.35);
      chopperObj.group.visible = false;
      scene.add(chopperObj.group);
      dropState.chopperMesh = chopperObj.group;
      dropState.chopperRotor = chopperObj.mainRotor;
      dropState.chopperTailRotor = chopperObj.tailRotor;
      dropState.chopperSlungNet = chopperObj.slungCargoNet;

      const netObj = createSupplyCargoNetMesh('burning_bullets');
      netObj.group.visible = false;
      scene.add(netObj.group);
      dropState.cargoNetMesh = netObj.group;

      const crateObj = createBiologicalPowerUpMesh('atp');
      crateObj.visible = false;
      scene.add(crateObj);
      dropState.crateMesh = crateObj;
    }

    // Pre-allocate Allied Reinforcements & Grenade Pool at startup so [T] and [G] never compile shaders mid-combat!
    {
      const allyPlane = createTacticalAirdropPlane();
      allyPlane.group.visible = false;
      scene.add(allyPlane.group);

      const savedProfile = loadStudentProfile();
      const playerCalloutName = savedProfile?.name || 'COMMANDER';

      const leftAlly = createAlliedWBCCommando(true, playerCalloutName);
      leftAlly.group.visible = false;
      scene.add(leftAlly.group);

      const rightAlly = createAlliedWBCCommando(false, playerCalloutName);
      rightAlly.group.visible = false;
      scene.add(rightAlly.group);

      prebuiltAlliedRef.current = { plane: allyPlane, leftAlly, rightAlly };

      grenadePoolRef.current = [];
      for (let gIdx = 0; gIdx < 2; gIdx++) {
        const gMesh = createGrenadeModel();
        gMesh.visible = false;
        scene.add(gMesh);
        grenadePoolRef.current.push(gMesh);
      }
    }

    // Pre-build the Phase Boss & Aircraft Pools so boss/plane appearance never stalls mobile frames!
    const prebuiltBosses: {
      helicopter?: ReturnType<typeof createBacteriaHelicopter> & { hpBarFill: THREE.Mesh };
      robot?: ReturnType<typeof createBioMechRobot> & { hpBarFill: THREE.Mesh };
      jet?: ReturnType<typeof createF16FighterJet> & { hpBarFill: THREE.Mesh };
    } = {};

    if (!isMultiplayerDeathmatch) {
      if (phaseNumber === 1) {
        const heli = createBacteriaHelicopter();
        heli.group.scale.set(1.28, 1.28, 1.28);
        const hpBarFill = attachCompactHpBar(heli.group, 1.55);
        heli.group.visible = false;
        scene.add(heli.group);
        prebuiltBosses.helicopter = { ...heli, hpBarFill };
      } else if (phaseNumber === 2) {
        const robot = createBioMechRobot();
        robot.group.scale.set(1.32, 1.32, 1.32);
        const hpBarFill = attachCompactHpBar(robot.group, 3.35);
        robot.group.visible = false;
        scene.add(robot.group);
        prebuiltBosses.robot = { ...robot, hpBarFill };
      } else {
        const jet = createF16FighterJet();
        jet.group.scale.set(1.42, 1.42, 1.42);
        const hpBarFill = attachCompactHpBar(jet.group, 1.25);
        jet.group.visible = false;
        scene.add(jet.group);
        prebuiltBosses.jet = { ...jet, hpBarFill };
      }
    }

    // Pre-allocated Aircraft Pools (1 C-47 Airdrop Plane, 1 Blériot WW2 Bomber — never allocate mid-combat)
    const airdropPlanePool: Array<{
      inUse: boolean;
      group: THREE.Group;
      propellers: THREE.Mesh[];
    }> = [];
    {
      const p = createTacticalAirdropPlane();
      p.group.visible = false;
      scene.add(p.group);
      airdropPlanePool.push({ inUse: false, group: p.group, propellers: p.propellers });
    }
    function acquireAirdropPlane() {
      for (const item of airdropPlanePool) {
        if (!item.inUse) {
          item.inUse = true;
          item.group.visible = true;
          return item;
        }
      }
      const fallback = airdropPlanePool[0];
      fallback.inUse = true;
      fallback.group.visible = true;
      return fallback;
    }
    function releaseAirdropPlane(group: THREE.Group) {
      group.visible = false;
      for (const item of airdropPlanePool) {
        if (item.group === group) {
          item.inUse = false;
          return;
        }
      }
    }

    const bleriotPlanePool: Array<{
      inUse: boolean;
      group: THREE.Group;
      propeller: THREE.Group;
    }> = [];
    {
      const b = createBleriotPlane();
      b.group.visible = false;
      scene.add(b.group);
      bleriotPlanePool.push({ inUse: false, group: b.group, propeller: b.propeller });
    }
    function acquireBleriotPlane() {
      for (const item of bleriotPlanePool) {
        if (!item.inUse) {
          item.inUse = true;
          item.group.visible = true;
          return item;
        }
      }
      const fallback = bleriotPlanePool[0];
      fallback.inUse = true;
      fallback.group.visible = true;
      return fallback;
    }
    function releaseBleriotPlane(group: THREE.Group) {
      group.visible = false;
      for (const item of bleriotPlanePool) {
        if (item.group === group) {
          item.inUse = false;
          return;
        }
      }
    }

    // BOSS SPAWN FUNCTION (Acquires pre-built Boss from pool — zero mid-combat allocation!)
    function spawnPhaseBoss(customType?: 'helicopter' | 'robot' | 'jet') {
      if (isMultiplayerDeathmatch) return; // No AI Bosses in Multiplayer Deathmatch!
      const bossType: 'helicopter' | 'robot' | 'jet' =
        customType || (phaseNumber === 1 ? 'helicopter' : phaseNumber === 2 ? 'robot' : 'jet');
      if (bossSpawnedRef.current[bossType]) return;
      bossSpawnedRef.current[bossType] = true;

      let bossMesh: THREE.Group;
      let name = '';
      let hits = 14;
      let hp = 560;
      let speed = 2.5;
      let value = 1000;
      let mainRotor: THREE.Group | undefined;
      let tailRotor: THREE.Group | undefined;
      let leftLeg: THREE.Group | undefined;
      let rightLeg: THREE.Group | undefined;
      let gatling: THREE.Group | undefined;
      let coreMesh: THREE.Mesh | undefined;
      let afterburnerMesh: THREE.Mesh | undefined;
      let hpBarFill: THREE.Mesh | undefined;

      const levelIndex = levelNumber - 1;
      const phaseIndex = phaseNumber - 1;
      if (bossType === 'helicopter') {
        const heli = prebuiltBosses.helicopter || (() => {
          const h = createBacteriaHelicopter();
          h.group.scale.set(1.28, 1.28, 1.28);
          const fill = attachCompactHpBar(h.group, 1.55);
          scene.add(h.group);
          return { ...h, hpBarFill: fill };
        })();
        bossMesh = heli.group;
        bossMesh.visible = true;
        mainRotor = heli.mainRotor;
        tailRotor = heli.tailRotor;
        name = 'Apache Attack Helicopter';
        // 12 normal SCAR shots or 4 headshots (3:1 headshot scale)
        hits = 12;
        hp = hits * 38;
        speed = 2.9 + levelIndex * 0.18 + phaseIndex * 0.2;
        value = 950 + levelIndex * 120 + phaseIndex * 150;
        bossMesh.position.set(0, 1.15, -21);
        hpBarFill = heli.hpBarFill;
        hpBarFill.scale.set(1, 1, 1);
        hpBarFill.position.x = 0;
        sounds.playHelicopterRotor();
      } else if (bossType === 'robot') {
        const robot = prebuiltBosses.robot || (() => {
          const r = createBioMechRobot();
          r.group.scale.set(1.32, 1.32, 1.32);
          const fill = attachCompactHpBar(r.group, 3.35);
          scene.add(r.group);
          return { ...r, hpBarFill: fill };
        })();
        bossMesh = robot.group;
        bossMesh.visible = true;
        leftLeg = robot.leftLeg;
        rightLeg = robot.rightLeg;
        gatling = robot.gatling;
        coreMesh = robot.coreMesh;
        name = 'Huge Cyber-Robot Titan';
        // 15 normal SCAR shots or 5 headshots (3:1 headshot scale)
        hits = 15;
        hp = hits * 38;
        speed = 2.6 + levelIndex * 0.16 + phaseIndex * 0.18;
        value = 1350 + levelIndex * 140 + phaseIndex * 200;
        bossMesh.position.set(0, -1.5, -23);
        hpBarFill = robot.hpBarFill;
        hpBarFill.scale.set(1, 1, 1);
        hpBarFill.position.x = 0;
        sounds.playRobotStep();
      } else {
        const jet = prebuiltBosses.jet || (() => {
          const j = createF16FighterJet();
          j.group.scale.set(1.42, 1.42, 1.42);
          const fill = attachCompactHpBar(j.group, 1.25);
          scene.add(j.group);
          return { ...j, hpBarFill: fill };
        })();
        bossMesh = jet.group;
        bossMesh.visible = true;
        afterburnerMesh = jet.afterburnerMesh;
        name = 'Rogue Bio-Jet F-16';
        // 18 normal SCAR shots or 6 headshots (3:1 headshot scale)
        hits = 18;
        hp = hits * 38;
        speed = 3.9 + levelIndex * 0.18 + phaseIndex * 0.2;
        value = 1700 + levelIndex * 160 + phaseIndex * 250;
        bossMesh.position.set(0, 1.25, -34);
        hpBarFill = jet.hpBarFill;
        hpBarFill.scale.set(1, 1, 1);
        hpBarFill.position.x = 0;
        sounds.playJetFlyby();
      }

      setBossInfo({ name, hitsLeft: hits, maxHits: hits });

      const now = performance.now();
      const bossSoldier: ActiveSoldier = {
        id: nextEnemyIdRef.current++,
        type: bossType,
        name,
        mesh: bossMesh,
        mainRotor,
        tailRotor,
        leftLeg,
        rightLeg,
        gatling,
        coreMesh,
        afterburnerMesh,
        hitsLeft: hits,
        maxHits: hits,
        hp,
        maxHp: hp,
        speed,
        value,
        isBoss: true,
        isTank: false,
        isHelicopter: bossType === 'helicopter',
        isRobot: bossType === 'robot',
        isJet: bossType === 'jet',
        walkOffset: Math.random() * 10,
        lastShootTime: now + 700,
        hpBarFill,
        dodgeOffsetX: 0,
        dodgeOffsetY: 0,
        dodgeTargetX: (Math.random() < 0.5 ? -1 : 1) * 1.4,
        dodgeTargetY: 0.18,
        nextDodgeTime: now + 1500,
        lastRocketTime: now + 2200,
      };

      activeSoldiersRef.current.push(bossSoldier);
      triggerBiologyConceptRef.current?.('enemy_boss_virus');
      const bossVoip = voipManager.triggerEventVoip('boss_detected', organThemeRef.current.id);
      if (bossVoip) {
        setOrganRadioComm(bossVoip);
        setTimeout(() => {
          setOrganRadioComm((prev) => (prev === bossVoip ? null : prev));
        }, 4800);
      }
    }

    // Object pool for 3D Cell Membrane Ripples & Biochemical Portals (visual enemy spawn telegraphing)
    const spawnRippleGeo = new THREE.RingGeometry(0.12, 1.45, 24);
    spawnRippleGeo.rotateX(-Math.PI / 2);
    const spawnRippleMatCyan = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    const spawnRipplePool: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number; maxLife: number }> = [];
    for (let i = 0; i < 10; i++) {
      const mat = spawnRippleMatCyan.clone();
      const m = new THREE.Mesh(spawnRippleGeo, mat);
      m.visible = false;
      scene.add(m);
      spawnRipplePool.push({ mesh: m, mat, life: 0, maxLife: 0.65 });
    }

    function triggerSpawnRipple(x: number, y: number, z: number, isTank: boolean = false) {
      const slot = spawnRipplePool.find((r) => !r.mesh.visible) || spawnRipplePool[0];
      slot.mesh.position.set(x, y, z);
      slot.mesh.scale.set(0.2, 0.2, 0.2);
      slot.mat.color.setHex(isTank ? 0xf97316 : 0x38bdf8);
      slot.mat.opacity = 0.9;
      slot.life = 0.65;
      slot.maxLife = 0.65;
      slot.mesh.visible = true;
    }

    // SPAWNER FUNCTION (Acquires pre-built Enemies & Tanks from enemyPool!)
    function getWaveNumber(): 1 | 2 | 3 {
      if (timeLeftRef.current > 40) return 1;
      if (timeLeftRef.current > 20) return 2;
      return 3;
    }

    function spawnSoldierOrTank(
      customZ?: number,
      forceType?: 'tank' | 'bacillus' | 'strep',
      customX?: number,
      isParachuteDrop: boolean = false,
      remotePlayer?: LiveArenaPlayer
    ) {
      // In Multiplayer Deathmatch: ZERO BOTS! Only real connected human players (remotePlayer) may be spawned!
      if (isMultiplayerDeathmatch && !remotePlayer) return;

      const wave = getWaveNumber();
      const levelIndex = levelNumber - 1; // 0..4
      const phaseIndex = phaseNumber - 1; // 0..2
      const diffScale = (levelIndex * 3 + phaseIndex) / 26;

      const activeTanks = activeSoldiersRef.current.filter((s) => s.isTank).length;
      const maxTanksAllowed =
        wave === 1
          ? phaseNumber >= 2 || levelNumber >= 2
            ? 1
            : 0
          : wave === 2
          ? 1 + (levelNumber >= 4 || phaseNumber >= 2 ? 1 : 0)
          : 1 + (levelNumber >= 3 ? 1 : 0);
      const tankChance =
        wave === 1
          ? phaseNumber >= 2 || levelNumber >= 2
            ? 0.16 + levelIndex * 0.015
            : 0
          : wave === 2
          ? 0.22 + diffScale * 0.14
          : 0.28 + diffScale * 0.15;
      const shouldSpawnTank =
        !isMultiplayerDeathmatch &&
        (forceType === 'tank' ||
          (!forceType && activeTanks < maxTanksAllowed && Math.random() < tankChance));

      const bacillusChance = Math.min(
        0.78,
        (wave === 1 ? 0.28 : wave === 2 ? 0.44 : 0.55) + levelIndex * 0.03 + phaseIndex * 0.05
      );

      const waveSpeedBase = wave === 1 ? 4.0 : wave === 2 ? 4.55 : 5.0;
      const difficultySpeedBonus = levelIndex * 0.16 + phaseIndex * 0.24;

      let hp = 114;
      let hitsLeft = 3;
      let speed = waveSpeedBase + difficultySpeedBonus;
      let value = 100;
      let name = 'Strepto Soldier';
      let isTank = false;
      let type: 'strep' | 'bacillus' | 'tank' = 'strep';

      const soldierId = nextEnemyIdRef.current++;

      if (isMultiplayerDeathmatch) {
        type = soldierId % 2 === 0 ? 'strep' : 'bacillus';
        hitsLeft = 3;
        hp = remotePlayer ? Math.max(10, remotePlayer.hp) : 100;
        speed = 5.4;
        value = 250;
        name = remotePlayer ? remotePlayer.studentName : 'Operative';
      } else if (shouldSpawnTank) {
        type = 'tank';
        // 6 normal SCAR shots or 2 headshots!
        hitsLeft = 6;
        hp = 6 * 38;
        speed = 2.5 + wave * 0.22 + levelIndex * 0.09 + phaseIndex * 0.15;
        value = 750 + levelIndex * 65 + phaseIndex * 80;
        name = 'Heavy Bio-Battle Tank';
        isTank = true;
      } else if (forceType === 'bacillus' || (!forceType && Math.random() < bacillusChance)) {
        type = 'bacillus';
        // 3 normal SCAR shots or 1 headshot (instant kill)!
        hitsLeft = 3;
        hp = 3 * 38;
        speed = waveSpeedBase + difficultySpeedBonus - 0.2;
        value = 150 + levelIndex * 18 + phaseIndex * 25;
        name = 'Bacillus Heavy Gunner';
      } else {
        type = 'strep';
        // 3 normal SCAR shots or 1 headshot (instant kill)!
        hitsLeft = 3;
        hp = 3 * 38;
        speed = waveSpeedBase + difficultySpeedBonus + 0.25;
        value = 110 + levelIndex * 12 + phaseIndex * 18;
        name = 'Streptococcus Trooper';
      }

      // Acquire pre-built enemy mesh from object pool!
      const pooledSlot = acquireEnemyFromPool(type);
      const soldierMesh = pooledSlot.group;
      soldierMesh.rotation.set(0, 0, 0);

      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = Math.random() * 3.1;
      const x =
        customX !== undefined
          ? customX
          : remotePlayer
          ? THREE.MathUtils.clamp(remotePlayer.x, -32.0, 32.0)
          : Math.cos(angle) * spawnRadius;
      const z =
        customZ !== undefined
          ? customZ
          : remotePlayer
          ? THREE.MathUtils.clamp(remotePlayer.z, -46.0, 12.0)
          : -28 - Math.random() * 10;
      const remoteSurfaceY =
        isMultiplayerDeathmatch && remotePlayer
          ? getArenaSurfaceElevation(x, z, remotePlayer.y ?? 0).elevationY
          : 0;
      const groundY = isMultiplayerDeathmatch
        ? -0.32 + Math.max(remotePlayer?.y ?? 0, remoteSurfaceY)
        : isTank
        ? -0.5
        : Math.sin(angle) * spawnRadius * 0.45;
      const y = isParachuteDrop && !isMultiplayerDeathmatch ? 2.15 : groundY;

      pooledSlot.parachuteGroup.visible = isParachuteDrop && !isMultiplayerDeathmatch;
      soldierMesh.position.set(x, y, z);

      const firingLineZ = isMultiplayerDeathmatch
        ? remotePlayer
          ? z
          : -12.0
        : isTank
        ? -12.0 - (soldierId % 3) * 1.2
        : -7.2 - (soldierId % 4) * 1.05;

      const studentClass = remotePlayer ? remotePlayer.className : 'Science Unit';
      const isStunnedNow = remotePlayer
        ? remotePlayer.status === 'stunned' || remotePlayer.status === 'reviving' || remotePlayer.hp <= 0
        : false;
      const resolvedAvatar = remotePlayer
        ? resolvePlayerAvatarType(remotePlayer.playerId, remotePlayer.avatarType)
        : 'leukocyte';
      const resolvedWeaponId = remotePlayer?.weaponId || 'scar_bio';

      if (isMultiplayerDeathmatch) {
        updateStudentOperatorAppearance(soldierMesh, resolvedAvatar, resolvedWeaponId);
        if (pooledSlot.callsignCanvas && pooledSlot.callsignTexture) {
          updateStudentOperatorBadge(
            pooledSlot.callsignCanvas,
            pooledSlot.callsignTexture,
            name,
            studentClass,
            isStunnedNow,
            true
          );
        }
        if (pooledSlot.stasisCage) {
          pooledSlot.stasisCage.visible = isStunnedNow;
        }
      }

      const soldier: ActiveSoldier = {
        id: soldierId,
        type,
        name,
        mesh: soldierMesh,
        leftLeg: pooledSlot.leftLeg,
        rightLeg: pooledSlot.rightLeg,
        leftArm: pooledSlot.leftArm,
        rightArm: pooledSlot.rightArm,
        scopeGlint: pooledSlot.scopeGlint,
        turret: pooledSlot.turret,
        cannon: pooledSlot.cannon,
        hitsLeft: remotePlayer ? Math.max(0.2, (remotePlayer.hp / 100) * 3) : hitsLeft,
        maxHits: hitsLeft,
        hp,
        maxHp: isMultiplayerDeathmatch && remotePlayer ? 100 : hp,
        speed,
        value,
        isBoss: false,
        isTank,
        walkOffset: Math.random() * 10,
        lastShootTime: performance.now() + 500 + Math.random() * 1200,
        hpBarFill: pooledSlot.hpBarFill,
        stanceState: 'advancing',
        stanceTimer: 0.65 + Math.random() * 1.05,
        firingLineZ,
        cannonRecoil: 0,
        hullRock: 0,
        parachuteGroup: pooledSlot.parachuteGroup,
        isParachuting: Boolean(isParachuteDrop && !isMultiplayerDeathmatch),
        landingY: groundY,
        isStudentOperator: isMultiplayerDeathmatch,
        remotePlayerId: remotePlayer?.playerId,
        studentClassName: studentClass,
        avatarType: resolvedAvatar,
        equippedWeaponId: resolvedWeaponId,
        isStunned: isStunnedNow,
        stasisCage: pooledSlot.stasisCage,
        callsignCanvas: pooledSlot.callsignCanvas,
        callsignTexture: pooledSlot.callsignTexture,
      };

      activeSoldiersRef.current.push(soldier);
      triggerSpawnRipple(x, groundY + 0.05, z, isTank);
      if (!isMultiplayerDeathmatch) {
        if (isTank) {
          triggerBiologyConceptRef.current?.('enemy_tank_biofilm');
        } else {
          triggerBiologyConceptRef.current?.('enemy_bacteria');
        }
      }
    }

    ensureRetreatStragglersRef.current = () => {
      if (isMultiplayerDeathmatch) return;
      // Clear any mid-air enemy projectiles, boss rockets, or mortar shells so player is 100% safe during victory retreat
      activeEnemyBulletsRef.current.forEach((b) => {
        b.mesh.visible = false;
      });
      activeEnemyBulletsRef.current.length = 0;
      activeBossRocketsRef.current.forEach((r) => {
        r.mesh.visible = false;
      });
      activeBossRocketsRef.current.length = 0;
      activeMortarBombsRef.current.forEach((m) => {
        m.mesh.visible = false;
      });
      activeMortarBombsRef.current.length = 0;

      // Ensure at least a couple of bacteria soldiers and a tank are visible on the field to panic and retreat
      const currentSoldiers = activeSoldiersRef.current;
      const hasTank = currentSoldiers.some((s) => s.isTank);
      const bacteriaCount = currentSoldiers.filter((s) => !s.isTank && !s.isBoss).length;

      if (!hasTank) {
        spawnSoldierOrTank(-14.5, 'tank', -1.2, false);
      }
      if (bacteriaCount < 3) {
        const needed = 3 - bacteriaCount;
        const retreatLanes = [-2.2, 0.4, 2.1];
        for (let i = 0; i < needed; i++) {
          spawnSoldierOrTank(
            -11.5 - i * 2.2,
            i % 2 === 0 ? 'strep' : 'bacillus',
            retreatLanes[i % retreatLanes.length],
            false
          );
        }
      }

      // Snap any parachuting units to ground and initialize retreat timers
      activeSoldiersRef.current.forEach((s) => {
        if (s.isParachuting) {
          s.isParachuting = false;
          s.mesh.position.y = s.landingY ?? (s.isTank ? -0.5 : 0);
        }
        if (s.parachuteGroup) {
          s.parachuteGroup.visible = false;
        }
        s.retreatElapsed = 0;
      });
    };

    // Immediate opening vanguard squad scales with levelIndex & phaseIndex (In Multiplayer, ZERO BOTS — only real connected players!)
    const initialSquadSize = isMultiplayerDeathmatch
      ? 0
      : 3 + Math.min(4, Math.floor((levelNumber - 1) / 2) + (phaseNumber - 1));
    for (let i = 0; i < initialSquadSize; i++) {
      spawnSoldierOrTank(-18 - i * 3.8);
    }

    // Dynamic Spawning Frequency scaled by Level Index (0..8), Phase Progression (0..2), and Live Wave (1..3)!
    const diffScaleGlobal = ((levelNumber - 1) * 3 + (phaseNumber - 1)) / 26;
    const getDynamicSpawnDelayMs = () => {
      if (isMultiplayerDeathmatch) return 850;
      const wave = getWaveNumber();
      const levelIdx = levelNumber - 1;
      const phaseIdx = phaseNumber - 1;
      const hasActiveBoss = activeSoldiersRef.current.some((s) => s.isBoss);
      const baseMs = 1420 - levelIdx * 58 - phaseIdx * 145 - (wave - 1) * 85;
      const bossBreather = hasActiveBoss ? 220 : 0;
      return Math.max(580, Math.round(baseMs + bossBreather));
    };

    let nextDynamicSpawnAt = performance.now() + getDynamicSpawnDelayMs();
    const spawnInterval = window.setInterval(() => {
      if (isPausedForConceptRef.current || isGamePausedRef.current || isPhase3RetreatingRef.current) return;

      if (!isMultiplayerDeathmatch) {
        const nowMs = performance.now();
        if (nowMs < nextDynamicSpawnAt) return;
        nextDynamicSpawnAt = nowMs + getDynamicSpawnDelayMs();

        const wave = getWaveNumber();
        let nonBossCount = 0;
        let hasActiveBoss = false;
        const soldiers = activeSoldiersRef.current;
        for (let i = 0; i < soldiers.length; i++) {
          if (soldiers[i].isBoss) {
            hasActiveBoss = true;
          } else {
            nonBossCount++;
          }
        }
        const levelWaveBonus = Math.ceil((levelNumber - 1) * 0.75) + (phaseNumber - 1) * 2;
        const bossAdjustment = hasActiveBoss ? -2 : 0;
        const maxEnemiesForWave = Math.min(
          7,
          Math.max(
            4,
            (wave === 1 ? 4 + phaseNumber : wave === 2 ? 5 + phaseNumber : 6 + phaseNumber) +
              levelWaveBonus +
              bossAdjustment
          )
        );

        if (nonBossCount < maxEnemiesForWave) {
          spawnSoldierOrTank();
          if (
            (wave >= 2 || phaseNumber >= 2 || levelNumber >= 3) &&
            !hasActiveBoss &&
            nonBossCount + 1 < maxEnemiesForWave &&
            Math.random() < 0.24 + (phaseNumber - 1) * 0.12 + diffScaleGlobal * 0.28
          ) {
            spawnSoldierOrTank();
          }
        }
        return;
      }

      // In Multiplayer Open-World Deathmatch: Sync real connected online human players
      const remoteHumanList = mpOnlinePlayersRef.current.filter(
        (p) => p.playerId !== localMpPlayerIdRef.current
      );
      const activeRemoteIds = new Set<string>();

      remoteHumanList.forEach((rp) => {
        activeRemoteIds.add(rp.playerId);
        const existing = activeSoldiersRef.current.find((s) => s.remotePlayerId === rp.playerId);
        const mappedX = THREE.MathUtils.clamp(rp.x, -32.0, 32.0);
        const mappedZ = THREE.MathUtils.clamp(rp.z, -46.0, 12.0);
        const displayHp = rp.hp > 0 ? rp.hp : 100;

        if (!existing) {
          spawnSoldierOrTank(mappedZ, 'strep', mappedX, false, rp);
        } else {
          existing.flankTargetX = mappedX;
          existing.firingLineZ = mappedZ;
          const nowPerf = performance.now();
          const isLocallyEliminated = Boolean(
            existing.localEliminatedUntil && nowPerf < existing.localEliminatedUntil
          );
          const isRecentlyDamagedLocally = Boolean(
            existing.lastLocalDamagedAt && nowPerf - existing.lastLocalDamagedAt < 3500
          );
          const remoteIsProtected = rp.status === 'stunned' || rp.status === 'reviving' || rp.hp <= 0;
          const nextStun = remoteIsProtected || isLocallyEliminated;

          if (nextStun) {
            existing.hp = 100;
            existing.hitsLeft = 3;
            if (remoteIsProtected) {
              existing.lastLocalDamagedAt = 0;
            }
          } else if (isRecentlyDamagedLocally) {
            existing.hp = Math.min(existing.hp, displayHp);
            existing.hitsLeft = Math.min(existing.hitsLeft, Math.max(0.2, (displayHp / 100) * 3));
          } else {
            existing.hp = displayHp;
            existing.hitsLeft = Math.max(0.2, (displayHp / 100) * 3);
          }

          if (existing.hpBarFill) {
            const pct = Math.max(0.02, Math.min(1, existing.hp / 100));
            existing.hpBarFill.scale.x = pct;
            existing.hpBarFill.position.x = -(0.82 * (1 - pct)) / 2;
          }
          existing.mesh.visible = true;
          const nextAvatar = resolvePlayerAvatarType(rp.playerId, rp.avatarType);
          const nextWeapon = rp.weaponId || 'scar_bio';
          if (existing.avatarType !== nextAvatar || existing.equippedWeaponId !== nextWeapon) {
            existing.avatarType = nextAvatar;
            existing.equippedWeaponId = nextWeapon;
          }
          updateStudentOperatorAppearance(existing.mesh, nextAvatar, nextWeapon);
          if (existing.isStunned !== nextStun || existing.name !== rp.studentName) {
            existing.isStunned = nextStun;
            existing.name = rp.studentName;
            if (existing.stasisCage) existing.stasisCage.visible = nextStun;
            if (existing.callsignCanvas && existing.callsignTexture) {
              updateStudentOperatorBadge(
                existing.callsignCanvas,
                existing.callsignTexture,
                rp.studentName,
                rp.className,
                nextStun,
                true
              );
            }
          }
        }
      });

      // Remove any disconnected remote human players
      for (let i = activeSoldiersRef.current.length - 1; i >= 0; i--) {
        const s = activeSoldiersRef.current[i];
        if (s.remotePlayerId && !activeRemoteIds.has(s.remotePlayerId)) {
          releaseSoldierToPool(s);
          activeSoldiersRef.current.splice(i, 1);
        }
      }
    }, 100);

    // Pre-allocated shared geometries & materials for zero-GC-lag particle effects & shell casings!
    const sharedExplosionGeo = new THREE.SphereGeometry(0.18, 5, 5);
    const sharedExplosionMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const sharedMuzzleBlastMats = [
      new THREE.MeshBasicMaterial({ color: 0xfef08a }),
      new THREE.MeshBasicMaterial({ color: 0xf97316 }),
      new THREE.MeshBasicMaterial({ color: 0xef4444 }),
      new THREE.MeshBasicMaterial({ color: 0xa855f7 }),
    ];
    const sharedMembraneMats = [
      new THREE.MeshBasicMaterial({ color: 0x4ade80 }),
      new THREE.MeshBasicMaterial({ color: 0xa855f7 }),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
      new THREE.MeshBasicMaterial({ color: 0xf43f5e }),
    ];
    const sharedSmokeMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const sharedBagGeo = new THREE.BoxGeometry(0.46, 0.22, 0.32);
    const sharedBagMats = [
      new THREE.MeshLambertMaterial({ color: 0xd4a373 }),
      new THREE.MeshLambertMaterial({ color: 0xca8a04 }),
      new THREE.MeshLambertMaterial({ color: 0xb4884d }),
      new THREE.MeshLambertMaterial({ color: 0x9a6b32 }),
    ];
    const sharedWoodGeo = new THREE.BoxGeometry(0.09, 0.58, 0.09);
    const sharedWoodMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    const sharedSandGeo = new THREE.SphereGeometry(0.12, 5, 5);
    const sharedSandMat = new THREE.MeshBasicMaterial({ color: 0xd97706 });
    const sharedSparkGeo = new THREE.BoxGeometry(0.035, 0.035, 0.46);
    const sharedTankSparkMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const sharedBulletSparkMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const sharedShellGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.075, 6);
    sharedShellGeo.rotateZ(Math.PI / 2);
    const sharedShellMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 });

    // ============================================================================
    // OBJECT POOLS FOR ENVIRONMENTAL DEBRIS PARTICLES, SHELL CASINGS & PROJECTILES
    // (O(1) Ring-Buffer Cursors — Zero Mid-Combat Allocations or Array.shift() Stalls)
    // ============================================================================
    const DEBRIS_POOL_SIZE = 96;
    const debrisMeshPool: THREE.Mesh[] = [];
    let debrisPoolCursor = 0;
    for (let i = 0; i < DEBRIS_POOL_SIZE; i++) {
      const m = new THREE.Mesh(sharedExplosionGeo, sharedExplosionMat);
      m.visible = false;
      scene.add(m);
      debrisMeshPool.push(m);
    }

    function spawnPooledParticle(
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      pos: THREE.Vector3,
      vx: number,
      vy: number,
      vz: number,
      life: number,
      maxLife: number,
      rotVx?: number,
      rotVy?: number,
      rotVz?: number,
      hasGravity?: boolean
    ) {
      const mesh = debrisMeshPool[debrisPoolCursor];
      debrisPoolCursor = (debrisPoolCursor + 1) % DEBRIS_POOL_SIZE;
      if (mesh.visible) {
        const particles = activeParticlesRef.current;
        for (let i = 0; i < particles.length; i++) {
          if (particles[i].mesh === mesh) {
            particles[i] = particles[particles.length - 1];
            particles.pop();
            break;
          }
        }
      }
      // Keep mesh.geometry fixed on sharedExplosionGeo to avoid WebGL VAO rebuilds!
      mesh.material = mat;
      mesh.position.copy(pos);
      mesh.rotation.set(0, 0, 0);
      if (geo === sharedBagGeo) {
        mesh.scale.set(2.2, 1.1, 1.6);
      } else if (geo === sharedWoodGeo) {
        mesh.scale.set(0.45, 2.8, 0.45);
      } else if (geo === sharedSparkGeo) {
        mesh.scale.set(0.22, 0.22, 2.2);
      } else if (geo === sharedSandGeo) {
        mesh.scale.set(0.68, 0.68, 0.68);
      } else {
        mesh.scale.set(1, 1, 1);
      }
      mesh.visible = true;

      activeParticlesRef.current.push({
        mesh,
        vx,
        vy,
        vz,
        life,
        maxLife,
        rotVx,
        rotVy,
        rotVz,
        hasGravity,
      });
    }

    // Pre-allocated Shell Casing Pool (16 meshes with O(1) ring cursor)
    const SHELL_POOL_SIZE = 16;
    const shellMeshPool: THREE.Mesh[] = [];
    let shellPoolCursor = 0;
    for (let i = 0; i < SHELL_POOL_SIZE; i++) {
      const sh = new THREE.Mesh(sharedShellGeo, sharedShellMat);
      sh.visible = false;
      scene.add(sh);
      shellMeshPool.push(sh);
    }

    // Pre-allocated Player/Allied Tracer Pool (18 groups with O(1) ring cursor)
    const TRACER_POOL_SIZE = 18;
    const playerTracerPool: THREE.Group[] = [];
    let tracerPoolCursor = 0;
    for (let i = 0; i < TRACER_POOL_SIZE; i++) {
      const tr = createPlayerBulletTracerMesh(0x38bdf8);
      tr.visible = false;
      scene.add(tr);
      playerTracerPool.push(tr);
    }
    function acquirePlayerTracer(colorHex: number): THREE.Group {
      const g = playerTracerPool[tracerPoolCursor];
      tracerPoolCursor = (tracerPoolCursor + 1) % TRACER_POOL_SIZE;
      if (g.visible) {
        const tracers = activePlayerTracersRef.current;
        for (let i = 0; i < tracers.length; i++) {
          if (tracers[i].mesh === g) {
            tracers[i] = tracers[tracers.length - 1];
            tracers.pop();
            break;
          }
        }
      }
      setPlayerBulletTracerColor(g, colorHex);
      g.visible = true;
      return g;
    }

    // Pre-allocated Enemy Bullet & Heavy Tank Shell Pools (28 Spitzer bullets + 8 Tank shells, zero mid-combat allocations)
    const ENEMY_BULLET_POOL_SIZE = 28;
    const TANK_SHELL_POOL_SIZE = 8;
    const enemyBulletPool: THREE.Group[] = [];
    const tankShellPool: THREE.Group[] = [];
    let enemyBulletCursor = 0;
    let tankShellCursor = 0;
    for (let i = 0; i < ENEMY_BULLET_POOL_SIZE; i++) {
      const b = createEnemyBulletMesh(false);
      b.visible = false;
      scene.add(b);
      enemyBulletPool.push(b);
    }
    for (let i = 0; i < TANK_SHELL_POOL_SIZE; i++) {
      const t = createEnemyBulletMesh(true);
      t.visible = false;
      scene.add(t);
      tankShellPool.push(t);
    }
    function acquireEnemyProjectileMesh(isHeavy: boolean): THREE.Group {
      const pool = isHeavy ? tankShellPool : enemyBulletPool;
      const idx = isHeavy ? tankShellCursor : enemyBulletCursor;
      if (isHeavy) {
        tankShellCursor = (tankShellCursor + 1) % TANK_SHELL_POOL_SIZE;
      } else {
        enemyBulletCursor = (enemyBulletCursor + 1) % ENEMY_BULLET_POOL_SIZE;
      }
      const mesh = pool[idx];
      if (mesh.visible) {
        const bullets = activeEnemyBulletsRef.current;
        for (let i = 0; i < bullets.length; i++) {
          if (bullets[i].mesh === mesh) {
            bullets[i] = bullets[bullets.length - 1];
            bullets.pop();
            break;
          }
        }
      }
      mesh.visible = true;
      return mesh;
    }

    // Pre-allocated Boss Rocket Pool (8 guided missiles, zero mid-combat allocations)
    const BOSS_ROCKET_POOL_SIZE = 8;
    const bossRocketPool: Array<{ group: THREE.Group; flame: THREE.Mesh }> = [];
    let bossRocketCursor = 0;
    for (let i = 0; i < BOSS_ROCKET_POOL_SIZE; i++) {
      const rk = createBossRocketMesh();
      rk.group.visible = false;
      scene.add(rk.group);
      bossRocketPool.push(rk);
    }
    function acquireBossRocketMesh(): { group: THREE.Group; flame: THREE.Mesh } {
      const slot = bossRocketPool[bossRocketCursor];
      bossRocketCursor = (bossRocketCursor + 1) % BOSS_ROCKET_POOL_SIZE;
      if (slot.group.visible) {
        const rockets = activeBossRocketsRef.current;
        for (let i = 0; i < rockets.length; i++) {
          if (rockets[i].mesh === slot.group) {
            rockets[i] = rockets[rockets.length - 1];
            rockets.pop();
            break;
          }
        }
      }
      slot.group.visible = true;
      return slot;
    }

    // Pre-allocated Mortar Bomb Pool (6 mortar shells, zero mid-combat allocations)
    const MORTAR_BOMB_POOL_SIZE = 6;
    const mortarBombPool: THREE.Group[] = [];
    let mortarBombCursor = 0;
    for (let i = 0; i < MORTAR_BOMB_POOL_SIZE; i++) {
      const mb = createMortarBombMesh();
      mb.visible = false;
      scene.add(mb);
      mortarBombPool.push(mb);
    }
    function acquireMortarBombMesh(): THREE.Group {
      const mesh = mortarBombPool[mortarBombCursor];
      mortarBombCursor = (mortarBombCursor + 1) % MORTAR_BOMB_POOL_SIZE;
      if (mesh.visible) {
        const bombs = activeMortarBombsRef.current;
        for (let i = 0; i < bombs.length; i++) {
          if (bombs[i].mesh === mesh) {
            bombs[i] = bombs[bombs.length - 1];
            bombs.pop();
            break;
          }
        }
      }
      mesh.visible = true;
      return mesh;
    }

    // Pre-allocated Organ Environmental Hazard Pool (2 reusable hazard groups so zero mid-frame geometry allocation occurs!)
    const sharedHazardRingGeo = new THREE.RingGeometry(0.95, 1.45, 20);
    sharedHazardRingGeo.rotateX(-Math.PI / 2);
    const sharedHazardPlumeGeo = new THREE.CylinderGeometry(0.32, 0.72, 3.6, 10, 1, true);
    const hazardPool: Array<{
      inUse: boolean;
      group: THREE.Group;
      warningRing: THREE.Mesh;
      plumes: THREE.Mesh[];
    }> = [];
    for (let h = 0; h < 2; h++) {
      const hGroup = new THREE.Group();
      const rMat = new THREE.MeshBasicMaterial({
        color: 0x84cc16,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      });
      const wRing = new THREE.Mesh(sharedHazardRingGeo, rMat);
      wRing.position.set(0, 0.08, 4.5);
      hGroup.add(wRing);
      const plumes: THREE.Mesh[] = [];
      for (let pIdx = 0; pIdx < 4; pIdx++) {
        const pMat = new THREE.MeshBasicMaterial({
          color: 0x84cc16,
          transparent: true,
          opacity: 0.0,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        });
        const plume = new THREE.Mesh(sharedHazardPlumeGeo, pMat);
        plume.position.set((pIdx % 2 === 0 ? -1 : 1) * 0.22, 1.6, -2.5 + pIdx * 2.4);
        plume.visible = false;
        hGroup.add(plume);
        plumes.push(plume);
      }
      hGroup.visible = false;
      scene.add(hGroup);
      hazardPool.push({ inUse: false, group: hGroup, warningRing: wRing, plumes });
    }

    // Helper: MuzzleFlash Particle Burst at the Active Weapon's Barrel Position whenever the user fires!
    function triggerMuzzleFlash(barrelPos: THREE.Vector3, shotDir: THREE.Vector3, weaponCategory: string) {
      const burstCount = weaponCategory === 'SHOTGUN' ? 8 : 6;
      const matIndexOffset =
        weaponCategory === 'SNIPER'
          ? 2
          : weaponCategory === 'MACHINE_GUN'
          ? 3
          : weaponCategory === 'SHOTGUN'
          ? 1
          : 0;
      for (let i = 0; i < burstCount; i++) {
        const isSpark = i % 2 === 0;
        const speed = 10 + Math.random() * 14;
        spawnPooledParticle(
          isSpark ? sharedSparkGeo : sharedSandGeo,
          isSpark
            ? sharedBulletSparkMat
            : sharedMuzzleBlastMats[(i + matIndexOffset) % sharedMuzzleBlastMats.length],
          barrelPos,
          shotDir.x * speed + (Math.random() - 0.5) * 4.5,
          shotDir.y * speed + (Math.random() - 0.5) * 4.5,
          shotDir.z * speed + (Math.random() - 0.5) * 3.5,
          0.09 + Math.random() * 0.07,
          0.16
        );
      }
    }

    // Helper: Cellular Membrane Disintegration Effect whenever Bacteria (Strep / Bacillus) are killed!
    function triggerMembraneDisintegration(pos: THREE.Vector3, enemyType: string) {
      sounds.playExplosion();
      cameraShakeRef.current = Math.max(cameraShakeRef.current, 0.38);

      // Trigger expanding osmotic cytolysis membrane ripple
      triggerSpawnRipple(pos.x, pos.y + 0.18, pos.z, false);

      // Burst 12 cellular lipid-bilayer fragments & glowing cytoplasmic vesicles outward
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const outSpeed = 3.5 + Math.random() * 7.5;
        const mat =
          enemyType === 'bacillus'
            ? sharedMembraneMats[(i + 1) % sharedMembraneMats.length]
            : sharedMembraneMats[i % 3];
        spawnPooledParticle(
          i % 3 === 0 ? sharedExplosionGeo : sharedSandGeo,
          mat,
          pos,
          Math.cos(angle) * outSpeed,
          1.8 + Math.random() * 5.8,
          Math.sin(angle) * outSpeed,
          0.48 + Math.random() * 0.28,
          0.76,
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14,
          false
        );
      }
    }

    // Helper: Heavy Structural Destruction & Fireball Pop when a Low-HP Tank or Boss finally pops!
    function triggerHeavyDestructionPop(pos: THREE.Vector3, isBoss: boolean) {
      triggerExplosion(pos);
      cameraShakeRef.current = isBoss ? 0.95 : 0.78;
      const chunkCount = isBoss ? 10 : 7;
      for (let i = 0; i < chunkCount; i++) {
        spawnPooledParticle(
          i % 2 === 0 ? sharedBagGeo : sharedWoodGeo,
          i % 2 === 0 ? sharedBagMats[i % sharedBagMats.length] : sharedWoodMat,
          pos,
          (Math.random() - 0.5) * 16,
          5.0 + Math.random() * 8.0,
          (Math.random() - 0.5) * 14,
          0.75 + Math.random() * 0.35,
          1.1,
          (Math.random() - 0.5) * 22,
          (Math.random() - 0.5) * 22,
          (Math.random() - 0.5) * 22,
          true
        );
      }
      for (let s = 0; s < 6; s++) {
        spawnPooledParticle(
          sharedSparkGeo,
          s % 2 === 0 ? sharedTankSparkMat : sharedBulletSparkMat,
          pos,
          (Math.random() - 0.5) * 18,
          3.0 + Math.random() * 9.0,
          (Math.random() - 0.5) * 18,
          0.4 + Math.random() * 0.25,
          0.65
        );
      }
    }

    // Helper: Spawn explosion fireball particles (via zero-GC debris pool)
    function triggerExplosion(pos: THREE.Vector3) {
      sounds.playExplosion();
      cameraShakeRef.current = 0.65;

      for (let i = 0; i < 12; i++) {
        spawnPooledParticle(
          sharedExplosionGeo,
          sharedExplosionMat,
          pos,
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14,
          0.55 + Math.random() * 0.3,
          0.85
        );
      }
    }

    // Helper: Dramatic Tank 120mm Cannon Muzzle Blast & Shockwave Ring!
    function triggerTankMuzzleBlast(pos: THREE.Vector3) {
      cameraShakeRef.current = Math.max(cameraShakeRef.current, 0.42);

      for (let i = 0; i < 10; i++) {
        spawnPooledParticle(
          sharedExplosionGeo,
          sharedMuzzleBlastMats[i % sharedMuzzleBlastMats.length],
          pos,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
          4.5 + Math.random() * 8,
          0.28 + Math.random() * 0.18,
          0.46
        );
      }
    }

    // Helper: Spawn 3D Sandbag & Timber Shattering Effect when a Barricade or Tank Shell Shatters Cover!
    function triggerBarricadeShatter(pos: THREE.Vector3) {
      sounds.playBarricadeShatter();
      cameraShakeRef.current = 0.95;

      for (let i = 0; i < 10; i++) {
        _v1.set(
          pos.x + (Math.random() - 0.5) * 1.4,
          pos.y + Math.random() * 0.5,
          pos.z + (Math.random() - 0.5) * 0.4
        );
        spawnPooledParticle(
          sharedBagGeo,
          sharedBagMats[i % sharedBagMats.length],
          _v1,
          (Math.random() - 0.5) * 11,
          4.5 + Math.random() * 6.5,
          (Math.random() - 0.5) * 9,
          1.0 + Math.random() * 0.35,
          1.35,
          (Math.random() - 0.5) * 18,
          (Math.random() - 0.5) * 18,
          (Math.random() - 0.5) * 18,
          true
        );
      }

      for (let w = 0; w < 6; w++) {
        spawnPooledParticle(
          sharedWoodGeo,
          sharedWoodMat,
          pos,
          (Math.random() - 0.5) * 14,
          5.5 + Math.random() * 7.5,
          (Math.random() - 0.5) * 12,
          0.95 + Math.random() * 0.3,
          1.25,
          (Math.random() - 0.5) * 26,
          (Math.random() - 0.5) * 26,
          (Math.random() - 0.5) * 26,
          true
        );
      }

      for (let s = 0; s < 10; s++) {
        spawnPooledParticle(
          sharedSandGeo,
          sharedSandMat,
          pos,
          (Math.random() - 0.5) * 12,
          2.0 + Math.random() * 6.0,
          (Math.random() - 0.5) * 10,
          0.55 + Math.random() * 0.25,
          0.8
        );
      }
    }

    // Helper: Spawn sand dust particles when barricade blocks enemy fire
    function triggerSandDust(pos: THREE.Vector3) {
      for (let i = 0; i < 6; i++) {
        spawnPooledParticle(
          sharedSandGeo,
          sharedSandMat,
          pos,
          (Math.random() - 0.5) * 7,
          Math.random() * 4 + 1.2,
          (Math.random() - 0.5) * 7,
          0.3 + Math.random() * 0.2,
          0.5
        );
      }
    }

    // RAYCASTER & SHOOTING LOGIC (Supports AUTO-AIM ON vs MANUAL SCOPE AIM!)
    const raycaster = new THREE.Raycaster();
    const hitVector = new THREE.Vector2();

    let lastBarricadeUiTime = 0;
    let lastBossHitsUiVal = -1;
    let operatorShootingResetTimer: number | null = null;

    function executeShot() {
      if (isMultiplayerDeathmatch && (mpStatusRef.current !== 'active' || mpMatchEndedRef.current)) return;
      const now = performance.now();
      const activeWpn = currentWeaponRef.current;

      const isLaserActive = superAbilitiesRef.current['t_cytotoxic_laser'] && now < superAbilitiesRef.current['t_cytotoxic_laser'];
      const effectiveFireRate = isLaserActive ? 70 : activeWpn.fireRate;

      if (now - lastShotTimeRef.current < effectiveFireRate) return;
      if (isReloadingRef.current) return;

      if (!isLaserActive && currentAmmoRef.current <= 0) {
        sounds.playDryFire();
        if (reserveAmmoRef.current > 0 && !isReloadingRef.current) {
          handleReloadRef.current?.();
        }
        return;
      }

      shotsFiredRef.current += 1;

      if (isMultiplayerDeathmatch) {
        localShotSeqRef.current += 1;
        lastPlayerActivityRef.current = Date.now();
        pushLocalMpStateNowRef.current?.();
      }

      if (!isLaserActive) {
        currentAmmoRef.current -= 1;
        syncLiveAmmoDom();
        if (currentAmmoRef.current === 0 || currentAmmoRef.current === 5) {
          setCurrentAmmo(currentAmmoRef.current);
        }
      }
      lastShotTimeRef.current = now;
      if (!isLaserActive && currentAmmoRef.current === 0 && reserveAmmoRef.current > 0) {
        setTimeout(() => {
          if (currentAmmoRef.current === 0 && !isReloadingRef.current) {
            handleReloadRef.current?.();
          }
        }, 180);
      }

      if (isLaserActive) {
        sounds.playLaserDisintegrator();
      } else {
        sounds.playShoot(activeWpn.category);
      }

      recoilRef.current.z = isScopedRef.current ? 0.16 : 0.32;
      recoilRef.current.rotX = isScopedRef.current ? 0.09 : 0.18;
      cameraShakeRef.current = Math.max(
        cameraShakeRef.current,
        activeWpn.category === 'SHOTGUN' ? 0.35 : isScopedRef.current ? 0.1 : 0.18
      );

      if (activeWpn.category === 'SHOTGUN' && pumpSlideRef.current) {
        pumpSlideRef.current.position.z = -0.32;
        setTimeout(() => {
          if (pumpSlideRef.current) pumpSlideRef.current.position.z = -0.45;
        }, 220);
      }

      if (muzzleSpriteRef.current) {
        const mMat = muzzleSpriteRef.current.material as THREE.MeshBasicMaterial;
        mMat.opacity = 0.96;
        mMat.color.setHex(
          isLaserActive
            ? 0x22d3ee
            : activeWpn.category === 'SNIPER'
            ? 0xfda4af
            : activeWpn.category === 'SHOTGUN'
            ? 0xfef08a
            : activeWpn.category === 'MACHINE_GUN'
            ? 0xd8b4fe
            : 0x67e8f9
        );
        const fScale = activeWpn.category === 'SHOTGUN' ? 1.35 : 1.0 + Math.random() * 0.25;
        muzzleSpriteRef.current.scale.set(fScale, fScale, fScale);
        muzzleSpriteRef.current.rotation.z = Math.random() * Math.PI * 2;
      }

      const shell = shellMeshPool[shellPoolCursor];
      shellPoolCursor = (shellPoolCursor + 1) % SHELL_POOL_SIZE;
      if (shell.visible) {
        const activeShells = activeShellsRef.current;
        for (let i = 0; i < activeShells.length; i++) {
          if (activeShells[i].mesh === shell) {
            activeShells[i] = activeShells[activeShells.length - 1];
            activeShells.pop();
            break;
          }
        }
      }
      shell.position.set(
        playerPosRef.current.x + 0.38,
        -0.24,
        playerPosRef.current.z - 0.72
      );
      shell.rotation.set(0, 0, 0);
      shell.visible = true;
      activeShellsRef.current.push({
        mesh: shell,
        vx: 3.5 + Math.random() * 1.5,
        vy: 2.4 + Math.random() * 1.0,
        vz: (Math.random() - 0.5) * 1.2,
        rotVx: Math.random() * 25 - 12,
        rotVy: Math.random() * 25 - 12,
        rotVz: Math.random() * 25 - 12,
        life: 1.6,
      });

      if (Math.random() < 0.6) {
        sounds.playBrassShellDrop();
      }

      camera.updateMatrixWorld();

      const soldiers = activeSoldiersRef.current;
      let rawAimX = aimPosRef.current.x;
      let rawAimY = aimPosRef.current.y;

      if (isMultiplayerDeathmatch || isScopedRef.current) {
        hitVector.set(0, 0);
      } else {
        hitVector.set(aimPosRef.current.x, aimPosRef.current.y);
      }

      rawAimX = hitVector.x;
      rawAimY = hitVector.y;

      if (!isMultiplayerDeathmatch && autoAimEnabledRef.current && soldiers.length > 0) {
        // Subtle aim friction/assist only when reticle is already directly grazing enemy torso (Solo mode only)
        let bestDist = 0.085;
        let lockedBodyNdcX = 0;
        let lockedBodyNdcY = 0;
        let hasLock = false;
        for (let i = 0; i < soldiers.length; i++) {
          const s = soldiers[i];
          if (s.mesh.position.z >= playerPosRef.current.z - 1.2) continue;

          const bodyYOffset = s.isRobot ? 1.85 : s.isTank ? 0.35 : 0.18;
          _v2.copy(s.mesh.position);
          _v2.y += bodyYOffset;
          _v2.project(camera);
          if (_v2.z >= 1 || _v2.z <= -1) continue;
          const bodyNdcX = _v2.x;
          const bodyNdcY = _v2.y;
          const dBody = Math.hypot(bodyNdcX - hitVector.x, bodyNdcY - hitVector.y);

          if (dBody < bestDist) {
            bestDist = dBody;
            lockedBodyNdcX = bodyNdcX;
            lockedBodyNdcY = bodyNdcY;
            hasLock = true;
          }
        }
        if (hasLock) {
          hitVector.set(
            THREE.MathUtils.lerp(hitVector.x, lockedBodyNdcX, 0.18),
            THREE.MathUtils.lerp(hitVector.y, lockedBodyNdcY, 0.18)
          );
        }
      }

      camera.updateMatrixWorld();
      raycaster.setFromCamera(hitVector, camera);

      // Spawn MuzzleFlash Particle Effect & 3D Pointed Spitzer Bullet Projectile converging from the barrel directly onto the crosshair point!
      {
        if (weaponMeshRef.current) {
          weaponMeshRef.current.updateMatrixWorld();
          _v1.set(0, 0.03, -1.24);
          weaponMeshRef.current.localToWorld(_v1);
        } else {
          _v1.copy(camera.position);
        }
        // Exact 3D point directly under the crosshair ray
        _v2.copy(raycaster.ray.direction).multiplyScalar(32).add(camera.position);
        _v3.copy(_v2).sub(_v1).normalize();
        triggerMuzzleFlash(_v1, _v3, activeWpn.category);
        const tracerColor =
          activeWpn.category === 'SNIPER'
            ? 0xf43f5e
            : activeWpn.category === 'SHOTGUN'
            ? 0xf59e0b
            : activeWpn.category === 'MACHINE_GUN'
            ? 0xa855f7
            : 0x38bdf8;
        const pBullet = acquirePlayerTracer(tracerColor);
        pBullet.position.copy(_v1);
        pBullet.lookAt(_v2);
        const pSpeed = 62;
        activePlayerTracersRef.current.push({
          mesh: pBullet,
          vx: _v3.x * pSpeed,
          vy: _v3.y * pSpeed,
          vz: _v3.z * pSpeed,
          life: 0.55,
        });
      }

      let hitRegistered = false;
      let criticalHit = false;
      let hitSoldier: ActiveSoldier | null = null;
      let eliminatedSoldier: ActiveSoldier | null = null;
      let totalDamage = 0;

      const baseNormalShotDamage =
        activeWpn.category === 'SHOTGUN'
          ? activeWpn.damage * (activeWpn.pellets || 8)
          : activeWpn.damage;

      if (isMultiplayerDeathmatch) {
        // STRICT 3D CENTER-CROSSHAIR RAYCAST HIT DETECTION FOR MULTIPLAYER:
        // Shooting into the sky, floor, walls, or away from the enemy NEVER hits the enemy!
        const rayOrig = raycaster.ray.origin;
        const rayDir = raycaster.ray.direction;

        // 1. Check if the ray hits the ground floor or intact cover barricades before reaching a target
        let maxUnobstructedDist = 120.0;
        if (rayDir.y < -0.025) {
          const localGroundY = playerElevationYRef.current - 1.38;
          const distToFloor = (localGroundY - rayOrig.y) / rayDir.y;
          if (distToFloor > 0.2) {
            maxUnobstructedDist = Math.min(maxUnobstructedDist, distToFloor + 0.35);
          }
        }

        for (let bIdx = 0; bIdx < barricadesRef.current.length; bIdx++) {
          const bar = barricadesRef.current[bIdx];
          if (bar.hp <= 0) continue;
          const bx = bar.x - rayOrig.x;
          const by = (bar.y + 0.45) - rayOrig.y;
          const bz = bar.z - rayOrig.z;
          const barProj = bx * rayDir.x + by * rayDir.y + bz * rayDir.z;
          if (barProj <= 0.3 || barProj >= maxUnobstructedDist) continue;
          const hitBarX = rayOrig.x + rayDir.x * barProj;
          const hitBarY = rayOrig.y + rayDir.y * barProj;
          const hitBarZ = rayOrig.z + rayDir.z * barProj;
          if (
            Math.hypot(hitBarX - bar.x, hitBarZ - bar.z) <= 1.05 &&
            hitBarY >= bar.y - 0.55 &&
            hitBarY <= bar.y + 1.15
          ) {
            maxUnobstructedDist = Math.min(maxUnobstructedDist, barProj);
          }
        }

        let closestMpHitDist = maxUnobstructedDist;

        for (let i = soldiers.length - 1; i >= 0; i--) {
          const soldier = soldiers[i];
          if (soldier.isStunned) continue;

          // Compute forward distance along the camera ray
          const toEnemyX = soldier.mesh.position.x - rayOrig.x;
          const toEnemyY = soldier.mesh.position.y - rayOrig.y;
          const toEnemyZ = soldier.mesh.position.z - rayOrig.z;
          const forwardDist = toEnemyX * rayDir.x + toEnemyY * rayDir.y + toEnemyZ * rayDir.z;

          // Target must be strictly in front of the player's camera ray and closer than any floor/cover obstacle
          if (forwardDist <= 0.5 || forwardDist > closestMpHitDist) continue;

          // Exact 3D point of the bullet ray at the enemy's depth
          const rayAtX = rayOrig.x + rayDir.x * forwardDist;
          const rayAtY = rayOrig.y + rayDir.y * forwardDist;
          const rayAtZ = rayOrig.z + rayDir.z * forwardDist;

          // Strict vertical bounds of the 3D operator model: feet (-0.90) to top of head (+0.82)
          const footY = soldier.mesh.position.y - 0.90;
          const headBottomY = soldier.mesh.position.y + 0.14;
          const headTopY = soldier.mesh.position.y + 0.82;

          // If the ray passes below the enemy's feet (shooting the floor) or above their head (shooting the sky), miss!
          if (rayAtY < footY || rayAtY > headTopY) continue;

          // Horizontal distance from the ray to the enemy's 3D body axis
          const horizDist = Math.hypot(
            rayAtX - soldier.mesh.position.x,
            rayAtZ - soldier.mesh.position.z
          );

          // Check Headshot cylinder/sphere first (tight 0.36m radius around head)
          if (rayAtY >= headBottomY && horizDist <= 0.36) {
            closestMpHitDist = forwardDist;
            criticalHit = true;
            hitRegistered = true;
            hitSoldier = soldier;
            totalDamage = baseNormalShotDamage * 3;
          } else if (horizDist <= 0.46) {
            // Check Torso/Limbs cylinder (tight 0.46m radius around torso/legs)
            closestMpHitDist = forwardDist;
            criticalHit = false;
            hitRegistered = true;
            hitSoldier = soldier;
            totalDamage = baseNormalShotDamage;
          }
        }

        if (hitRegistered && hitSoldier) {
          hitSoldier.lastLocalDamagedAt = performance.now();
          hitSoldier.hp -= totalDamage;
        }
      } else {
        for (let i = soldiers.length - 1; i >= 0; i--) {
          const soldier = soldiers[i];
          if (soldier.mesh.position.z >= playerPosRef.current.z - 1.2) continue;

          const headYOffset = soldier.isRobot
            ? 2.62
            : soldier.isTank
            ? 0.82
            : soldier.isHelicopter || soldier.isJet
            ? 0.48
            : 0.65;
          const bodyYOffset = soldier.isRobot ? 1.85 : soldier.isTank ? 0.35 : 0.18;

          // Project Head & Body to 2D NDC
          _v1.copy(soldier.mesh.position);
          _v1.y += headYOffset;
          const distSqHead3D = raycaster.ray.distanceSqToPoint(_v1);
          _v1.project(camera);
          if (_v1.z >= 1.0) continue; // Behind camera in 360-degree view
          // Measure headshot precision strictly against the player's TRUE unassisted aim (rawAimX, rawAimY)!
          const rawHeadNdcDist = Math.hypot(_v1.x - rawAimX, _v1.y - rawAimY);
          const headNdcY = _v1.y;

          _v2.copy(soldier.mesh.position);
          _v2.y += bodyYOffset;
          const distSqBody3D = raycaster.ray.distanceSqToPoint(_v2);
          _v2.project(camera);
          if (_v2.z >= 1.0) continue;
          const rawBodyNdcDist = Math.hypot(_v2.x - rawAimX, _v2.y - rawAimY);
          const bodyNdcDist = Math.hypot(_v2.x - hitVector.x, _v2.y - hitVector.y);

          const maxNdc = soldier.isRobot || soldier.isBoss ? 0.85 : 0.52;
          if (Math.min(rawHeadNdcDist, bodyNdcDist) > maxNdc) continue;

          // 1. PRECISION HEADSHOT DETECTION (Requires genuine manual aim on the head — never triggered by auto-aim pull!)
          const headRadiusSq3D = soldier.isRobot
            ? 0.42
            : soldier.isTank
            ? 0.18
            : soldier.isBoss
            ? 0.22
            : 0.11;
          const headPrecisionNdc = isScopedRef.current ? 0.082 : 0.064;
          const isTrueHeadAim =
            rawHeadNdcDist <= headPrecisionNdc &&
            rawHeadNdcDist < rawBodyNdcDist * 0.85 &&
            rawAimY >= headNdcY - 0.025;
          const isHeadshot3D =
            distSqHead3D <= headRadiusSq3D &&
            rawHeadNdcDist <= headPrecisionNdc * 1.15 &&
            rawAimY >= _v2.y + 0.02;

          if (isTrueHeadAim || isHeadshot3D) {
            criticalHit = true;
            hitRegistered = true;
            hitSoldier = soldier;
            totalDamage = baseNormalShotDamage * 3;
            soldier.hp -= totalDamage;
            if (!soldier.remotePlayerId) {
              soldier.mesh.position.z -= soldier.isTank ? 0.35 : soldier.isBoss ? 0.25 : 0.5;
            }
            break;
          }

          // 2. General Body Hit (Soldiers, Tanks, Bosses) via analytical 3D ray-capsule/sphere check (tuned to exact physical model dimensions)
          const bodyRadiusSq = soldier.isRobot
            ? 2.2
            : soldier.isTank
            ? 1.15
            : soldier.isBoss
            ? 1.45
            : 0.28;
          if (distSqBody3D <= bodyRadiusSq) {
            hitRegistered = true;
            hitSoldier = soldier;
            totalDamage = baseNormalShotDamage;
            soldier.hp -= totalDamage;
            if (!soldier.remotePlayerId) {
              soldier.mesh.position.z -= soldier.isTank ? 0.14 : soldier.isBoss ? 0.1 : 0.2;
            }
            break;
          }
        }

        // 2D Screen-Space Hitbox Check (Solo mode only): strict tight bounds requiring genuine aim on the enemy's visual silhouette
        if (!hitRegistered) {
          for (let i = soldiers.length - 1; i >= 0; i--) {
            const soldier = soldiers[i];
            if (soldier.mesh.position.z >= playerPosRef.current.z - 1.2) continue;

            const bodyYOffset = soldier.isRobot ? 1.85 : soldier.isTank ? 0.35 : 0.18;
            _v2.copy(soldier.mesh.position);
            _v2.y += bodyYOffset;
            _v2.project(camera);
            if (_v2.z >= 1.0) continue;
            const distBody2D = Math.hypot(_v2.x - hitVector.x, _v2.y - hitVector.y);

            // Scaled strictly to true visual dimensions of soldiers, tanks & bosses (no massive generous ghost hitboxes)
            const hitSilhouetteRadius = autoAimEnabledRef.current
              ? soldier.isRobot
                ? 0.18
                : soldier.isTank
                ? 0.14
                : soldier.isBoss
                ? 0.16
                : 0.075
              : soldier.isRobot
              ? 0.15
              : soldier.isTank
              ? 0.11
              : soldier.isBoss
              ? 0.13
              : 0.055;
            if (distBody2D < hitSilhouetteRadius) {
              hitRegistered = true;
              hitSoldier = soldier;
              criticalHit = false;
              totalDamage = baseNormalShotDamage;
              soldier.hp -= totalDamage;
              if (!soldier.remotePlayerId) {
                soldier.mesh.position.z -= soldier.isTank ? 0.14 : soldier.isBoss ? 0.1 : 0.2;
              }
              break;
            }
          }
        }
      }

      if (hitRegistered && hitSoldier) {
        shotsHitRef.current += 1;
        sounds.playHitmarker(criticalHit);

        if (isMultiplayerDeathmatch && hitSoldier.remotePlayerId) {
          const prevTargetHp = Math.max(0, Math.round(hitSoldier.hp + totalDamage));
          sendPlayerHitEvent(
            activeRoomCodeRef.current,
            hitSoldier.remotePlayerId,
            prevTargetHp,
            Math.round(totalDamage),
            localMpPlayerIdRef.current,
            cachedStudentProfileRef.current?.name || 'Operative',
            activeWpn.name,
            criticalHit
          );
        }

        // Spawn Fortnite-Style Floating Damage Number + HEADSHOT! banner (throttled during rapid fire to prevent React VDOM stutter)
        if ((criticalHit && now - lastHitmarkerUiTimeRef.current >= 180) || now - lastHitmarkerUiTimeRef.current >= 380) {
          lastHitmarkerUiTimeRef.current = now;
          const markerId = now + Math.random();
          const isArmoredTarget = Boolean(
            hitSoldier.type === 'tank' || hitSoldier.isHelicopter || hitSoldier.isRobot || hitSoldier.isJet
          );
          const scatterX = Math.round((Math.random() - 0.5) * 34);
          const scatterY = Math.round((Math.random() - 0.5) * 18);
          setHitmarkers((prev) => [
            ...prev.slice(-2),
            {
              id: markerId,
              x: Math.max(12, Math.min(88, (hitVector.x + 1) * 50)),
              y: Math.max(14, Math.min(82, (-hitVector.y + 1) * 50)),
              offsetX: scatterX,
              offsetY: scatterY,
              isCritical: criticalHit,
              isHeadshot: criticalHit,
              isArmored: isArmoredTarget,
              damage: Math.round(totalDamage),
            },
          ]);
          window.setTimeout(() => {
            setHitmarkers((prev) => (prev.length > 0 ? prev.filter((m) => m.id !== markerId) : prev));
          }, 650);
        }

        const isBossVehicle = Boolean(hitSoldier.isHelicopter || hitSoldier.isRobot || hitSoldier.isJet);
        // Exact 3:1 Headshot-to-Normal Hit Scale:
        // - Bacteria (3 hits): 1 headshot (3.0) kills immediately, or 3 normal SCAR shots (1.0 each)
        // - Tank (6 hits): 2 headshots (3.0 each) or 6 normal SCAR shots (1.0 each)
        // - Bosses (12 / 15 / 18 hits): 4 / 5 / 6 headshots (3.0 each) or 12 / 15 / 18 normal SCAR shots (1.0 each)
        const weaponHitPower =
          activeWpn.id === 'bolt_sniper'
            ? criticalHit
              ? 6.0
              : 3.0
            : activeWpn.id === 'pump_shotgun'
            ? criticalHit
              ? 3.0
              : 1.5
            : criticalHit
            ? 3.0
            : 1.0;

        hitSoldier.hitsLeft = Math.max(
          0,
          Number((hitSoldier.hitsLeft - weaponHitPower).toFixed(2))
        );

        if (isBossVehicle) {
          const flipDir = (hitSoldier.dodgeTargetX || 1) > 0 ? -1 : 1;
          hitSoldier.dodgeTargetX = flipDir * (1.5 + Math.random() * 1.4);
          hitSoldier.dodgeTargetY = (Math.random() - 0.5) * 0.7;
          hitSoldier.nextDodgeTime = now + 1100 + Math.random() * 600;
        }

        if (hitSoldier.hpBarFill) {
          const pct = Math.max(
            0.01,
            Math.min(hitSoldier.hitsLeft / hitSoldier.maxHits, hitSoldier.hp / hitSoldier.maxHp)
          );
          hitSoldier.hpBarFill.scale.x = pct;
          hitSoldier.hpBarFill.position.x = -(0.82 * (1 - pct)) / 2;
        }
        if (isBossVehicle) {
          const roundedBossHits = Math.max(0, Math.ceil(hitSoldier.hitsLeft));
          if (roundedBossHits !== lastBossHitsUiVal) {
            lastBossHitsUiVal = roundedBossHits;
            setBossInfo({ name: hitSoldier.name, hitsLeft: roundedBossHits, maxHits: hitSoldier.maxHits });
          }
        }

        const isDefeated = hitSoldier.hitsLeft <= 0 || hitSoldier.hp <= 0;

        if (isDefeated) {
          eliminatedSoldier = hitSoldier;
          if (hitSoldier.isTank || hitSoldier.isBoss) {
            triggerHeavyDestructionPop(hitSoldier.mesh.position, hitSoldier.isBoss);
          } else {
            triggerMembraneDisintegration(hitSoldier.mesh.position, hitSoldier.type);
          }
          if (isMultiplayerDeathmatch) {
            spawnBiologicalDropRef.current?.(
              hitSoldier.mesh.position.x,
              hitSoldier.mesh.position.z,
              Math.random() > 0.5 ? 'atp' : 'shield'
            );
          }
          if (isMultiplayerDeathmatch && hitSoldier.remotePlayerId) {
            // Keep remote player in the 3D arena inside their reviving stasis shield so spawnInterval never respawns a duplicate
            hitSoldier.localEliminatedUntil = performance.now() + 2500;
            hitSoldier.lastLocalDamagedAt = 0;
            hitSoldier.isStunned = true;
            hitSoldier.hp = 100;
            hitSoldier.hitsLeft = 3;
            if (hitSoldier.stasisCage) hitSoldier.stasisCage.visible = true;
            if (hitSoldier.hpBarFill) {
              hitSoldier.hpBarFill.scale.x = 1;
              hitSoldier.hpBarFill.position.x = 0;
            }
          } else {
            releaseSoldierToPool(hitSoldier);
            const sIdx = soldiers.indexOf(hitSoldier);
            if (sIdx !== -1) soldiers.splice(sIdx, 1);
          }
        }

        if (eliminatedSoldier) {
          sounds.playKillConfirm();
          killsRef.current += 1;
          comboStreakRef.current += 1;
          const points = eliminatedSoldier.value * (criticalHit ? 2 : 1);
          scoreRef.current += points;

          setKills(killsRef.current);
          setScore(scoreRef.current);

          if (isMultiplayerDeathmatch) {
            const prof = cachedStudentProfileRef.current;
            const myCallsign = prof?.name || 'Operative';
            pushKillfeedEntryRef.current?.({
              id: `${Date.now()}_${Math.random()}`,
              killerName: myCallsign,
              victimName: eliminatedSoldier!.name,
              weaponName: activeWpn.name,
              isHeadshot: criticalHit,
              timestamp: Date.now(),
            });
            syncLocalPlayerState(activeRoomCodeRef.current, {
              playerId: localMpPlayerIdRef.current,
              studentName: prof?.name || 'Operative',
              className: prof?.className || 'Science Unit',
              avatarType: localMpAvatarRef.current,
              x: playerPosRef.current.x,
              y: Number(playerElevationYRef.current.toFixed(2)),
              z: playerPosRef.current.z,
              yaw: Number(cameraYawRef.current.toFixed(3)),
              pitch: Number(cameraPitchRef.current.toFixed(3)),
              aimX: aimPosRef.current.x,
              aimY: aimPosRef.current.y,
              inputSeq: predictionEngineRef.current.getCurrentSeq(),
              lastActivityAt: lastPlayerActivityRef.current,
              weaponId: currentWeaponRef.current.id,
              hp: playerHpRef.current,
              maxHp: 100,
              status: mpStatusRef.current,
              kills: killsRef.current,
              deaths: mpDeathsRef.current,
              score: scoreRef.current,
              accuracy: getLocalAccuracyPct(),
              isReady: true,
              shotSeq: localShotSeqRef.current,
              grenadeSeq: localGrenadeSeqRef.current,
              lastPing: Date.now(),
            });
            if (killsRef.current >= MATCH_KILL_LIMIT) {
              triggerMultiplayerMatchEndRef.current?.('kill_limit');
            }
          }

          if (eliminatedSoldier.isHelicopter || eliminatedSoldier.isRobot || eliminatedSoldier.isJet) {
            setBossInfo(null);
            // Award +2,500 Boss Eradication Bonus immediately and show triumph banner while letting Blériot/Airdrop/Hazard events continue!
            scoreRef.current += 2500;
            setScore(scoreRef.current);
            sounds.playVictory();
            setBossDefeatedBanner(true);
          }

          // Top Center 2-Second Killstreak (Double, Triple, Quadra, Penta, Immunoful, Leukocytastic, Bloody Monster!)
          const nowStreak = Date.now();
          if (nowStreak - lastKillTimeRef.current < 3200) {
            currentStreakRef.current += 1;
          } else {
            currentStreakRef.current = 1;
          }
          lastKillTimeRef.current = nowStreak;

          const streak = currentStreakRef.current;
          let label = 'TARGET ELIMINATED';
          let sublabel = '+100 XP';
          let color = '#38bdf8';

          if (streak === 2) { label = 'DOUBLE KILL!'; sublabel = '2X ELIMINATION'; color = '#22c55e'; }
          else if (streak === 3) { label = 'TRIPLE KILL!'; sublabel = '3X TACTICAL STREAK'; color = '#eab308'; }
          else if (streak === 4) { label = 'QUADRA KILL!'; sublabel = '4X DOMINATING'; color = '#f97316'; }
          else if (streak === 5) { label = 'PENTA KILL!'; sublabel = '5X UNSTOPPABLE'; color = '#ef4444'; }
          else if (streak === 6) { label = 'IMMUNOFUL!'; sublabel = 'CELLULAR OVERKILL'; color = '#ec4899'; }
          else if (streak === 7) { label = 'LEUKOCYTASTIC!'; sublabel = 'MAXIMUM WHITE CELL SUPREMACY'; color = '#a855f7'; }
          else if (streak >= 8) { label = 'BLOODY MONSTER!'; sublabel = `${streak}X GODLIKE CARNAGE`; color = '#f43f5e'; }

          setActiveStreak({ count: streak, label, sublabel, color, id: nowStreak });
          sounds.playKillstreak(streak);

          if (streakTimeoutRef.current) clearTimeout(streakTimeoutRef.current);
          streakTimeoutRef.current = setTimeout(() => {
            setActiveStreak(null);
          }, 2000);
        }
      } else if (isMultiplayerDeathmatch) {
        // In Multiplayer, players can also shoot and destroy Destructible Anatomical Cover Structures strictly in front of their center crosshair ray!
        const rayOrig = raycaster.ray.origin;
        const rayDir = raycaster.ray.direction;
        for (let bIdx = 0; bIdx < barricadesRef.current.length; bIdx++) {
          const bar = barricadesRef.current[bIdx];
          if (bar.hp <= 0) continue;
          _v2.set(bar.x, bar.y + 0.55, bar.z);
          const forwardBarDist =
            (_v2.x - rayOrig.x) * rayDir.x +
            (_v2.y - rayOrig.y) * rayDir.y +
            (_v2.z - rayOrig.z) * rayDir.z;
          if (forwardBarDist <= 0.4) continue;
          const distSqToCover = raycaster.ray.distanceSqToPoint(_v2);
          if (distSqToCover <= 1.25) {
            const coverDmg = Math.max(12, Math.round(baseNormalShotDamage * 0.48));
            const wasAlive = bar.hp > 0;
            bar.hp = Math.max(0, bar.hp - coverDmg);
            const pct = Math.max(0.01, bar.hp / bar.maxHp);
            bar.hpBarFill.scale.x = pct;
            bar.hpBarFill.position.x = -(1.38 * (1 - pct)) / 2;
            const mat = bar.hpBarFill.material as THREE.MeshBasicMaterial;
            if (pct > 0.5) mat.color.setHex(0x10b981);
            else if (pct > 0.25) mat.color.setHex(0xf59e0b);
            else mat.color.setHex(0xef4444);
            bar.group.position.y = bar.y - (1 - pct) * 0.18;
            sounds.playBarricadeHit();
            triggerSandDust(_v2);
            if (bar.hp <= 0 && wasAlive) {
              triggerExplosion(_v2);
              triggerMembraneDisintegration(_v2, 'bacillus');
              triggerBarricadeShatter(_v2);
              bar.group.visible = false;
              bar.respawnTimer = 0;
            }
            break;
          }
        }
      }
    }

    executeShotRef.current = executeShot;

    // Cached container rect avoids synchronous layout reflows on every touchmove/mousemove event!
    let cachedRect = container.getBoundingClientRect();
    let mouseEdgeNdcX = 0;
    let mouseEdgeNdcY = 0;
    let isMouseOverCanvas = false;

    // Professional FPS Aiming:
    // In Multiplayer Deathmatch, the crosshair stays locked in the dead center of the screen (0, 0 NDC / 50%, 50%)
    // and the player's field of view (camera yaw & pitch) follows their aim!
    const updateAimPosition = (clientX: number, clientY: number, isRelativeDrag: boolean = false, prevX?: number, prevY?: number) => {
      if (isMultiplayerDeathmatch) {
        targetAimPosRef.current.x = 0;
        targetAimPosRef.current.y = 0;
        aimPosRef.current.x = 0;
        aimPosRef.current.y = 0;
        lastPlayerActivityRef.current = Date.now();
        syncCrosshairDom(0, 0);
        return;
      }

      if (cachedRect.width === 0 || cachedRect.height === 0) {
        cachedRect = container.getBoundingClientRect();
      }
      const w = cachedRect.width || window.innerWidth;
      const h = cachedRect.height || window.innerHeight;

      if (isRelativeDrag && prevX !== undefined && prevY !== undefined) {
        const sens = isScopedRef.current
          ? currentWeaponRef.current.category === 'SNIPER'
            ? 0.72
            : 0.88
          : 1.15;
        const dxNorm = ((clientX - prevX) / w) * 2 * sens;
        const dyNorm = -((clientY - prevY) / h) * 2 * sens;
        targetAimPosRef.current.x = Math.max(-0.94, Math.min(0.94, targetAimPosRef.current.x + dxNorm));
        targetAimPosRef.current.y = Math.max(-0.90, Math.min(0.90, targetAimPosRef.current.y + dyNorm));
      } else {
        // True 1:1 cursor-to-crosshair & scope-reticle NDC mapping (Solo mode)
        const x = THREE.MathUtils.clamp(((clientX - cachedRect.left) / w) * 2 - 1, -0.94, 0.94);
        const y = THREE.MathUtils.clamp(-((clientY - cachedRect.top) / h) * 2 + 1, -0.90, 0.90);
        targetAimPosRef.current.x = x;
        targetAimPosRef.current.y = y;
      }

      lastPlayerActivityRef.current = Date.now();
      syncCrosshairDom(targetAimPosRef.current.x, targetAimPosRef.current.y);
    };

    let lastTouchInteractionTime = 0;

    // Dedicated Multi-Touch Handlers for Phone (Allows simultaneous Moving & Hold-Shoot Scoping!)
    const handleTouchStart = (e: TouchEvent) => {
      lastTouchInteractionTime = performance.now();
      if (e.cancelable) e.preventDefault(); // Prevents mobile OS long-press magnifying glass ("zooming lens")!
      sounds.unlockAudio();
      if (cachedRect.width === 0 || cachedRect.height === 0) {
        cachedRect = container.getBoundingClientRect();
      }
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const clientX = touch.clientX;
        const clientY = touch.clientY;
        const relX = clientX - cachedRect.left;
        const relY = clientY - cachedRect.top;

        // Dedicated bottom-left movement zone (left 30% width, bottom 35% height)
        const inMovementZone = relX < cachedRect.width * 0.30 && relY > cachedRect.height * 0.65;

        if (movementTouchIdRef.current === null && inMovementZone) {
          movementTouchIdRef.current = touch.identifier;
          movementTouchStartPosRef.current = { x: clientX, y: clientY, time: performance.now() };
          movementTouchActiveRef.current = false;
          joystickCenterRef.current = { x: clientX, y: clientY };
          joystickOffsetRef.current = { x: 0, y: 0 };
        } else if (firingTouchIdRef.current === null) {
          // Touch in Aim/Shoot Zone: tap fires from center crosshair (MP) or touch point (Solo), hold for 2s deploys tactical scope!
          firingTouchIdRef.current = touch.identifier;
          lastFiringTouchPosRef.current = { x: clientX, y: clientY };
          isPointerDownRef.current = true;
          startHoldShootScopeTimer();
          updateAimPosition(clientX, clientY, false);
          if (!isScopedRef.current) {
            aimPosRef.current.x = targetAimPosRef.current.x;
            aimPosRef.current.y = targetAimPosRef.current.y;
          }
          executeShot();
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      lastTouchInteractionTime = performance.now();
      if (e.cancelable) e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === movementTouchIdRef.current && joystickCenterRef.current) {
          const dx = touch.clientX - joystickCenterRef.current.x;
          const dy = touch.clientY - joystickCenterRef.current.y;
          const dist = Math.hypot(dx, dy);

          // Activate joystick UI & movement input after dragging past 7px deadzone threshold!
          if (!movementTouchActiveRef.current && dist > 7) {
            movementTouchActiveRef.current = true;
            setJoystickDisplay({ x: joystickCenterRef.current.x, y: joystickCenterRef.current.y });
            sounds.triggerHaptic(10, 'light');
          }

          if (movementTouchActiveRef.current) {
            const maxDist = 45;
            const clampedX = dist > 0 ? (dx / Math.max(dist, maxDist)) * Math.min(dist, maxDist) : 0;
            const clampedY = dist > 0 ? (dy / Math.max(dist, maxDist)) * Math.min(dist, maxDist) : 0;
            joystickOffsetRef.current = { x: clampedX, y: clampedY };
            if (joystickKnobDomRef.current) {
              joystickKnobDomRef.current.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
            }
            moveInputRef.current.x = clampedX / maxDist;
            moveInputRef.current.z = clampedY / maxDist;
          }
        } else if (touch.identifier === firingTouchIdRef.current) {
          const prevX = lastFiringTouchPosRef.current.x;
          const prevY = lastFiringTouchPosRef.current.y;
          lastFiringTouchPosRef.current = { x: touch.clientX, y: touch.clientY };
          if (isMultiplayerDeathmatch) {
            const touchSens = isScopedRef.current ? 0.0042 : 0.0078;
            targetCameraYawRef.current -= (touch.clientX - prevX) * touchSens;
            cameraBaseYawOffsetRef.current = targetCameraYawRef.current + mouseEdgeNdcX * Math.PI;
            targetCameraPitchRef.current = THREE.MathUtils.clamp(
              targetCameraPitchRef.current - (touch.clientY - prevY) * (touchSens * 0.78),
              -0.78,
              0.78
            );
          }
          updateAimPosition(touch.clientX, touch.clientY, true, prevX, prevY);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      lastTouchInteractionTime = performance.now();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === movementTouchIdRef.current) {
          // If touch in movement zone was a stationary tap (not dragged as movement), execute tap-shot!
          if (!movementTouchActiveRef.current && movementTouchStartPosRef.current) {
            const dt = performance.now() - movementTouchStartPosRef.current.time;
            const dist = Math.hypot(
              touch.clientX - movementTouchStartPosRef.current.x,
              touch.clientY - movementTouchStartPosRef.current.y
            );
            if (dt < 320 && dist < 12) {
              updateAimPosition(touch.clientX, touch.clientY, false);
              executeShot();
            }
          }

          movementTouchIdRef.current = null;
          movementTouchStartPosRef.current = null;
          movementTouchActiveRef.current = false;
          joystickCenterRef.current = null;
          joystickOffsetRef.current = { x: 0, y: 0 };
          setJoystickDisplay(null);
          moveInputRef.current.x = 0;
          moveInputRef.current.z = 0;
        }
        if (touch.identifier === firingTouchIdRef.current) {
          firingTouchIdRef.current = null;
          isPointerDownRef.current = false;
          syncLiveAmmoDom();
          cancelHoldShootScope();
        }
      }
    };

    // Desktop Mouse Handlers (Hold Left-Click 2s deploys optic sight, Right-Click locks optic!)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    let hasInitializedMousePos = false;
    let lastOutwardEdgeMoveTime = 0;

    // Official Three.js PointerLockControls for authentic FPS mouse-look when Pointer Lock is active
    const plcTarget = new THREE.PerspectiveCamera();
    plcTarget.rotation.order = 'YXZ';
    plcTarget.rotation.y = targetCameraYawRef.current;
    plcTarget.rotation.x = targetCameraPitchRef.current;
    const pointerLockControls = new PointerLockControls(plcTarget, container);
    pointerLockControls.minPolarAngle = Math.PI * 0.5 - 0.65;
    pointerLockControls.maxPolarAngle = Math.PI * 0.5 + 0.65;
    pointerLockControls.pointerSpeed = 0.85;

    const handlePlcChange = () => {
      if (!isMultiplayerDeathmatch) return;
      plcTarget.rotation.order = 'YXZ';
      targetCameraYawRef.current = plcTarget.rotation.y;
      cameraBaseYawOffsetRef.current = plcTarget.rotation.y;
      targetCameraPitchRef.current = THREE.MathUtils.clamp(plcTarget.rotation.x, -0.65, 0.65);
    };
    pointerLockControls.addEventListener('change', handlePlcChange);

    const tryEngageMpPointerLock = () => {
      if (
        isMultiplayerDeathmatch &&
        mpStatusRef.current === 'active' &&
        !isGamePausedRef.current &&
        !mpMatchEndedRef.current &&
        !isPausedForConceptRef.current &&
        !pointerLockControls.isLocked &&
        document.pointerLockElement !== container
      ) {
        plcTarget.rotation.order = 'YXZ';
        plcTarget.rotation.y = targetCameraYawRef.current;
        plcTarget.rotation.x = targetCameraPitchRef.current;
        try {
          const lockPromise = (
            container as HTMLElement & { requestPointerLock?: () => Promise<void> | void }
          ).requestPointerLock?.();
          if (lockPromise && typeof (lockPromise as Promise<void>).catch === 'function') {
            (lockPromise as Promise<void>).catch(() => {});
          }
        } catch {
          // Ignore if browser throttles pointer lock immediately after Escape
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (performance.now() - lastTouchInteractionTime < 1000) return;
      if (e.target instanceof Element && e.target.closest('button, input, a, select, textarea')) return;
      sounds.unlockAudio();
      if (audioSuspendedRef.current) {
        audioSuspendedRef.current = false;
        setAudioSuspended(false);
      }

      if (isMultiplayerDeathmatch) {
        tryEngageMpPointerLock();
      } else if (document.pointerLockElement) {
        pointerLockControls.unlock();
      }

      lastMouseClientPosRef.current = { x: e.clientX, y: e.clientY };
      hasInitializedMousePos = true;
      if (e.button === 2) {
        e.preventDefault();
        handleToggleScope();
        return;
      }
      isPointerDownRef.current = true;
      startHoldShootScopeTimer();
      updateAimPosition(e.clientX, e.clientY, false);
      aimPosRef.current.x = targetAimPosRef.current.x;
      aimPosRef.current.y = targetAimPosRef.current.y;
      executeShot();
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Ignore synthetic mousemove events generated after tapping HUD buttons on touchscreen devices
      if (performance.now() - lastTouchInteractionTime < 1000) return;
      pointerLockControls.pointerSpeed = isScopedRef.current ? 0.45 : 0.85;

      // When Three.js PointerLockControls is locked, it natively handles camera rotation via its 'change' event!
      if (isMultiplayerDeathmatch && (pointerLockControls.isLocked || document.pointerLockElement === container)) {
        lastOutwardEdgeMoveTime = 0;
        lastMouseClientPosRef.current = { x: e.clientX, y: e.clientY };
        hasInitializedMousePos = true;
        updateAimPosition(e.clientX, e.clientY, false);
        return;
      }

      if (e.target instanceof Element && e.target.closest('button, input, a, select, textarea')) {
        isMouseOverCanvas = false;
        mouseEdgeNdcX = 0;
        lastOutwardEdgeMoveTime = 0;
        lastMouseClientPosRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      if (cachedRect.width === 0 || cachedRect.height === 0) {
        cachedRect = container.getBoundingClientRect();
      }
      const w = cachedRect.width || window.innerWidth;
      const h = cachedRect.height || window.innerHeight;
      isMouseOverCanvas = true;

      const normX = THREE.MathUtils.clamp(((e.clientX - cachedRect.left) / w) * 2 - 1, -1, 1);
      const normY = THREE.MathUtils.clamp(-((e.clientY - cachedRect.top) / h) * 2 + 1, -1, 1);
      mouseEdgeNdcX = normX;
      mouseEdgeNdcY = normY;

      if (isMultiplayerDeathmatch) {
        // 100% Uniform Linear Fallback (when Pointer Lock is not active, e.g., inside a sandboxed iframe):
        // Constant 1:1 sensitivity in both directions — ZERO latch/stuck delay and ZERO sudden pull/acceleration!
        const dx =
          typeof e.movementX === 'number' && e.movementX !== 0
            ? e.movementX
            : hasInitializedMousePos && lastMouseClientPosRef.current
            ? e.clientX - lastMouseClientPosRef.current.x
            : 0;
        const dy =
          typeof e.movementY === 'number' && e.movementY !== 0
            ? e.movementY
            : hasInitializedMousePos && lastMouseClientPosRef.current
            ? e.clientY - lastMouseClientPosRef.current.y
            : 0;

        lastMouseClientPosRef.current = { x: e.clientX, y: e.clientY };
        hasInitializedMousePos = true;

        if (Math.abs(dx) > 300 || Math.abs(dy) > 300) {
          return;
        }

        const baseSens = isScopedRef.current ? 0.0028 : 0.0054;
        targetCameraYawRef.current -= dx * baseSens;
        cameraBaseYawOffsetRef.current = targetCameraYawRef.current;
        targetCameraPitchRef.current = THREE.MathUtils.clamp(
          targetCameraPitchRef.current - dy * (baseSens * 0.75),
          -0.65,
          0.65
        );
        plcTarget.rotation.order = 'YXZ';
        plcTarget.rotation.y = targetCameraYawRef.current;
        plcTarget.rotation.x = targetCameraPitchRef.current;

        // If cursor is at the extreme 8% border (|normX| > 0.90) and user is actively pushing outward (dx * normX >= 0),
        // allow a smooth, constant-speed 260ms continuation so they can continue rotating past 360°;
        // the instant they move 1px in the opposite direction (dx * normX < 0), cancel immediately so it never feels stuck!
        if (Math.abs(normX) > 0.90 && normY > -0.72 && dx * normX >= 0) {
          lastOutwardEdgeMoveTime = performance.now();
        } else if (dx * normX < 0 || Math.abs(normX) <= 0.90) {
          lastOutwardEdgeMoveTime = 0;
        }
      } else {
        targetCameraYawRef.current = -normX * Math.PI;
        targetCameraPitchRef.current = THREE.MathUtils.clamp(normY * 0.24, -0.55, 0.55);
        lastMouseClientPosRef.current = { x: e.clientX, y: e.clientY };
        hasInitializedMousePos = true;
      }

      updateAimPosition(e.clientX, e.clientY, false);
    };

    const handleMouseLeave = () => {
      isMouseOverCanvas = false;
      mouseEdgeNdcX = 0;
      lastOutwardEdgeMoveTime = 0;
      hasInitializedMousePos = false;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) return;
      isPointerDownRef.current = false;
      syncLiveAmmoDom();
      cancelHoldShootScope();
    };

    // Keyboard controls for Laptop (WASD movement, F Sight Scope, R reload, Space/E stim, G grenade, Q swap, T airdrop, M sound)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPausedForConceptRef.current) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          e.preventDefault();
          handleDismissConceptCardRef.current?.();
        }
        return;
      }
      lastPlayerActivityRef.current = Date.now();
      keysDownRef.current[e.key.toLowerCase()] = true;

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (document.pointerLockElement) {
          document.exitPointerLock?.();
        }
        sounds.unlockAudio();
        sounds.triggerHaptic(14, 'medium');
        setIsGamePaused((prev) => !prev);
        return;
      }

      // Automatically engage Pointer Lock on any active combat/movement keypress in Multiplayer
      if (isMultiplayerDeathmatch) {
        tryEngageMpPointerLock();
      }

      if (e.key === '1') {
        const list = availableWeapons && availableWeapons.length > 0 ? availableWeapons : INITIAL_WEAPONS;
        if (list[0]) handleSelectWeapon(list[0]);
      } else if (e.key === '2') {
        const list = availableWeapons && availableWeapons.length > 0 ? availableWeapons : INITIAL_WEAPONS;
        if (list[1]) handleSelectWeapon(list[1]);
      } else if (e.key === '3') {
        const list = availableWeapons && availableWeapons.length > 0 ? availableWeapons : INITIAL_WEAPONS;
        if (list[2]) handleSelectWeapon(list[2]);
      } else if (e.key === '4') {
        const list = availableWeapons && availableWeapons.length > 0 ? availableWeapons : INITIAL_WEAPONS;
        if (list[3]) handleSelectWeapon(list[3]);
      } else if (e.key === 'r' || e.key === 'R') {
        handleReloadRef.current ? handleReloadRef.current() : handleReload();
      } else if (e.key === 'f' || e.key === 'F') {
        handleToggleScope();
      } else if (e.key === ' ' || e.key === 'e' || e.key === 'E') {
        handleStimpackRef.current ? handleStimpackRef.current() : handleStimpack();
      } else if (e.key === 'g' || e.key === 'G') {
        handleThrowGrenadeRef.current ? handleThrowGrenadeRef.current() : handleThrowGrenade();
      } else if (e.key === 'q' || e.key === 'Q') {
        handleSwapWeaponRef.current ? handleSwapWeaponRef.current() : handleSwapWeapon();
      } else if (!isMultiplayerDeathmatch && (e.key === 't' || e.key === 'T')) {
        handleAirdropReinforcementsRef.current ? handleAirdropReinforcementsRef.current() : handleAirdropReinforcements();
      } else if (e.key === 'n' || e.key === 'N' || e.key === 'v' || e.key === 'V') {
        handleToggleVisionMode();
      } else if (e.key === 'm' || e.key === 'M') {
        handleSoundToggle();
      } else if (e.key === 'Control' || e.key === 'c' || e.key === 'C') {
        if (isMultiplayerDeathmatch) {
          e.preventDefault();
          isCrouchingRef.current = true;
          setIsCrouching(true);
        }
      } else if (e.key === 'Shift') {
        if (isMultiplayerDeathmatch && !isSprintExhaustedRef.current) {
          isSprintingRef.current = true;
          setIsSprinting(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDownRef.current[e.key.toLowerCase()] = false;
      if (e.key === 'Control' || e.key === 'c' || e.key === 'C') {
        if (!crouchToggleRef.current) {
          isCrouchingRef.current = false;
          setIsCrouching(false);
        }
      } else if (e.key === 'Shift') {
        if (!sprintToggleRef.current) {
          isSprintingRef.current = false;
          setIsSprinting(false);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (isPausedForConceptRef.current || isGamePausedRef.current) return;
      e.preventDefault();
      const now = performance.now();
      if (now - lastWheelTimeRef.current < 120) return;
      lastWheelTimeRef.current = now;

      const list = availableWeapons && availableWeapons.length > 0 ? availableWeapons : INITIAL_WEAPONS;
      const currentIdx = list.findIndex((w) => w.id === currentWeaponRef.current.id);
      const dir = e.deltaY > 0 ? 1 : -1;
      const nextIdx = (currentIdx + dir + list.length) % list.length;
      if (list[nextIdx]) {
        handleSelectWeapon(list[nextIdx]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    const handleResize = () => {
      if (!container) return;
      cachedRect = container.getBoundingClientRect();
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // ANIMATION & 60 FPS SIMULATION LOOP (High-precision performance.now() timer — avoids deprecated THREE.Clock!)
    let animationFrameId = 0;
    let lastFrameTime = performance.now();
    let elapsedAccumulator = 0;
    let physicsAccumulator = 0;
    const barricadeSpatialGrid = new SpatialPartitionGrid<ActiveBarricade>(3.5);
    const soldierSpatialGrid = new SpatialPartitionGrid<ActiveSoldier>(4.5);
    let lastDamageTakenTime = 0;
    let regenAccumulator = 0;
    let lastCoverState = false;
    let lastCoverHp = 100;
    let lastTargetLockedState = false;
    let lastHudSyncTime = 0;
    let prevLocksKey = '';
    let prevBlipsKey = '';
    let prevCompassKey = '';
    let prevPlayerX = 0;
    let smoothedPlayerVelX = 0;

    // Helper: Trigger Dynamic Screen Shake & Haptics (scales up as HP lowers, zero React state re-render overhead!)
    const triggerDirectionalDamageFeedback = (
      sourceX: number,
      _sourceZ: number,
      damageAmount: number,
      sourceType: DirectionalDamageIndicator['sourceType'],
      _isSplash: boolean
    ) => {
      sounds.triggerHaptic([45, 25, 50], 'heavy');
      const currentHp = Math.max(0, playerHpRef.current);
      const lowHpMultiplier = 1 + ((100 - currentHp) / 100) * 1.25;
      const baseTrauma =
        sourceType === 'BOSS MISSILE'
          ? 0.62
          : sourceType === 'MORTAR SPLASH'
          ? 0.56
          : sourceType === 'TANK SHELL'
          ? 0.52
          : 0.34;
      const shakePower = Math.min(1.45, (baseTrauma + (damageAmount / 100) * 0.45) * lowHpMultiplier);
      cameraShakeRef.current = Math.max(cameraShakeRef.current, shakePower);

      const relX = sourceX - playerPosRef.current.x;
      const sideSign = relX < -0.25 ? -1 : relX > 0.25 ? 1 : (Math.random() < 0.5 ? -1 : 1);
      cameraRollShakeRef.current = sideSign * shakePower * 0.085;
    };

    let lastReactHpSyncTime = 0;
    let lastSyncedReactHp = playerHpRef.current;

    const syncPlayerHpToReact = (nowMs: number, force = false) => {
      const curHp = Math.round(playerHpRef.current);
      if (curHp !== lastSyncedReactHp && (force || curHp <= 0 || curHp >= 100 || nowMs - lastReactHpSyncTime >= 160)) {
        lastSyncedReactHp = curHp;
        lastReactHpSyncTime = nowMs;
        setPlayerHp(curHp);
      }
    };

    function animate() {
      const nowTime = performance.now();
      // Freeze 3D simulation & timer delta when paused for a Concept Popup, User Pause Menu, or Multiplayer Match Victory Podium!
      if (isPausedForConceptRef.current || isGamePausedRef.current || mpMatchEndedRef.current) {
        lastFrameTime = nowTime;
        if (!renderedPausedFrameRef.current) {
          renderedPausedFrameRef.current = true;
          renderer.render(scene, camera);
        }
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      const rawElapsedMs = nowTime - lastFrameTime;
      const frameDelta = Math.min(Math.max(0.001, rawElapsedMs / 1000), 0.05);
      lastFrameTime = nowTime;
      elapsedAccumulator += frameDelta;
      const elapsed = elapsedAccumulator;
      // Use real frameDelta (clamped to <=50ms) so 60Hz, 120Hz, 144Hz, and 240Hz devices all move at the exact same speed!
      physicsAccumulator = Math.min(physicsAccumulator + frameDelta, FIXED_DELTA_TIME * MAX_PHYSICS_SUBSTEPS);
      const delta = frameDelta;

      // Rebuild 2D Spatial Partitioning Grids for O(1) localized collision lookups
      barricadeSpatialGrid.clear();
      for (let bi = 0; bi < barricadesRef.current.length; bi++) {
        const bar = barricadesRef.current[bi];
        if (bar.hp > 0) {
          barricadeSpatialGrid.insert(bar.x, bar.z, bar, 1.4);
        }
      }
      soldierSpatialGrid.clear();
      for (let si = 0; si < activeSoldiersRef.current.length; si++) {
        const sol = activeSoldiersRef.current[si];
        soldierSpatialGrid.insert(sol.mesh.position.x, sol.mesh.position.z, sol, sol.isBoss ? 2.5 : sol.isTank ? 1.8 : 0.9);
      }

      // 1. UPDATE PLAYER 3D POSITION (Left/Right & Front/Back Movement)
      let inputX = moveInputRef.current.x;
      let inputZ = moveInputRef.current.z;

      // Keyboard WASD input
      if (keysDownRef.current['a'] || keysDownRef.current['arrowleft']) inputX -= 1;
      if (keysDownRef.current['d'] || keysDownRef.current['arrowright']) inputX += 1;
      if (keysDownRef.current['w'] || keysDownRef.current['arrowup']) inputZ -= 1;
      if (keysDownRef.current['s'] || keysDownRef.current['arrowdown']) inputZ += 1;

      // Normalize movement vector so diagonal WASD movement or combined inputs never exceed 1.0x base speed
      const inputMag = Math.hypot(inputX, inputZ);
      if (inputMag > 1) {
        inputX /= inputMag;
        inputZ /= inputMag;
      }

      if (isMultiplayerDeathmatch && mpStatusRef.current !== 'active') {
        inputX = 0;
        inputZ = 0;
        isPointerDownRef.current = false;
      }

      // MULTIPLAYER CROUCH [CTRL] & SPRINT [SHIFT] WITH REFILLABLE ATP SPRINT ENERGY BAR
      const isMovingNow = Math.abs(inputX) > 0.05 || Math.abs(inputZ) > 0.05;
      const wantCrouch =
        isMultiplayerDeathmatch &&
        (Boolean(keysDownRef.current['control']) ||
          Boolean(keysDownRef.current['c']) ||
          crouchToggleRef.current);
      if (wantCrouch !== isCrouchingRef.current) {
        isCrouchingRef.current = wantCrouch;
        setIsCrouching(wantCrouch);
      }

      const wantSprint =
        isMultiplayerDeathmatch &&
        isMovingNow &&
        !isCrouchingRef.current &&
        !isSprintExhaustedRef.current &&
        (Boolean(keysDownRef.current['shift']) || sprintToggleRef.current);
      if (wantSprint !== isSprintingRef.current) {
        isSprintingRef.current = wantSprint;
        setIsSprinting(wantSprint);
      }

      if (isMultiplayerDeathmatch) {
        if (isSprintingRef.current) {
          // Drain Sprint Energy while sprinting
          sprintEnergyRef.current = Math.max(0, sprintEnergyRef.current - 28.0 * delta);
          if (sprintEnergyRef.current <= 0) {
            sprintEnergyRef.current = 0;
            isSprintExhaustedRef.current = true;
            setIsSprintExhausted(true);
            isSprintingRef.current = false;
            sprintToggleRef.current = false;
            setIsSprinting(false);
            sounds.playDryFire();
          }
        } else {
          // Refill Sprint Energy when not sprinting; if exhausted, must refill to 100% before sprinting again!
          sprintEnergyRef.current = Math.min(100, sprintEnergyRef.current + 22.0 * delta);
          if (isSprintExhaustedRef.current && sprintEnergyRef.current >= 100) {
            sprintEnergyRef.current = 100;
            isSprintExhaustedRef.current = false;
            setIsSprintExhausted(false);
            sounds.playRadioChirp();
          }
        }

        // Direct DOM update for 60 FPS Sprint Energy Bar (Zero React VDOM re-renders!)
        if (sprintBarFillDomRef.current) {
          const pct = Math.round(sprintEnergyRef.current);
          sprintBarFillDomRef.current.style.width = `${pct}%`;
          sprintBarFillDomRef.current.style.background = isSprintExhaustedRef.current
            ? 'linear-gradient(90deg, #e11d48 0%, #f43f5e 100%)'
            : 'linear-gradient(90deg, #d97706 0%, #f59e0b 55%, #fde047 100%)';
        }
        if (sprintBarTextDomRef.current) {
          const pct = Math.round(sprintEnergyRef.current);
          sprintBarTextDomRef.current.textContent = isSprintExhaustedRef.current
            ? `REFILLING ${pct}% (WAIT 100%)`
            : `${pct} | 100`;
        }
      }

      const baseMoveSpeed = isScopedRef.current ? 4.8 : isMultiplayerDeathmatch ? 7.8 : 6.2;
      const postureSpeedMult = isCrouchingRef.current
        ? 0.62
        : isSprintingRef.current
        ? 1.68
        : 1.0;
      const speedMultSuper = superAbilitiesRef.current['supersonic_speed'] && nowTime < superAbilitiesRef.current['supersonic_speed'] ? 1.6 : 1.0;
      const moveSpeed = baseMoveSpeed * postureSpeedMult * speedMultSuper;

      if (isMultiplayerDeathmatch) {
        if (isMovingNow || isPointerDownRef.current) {
          lastPlayerActivityRef.current = Date.now();
        }

        // Consume any smooth server reconciliation corrections for position (keep crosshair locked at center 0,0 in Multiplayer!)
        const corr = predictionEngineRef.current.consumeFrameCorrection(delta);
        targetAimPosRef.current.x = 0;
        targetAimPosRef.current.y = 0;
        aimPosRef.current.x = 0;
        aimPosRef.current.y = 0;

        // When Pointer Lock is not active and the user actively pushes the mouse into the outer 8% border (|normX| > 0.90),
        // continue rotating at a steady, even speed for 260ms after mouse movement stops (zero infinite spin, zero pull!).
        if (
          !pointerLockControls.isLocked &&
          document.pointerLockElement !== container &&
          isMouseOverCanvas &&
          Math.abs(mouseEdgeNdcX) > 0.90 &&
          mouseEdgeNdcY > -0.72 &&
          nowTime - lastOutwardEdgeMoveTime < 260
        ) {
          const steadySpeed = isScopedRef.current ? 0.85 : 1.55;
          targetCameraYawRef.current -= Math.sign(mouseEdgeNdcX) * steadySpeed * delta;
          cameraBaseYawOffsetRef.current = targetCameraYawRef.current;
          plcTarget.rotation.y = targetCameraYawRef.current;
        }

        // Smooth, controlled camera FOV rotation following targetCameraYawRef & targetCameraPitchRef
        cameraYawRef.current = THREE.MathUtils.damp(
          cameraYawRef.current,
          targetCameraYawRef.current,
          20,
          delta
        );
        cameraPitchRef.current = THREE.MathUtils.damp(
          cameraPitchRef.current,
          targetCameraPitchRef.current,
          16,
          delta
        );

        const yaw = cameraYawRef.current;
        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);

        const worldMoveX = inputX * cosY + inputZ * sinY;
        const worldMoveZ = -inputX * sinY + inputZ * cosY;

        const prevPos = { x: playerPosRef.current.x, z: playerPosRef.current.z };
        const nextPos = {
          x: playerPosRef.current.x + worldMoveX * moveSpeed * delta + corr.dx,
          z: playerPosRef.current.z + worldMoveZ * moveSpeed * delta + corr.dz,
        };

        const wallRes = applySolidWallCollisions(
          prevPos,
          nextPos,
          playerElevationYRef.current,
          playerIsRooftopRef.current,
          playerIsInsideBuildingRef.current,
          barricadesRef.current,
          barricadeSpatialGrid
        );
        playerPosRef.current.x = wallRes.x;
        playerPosRef.current.z = wallRes.z;
        const invDt = 1 / Math.max(0.008, delta);
        playerWorldVelRef.current.vx = THREE.MathUtils.clamp((wallRes.x - prevPos.x) * invDt, -14.0, 14.0);
        playerWorldVelRef.current.vz = THREE.MathUtils.clamp((wallRes.z - prevPos.z) * invDt, -14.0, 14.0);
        playerIsRooftopRef.current = wallRes.isRooftop;
        playerIsInsideBuildingRef.current = wallRes.isInside;
        playerElevationYRef.current = THREE.MathUtils.damp(
          playerElevationYRef.current,
          wallRes.elevationY,
          18,
          delta
        );

        // Record client-predicted movement and aiming step in ring buffer for server reconciliation
        predictionEngineRef.current.recordInputStep({
          timestamp: nowTime,
          dt: delta,
          worldMoveX,
          worldMoveZ,
          moveSpeed,
          aimX: aimPosRef.current.x,
          aimY: aimPosRef.current.y,
          yaw: cameraYawRef.current,
          pitch: cameraPitchRef.current,
          predictedX: playerPosRef.current.x,
          predictedY: playerElevationYRef.current,
          predictedZ: playerPosRef.current.z,
        });

        camera.rotation.order = 'YXZ';
        camera.rotation.y = cameraYawRef.current;
        camera.rotation.x = cameraPitchRef.current;
        camera.rotation.z = 0;
      } else {
        playerPosRef.current.x += inputX * moveSpeed * delta;
        playerPosRef.current.z += inputZ * moveSpeed * delta;
        playerElevationYRef.current = 0;
      }

      // Clamp movement within organ tunnel (Solo) / expansive 20-Player Open Lung & Alveoli Landscape (Multiplayer: 64m wide x 58m deep!)
      const maxLateralBound = isMultiplayerDeathmatch ? 32.0 : 3.5;
      const minForwardBound = isMultiplayerDeathmatch ? -46.0 : -2.6;
      const maxRearBound = isMultiplayerDeathmatch ? 12.0 : 2.0;
      playerPosRef.current.x = Math.max(-maxLateralBound, Math.min(maxLateralBound, playerPosRef.current.x));
      playerPosRef.current.z = Math.max(minForwardBound, Math.min(maxRearBound, playerPosRef.current.z));

      // Track smoothed lateral player velocity so Enemy AI can predictively lead shots!
      const instVelX = (playerPosRef.current.x - prevPlayerX) / Math.max(0.008, delta);
      prevPlayerX = playerPosRef.current.x;
      smoothedPlayerVelX = THREE.MathUtils.damp(smoothedPlayerVelX, instVelX, 8, delta);

      // 2. UPDATE CAMERA, DYNAMIC HP-SCALED SCREEN SHAKE, CROUCH POSTURE, SIGHT SCOPE ZOOM (ADS) & RESPONSIVE PITCH/YAW AIMING
      const shakeAmt = isMultiplayerDeathmatch ? 0 : cameraShakeRef.current;
      const shakeX =
        shakeAmt > 0.005
          ? (Math.sin(elapsed * 58) * 0.65 + (Math.random() - 0.5) * 0.75) * shakeAmt
          : 0;
      const shakeY =
        shakeAmt > 0.005
          ? (Math.cos(elapsed * 64) * 0.65 + (Math.random() - 0.5) * 0.75) * shakeAmt
          : 0;

      const targetCrouchY = isCrouchingRef.current ? -0.52 : 0;
      crouchCameraYRef.current = THREE.MathUtils.damp(crouchCameraYRef.current, targetCrouchY, 14, delta);

      camera.position.x = playerPosRef.current.x + shakeX;
      camera.position.y = playerElevationYRef.current + crouchCameraYRef.current + shakeY;
      camera.position.z = playerPosRef.current.z;

      // ------------------------------------------------------------------
      // HELICOPTER SUPPLY DROP & SUPER-ABILITY SYSTEM (EVERY 15s)
      // ------------------------------------------------------------------
      if (isMultiplayerDeathmatch) {
        const dropState = supplyDropStateRef.current;

        // Keep flying the military transport helicopter across the sky to the far horizon even after dropping the cargo net!
        if (dropState.chopperActive && dropState.chopperMesh) {
          if (dropState.chopperRotor) dropState.chopperRotor.rotation.y += 28 * delta;
          if (dropState.chopperTailRotor) dropState.chopperTailRotor.rotation.x += 34 * delta;

          const endX = dropState.chopperEndX ?? dropState.targetX + 90;
          const endZ = dropState.chopperEndZ ?? dropState.targetZ + 70;
          const dxEnd = endX - dropState.chopperMesh.position.x;
          const dzEnd = endZ - dropState.chopperMesh.position.z;
          const distToEnd = Math.hypot(dxEnd, dzEnd);

          if (distToEnd <= 2.5) {
            dropState.chopperActive = false;
            dropState.chopperMesh.visible = false;
          } else {
            const flySpeed = 28.0;
            dropState.chopperMesh.position.x += (dxEnd / distToEnd) * flySpeed * delta;
            dropState.chopperMesh.position.z += (dzEnd / distToEnd) * flySpeed * delta;
            dropState.chopperMesh.position.y = 9.6 + Math.sin(nowTime * 0.006) * 0.18;
          }
        }

        if (dropState.phase === 'idle' && nowTime >= dropState.nextDropTime - 2500) {
          dropState.phase = 'pinging';
          dropState.pingStartTime = nowTime;
          dropState.lastPingSec = -1;
          // Choose an open drop zone near the arena where the player can clearly see the incoming helicopter
          const sideSign = Math.random() < 0.5 ? -1 : 1;
          dropState.targetX = sideSign * (11.5 + Math.random() * 9.5);
          dropState.targetZ = -12.0 - Math.random() * 14.0;

          const abilityOptions = [
            { type: 'burning_bullets', label: 'BURNING BULLETS (15s)' },
            { type: 'supersonic_speed', label: 'SUPERSONIC SPEED (15s)' },
            { type: 'immortality', label: 'IMMORTALITY (10s)' },
            { type: 'double_xp', label: 'DOUBLE XP (30s)' },
            { type: 'postpone_question', label: 'POSTPONE QUESTION (+15s)' },
            { type: 't_cytotoxic_laser', label: 'T-CYTOTOXIC LASER (10s)' },
            { type: 'biotoxic_rpg', label: 'BIOTOXIC RPG (10s)' },
          ];
          const chosen = abilityOptions[Math.floor(Math.random() * abilityOptions.length)];
          dropState.abilityType = chosen.type;
          dropState.abilityLabel = chosen.label;

          if (dropState.beaconMesh) {
            const groundElev = getArenaSurfaceElevation(dropState.targetX, dropState.targetZ, 0).elevationY;
            dropState.beaconMesh.position.set(dropState.targetX, groundElev - 1.62, dropState.targetZ);
            dropState.beaconMesh.visible = true;
          }
          sounds.playSupplyDropPing();
        }

        if (dropState.phase === 'pinging') {
          const elapsedPing = (nowTime - dropState.pingStartTime) / 1000;
          const secsLeft = Math.max(0, Math.ceil(2.5 - elapsedPing));

          // Update React state only once per second (1Hz) instead of every frame (60Hz) to eliminate VDOM stutter!
          if (secsLeft !== dropState.lastPingSec) {
            dropState.lastPingSec = secsLeft;
            const distToPing = Math.hypot(
              playerPosRef.current.x - dropState.targetX,
              playerPosRef.current.z - dropState.targetZ
            );
            setSupplyDropPingAlert({
              x: Math.round(dropState.targetX),
              z: Math.round(dropState.targetZ),
              dist: Math.round(distToPing),
              secondsLeft: secsLeft,
              abilityName: dropState.abilityLabel || 'SUPER POWER-UP',
            });
          }

          if (dropState.beaconMesh) {
            dropState.beaconMesh.rotation.y += 2.0 * delta;
            const pulse = 1.0 + Math.sin(nowTime * 0.012) * 0.25;
            dropState.beaconMesh.scale.set(pulse, 1, pulse);
          }

          if (elapsedPing >= 2.5) {
            dropState.phase = 'chopper_inbound';
            setSupplyDropPingAlert(null);

            // Spawn military supply helicopter on the distant horizon flying across the drop zone to the opposite horizon!
            const startX = dropState.targetX - 65;
            const startZ = dropState.targetZ - 65;
            const endX = dropState.targetX + 75;
            const endZ = dropState.targetZ + 75;
            dropState.chopperStartX = startX;
            dropState.chopperStartZ = startZ;
            dropState.chopperEndX = endX;
            dropState.chopperEndZ = endZ;
            dropState.chopperActive = true;

            if (dropState.chopperSlungNet) {
              dropState.chopperSlungNet.visible = true;
            }
            if (dropState.chopperMesh) {
              dropState.chopperMesh.position.set(startX, 9.6, startZ);
              dropState.chopperMesh.lookAt(endX, 9.6, endZ);
              dropState.chopperMesh.visible = true;
            }
            sounds.playHelicopterRotor();
          }
        }

        if (dropState.phase === 'chopper_inbound') {
          if (dropState.chopperMesh) {
            const distToDropZone = Math.hypot(
              dropState.chopperMesh.position.x - dropState.targetX,
              dropState.chopperMesh.position.z - dropState.targetZ
            );

            // Release the supply net when the flying helicopter passes over the drop zone!
            if (distToDropZone <= 3.2 || dropState.chopperMesh.position.z >= dropState.targetZ) {
              dropState.phase = 'dropping';
              dropState.dropY = 8.4;
              dropState.dropVy = -2.0;

              if (dropState.chopperSlungNet) {
                dropState.chopperSlungNet.visible = false;
              }
              if (dropState.cargoNetMesh) {
                dropState.cargoNetMesh.position.set(dropState.targetX, dropState.dropY, dropState.targetZ);
                dropState.cargoNetMesh.visible = true;
              }
            }
          }
        }

        if (dropState.phase === 'dropping') {
          if (dropState.cargoNetMesh) {
            dropState.dropVy -= 18.0 * delta;
            dropState.dropY += dropState.dropVy * delta;

            const groundY = getArenaSurfaceElevation(dropState.targetX, dropState.targetZ, 0).elevationY - 1.25;

            if (dropState.dropY <= groundY) {
              dropState.dropY = groundY;
              dropState.phase = 'active_crate';
              dropState.cargoNetMesh.visible = false;

              _v4.set(dropState.targetX, groundY + 0.5, dropState.targetZ);
              triggerExplosion(_v4);
              sounds.playSupplyNetImpact();

              if (dropState.crateMesh) {
                dropState.crateMesh.position.set(dropState.targetX, groundY + 0.45, dropState.targetZ);
                dropState.crateMesh.visible = true;
              }

              if (dropState.beaconMesh) dropState.beaconMesh.visible = false;
            } else {
              dropState.cargoNetMesh.position.y = dropState.dropY;
              dropState.cargoNetMesh.rotation.y += 2.6 * delta;
            }
          }
        }

        if (dropState.phase === 'active_crate') {
          if (dropState.crateMesh) {
            dropState.crateMesh.rotation.y += 1.8 * delta;
            const baseCrateY = getArenaSurfaceElevation(dropState.targetX, dropState.targetZ, 0).elevationY - 1.15;
            dropState.crateMesh.position.y = baseCrateY + Math.sin(nowTime * 0.005) * 0.15;

            const dPlayer = Math.hypot(
              playerPosRef.current.x - dropState.targetX,
              playerPosRef.current.z - dropState.targetZ
            );
            if (dPlayer < 2.6) {
              const type = dropState.abilityType || 'burning_bullets';
              const label = dropState.abilityLabel || 'SUPER POWER-UP';
              const durationMs =
                type === 'double_xp'
                  ? 30000
                  : type === 'immortality' || type === 't_cytotoxic_laser' || type === 'biotoxic_rpg'
                  ? 10000
                  : 15000;

              if (type === 'postpone_question') {
                timeLeftRef.current += 15;
                if (liveTimerDomRef.current) {
                  liveTimerDomRef.current.textContent = `${timeLeftRef.current}S`;
                }
                if (soloWaveTimerDomRef.current) {
                  soloWaveTimerDomRef.current.textContent = `0:${
                    timeLeftRef.current < 10 ? `0${timeLeftRef.current}` : timeLeftRef.current
                  }`;
                }
                setTimeLeft(timeLeftRef.current);
              }

              superAbilitiesRef.current[type] = nowTime + durationMs;
              setActiveSuperAbilities({ ...superAbilitiesRef.current });
              sounds.playSuperAbilityAward();

              setPowerUpToast({ text: `AWARDED: ${label}!`, icon: '⚡', color: '#f59e0b' });
              setTimeout(() => setPowerUpToast(null), 3500);

              dropState.crateMesh.visible = false;
              dropState.phase = 'idle';
              dropState.nextDropTime = nowTime + 15000;
            }
          }
        }

        let abChanged = false;
        Object.keys(superAbilitiesRef.current).forEach((k) => {
          if (superAbilitiesRef.current[k] && nowTime > superAbilitiesRef.current[k]) {
            delete superAbilitiesRef.current[k];
            abChanged = true;
          }
        });
        if (abChanged) {
          setActiveSuperAbilities({ ...superAbilitiesRef.current });
        }
      }

      // Smoothly zoom camera FOV when Black Ops Sight Scope (ADS) is engaged!
      const targetFov = isScopedRef.current
        ? currentWeaponRef.current.category === 'SNIPER'
          ? 34
          : currentWeaponRef.current.category === 'SHOTGUN'
          ? 65
          : 46
        : 65;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 18, delta);
        camera.updateProjectionMatrix();
      }

      // Soft Subtle Auto-Aim Friction (Solo mode only — in Multiplayer, crosshair stays locked in the dead center of the FOV!)
      if (!isMultiplayerDeathmatch && autoAimEnabledRef.current && activeSoldiersRef.current.length > 0) {
        let closestDist = 0.11;
        let pullTargetX = 0;
        let pullTargetY = 0;
        let foundAssistTarget = false;
        const curAimX = targetAimPosRef.current.x;
        const curAimY = targetAimPosRef.current.y;

        for (let i = 0; i < activeSoldiersRef.current.length; i++) {
          const s = activeSoldiersRef.current[i];
          if (s.mesh.position.z >= playerPosRef.current.z - 1.2) continue;
          const bodyYOffset = s.isRobot ? 1.85 : s.isTank ? 0.35 : 0.18;
          _v1.copy(s.mesh.position);
          _v1.y += bodyYOffset;
          _v1.project(camera);
          if (_v1.z >= 1 || _v1.z <= -1) continue;
          const d = Math.hypot(_v1.x - curAimX, _v1.y - curAimY);
          if (d < closestDist && d > 0.015) {
            closestDist = d;
            pullTargetX = _v1.x;
            pullTargetY = _v1.y;
            foundAssistTarget = true;
          }
        }

        if (foundAssistTarget) {
          targetAimPosRef.current.x = THREE.MathUtils.damp(
            targetAimPosRef.current.x,
            pullTargetX,
            1.2,
            delta
          );
          targetAimPosRef.current.y = THREE.MathUtils.damp(
            targetAimPosRef.current.y,
            pullTargetY,
            1.2,
            delta
          );
        }
      }

      // High-frequency 60 FPS sub-pixel aim interpolation (in Multiplayer, locked at center 0,0 while FOV follows aim!)
      if (isMultiplayerDeathmatch) {
        targetAimPosRef.current.x = 0;
        targetAimPosRef.current.y = 0;
        aimPosRef.current.x = 0;
        aimPosRef.current.y = 0;
        syncCrosshairDom(0, 0);
      } else {
        aimPosRef.current.x = THREE.MathUtils.damp(aimPosRef.current.x, targetAimPosRef.current.x, 30, delta);
        aimPosRef.current.y = THREE.MathUtils.damp(aimPosRef.current.y, targetAimPosRef.current.y, 30, delta);
        syncCrosshairDom(aimPosRef.current.x, aimPosRef.current.y);
      }

      // Identical camera pitch & yaw formula in Hipfire and Scope so Scope Aim and Weapon Aim never deviate!
      cameraRollShakeRef.current = THREE.MathUtils.damp(cameraRollShakeRef.current, 0, 12, delta);
      const targetRoll = isScopedRef.current ? 0 : -inputX * 0.03 + cameraRollShakeRef.current;
      const lateralTunnelTilt = isMultiplayerDeathmatch ? 0 : -playerPosRef.current.x * 0.018;
      const targetYaw = isScopedRef.current
        ? lateralTunnelTilt - aimPosRef.current.x * (isMultiplayerDeathmatch ? 0.72 : 0.65)
        : lateralTunnelTilt - aimPosRef.current.x * (isMultiplayerDeathmatch ? 0.28 : 0.08);
      const targetPitch = isScopedRef.current
        ? aimPosRef.current.y * 0.45
        : aimPosRef.current.y * 0.07 + Math.abs(cameraRollShakeRef.current) * 0.25;
      if (!isMultiplayerDeathmatch) {
        camera.rotation.z = THREE.MathUtils.damp(camera.rotation.z, targetRoll, 16, delta);
        camera.rotation.y = THREE.MathUtils.damp(camera.rotation.y, targetYaw, 22, delta);
        camera.rotation.x = THREE.MathUtils.damp(camera.rotation.x, targetPitch, 22, delta);
      }
      camera.updateMatrixWorld();

      // Continuous fire while holding Shoot (runs AFTER camera & aimPosRef update so every shot uses fresh current-frame matrices!)
      if (isPointerDownRef.current) {
        executeShot();
      }

      if (cameraShakeRef.current > 0.005) {
        cameraShakeRef.current *= 0.87;
      } else {
        cameraShakeRef.current = 0;
      }

      // Strictly ONE Boss Per Phase (Phase 1: Helicopter, Phase 2: Cyber-Robot, Phase 3: F-16 Jet)
      const phaseBossType: 'helicopter' | 'robot' | 'jet' =
        phaseNumber === 1 ? 'helicopter' : phaseNumber === 2 ? 'robot' : 'jet';

      if (!isMultiplayerDeathmatch && timeLeftRef.current <= 38 && !bossSpawnedRef.current[phaseBossType]) {
        spawnPhaseBoss(phaseBossType);
      }

      // Update Active Grenades (Parabolic Arc, Proximity Fuse & High-Explosive Shrapnel Detonation)
      const grenades = activeGrenadesRef.current;
      for (let i = grenades.length - 1; i >= 0; i--) {
        const g = grenades[i];
        g.mesh.position.x += g.vx * delta;
        g.mesh.position.y += g.vy * delta;
        g.mesh.position.z += g.vz * delta;
        g.vy -= 9.8 * delta; // Gravity
        g.mesh.rotation.x += delta * 15;
        g.mesh.rotation.y += delta * 12;
        g.life -= delta;

        // Check proximity contact fuse against any enemy soldier, Bio-Tank, or Boss (O(1) Spatial Partition query)
        const proximitySoldiers = soldierSpatialGrid.query(g.mesh.position.x, g.mesh.position.z, 2.6);
        let hitEnemyInFlight = false;
        for (let j = 0; j < proximitySoldiers.length; j++) {
          const s = proximitySoldiers[j];
          const horizDist = Math.hypot(s.mesh.position.x - g.mesh.position.x, s.mesh.position.z - g.mesh.position.z);
          if (horizDist < 2.4 && Math.abs(s.mesh.position.y - g.mesh.position.y) < 3.0) {
            hitEnemyInFlight = true;
            break;
          }
        }

        // Explode on proximity contact, fuse expiry, or ground impact
        if (hitEnemyInFlight || g.life <= 0 || g.mesh.position.y <= -1.65) {
          triggerExplosion(g.mesh.position);
          sounds.triggerHaptic([45, 30, 65], 'heavy');

          // AOE Frag Shrapnel Damage to all enemies, tanks & bosses within 10.5-unit blast radius (O(1) Spatial query)
          const gPos = g.mesh.position;
          let hitCount = 0;
          let killCount = 0;
          const aoeSoldiers = soldierSpatialGrid.query(gPos.x, gPos.z, 11.0);
          for (let j = aoeSoldiers.length - 1; j >= 0; j--) {
            const s = aoeSoldiers[j];
            if (isMultiplayerDeathmatch && s.isStunned) continue;
            // Use horizontal distance so hovering Bosses (Helicopter/Jet) and tall Tanks take full blast damage
            const horizDist = Math.hypot(s.mesh.position.x - gPos.x, s.mesh.position.z - gPos.z);
            if (horizDist < 10.5) {
              hitCount++;
              const falloff = horizDist < 5.0 ? 1.0 : 0.7;
              const fragHpDmg = Math.round(360 * falloff);
              const fragHitsDmg = horizDist < 5.0 ? 4 : 3;
              const prevHpForSync = Math.max(0, Math.round(s.hp));
              s.lastLocalDamagedAt = performance.now();
              s.hp -= fragHpDmg;
              s.hitsLeft = Math.max(0, s.hitsLeft - fragHitsDmg);
              if (isMultiplayerDeathmatch && s.remotePlayerId) {
                sendPlayerHitEvent(
                  activeRoomCodeRef.current,
                  s.remotePlayerId,
                  prevHpForSync,
                  fragHpDmg,
                  localMpPlayerIdRef.current,
                  cachedStudentProfileRef.current?.name || 'Operative',
                  'Bio-Cluster Frag [G]',
                  true
                );
              }
              if (!s.isHelicopter && !s.isRobot && !s.isJet && !s.remotePlayerId) {
                s.mesh.position.z -= 1.6;
              }
              if (s.hpBarFill) {
                const pct = Math.max(0.01, s.hitsLeft / s.maxHits);
                s.hpBarFill.scale.x = pct;
                s.hpBarFill.position.x = -(0.82 * (1 - pct)) / 2;
              }
              if (s.isHelicopter || s.isRobot || s.isJet) {
                if (s.hitsLeft > 0 && s.hp > 0) {
                  setBossInfo({
                    name: s.name,
                    hitsLeft: Math.ceil(s.hitsLeft),
                    maxHits: s.maxHits,
                  });
                }
              }
              if (s.hitsLeft <= 0 || s.hp <= 0) {
                killCount++;
                if (s.isTank || s.isBoss) {
                  triggerHeavyDestructionPop(s.mesh.position, s.isBoss);
                } else {
                  triggerMembraneDisintegration(s.mesh.position, s.type);
                }
                if (isMultiplayerDeathmatch && s.remotePlayerId) {
                  s.localEliminatedUntil = performance.now() + 2500;
                  s.lastLocalDamagedAt = 0;
                  s.isStunned = true;
                  s.hp = 100;
                  s.hitsLeft = 3;
                  if (s.stasisCage) s.stasisCage.visible = true;
                  if (s.hpBarFill) {
                    s.hpBarFill.scale.x = 1;
                    s.hpBarFill.position.x = 0;
                  }
                } else {
                  releaseSoldierToPool(s);
                  const mainIdx = activeSoldiersRef.current.indexOf(s);
                  if (mainIdx !== -1) activeSoldiersRef.current.splice(mainIdx, 1);
                }
                if (s.isHelicopter || s.isRobot || s.isJet) {
                  setBossInfo(null);
                  setBossDefeatedBanner(true);
                }
                sounds.playKillConfirm();
                killsRef.current += 1;
                scoreRef.current += s.value + 150;
                setKills(killsRef.current);
                setScore(scoreRef.current);
                if (isMultiplayerDeathmatch) {
                  const prof = cachedStudentProfileRef.current;
                  const myCallsign = prof?.name || 'Operative';
                  pushKillfeedEntryRef.current?.({
                    id: `${Date.now()}_${Math.random()}`,
                    killerName: myCallsign,
                    victimName: s.name,
                    weaponName: 'Bio-Cluster Frag [G]',
                    isHeadshot: false,
                    timestamp: Date.now(),
                  });
                  pushLocalMpStateNowRef.current?.();
                  if (killsRef.current >= MATCH_KILL_LIMIT) {
                    triggerMultiplayerMatchEndRef.current?.('kill_limit');
                  }
                }
              }
            }
          }

          if (hitCount > 0) {
            sounds.playHitmarker(true);
            const markerId = Date.now() + Math.random();
            setHitmarkers((prev) => [
              ...prev.slice(-4),
              { id: markerId, x: 50, y: 46, isCritical: true, damage: 360 },
            ]);
            setTimeout(() => {
              setHitmarkers((prev) => prev.filter((m) => m.id !== markerId));
            }, 320);
            setActiveStreak({
              count: hitCount,
              id: Date.now(),
              label: `FRAG SHRAPNEL HIT ×${hitCount}`,
              sublabel: killCount > 0 ? `${killCount} EKIA CONFIRMED` : 'HEAVY BLAST DAMAGE',
              color: 'from-amber-500 to-rose-500',
            });
            setTimeout(() => setActiveStreak(null), 1800);
          }

          g.mesh.visible = false;
          activeGrenadesRef.current.splice(i, 1);
        }
      }

      // Update Explosion & Barricade Shatter Particles (Pooled: hide mesh instead of scene.remove)
      const particles = activeParticlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.mesh.position.x += p.vx * delta;
        p.mesh.position.y += p.vy * delta;
        p.mesh.position.z += p.vz * delta;
        if (p.hasGravity) {
          p.vy -= 14.5 * delta;
          if (p.mesh.position.y <= -1.65) {
            p.mesh.position.y = -1.65;
            p.vy = -p.vy * 0.38;
            p.vx *= 0.72;
            p.vz *= 0.72;
          }
        }
        if (p.rotVx) p.mesh.rotation.x += p.rotVx * delta;
        if (p.rotVy) p.mesh.rotation.y += p.rotVy * delta;
        if (p.rotVz) p.mesh.rotation.z += p.rotVz * delta;
        p.life -= delta;
        if (!p.hasGravity || p.life < 0.35) {
          p.mesh.scale.multiplyScalar(0.96);
        }
        if (p.life <= 0) {
          p.mesh.visible = false;
          particles[i] = particles[particles.length - 1];
          particles.pop();
        }
      }

      // Update Biological Power-Up Drops (Bob, spin, and proximity pickup for ATP Overcharge & Shield)
      if (activeBiologicalDropsRef.current.length > 0) {
        const drops = activeBiologicalDropsRef.current;
        const pX = playerPosRef.current.x;
        const pZ = playerPosRef.current.z;
        const pY = playerElevationYRef.current;
        for (let di = 0; di < drops.length; di++) {
          const drop = drops[di];
          if (!drop.active) continue;
          drop.mesh.rotation.y += delta * 2.4;
          drop.mesh.position.y = drop.y + Math.sin(elapsed * 4.2 + drop.bobPhase) * 0.12;

          // Check distance to local operative
          const distXZ = Math.hypot(pX - drop.x, pZ - drop.z);
          const distY = Math.abs(pY - drop.y);
          if (distXZ <= 1.95 && distY <= 2.2) {
            drop.active = false;
            drop.mesh.visible = false;
            sounds.playStimInject();
            sounds.triggerHaptic([30, 20, 40], 'heavy');

            if (drop.type === 'atp') {
              sprintEnergyRef.current = 100;
              isSprintExhaustedRef.current = false;
              setIsSprintExhausted(false);
              if (sprintBarFillDomRef.current) {
                sprintBarFillDomRef.current.style.width = '100%';
                sprintBarFillDomRef.current.className =
                  'h-full transition-all duration-75 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300';
              }
              if (sprintBarTextDomRef.current) {
                sprintBarTextDomRef.current.textContent = '⚡ SPRINT: 100% (OVERCHARGED)';
                sprintBarTextDomRef.current.className =
                  'text-[9px] font-black text-amber-300 uppercase tracking-widest';
              }
              setPowerUpToast({
                text: '⚡ ATP OVERCHARGE! SPRINT ENERGY 100% REFILLED',
                icon: 'Zap',
                color: 'text-amber-300 border-amber-400/80 bg-amber-950/90',
              });
            } else {
              playerHpRef.current = Math.min(100, playerHpRef.current + 25);
              setPlayerHp(playerHpRef.current);
              setPowerUpToast({
                text: '🛡️ IMMUNOGLOBULIN SHIELD (+25 BIO-HP RESTORED)',
                icon: 'Shield',
                color: 'text-cyan-300 border-cyan-400/80 bg-cyan-950/90',
              });
            }

            if (powerUpToastTimerRef.current) window.clearTimeout(powerUpToastTimerRef.current);
            powerUpToastTimerRef.current = window.setTimeout(() => {
              setPowerUpToast(null);
            }, 3000);
          }
        }
      }

      // Update 3D Cell Membrane Ripple & Biochemical Portal Spawn Indicators
      for (let i = 0; i < spawnRipplePool.length; i++) {
        const r = spawnRipplePool[i];
        if (!r.mesh.visible) continue;
        r.life -= delta;
        if (r.life <= 0) {
          r.mesh.visible = false;
        } else {
          const progress = 1 - r.life / r.maxLife;
          const s = 0.2 + progress * 2.8;
          r.mesh.scale.set(s, s, s);
          r.mat.opacity = (1 - progress) * 0.9;
        }
      }

      // Scroll organ tunnel (Solo mode) or animate Breathing Alveolar Sacs in Open Lung Landscape (Multiplayer)!
      if (isMultiplayerDeathmatch && openLungLandscapeRef.current) {
        const lung = openLungLandscapeRef.current;
        for (let i = 0; i < lung.breathingSacs.length; i++) {
          const sac = lung.breathingSacs[i];
          const breath = sac.baseScale * (1 + Math.sin(elapsed * 2.1 + sac.phase) * 0.085);
          sac.mesh.scale.setScalar(breath);
        }
        for (let i = 0; i < lung.gasParticles.length; i++) {
          const gp = lung.gasParticles[i];
          gp.mesh.position.y = gp.baseY + Math.sin(elapsed * gp.speed + gp.phase) * 0.95;
        }
      } else {
        wallTexture.offset.y -= delta * 0.14;
      }

      // 2b. ANIMATE 3D ORGAN ENVIRONMENT PROPS (Smooth VSync-locked every-frame animation so tunnel props never hitch relative to the wall)
      if (organEnvPropsRef.current) {
        const env = organEnvPropsRef.current;
        for (let i = 0; i < env.ciliaList.length; i++) {
          const c = env.ciliaList[i];
          const wave = Math.sin(elapsed * 5.8 - c.phase);
          const recovery = Math.cos(elapsed * 5.8 - c.phase);
          c.mesh.rotation.x = wave * 0.45 + 0.14;
          c.mesh.rotation.z = c.baseRotZ + recovery * 0.12;
          if (c.distalTips) {
            const tipCurl = 0.32 + Math.max(-0.15, wave * 0.48) - recovery * 0.22;
            for (let t = 0; t < c.distalTips.length; t++) {
              c.distalTips[t].rotation.x = tipCurl;
            }
          }
        }
        for (let i = 0; i < env.flowingBlobs.length; i++) {
          const b = env.flowingBlobs[i];
          b.mesh.position.z += b.speed * delta;
          const ciliaryLift = Math.sin(elapsed * 5.8 - b.mesh.position.z * 0.42 + b.phase) * 0.14;
          b.mesh.position.x = b.baseX - Math.cos(b.angle) * ciliaryLift;
          b.mesh.position.y = b.baseY - Math.sin(b.angle) * ciliaryLift;
          if (b.mesh.position.z > 2.5) {
            b.mesh.position.z = -59.5;
          }
        }
        for (let rIdx = 0; rIdx < env.muscleRings.length; rIdx++) {
          const ring = env.muscleRings[rIdx];
          const squeeze = 1 + Math.sin(elapsed * 3.2 + rIdx * 0.85) * 0.055;
          const baseSx = ring.userData.sx || 1;
          const baseSy = ring.userData.sy || 1;
          ring.scale.set(baseSx * squeeze, baseSy * squeeze, 1);
        }
        if (env.roadSigns) {
          const moveBoost = Math.abs(inputX) * 1.4 + Math.max(0, -inputZ * 4.2) + Math.max(0, inputZ * 1.2);
          for (let i = 0; i < env.roadSigns.length; i++) {
            const sign = env.roadSigns[i];
            sign.mesh.position.z += (sign.speed + moveBoost) * delta;
            if (sign.mesh.position.z > 2.8) {
              sign.mesh.position.z = -86;
            }
          }
        }
        if (env.landmarks) {
          const moveBoost = Math.abs(inputX) * 1.4 + Math.max(0, -inputZ * 4.2);
          for (let i = 0; i < env.landmarks.length; i++) {
            const lm = env.landmarks[i];
            lm.mesh.position.z += (lm.speed + moveBoost) * delta;
            if (lm.rotor) {
              lm.rotor.rotation.y += delta * 2.6;
            }
            if (lm.streams) {
              const pulse = 0.92 + Math.sin(elapsed * 6.5) * 0.12;
              for (let sIdx = 0; sIdx < lm.streams.length; sIdx++) {
                lm.streams[sIdx].scale.set(1, pulse + Math.sin(elapsed * 8 + sIdx) * 0.08, 1);
              }
            }
            if (lm.mesh.position.z > 3.5) {
              lm.mesh.position.z = -86;
            }
            if (lm.mesh.position.z >= -16 && lm.mesh.position.z <= -3) {
              if (lastRoadSignTitleRef.current !== lm.title) {
                lastRoadSignTitleRef.current = lm.title;
                setPassingRoadSign({
                  code: lm.side < 0 ? 'LM-1' : 'LM-2',
                  title: lm.title,
                  subtitle: lm.subtitle,
                  distance: 'SIDE LANDMARK',
                  style: 'landmark',
                });
              }
            }
          }
        }
      }

      // 3. ANIMATE THEME-SPECIFIC PANICKING CELLS (Smooth every-frame delta)
      const rbcs = panickingRbcsRef.current;
      for (let i = 0; i < rbcs.length; i++) {
        const rbc = rbcs[i];
        rbc.mesh.position.z += rbc.speed * delta;

        const panicCycle = Math.sin(elapsed * 24 + rbc.trembleSeed);
        rbc.lArm.rotation.z = 0.6 + Math.sin(elapsed * 28 + rbc.trembleSeed) * 0.5;
        rbc.rArm.rotation.z = -0.6 - Math.sin(elapsed * 28 + rbc.trembleSeed) * 0.5;
        rbc.lLeg.rotation.x = panicCycle * 0.7;
        rbc.rLeg.rotation.x = -panicCycle * 0.7;

        rbc.mesh.position.x += Math.sin(elapsed * 30 + rbc.trembleSeed) * 0.012;
        rbc.mesh.position.y += Math.cos(elapsed * 30 + rbc.trembleSeed) * 0.012;

        if (rbc.mesh.position.z > 2) {
          rbc.mesh.position.z = -62;
          const side = rbc.side || (Math.random() < 0.5 ? -1 : 1);
          rbc.mesh.position.x = side * (3.15 + Math.random() * 0.7);
          rbc.mesh.position.y = -1.45 - Math.random() * 0.4;
        }
      }

      // 3b. ANIMATE VISIBLE PANICKING PLATELETS
      const plts = panickingPlateletsRef.current;
      for (let i = 0; i < plts.length; i++) {
        const plt = plts[i];
        plt.mesh.position.z += plt.speed * delta;
        plt.mesh.position.x += Math.sin(elapsed * 18 + plt.trembleSeed) * 0.012;
        plt.mesh.position.y += Math.cos(elapsed * 22 + plt.trembleSeed) * 0.012;
        plt.mesh.rotation.z = Math.sin(elapsed * 16 + plt.trembleSeed) * 0.14;
        if (plt.lArm && plt.rArm) {
          plt.lArm.rotation.z = 0.75 + Math.sin(elapsed * 26 + plt.trembleSeed) * 0.45;
          plt.rArm.rotation.z = -0.75 - Math.sin(elapsed * 26 + plt.trembleSeed) * 0.45;
        }

        if (plt.mesh.position.z > 2) {
          plt.mesh.position.z = -56;
          const side = plt.side || (Math.random() < 0.5 ? -1 : 1);
          plt.mesh.position.x = side * (2.35 + Math.random() * 0.8);
          plt.mesh.position.y = -1.55 - Math.random() * 0.32;
        }
      }

      // 3b-bis. RANDOM SCENES OF PLATELETS & PANICKING CELLS HIDING BEHIND SANDBAG BARRICADES THEN LEAVING (Zero-allocation pooled meshes!)
      if (!isMultiplayerDeathmatch && elapsed >= nextRefugeeSceneTimeRef.current) {
        nextRefugeeSceneTimeRef.current = elapsed + 6.5 + Math.random() * 3.5;
        const intactBars = barricadesRef.current
          .map((b, idx) => ({ b, idx }))
          .filter((item) => item.b.hp > 0);

        const availablePool = refugeePoolRef.current.filter((p) => !p.inUse);
        if (intactBars.length > 0 && barricadeRefugeesRef.current.length < 2 && availablePool.length > 0) {
          const chosen = intactBars[Math.floor(Math.random() * intactBars.length)];
          const entrySide = chosen.b.x < -0.5 ? -1 : chosen.b.x > 0.5 ? 1 : Math.random() < 0.5 ? -1 : 1;
          const pooled = availablePool[Math.floor(Math.random() * availablePool.length)];
          pooled.inUse = true;

          const targetX = chosen.b.x + (Math.random() - 0.5) * 0.45;
          const targetZ = chosen.b.z + 0.48;
          pooled.mesh.position.set(entrySide * 4.1, -1.1, targetZ - 0.35);
          pooled.mesh.scale.setScalar(pooled.isPlatelet ? 1 : 0.68);
          pooled.mesh.visible = true;

          barricadeRefugeesRef.current.push({
            mesh: pooled.mesh,
            lArm: pooled.lArm,
            rArm: pooled.rArm,
            lLeg: pooled.lLeg,
            rLeg: pooled.rLeg,
            isPlatelet: pooled.isPlatelet,
            barricadeIndex: chosen.idx,
            targetX,
            targetZ,
            exitX: entrySide * 4.7,
            exitZ: 1.8,
            state: 'entering',
            hideTimer: 2.5 + Math.random() * 1.1,
            speed: 4.8 + Math.random() * 0.8,
            trembleSeed: Math.random() * 20,
            hasCried: false,
          });
        }
      }

      // Animate Barricade-Hiding Platelets & Panicking Cells (Scurry In -> Crouch & Peek Behind Barricade -> Scurry Away)
      for (let rIdx = barricadeRefugeesRef.current.length - 1; rIdx >= 0; rIdx--) {
        const refCell = barricadeRefugeesRef.current[rIdx];
        const bar = barricadesRef.current[refCell.barricadeIndex];

        // If the barricade they are hiding behind is destroyed, bolt immediately!
        if ((!bar || bar.hp <= 0) && refCell.state !== 'leaving') {
          refCell.state = 'leaving';
        }

        const waveCycle = Math.sin(elapsed * 24 + refCell.trembleSeed);
        if (refCell.lArm && refCell.rArm) {
          refCell.lArm.rotation.z = 0.7 + waveCycle * 0.45;
          refCell.rArm.rotation.z = -0.7 - waveCycle * 0.45;
        }
        if (refCell.lLeg && refCell.rLeg) {
          refCell.lLeg.rotation.x = refCell.state === 'hiding' ? -0.55 : waveCycle * 0.65;
          refCell.rLeg.rotation.x = refCell.state === 'hiding' ? 0.55 : -waveCycle * 0.65;
        }

        if (refCell.state === 'entering') {
          const dx = refCell.targetX - refCell.mesh.position.x;
          const dz = refCell.targetZ - refCell.mesh.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.12) {
            refCell.mesh.position.x += (dx / dist) * refCell.speed * delta;
            refCell.mesh.position.z += (dz / dist) * refCell.speed * delta;
            refCell.mesh.position.y = -1.08 + Math.abs(waveCycle) * 0.08;
            refCell.mesh.rotation.y = Math.atan2(dx, dz);
          } else {
            refCell.mesh.position.x = refCell.targetX;
            refCell.mesh.position.z = refCell.targetZ;
            refCell.state = 'hiding';
            if (refCell.isPlatelet) {
              triggerBiologyConceptRef.current?.('ally_platelets_clotting');
            }
            if (!refCell.hasCried) {
              refCell.hasCried = true;
              sounds.speakCellHelpCry(organThemeRef.current.id, refCell.isPlatelet);
              // Allied Platelet/Cell Clotting Support: Repairs barricade +18% & heals player +8 HP!
              if (bar && bar.hp > 0) {
                bar.hp = Math.min(bar.maxHp, bar.hp + 18);
              }
              playerHpRef.current = Math.min(100, playerHpRef.current + 8);
              setPlayerHp(playerHpRef.current);
              const blueMsg = refCell.isPlatelet
                ? '💙 ALLIED PLATELET CLOTTING: +18% BUNKER SHIELD & +8 HP!'
                : '💙 ALLIED CELL RESCUED: +18% BUNKER SHIELD & +8 HP!';
              setCellDistressBanner(blueMsg);
              setTimeout(() => {
                setCellDistressBanner((prev) => (prev === blueMsg ? null : prev));
              }, 3600);
            }
          }
        } else if (refCell.state === 'hiding') {
          refCell.hideTimer -= delta;
          // Crouch low behind sandbags and periodically peek over the top!
          const peekUp = Math.sin(elapsed * 5.5 + refCell.trembleSeed) > 0.25 ? 0.16 : 0;
          refCell.mesh.position.y = THREE.MathUtils.damp(
            refCell.mesh.position.y,
            -1.26 + peekUp,
            10,
            delta
          );
          refCell.mesh.position.x =
            refCell.targetX + Math.sin(elapsed * 28 + refCell.trembleSeed) * 0.025;
          refCell.mesh.rotation.y = Math.PI + Math.sin(elapsed * 6 + refCell.trembleSeed) * 0.35;

          if (refCell.hideTimer <= 0) {
            refCell.state = 'leaving';
          }
        } else {
          // 'leaving': Hop up and scurry safely off toward the rear flank!
          const dx = refCell.exitX - refCell.mesh.position.x;
          const dz = refCell.exitZ - refCell.mesh.position.z;
          const dist = Math.hypot(dx, dz);
          refCell.mesh.position.y = THREE.MathUtils.damp(
            refCell.mesh.position.y,
            -1.05 + Math.abs(waveCycle) * 0.1,
            10,
            delta
          );
          if (dist > 0.2) {
            refCell.mesh.position.x += (dx / dist) * (refCell.speed * 1.15) * delta;
            refCell.mesh.position.z += (dz / dist) * (refCell.speed * 1.15) * delta;
            refCell.mesh.rotation.y = Math.atan2(dx, dz);
          } else {
            refCell.mesh.visible = false;
            const poolEntry = refugeePoolRef.current.find((p) => p.mesh === refCell.mesh);
            if (poolEntry) poolEntry.inUse = false;
            barricadeRefugeesRef.current.splice(rIdx, 1);
          }
        }
      }

      // 3c. ANIMATE HEROIC ANTIBODIES CHARGING FORWARD IN OUTER FLANKS (Never behind or pushing the player!)
      heroicAntibodiesRef.current.forEach((ab, idx) => {
        const seed = ab.trembleSeed || 0;
        ab.mesh.position.z -= ab.speed * delta;
        ab.mesh.position.y = (ab.baseY ?? -0.6) + Math.sin(elapsed * 6.0 + seed) * 0.18;
        ab.mesh.rotation.z = Math.sin(elapsed * 7.5 + seed) * 0.14;
        ab.mesh.rotation.y = (ab.mesh.position.x > 0 ? 0.25 : -0.25) + Math.sin(elapsed * 4.0 + seed) * 0.18;

        if (ab.mesh.position.z < -48) {
          ab.mesh.position.z = -6.5;
          const laneSide = idx % 2 === 0 ? -1 : 1;
          ab.mesh.position.x = laneSide * (3.85 + Math.random() * 1.15);
          ab.baseY = -1.35 + (idx % 3) * 0.65;
        }
      });

      // Helper: Spawn a 3D Boss Rocket Salvo towards Player / Barricades with Predictive Lead Targeting (from bossRocketPool!)
      const launchBossRocket = (boss: ActiveSoldier) => {
        sounds.playRocketLaunch();
        const rocketData = acquireBossRocketMesh();
        _v1.copy(boss.mesh.position);
        const sideSign = Math.random() < 0.5 ? -1 : 1;
        _v1.x += sideSign * (boss.isRobot ? 1.05 : 0.85);
        _v1.y += boss.isRobot ? 2.15 : -0.15;
        _v1.z += 0.6;

        rocketData.group.position.copy(_v1);
        const rocketSpeed = 16.5 + (phaseNumber - 1) * 1.2 + (levelNumber - 1) * 0.35;
        const estFlightTime = Math.abs(playerPosRef.current.z - _v1.z) / rocketSpeed;
        const predictedX = Math.max(
          -3.3,
          Math.min(
            3.3,
            playerPosRef.current.x + smoothedPlayerVelX * estFlightTime * 0.52 + (Math.random() - 0.5) * 0.55
          )
        );
        _v2.set(predictedX, -0.45, playerPosRef.current.z);
        rocketData.group.lookAt(_v2);

        _v3.copy(_v2).sub(_v1).normalize();

        activeBossRocketsRef.current.push({
          id: nextEnemyBulletIdRef.current++,
          mesh: rocketData.group,
          flame: rocketData.flame,
          vx: _v3.x * rocketSpeed,
          vy: _v3.y * rocketSpeed,
          vz: _v3.z * rocketSpeed,
          damage: 20 + (phaseNumber - 1) * 3,
          life: 4.0,
        });
      };

      // Helper: Spawn a Realistic 3D Spitzer Bullet or Heavy Fin-Stabilized Tank Artillery Shell with Predictive Lead AI (from pool!)
      const fireEnemyProjectile = (soldier: ActiveSoldier, bulletSpeed: number, bulletDmg: number) => {
        _v1.copy(soldier.mesh.position);
        if (soldier.isTank) {
          _v1.y += 0.42;
          _v1.z += 1.55;
          soldier.cannonRecoil = 0.65;
          soldier.hullRock = -0.14;
          triggerTankMuzzleBlast(_v1);
          sounds.playTankCannon();
        } else {
          _v1.y += soldier.isHelicopter ? -0.2 : soldier.isRobot ? 1.8 : 0.25;
          _v1.z += 0.55;
          if (soldier.isRobot) {
            sounds.playTankCannon();
          } else {
            sounds.playEnemyShoot();
          }
        }

        const dist3D = Math.hypot(
          playerPosRef.current.x - _v1.x,
          (camera.position.y - 0.15) - _v1.y,
          playerPosRef.current.z - _v1.z
        );
        const flightTime = dist3D / Math.max(10, bulletSpeed);
        const leadFactor = soldier.isTank || soldier.isBoss ? 0.55 : soldier.type === 'bacillus' ? 0.42 : 0.25;
        const spread = soldier.isTank ? 0.18 : 0.26;
        const rawAimX = playerPosRef.current.x + smoothedPlayerVelX * flightTime * leadFactor + (Math.random() - 0.5) * spread;
        const aimX = isMultiplayerDeathmatch && soldier.remotePlayerId
          ? THREE.MathUtils.clamp(rawAimX, -32.0, 32.0)
          : Math.max(-3.4, Math.min(3.4, rawAimX));
        const aimY = isMultiplayerDeathmatch && soldier.remotePlayerId
          ? camera.position.y - 0.15
          : -0.15;

        _v2.set(aimX, aimY, playerPosRef.current.z);
        _v3.copy(_v2).sub(_v1).normalize();

        const isHeavy = Boolean(soldier.isTank || soldier.isRobot);
        const bulletMesh = acquireEnemyProjectileMesh(isHeavy);
        bulletMesh.position.copy(_v1);
        bulletMesh.lookAt(_v2);

        activeEnemyBulletsRef.current.push({
          id: nextEnemyBulletIdRef.current++,
          mesh: bulletMesh,
          vx: _v3.x * bulletSpeed,
          vy: _v3.y * bulletSpeed,
          vz: _v3.z * bulletSpeed,
          isTank: isHeavy,
          damage: bulletDmg,
          life: 4.5,
        });
      };

      // Difficulty-scaled projectile parameters
      const currentWave = getWaveNumber();
      const soldierBulletSpeed =
        (currentWave === 1 ? 16.5 : currentWave === 2 ? 18.5 : 20.0) +
        diffScaleGlobal * 3.5;
      const soldierBulletDmg = Math.round(
        (currentWave === 1 ? 5 : currentWave === 2 ? 6 : 7) +
          diffScaleGlobal * 3
      );

      // 4. ANIMATE HOSTILES: TROOPS ADVANCE TO BARRICADE FIRING LINE BEFORE AIMING, SCOPING & SHOOTING!
      const soldiers = activeSoldiersRef.current;
      for (let i = soldiers.length - 1; i >= 0; i--) {
        const soldier = soldiers[i];

        // If enemy Tank or Soldier was deployed via Enemy Troop Airdrop, descend visibly under parachute first!
        if (soldier.isParachuting) {
          const descentRate = soldier.isTank ? 1.35 : 1.48;
          soldier.mesh.position.y -= descentRate * delta;
          soldier.mesh.rotation.z = Math.sin(elapsed * 4.2 + soldier.walkOffset) * 0.08;
          const targetGroundY = soldier.landingY ?? (soldier.isTank ? -0.5 : 0);
          if (soldier.mesh.position.y <= targetGroundY) {
            soldier.mesh.position.y = targetGroundY;
            soldier.mesh.rotation.z = 0;
            soldier.isParachuting = false;
            if (soldier.parachuteGroup) {
              soldier.parachuteGroup.visible = false;
            }
            triggerSandDust(soldier.mesh.position);
          }
          continue;
        }

        // Safeguard: Guarantee parachute is detached and hidden once on the ground
        if (soldier.parachuteGroup && soldier.parachuteGroup.visible) {
          soldier.parachuteGroup.visible = false;
        }

        // PHASE 3 NATURAL VICTORY ENDING: BACTERIA & TANKS LOOK AFRAID, TELL EACH OTHER TO RETREAT, TURN AROUND & RUN INTO THE HORIZON!
        if (!isMultiplayerDeathmatch && isPhase3RetreatingRef.current) {
          if (soldier.scopeGlint) {
            (soldier.scopeGlint.material as THREE.MeshBasicMaterial).opacity = 0;
          }
          soldier.retreatElapsed = (soldier.retreatElapsed || 0) + delta;

          if (soldier.retreatElapsed < 1.05) {
            // Stage 1: Look afraid, tremble, turn toward fellow troops/tanks & signal retreat!
            const tremble = Math.sin(elapsed * 42 + soldier.id * 3.1);
            soldier.mesh.position.x += tremble * 0.018;
            soldier.mesh.rotation.z = tremble * 0.08;
            const neighborLookYaw =
              (soldier.id % 2 === 0 ? 0.65 : -0.65) + Math.sin(elapsed * 16 + soldier.id) * 0.25;
            soldier.mesh.rotation.y = THREE.MathUtils.damp(
              soldier.mesh.rotation.y,
              neighborLookYaw,
              10,
              delta
            );

            if (soldier.isTank) {
              if (soldier.turret) {
                soldier.turret.rotation.y = Math.sin(elapsed * 16 + soldier.id) * 0.68;
              }
              soldier.mesh.position.y = -0.5 + Math.abs(Math.sin(elapsed * 18 + soldier.id)) * 0.04;
            } else if (!soldier.isBoss) {
              // Throw both arms up in panic & hop in fear!
              soldier.mesh.position.y = Math.abs(Math.sin(elapsed * 20 + soldier.id)) * 0.14;
              if (soldier.leftArm && soldier.rightArm) {
                soldier.leftArm.rotation.x = -2.55 + Math.sin(elapsed * 28 + soldier.id) * 0.38;
                soldier.rightArm.rotation.x = -2.55 - Math.sin(elapsed * 28 + soldier.id) * 0.38;
                soldier.leftArm.rotation.z = 0.42;
                soldier.rightArm.rotation.z = -0.42;
              }
              if (soldier.leftLeg && soldier.rightLeg) {
                soldier.leftLeg.rotation.x = Math.sin(elapsed * 22 + soldier.id) * 0.35;
                soldier.rightLeg.rotation.x = -Math.sin(elapsed * 22 + soldier.id) * 0.35;
              }
            }
          } else {
            // Stage 2: Turn 180 degrees around toward the distant horizon (-Z) and run away!
            const targetRetreatYaw = Math.PI + Math.sin(elapsed * 11 + soldier.walkOffset) * 0.08;
            soldier.mesh.rotation.y = THREE.MathUtils.damp(
              soldier.mesh.rotation.y,
              targetRetreatYaw,
              9,
              delta
            );
            soldier.mesh.rotation.x = THREE.MathUtils.damp(soldier.mesh.rotation.x, -0.14, 8, delta);
            soldier.mesh.rotation.z = Math.sin(elapsed * 20 + soldier.walkOffset) * 0.06;

            const retreatSpeed = soldier.isTank ? 11.2 : soldier.isBoss ? 15.5 : 12.0;
            soldier.mesh.position.z -= retreatSpeed * delta;

            if (soldier.isTank) {
              soldier.mesh.position.y = -0.5 + Math.sin(elapsed * 16 + soldier.walkOffset) * 0.03;
              if (soldier.turret) {
                soldier.turret.rotation.y = THREE.MathUtils.damp(soldier.turret.rotation.y, 0, 8, delta);
              }
              if (Math.random() < 0.25) {
                triggerSandDust(soldier.mesh.position);
              }
            } else if (!soldier.isBoss) {
              const panicSprint = Math.sin(elapsed * 26 + soldier.walkOffset);
              soldier.mesh.position.y = Math.abs(panicSprint) * 0.1;
              if (soldier.leftLeg && soldier.rightLeg) {
                soldier.leftLeg.rotation.x = panicSprint * 0.95;
                soldier.rightLeg.rotation.x = -panicSprint * 0.95;
              }
              if (soldier.leftArm && soldier.rightArm) {
                soldier.leftArm.rotation.x = -2.4 + panicSprint * 0.45;
                soldier.rightArm.rotation.x = -2.4 - panicSprint * 0.45;
                soldier.leftArm.rotation.z = 0.35;
                soldier.rightArm.rotation.z = -0.35;
              }
            }

            // Smoothly shrink and fade into the distant horizon as they pass z < -30
            const baseUnitScale = soldier.isTank
              ? 1.18
              : soldier.isHelicopter
              ? 1.28
              : soldier.isRobot
              ? 1.32
              : soldier.isJet
              ? 1.42
              : 1.0;
            if (soldier.mesh.position.z < -30) {
              const horizonFade = THREE.MathUtils.clamp(
                (soldier.mesh.position.z - -52) / (-30 - -52),
                0.04,
                1.0
              );
              soldier.mesh.scale.setScalar(baseUnitScale * horizonFade);
            }

            if (soldier.mesh.position.z <= -50) {
              releaseSoldierToPool(soldier);
              activeSoldiersRef.current.splice(i, 1);
            }
          }
          continue;
        }

        // LOW-HP BOSS & TANK FIRE, SMOKE & PARTIAL STRUCTURAL DESTRUCTION BEFORE THEY POP!
        const isArmoredUnit = Boolean(soldier.isTank || soldier.isBoss);
        const unitHpRatio = isArmoredUnit
          ? Math.min(
              soldier.hitsLeft / Math.max(1, soldier.maxHits),
              soldier.hp / Math.max(1, soldier.maxHp)
            )
          : 1;
        const isCriticallyDamaged = isArmoredUnit && unitHpRatio <= 0.45 && unitHpRatio > 0;

        if (isCriticallyDamaged) {
          // One-time partial structural armor-plate shatter when entering critical low health!
          if (!soldier.lowHpShatterTriggered) {
            soldier.lowHpShatterTriggered = true;
            sounds.playBarricadeHit();
            for (let dIdx = 0; dIdx < 6; dIdx++) {
              _v1.copy(soldier.mesh.position);
              _v1.y += soldier.isRobot ? 1.85 : 0.45;
              spawnPooledParticle(
                dIdx % 2 === 0 ? sharedBagGeo : sharedWoodGeo,
                dIdx % 2 === 0 ? sharedBagMats[dIdx % sharedBagMats.length] : sharedWoodMat,
                _v1,
                (Math.random() - 0.5) * 10,
                3.5 + Math.random() * 5.5,
                (Math.random() - 0.5) * 8,
                0.65 + Math.random() * 0.25,
                0.9,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                true
              );
            }
          }

          // Continuous burning fire, dark smoke & electrical sparks rising from crippled hull/fuselage (throttled to 85ms)
          if (nowTime - (soldier.lastDamageFireTime || 0) >= 85) {
            soldier.lastDamageFireTime = nowTime;
            _v1.copy(soldier.mesh.position);
            _v1.x += (Math.random() - 0.5) * (soldier.isBoss ? 1.1 : 0.75);
            _v1.y += (soldier.isRobot ? 1.95 : soldier.isTank ? 0.52 : 0.25) + (Math.random() - 0.5) * 0.25;
            _v1.z += (Math.random() - 0.5) * 0.65;

            // Rising orange/yellow/red fire tongues
            for (let f = 0; f < 2; f++) {
              spawnPooledParticle(
                sharedExplosionGeo,
                sharedMuzzleBlastMats[(f + Math.floor(Math.random() * 3)) % 3],
                _v1,
                (Math.random() - 0.5) * 2.2,
                2.4 + Math.random() * 3.2,
                (Math.random() - 0.5) * 2.2,
                0.28 + Math.random() * 0.16,
                0.44
              );
            }
            // Dark smoke plume or electrical arc spark
            const emitSpark = Math.random() < 0.45;
            spawnPooledParticle(
              emitSpark ? sharedSparkGeo : sharedSandGeo,
              emitSpark ? sharedTankSparkMat : sharedSmokeMat,
              _v1,
              (Math.random() - 0.5) * (emitSpark ? 7.5 : 2.6),
              emitSpark ? 2.0 + Math.random() * 5.0 : 3.2 + Math.random() * 2.5,
              (Math.random() - 0.5) * (emitSpark ? 7.5 : 2.6),
              0.32 + Math.random() * 0.18,
              0.5
            );
          }
        }

        // Update Boss Evasive Dodging Timer & Smooth Juke Interpolation
        if (soldier.isBoss) {
          if (nowTime >= (soldier.nextDodgeTime || 0)) {
            const nextDir = (soldier.dodgeTargetX || 1) > 0 ? -1 : 1;
            soldier.dodgeTargetX = nextDir * (1.4 + Math.random() * 1.5);
            soldier.dodgeTargetY = (Math.random() - 0.5) * 0.65;
            soldier.nextDodgeTime = nowTime + Math.max(1250, 2100 - diffScaleGlobal * 600);
          }
          soldier.dodgeOffsetX = THREE.MathUtils.damp(
            soldier.dodgeOffsetX || 0,
            soldier.dodgeTargetX || 0,
            5.5,
            delta
          );
          soldier.dodgeOffsetY = THREE.MathUtils.damp(
            soldier.dodgeOffsetY || 0,
            soldier.dodgeTargetY || 0,
            5.5,
            delta
          );

          // Periodic Boss 3D Guided Rocket Salvos!
          const rocketInterval = Math.max(2600, 3900 - diffScaleGlobal * 1000);
          if (nowTime >= (soldier.lastRocketTime || 0) && soldier.mesh.position.z < -6.5) {
            soldier.lastRocketTime = nowTime + rocketInterval;
            launchBossRocket(soldier);
          }
        }

        if (soldier.isHelicopter) {
          if (soldier.mainRotor) soldier.mainRotor.rotation.y += delta * 42;
          if (soldier.tailRotor) soldier.tailRotor.rotation.x += delta * 52;

          const baseHeliX = Math.sin(elapsed * 1.35 + soldier.walkOffset) * 2.1 + (soldier.dodgeOffsetX || 0);
          soldier.mesh.position.x = Math.max(-3.6, Math.min(3.6, baseHeliX));
          soldier.mesh.position.y = 1.05 + Math.cos(elapsed * 2.2) * 0.22 + (soldier.dodgeOffsetY || 0);

          const sideYaw = soldier.mesh.position.x >= 0 ? -0.48 : 0.48;
          soldier.mesh.rotation.y = THREE.MathUtils.damp(
            soldier.mesh.rotation.y,
            sideYaw + Math.sin(elapsed * 1.1) * 0.18,
            4,
            delta
          );
          soldier.mesh.rotation.z =
            Math.sin(elapsed * 1.35 + soldier.walkOffset) * 0.14 -
            ((soldier.dodgeTargetX || 0) - (soldier.dodgeOffsetX || 0)) * 0.15 +
            (isCriticallyDamaged ? 0.18 + Math.sin(elapsed * 28) * 0.12 : 0);
          soldier.mesh.rotation.x = 0.22 + (isCriticallyDamaged ? Math.cos(elapsed * 24) * 0.08 : 0);

          if (soldier.mesh.position.z < -11.5) {
            soldier.mesh.position.z += soldier.speed * delta;
          }
        } else if (soldier.isRobot) {
          if (soldier.mesh.position.z < -11.5) {
            soldier.mesh.position.z += soldier.speed * delta;
          }
          const baseRobotX = Math.sin(elapsed * 1.1 + soldier.walkOffset) * 1.7 + (soldier.dodgeOffsetX || 0);
          soldier.mesh.position.x = Math.max(-3.3, Math.min(3.3, baseRobotX));
          const stompCycle = Math.sin(elapsed * 4.2 + soldier.walkOffset);
          if (soldier.leftLeg && soldier.rightLeg) {
            soldier.leftLeg.rotation.x = stompCycle * 0.55;
            soldier.rightLeg.rotation.x = -stompCycle * 0.55;
          }
          if (soldier.gatling) {
            soldier.gatling.rotation.z += delta * 24;
          }
          soldier.mesh.position.y = -1.5 + Math.abs(Math.sin(elapsed * 4.2 + soldier.walkOffset)) * 0.18;
          soldier.mesh.rotation.y = Math.sin(elapsed * 2.1) * 0.12 - ((soldier.dodgeOffsetX || 0) * 0.08);
          soldier.mesh.rotation.z = isCriticallyDamaged ? 0.16 + Math.sin(elapsed * 26) * 0.07 : 0;
        } else if (soldier.isJet) {
          soldier.mesh.position.z += soldier.speed * delta;
          const baseJetX = Math.sin(elapsed * 1.5 + soldier.walkOffset) * 2.0 + (soldier.dodgeOffsetX || 0);
          soldier.mesh.position.x = Math.max(-3.6, Math.min(3.6, baseJetX));
          soldier.mesh.position.y = 1.25 + Math.sin(elapsed * 2.2) * 0.24 + (soldier.dodgeOffsetY || 0);
          soldier.mesh.rotation.z =
            Math.sin(elapsed * 2.4) * 0.25 -
            ((soldier.dodgeTargetX || 0) - (soldier.dodgeOffsetX || 0)) * 0.22 +
            (isCriticallyDamaged ? 0.22 + Math.sin(elapsed * 30) * 0.14 : 0);
          if (soldier.afterburnerMesh) {
            soldier.afterburnerMesh.scale.set(1, 1, 1 + Math.random() * 0.85);
          }
          if (soldier.mesh.position.z > -9.5) {
            soldier.mesh.position.z = -34;
            sounds.playJetFlyby();
          }
        } else if (soldier.isTank) {
          // HEAVY M1A2 BIO-TANK:
          // Cycles Advance -> Stop & Brace -> Swivel Turret & Aim -> Fire 120mm Finned Shell even from far away (-40m), and holds position once reaching firingLineZ!
          const tankStopZ = soldier.firingLineZ ?? -12.5;
          soldier.stanceTimer = (soldier.stanceTimer ?? 0.8) - delta;

          // Recover cannon barrel recoil & hull kickback smoothly
          soldier.cannonRecoil = THREE.MathUtils.damp(soldier.cannonRecoil || 0, 0, 7, delta);
          soldier.hullRock = THREE.MathUtils.damp(soldier.hullRock || 0, 0, 6, delta);
          if (soldier.cannon) {
            soldier.cannon.position.z = -(soldier.cannonRecoil || 0);
            soldier.cannon.rotation.x = isCriticallyDamaged ? 0.14 + Math.sin(elapsed * 20) * 0.04 : 0;
          }
          soldier.mesh.rotation.x = soldier.hullRock || 0;
          soldier.mesh.rotation.z = isCriticallyDamaged ? -0.09 + Math.sin(elapsed * 26) * 0.04 : 0;
          if (soldier.turret) {
            soldier.turret.rotation.z = isCriticallyDamaged ? 0.22 + Math.sin(elapsed * 22) * 0.05 : 0;
          }

          if (soldier.stanceState === 'advancing') {
            if (soldier.mesh.position.z < tankStopZ) {
              // Roll forward from far away toward the barricade line
              soldier.mesh.position.z += soldier.speed * delta;
              if (soldier.mesh.position.z > tankStopZ) {
                soldier.mesh.position.z = tankStopZ;
              }
            }
            // Tactical Tank AI: Position hull in a clear firing lane or align with player's active cover bunker to breach it!
            if (soldier.flankTargetX === undefined || Math.random() < 0.015) {
              soldier.flankTargetX = Math.max(-2.8, Math.min(2.8, playerPosRef.current.x + (soldier.id % 2 === 0 ? -0.9 : 0.9)));
            }
            const tankLateralDiff = (soldier.flankTargetX ?? 0) - soldier.mesh.position.x;
            soldier.mesh.position.x += Math.sign(tankLateralDiff) * Math.min(Math.abs(tankLateralDiff), 1.25 * delta);
            soldier.mesh.position.x = Math.max(-3.2, Math.min(3.2, soldier.mesh.position.x));
            soldier.mesh.position.y = -0.5 + Math.sin(elapsed * 10 + soldier.walkOffset) * 0.025;
            if (soldier.turret) {
              const dx = playerPosRef.current.x - soldier.mesh.position.x;
              const dz = playerPosRef.current.z - soldier.mesh.position.z;
              const trackYaw = Math.max(-0.45, Math.min(0.45, Math.atan2(dx, Math.max(1, dz))));
              soldier.turret.rotation.y = THREE.MathUtils.damp(
                soldier.turret.rotation.y,
                trackYaw + Math.sin(elapsed * 1.8) * 0.08,
                5,
                delta
              );
            }
            // Stop to brace, aim, and fire even from far away (z > -40)!
            if (soldier.stanceTimer <= 0 && soldier.mesh.position.z > -40) {
              soldier.stanceState = 'crouching';
              soldier.stanceTimer = 0.34;
            }
          } else if (soldier.stanceState === 'crouching') {
            // Suspension dips forward as brakes lock at any distance
            soldier.mesh.position.y = THREE.MathUtils.damp(soldier.mesh.position.y, -0.58, 10, delta);
            soldier.hullRock = 0.05;
            if (soldier.stanceTimer <= 0) {
              soldier.stanceState = 'aiming';
              soldier.stanceTimer = Math.max(0.38, 0.62 - diffScaleGlobal * 0.18);
            }
          } else if (soldier.stanceState === 'aiming') {
            // Turret swivels & locks onto player X coordinate (with velocity prediction) from any range
            if (soldier.turret) {
              const dx = (playerPosRef.current.x + smoothedPlayerVelX * 0.35) - soldier.mesh.position.x;
              const dz = playerPosRef.current.z - soldier.mesh.position.z;
              const aimYaw = Math.max(-0.55, Math.min(0.55, Math.atan2(dx, Math.max(1, dz))));
              soldier.turret.rotation.y = THREE.MathUtils.damp(soldier.turret.rotation.y, aimYaw, 9, delta);
            }
            if (soldier.stanceTimer <= 0) {
              soldier.stanceState = 'shooting';
              soldier.stanceTimer = 0.5;
              // Stronger 120mm Tank Cannon Shell with recoil, shockwave & shattering!
              const tankShellSpeed = 18.0 + diffScaleGlobal * 3.2;
              const tankShellDmg = Math.round(14 + diffScaleGlobal * 4);
              fireEnemyProjectile(soldier, tankShellSpeed, tankShellDmg);
            }
          } else if (soldier.stanceState === 'shooting') {
            soldier.mesh.position.y = THREE.MathUtils.damp(soldier.mesh.position.y, -0.5, 6, delta);
            if (soldier.stanceTimer <= 0) {
              soldier.stanceState = 'advancing';
              soldier.stanceTimer = Math.max(0.75, 1.35 - diffScaleGlobal * 0.35) + Math.random() * 0.7;
            }
          }
        } else {
          // MULTIPLAYER DEATHMATCH: 100% REAL ONLINE PLAYERS (ZERO BOTS!)
          if (isMultiplayerDeathmatch) {
            if (soldier.remotePlayerId) {
              const rp = mpOnlinePlayersRef.current.find((p) => p.playerId === soldier.remotePlayerId);
              if (rp) {
                // Predict remote player movement AND aiming angles in shared 1:1 3D world space using high-precision performance clock!
                const pred = predictRemoteEntityState(rp, nowTime);
                const targetX = THREE.MathUtils.clamp(pred.worldX, -32.0, 32.0);
                const targetZ = THREE.MathUtils.clamp(pred.worldZ, -46.0, 12.0);
                const moveDist = Math.hypot(
                  targetX - soldier.mesh.position.x,
                  targetZ - soldier.mesh.position.z
                );
                const remoteSpeedMag = Math.hypot(rp.vx || 0, rp.vz || 0);

                // State Snapshot Interpolation: targetX & targetZ are continuously interpolated along authoritative server snapshots
                if (moveDist > 6.0) {
                  soldier.mesh.position.x = targetX;
                  soldier.mesh.position.z = targetZ;
                } else {
                  // Direct snapshot positioning when snapshots are active, with high-frequency smoothing to absorb frame jitter
                  soldier.mesh.position.x = THREE.MathUtils.damp(
                    soldier.mesh.position.x,
                    targetX,
                    35,
                    delta
                  );
                  soldier.mesh.position.z = THREE.MathUtils.damp(
                    soldier.mesh.position.z,
                    targetZ,
                    35,
                    delta
                  );
                }

                // Instantaneous HP bar & stasis shield sync in render loop (preserves multi-shot local damage)
                const isLocallyEliminated = Boolean(
                  soldier.localEliminatedUntil && nowTime < soldier.localEliminatedUntil
                );
                const isRecentlyDamagedLocally = Boolean(
                  soldier.lastLocalDamagedAt && nowTime - soldier.lastLocalDamagedAt < 3500
                );
                const remoteIsProtected =
                  rp.status === 'stunned' || rp.status === 'reviving' || rp.hp <= 0;
                const isCurrentlyStunned = remoteIsProtected || isLocallyEliminated;
                const displayHp = rp.hp > 0 ? rp.hp : 100;

                if (isCurrentlyStunned) {
                  soldier.hp = 100;
                  soldier.hitsLeft = 3;
                  if (remoteIsProtected) {
                    soldier.lastLocalDamagedAt = 0;
                  }
                } else if (isRecentlyDamagedLocally) {
                  soldier.hp = Math.min(soldier.hp, displayHp);
                  soldier.hitsLeft = Math.min(soldier.hitsLeft, Math.max(0.2, (displayHp / 100) * 3));
                } else {
                  soldier.hp = displayHp;
                  soldier.hitsLeft = Math.max(0.2, (displayHp / 100) * 3);
                }

                if (soldier.hpBarFill) {
                  const pct = Math.max(0.02, Math.min(1, soldier.hp / 100));
                  soldier.hpBarFill.scale.x = pct;
                  soldier.hpBarFill.position.x = -(0.82 * (1 - pct)) / 2;
                }

                // Sync opponent's biological fighter character avatar & realistic 3D equipped weapon in real time
                soldier.mesh.visible = true;
                const nextAvatar = resolvePlayerAvatarType(rp.playerId, rp.avatarType);
                const nextWeapon = rp.weaponId || 'scar_bio';
                if (soldier.avatarType !== nextAvatar || soldier.equippedWeaponId !== nextWeapon) {
                  soldier.avatarType = nextAvatar;
                  soldier.equippedWeaponId = nextWeapon;
                  updateStudentOperatorAppearance(soldier.mesh, nextAvatar, nextWeapon);
                }

                // Orient opponent in true 360° shared world space using their look yaw
                // Local camera forward is (-sin(yaw), -cos(yaw)); soldier model forward is +Z (0, +1), so model yaw = PI + pred.yaw
                const desiredYaw = Math.PI + pred.yaw;
                const yawDiff = Math.atan2(
                  Math.sin(desiredYaw - soldier.mesh.rotation.y),
                  Math.cos(desiredYaw - soldier.mesh.rotation.y)
                );
                soldier.mesh.rotation.y += yawDiff * Math.min(1, delta * 18);

                soldier.isStunned = isCurrentlyStunned;
                if (isCurrentlyStunned) {
                  if (soldier.stasisCage) {
                    soldier.stasisCage.visible = true;
                    soldier.stasisCage.rotation.y += delta * 2.4;
                  }
                  if (soldier.scopeGlint) {
                    (soldier.scopeGlint.material as THREE.MeshBasicMaterial).opacity = 0;
                  }
                  continue;
                } else if (soldier.stasisCage) {
                  soldier.stasisCage.visible = false;
                }

                // Accurate shared 3D surface elevation across ground, Central Bunker interior (0.55) / rooftop (6.7), Watchtower deck (4.8), and Flanking Ridges (1.5)
                const surfaceElev = getArenaSurfaceElevation(
                  soldier.mesh.position.x,
                  soldier.mesh.position.z,
                  pred.worldY
                ).elevationY;
                const targetElevY = Math.max(pred.worldY, surfaceElev);
                const targetBaseY = targetElevY + (rp.isCrouched ? -0.68 : -0.32);

                // Tilt opponent's arms & 3D weapon vertically to match the exact pitch they are aiming at!
                const remoteAimPitch = THREE.MathUtils.clamp(rp.pitch || 0, -0.62, 0.62);

                // Animate limbs based on whether the real opponent is actively moving or aiming
                if (moveDist > 0.03 || remoteSpeedMag > 0.35) {
                  const runCycle = Math.sin(elapsed * 16 + soldier.walkOffset);
                  if (soldier.leftLeg && soldier.rightLeg) {
                    soldier.leftLeg.rotation.x = runCycle * 0.78;
                    soldier.rightLeg.rotation.x = -runCycle * 0.78;
                  }
                  if (soldier.leftArm && soldier.rightArm) {
                    soldier.leftArm.rotation.x = THREE.MathUtils.damp(
                      soldier.leftArm.rotation.x,
                      -0.58 - remoteAimPitch - runCycle * 0.14,
                      18,
                      delta
                    );
                    soldier.rightArm.rotation.x = THREE.MathUtils.damp(
                      soldier.rightArm.rotation.x,
                      -0.68 - remoteAimPitch + runCycle * 0.10,
                      18,
                      delta
                    );
                  }
                  if (Math.abs(targetBaseY - soldier.mesh.position.y) > 4.5) {
                    soldier.mesh.position.y = targetBaseY;
                  } else {
                    soldier.mesh.position.y = THREE.MathUtils.damp(
                      soldier.mesh.position.y,
                      targetBaseY + Math.abs(runCycle) * 0.06,
                      20,
                      delta
                    );
                  }
                } else {
                  if (soldier.leftLeg && soldier.rightLeg) {
                    soldier.leftLeg.rotation.x = THREE.MathUtils.damp(soldier.leftLeg.rotation.x, 0, 16, delta);
                    soldier.rightLeg.rotation.x = THREE.MathUtils.damp(soldier.rightLeg.rotation.x, 0, 16, delta);
                  }
                  if (soldier.leftArm && soldier.rightArm) {
                    soldier.leftArm.rotation.x = THREE.MathUtils.damp(
                      soldier.leftArm.rotation.x,
                      -0.58 - remoteAimPitch,
                      18,
                      delta
                    );
                    soldier.rightArm.rotation.x = THREE.MathUtils.damp(
                      soldier.rightArm.rotation.x,
                      -0.68 - remoteAimPitch,
                      18,
                      delta
                    );
                  }
                  if (Math.abs(targetBaseY - soldier.mesh.position.y) > 4.5) {
                    soldier.mesh.position.y = targetBaseY;
                  } else {
                    soldier.mesh.position.y = THREE.MathUtils.damp(soldier.mesh.position.y, targetBaseY, 18, delta);
                  }
                }

                // Trigger visual 3D muzzle flash & tracer along the remote player's ACTUAL look direction when they fire!
                // (Never aimbots at local player and never spawns damaging AI bullets — authoritative PvP damage is handled strictly by sendPlayerHitEvent when a shot genuinely hits!)
                const lastShotProcessed = remoteShotSeqProcessedRef.current[rp.playerId] || 0;
                if (rp.shotSeq > lastShotProcessed && rp.status === 'active') {
                  remoteShotSeqProcessedRef.current[rp.playerId] = rp.shotSeq;
                  sounds.playEnemyShoot();
                  const rYaw = pred.yaw;
                  const rPitch = rp.pitch || 0;
                  const dirX = -Math.sin(rYaw) * Math.cos(rPitch);
                  const dirY = Math.sin(rPitch);
                  const dirZ = -Math.cos(rYaw) * Math.cos(rPitch);
                  _v1.set(
                    soldier.mesh.position.x + dirX * 0.78,
                    soldier.mesh.position.y + 0.14 + dirY * 0.78,
                    soldier.mesh.position.z + dirZ * 0.78
                  );
                  _v3.set(dirX, dirY, dirZ).normalize();
                  _v2.copy(_v1).addScaledVector(_v3, 28);
                  triggerMuzzleFlash(_v1, _v3, 'RIFLE');
                  const remoteTracer = acquirePlayerTracer(0xf43f5e);
                  remoteTracer.position.copy(_v1);
                  remoteTracer.lookAt(_v2);
                  const tSpeed = 58;
                  activePlayerTracersRef.current.push({
                    mesh: remoteTracer,
                    vx: _v3.x * tSpeed,
                    vy: _v3.y * tSpeed,
                    vz: _v3.z * tSpeed,
                    life: 0.5,
                  });
                }
              }
            }
            // In multiplayer deathmatch, NEVER run single-player bot AI loops!
            continue;
          }

          // IMPROVED TACTICAL BACTERIA SOLDIER / STUDENT OPERATIVE AI:
          // 1. Cover-Flanking: Spreads into open flanking lanes when player hides behind a sandbag bunker
          // 2. Reactive Sidestep Juke: Evades laterally and ducks into crouch when targeted by player's laser/crosshair
          // 3. Coordinated Bursts: Bacillus Heavy Gunners fire 2-round suppressive bursts while Strep Troopers fire precision scoped shots
          const stopZ = soldier.firingLineZ ?? -8.2;
          soldier.stanceTimer = (soldier.stanceTimer ?? 0.75) - delta;
          if (soldier.evadeCooldown && soldier.evadeCooldown > 0) {
            soldier.evadeCooldown -= delta;
          }

          // Detect if player's laser/crosshair is aiming directly at this soldier
          const approxLaserX = playerPosRef.current.x + aimPosRef.current.x * Math.abs(soldier.mesh.position.z) * 0.38;
          const isUnderPlayerAim = Math.abs(soldier.mesh.position.x - approxLaserX) < 0.75;

          if (soldier.stanceState === 'advancing') {
            if (soldier.scopeGlint) {
              (soldier.scopeGlint.material as THREE.MeshBasicMaterial).opacity = 0.0;
            }

            if (soldier.mesh.position.z < stopZ) {
              // Advance forward from far away toward the barricade firing line
              soldier.mesh.position.z += soldier.speed * delta;
              if (soldier.mesh.position.z >= stopZ) {
                soldier.mesh.position.z = stopZ;
                // Immediately crouch & scope when arriving at the barricade firing line
                soldier.stanceTimer = 0;
              }
            }

            // Tactical Cover-Flanking & Spacing AI:
            // In Multiplayer, AI Student Operatives maneuver across the wide 60m Lung & Alveoli arena and use Anatomical Cover Clusters!
            const maxAiLateral = isMultiplayerDeathmatch ? 26.0 : 3.3;
            if (soldier.flankTargetX === undefined) {
              const flankSign = soldier.id % 2 === 0 ? -1 : 1;
              soldier.flankTargetX = Math.max(
                -maxAiLateral,
                Math.min(
                  maxAiLateral,
                  isMultiplayerDeathmatch
                    ? playerPosRef.current.x + flankSign * (3.5 + (soldier.id % 5) * 3.2)
                    : -playerPosRef.current.x * 0.55 + flankSign * (1.35 + (soldier.id % 3) * 0.65)
                )
              );
            }

            // Reactive Evasive Sidestep Juke when player aims at this soldier!
            if (isUnderPlayerAim && (soldier.evadeCooldown ?? 0) <= 0 && soldier.mesh.position.z > -38) {
              soldier.evadeCooldown = 2.4;
              const jukeDir = soldier.mesh.position.x > playerPosRef.current.x ? -1 : 1;
              soldier.flankTargetX = Math.max(
                -maxAiLateral,
                Math.min(maxAiLateral, soldier.mesh.position.x + jukeDir * (isMultiplayerDeathmatch ? 3.2 : 1.65))
              );
              if (soldier.mesh.position.z > -32 && Math.random() < 0.65) {
                soldier.stanceState = 'crouching';
                soldier.stanceTimer = 0.32;
              }
            }

            const runCycle = Math.sin(elapsed * 18 + soldier.walkOffset);
            if (soldier.leftLeg && soldier.rightLeg) {
              soldier.leftLeg.rotation.x = runCycle * 0.85;
              soldier.rightLeg.rotation.x = -runCycle * 0.85;
            }
            if (soldier.leftArm && soldier.rightArm) {
              soldier.leftArm.rotation.x = -runCycle * 0.55;
              soldier.rightArm.rotation.x = -0.65 + runCycle * 0.28;
            }
            soldier.mesh.rotation.x = THREE.MathUtils.damp(soldier.mesh.rotation.x, 0.22, 8, delta);

            const lateralGoal = soldier.flankTargetX ?? soldier.mesh.position.x;
            const lateralSteer = THREE.MathUtils.clamp(
              lateralGoal - soldier.mesh.position.x,
              isMultiplayerDeathmatch ? -3.4 : -1.8,
              isMultiplayerDeathmatch ? 3.4 : 1.8
            );
            soldier.mesh.position.x +=
              (lateralSteer * 1.15 + Math.sin(elapsed * 3.5 + soldier.walkOffset) * 0.95) * delta;
            soldier.mesh.position.x = Math.max(
              isMultiplayerDeathmatch ? -28.0 : -3.5,
              Math.min(isMultiplayerDeathmatch ? 28.0 : 3.5, soldier.mesh.position.x)
            );
            soldier.mesh.position.y = THREE.MathUtils.damp(
              soldier.mesh.position.y,
              (isMultiplayerDeathmatch ? -0.32 : 0) + Math.abs(runCycle) * 0.06,
              10,
              delta
            );

            // Stop, crouch, aim & scope even from far away (z > -40) as well as at the barricade firing line!
            if (soldier.stanceTimer <= 0 && soldier.mesh.position.z > -40) {
              soldier.stanceState = 'crouching';
              soldier.stanceTimer = Math.max(0.24, 0.36 - diffScaleGlobal * 0.1);
            }
          } else if (soldier.stanceState === 'crouching') {
            // Drop into low tactical firing crouch (both at long range and at the barricade firing line)
            soldier.mesh.position.y = THREE.MathUtils.damp(soldier.mesh.position.y, -0.36, 12, delta);
            soldier.mesh.rotation.x = THREE.MathUtils.damp(soldier.mesh.rotation.x, 0.32, 12, delta);
            if (soldier.leftLeg && soldier.rightLeg) {
              soldier.leftLeg.rotation.x = THREE.MathUtils.damp(soldier.leftLeg.rotation.x, -0.82, 12, delta);
              soldier.rightLeg.rotation.x = THREE.MathUtils.damp(soldier.rightLeg.rotation.x, 0.65, 12, delta);
            }
            if (soldier.leftArm && soldier.rightArm) {
              soldier.leftArm.rotation.x = THREE.MathUtils.damp(soldier.leftArm.rotation.x, -1.15, 12, delta);
              soldier.rightArm.rotation.x = THREE.MathUtils.damp(soldier.rightArm.rotation.x, -1.2, 12, delta);
            }
            if (soldier.stanceTimer <= 0) {
              soldier.stanceState = 'aiming';
              soldier.stanceTimer = Math.max(0.35, 0.54 - diffScaleGlobal * 0.16);
            }
          } else if (soldier.stanceState === 'aiming') {
            // AIM & SCOPE: Raise scoped rifle directly to eye level & flash bright red/amber optical scope glint!
            soldier.mesh.position.y = THREE.MathUtils.damp(soldier.mesh.position.y, -0.36, 12, delta);
            const dx = (playerPosRef.current.x + smoothedPlayerVelX * 0.25) - soldier.mesh.position.x;
            const dz = playerPosRef.current.z - soldier.mesh.position.z;
            const targetYaw = Math.max(-0.48, Math.min(0.48, Math.atan2(dx, Math.max(1, dz))));
            soldier.mesh.rotation.y = THREE.MathUtils.damp(soldier.mesh.rotation.y, targetYaw, 12, delta);
            if (soldier.leftArm && soldier.rightArm) {
              soldier.leftArm.rotation.x = THREE.MathUtils.damp(soldier.leftArm.rotation.x, -1.42, 15, delta);
              soldier.rightArm.rotation.x = THREE.MathUtils.damp(soldier.rightArm.rotation.x, -1.48, 15, delta);
              soldier.rightArm.rotation.z = THREE.MathUtils.damp(soldier.rightArm.rotation.z, -0.22, 15, delta);
            }
            if (soldier.scopeGlint) {
              const glintMat = soldier.scopeGlint.material as THREE.MeshBasicMaterial;
              glintMat.opacity = 0.95;
              const glintPulse = 1.15 + Math.sin(elapsed * 28) * 0.35;
              soldier.scopeGlint.scale.set(glintPulse, glintPulse, glintPulse);
            }
            if (soldier.stanceTimer <= 0) {
              soldier.stanceState = 'shooting';
              // Bacillus Heavy Gunners fire a 2-round suppressive burst; Strep Troopers fire 1 precision scoped shot
              const isHeavyBurst = soldier.type === 'bacillus';
              soldier.burstShotsRemaining = isHeavyBurst ? 1 : 0;
              soldier.nextBurstTime = nowTime + 185;
              soldier.stanceTimer = isHeavyBurst ? 0.44 : 0.3;
              // Fire realistic 3D pointed Spitzer bullet with supersonic bullet race trail!
              fireEnemyProjectile(soldier, soldierBulletSpeed, soldierBulletDmg);
              if (soldier.rightArm && soldier.leftArm) {
                soldier.rightArm.rotation.x = -1.72; // Visible scoped rifle recoil kick
                soldier.leftArm.rotation.x = -1.62;
              }
            }
          } else if (soldier.stanceState === 'shooting') {
            if (soldier.scopeGlint) {
              (soldier.scopeGlint.material as THREE.MeshBasicMaterial).opacity = 0.25;
            }
            // Execute follow-up burst shot for Bacillus Heavy Gunner
            if ((soldier.burstShotsRemaining ?? 0) > 0 && nowTime >= (soldier.nextBurstTime ?? 0)) {
              soldier.burstShotsRemaining = (soldier.burstShotsRemaining ?? 1) - 1;
              fireEnemyProjectile(soldier, soldierBulletSpeed * 1.04, soldierBulletDmg);
              if (soldier.rightArm && soldier.leftArm) {
                soldier.rightArm.rotation.x = -1.74;
                soldier.leftArm.rotation.x = -1.64;
              }
            }
            if (soldier.leftArm && soldier.rightArm) {
              soldier.leftArm.rotation.x = THREE.MathUtils.damp(soldier.leftArm.rotation.x, -1.2, 10, delta);
              soldier.rightArm.rotation.x = THREE.MathUtils.damp(soldier.rightArm.rotation.x, -1.25, 10, delta);
              soldier.rightArm.rotation.z = THREE.MathUtils.damp(soldier.rightArm.rotation.z, 0, 10, delta);
            }
            if (soldier.stanceTimer <= 0) {
              soldier.stanceState = 'advancing';
              soldier.mesh.rotation.y = 0;
              // Pick a new flanking offset after each firing cycle so troops reposition dynamically!
              const sideShift = (Math.random() < 0.5 ? -1 : 1) * (isMultiplayerDeathmatch ? 2.4 + Math.random() * 3.5 : 0.9 + Math.random() * 1.2);
              const maxFlank = isMultiplayerDeathmatch ? 26.0 : 3.3;
              soldier.flankTargetX = Math.max(-maxFlank, Math.min(maxFlank, soldier.mesh.position.x + sideShift));
              soldier.stanceTimer = Math.max(0.65, 1.15 - diffScaleGlobal * 0.32) + Math.random() * 0.65;
            }
          }
        }

        // Boss primary weapon firing (Helicopter chin chain-gun, Cyber-Robot gatling, F-16 Vulcan cannon)
        if (soldier.isBoss && soldier.mesh.position.z > -55 && soldier.mesh.position.z < -4.0) {
          const bossShootInterval = soldier.isHelicopter
            ? Math.max(780, 1080 - diffScaleGlobal * 240)
            : soldier.isRobot
            ? Math.max(1150, 1550 - diffScaleGlobal * 300)
            : Math.max(980, 1320 - diffScaleGlobal * 260);
          if (nowTime - soldier.lastShootTime > bossShootInterval) {
            soldier.lastShootTime = nowTime + (Math.random() - 0.5) * 240;
            const bossBulletSpeed = soldier.isHelicopter ? 23 : soldier.isRobot ? 20 : 27;
            const bossBulletDmg = soldier.isHelicopter
              ? 7 + phaseNumber
              : soldier.isRobot
              ? 10 + phaseNumber
              : 9 + phaseNumber;
            fireEnemyProjectile(soldier, bossBulletSpeed, bossBulletDmg);
          }
        }

        // Enemy collision with player
        if (soldier.mesh.position.z >= playerPosRef.current.z + 1.2) {
          releaseSoldierToPool(soldier);
          activeSoldiersRef.current.splice(i, 1);

          const dmg = soldier.isTank ? 32 : soldier.isBoss ? 28 : 12 + Math.round(diffScaleGlobal * 8);
          lastDamageTakenTime = elapsed;
          playerHpRef.current = Math.max(0, playerHpRef.current - dmg);
          setPlayerHp(playerHpRef.current);
          cameraShakeRef.current = 0.55;
          comboStreakRef.current = 0;
          sounds.playQuizWrong();

          if (playerHpRef.current <= 0) {
            if (isMultiplayerDeathmatch) {
              triggerMpEliminatedStateRef.current?.(soldier.name || 'Rival Operative', 'Close-Quarters Strike');
            } else {
              onPhaseDefeat(scoreRef.current, killsRef.current);
            }
          }
        }
      }

      // 4c. UPDATE ENEMY BULLETS, BOSS ROCKETS & DESTRUCTIBLE SANDBAG BARRICADES
      // Faster Barricade Auto-Repair (8.5 seconds) so cover is reliably rebuilt even during intense Phase 3 bombardments!
      barricadesRef.current.forEach((bar) => {
        if (bar.hp <= 0) {
          bar.respawnTimer += delta;
          if (bar.respawnTimer >= 8.5) {
            bar.hp = bar.maxHp;
            bar.respawnTimer = 0;
            bar.group.visible = true;
            bar.group.position.y = bar.y;
            const pct = 1.0;
            bar.hpBarFill.scale.x = pct;
            bar.hpBarFill.position.x = 0;
            (bar.hpBarFill.material as THREE.MeshBasicMaterial).color.setHex(0x10b981);
          }
        }
      });

      // Helper to apply damage to a sandbag barricade and trigger 3D Sandbag Shattering when destroyed!
      const damageBarricade = (bar: ActiveBarricade, dmg: number, hitPos: THREE.Vector3, isHeavyImpact = false) => {
        const wasAlive = bar.hp > 0;
        bar.hp = Math.max(0, bar.hp - dmg);
        const pct = Math.max(0.01, bar.hp / bar.maxHp);
        bar.hpBarFill.scale.x = pct;
        bar.hpBarFill.position.x = -(1.38 * (1 - pct)) / 2;
        const mat = bar.hpBarFill.material as THREE.MeshBasicMaterial;
        if (pct > 0.5) mat.color.setHex(0x10b981);
        else if (pct > 0.25) mat.color.setHex(0xf59e0b);
        else mat.color.setHex(0xef4444);

        bar.group.position.y = bar.y - (1 - pct) * 0.18;

        sounds.playBarricadeHit();
        triggerSandDust(hitPos);

        if (isHeavyImpact && bar.hp > 0) {
          // Tank cannon / Boss rocket impact sends extra flying sandbags & splinters even before full destruction!
          cameraShakeRef.current = Math.max(cameraShakeRef.current, 0.48);
        }

        if (bar.hp <= 0 && wasAlive) {
          _v4.set(bar.x, bar.y + 0.15, bar.z);
          triggerExplosion(_v4);
          if (isMultiplayerDeathmatch) {
            triggerMembraneDisintegration(_v4, 'bacillus');
            spawnBiologicalDropRef.current?.(bar.x, bar.z, Math.random() > 0.5 ? 'atp' : 'shield');
          }
          triggerBarricadeShatter(_v4);
          bar.group.visible = false;
          bar.respawnTimer = 0;
        }
      };

      // Helper: Apply Splash Damage to Player when hiding behind a Barricade hit by Mortar Shells or Boss Missiles!
      const applyBarricadeSplashToPlayer = (
        bar: ActiveBarricade,
        splashDamage: number,
        sourceType: 'MORTAR SPLASH' | 'BOSS MISSILE' = 'MORTAR SPLASH'
      ) => {
        if (
          Math.abs(playerPosRef.current.x - bar.x) <= 1.65 &&
          playerPosRef.current.z >= bar.z - 0.65
        ) {
          lastDamageTakenTime = elapsed;
          playerHpRef.current = Math.max(0, playerHpRef.current - splashDamage);
          syncPlayerHpToReact(nowTime, true);
          triggerDirectionalDamageFeedback(bar.x, bar.z, splashDamage, sourceType, true);
          if (playerHpRef.current <= 0) {
            if (isMultiplayerDeathmatch) {
              triggerMpEliminatedStateRef.current?.('Rival Operative', sourceType);
            } else {
              onPhaseDefeat(scoreRef.current, killsRef.current);
            }
          }
        }
      };

      // Update Active 3D Boss Rockets (Fiery Smoke Trail + Barricade & Player Splash Damage!)
      const rockets = activeBossRocketsRef.current;
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.mesh.position.x += r.vx * delta;
        r.mesh.position.y += r.vy * delta;
        r.mesh.position.z += r.vz * delta;
        r.flame.scale.set(
          0.9 + Math.random() * 0.4,
          1.0 + Math.random() * 0.6,
          0.9 + Math.random() * 0.4
        );
        r.life -= delta;

        // Emit fiery rocket exhaust trail particle (via zero-GC debris pool)
        if (Math.random() < 0.45) {
          spawnPooledParticle(
            sharedSandGeo,
            sharedMuzzleBlastMats[Math.floor(Math.random() * 2)],
            r.mesh.position,
            (Math.random() - 0.5) * 1.6,
            (Math.random() - 0.5) * 1.6,
            -2.2,
            0.22,
            0.22
          );
        }

        let rocketDetonated = false;
        const candidateBars = barricadeSpatialGrid.query(r.mesh.position.x, r.mesh.position.z, 2.0);
        for (const bar of candidateBars) {
          if (bar.hp <= 0) continue;
          if (
            Math.abs(r.mesh.position.x - bar.x) <= 1.25 &&
            Math.abs(r.mesh.position.z - bar.z) <= 0.65 &&
            r.mesh.position.y <= bar.y + 1.1
          ) {
            triggerExplosion(r.mesh.position);
            const barMissileDmg = 26;
            const splashDmg = Math.max(8, Math.round(r.damage * 0.45));
            damageBarricade(bar, barMissileDmg, r.mesh.position, true);
            applyBarricadeSplashToPlayer(bar, splashDmg, 'BOSS MISSILE');
            r.mesh.visible = false;
            rockets[i] = rockets[rockets.length - 1];
            rockets.pop();
            rocketDetonated = true;
            break;
          }
        }
        if (rocketDetonated) continue;

        const pz = playerPosRef.current.z;
        if (r.mesh.position.z >= pz - 0.55 && r.mesh.position.z <= pz + 0.75) {
          const distToPlayer = Math.hypot(
            r.mesh.position.x - playerPosRef.current.x,
            r.mesh.position.y - (camera.position.y - 0.1)
          );
          if (distToPlayer < 0.88) {
            const coverBar = barricadesRef.current.find(
              (bar) => bar.hp > 0 && Math.abs(playerPosRef.current.x - bar.x) <= 1.25
            );
            triggerExplosion(r.mesh.position);
            if (coverBar) {
              const barMissileDmg = 26;
              const splashDmg = Math.max(8, Math.round(r.damage * 0.45));
              damageBarricade(coverBar, barMissileDmg, r.mesh.position, true);
              applyBarricadeSplashToPlayer(coverBar, splashDmg, 'BOSS MISSILE');
            } else {
              lastDamageTakenTime = elapsed;
              playerHpRef.current = Math.max(0, playerHpRef.current - r.damage);
              syncPlayerHpToReact(nowTime, true);
              triggerDirectionalDamageFeedback(
                r.mesh.position.x,
                r.mesh.position.z - 4,
                r.damage,
                'BOSS MISSILE',
                false
              );
              if (playerHpRef.current <= 0) {
                if (isMultiplayerDeathmatch) {
                  triggerMpEliminatedStateRef.current?.('Rival Operative', 'Boss Missile');
                } else {
                  onPhaseDefeat(scoreRef.current, killsRef.current);
                }
              }
            }
            r.mesh.visible = false;
            rockets[i] = rockets[rockets.length - 1];
            rockets.pop();
            continue;
          }
        }

        if (r.mesh.position.z > playerPosRef.current.z + 3.5 || r.life <= 0) {
          r.mesh.visible = false;
          rockets[i] = rockets[rockets.length - 1];
          rockets.pop();
        }
      }

      // 4c-bis. BLÉRIOT WW2 PLANE MORTAR BOMBING RUNS ON BARRICADES (2 in Phase 1, 3 in Phase 2, 4 in Phase 3)
      if (!isMultiplayerDeathmatch) bleriotScheduleRef.current.forEach((sched) => {
        if (!sched.fired && timeLeftRef.current <= sched.triggerTime && timeLeftRef.current > 1) {
          sched.fired = true;

          const intactIndices = barricadesRef.current
            .map((b, idx) => (b.hp > 0 ? idx : -1))
            .filter((idx) => idx !== -1);

          if (intactIndices.length <= 1) {
            const downedIdx = barricadesRef.current.findIndex((b) => b.hp <= 0);
            if (downedIdx !== -1) {
              const restored = barricadesRef.current[downedIdx];
              restored.hp = restored.maxHp;
              restored.respawnTimer = 0;
              restored.group.visible = true;
              restored.group.position.y = restored.y;
              restored.hpBarFill.scale.x = 1;
              restored.hpBarFill.position.x = 0;
              (restored.hpBarFill.material as THREE.MeshBasicMaterial).color.setHex(0x10b981);
            }
          }

          const targetIdx =
            intactIndices.length > 0
              ? intactIndices[Math.floor(Math.random() * intactIndices.length)]
              : Math.floor(Math.random() * barricadesRef.current.length);
          const targetBar = barricadesRef.current[targetIdx];

          if (targetBar) {
            if (targetBar.hp <= 0) {
              targetBar.hp = targetBar.maxHp;
              targetBar.group.visible = true;
              targetBar.group.position.y = targetBar.y;
            }
            const bleriot = acquireBleriotPlane();
            bleriot.group.position.set(targetBar.x, 1.85, -42);

            activeBleriotRunsRef.current.push({
              group: bleriot.group,
              propeller: bleriot.propeller,
              targetBarricadeIndex: targetIdx,
              speed: 23,
              bombDropped: false,
            });

            sounds.playBleriotMortarRun();
            const sectorLabel = targetIdx === 0 ? 'LEFT' : targetIdx === 1 ? 'CENTER' : 'RIGHT';
            setBleriotAlert(`✈️ BLÉRIOT WW2 BOMBER • MORTAR SHELL TARGETING ${sectorLabel} BARRICADE!`);
            setTimeout(() => setBleriotAlert(null), 3200);
          }
        }
      });

      // Animate Blériot Planes & Release Mortar Shells over Barricades
      for (let i = activeBleriotRunsRef.current.length - 1; i >= 0; i--) {
        const run = activeBleriotRunsRef.current[i];
        run.group.position.z += run.speed * delta;
        run.propeller.rotation.z += delta * 45;
        run.group.rotation.z = Math.sin(elapsed * 6 + i) * 0.08;

        // Release Mortar Shell as Blériot approaches barricade line
        if (!run.bombDropped && run.group.position.z >= -16.5) {
          run.bombDropped = true;
          const targetBar = barricadesRef.current[run.targetBarricadeIndex];
          if (targetBar) {
            const mortarMesh = acquireMortarBombMesh();
            mortarMesh.position.set(run.group.position.x, run.group.position.y - 0.35, run.group.position.z);

            const flightTime = 0.65;
            const dz = targetBar.z - mortarMesh.position.z;
            const dy = targetBar.y - mortarMesh.position.y;
            activeMortarBombsRef.current.push({
              mesh: mortarMesh,
              vx: (targetBar.x - mortarMesh.position.x) / flightTime,
              vy: dy / flightTime + 0.5 * 9.8 * flightTime,
              vz: dz / flightTime,
              targetBarricadeIndex: run.targetBarricadeIndex,
            });
          }
        }

        if (run.group.position.z > 12) {
          releaseBleriotPlane(run.group);
          activeBleriotRunsRef.current[i] = activeBleriotRunsRef.current[activeBleriotRunsRef.current.length - 1];
          activeBleriotRunsRef.current.pop();
        }
      }

      // Animate Falling Mortar Shells & Detonate on Target Barricade
      for (let i = activeMortarBombsRef.current.length - 1; i >= 0; i--) {
        const bomb = activeMortarBombsRef.current[i];
        bomb.mesh.position.x += bomb.vx * delta;
        bomb.mesh.position.y += bomb.vy * delta;
        bomb.mesh.position.z += bomb.vz * delta;
        bomb.vy -= 9.8 * delta;
        bomb.mesh.rotation.x = 0.6;

        const targetBar = barricadesRef.current[bomb.targetBarricadeIndex];
        if (!targetBar || bomb.mesh.position.y <= targetBar.y + 0.25 || bomb.mesh.position.z >= targetBar.z + 0.2) {
          if (targetBar) {
            _v1.set(targetBar.x, targetBar.y + 0.15, targetBar.z);
            triggerExplosion(_v1);
            const mortarBarricadeDamage = 32;
            const mortarPlayerSplashDamage = 14;
            if (targetBar.hp > 0) {
              damageBarricade(targetBar, mortarBarricadeDamage, _v1, true);
            }
            applyBarricadeSplashToPlayer(targetBar, mortarPlayerSplashDamage, 'MORTAR SPLASH');
          }
          bomb.mesh.visible = false;
          activeMortarBombsRef.current[i] = activeMortarBombsRef.current[activeMortarBombsRef.current.length - 1];
          activeMortarBombsRef.current.pop();
        }
      }

      // 4c-ter. ENEMY TROOP AIRDROP (1 Tank + 2 Flanking Soldiers: 1 drop in Phase 1, 2 in Phase 2, 3 in Phase 3!)
      if (!isMultiplayerDeathmatch) enemyAirdropScheduleRef.current.forEach((sched, dropIdx) => {
        if (!sched.fired && timeLeftRef.current <= sched.triggerTime && timeLeftRef.current > 2) {
          sched.fired = true;

          const dropLanes = [0, -0.95, 0.95];
          const dropX = dropLanes[dropIdx % dropLanes.length];
          const enemyPlane = acquireAirdropPlane();
          enemyPlane.group.position.set(dropX, 2.05, -48);

          activeEnemyAirdropsRef.current.push({
            group: enemyPlane.group,
            propellers: enemyPlane.propellers,
            speed: 19.5,
            dropped: false,
            dropX,
          });

          sounds.playAirdropPlane();
          sounds.speakTankCommander();
          setEnemyAirdropAlert(
            `🪂 ENEMY TROOP AIRDROP #${dropIdx + 1} • 1 BIO-TANK + 2 TROOPS PARACHUTING AHEAD!`
          );
          setTimeout(() => setEnemyAirdropAlert(null), 4000);
        }
      });

      // Animate Enemy Airdrop Planes & Deploy 1 Tank + 2 Flanking Soldiers on Parachutes right in front of the player!
      for (let i = activeEnemyAirdropsRef.current.length - 1; i >= 0; i--) {
        const eDrop = activeEnemyAirdropsRef.current[i];
        eDrop.group.position.z += eDrop.speed * delta;
        eDrop.propellers.forEach((p) => {
          p.rotation.z += delta * 45;
        });

        if (!eDrop.dropped && eDrop.group.position.z >= -18.5) {
          eDrop.dropped = true;
          const dropZ = eDrop.group.position.z;
          spawnSoldierOrTank(dropZ, 'tank', eDrop.dropX, true);
          spawnSoldierOrTank(dropZ - 0.4, 'strep', Math.max(-3.1, eDrop.dropX - 1.75), true);
          spawnSoldierOrTank(dropZ - 0.4, 'bacillus', Math.min(3.1, eDrop.dropX + 1.75), true);
        }

        if (eDrop.group.position.z > 14) {
          releaseAirdropPlane(eDrop.group);
          activeEnemyAirdropsRef.current[i] = activeEnemyAirdropsRef.current[activeEnemyAirdropsRef.current.length - 1];
          activeEnemyAirdropsRef.current.pop();
        }
      }

      // 4c-quater. INTERACTIVE 3D ORGAN ENVIRONMENTAL HAZARDS
      if (!isMultiplayerDeathmatch) organHazardScheduleRef.current.forEach((sched, hIdx) => {
        if (!sched.fired && timeLeftRef.current <= sched.triggerTime && timeLeftRef.current > 2) {
          sched.fired = true;
          const laneIndex = (hIdx + phaseNumber) % 3; // 0 = Left, 1 = Center, 2 = Right
          const laneX = laneIndex === 0 ? -2.4 : laneIndex === 1 ? 0 : 2.4;
          const laneLabel = laneIndex === 0 ? 'LEFT LANE' : laneIndex === 1 ? 'CENTER LANE' : 'RIGHT LANE';
          const curTheme = organThemeRef.current;

          const hazardColorHex =
            curTheme.id === 'stomach'
              ? 0x84cc16
              : curTheme.id === 'alveoli'
              ? 0x10b981
              : curTheme.id === 'intestine'
              ? 0xf59e0b
              : curTheme.id === 'brain'
              ? 0x38bdf8
              : 0xf43f5e;

          const pooledHazard = hazardPool.find((hp) => !hp.inUse) || hazardPool[0];
          pooledHazard.inUse = true;
          pooledHazard.group.position.set(laneX, -0.75, -8.2);
          pooledHazard.group.visible = true;
          const rMat = pooledHazard.warningRing.material as THREE.MeshBasicMaterial;
          rMat.color.setHex(hazardColorHex);
          rMat.opacity = 0.92;
          pooledHazard.plumes.forEach((plume) => {
            const pMat = plume.material as THREE.MeshBasicMaterial;
            pMat.color.setHex(hazardColorHex);
            pMat.opacity = 0;
            plume.visible = false;
          });

          activeOrganHazardsRef.current.push({
            group: pooledHazard.group,
            plumes: pooledHazard.plumes,
            warningRing: pooledHazard.warningRing,
            laneIndex,
            laneX,
            warningTimer: 2.0,
            activeTimer: 4.5,
            lastDamageTime: nowTime,
            themeId: curTheme.id,
          });

          sounds.playRadioChirp();
          triggerBiologyConceptRef.current?.('hazard_organ_event');

          const hazardTitle =
            curTheme.id === 'stomach'
              ? '🧪 HCl ACID GEYSER ERUPTION'
              : curTheme.id === 'alveoli'
              ? '🟢 GOBLET MUCUS SURGE'
              : curTheme.id === 'intestine'
              ? '🟡 ALKALINE BILE EMULSIFIER JET'
              : curTheme.id === 'brain'
              ? '⚡ SYNAPTIC ACTION POTENTIAL ARC'
              : '🩸 SYSTOLIC PULSE VORTEX';

          setHazardAlert(`⚠️ ${hazardTitle} IN ${laneLabel}! TAKE COVER OR SHIFT LANES!`);
          setTimeout(() => setHazardAlert(null), 4200);
        }
      });

      // Animate Active 3D Organ Environmental Hazards & Apply Lane Effects to Enemies and Exposed Player
      for (let i = activeOrganHazardsRef.current.length - 1; i >= 0; i--) {
        const hz = activeOrganHazardsRef.current[i];
        if (hz.warningTimer > 0) {
          hz.warningTimer -= delta;
          const pulse = 1 + Math.sin(elapsed * 18) * 0.18;
          hz.warningRing.scale.set(pulse, pulse, 1);
          (hz.warningRing.material as THREE.MeshBasicMaterial).opacity =
            0.45 + Math.abs(Math.sin(elapsed * 14)) * 0.5;
        } else {
          hz.activeTimer -= delta;
          hz.warningRing.scale.set(1.25, 1.25, 1);
          (hz.warningRing.material as THREE.MeshBasicMaterial).opacity = 0.85;

          hz.plumes.forEach((plume, idx) => {
            plume.visible = true;
            plume.rotation.y += delta * (idx % 2 === 0 ? 5.5 : -5.5);
            const hScale = 1.45 + Math.sin(elapsed * 14 + idx) * 0.35;
            plume.scale.set(1.35, hScale, 1.35);
            (plume.material as THREE.MeshBasicMaterial).opacity = Math.min(
              0.85,
              hz.activeTimer * 0.55
            );
          });

          // Damage & Slow Enemies caught in the active organ hazard lane!
          for (let sIdx = activeSoldiersRef.current.length - 1; sIdx >= 0; sIdx--) {
            const s = activeSoldiersRef.current[sIdx];
            if (Math.abs(s.mesh.position.x - hz.laneX) <= 1.55 && s.mesh.position.z > -22 && s.mesh.position.z < -1.5) {
              s.mesh.position.z -= s.speed * 0.55 * delta;
              if (nowTime - hz.lastDamageTime >= 600 && !s.isBoss) {
                s.hp -= 28;
                s.hitsLeft = Math.max(0.15, s.hitsLeft - 0.65);
                if (s.hpBarFill) {
                  const pct = Math.max(0.01, s.hitsLeft / s.maxHits);
                  s.hpBarFill.scale.x = pct;
                  s.hpBarFill.position.x = -(0.82 * (1 - pct)) / 2;
                }
              }
            }
          }

          if (nowTime - hz.lastDamageTime >= 650) {
            hz.lastDamageTime = nowTime;
            const playerInHazardLane = Math.abs(playerPosRef.current.x - hz.laneX) <= 1.15;
            const coverInLane = barricadesRef.current.find(
              (bar) => bar.hp > 0 && Math.abs(playerPosRef.current.x - bar.x) <= 1.25
            );
            if (playerInHazardLane && !coverInLane) {
              const hazardPlayerDmg = 6;
              lastDamageTakenTime = elapsed;
              playerHpRef.current = Math.max(0, playerHpRef.current - hazardPlayerDmg);
              setPlayerHp(playerHpRef.current);
              triggerDirectionalDamageFeedback(hz.laneX, -6, hazardPlayerDmg, 'ORGAN HAZARD', true);
              if (playerHpRef.current <= 0) {
                onPhaseDefeat(scoreRef.current, killsRef.current);
              }
            }
          }

          if (hz.activeTimer <= 0) {
            hz.group.visible = false;
            const poolSlot = hazardPool.find((hp) => hp.group === hz.group);
            if (poolSlot) poolSlot.inUse = false;
            activeOrganHazardsRef.current[i] = activeOrganHazardsRef.current[activeOrganHazardsRef.current.length - 1];
            activeOrganHazardsRef.current.pop();
          }
        }
      }

      // Check if player is currently in cover behind an INTACT sandbag bunker (Solo) or Destructible Anatomical Cover Structure (Multiplayer)
      const activeCoverBarricade = barricadesRef.current.find((bar) =>
        isMultiplayerDeathmatch
          ? bar.hp > 0 &&
            Math.abs(playerPosRef.current.x - bar.x) <= 1.85 &&
            playerPosRef.current.z >= bar.z - 0.55 &&
            playerPosRef.current.z <= bar.z + 2.85
          : bar.hp > 0 && playerPosRef.current.z >= -1.8 && Math.abs(playerPosRef.current.x - bar.x) <= 1.25
      );
      const inCover = Boolean(activeCoverBarricade);
      if (inCover !== lastCoverState) {
        lastCoverState = inCover;
        setIsPlayerInCover(inCover);
      }
      if (activeCoverBarricade) {
        const nextCoverHp = Math.round((activeCoverBarricade.hp / activeCoverBarricade.maxHp) * 100);
        if (nextCoverHp !== lastCoverHp) {
          lastCoverHp = nextCoverHp;
          setActiveCoverHp(nextCoverHp);
        }
      }

      // Passive Leukocyte Cellular Regeneration when in cover or out of damage for 2.2s (stepped & throttled for zero React re-render stutter!)
      if (playerHpRef.current > 0 && playerHpRef.current < 100 && (inCover || elapsed - lastDamageTakenTime > 2.2)) {
        regenAccumulator += delta * (inCover ? 4.8 : 3.0);
        if (regenAccumulator >= 4.0 || playerHpRef.current + regenAccumulator >= 100) {
          const healPts = Math.floor(regenAccumulator);
          regenAccumulator -= healPts;
          playerHpRef.current = Math.min(100, playerHpRef.current + healPts);
          syncPlayerHpToReact(nowTime);
        }
      }

      const bullets = activeEnemyBulletsRef.current;
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        const prevZ = b.mesh.position.z;
        b.mesh.position.x += b.vx * delta;
        b.mesh.position.y += b.vy * delta;
        b.mesh.position.z += b.vz * delta;
        b.life -= delta;

        if (prevZ < -6.2 && b.mesh.position.z >= -6.2) {
          sounds.playBulletRaceWhiz(b.isTank);
        }

        // Emit Supersonic Bullet Race Slipstream Spark (via zero-GC debris pool)
        if (Math.random() < 0.28) {
          spawnPooledParticle(
            sharedSparkGeo,
            b.isTank ? sharedTankSparkMat : sharedBulletSparkMat,
            b.mesh.position,
            (Math.random() - 0.5) * 0.4,
            (Math.random() - 0.5) * 0.4,
            -b.vz * 0.12,
            0.14,
            0.14
          );
        }

        let hit = false;

        // Collision test against intact sandbag barricades (O(1) Spatial query)
        const localBars = barricadeSpatialGrid.query(b.mesh.position.x, b.mesh.position.z, 2.0);
        for (const bar of localBars) {
          if (bar.hp <= 0) continue;
          const minX = bar.x + bar.bounds.minX;
          const maxX = bar.x + bar.bounds.maxX;
          const minY = bar.y + bar.bounds.minY;
          const maxY = bar.y + bar.bounds.maxY;
          const minZ = bar.z + bar.bounds.minZ - 0.25;
          const maxZ = bar.z + bar.bounds.maxZ + 0.25;

          const bx = b.mesh.position.x;
          const by = b.mesh.position.y;
          const bz = b.mesh.position.z;

          if (bx >= minX && bx <= maxX && by >= minY && by <= maxY && bz >= minZ && bz <= maxZ) {
            if (b.isTank) {
              triggerExplosion(b.mesh.position);
            }
            damageBarricade(bar, b.damage, b.mesh.position, b.isTank);
            b.mesh.visible = false;
            bullets[i] = bullets[bullets.length - 1];
            bullets.pop();
            hit = true;
            break;
          }
        }

        if (hit) continue;

        // Collision test against Player or Bunker Cover
        const pz = playerPosRef.current.z;
        if (b.mesh.position.z >= pz - 0.65 && b.mesh.position.z <= pz + 0.75) {
          const distToPlayer = Math.hypot(
            b.mesh.position.x - playerPosRef.current.x,
            b.mesh.position.y - (camera.position.y - 0.1)
          );

          if (distToPlayer < 0.78) {
            if (activeCoverBarricade && activeCoverBarricade.hp > 0) {
              if (b.isTank) {
                triggerExplosion(b.mesh.position);
              }
              damageBarricade(activeCoverBarricade, b.damage, b.mesh.position, b.isTank);
              b.mesh.visible = false;
              bullets[i] = bullets[bullets.length - 1];
              bullets.pop();
              continue;
            }

            // Player is exposed in the open: take damage
            sounds.playQuizWrong();
            lastDamageTakenTime = elapsed;
            if (b.isTank) {
              triggerExplosion(b.mesh.position);
            }
            playerHpRef.current = Math.max(0, playerHpRef.current - b.damage);
            syncPlayerHpToReact(nowTime);
            triggerDirectionalDamageFeedback(
              b.mesh.position.x - b.vx * 0.15,
              b.mesh.position.z - 6,
              b.damage,
              b.isTank ? 'TANK SHELL' : 'BALLISTIC HIT',
              false
            );

            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate([40, 30, 40]);
            }

            b.mesh.visible = false;
            bullets[i] = bullets[bullets.length - 1];
            bullets.pop();

            if (playerHpRef.current <= 0) {
              syncPlayerHpToReact(nowTime, true);
              if (isMultiplayerDeathmatch) {
                const nearestRival = activeSoldiersRef.current[0]?.name || 'Rival Student Operative';
                triggerMpEliminatedStateRef.current?.(nearestRival, 'SCAR-H Bio-Rifle');
              } else {
                onPhaseDefeat(scoreRef.current, killsRef.current);
              }
            }
            continue;
          }
        }

        // Expired or left arena bounds
        const isOutOfBounds = isMultiplayerDeathmatch
          ? Math.abs(b.mesh.position.x) > 36 || b.mesh.position.z < -50 || b.mesh.position.z > 16
          : b.mesh.position.z > playerPosRef.current.z + 4;
        if (isOutOfBounds || b.life <= 0) {
          b.mesh.visible = false;
          bullets[i] = bullets[bullets.length - 1];
          bullets.pop();
        }
      }

      // 4d. ANIMATE AIRDROP C-130 PLANE & ALLIED WBC COMMANDO PARATROOPERS
      if (airdropRef.current) {
        const ad = airdropRef.current;

        // Advance C-130 Hercules Plane
        if (ad.plane) {
          ad.plane.group.position.z += ad.planeSpeed * delta;
          ad.plane.propellers.forEach((p) => {
            p.rotation.z += delta * 45;
          });

          // Drop pre-allocated paratroopers once plane crosses over battle line (zero mid-frame allocation!)
          if (!ad.alliesDropped && ad.plane.group.position.z >= -20 && prebuiltAlliedRef.current) {
            ad.alliesDropped = true;

            const leftAlly = prebuiltAlliedRef.current.leftAlly;
            leftAlly.group.position.set(-2.85, 4.4, -12.5);
            leftAlly.group.rotation.set(0, Math.PI, 0);
            leftAlly.headGroup.rotation.set(0, 0, 0);
            leftAlly.nucleusGroup.scale.set(1, 1, 1);
            leftAlly.assistBadge.visible = false;
            leftAlly.parachuteGroup.visible = true;
            leftAlly.group.visible = true;

            const rightAlly = prebuiltAlliedRef.current.rightAlly;
            rightAlly.group.position.set(2.85, 4.4, -12.5);
            rightAlly.group.rotation.set(0, Math.PI, 0);
            rightAlly.headGroup.rotation.set(0, 0, 0);
            rightAlly.nucleusGroup.scale.set(1, 1, 1);
            rightAlly.assistBadge.visible = false;
            rightAlly.parachuteGroup.visible = true;
            rightAlly.group.visible = true;

            ad.allies.push({
              group: leftAlly.group,
              parachuteGroup: leftAlly.parachuteGroup,
              headGroup: leftAlly.headGroup,
              nucleusGroup: leftAlly.nucleusGroup,
              assistBadge: leftAlly.assistBadge,
              leftArm: leftAlly.leftArm,
              rightArm: leftAlly.rightArm,
              leftLeg: leftAlly.leftLeg,
              rightLeg: leftAlly.rightLeg,
              leftRifle: leftAlly.leftRifle,
              rightRifle: leftAlly.rightRifle,
              landed: false,
              targetY: -0.45,
              x: -2.85,
              z: -12.5,
              lastFireTime: performance.now(),
              landedElapsed: 0,
              recoilTimer: 0,
              hasCalledAssist: false,
            });

            ad.allies.push({
              group: rightAlly.group,
              parachuteGroup: rightAlly.parachuteGroup,
              headGroup: rightAlly.headGroup,
              nucleusGroup: rightAlly.nucleusGroup,
              assistBadge: rightAlly.assistBadge,
              leftArm: rightAlly.leftArm,
              rightArm: rightAlly.rightArm,
              leftLeg: rightAlly.leftLeg,
              rightLeg: rightAlly.rightLeg,
              leftRifle: rightAlly.leftRifle,
              rightRifle: rightAlly.rightRifle,
              landed: false,
              targetY: -0.45,
              x: 2.85,
              z: -12.5,
              lastFireTime: performance.now() + 280,
              landedElapsed: 0,
              recoilTimer: 0,
              hasCalledAssist: false,
            });
          }

          // Hide plane once it clears the front sector
          if (ad.plane.group.position.z > 25) {
            ad.plane.group.visible = false;
            ad.plane = null;
          }
        }

        // Animate Allied Commandos Falling, Flexing Like Tactical Commandos, Turning Head Behind & Shooting Naturally
        const currentNow = performance.now();
        for (let aIdx = 0; aIdx < ad.allies.length; aIdx++) {
          const ally = ad.allies[aIdx];
          if (!ally.landed) {
            ally.group.position.y -= delta * 3.8;
            ally.group.rotation.z = Math.sin(elapsed * 4 + aIdx) * 0.12;
            // Air-treading legs and riser-gripping arms during parachute descent
            const airKick = Math.sin(elapsed * 12 + aIdx);
            ally.leftLeg.rotation.x = airKick * 0.45;
            ally.rightLeg.rotation.x = -airKick * 0.45;
            ally.leftArm.rotation.x = -1.15;
            ally.rightArm.rotation.x = -1.15;
            ally.leftArm.rotation.z = 0.25;
            ally.rightArm.rotation.z = -0.25;

            if (ally.group.position.y <= ally.targetY) {
              ally.group.position.y = ally.targetY;
              ally.landed = true;
              ally.group.rotation.z = 0;
              ally.parachuteGroup.visible = false;
              sounds.playRadioChirp();
            }
          } else {
            ally.landedElapsed = (ally.landedElapsed || 0) + delta;
            ally.recoilTimer = Math.max(0, (ally.recoilTimer || 0) - delta * 6.0);
            ally.dodgeTimer = (ally.dodgeTimer || 0) + delta;

            // Find nearest active enemy target so the commando aims naturally toward the threat
            const soldiers = activeSoldiersRef.current;
            let targetSoldier: ActiveSoldier | null = null;
            let minD = 999;
            for (const s of soldiers) {
              const d = ally.group.position.distanceTo(s.mesh.position);
              if (d < minD && s.mesh.position.z < -3) {
                minD = d;
                targetSoldier = s;
              }
            }

            // Smoothly orient commando body toward target soldier (or forward downrange at Math.PI)
            const targetBodyYaw = targetSoldier
              ? Math.atan2(
                  targetSoldier.mesh.position.x - ally.group.position.x,
                  targetSoldier.mesh.position.z - ally.group.position.z
                )
              : Math.PI;
            ally.group.rotation.y = THREE.MathUtils.damp(ally.group.rotation.y, targetBodyYaw, 8, delta);

            // Tactical Commando Flexing Pose upon landing (first 1.25s) and right before departing (last 1.45s)
            const isFlexingPose = ally.landedElapsed < 1.25 || ad.activeTimer < 1.45;

            if (ally.dodgeTimer > 3.2 && !ally.isDodging && !isFlexingPose) {
              ally.isDodging = true;
              ally.dodgeTimer = 0;
              ally.dodgeDirection = aIdx === 0 ? 1 : -1;
              ally.rollProgress = 0;
            }

            if (ally.isDodging) {
              ally.rollProgress = (ally.rollProgress || 0) + delta * 3.5;
              ally.group.rotation.z = (ally.dodgeDirection || 1) * ally.rollProgress * Math.PI * 2;
              ally.group.position.x += (ally.dodgeDirection || 1) * delta * 3.2;
              ally.group.position.x = Math.max(-3.8, Math.min(3.8, ally.group.position.x));

              if (ally.rollProgress >= 1.0) {
                ally.isDodging = false;
                ally.group.rotation.z = 0;
              }
            } else if (isFlexingPose) {
              // TACTICAL COMMANDO DOUBLE-BICEP MUSCLE FLEX!
              const flexPump = Math.sin(elapsed * 15 + aIdx);
              ally.group.rotation.z = Math.sin(elapsed * 8 + aIdx) * 0.06;
              ally.group.position.y = ally.targetY - 0.06 + Math.abs(flexPump) * 0.05;
              ally.leftLeg.rotation.x = -0.38 + flexPump * 0.16;
              ally.rightLeg.rotation.x = 0.38 - flexPump * 0.16;
              ally.leftArm.rotation.x = THREE.MathUtils.damp(ally.leftArm.rotation.x, -0.35, 12, delta);
              ally.rightArm.rotation.x = THREE.MathUtils.damp(ally.rightArm.rotation.x, -0.35, 12, delta);
              ally.leftArm.rotation.z = THREE.MathUtils.damp(
                ally.leftArm.rotation.z,
                -1.22 - flexPump * 0.25,
                12,
                delta
              );
              ally.rightArm.rotation.z = THREE.MathUtils.damp(
                ally.rightArm.rotation.z,
                1.22 + flexPump * 0.25,
                12,
                delta
              );
            } else {
              // Dynamic Tactical Striding Legs & Natural Shouldered Rifle Shooting Stance
              const strideCycle = Math.sin(elapsed * 11 + aIdx * 2.1);
              const recoilKick = ally.recoilTimer || 0;
              ally.group.rotation.z = Math.sin(elapsed * 6 + aIdx) * 0.04;
              ally.group.position.y = ally.targetY + Math.abs(strideCycle) * 0.04;
              ally.leftLeg.rotation.x = strideCycle * 0.52;
              ally.rightLeg.rotation.x = -strideCycle * 0.52;
              ally.leftArm.rotation.x = THREE.MathUtils.damp(
                ally.leftArm.rotation.x,
                -0.52 + recoilKick * 0.38 + strideCycle * 0.08,
                14,
                delta
              );
              ally.rightArm.rotation.x = THREE.MathUtils.damp(
                ally.rightArm.rotation.x,
                -0.52 + recoilKick * 0.38 - strideCycle * 0.08,
                14,
                delta
              );
              ally.leftArm.rotation.z = THREE.MathUtils.damp(ally.leftArm.rotation.z, 0.12, 10, delta);
              ally.rightArm.rotation.z = THREE.MathUtils.damp(ally.rightArm.rotation.z, -0.12, 10, delta);
              ally.leftRifle.position.z = 0.42 - recoilKick * 0.18;
              ally.rightRifle.position.z = 0.42 - recoilKick * 0.18;
            }

            // Left WBC Commando turns his head behind toward the player and says "ASSIST US, [NAME]!" revealing his multilobed purple nucleus!
            const shouldTurnHeadBehind =
              aIdx === 0 && ((ally.landedElapsed >= 0.75 && ally.landedElapsed <= 6.8) || ad.activeTimer < 1.8);
            if (shouldTurnHeadBehind) {
              // Rotate headGroup so it faces directly back toward the player camera (world +Z)
              const desiredHeadLocalYaw = Math.PI;
              ally.headGroup.rotation.y = THREE.MathUtils.damp(
                ally.headGroup.rotation.y,
                desiredHeadLocalYaw,
                8,
                delta
              );
              if (Math.abs(ally.headGroup.rotation.y) > 1.75) {
                ally.assistBadge.visible = true;
                const nucPulse = 1.24 + Math.sin(elapsed * 12) * 0.12;
                ally.nucleusGroup.scale.set(nucPulse, nucPulse, nucPulse);
                if (!ally.hasCalledAssist) {
                  ally.hasCalledAssist = true;
                  sounds.playRadioChirp();
                  const pName = (cachedStudentProfileRef.current?.name || 'COMMANDER').trim().toUpperCase();
                  const assistMsg = `💜 WBC COMMANDO: "ASSIST US, ${pName}!" (MULTILOBED PURPLE NUCLEUS REVEALED!)`;
                  setCellDistressBanner(assistMsg);
                  setTimeout(() => {
                    setCellDistressBanner((prev) => (prev === assistMsg ? null : prev));
                  }, 4200);
                }
              }
            } else {
              ally.headGroup.rotation.y = THREE.MathUtils.damp(ally.headGroup.rotation.y, 0, 8, delta);
              ally.assistBadge.visible = false;
              ally.nucleusGroup.scale.set(1, 1, 1);
            }

            // Natural Commando Suppressive Rifle Fire before leaving
            if (currentNow - ally.lastFireTime > 650 && ad.activeTimer > 0.35 && targetSoldier) {
              ally.lastFireTime = currentNow;
              ally.recoilTimer = 1.0;

              sounds.playAlliedShoot();
              targetSoldier.hp -= 28;
              targetSoldier.hitsLeft -= 1;
              targetSoldier.mesh.position.z -= 0.4;
              if (targetSoldier.hpBarFill) {
                const pct = Math.max(0.01, targetSoldier.hitsLeft / targetSoldier.maxHits);
                targetSoldier.hpBarFill.scale.x = pct;
                targetSoldier.hpBarFill.position.x = -(0.82 * (1 - pct)) / 2;
              }
              if (targetSoldier.isHelicopter || targetSoldier.isRobot || targetSoldier.isJet) {
                setBossInfo((prev) => (prev ? { ...prev, hitsLeft: Math.max(0, targetSoldier!.hitsLeft) } : null));
              }

              // Spawn MuzzleFlash & 3D Pointed Spitzer Bullet from Allied Commando rifle barrel toward target soldier!
              _v1.copy(ally.group.position);
              _v1.y += 0.18;
              _v1.z -= 0.65;
              _v2.copy(targetSoldier.mesh.position);
              _v2.y += 0.25;
              _v3.copy(_v2).sub(_v1).normalize();
              triggerMuzzleFlash(_v1, _v3, 'RIFLE');
              const allyBullet = acquirePlayerTracer(0x38bdf8);
              allyBullet.position.copy(_v1);
              allyBullet.lookAt(_v2);
              activePlayerTracersRef.current.push({
                mesh: allyBullet,
                vx: _v3.x * 48,
                vy: _v3.y * 48,
                vz: _v3.z * 48,
                life: 0.45,
              });

              if (targetSoldier.hitsLeft <= 0 || targetSoldier.hp <= 0) {
                if (targetSoldier.isTank || targetSoldier.isBoss) {
                  triggerHeavyDestructionPop(targetSoldier.mesh.position, targetSoldier.isBoss);
                } else {
                  triggerMembraneDisintegration(targetSoldier.mesh.position, targetSoldier.type);
                }
                releaseSoldierToPool(targetSoldier);
                const sIdx = soldiers.indexOf(targetSoldier);
                if (sIdx !== -1) soldiers.splice(sIdx, 1);
                sounds.playKillConfirm();
                killsRef.current += 1;
                scoreRef.current += targetSoldier.value;
                setKills(killsRef.current);
                setScore(scoreRef.current);
                if (targetSoldier.isHelicopter || targetSoldier.isRobot || targetSoldier.isJet) {
                  setBossInfo(null);
                }
              }
            }
          }
        }

        ad.activeTimer -= delta;
        if (ad.activeTimer <= 0) {
          ad.allies.forEach((ally) => {
            ally.assistBadge.visible = false;
            triggerSandDust(ally.group.position);
            ally.group.visible = false;
          });
          if (ad.plane) {
            ad.plane.group.visible = false;
          }
          airdropRef.current = null;
          isAirdropActiveRef.current = false;
          setIsAirdropActive(false);
        }
      }

      // 5. UPDATE EJECTED BRASS SHELL CASINGS & 3D PLAYER/ALLIED SPITZER BULLET TRACERS (Pooled: hide on expiry!)
      const pTracers = activePlayerTracersRef.current;
      for (let i = pTracers.length - 1; i >= 0; i--) {
        const pt = pTracers[i];
        pt.mesh.position.x += pt.vx * delta;
        pt.mesh.position.y += pt.vy * delta;
        pt.mesh.position.z += pt.vz * delta;
        pt.life -= delta;
        if (pt.life <= 0 || pt.mesh.position.z < -68) {
          pt.mesh.visible = false;
          pTracers[i] = pTracers[pTracers.length - 1];
          pTracers.pop();
        }
      }

      const shells = activeShellsRef.current;
      for (let i = shells.length - 1; i >= 0; i--) {
        const sh = shells[i];
        sh.mesh.position.x += sh.vx * delta;
        sh.mesh.position.y += sh.vy * delta;
        sh.mesh.position.z += sh.vz * delta;
        sh.vy -= 14.0 * delta;
        sh.mesh.rotation.x += sh.rotVx * delta;
        sh.mesh.rotation.y += sh.rotVy * delta;
        sh.mesh.rotation.z += sh.rotVz * delta;
        sh.life -= delta;

        if (sh.mesh.position.y <= -2.4) {
          sh.mesh.position.y = -2.4;
          sh.vy = -sh.vy * 0.35;
          sh.vx *= 0.65;
        }

        if (sh.life <= 0) {
          sh.mesh.visible = false;
          shells[i] = shells[shells.length - 1];
          shells.pop();
        }
      }

      // 6. BLACK OPS AN/PEQ-15 TACTICAL LASER SIGHT TRACKING & TARGET LOCK DETECTION (1:1 Raycast & 3D Barrel Aligned!)
      if (laserLineRef.current && laserDotRef.current) {
        if (!isScopedRef.current && weaponMeshRef.current) {
          weaponMeshRef.current.updateMatrixWorld();
          _v1.set(0.092, 0.04, -0.52);
          weaponMeshRef.current.localToWorld(_v1);
        } else {
          _v1.set(
            playerPosRef.current.x,
            -0.52,
            playerPosRef.current.z - 0.85
          );
        }

        // Compute exact 3D point along the true crosshair/scope ray so the laser dot sits 100% under the reticle!
        hitVector.set(aimPosRef.current.x, aimPosRef.current.y);
        raycaster.setFromCamera(hitVector, camera);
        _v2.copy(raycaster.ray.direction).multiplyScalar(36).add(camera.position);

        let lockedOnEnemy = false;

        for (let i = 0; i < activeSoldiersRef.current.length; i++) {
          const s = activeSoldiersRef.current[i];
          if (!isMultiplayerDeathmatch && s.mesh.position.z >= playerPosRef.current.z - 1.2) continue;
          _v3.copy(s.mesh.position);
          _v3.y += s.isRobot ? 1.85 : s.isTank ? 0.45 : 0.25;
          _v4.copy(_v3).project(camera);
          if (_v4.z >= 1 || _v4.z <= -1) continue;
          const d = Math.hypot(_v4.x - hitVector.x, _v4.y - hitVector.y);
          const lockRadius = autoAimEnabledRef.current ? 0.24 : 0.145;
          if (d < lockRadius) {
            lockedOnEnemy = true;
            const enemyDist = Math.max(3, camera.position.distanceTo(s.mesh.position));
            _v2.copy(raycaster.ray.direction).multiplyScalar(enemyDist).add(camera.position);
            break;
          }
        }

        laserLineRef.current.visible = !isScopedRef.current;
        const laserPosAttr = laserLineRef.current.geometry.attributes.position as THREE.BufferAttribute;
        laserPosAttr.setXYZ(0, _v1.x, _v1.y, _v1.z);
        laserPosAttr.setXYZ(1, _v2.x, _v2.y, _v2.z);
        laserPosAttr.needsUpdate = true;

        if (laserGlowLineRef.current) {
          laserGlowLineRef.current.visible = !isScopedRef.current;
          const glowPosAttr = laserGlowLineRef.current.geometry.attributes.position as THREE.BufferAttribute;
          glowPosAttr.setXYZ(0, _v1.x, _v1.y + 0.008, _v1.z);
          glowPosAttr.setXYZ(1, _v2.x, _v2.y, _v2.z);
          glowPosAttr.needsUpdate = true;
        }
        laserDotRef.current.position.copy(_v2);
        const dotMat = laserDotRef.current.material as THREE.MeshBasicMaterial;
        dotMat.color.setHex(lockedOnEnemy ? 0xef4444 : 0x86efac);

        if (laserRingRef.current) {
          laserRingRef.current.position.copy(_v2);
          laserRingRef.current.rotation.z = elapsed * 4.5;
          const rMat = laserRingRef.current.material as THREE.MeshBasicMaterial;
          rMat.color.setHex(lockedOnEnemy ? 0xef4444 : 0x22c55e);
        }

        if (lockedOnEnemy !== lastTargetLockedState) {
          lastTargetLockedState = lockedOnEnemy;
          setIsTargetLocked(lockedOnEnemy);
        }
      }

      // 7. TARGET LOCK RANGEFINDER & MINIMAP RADAR (Throttled to 750ms for zero React VDOM re-render lag!)
      if (nowTime - lastHudSyncTime >= 750) {
        lastHudSyncTime = nowTime;
        const locks: TargetHudLock[] = [];
        
        let s1: ActiveSoldier | null = null;
        let s2: ActiveSoldier | null = null;
        for (let idx = 0; idx < activeSoldiersRef.current.length; idx++) {
          const s = activeSoldiersRef.current[idx];
          if (isMultiplayerDeathmatch || s.mesh.position.z < playerPosRef.current.z - 1.2) {
            if (!s1 || s.mesh.position.z > s1.mesh.position.z) {
              s2 = s1;
              s1 = s;
            } else if (!s2 || s.mesh.position.z > s2.mesh.position.z) {
              s2 = s;
            }
          }
        }
        const sorted = s1 ? (s2 ? [s1, s2] : [s1]) : [];

        sorted.forEach((s) => {
          _v1.copy(s.mesh.position);
          _v1.y += s.isRobot ? 3.55 : s.isHelicopter || s.isJet ? 1.65 : s.isTank ? 1.55 : 1.35;
          _v1.project(camera);
          if (_v1.z < 1 && _v1.x >= -0.95 && _v1.x <= 0.95 && _v1.y >= -0.95 && _v1.y <= 0.95) {
            const dist = Math.hypot(
              s.mesh.position.x - playerPosRef.current.x,
              s.mesh.position.z - playerPosRef.current.z
            );
            locks.push({
              id: s.id,
              name: s.name,
              dist: Math.round(dist * 10) / 10,
              x: Math.round((_v1.x + 1) * 50),
              y: Math.round((-_v1.y + 1) * 50),
              isTank: Boolean(s.isTank || s.isBoss),
              hpPercent: Math.round((s.hitsLeft / s.maxHits) * 100),
            });
          }
        });

        const locksKey = locks.map((l) => `${l.id}_${l.x}_${l.y}_${l.hpPercent}`).join('|');
        if (locksKey !== prevLocksKey) {
          prevLocksKey = locksKey;
          setTargetLocks(locks);
        }

        // Sync live radar blips for Minimap
        const blips: Array<{ x: number; y: number; isTank: boolean; isAllied: boolean; callsign?: string }> = [];
        const lateralRadarScale = isMultiplayerDeathmatch ? 15.0 : 9.0;
        const depthRadarScale = isMultiplayerDeathmatch ? 32.0 : 42.0;
        for (let idx = 0; idx < activeSoldiersRef.current.length; idx++) {
          const s = activeSoldiersRef.current[idx];
          const rx = Math.max(8, Math.min(92, 50 + ((s.mesh.position.x - playerPosRef.current.x) / lateralRadarScale) * 42));
          const ry = Math.max(8, Math.min(92, 85 + ((s.mesh.position.z - (isMultiplayerDeathmatch ? 6 : 0)) / depthRadarScale) * 75));
          blips.push({
            x: Math.round(rx),
            y: Math.round(ry),
            isTank: Boolean(s.isTank || s.isBoss),
            isAllied: false,
            callsign: isMultiplayerDeathmatch && s.name ? s.name.slice(0, 3).toUpperCase() : undefined,
          });
        }
        if (airdropRef.current) {
          for (let idx = 0; idx < airdropRef.current.allies.length; idx++) {
            const ally = airdropRef.current.allies[idx];
            const ax = Math.max(10, Math.min(90, 50 + ((ally.group.position.x - playerPosRef.current.x) / 9) * 42));
            const ay = Math.max(10, Math.min(90, 85 + (ally.group.position.z / 42) * 75));
            blips.push({ x: Math.round(ax), y: Math.round(ay), isTank: false, isAllied: true });
          }
        }

        const blipsKey = blips.map((b) => `${b.x}_${b.y}_${b.isTank}_${b.isAllied}_${b.callsign || ''}`).join('|');
        if (blipsKey !== prevBlipsKey) {
          prevBlipsKey = blipsKey;
          setRadarBlips(blips);
        }

        // Sync live relative enemy directions for Tactical Compass Bar
        const cBlips: Array<{ id: number; offsetPercent: number; isTank: boolean }> = [];
        for (let idx = 0; idx < activeSoldiersRef.current.length; idx++) {
          const s = activeSoldiersRef.current[idx];
          if (s.mesh.position.z >= playerPosRef.current.z - 0.5) continue;
          const distZ = Math.max(1, Math.abs(s.mesh.position.z - playerPosRef.current.z));
          const relX = (s.mesh.position.x - playerPosRef.current.x) / distZ;
          const offsetPercent = Math.max(-42, Math.min(42, (relX - aimPosRef.current.x * 0.5) * 36));
          cBlips.push({
            id: s.id,
            offsetPercent: Math.round(offsetPercent),
            isTank: Boolean(s.isTank || s.isBoss),
          });
        }
        const slicedCompass = cBlips.slice(0, 8);
        const compassKey = slicedCompass.map((c) => `${c.id}_${c.offsetPercent}_${c.isTank}`).join('|');
        if (compassKey !== prevCompassKey) {
          prevCompassKey = compassKey;
          setCompassBlips(slicedCompass);
        }
      }

      // 8. WEAPON RECOIL, SIGHT SCOPE (ADS) TRANSITION, 3D TACTICAL RELOAD ANIMATION & FIRST-PERSON SWAY
      if (weaponMeshRef.current) {
        recoilRef.current.z = THREE.MathUtils.damp(recoilRef.current.z, 0, 16, delta);
        recoilRef.current.rotX = THREE.MathUtils.damp(recoilRef.current.rotX, 0, 16, delta);

        let reloadOffsetY = 0;
        let reloadOffsetZ = 0;
        let reloadRotX = 0;
        let reloadRotZ = 0;

        if (isReloadingRef.current) {
          const elapsedReload = nowTime - reloadStartTimeRef.current;
          const pct = Math.max(0, Math.min(100, (elapsedReload / Math.max(200, reloadDurationRef.current)) * 100));
          const prevStepped = Math.floor(reloadProgressRef.current / 20) * 20;
          const nextStepped = Math.floor(pct / 20) * 20;
          reloadProgressRef.current = pct;
          if (nextStepped !== prevStepped) {
            setReloadProgress(nextStepped);
            setReloadStageLabel(
              pct < 44
                ? '1/3 EJECTING MAG'
                : pct <= 78
                ? '2/3 INSERTING MAG [PRESS R = FAST LOCK!]'
                : '3/3 RACKING BOLT'
            );
          }

          if (pct < 44) {
            // Stage 1: Tilt weapon left & dip down to eject spent magazine
            reloadOffsetY = -0.15;
            reloadRotX = -0.32;
            reloadRotZ = -0.58;
          } else if (pct < 78) {
            // Stage 2: Slap fresh magazine into magwell with upward kinetic jolt
            const slapBounce = Math.sin(((pct - 44) / 34) * Math.PI) * 0.12;
            reloadOffsetY = -0.11 + slapBounce;
            reloadRotX = -0.18 + slapBounce * 1.4;
            reloadRotZ = -0.42;
          } else {
            // Stage 3: Tilt right & rack steel charging handle back/forward
            const rackPull = Math.sin(((pct - 78) / 22) * Math.PI);
            reloadOffsetY = -0.05;
            reloadOffsetZ = rackPull * 0.16;
            reloadRotX = 0.14 * rackPull;
            reloadRotZ = 0.28;
          }
        }

        let swapOffsetY = 0;
        let swapRotX = 0;

        if (weaponSwapAnimRef.current.isSwapping) {
          const anim = weaponSwapAnimRef.current;
          const speed = delta * 18.0;
          anim.progress += speed;
          const t = Math.min(1, anim.progress);
          const easeUp = 1 - (1 - t) * (1 - t);
          swapOffsetY = -0.16 * (1 - easeUp);
          swapRotX = -0.14 * (1 - easeUp);

          if (t >= 1.0) {
            anim.isSwapping = false;
            anim.targetWpn = null;
          }
        }

        const scopedNow = isScopedRef.current && !isReloadingRef.current && currentWeaponRef.current.category !== 'SHOTGUN';

        // Keep 3D weapon ALWAYS VISIBLE in both Hipfire and ADS Scope!
        weaponMeshRef.current.visible = true;

        const breathBobX = Math.cos(elapsed * 1.8) * (scopedNow ? 0.002 : 0.004);
        const breathBobY = Math.sin(elapsed * 2.6) * (scopedNow ? 0.003 : 0.006);

        const aimX = aimPosRef.current.x;
        const aimY = aimPosRef.current.y;

        // Compute exact 3D convergence point in camera space at distance D = 15 so barrel aims straight at the reticle
        const halfTanFov = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
        const aimDist = 15.0;
        const aimCamX = aimX * aimDist * halfTanFov * camera.aspect;
        const aimCamY = aimY * aimDist * halfTanFov;
        const aimCamZ = -aimDist;

        let targetX = 0;
        let targetY = 0;
        let targetZ = 0;
        let targetRotX = 0;
        let targetRotY = 0;
        let targetRotZ = 0;

        if (scopedNow) {
          // AUTHENTIC 3D BLACK OPS ADS: Weapon is locked right at eye level!
          // 3D Black Ops scope on the top rail (local y = 0.23) aligns at -0.23 + 0.23 = 0.0 (DEAD CENTER of screen!)
          const baseAdY = -0.23;
          targetX = breathBobX * 0.25;
          targetY = baseAdY + breathBobY * 0.25 + reloadOffsetY + swapOffsetY;
          targetZ = -0.54 + recoilRef.current.z * 1.4 + reloadOffsetZ;

          targetRotX = 0.01 - recoilRef.current.rotX * 1.2 + reloadRotX + swapRotX;
          targetRotY = (isReloadingRef.current ? 0.22 : 0);
          targetRotZ = reloadRotZ;
        } else {
          // Hipfire stance: Held down-right with natural operator sway
          const baseWpnX = 0.34;
          const baseWpnY = -0.33 + reloadOffsetY + swapOffsetY;
          const baseWpnZ = -0.82 + reloadOffsetZ;

          targetX = baseWpnX - inputX * 0.06 + aimX * 0.24 + breathBobX;
          targetY = baseWpnY - Math.abs(inputX) * 0.015 + aimY * 0.18 + breathBobY;
          targetZ = baseWpnZ + recoilRef.current.z - (Math.abs(aimX) + Math.abs(aimY)) * 0.04;

          const dx = aimCamX - targetX;
          const dy = aimCamY - targetY;
          const dz = aimCamZ - targetZ;
          const aimYaw = THREE.MathUtils.clamp(Math.atan2(-dx, -dz), -0.68, 0.68);
          const aimPitch = THREE.MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.52, 0.52);

          targetRotX = 0.02 + aimPitch - recoilRef.current.rotX + reloadRotX + swapRotX;
          targetRotY = aimYaw + (isReloadingRef.current ? 0.22 : 0);
          targetRotZ = -aimX * 0.14 + inputX * 0.09 + reloadRotZ;
        }

        const dampSpeed = scopedNow ? 26 : 22;
        weaponMeshRef.current.position.x = THREE.MathUtils.damp(weaponMeshRef.current.position.x, targetX, dampSpeed, delta);
        weaponMeshRef.current.position.y = THREE.MathUtils.damp(weaponMeshRef.current.position.y, targetY, dampSpeed, delta);
        weaponMeshRef.current.position.z = THREE.MathUtils.damp(weaponMeshRef.current.position.z, targetZ, dampSpeed, delta);
        weaponMeshRef.current.rotation.x = THREE.MathUtils.damp(weaponMeshRef.current.rotation.x, targetRotX, dampSpeed, delta);
        weaponMeshRef.current.rotation.y = THREE.MathUtils.damp(weaponMeshRef.current.rotation.y, targetRotY, dampSpeed, delta);
        weaponMeshRef.current.rotation.z = THREE.MathUtils.damp(weaponMeshRef.current.rotation.z, targetRotZ, 18, delta);
      }

      if (muzzleSpriteRef.current && muzzleSpriteRef.current.material) {
        muzzleSpriteRef.current.visible = !isScopedRef.current;
        const mat = muzzleSpriteRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = THREE.MathUtils.damp(mat.opacity, 0, 28, delta);
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    }

    // Frame-0 GPU Buffer & Material Warm-Up for ALL pooled Enemies, Weapons, Bosses, Aircraft & Projectiles (Zero mid-combat shader compilation stalls!)
    {
      const warmupMeshes: Array<{ obj: THREE.Object3D; prevVis: boolean; prevPos: THREE.Vector3 }> = [];
      const registerWarmup = (obj?: THREE.Object3D, moveInFront = true) => {
        if (!obj) return;
        warmupMeshes.push({ obj, prevVis: obj.visible, prevPos: obj.position.clone() });
        obj.visible = true;
        if (moveInFront) obj.position.set(0, 0, -28);
      };
      Object.values(prebuiltWeaponsRef.current).forEach((w) => registerWarmup(w.group, false));
      enemyPool.forEach((slot) => {
        registerWarmup(slot.group);
        registerWarmup(slot.parachuteGroup, false);
        const ud = slot.group.userData as {
          avatarVariants?: Record<string, THREE.Group>;
          weaponVariants?: Record<string, THREE.Group>;
        };
        if (ud?.avatarVariants) {
          Object.values(ud.avatarVariants).forEach((av) => registerWarmup(av, false));
        }
        if (ud?.weaponVariants) {
          Object.values(ud.weaponVariants).forEach((wv) => registerWarmup(wv, false));
        }
      });
      refugeePoolRef.current.forEach((r) => registerWarmup(r.mesh));
      registerWarmup(prebuiltBosses.helicopter?.group);
      registerWarmup(prebuiltBosses.robot?.group);
      registerWarmup(prebuiltBosses.jet?.group);
      registerWarmup(bossRocketPool[0]?.group);
      registerWarmup(mortarBombPool[0]);
      registerWarmup(airdropPlanePool[0]?.group);
      registerWarmup(bleriotPlanePool[0]?.group);
      registerWarmup(prebuiltAlliedRef.current?.plane.group);
      registerWarmup(prebuiltAlliedRef.current?.leftAlly.group);
      registerWarmup(prebuiltAlliedRef.current?.rightAlly.group);
      registerWarmup(grenadePoolRef.current[0]);
      registerWarmup(enemyBulletPool[0]);
      registerWarmup(tankShellPool[0]);
      registerWarmup(debrisMeshPool[0]);
      registerWarmup(playerTracerPool[0]);
      registerWarmup(shellMeshPool[0]);
      registerWarmup(supplyDropStateRef.current.beaconMesh);
      registerWarmup(supplyDropStateRef.current.chopperMesh);
      registerWarmup(supplyDropStateRef.current.cargoNetMesh);
      registerWarmup(supplyDropStateRef.current.crateMesh);
      renderer.compile(scene, camera);
      renderer.render(scene, camera);
      for (const item of warmupMeshes) {
        item.obj.visible = item.prevVis;
        item.obj.position.copy(item.prevPos);
      }
    }

    animate();

    return () => {
      if (holdShootTimerRef.current) {
        clearTimeout(holdShootTimerRef.current);
      }
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      pointerLockControls.removeEventListener('change', handlePlcChange);
      pointerLockControls.dispose();
      cancelAnimationFrame(animationFrameId);
      clearInterval(spawnInterval);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);

      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);

      // Recursively free all non-cached GPU BufferGeometries, Materials & Textures in the scene!
      disposeSceneGraph(scene);
      disposeSceneGraph(camera);
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      onTouchStart={() => sounds.unlockAudio()}
      onPointerDown={() => sounds.unlockAudio()}
      className="fixed inset-0 w-full h-full overflow-hidden bg-black select-none"
    >
      {/* 3D WebGL Canvas with Dynamic Black Ops Optics Filter */}
      <div
        ref={mountRef}
        className={`fixed inset-0 w-full h-full cursor-none z-0 transition-all ${
          visionMode === 'nvg'
            ? 'filter-nvg'
            : visionMode === 'thermal'
            ? 'filter-thermal'
            : ''
        }`}
      />

      {/* Clean Subtle Tactical Vignette (No red alerts or view-obscuring overlays) */}
      <div className="absolute inset-0 hud-vignette pointer-events-none z-10" />

      {/* AUTHENTIC TACTICAL HOLOGRAPHIC SIGHT (ATTACHED TO WEAPON & TRACKS AIM RIGHT/LEFT/UP/DOWN) */}
      <div
        className={`fixed inset-0 pointer-events-none z-30 select-none overflow-hidden transition-opacity duration-150 ${
          isScoped && !isReloading ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
        }`}
      >
          {/* Tactical Peripheral Tunnel Vignette Centered in Viewport */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle 42vh at 50% 50%, transparent 35%, rgba(0,0,0,0.48) 65%, rgba(0,0,0,0.88) 100%)',
            }}
          />

          {/* AUTHENTIC 3D BLACK OPS SCOPE HUD BARS (LOCKED DIRECTLY AROUND SCOPE — 100% VISIBLE ON PHONE) */}
          <div
            ref={scopeReticleDomRef}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-[38vh] h-[38vh] max-w-[62vw] max-h-[62vw] sm:w-[52vh] sm:h-[52vh] sm:max-w-[84vw] sm:max-h-[84vw] flex items-center justify-center pointer-events-none will-change-transform"
            style={{ left: '50%', top: '50%' }}
          >
              {/* CURVED PERIMETER HUD ARCS HUGGING 3D SCOPE RING (LEFT: HEALTH, RIGHT: AMMO) */}
              <svg
                viewBox="0 0 200 200"
                className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
              >
                {/* Left Curved Health Track (135° to 225°) */}
                <path
                  d="M 38 162 A 88 88 0 0 1 38 38"
                  fill="none"
                  stroke="rgba(15, 23, 42, 0.95)"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Left Curved Health Fill Arc */}
                <path
                  d="M 38 162 A 88 88 0 0 1 38 38"
                  fill="none"
                  stroke={playerHp < 35 ? '#f43f5e' : playerHp < 65 ? '#f59e0b' : '#22c55e'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray="145"
                  strokeDashoffset={145 - (145 * Math.max(0, Math.min(100, playerHp))) / 100}
                  style={{
                    filter:
                      playerHp < 35
                        ? 'drop-shadow(0 0 8px rgba(244,63,94,0.95))'
                        : 'drop-shadow(0 0 6px rgba(34,197,94,0.85))',
                    transition: 'stroke-dashoffset 150ms ease-out, stroke 150ms ease-out',
                  }}
                />

                {/* Right Curved Magazine / Energy Track (45° to -45°) */}
                <path
                  d="M 162 162 A 88 88 0 0 0 162 38"
                  fill="none"
                  stroke="rgba(15, 23, 42, 0.95)"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Right Curved Magazine Fill Arc */}
                <path
                  ref={scopeAmmoArcDomRef}
                  d="M 162 162 A 88 88 0 0 0 162 38"
                  fill="none"
                  stroke={isReloading ? '#f59e0b' : currentAmmo === 0 ? '#f43f5e' : '#38bdf8'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray="145"
                  strokeDashoffset={
                    145 -
                    (145 *
                      Math.max(
                        0,
                        Math.min(
                          1,
                          isReloading
                            ? reloadProgress / 100
                            : currentAmmo / Math.max(1, currentWeapon.magSize)
                        )
                      ))
                  }
                  style={{
                    filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.85))',
                    transition: 'stroke-dashoffset 120ms ease-out',
                  }}
                />
              </svg>

              {/* LEFT HUD TELEMETRY: HEALTH & SHIELD (LOCKED TO LEFT ARC OF SCOPE — MOBILE OPTIMIZED) */}
              <div className="absolute top-1/2 -left-1 sm:-left-3 -translate-x-full -translate-y-1/2 flex flex-col items-end gap-1 pointer-events-none font-mono z-30">
                <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-zinc-950/95 border-r-2 border-emerald-400 border-y border-l border-emerald-500/40 rounded-l-lg shadow-[0_0_14px_rgba(0,0,0,0.9)] flex flex-col items-end">
                  <span className="text-[6.5px] sm:text-[8px] tracking-widest text-zinc-400 uppercase leading-none">HP</span>
                  <div className="flex items-center gap-1">
                    <Heart className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 ${playerHp < 35 ? 'text-rose-500 fill-rose-500 animate-pulse' : 'text-emerald-400 fill-emerald-400'}`} />
                    <span className={`text-[11px] sm:text-sm font-black tabular-nums ${playerHp < 35 ? 'text-rose-400 animate-pulse' : 'text-emerald-300'}`}>
                      {playerHp}%
                    </span>
                  </div>
                </div>
                <div className={`px-1.5 py-0.5 bg-zinc-950/95 border-r-2 rounded-l-md text-[7px] sm:text-[9px] font-bold tracking-wider uppercase shadow-md whitespace-nowrap ${
                  isPlayerInCover ? 'border-cyan-400 text-cyan-300' : 'border-amber-500/80 text-amber-300'
                }`}>
                  {isPlayerInCover ? `SHIELD ${activeCoverHp}%` : 'EXPOSED'}
                </div>
              </div>

              {/* RIGHT HUD TELEMETRY: AMMO, STIM, FRAG, AIRDROP (LOCKED TO RIGHT ARC OF SCOPE — MOBILE OPTIMIZED) */}
              <div className={`absolute top-1/2 -right-1 sm:-right-3 translate-x-full -translate-y-1/2 flex flex-col items-start gap-1 font-mono z-30 ${isScoped && !isReloading ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                {/* Live Ammo Badge */}
                <div className="px-1.5 sm:px-2.5 py-0.5 bg-zinc-950/95 border-l-2 border-cyan-400 border-y border-r border-cyan-500/30 rounded-r-lg shadow-md flex items-center gap-1">
                  <span className="text-[7px] sm:text-[8px] text-cyan-400 uppercase tracking-wider">AMMO</span>
                  <span
                    ref={scopeAmmoTextDomRef}
                    className={`text-[10px] sm:text-xs font-black tabular-nums ${currentAmmo === 0 ? 'text-rose-400 animate-pulse' : 'text-white'}`}
                  >
                    {isReloading ? `${reloadProgress}%` : `${currentAmmo}/${reserveAmmo}`}
                  </span>
                </div>

                {/* STIM [E] (Bio-Stim Heal) */}
                <button
                  onClick={() => {
                    sounds.unlockAudio();
                    sounds.triggerHaptic([20, 30, 20], 'medium');
                    handleStimpack();
                  }}
                  disabled={stimCooldown > 0 || playerHp >= 100}
                  className={`px-1.5 sm:px-2.5 py-0.5 rounded-r-lg border-l-2 text-[7.5px] sm:text-[9px] font-black uppercase tracking-wide sm:tracking-wider flex items-center gap-1 shadow-md transition-all ${
                    stimCooldown === 0 && playerHp < 100
                      ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300 cursor-pointer hover:bg-emerald-900'
                      : 'bg-zinc-950/85 border-zinc-700 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400 shrink-0" />
                  <span>STIM {stimCooldown > 0 ? `${stimCooldown}S` : '[E]'}</span>
                </button>

                {/* FRAG [G] (Bio-Cluster Frag Grenade) */}
                <button
                  onClick={() => {
                    sounds.unlockAudio();
                    sounds.triggerHaptic([25, 20], 'medium');
                    handleThrowGrenade();
                  }}
                  disabled={grenadeCooldown > 0}
                  className={`px-1.5 sm:px-2.5 py-0.5 rounded-r-lg border-l-2 text-[7.5px] sm:text-[9px] font-black uppercase tracking-wide sm:tracking-wider flex items-center gap-1 shadow-md transition-all ${
                    grenadeCooldown === 0
                      ? 'bg-amber-950/90 border-amber-400 text-amber-300 cursor-pointer hover:bg-amber-900'
                      : 'bg-zinc-950/85 border-zinc-700 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <Bomb className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 shrink-0" />
                  <span>FRAG {grenadeCooldown > 0 ? `${grenadeCooldown}S` : '[G]'}</span>
                </button>

                {/* AIRDROP [T] (Allied Leukocyte Reinforcements — Hidden in Multiplayer Deathmatch!) */}
                {!isMultiplayerDeathmatch && (
                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.triggerHaptic([35, 25, 45], 'heavy');
                      handleAirdropReinforcements();
                    }}
                    disabled={reinforceCooldown > 0 || isAirdropActive}
                    className={`px-1.5 sm:px-2.5 py-0.5 rounded-r-lg border-l-2 text-[7.5px] sm:text-[9px] font-black uppercase tracking-wide sm:tracking-wider flex items-center gap-1 shadow-md transition-all ${
                      reinforceCooldown === 0 && !isAirdropActive
                        ? 'bg-cyan-950/90 border-cyan-400 text-cyan-300 cursor-pointer hover:bg-cyan-900'
                        : 'bg-zinc-950/85 border-zinc-700 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    <Plane className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-cyan-400 shrink-0" />
                    <span>{isAirdropActive ? 'ACT' : reinforceCooldown > 0 ? `${reinforceCooldown}S` : 'AIR [T]'}</span>
                  </button>
                )}
              </div>
          </div>
      </div>

      {/* Black Ops Micro Target Telemetry Tag */}
      {targetLocks.map((lock) => (
        <div
          key={lock.id}
          className="absolute pointer-events-none z-20 transform -translate-x-1/2 -translate-y-full transition-all duration-75"
          style={{ left: `${lock.x}%`, top: `${lock.y}%` }}
        >
          <div className="px-1.5 py-0.5 bg-zinc-950/80 border-l-2 border-amber-500 text-[8px] font-mono tracking-wider leading-tight flex items-center gap-1.5 text-zinc-100">
            <span className="truncate max-w-[64px] uppercase">{lock.name.split(' ')[0]}</span>
            <span className={lock.hpPercent < 40 ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold'}>{lock.hpPercent}%</span>
          </div>
        </div>
      ))}

      {/* Dedicated Tactical Movement Control Zone Anchor (Bottom-Left) */}
      <div className="fixed bottom-6 left-6 sm:bottom-8 sm:left-8 w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-amber-500/20 bg-slate-950/35 pointer-events-none z-20 flex items-center justify-center opacity-70">
        <div className="w-10 h-10 rounded-full border border-dashed border-amber-400/30 flex items-center justify-center">
          <span className="text-[8px] sm:text-[9px] font-mono font-black text-amber-400/60 tracking-widest uppercase">MOVE</span>
        </div>
      </div>

      {/* Virtual Touch Joystick Visual Indicator (Black Ops Tactical Ring) */}
      {joystickDisplay && (
        <div
          className="fixed pointer-events-none z-30 transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${joystickDisplay.x}px`, top: `${joystickDisplay.y}px` }}
        >
          <div className="w-20 h-20 rounded-full border-2 border-amber-500/60 bg-zinc-950/45 shadow-[0_0_16px_rgba(245,158,11,0.3)] flex items-center justify-center">
            <div
              ref={joystickKnobDomRef}
              className="w-8 h-8 rounded-full bg-amber-500/85 border border-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.9)]"
              style={{
                transform: `translate(${joystickOffsetRef.current.x}px, ${joystickOffsetRef.current.y}px)`,
              }}
            />
          </div>
        </div>
      )}

      {/* FORTNITE-STYLE FLOATING NUMERICAL DAMAGE INDICATORS + HEADSHOT BANNER */}
      {hitmarkers.map((marker) => (
        <div
          key={marker.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30 flex flex-col items-center"
          style={{
            left: `calc(${marker.x}% + ${marker.offsetX || 0}px)`,
            top: `calc(${marker.y}% + ${marker.offsetY || 0}px)`,
          }}
        >
          {marker.isHeadshot && (
            <div className="animate-fortnite-dmg mb-0.5 px-1.5 py-0.5 bg-rose-600/95 border border-yellow-300 rounded text-[10px] sm:text-xs font-black tracking-widest text-yellow-200 uppercase shadow-[0_0_12px_rgba(244,63,94,0.95)] whitespace-nowrap">
              🎯 HEADSHOT!
            </div>
          )}
          {/* Floating Fortnite Damage Number */}
          <div
            className={`animate-fortnite-dmg fortnite-dmg-text select-none whitespace-nowrap text-center leading-none ${
              marker.isCritical
                ? 'text-yellow-300 text-2xl sm:text-3xl drop-shadow-[0_0_10px_rgba(250,204,21,0.85)]'
                : marker.isArmored
                ? 'text-sky-300 text-lg sm:text-2xl drop-shadow-[0_0_8px_rgba(56,189,248,0.75)]'
                : 'text-white text-lg sm:text-2xl'
            }`}
          >
            {marker.damage}
            {marker.isCritical ? '!' : ''}
          </div>
        </div>
      ))}

      {/* =====================================================================
          FORTNITE-STYLE COMBAT HUD OVERLAY (NETLIFY-SAFE HARDWARE COMPOSITED)
          Matches the user's Fortnite HUD reference without building materials,
          using all existing weapons and tactical equipment on both Phone & PC.
         ===================================================================== */}
      <div
        className="hud-layer-fixed fixed inset-0 z-40 pointer-events-none flex flex-col justify-between select-none will-change-transform transform-gpu"
        style={{
          zIndex: 40,
          transform: 'translate3d(0, 0, 0)',
          WebkitTransform: 'translate3d(0, 0, 0)',
          paddingTop: 'max(0.4rem, env(safe-area-inset-top, 0px))',
          paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))',
          paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* ===================================================================
            TOP ROW: TOP-LEFT NAV/UTILITY | TOP-CENTER BOSS/ALERTS | TOP-RIGHT MINIMAP
           =================================================================== */}
        <div className="flex items-start justify-between w-full gap-1.5 sm:gap-2">
          {/* TOP-LEFT: Back, Pause [ESC], Audio, Auto-Aim & Vision Quick Toggles */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 pointer-events-auto">
            <button
              onClick={() => {
                sounds.unlockAudio();
                sounds.triggerHaptic(16, 'medium');
                if (scoreRef.current > 0 || killsRef.current > 0) {
                  const prof = loadStudentProfile();
                  recordScoreToLeaderboard({
                    studentName: prof?.name || 'Operative',
                    className: prof?.className || 'Science Unit',
                    score: scoreRef.current,
                    kills: killsRef.current,
                    levelTitle: isMultiplayerDeathmatch ? `Arena [${activeRoomCode}] PvP` : level.title,
                    stage: isMultiplayerDeathmatch ? 'Multiplayer' : level.stage,
                    isVictory: killsRef.current > 0,
                  }).catch(() => {});
                }
                if (onExitToMenu) {
                  onExitToMenu();
                } else {
                  setIsGamePaused(true);
                }
              }}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-md bg-slate-950/90 hover:bg-rose-950/90 border-2 border-rose-500/80 text-white font-black text-[10px] sm:text-xs tracking-wider uppercase flex items-center gap-1 sm:gap-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.85)] cursor-pointer whitespace-nowrap transition-transform active:scale-95"
              title="Back to Main Menu"
            >
              <Home className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>BACK</span>
            </button>

            <button
              onClick={() => {
                sounds.unlockAudio();
                sounds.triggerHaptic(14, 'medium');
                setIsGamePaused(true);
              }}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-md bg-slate-950/90 hover:bg-slate-900 border-2 border-amber-400/85 text-amber-300 font-black text-[10px] sm:text-xs tracking-wider uppercase flex items-center gap-1 sm:gap-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.85)] cursor-pointer whitespace-nowrap transition-transform active:scale-95"
              title="Pause Operation [ESC]"
            >
              <Pause className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
              <span>PAUSE</span>
            </button>

            <button
              onClick={() => {
                sounds.unlockAudio();
                sounds.triggerHaptic(12, 'light');
                handleSoundToggle();
              }}
              className="h-8 sm:h-9 w-8 sm:w-9 rounded-md bg-slate-950/85 hover:bg-slate-900 border border-white/25 text-white flex items-center justify-center shadow-md cursor-pointer transition-transform active:scale-95"
              title="Toggle Audio [M]"
            >
              {soundEnabled && !audioSuspended ? (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
              )}
            </button>

            {onToggleAutoAim && (
              <button
                onClick={() => {
                  sounds.unlockAudio();
                  sounds.triggerHaptic(12, 'light');
                  onToggleAutoAim();
                }}
                className={`h-8 sm:h-9 px-2 sm:px-2.5 rounded-md font-black text-[9px] sm:text-[11px] tracking-wider uppercase border flex items-center gap-1 shadow-md cursor-pointer transition-transform active:scale-95 ${
                  autoAimEnabled
                    ? 'bg-sky-600/85 border-sky-300 text-white'
                    : 'bg-slate-950/85 border-white/20 text-slate-400'
                }`}
                title="Toggle Soft Target Assist"
              >
                <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span>{autoAimEnabled ? 'ASSIST: ON' : 'ASSIST: OFF'}</span>
              </button>
            )}
          </div>

          {/* TOP-CENTER: SLIM TACTICAL COMPASS BAR, Multiplayer Live Feed, Boss Health Bar, Exfil Button, Killstreak & Threat Alerts */}
          <div className="flex flex-col items-center gap-1 max-w-[46vw] sm:max-w-md">
            {/* SLIM TACTICAL COMPASS BAR (GPU-ACCELERATED WITH CSS will-change) */}
            <div className="w-48 sm:w-64 h-4.5 bg-slate-950/85 border border-cyan-500/40 rounded-sm flex items-center justify-between px-2 text-[8px] font-mono tracking-widest text-slate-300 relative overflow-hidden shadow-md will-change-transform transform-gpu">
              {/* Compass Heading Ticks */}
              <div className="absolute inset-0 flex items-center justify-between px-2.5 text-[7.5px] font-black text-cyan-400/80 pointer-events-none">
                <span>W</span>
                <span>NW</span>
                <span className="text-amber-300 font-black text-[8.5px]">N</span>
                <span>NE</span>
                <span>E</span>
              </div>
              {/* Center Reticle Notch */}
              <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-amber-400 z-10 shadow-[0_0_4px_#f59e0b]" />
              {/* Live Enemy Blips on Compass */}
              {compassBlips.map((cb, cIdx) => (
                <div
                  key={cb.id || cIdx}
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full z-20 ${
                    cb.isTank ? 'bg-amber-400 border border-rose-500 shadow-[0_0_6px_#f59e0b]' : 'bg-rose-500 shadow-[0_0_5px_#f43f5e]'
                  }`}
                  style={{ left: `calc(50% + ${cb.offsetPercent}%)` }}
                />
              ))}
            </div>

            {/* LIVE MULTIPLAYER OPEN-WORLD DEATHMATCH STATUS BAR & KILLFEED */}
            {isMultiplayerDeathmatch && (
              <div className="flex flex-col items-center gap-1 w-full pointer-events-auto">
                <div className="bg-slate-950/90 border border-cyan-400/75 rounded-md px-2.5 py-1 flex flex-wrap items-center justify-center gap-2 text-[8.5px] sm:text-[10px] font-mono font-black uppercase tracking-wider shadow-[0_4px_14px_rgba(6,182,212,0.3)]">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Radio className="w-3 h-3 animate-pulse" />
                    <span>ROOM: {activeRoomCode}</span>
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className="flex items-center gap-1 text-cyan-300">
                    <Users className="w-3 h-3" />
                    <span>
                      {Math.min(
                        MAX_PLAYERS_PER_ROOM,
                        Math.max(
                          1,
                          mpOnlinePlayers.some((p) => p.playerId === localMpPlayerIdRef.current)
                            ? mpOnlinePlayers.length
                            : mpOnlinePlayers.length + 1
                        )
                      )}
                      /{MAX_PLAYERS_PER_ROOM}
                    </span>
                  </span>
                  <span className="text-slate-600">|</span>
                  <span
                    className={`flex items-center gap-1 ${
                      mpMatchTimeLeft <= 30 ? 'text-rose-400 animate-pulse' : 'text-amber-300'
                    }`}
                    title="5-Minute Match Countdown & 10-Kill Goal"
                  >
                    <Trophy className="w-3 h-3 text-amber-400" />
                    <span>
                      {kills}/{MATCH_KILL_LIMIT} KILLS •{' '}
                      <span ref={mpMatchTimerDomRef}>
                        {Math.floor(mpMatchTimeLeft / 60)}:
                        {String(mpMatchTimeLeft % 60).padStart(2, '0')}
                      </span>
                    </span>
                  </span>
                  <span className="text-slate-600">|</span>
                  <span
                    className={`flex items-center gap-1 ${
                      timeLeft <= 12 ? 'text-rose-400 animate-pulse' : 'text-cyan-200'
                    }`}
                  >
                    <Snowflake className="w-3 h-3 text-cyan-300" />
                    <span>STUN IN: </span>
                    <span ref={liveTimerDomRef}>{timeLeft}S</span>
                  </span>
                  <span className="text-slate-600">|</span>
                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      setShowSpectatorBoard((prev) => !prev);
                    }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-400/80 text-emerald-300 text-[8px] sm:text-[9.5px] font-black cursor-pointer transition-colors shadow-sm"
                    title="Open Live Classroom Spectator Board"
                  >
                    <Tv className="w-3 h-3 text-emerald-400" />
                    <span>BROADCAST / SPECTATE</span>
                  </button>
                </div>

                {/* Live Tactical Controls Reminder Banner */}
                <div className="px-2.5 py-0.5 rounded bg-cyan-950/85 border border-cyan-400/50 text-[8px] sm:text-[9px] font-mono font-bold text-cyan-200 text-center shadow-md">
                  🫁 DESTRUCTIBLE BIO-COVER ACTIVE • <span className="text-amber-300 font-black">[CTRL] CROUCH</span> BEHIND ALVEOLAR SEPTA & CARTILAGE • <span className="text-emerald-300 font-black">[SHIFT] SPRINT</span>
                </div>
              </div>
            )}

            {bossInfo && (
              <div className="bg-slate-950/90 border-2 border-rose-500 rounded-md px-2.5 sm:px-3.5 py-1 flex flex-col items-center gap-0.5 shadow-[0_4px_16px_rgba(244,63,94,0.45)] w-full min-w-[140px] sm:min-w-[220px]">
                <div className="flex items-center justify-between w-full gap-2 text-[9px] sm:text-[11px] font-black uppercase tracking-wider">
                  <span className="flex items-center gap-1 text-rose-400 truncate">
                    <Skull className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="truncate">{bossInfo.name}</span>
                  </span>
                  <span className="text-white tabular-nums shrink-0">
                    {bossInfo.hitsLeft}/{bossInfo.maxHits}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-sm overflow-hidden border border-rose-500/40">
                  <div
                    className="h-full bg-gradient-to-r from-rose-600 via-orange-500 to-amber-400 transition-all duration-150"
                    style={{
                      width: `${Math.max(0, Math.min(100, (bossInfo.hitsLeft / Math.max(1, bossInfo.maxHits)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {bossDefeatedBanner && (
              <button
                onClick={() => {
                  sounds.triggerHaptic([25, 30, 40], 'heavy');
                  if (!phaseCompleteCalledRef.current) {
                    phaseCompleteCalledRef.current = true;
                    sounds.playVictory();
                    onPhaseComplete(scoreRef.current + 1000, killsRef.current);
                  }
                }}
                className="pointer-events-auto px-3 py-1 rounded-md bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 font-black text-[10px] sm:text-xs tracking-widest uppercase cursor-pointer whitespace-nowrap shadow-[0_0_18px_rgba(250,204,21,0.75)] border-2 border-white"
              >
                VICTORY ROYALE // EXFIL NEXT PHASE »
              </button>
            )}

            {activeStreak && (
              <div className="bg-gradient-to-r from-amber-500/95 to-yellow-400/95 border-2 border-white rounded-md px-3 py-0.5 text-[10px] sm:text-xs font-black tracking-wider uppercase text-slate-950 shadow-[0_0_16px_rgba(250,204,21,0.65)] whitespace-nowrap">
                ★ {activeStreak.label} // {activeStreak.sublabel}
              </div>
            )}

            {(hazardAlert || bleriotAlert || enemyAirdropAlert) && (
              <div className="bg-amber-950/95 border-2 border-amber-400 rounded-md px-2.5 py-0.5 text-[8px] sm:text-[10px] font-black tracking-wider uppercase text-amber-100 shadow-[0_4px_14px_rgba(245,158,11,0.45)] max-w-full truncate">
                {hazardAlert || bleriotAlert || enemyAirdropAlert}
              </div>
            )}

            {(cellDistressBanner || organRadioComm) && !isPhase3Retreating && (
              <div className="bg-sky-950/95 border-2 border-sky-400 rounded-md px-2.5 py-0.5 text-[8px] sm:text-[10px] font-black tracking-wider uppercase text-sky-100 shadow-[0_4px_14px_rgba(56,189,248,0.45)] max-w-full truncate">
                {cellDistressBanner
                  ? cellDistressBanner
                  : organRadioComm
                  ? `🔵 ${organRadioComm.callsign}: ${organRadioComm.message}`
                  : ''}
              </div>
            )}

            {isPhase3Retreating && (
              <div className="flex flex-col items-center gap-1.5 mt-1 animate-bounce pointer-events-none">
                <div className="bg-rose-950/95 border-2 border-amber-400 rounded-lg px-3.5 py-1.5 text-[10px] sm:text-xs font-black tracking-wider uppercase text-amber-200 shadow-[0_0_24px_rgba(245,158,11,0.75)] text-center">
                  {retreatDialogueStep === 0 &&
                    '😱 BACTERIA & TANKS: "THE IMMUNE DEFENSE HELD! TELL ALL UNITS TO RETREAT!"'}
                  {retreatDialogueStep === 1 &&
                    '🏃‍♂️💨 BIO-TANK COMMANDER: "TURN AROUND! FALL BACK TO THE HORIZON — RUN!"'}
                  {retreatDialogueStep >= 2 &&
                    '🎖️ ENEMY FORCES ROUTED! DISAPPEARING INTO THE HORIZON... MISSION ACCOMPLISHED!'}
                </div>
              </div>
            )}
          </div>

          {/* TOP-RIGHT: FORTNITE SQUARE MINIMAP + 4 TELEMETRY ICON BADGES + TACTICAL KILL FEED BELOW */}
          <div className="flex flex-col items-end gap-1 pointer-events-auto shrink-0">
            {/* Square Fortnite Minimap with Anatomical Terrain & Sector Title */}
            <div
              className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-md border-2 border-slate-900/95 shadow-[0_6px_20px_rgba(0,0,0,0.85)] overflow-hidden relative"
              style={{
                background: `radial-gradient(circle at 50% 45%, #${organTheme.particleColor.toString(16).padStart(6, '0')}44 0%, #0f172a 68%, #020617 100%)`,
              }}
            >
              {/* Subtle Topographic Map Contours & Grid */}
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)',
                  backgroundSize: '25% 25%',
                }}
              />
              <div className="absolute inset-2 rounded-full border border-white/15 pointer-events-none" />
              <div className="absolute inset-5 rounded-full border border-sky-400/20 pointer-events-none" />

              {/* Storm / Safe Zone Line (Fortnite White Line from Player to Center) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
                <line
                  x1={50 + (playerPosRef.current.x / 7.5) * 35}
                  y1="86"
                  x2="50"
                  y2="45"
                  stroke="rgba(255,255,255,0.75)"
                  strokeWidth="1.2"
                />
              </svg>

              {/* Live Enemy & Allied Blips on Minimap */}
              {radarBlips.map((blip, bIdx) => (
                <div
                  key={bIdx}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center"
                  style={{ left: `${blip.x}%`, top: `${blip.y}%` }}
                >
                  <span
                    className={`${
                      blip.isAllied
                        ? 'w-2 h-2 rounded-full bg-sky-400 border border-white shadow-[0_0_6px_#38bdf8]'
                        : blip.isTank
                        ? 'w-2.5 h-2.5 rotate-45 bg-amber-400 border border-rose-600 shadow-[0_0_8px_#f59e0b]'
                        : 'w-2 h-2 rounded-full bg-rose-500 border border-rose-300 shadow-[0_0_6px_#f43f5e]'
                    }`}
                  />
                  {blip.callsign && (
                    <span className="text-[6px] font-mono font-black text-amber-200 bg-slate-950/90 px-0.5 rounded leading-none mt-0.5 scale-90">
                      {blip.callsign}
                    </span>
                  )}
                </div>
              ))}

              {/* Player White Arrow Marker on Minimap */}
              <div
                className="absolute bottom-[10%] -translate-x-1/2 pointer-events-none flex flex-col items-center"
                style={{ left: `${Math.max(15, Math.min(85, 50 + (playerPosRef.current.x / 7.5) * 35))}%` }}
              >
                <div
                  className="w-0 h-0"
                  style={{
                    borderLeft: '4px solid transparent',
                    borderRight: '4px solid transparent',
                    borderBottom: '8px solid #ffffff',
                    filter: 'drop-shadow(0 0 4px rgba(56,189,248,0.95))',
                  }}
                />
              </div>

              {/* Fortnite-Style Bold White Sector Name Across Center of Minimap (like "CASTILLO CORAL") */}
              <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 text-center pointer-events-none">
                <span
                  className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-white block truncate"
                  style={{
                    textShadow:
                      '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.95)',
                  }}
                >
                  {organTheme.name.replace(' SECTOR', '')}
                </span>
              </div>
            </div>

            {/* Fortnite Telemetry Row Directly Below Minimap (Timer, Phase, Kills, Score) */}
            <div className="flex items-center justify-end gap-1 sm:gap-1.5 bg-slate-950/80 border border-white/15 rounded-md px-1.5 py-0.5 shadow-lg">
              {/* 1. Wave Clock */}
              <div className="flex items-center gap-1" title="Wave Time Remaining">
                <span className="w-4 h-4 rounded-full bg-slate-800 border border-white/25 flex items-center justify-center text-[9px]">
                  ⏱
                </span>
                <span
                  ref={soloWaveTimerDomRef}
                  className={`text-[10px] sm:text-xs font-black tabular-nums ${
                    timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-white'
                  }`}
                >
                  0:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                </span>
              </div>

              {/* 2. Phase Number */}
              <div className="flex items-center gap-0.5" title="Sector Phase">
                <span className="w-4 h-4 rounded-full bg-slate-800 border border-white/25 flex items-center justify-center text-[9px] text-sky-300 font-black">
                  P
                </span>
                <span className="text-[10px] sm:text-xs font-black text-white tabular-nums">
                  {phaseNumber}/3
                </span>
              </div>

              {/* 3. Eliminations (Crosshair Icon) */}
              <div className="flex items-center gap-0.5" title="Pathogens Eliminated">
                <span className="w-4 h-4 rounded-full bg-slate-800 border border-white/25 flex items-center justify-center">
                  <Crosshair className="w-2.5 h-2.5 text-rose-400" />
                </span>
                <span className="text-[10px] sm:text-xs font-black text-white tabular-nums">
                  {kills}
                </span>
              </div>

              {/* 4. Score */}
              <div className="hidden xs:flex items-center gap-0.5" title="Combat Score">
                <span className="w-4 h-4 rounded-full bg-slate-800 border border-white/25 flex items-center justify-center text-[9px] text-amber-300 font-black">
                  ★
                </span>
                <span ref={liveScoreDomRef} className="text-[10px] sm:text-xs font-black text-amber-300 tabular-nums">
                  {score}
                </span>
              </div>
            </div>

            {/* TOP-RIGHT STYLIZED SEMI-TRANSPARENT TACTICAL KILL FEED (Multiplayer Matches) */}
            {isMultiplayerDeathmatch && mpKillfeed.length > 0 && (
              <div className="flex flex-col items-end gap-1 mt-1 pointer-events-none max-w-[235px] sm:max-w-[310px] font-mono select-none">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-t bg-slate-950/90 border-t border-x border-cyan-500/35 text-[7.5px] sm:text-[8.5px] font-black tracking-[0.18em] uppercase text-cyan-300/90 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>TACTICAL KILL FEED</span>
                </div>
                {mpKillfeed.slice(0, 4).map((kf, idx) => {
                  const localCallsign = (cachedStudentProfileRef.current?.name || 'Operative').trim().toUpperCase();
                  const isLocalKiller =
                    kf.killerName.trim().toUpperCase() === localCallsign ||
                    kf.killerName.trim().toUpperCase() === 'YOU';
                  const isLocalVictim =
                    kf.victimName.trim().toUpperCase() === localCallsign ||
                    kf.victimName.trim().toUpperCase() === 'YOU';
                  const isSystemKick = kf.killerName.trim().toUpperCase() === 'COMMAND';

                  return (
                    <div
                      key={kf.id}
                      className={`w-full px-2.5 py-1 rounded-l-md border-r-2 border-y border-l transition-all duration-200 shadow-[0_4px_14px_rgba(0,0,0,0.65)] flex flex-col items-end gap-0.5 ${
                        isLocalKiller
                          ? 'bg-emerald-950/85 border-r-emerald-400 border-y-emerald-500/30 border-l-emerald-500/20'
                          : isLocalVictim
                          ? 'bg-rose-950/85 border-r-rose-500 border-y-rose-500/35 border-l-rose-500/20'
                          : 'bg-slate-950/85 border-r-cyan-400 border-y-white/15 border-l-white/10'
                      } ${idx === 0 ? 'opacity-100 scale-100' : idx === 1 ? 'opacity-90' : 'opacity-75'}`}
                      style={{
                        clipPath: 'polygon(6px 0, 100% 0, 100% 100%, 0 100%, 0 6px)',
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-end gap-1 text-[9px] sm:text-[10.5px] leading-tight text-right">
                        <span
                          className={`font-black tracking-wide truncate max-w-[95px] sm:max-w-[125px] ${
                            isLocalKiller ? 'text-emerald-300' : 'text-cyan-300'
                          }`}
                        >
                          [{kf.killerName}]
                        </span>
                        <span className="text-[8.5px] sm:text-[9.5px] font-semibold italic text-slate-300/95 px-0.5">
                          {isSystemKick ? 'disconnected' : 'neutralized'}
                        </span>
                        <span
                          className={`font-black tracking-wide truncate max-w-[95px] sm:max-w-[125px] ${
                            isLocalVictim ? 'text-rose-300' : 'text-amber-300'
                          }`}
                        >
                          [{kf.victimName}]
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-1 text-[7.5px] sm:text-[8.5px] text-slate-400 leading-none">
                        <Crosshair className="w-2.5 h-2.5 text-rose-400/90 shrink-0" />
                        <span className="text-slate-300 font-bold uppercase tracking-wider truncate max-w-[140px]">
                          {kf.weaponName}
                        </span>
                        {kf.isHeadshot && (
                          <span className="px-1 py-0.2 rounded bg-rose-500/30 border border-yellow-300/70 text-yellow-200 font-black uppercase tracking-wider">
                            🎯 HEADSHOT
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ===================================================================
            CENTER: DYNAMIC PRECISION RETICLE (Zero-lag DOM ref updated)
           =================================================================== */}
        <div
          ref={crosshairDomRef}
          className="fixed transform -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center z-30"
          style={{ left: `${aimScreenPos.x}%`, top: `${aimScreenPos.y}%` }}
        >
          <div
            className={`relative w-7 h-7 flex items-center justify-center transition-all duration-100 ${
              isScoped ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
            }`}
          >
            <div className={`absolute top-0 w-0.5 h-2 ${isTargetLocked ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]' : 'bg-white shadow-[0_0_4px_#000]'}`} />
            <div className={`absolute bottom-0 w-0.5 h-2 ${isTargetLocked ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]' : 'bg-white shadow-[0_0_4px_#000]'}`} />
            <div className={`absolute left-0 h-0.5 w-2 ${isTargetLocked ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]' : 'bg-white shadow-[0_0_4px_#000]'}`} />
            <div className={`absolute right-0 h-0.5 w-2 ${isTargetLocked ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]' : 'bg-white shadow-[0_0_4px_#000]'}`} />
            <div className={`w-1.5 h-1.5 rounded-full ${isTargetLocked ? 'bg-rose-500' : 'bg-sky-300'}`} />
          </div>
          {isReloading && (
            <div className="absolute -bottom-6 px-2 py-0.5 rounded bg-slate-950/90 border border-amber-400 text-[9px] font-black text-amber-300 whitespace-nowrap">
              RELOAD {reloadProgress}%
            </div>
          )}
        </div>

        {/* ===================================================================
            BOTTOM SECTION:
            - Bottom-Left: Fortnite Slanted Blue Shield Bar + Green Health Bar
            - Bottom-Right: Fortnite Weapon & Equipment Hotbar (No Building Mats)
            - Bottom-Edge: Full-Width 10-Segment Fortnite Gold XP Bar
           =================================================================== */}
        <div className="flex flex-col w-full gap-1 sm:gap-1.5">
          <div className="flex items-end justify-between w-full gap-2">
            {/* BOTTOM-LEFT: FORTNITE ICONIC DUAL SLANTED SHIELD + HEALTH BARS */}
            <div className="flex flex-col gap-1 pointer-events-auto pl-1 sm:pl-2">
              {/* Posture / Bunker Cover Status Pill (Solo) or Anatomical Cover + Sprint Energy Bar + Crouch/Sprint Controls (Multiplayer) */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded text-[8px] sm:text-[10px] font-black uppercase tracking-wider border shadow-md ${
                    isPlayerInCover
                      ? 'bg-sky-950/90 border-sky-400 text-sky-200'
                      : 'bg-slate-950/85 border-amber-400/60 text-amber-300'
                  }`}
                >
                  {isPlayerInCover
                    ? isMultiplayerDeathmatch
                      ? `🛡️ BIO-COVER SHIELD ${activeCoverHp}%`
                      : `🛡️ BUNKER SHIELD ${activeCoverHp}%`
                    : isMultiplayerDeathmatch
                    ? '⚠️ EXPOSED [HIDE BEHIND BIO-COVER]'
                    : '⚠️ EXPOSED [MOVE A/D TO COVER]'}
                </span>

                {isMultiplayerDeathmatch && (
                  <>
                    <button
                      onClick={() => {
                        sounds.unlockAudio();
                        crouchToggleRef.current = !isCrouchingRef.current;
                        isCrouchingRef.current = crouchToggleRef.current;
                        setIsCrouching(crouchToggleRef.current);
                      }}
                      className={`px-2 py-0.5 rounded text-[8px] sm:text-[10px] font-black uppercase tracking-wider border shadow-md cursor-pointer transition-all ${
                        isCrouching
                          ? 'bg-cyan-500 text-slate-950 border-white shadow-[0_0_10px_rgba(6,182,212,0.8)]'
                          : 'bg-slate-950/90 border-cyan-400/60 text-cyan-300 hover:bg-slate-900'
                      }`}
                      title="Crouch Behind Anatomical Cover [Ctrl / C]"
                    >
                      {isCrouching ? '⬇️ CROUCHING [CTRL]' : 'CROUCH [CTRL]'}
                    </button>

                    <button
                      onClick={() => {
                        sounds.unlockAudio();
                        if (isSprintExhaustedRef.current) {
                          sounds.playDryFire();
                          return;
                        }
                        sprintToggleRef.current = !isSprintingRef.current;
                        isSprintingRef.current = sprintToggleRef.current;
                        setIsSprinting(sprintToggleRef.current);
                      }}
                      disabled={isSprintExhausted}
                      className={`px-2 py-0.5 rounded text-[8px] sm:text-[10px] font-black uppercase tracking-wider border shadow-md transition-all ${
                        isSprintExhausted
                          ? 'bg-rose-950/90 border-rose-500 text-rose-300 animate-pulse cursor-not-allowed'
                          : isSprinting
                          ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_10px_rgba(251,191,36,0.85)] cursor-pointer'
                          : 'bg-slate-950/90 border-amber-400/60 text-amber-300 hover:bg-slate-900 cursor-pointer'
                      }`}
                      title="Sprint [Shift] — Uses ATP Energy Bar"
                    >
                      {isSprintExhausted
                        ? '⚡ REFILLING ENERGY...'
                        : isSprinting
                        ? '⚡ SPRINTING [SHIFT]'
                        : 'SPRINT [SHIFT]'}
                    </button>
                  </>
                )}
              </div>

              {/* MULTIPLAYER ATP SPRINT ENERGY BAR (Drains on Shift Sprint; when 0%, locks until refilled to 100%!) */}
              {isMultiplayerDeathmatch && (
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shrink-0">
                    <Zap
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                        isSprintExhausted
                          ? 'text-rose-500 fill-rose-500 animate-pulse'
                          : 'text-amber-400 fill-amber-400'
                      } drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]`}
                    />
                  </div>
                  <div
                    className="relative w-28 sm:w-48 md:w-56 h-3 sm:h-3.5 bg-slate-950/85 border-2 border-amber-300/85 shadow-[0_4px_12px_rgba(0,0,0,0.85)] overflow-hidden"
                    style={{ transform: 'skewX(-16deg)' }}
                  >
                    <div
                      ref={sprintBarFillDomRef}
                      className="h-full"
                      style={{
                        width: '100%',
                        background: 'linear-gradient(90deg, #d97706 0%, #f59e0b 55%, #fde047 100%)',
                      }}
                    />
                    <div
                      className="absolute inset-0 flex items-center justify-between px-2 text-[7.5px] sm:text-[9px] font-black text-white tabular-nums"
                      style={{
                        transform: 'skewX(16deg)',
                        textShadow: '0 1px 3px rgba(0,0,0,0.95)',
                      }}
                    >
                      <span>ATP SPRINT</span>
                      <span ref={sprintBarTextDomRef}>100 | 100</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TOP BAR: FORTNITE CYAN/BLUE SHIELD BAR (Bunker Cover / Destructible Anatomical Bio-Cover) */}
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shrink-0">
                  <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 fill-sky-400/30 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
                </div>
                <div
                  className="relative w-28 sm:w-48 md:w-56 h-3 sm:h-4 bg-slate-950/85 border-2 border-white/85 shadow-[0_4px_12px_rgba(0,0,0,0.85)] overflow-hidden"
                  style={{ transform: 'skewX(-16deg)' }}
                >
                  <div
                    className="h-full transition-all duration-150"
                    style={{
                      width: `${isPlayerInCover ? Math.max(0, Math.min(100, activeCoverHp)) : 0}%`,
                      background: 'linear-gradient(90deg, #0284c7 0%, #00b4d8 55%, #38bdf8 100%)',
                    }}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-end pr-2 text-[8px] sm:text-[10px] font-black text-white tabular-nums"
                    style={{
                      transform: 'skewX(16deg)',
                      textShadow: '0 1px 3px rgba(0,0,0,0.95)',
                    }}
                  >
                    {isPlayerInCover ? activeCoverHp : 0} | 100
                  </div>
                </div>
              </div>

              {/* BOTTOM BAR: FORTNITE VIBRANT GREEN HEALTH BAR */}
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shrink-0">
                  <Heart
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                      playerHp < 35 ? 'text-rose-500 fill-rose-500 animate-pulse' : 'text-lime-400 fill-lime-400'
                    } drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]`}
                  />
                </div>
                <div
                  className="relative w-32 sm:w-52 md:w-64 h-4 sm:h-5 bg-slate-950/90 border-2 border-white/95 shadow-[0_4px_14px_rgba(0,0,0,0.9)] overflow-hidden"
                  style={{ transform: 'skewX(-16deg)' }}
                >
                  <div
                    className="h-full transition-all duration-150"
                    style={{
                      width: `${Math.max(0, Math.min(100, playerHp))}%`,
                      background:
                        playerHp < 35
                          ? 'linear-gradient(90deg, #dc2626 0%, #ef4444 60%, #f87171 100%)'
                          : 'linear-gradient(90deg, #16a34a 0%, #22c55e 55%, #84cc16 100%)',
                    }}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-between px-2 text-[9px] sm:text-xs font-black text-white tabular-nums"
                    style={{
                      transform: 'skewX(16deg)',
                      textShadow: '0 1px 3px rgba(0,0,0,0.95)',
                    }}
                  >
                    <span>HP</span>
                    <span>{playerHp} | 100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM-RIGHT: FORTNITE HOTBAR (WEAPONS + EQUIPMENT SLOTS, NO BUILDING MATERIALS) */}
            <div className="flex flex-col items-end gap-1 pointer-events-auto">
              {/* Compact Action Utility Strip Above Hotbar (ADS, Reload, NVG, Cycle Weapon) */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    sounds.unlockAudio();
                    sounds.triggerHaptic(14, 'light');
                    handleToggleScope();
                  }}
                  disabled={currentWeapon.category === 'SHOTGUN'}
                  className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-md text-[9px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1 border shadow-md cursor-pointer transition-transform active:scale-95 ${
                    currentWeapon.category === 'SHOTGUN'
                      ? 'bg-slate-900/60 border-white/10 text-slate-500 cursor-not-allowed'
                      : isScoped
                      ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_12px_rgba(250,204,21,0.7)]'
                      : 'bg-slate-950/85 hover:bg-slate-900 border-white/30 text-white'
                  }`}
                  title="Aim Down Sights [F] / Right-Click"
                >
                  <Crosshair className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>{currentWeapon.category === 'SHOTGUN' ? 'NO ADS' : 'SCOPE [F]'}</span>
                </button>

                <button
                  onClick={() => {
                    sounds.unlockAudio();
                    sounds.triggerHaptic(18, 'medium');
                    handleReload();
                  }}
                  disabled={isReloading}
                  className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-md bg-slate-950/85 hover:bg-slate-900 border border-white/30 text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-white flex items-center gap-1 shadow-md cursor-pointer transition-transform active:scale-95"
                  title="Reload Weapon [R]"
                >
                  <RotateCcw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 ${isReloading ? 'animate-spin' : ''}`} />
                  <span>RLD [R]</span>
                </button>

                <button
                  onClick={() => {
                    sounds.unlockAudio();
                    sounds.triggerHaptic([14, 25], 'light');
                    handleToggleVisionMode();
                  }}
                  className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-md text-[9px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1 border shadow-md cursor-pointer transition-transform active:scale-95 ${
                    visionMode !== 'normal'
                      ? 'bg-emerald-500/80 border-white text-slate-950'
                      : 'bg-slate-950/85 hover:bg-slate-900 border-white/30 text-white'
                  }`}
                  title="Toggle Night/Thermal Vision [V]"
                >
                  <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-300" />
                  <span>{visionMode === 'normal' ? 'NVG' : visionMode.toUpperCase()}</span>
                </button>

                <button
                  onClick={() => {
                    sounds.unlockAudio();
                    handleSwapWeapon();
                  }}
                  className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 border border-white text-[9px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md cursor-pointer transition-transform active:scale-95"
                  title="Cycle Weapon [Q]"
                >
                  <Repeat className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span>SWAP [Q]</span>
                </button>
              </div>

              {/* FORTNITE SQUARE SLOTS ROW: 4 WEAPONS + GAP + 3 TACTICAL ITEMS (STIM, FRAG, AIRDROP) */}
              <div className="flex items-end gap-1 sm:gap-1.5">
                {/* 4 Weapon Slots (SCAR-H, Pump Shotgun, Bolt Sniper, Drum LMG) */}
                {INITIAL_WEAPONS.map((wpn, idx) => {
                  const isSelected = wpn.id === currentWeapon.id;
                  const rarityBg =
                    idx === 0
                      ? 'from-sky-500/90 via-blue-700/90 to-slate-950/95 border-sky-300'
                      : idx === 1
                      ? 'from-purple-500/90 via-purple-800/90 to-slate-950/95 border-purple-300'
                      : idx === 2
                      ? 'from-amber-400/90 via-orange-700/90 to-slate-950/95 border-yellow-200'
                      : 'from-cyan-400/90 via-teal-700/90 to-slate-950/95 border-cyan-200';
                  const shortLabel =
                    wpn.category === 'ASSAULT'
                      ? 'SCAR'
                      : wpn.category === 'SHOTGUN'
                      ? 'PUMP'
                      : wpn.category === 'SNIPER'
                      ? 'SNIPER'
                      : 'DRUM';

                  return (
                    <div key={wpn.id} className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => {
                          sounds.unlockAudio();
                          handleSelectWeapon(wpn);
                        }}
                        className={`w-11 h-11 sm:w-14 sm:h-14 rounded-md bg-gradient-to-b ${rarityBg} relative flex flex-col justify-between p-1 cursor-pointer transition-all ${
                          isSelected
                            ? '-translate-y-1.5 border-2 border-white ring-2 ring-white/80 shadow-[0_6px_18px_rgba(56,189,248,0.65)]'
                            : 'border border-white/40 opacity-90 hover:opacity-100'
                        }`}
                        title={`Equip ${wpn.name} [${idx + 1}]`}
                      >
                        {/* Top-left weapon short label */}
                        <span
                          className="text-[7px] sm:text-[8px] font-black uppercase tracking-wider text-white leading-none"
                          style={{ textShadow: '0 1px 2px #000' }}
                        >
                          {shortLabel}
                        </span>

                        {/* Center Blocky ("Lego-Style") 3D Weapon Icon */}
                        <div className="flex items-center justify-center my-auto w-full">
                          <WeaponBlockyIcon
                            weaponId={wpn.id}
                            category={wpn.category}
                            className="w-9 h-4.5 sm:w-11 sm:h-5.5"
                          />
                        </div>

                        {/* Bottom-Right Ammo Readout inside tile (matches Fortnite "21", "88", "107") */}
                        <div className="flex items-center justify-end gap-0.5 w-full leading-none">
                          <span
                            ref={isSelected ? hotbarAmmoTextDomRef : undefined}
                            className={`text-[9px] sm:text-xs font-black tabular-nums ${
                              isSelected && currentAmmo <= 5 ? 'text-rose-300 animate-pulse' : 'text-white'
                            }`}
                            style={{ textShadow: '0 1px 3px #000' }}
                          >
                            {isSelected ? (isReloading ? 'RLD' : currentAmmo) : wpn.magSize}
                          </span>
                        </div>
                      </button>

                      {/* Keybind Badge Underneath Slot */}
                      <span className="px-1.5 py-0.2 rounded bg-slate-950/90 border border-white/25 text-[8px] sm:text-[9px] font-black text-white leading-tight">
                        {idx + 1}
                      </span>
                    </div>
                  );
                })}

                {/* Small Gap before Medkit & Tactical Equipment Slots (just like Fortnite's Medkit slot gap) */}
                <div className="w-1 sm:w-2 shrink-0" />

                {/* Slot 5: BIO-STIM MEDKIT [E] (Matches Fortnite's Green Medkit Tile!) */}
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.triggerHaptic([20, 30, 20], 'medium');
                      handleStimpack();
                    }}
                    disabled={stimCooldown > 0 || playerHp >= 100}
                    className={`w-11 h-11 sm:w-14 sm:h-14 rounded-md bg-gradient-to-b from-lime-500/95 via-emerald-700/95 to-slate-950/95 relative flex flex-col justify-between p-1 cursor-pointer transition-all ${
                      stimCooldown === 0 && playerHp < 100
                        ? 'border-2 border-lime-300 hover:-translate-y-1 shadow-[0_4px_14px_rgba(34,197,94,0.5)]'
                        : 'border border-white/30 opacity-75'
                    }`}
                    title="Bio-Stim Medkit Heal [E]"
                  >
                    <span
                      className="text-[7px] sm:text-[8px] font-black uppercase text-white leading-none"
                      style={{ textShadow: '0 1px 2px #000' }}
                    >
                      STIM
                    </span>
                    <div className="flex items-center justify-center my-auto">
                      <div className="w-5 h-4 sm:w-6 sm:h-5 rounded-sm bg-white flex items-center justify-center shadow-md border border-rose-500">
                        <span className="text-rose-600 font-black text-xs sm:text-sm leading-none">+</span>
                      </div>
                    </div>
                    <span
                      className="text-[9px] sm:text-[11px] font-black text-white text-right w-full leading-none tabular-nums"
                      style={{ textShadow: '0 1px 3px #000' }}
                    >
                      {stimCooldown > 0 ? `${stimCooldown}s` : '1'}
                    </span>
                  </button>
                  <span className="px-1.5 py-0.2 rounded bg-slate-950/90 border border-white/25 text-[8px] sm:text-[9px] font-black text-lime-300 leading-tight">
                    E
                  </span>
                </div>

                {/* Slot 6: PLASMA FRAG GRENADE [G] */}
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.triggerHaptic([25, 20], 'medium');
                      handleThrowGrenade();
                    }}
                    disabled={grenadeCooldown > 0}
                    className={`w-11 h-11 sm:w-14 sm:h-14 rounded-md bg-gradient-to-b from-orange-500/95 via-rose-800/95 to-slate-950/95 relative flex flex-col justify-between p-1 cursor-pointer transition-all ${
                      grenadeCooldown === 0
                        ? 'border-2 border-amber-300 hover:-translate-y-1 shadow-[0_4px_14px_rgba(249,115,22,0.5)]'
                        : 'border border-white/30 opacity-75'
                    }`}
                    title="Cluster Frag Grenade [G]"
                  >
                    <span
                      className="text-[7px] sm:text-[8px] font-black uppercase text-white leading-none"
                      style={{ textShadow: '0 1px 2px #000' }}
                    >
                      FRAG
                    </span>
                    <div className="flex items-center justify-center my-auto">
                      <Bomb className="w-4 h-4 sm:w-5 sm:h-5 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]" />
                    </div>
                    <span
                      className="text-[9px] sm:text-[11px] font-black text-white text-right w-full leading-none tabular-nums"
                      style={{ textShadow: '0 1px 3px #000' }}
                    >
                      {grenadeCooldown > 0 ? `${grenadeCooldown}s` : '1'}
                    </span>
                  </button>
                  <span className="px-1.5 py-0.2 rounded bg-slate-950/90 border border-white/25 text-[8px] sm:text-[9px] font-black text-amber-300 leading-tight">
                    G
                  </span>
                </div>

                {/* Slot 7: WBC AIRDROP REINFORCEMENTS [T] (Disabled & Hidden in Multiplayer Deathmatch!) */}
                {!isMultiplayerDeathmatch && (
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      onClick={() => {
                        sounds.unlockAudio();
                        sounds.triggerHaptic([35, 25, 45], 'heavy');
                        handleAirdropReinforcements();
                      }}
                      disabled={reinforceCooldown > 0 || isAirdropActive}
                      className={`w-11 h-11 sm:w-14 sm:h-14 rounded-md bg-gradient-to-b from-sky-400/95 via-indigo-800/95 to-slate-950/95 relative flex flex-col justify-between p-1 cursor-pointer transition-all ${
                        reinforceCooldown === 0 && !isAirdropActive
                          ? 'border-2 border-cyan-200 hover:-translate-y-1 shadow-[0_4px_14px_rgba(56,189,248,0.5)]'
                          : 'border border-white/30 opacity-75'
                      }`}
                      title="WBC Airdrop Strike [T]"
                    >
                      <span
                        className="text-[7px] sm:text-[8px] font-black uppercase text-white leading-none"
                        style={{ textShadow: '0 1px 2px #000' }}
                      >
                        AIR
                      </span>
                      <div className="flex items-center justify-center my-auto">
                        <Plane className="w-4 h-4 sm:w-5 sm:h-5 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]" />
                      </div>
                      <span
                        className="text-[9px] sm:text-[11px] font-black text-white text-right w-full leading-none tabular-nums"
                        style={{ textShadow: '0 1px 3px #000' }}
                      >
                        {isAirdropActive ? 'ON' : reinforceCooldown > 0 ? `${reinforceCooldown}s` : '1'}
                      </span>
                    </button>
                    <span className="px-1.5 py-0.2 rounded bg-slate-950/90 border border-white/25 text-[8px] sm:text-[9px] font-black text-cyan-300 leading-tight">
                      T
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* BOTTOM-EDGE FULL-WIDTH 10-SEGMENT FORTNITE GOLD/YELLOW XP BAR */}
          <div className="grid grid-cols-10 gap-1 w-full h-1.5 sm:h-2 pt-0.5 pointer-events-none">
            {Array.from({ length: 10 }).map((_, segIdx) => {
              const progressPct = Math.max(10, Math.min(100, Math.round(((60 - timeLeft) / 60) * 100)));
              const segThreshold = (segIdx + 1) * 10;
              const isFilled = progressPct >= segThreshold || segIdx < 8;
              return (
                <div
                  key={segIdx}
                  className={`h-full rounded-xs transition-all duration-300 ${
                    isFilled
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-300 shadow-[0_0_6px_rgba(250,204,21,0.75)]'
                      : 'bg-slate-800/80 border border-white/15'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================================
          TACTICAL BLACK OPS PAUSE DOSSIER (PAUSE & GOING BACK OPTION)
         ===================================================================== */}
      {isGamePaused && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto font-mono select-none">
          <div
            className="w-full max-w-lg bg-zinc-950 border-l-4 border-amber-500 border-t border-r border-b border-amber-500/50 p-6 shadow-[0_0_50px_rgba(0,0,0,0.95)] text-left space-y-4"
            style={{ clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-amber-400 animate-pulse" />
                <span className="text-xs font-black tracking-[0.2em] text-amber-400 uppercase">
                  BIO-OPS TACTICAL COMMAND // PAUSED
                </span>
              </div>
              <span className="text-[10px] text-cyan-400 tracking-widest uppercase">
                {level.title}
              </span>
            </div>

            {/* Mission Stats Briefing */}
            <div className="bg-zinc-900/70 border border-white/10 p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div>
                <span className="text-[9px] text-zinc-400 block uppercase">SECTOR</span>
                <span className="text-sm font-black text-amber-400">{phaseNumber}/3</span>
              </div>
              <div>
                <span className="text-[9px] text-zinc-400 block uppercase">TIME REMAINING</span>
                <span className="text-sm font-black text-white">{timeLeftRef.current}s</span>
              </div>
              <div>
                <span className="text-[9px] text-zinc-400 block uppercase">SCORE</span>
                <span className="text-sm font-black text-emerald-400">{score}</span>
              </div>
              <div>
                <span className="text-[9px] text-zinc-400 block uppercase">ELIMINATIONS</span>
                <span className="text-sm font-black text-cyan-400">{kills}</span>
              </div>
            </div>

            {/* Tactical Weapon Currently Equipped */}
            <div className="flex items-center justify-between px-3 py-2 bg-black/60 border border-amber-500/30 text-xs">
              <span className="text-zinc-400 uppercase">ACTIVE WEAPON:</span>
              <span className="font-black text-amber-400">{currentWeapon.name}</span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col gap-2.5 font-sans">
              {/* 1. Resume */}
              <button
                onClick={() => {
                  sounds.unlockAudio();
                  sounds.triggerHaptic(12, 'light');
                  setIsGamePaused(false);
                }}
                className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
              >
                <Play className="w-4 h-4 fill-zinc-950" />
                <span>RESUME OPERATION [ESC]</span>
              </button>

              {/* 2. Audio & Auto-Aim Toggles */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    sounds.unlockAudio();
                    sounds.triggerHaptic(10, 'light');
                    onToggleSound?.();
                  }}
                  className="h-10 bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-bold text-xs uppercase flex items-center justify-center gap-2 cursor-pointer"
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
                  <span>{soundEnabled ? 'AUDIO: ON' : 'AUDIO: MUTED'}</span>
                </button>
                <button
                  onClick={() => {
                    sounds.unlockAudio();
                    sounds.triggerHaptic(10, 'light');
                    onToggleAutoAim?.();
                  }}
                  className="h-10 bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-bold text-xs uppercase flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Target className={`w-4 h-4 ${autoAimEnabled ? 'text-cyan-400' : 'text-zinc-500'}`} />
                  <span>{autoAimEnabled ? 'AUTO-LOCK: ON' : 'AUTO-LOCK: OFF'}</span>
                </button>
              </div>

              {/* 3. Restart Sector */}
              <button
                onClick={() => {
                  sounds.unlockAudio();
                  sounds.triggerHaptic(15, 'medium');
                  setPlayerHp(100);
                  playerHpRef.current = 100;
                  setTimeLeft(60);
                  timeLeftRef.current = 60;
                  setIsGamePaused(false);
                }}
                className="w-full h-10 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-amber-400/50 text-zinc-300 font-bold text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Repeat className="w-3.5 h-3.5 text-amber-400" />
                <span>RESTART CURRENT SECTOR</span>
              </button>

              {/* 4. Abort & Return to Menu (Back Option) */}
              <button
                onClick={() => {
                  sounds.unlockAudio();
                  sounds.triggerHaptic(15, 'heavy');
                  setIsGamePaused(false);
                  if (scoreRef.current > 0 || killsRef.current > 0) {
                    const prof = loadStudentProfile();
                    recordScoreToLeaderboard({
                      studentName: prof?.name || 'Operative',
                      className: prof?.className || 'Science Unit',
                      score: scoreRef.current,
                      kills: killsRef.current,
                      levelTitle: isMultiplayerDeathmatch ? `Arena [${activeRoomCode}] PvP` : level.title,
                      stage: isMultiplayerDeathmatch ? 'Multiplayer' : level.stage,
                      isVictory: killsRef.current > 0,
                    }).catch(() => {});
                  }
                  if (onExitToMenu) {
                    onExitToMenu();
                  } else {
                    onPhaseDefeat(0, 0);
                  }
                }}
                className="w-full h-11 bg-rose-950/70 hover:bg-rose-900 border border-rose-500/60 hover:border-rose-400 text-rose-200 font-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
              >
                <Home className="w-4 h-4 text-rose-400" />
                <span>ABORT OPERATION // RETURN TO HEADQUARTERS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 15-SECOND HELICOPTER SUPPLY DROP PING INDICATOR ALERT BANNER */}
      {isMultiplayerDeathmatch && supplyDropPingAlert && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none font-mono">
          <div className="px-4 py-2 bg-amber-950/95 border-2 border-amber-400 rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.85)] flex items-center gap-3 animate-pulse text-amber-200">
            <Radio className="w-5 h-5 text-amber-400 animate-spin" />
            <div className="flex flex-col">
              <div className="text-[10px] tracking-widest text-amber-400 uppercase font-black">
                SUPPLY DROP INBOUND IN {supplyDropPingAlert.secondsLeft}S
              </div>
              <div className="text-xs font-black text-white">
                POS: X={supplyDropPingAlert.x} Z={supplyDropPingAlert.z} ({supplyDropPingAlert.dist}M) • {supplyDropPingAlert.abilityName}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE SUPER ABILITIES BADGES DISPLAY */}
      {isMultiplayerDeathmatch && Object.keys(activeSuperAbilities).length > 0 && (
        <div className="fixed top-28 left-4 z-30 pointer-events-none flex flex-col gap-1.5 font-mono">
          {Object.entries(activeSuperAbilities).map(([key, expireTime]) => {
            const secs = Math.max(0, Math.ceil((expireTime - performance.now()) / 1000));
            const labels: Record<string, string> = {
              burning_bullets: '🔥 BURNING BULLETS',
              supersonic_speed: '⚡ SUPERSONIC SPEED',
              immortality: '🛡️ IMMORTALITY',
              double_xp: '⭐ DOUBLE XP',
              t_cytotoxic_laser: '💥 T-CYTOTOXIC LASER',
              biotoxic_rpg: '🚀 BIOTOXIC RPG',
            };
            return (
              <div key={key} className="px-2.5 py-1 bg-amber-500/90 border border-amber-200 rounded-lg shadow-md text-[10px] font-black text-zinc-950 flex items-center gap-2">
                <span>{labels[key] || key.toUpperCase()}</span>
                <span className="px-1.5 py-0.5 bg-black/40 text-amber-200 rounded font-bold">{secs}s</span>
              </div>
            );
          })}
        </div>
      )}


      {/* CLASSIFIED BLACK OPS INTEL DOSSIER POPUP (1-2 sentence Biology Note, max 1 per phase) */}
      {activeConceptCard && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 pointer-events-auto font-mono">
          <div
            className="w-full max-w-md bg-zinc-950 border-l-4 border-amber-500 border-t border-r border-b border-amber-500/40 p-5 shadow-[0_0_35px_rgba(0,0,0,0.95)] text-left"
            style={{ clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)' }}
          >
            <div className="flex items-center justify-between gap-2 text-[10px] tracking-[0.2em] text-amber-500 font-bold uppercase mb-1.5">
              <span>CLASSIFIED BIO-INTEL // {activeConceptCard.stage}</span>
              <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
            </div>

            <h3 className="text-base sm:text-lg font-black tracking-wide text-white uppercase mb-2">
              {activeConceptCard.title}
            </h3>

            <p className="text-xs sm:text-sm font-sans text-zinc-200 leading-relaxed mb-4">
              {activeConceptCard.scientificFact}
            </p>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-800">
              <span className="text-[10px] tracking-widest text-zinc-500 uppercase">FIRST-CONTACT BRIEFING</span>
              <button
                onClick={() => {
                  sounds.triggerHaptic(15, 'light');
                  handleDismissConceptCard();
                }}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs tracking-widest uppercase cursor-pointer transition-colors whitespace-nowrap"
              >
                RESUME OP [ENTER]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MULTIPLAYER DEATHMATCH: 3-QUESTION BIOLOGY REVIVE / BIO-STASIS UNFREEZE MODAL
          Appears when player dies during the 1-minute window OR gets frozen & stunned
          when the 1-minute combat timer reaches 0!
         ===================================================================== */}
      {isMultiplayerDeathmatch && mpStatus !== 'active' && !isGamePaused && !mpMatchEnded && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 pointer-events-auto font-mono select-none">
          <div
            className={`w-full max-w-xl bg-zinc-950 border-l-4 ${
              mpStatus === 'stunned'
                ? 'border-cyan-400 border-t border-r border-b border-cyan-500/50 shadow-[0_0_55px_rgba(6,182,212,0.45)]'
                : 'border-rose-500 border-t border-r border-b border-rose-500/50 shadow-[0_0_55px_rgba(244,63,94,0.45)]'
            } p-4 sm:p-6 text-left space-y-4`}
            style={{ clipPath: 'polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px))' }}
          >
            {/* Top Status Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                {mpStatus === 'stunned' ? (
                  <Snowflake className="w-5 h-5 text-cyan-400 animate-spin" />
                ) : (
                  <Skull className="w-5 h-5 text-rose-500 animate-pulse" />
                )}
                <div>
                  <div
                    className={`text-xs sm:text-sm font-black tracking-wider uppercase ${
                      mpStatus === 'stunned' ? 'text-cyan-300' : 'text-rose-400'
                    }`}
                  >
                    {mpStatus === 'stunned'
                      ? '❄️ BIO-STASIS FREEZE (1-MINUTE COMBAT LIMIT REACHED!)'
                      : mpQuizReason === 'deploy'
                      ? '🧬 INITIAL TACTICAL DEPLOYMENT CLEARANCE'
                      : '💀 ELIMINATED IN ACTION — EMERGENCY CELLULAR REVIVE'}
                  </div>
                  <div className="text-[10px] sm:text-xs text-zinc-400">
                    {mpStatus === 'stunned'
                      ? 'You survived 60 seconds! You are shielded inside the Bio-Stasis Freeze — answer 1 Biology Question correctly to unfreeze!'
                      : mpKilledByInfo
                      ? `Eliminated by ${mpKilledByInfo.killerName} [${mpKilledByInfo.weaponName}] — Answer 1 Biology Question to revive!`
                      : 'Answer 1 Biology Question correctly to deploy into the live 1-minute open-world deathmatch!'}
                  </div>
                </div>
              </div>

              {/* Live Score & Eliminations Preserved Badge */}
              <div className="flex items-center gap-2 bg-zinc-900 border border-white/15 px-2.5 py-1 rounded text-[10px] font-black">
                <span className="text-rose-400">ELIMS: {kills}</span>
                <span className="text-zinc-600">|</span>
                <span className="text-amber-300">SCORE: {score}</span>
              </div>
            </div>

            {/* 1-Question Progress Pip */}
            <div className="flex items-center justify-between gap-2 bg-zinc-900/90 border border-white/10 px-3 py-2 rounded">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-zinc-300">
                {mpStatus === 'stunned' ? 'BIO-STASIS UNFREEZE CLEARANCE (INVULNERABLE):' : 'CELLULAR REVIVE CLEARANCE:'}
              </span>
              <div className="flex items-center gap-1.5">
                {[0].map((step) => {
                  const done = mpCorrectCount > step;
                  return (
                    <div
                      key={step}
                      className={`h-6 px-2.5 rounded flex items-center justify-center gap-1 text-[10px] font-black border transition-all ${
                        done
                          ? 'bg-emerald-500 text-zinc-950 border-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.7)]'
                          : 'bg-zinc-950 text-zinc-500 border-zinc-700'
                      }`}
                    >
                      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                      <span>Q1</span>
                    </div>
                  );
                })}
                <span className="ml-1 text-xs font-black text-emerald-400 tabular-nums">
                  {Math.min(1, mpCorrectCount)}/1
                </span>
              </div>
            </div>

            {/* Active Biology Question Card */}
            {(() => {
              const qList = level.questions && level.questions.length > 0 ? level.questions : [];
              const currentQ = qList[mpQuestionIdx % Math.max(1, qList.length)];
              if (!currentQ) return null;
              return (
                <div className="space-y-3 font-sans">
                  <div className="bg-zinc-900/80 border-l-4 border-amber-400 p-3.5 rounded-r">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400 mb-1">
                      BIOLOGY CLEARANCE QUESTION #1 OF 1
                    </div>
                    <p className="text-sm sm:text-base font-bold text-white leading-snug">
                      {currentQ.question}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {currentQ.options.map((opt, oIdx) => {
                      const isPicked = mpSelectedOpt === oIdx;
                      const isRight = oIdx === currentQ.correctIndex;
                      let btnStyle =
                        'bg-zinc-900/90 hover:bg-zinc-800 border-white/15 text-zinc-100';
                      if (mpSelectedOpt !== null) {
                        if (isRight) {
                          btnStyle =
                            'bg-emerald-950/95 border-emerald-400 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.4)]';
                        } else if (isPicked) {
                          btnStyle =
                            'bg-rose-950/95 border-rose-500 text-rose-200';
                        } else {
                          btnStyle = 'bg-zinc-950/60 border-white/5 text-zinc-500 opacity-60';
                        }
                      }

                      return (
                        <button
                          key={oIdx}
                          onClick={() => handleMpAnswerOption(oIdx)}
                          disabled={mpSelectedOpt !== null}
                          className={`w-full text-left px-3.5 py-2.5 rounded border-2 font-semibold text-xs sm:text-sm flex items-center justify-between gap-3 cursor-pointer transition-all ${btnStyle}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded bg-black/60 border border-white/20 flex items-center justify-center font-mono font-black text-xs text-amber-400 shrink-0">
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            <span>{opt}</span>
                          </div>
                          {mpSelectedOpt !== null && isRight && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                          {mpSelectedOpt !== null && isPicked && !isRight && (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {mpFeedback && (
                    <div
                      className={`p-2.5 rounded border text-xs font-medium leading-relaxed ${
                        mpFeedback.isCorrect
                          ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-200'
                          : 'bg-rose-950/80 border-rose-500/60 text-rose-200'
                      }`}
                    >
                      <span className="font-black uppercase mr-1.5">
                        {mpFeedback.isCorrect ? '✓ CORRECT (1/1 — DEPLOYING!):' : '✗ INCORRECT — STUDY & CONTINUE:'}
                      </span>
                      {mpFeedback.explanation}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Footer with Exit to Lobby option */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] text-zinc-400">
              <span>ROOM: {activeRoomCode} • 60S ACTIVE COMBAT PER 1 CORRECT ANSWER</span>
              {onExitToMenu && (
                <button
                  onClick={() => {
                    sounds.unlockAudio();
                    if (isMultiplayerDeathmatch && scoreRef.current > 0) {
                      const prof = loadStudentProfile();
                      recordScoreToLeaderboard({
                        studentName: prof?.name || 'Operative',
                        className: prof?.className || 'Class 7',
                        score: scoreRef.current,
                        kills: killsRef.current,
                        levelTitle: `Arena [${activeRoomCode}] PvP`,
                        stage: 'Multiplayer',
                        rankTitle: 'Commando',
                        isVictory: killsRef.current > 0,
                      }).catch(() => {});
                    }
                    onExitToMenu();
                  }}
                  className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-rose-950 border border-white/15 hover:border-rose-500/60 text-zinc-300 hover:text-rose-200 font-bold uppercase cursor-pointer transition-colors"
                >
                  LEAVE MATCH
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AFK Warning Banner (final 15s before 1-minute AFK Server Kick) */}
      {isMultiplayerDeathmatch && afkWarningSecondsLeft !== null && !afkKickedModal && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none font-mono">
          <div className="px-4 py-1.5 rounded bg-rose-950/95 border-2 border-rose-500 text-rose-200 text-xs font-black tracking-wider uppercase shadow-[0_0_20px_rgba(244,63,94,0.6)] animate-pulse">
            ⚠️ AFK WARNING: MOVE, ACT, OR SOLVE QUESTION WITHIN {afkWarningSecondsLeft}S OR BE KICKED FROM SERVER!
          </div>
        </div>
      )}

      {/* 1-Minute AFK Server Kick Modal */}
      {isMultiplayerDeathmatch && afkKickedModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto font-mono select-none">
          <div className="w-full max-w-md bg-zinc-950 border-2 border-rose-500 p-6 rounded-lg shadow-[0_0_50px_rgba(244,63,94,0.5)] text-center space-y-4">
            <div className="text-rose-400 font-black text-base sm:text-lg tracking-wider uppercase">
              ⚠️ KICKED FROM SERVER (AFK)
            </div>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans">
              You have been removed from room <span className="font-mono font-bold text-white">{activeRoomCode}</span> due to 1 minute of inactivity (no movement, combat actions, or questions solved).
            </p>
            <button
              onClick={() => {
                sounds.unlockAudio();
                onExitToMenu?.();
              }}
              className="w-full py-2.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm tracking-wider uppercase cursor-pointer transition-colors"
            >
              RETURN TO MAIN MENU
            </button>
          </div>
        </div>
      )}

      {/* Biological Power-Up Pickup Toast Banner */}
      {powerUpToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-bounce">
          <div
            className={`px-3.5 py-1.5 rounded-lg border-2 shadow-2xl flex items-center gap-2 text-xs sm:text-sm font-mono font-black ${powerUpToast.color}`}
          >
            <span>{powerUpToast.text}</span>
          </div>
        </div>
      )}

      {/* Teacher / Classroom Live Arena Broadcast Modal */}
      {showSpectatorBoard && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 pointer-events-auto">
          <div className="bg-zinc-950 border-2 border-emerald-400/80 rounded-xl max-w-3xl w-full p-4 sm:p-6 shadow-[0_0_40px_rgba(16,185,129,0.3)] flex flex-col gap-4 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-400 flex items-center justify-center text-emerald-300">
                  <Tv className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-wide text-white">
                    CLASSROOM ARENA BROADCAST • ROOM {activeRoomCode}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-zinc-400 font-mono">
                    5-PLAYER ROOM SYNC • REAL-TIME OPERATIVE PERFORMANCE
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSpectatorBoard(false)}
                className="px-3 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/20 text-xs font-bold uppercase transition-colors cursor-pointer"
              >
                CLOSE [ESC]
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-zinc-900/90 border border-white/10 p-2.5 rounded-lg text-center">
                <span className="text-[10px] text-zinc-400 block uppercase font-mono">CONNECTED PLAYERS</span>
                <span className="text-xl font-black text-cyan-300">
                  {Math.min(
                    MAX_PLAYERS_PER_ROOM,
                    Math.max(
                      1,
                      mpOnlinePlayers.some((p) => p.playerId === localMpPlayerIdRef.current)
                        ? mpOnlinePlayers.length
                        : mpOnlinePlayers.length + 1
                    )
                  )}
                  /{MAX_PLAYERS_PER_ROOM}
                </span>
              </div>
              <div className="bg-zinc-900/90 border border-white/10 p-2.5 rounded-lg text-center">
                <span className="text-[10px] text-zinc-400 block uppercase font-mono">TOTAL ELIMINATIONS</span>
                <span className="text-xl font-black text-rose-400">
                  {mpOnlinePlayers.reduce((acc, p) => acc + (p.kills || 0), killsRef.current)}
                </span>
              </div>
              <div className="bg-zinc-900/90 border border-white/10 p-2.5 rounded-lg text-center">
                <span className="text-[10px] text-zinc-400 block uppercase font-mono">ACTIVE POWER-UPS</span>
                <span className="text-xl font-black text-amber-300">
                  {activeBiologicalDropsRef.current.filter((d) => d.active).length} DROPS
                </span>
              </div>
              <div className="bg-zinc-900/90 border border-white/10 p-2.5 rounded-lg text-center">
                <span className="text-[10px] text-zinc-400 block uppercase font-mono">SPECTATOR STATUS</span>
                <span className="text-xl font-black text-emerald-400">LIVE FEED</span>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto border border-white/10 rounded-lg">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-zinc-900/90 text-zinc-400 text-[10px] uppercase border-b border-white/10 sticky top-0">
                  <tr>
                    <th className="p-2">OPERATIVE</th>
                    <th className="p-2">CLASS</th>
                    <th className="p-2">STATUS</th>
                    <th className="p-2">HP</th>
                    <th className="p-2">KILLS</th>
                    <th className="p-2">DEATHS</th>
                    <th className="p-2">SCORE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr className="bg-emerald-950/40 text-emerald-200 font-bold">
                    <td className="p-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>YOU ({loadStudentProfile()?.name || 'Operative'})</span>
                    </td>
                    <td className="p-2 text-zinc-300">{loadStudentProfile()?.className || 'Science Unit'}</td>
                    <td className="p-2 uppercase text-emerald-400">{mpStatus}</td>
                    <td className="p-2">{playerHp}/100</td>
                    <td className="p-2 text-rose-300">{kills}</td>
                    <td className="p-2 text-zinc-400">{mpDeaths}</td>
                    <td className="p-2 text-amber-300 font-black">{score}</td>
                  </tr>
                  {mpOnlinePlayers
                    .filter((p) => p.playerId !== localMpPlayerIdRef.current)
                    .map((rp) => (
                      <tr key={rp.playerId} className="hover:bg-zinc-900/50">
                        <td className="p-2 font-bold text-white flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              rp.status === 'active'
                                ? 'bg-emerald-400'
                                : rp.status === 'stunned'
                                ? 'bg-cyan-400'
                                : 'bg-amber-400'
                            }`}
                          ></span>
                          <span>{rp.studentName}</span>
                        </td>
                        <td className="p-2 text-zinc-400">{rp.className || 'Science'}</td>
                        <td
                          className={`p-2 uppercase font-black text-[10px] ${
                            rp.status === 'active'
                              ? 'text-emerald-400'
                              : rp.status === 'stunned'
                              ? 'text-cyan-300'
                              : 'text-amber-400'
                          }`}
                        >
                          {rp.status || 'ACTIVE'}
                        </td>
                        <td className="p-2 text-zinc-300">{rp.hp ?? 100}/100</td>
                        <td className="p-2 text-rose-300">{rp.kills || 0}</td>
                        <td className="p-2 text-zinc-400">{rp.deaths || 0}</td>
                        <td className="p-2 text-amber-300 font-black">{rp.score || 0}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-white/10">
              <span>All students ranked simultaneously in Cloud Firestore</span>
              <button
                onClick={() => setShowSpectatorBoard(false)}
                className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-xs cursor-pointer transition-colors"
              >
                RETURN TO COMBAT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MULTIPLAYER DEATHMATCH: MATCH END VICTORY SCREEN & 3D OLYMPIC PODIUM
          Triggered at 10-Kill Threshold or 5-Minute Match Countdown Expiry!
         ===================================================================== */}
      {isMultiplayerDeathmatch && mpMatchEnded && (() => {
        const localProf = loadStudentProfile();
        const localPlayerId = localMpPlayerIdRef.current;
        const localAcc = getLocalAccuracyPct();
        const localEntry = {
          playerId: localPlayerId,
          studentName: localProf?.name || 'OPERATIVE',
          className: localProf?.className || 'Science Unit',
          avatarType: localMpAvatarRef.current,
          kills: kills,
          deaths: mpDeaths,
          score: score,
          accuracy: localAcc,
          isLocal: true,
          isPlaceholder: false,
        };

        const remoteEntries = mpOnlinePlayers
          .filter((p) => p.playerId !== localPlayerId)
          .map((p) => ({
            playerId: p.playerId,
            studentName: p.studentName || 'OPERATIVE',
            className: p.className || 'Science Unit',
            avatarType: resolvePlayerAvatarType(p.playerId, p.avatarType),
            kills: p.kills || 0,
            deaths: p.deaths || 0,
            score: p.score || 0,
            accuracy: typeof p.accuracy === 'number' ? p.accuracy : (p.kills || 0) > 0 ? 64 : 0,
            isLocal: false,
            isPlaceholder: false,
          }));

        const allRanked = [localEntry, ...remoteEntries].sort((a, b) => {
          if (b.kills !== a.kills) return b.kills - a.kills;
          if (b.score !== a.score) return b.score - a.score;
          return b.accuracy - a.accuracy;
        });

        const fallbackAvatars: MultiplayerAvatarType[] = ['rbc', 'platelet', 'dendrite', 'antibody', 'mucus'];
        while (allRanked.length < 3) {
          const idx = allRanked.length;
          allRanked.push({
            playerId: `vacant_${idx}`,
            studentName: idx === 1 ? 'SQUAD SLOT #2' : 'SQUAD SLOT #3',
            className: 'Awaiting Operative',
            avatarType: fallbackAvatars[idx % fallbackAvatars.length],
            kills: 0,
            deaths: 0,
            score: 0,
            accuracy: 0,
            isLocal: false,
            isPlaceholder: true,
          });
        }

        const firstPlace = allRanked[0];
        const secondPlace = allRanked[1];
        const thirdPlace = allRanked[2];

        const podiumOrder = [
          { rank: 2, label: '2ND PLACE', sublabel: 'SILVER MEDALIST', data: secondPlace },
          { rank: 1, label: '1ST PLACE', sublabel: 'OLYMPIC BIO-CHAMPION', data: firstPlace },
          { rank: 3, label: '3RD PLACE', sublabel: 'BRONZE MEDALIST', data: thirdPlace },
        ];

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/92 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 pointer-events-auto select-none overflow-y-auto">
            <div
              className="w-full max-w-4xl bg-gradient-to-b from-slate-900/95 via-zinc-950/98 to-black border-2 border-amber-400/80 shadow-[0_0_70px_rgba(245,158,11,0.35)] p-3 sm:p-6 flex flex-col gap-3 sm:gap-5 text-white my-auto"
              style={{
                clipPath:
                  'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
              }}
            >
              {/* Top Championship Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-700 border-2 border-yellow-200 flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.6)] shrink-0">
                    <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] sm:text-xs font-mono font-black tracking-[0.2em] text-amber-300 uppercase">
                        MATCH COMPLETE • ROOM {activeRoomCode}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/60 text-[9px] font-mono font-black text-amber-200 uppercase">
                        {mpMatchEndReason === 'kill_limit'
                          ? `10-KILL VICTORY THRESHOLD REACHED`
                          : `5-MINUTE MATCH TIMER COMPLETED`}
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-2xl font-black tracking-wider uppercase text-white">
                      OLYMPIC BIO-DEFENSE VICTORY PODIUM
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-zinc-900/90 border border-white/15 px-3 py-1.5 rounded-lg font-mono text-xs">
                  <div>
                    <span className="text-[9px] text-zinc-400 block uppercase">CHAMPION</span>
                    <span className="font-black text-amber-300">{firstPlace.studentName}</span>
                  </div>
                  <div className="h-6 w-px bg-white/10" />
                  <div>
                    <span className="text-[9px] text-zinc-400 block uppercase">YOUR ACCURACY</span>
                    <span className="font-black text-cyan-300">{localAcc}%</span>
                  </div>
                </div>
              </div>

              {/* 3D-STYLED OLYMPIC VICTORY PODIUM (2ND SILVER | 1ST GOLD | 3RD BRONZE) */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end pt-2 sm:pt-4 px-1 sm:px-3">
                {podiumOrder.map((slot) => {
                  const p = slot.data;
                  const cellInfo = getAvatarDisplayInfo(p.avatarType);
                  const isFirst = slot.rank === 1;
                  const isSecond = slot.rank === 2;

                  const pedestalHeight = isFirst
                    ? 'h-32 sm:h-40'
                    : isSecond
                    ? 'h-24 sm:h-30'
                    : 'h-20 sm:h-24';

                  const pedestalGradient = isFirst
                    ? 'from-amber-400/95 via-yellow-600/95 to-amber-950 border-yellow-200 shadow-[0_-10px_35px_rgba(250,204,21,0.45)]'
                    : isSecond
                    ? 'from-slate-300/90 via-slate-500/90 to-slate-900 border-slate-200 shadow-[0_-8px_25px_rgba(203,213,225,0.3)]'
                    : 'from-orange-400/90 via-amber-800/90 to-stone-950 border-orange-300 shadow-[0_-8px_25px_rgba(249,115,22,0.3)]';

                  const cardBorder = isFirst
                    ? 'border-amber-400 bg-gradient-to-b from-amber-950/75 via-zinc-900/95 to-zinc-950 shadow-[0_0_30px_rgba(250,204,21,0.3)]'
                    : isSecond
                    ? 'border-slate-300/80 bg-gradient-to-b from-slate-800/80 via-zinc-900/95 to-zinc-950'
                    : 'border-orange-400/80 bg-gradient-to-b from-orange-950/65 via-zinc-900/95 to-zinc-950';

                  return (
                    <div
                      key={slot.rank}
                      className={`flex flex-col items-center ${isFirst ? '-translate-y-1 sm:-translate-y-2' : ''}`}
                    >
                      {/* Operative Info Card Above Pedestal */}
                      <div
                        className={`w-full rounded-t-xl border-2 p-2 sm:p-3.5 flex flex-col items-center text-center gap-1.5 relative ${cardBorder} ${
                          p.isPlaceholder ? 'opacity-65' : ''
                        }`}
                      >
                        {p.isLocal && (
                          <span className="absolute -top-2.5 px-2 py-0.5 rounded bg-emerald-400 text-slate-950 font-mono font-black text-[8px] sm:text-[9px] tracking-widest uppercase border border-white shadow-md">
                            ★ YOU ★
                          </span>
                        )}

                        {/* Biological Cell Fighter Avatar Emblem */}
                        <div
                          className="w-9 h-9 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 shadow-inner mt-1"
                          style={{
                            backgroundColor: `${cellInfo.accentHex}28`,
                            borderColor: cellInfo.accentHex,
                            boxShadow: `0 0 16px ${cellInfo.accentHex}55`,
                          }}
                        >
                          {isFirst ? (
                            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300" />
                          ) : isSecond ? (
                            <Award className="w-4 h-4 sm:w-5 sm:h-5 text-slate-200" />
                          ) : (
                            <Medal className="w-4 h-4 sm:w-5 sm:h-5 text-orange-300" />
                          )}
                        </div>

                        {/* Operative Callsign & Class */}
                        <div className="w-full">
                          <div className="text-xs sm:text-base font-black tracking-wide text-white truncate">
                            {p.studentName}
                          </div>
                          <div className="text-[8px] sm:text-[10px] font-mono text-zinc-400 truncate">
                            {p.className}
                          </div>
                        </div>

                        {/* Cell Fighter Type Badge */}
                        <span
                          className={`px-1.5 sm:px-2 py-0.5 rounded border text-[7.5px] sm:text-[9px] font-mono font-black uppercase tracking-wider truncate max-w-full ${cellInfo.badgeClass}`}
                        >
                          🧬 {cellInfo.title}
                        </span>

                        {/* Telemetry Grid: Kills, Accuracy %, Final Score */}
                        <div className="grid grid-cols-3 gap-1 w-full bg-black/60 border border-white/10 rounded-lg p-1.5 mt-1 font-mono">
                          <div className="flex flex-col items-center">
                            <span className="text-[7px] sm:text-[8px] text-zinc-400 uppercase">KILLS</span>
                            <span className="text-[10px] sm:text-sm font-black text-rose-400 tabular-nums">
                              {p.kills}
                            </span>
                          </div>
                          <div className="flex flex-col items-center border-x border-white/10">
                            <span className="text-[7px] sm:text-[8px] text-zinc-400 uppercase">ACC %</span>
                            <span className="text-[10px] sm:text-sm font-black text-cyan-300 tabular-nums">
                              {p.accuracy}%
                            </span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[7px] sm:text-[8px] text-zinc-400 uppercase">SCORE</span>
                            <span className="text-[10px] sm:text-sm font-black text-amber-300 tabular-nums">
                              {p.score}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 3D Beveled Top Lip of Olympic Pedestal */}
                      <div
                        className={`w-full h-2.5 sm:h-3.5 bg-gradient-to-r ${
                          isFirst
                            ? 'from-yellow-200 via-amber-300 to-yellow-200'
                            : isSecond
                            ? 'from-slate-100 via-slate-300 to-slate-100'
                            : 'from-orange-200 via-amber-500 to-orange-200'
                        } border-x-2 border-t border-white/80`}
                        style={{
                          transform: 'perspective(300px) rotateX(28deg)',
                        }}
                      />

                      {/* 3D Stepped Olympic Pedestal Column */}
                      <div
                        className={`w-full ${pedestalHeight} bg-gradient-to-b ${pedestalGradient} border-2 rounded-b-lg flex flex-col items-center justify-center relative overflow-hidden`}
                      >
                        <div
                          className="absolute inset-0 opacity-20 pointer-events-none"
                          style={{
                            backgroundImage:
                              'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 50%, rgba(0,0,0,0.45) 100%)',
                          }}
                        />
                        <span className="text-2xl sm:text-4xl font-black tracking-tighter text-white drop-shadow-[0_3px_6px_rgba(0,0,0,0.9)]">
                          {slot.rank === 1 ? '1ST' : slot.rank === 2 ? '2ND' : '3RD'}
                        </span>
                        <span className="text-[8px] sm:text-[10px] font-mono font-black tracking-widest uppercase text-white/90 drop-shadow">
                          {slot.sublabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons: Play Next Match & Return to Lobby */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-white/15">
                <div className="text-[10px] sm:text-xs font-mono text-zinc-400 text-center sm:text-left">
                  FIRST TO <span className="text-amber-300 font-bold">{MATCH_KILL_LIMIT} KILLS</span> OR{' '}
                  <span className="text-cyan-300 font-bold">5:00 TIMER</span> • ALL SCORES SAVED TO LEADERBOARD
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={handlePlayNextMatch}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer transition-all shadow-[0_0_25px_rgba(250,204,21,0.55)] border-2 border-white"
                  >
                    <Repeat className="w-4 h-4 stroke-[2.5]" />
                    <span>PLAY NEXT MATCH</span>
                  </button>

                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.triggerHaptic(15, 'medium');
                      onExitToMenu?.();
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-rose-950 border-2 border-white/25 hover:border-rose-400 text-white font-black text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Home className="w-4 h-4 text-rose-400" />
                    <span>RETURN TO LOBBY</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

