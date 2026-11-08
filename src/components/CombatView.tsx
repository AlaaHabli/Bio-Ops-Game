import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { LevelConfig, Weapon, HitMarkerInfo, KillfeedEntry, BiologyConceptCard } from '../types/game';
import { sounds } from '../services/soundEffects';
import { voipManager, OrganVoipClip } from '../services/voipManager';
import { ORGAN_THEMES, OrganTheme, getOrganThemeForLevel } from '../services/organThemes';
import { loadSeenConcepts, markConceptAsSeen } from '../services/storage';
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
  disposeSceneGraph,
} from './CellModels';
import { INITIAL_WEAPONS, CURRICULUM_LEVELS, BIOLOGY_CONCEPT_CARDS } from '../data/curriculumData';
import { RankBadge } from './RankBadge';
import {
  Shield,
  Zap,
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
    landed: boolean;
    targetY: number;
    x: number;
    z: number;
    lastFireTime: number;
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
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Pause State & Ref
  const [isGamePaused, setIsGamePaused] = useState<boolean>(false);
  const isGamePausedRef = useRef<boolean>(false);
  isGamePausedRef.current = isGamePaused;

  // Stage-relative level number (1 to 5) so adding new grades/missions never inflates difficulty
  const stageLevels = CURRICULUM_LEVELS.filter((l) => l.stage === level.stage && !l.isSecret);
  const stageIdx = stageLevels.findIndex((l) => l.id === level.id);
  const levelNumber = Math.max(1, Math.min(5, (stageIdx !== -1 ? stageIdx : 0) + 1));

  // Dynamic Organ Theme mapped from the curriculum level & phase (with live HUD cycling support!)
  const [organTheme, setOrganTheme] = useState<OrganTheme>(() =>
    getOrganThemeForLevel(level.id, phaseNumber)
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
  const [comboStreak, setComboStreak] = useState<number>(0);
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
  const [barricadeHps, setBarricadeHps] = useState<number[]>([100, 100, 100]);
  const [activeCoverHp, setActiveCoverHp] = useState<number>(100);
  const [isFiring, setIsFiring] = useState<boolean>(false);
  const [operatorMood, setOperatorMood] = useState<'normal' | 'shooting' | 'hit'>('normal');
  const [bleriotAlert, setBleriotAlert] = useState<string | null>(null);
  const [enemyAirdropAlert, setEnemyAirdropAlert] = useState<string | null>(null);
  const [hazardAlert, setHazardAlert] = useState<string | null>(null);
  const [bossDefeatedBanner, setBossDefeatedBanner] = useState<boolean>(false);

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
    setIsFiring(false);
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

  // Dynamic Screen Shake & Directional Damage Indicator HUD State (Scales in intensity as HP lowers!)
  const [damageIndicators, setDamageIndicators] = useState<DirectionalDamageIndicator[]>([]);
  const cameraRollShakeRef = useRef<number>(0);
  const nextDamageIndicatorIdRef = useRef<number>(1);

  useEffect(() => {
    autoAimEnabledRef.current = autoAimEnabled;
  }, [autoAimEnabled]);

  // Scope is available on SCAR-H Bio-Rifle (Holo), Bolt-Action Sniper (8x Scope), and Drum LMG (Reflex), but NOT Pump Shotgun
  const weaponSupportsScope = (wpn: Weapon) => wpn.category !== 'SHOTGUN';

  const syncCrosshairDom = (nx: number, ny: number) => {
    const screenX = Math.max(4, Math.min(96, (nx + 1) * 50));
    const screenY = Math.max(5, Math.min(94, (-ny + 1) * 50));
    if (crosshairDomRef.current) {
      crosshairDomRef.current.style.left = `${screenX}%`;
      crosshairDomRef.current.style.top = `${screenY}%`;
    }
    if (scopeReticleDomRef.current) {
      scopeReticleDomRef.current.style.left = `${screenX}%`;
      scopeReticleDomRef.current.style.top = `${screenY}%`;
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
    if (next) {
      // Center the scope optic directly on the exact 3D direction the player was aiming!
      baseAimYawRef.current = THREE.MathUtils.clamp(
        baseAimYawRef.current - aimPosRef.current.x * 0.42,
        -0.55,
        0.55
      );
      baseAimPitchRef.current = THREE.MathUtils.clamp(
        baseAimPitchRef.current + aimPosRef.current.y * 0.34,
        -0.38,
        0.38
      );
      aimPosRef.current.x = 0;
      aimPosRef.current.y = 0;
      targetAimPosRef.current.x = 0;
      targetAimPosRef.current.y = 0;
      syncCrosshairDom(0, 0);
    } else {
      // Restore hipfire crosshair cleanly from scoped camera angle
      const restoredX = THREE.MathUtils.clamp(-baseAimYawRef.current / 0.42, -0.85, 0.85);
      const restoredY = THREE.MathUtils.clamp(baseAimPitchRef.current / 0.34, -0.85, 0.85);
      aimPosRef.current.x = restoredX;
      aimPosRef.current.y = restoredY;
      targetAimPosRef.current.x = restoredX;
      targetAimPosRef.current.y = restoredY;
      baseAimYawRef.current = 0;
      baseAimPitchRef.current = 0;
      syncCrosshairDom(restoredX, restoredY);
    }
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
        // Center the camera aim on the target the player was aiming at when scoping in!
        baseAimYawRef.current = THREE.MathUtils.clamp(
          baseAimYawRef.current - aimPosRef.current.x * 0.42,
          -0.55,
          0.55
        );
        baseAimPitchRef.current = THREE.MathUtils.clamp(
          baseAimPitchRef.current + aimPosRef.current.y * 0.34,
          -0.38,
          0.38
        );
        aimPosRef.current.x = 0;
        aimPosRef.current.y = 0;
        targetAimPosRef.current.x = 0;
        targetAimPosRef.current.y = 0;
        syncCrosshairDom(0, 0);

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
      const restoredX = THREE.MathUtils.clamp(-baseAimYawRef.current / 0.42, -0.85, 0.85);
      const restoredY = THREE.MathUtils.clamp(baseAimPitchRef.current / 0.34, -0.85, 0.85);
      aimPosRef.current.x = restoredX;
      aimPosRef.current.y = restoredY;
      targetAimPosRef.current.x = restoredX;
      targetAimPosRef.current.y = restoredY;
      baseAimYawRef.current = 0;
      baseAimPitchRef.current = 0;
      syncCrosshairDom(restoredX, restoredY);

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
  const [radarBlips, setRadarBlips] = useState<Array<{ x: number; y: number; isTank: boolean; isAllied: boolean }>>([]);
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

  // Virtual Joystick & Zero-Re-Render Crosshair DOM Refs (Eliminates 25Hz React VDOM re-renders during touch/mouse aim!)
  const joystickCenterRef = useRef<{ x: number; y: number } | null>(null);
  const joystickOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [joystickDisplay, setJoystickDisplay] = useState<{ x: number; y: number } | null>(null);
  const joystickKnobDomRef = useRef<HTMLDivElement | null>(null);
  const crosshairDomRef = useRef<HTMLDivElement | null>(null);
  const scopeReticleDomRef = useRef<HTMLDivElement | null>(null);

  // Mutable Game State in Refs (ensures WebGL never unmounts on state updates!)
  const playerPosRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const moveInputRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const keysDownRef = useRef<Record<string, boolean>>({});
  const currentWeaponRef = useRef<Weapon>(initialWeapon);
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
  const activeGrenadesRef = useRef<ActiveGrenade[]>([]);
  const activeParticlesRef = useRef<ActiveExplosionParticle[]>([]);
  const activeShellsRef = useRef<ActiveShellCasing[]>([]);
  const activePlayerTracersRef = useRef<ActivePlayerTracer[]>([]);
  const airdropRef = useRef<ActiveAirdrop | null>(null);
  const panickingRbcsRef = useRef<any[]>([]);
  const panickingPlateletsRef = useRef<any[]>([]);
  const heroicAntibodiesRef = useRef<any[]>([]);
  const organEnvPropsRef = useRef<ReturnType<typeof createOrganEnvironmentProps> | null>(null);
  const rebuildOrganThemeRef = useRef<((newTheme: OrganTheme) => void) | null>(null);
  const fpsGroupRef = useRef<THREE.Group | null>(null);
  const weaponMeshRef = useRef<THREE.Group | null>(null);
  const activeWeaponSubmeshRef = useRef<THREE.Group | null>(null);
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

  useEffect(() => {
    sounds.setEnabled(soundEnabled);
    if (soundEnabled) {
      sounds.unlockAudio();
      setAudioSuspended(sounds.isAudioSuspended());
    }
  }, [soundEnabled]);

  const handleSoundToggle = () => {
    sounds.unlockAudio();
    if (onToggleSound) {
      onToggleSound();
    } else {
      sounds.setEnabled(!soundEnabled);
    }
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

  // 60-second combat countdown (Pauses automatically whenever a First-Time Biology Concept modal is open!)
  const timeLeftRef = useRef<number>(60);
  useEffect(() => {
    sounds.playCombatAlarm();
    timeLeftRef.current = 60;
    const timer = setInterval(() => {
      if (isPausedForConceptRef.current || isGamePausedRef.current) return;

      // Show at most 1 queued biology concept in this phase after 3.2s warmup
      const nowCheck = performance.now();
      if (
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
              setIsFiring(false);
              keysDownRef.current = {};
              moveInputRef.current = { x: 0, z: 0 };
              sounds.playRadioChirp();
              setActiveConceptCard(nextCard);
              return;
            }
          }
        }
      }

      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          timeLeftRef.current = 0;
          return 0;
        }
        const next = prev - 1;
        timeLeftRef.current = next;
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Timer complete -> VICTORY!
  useEffect(() => {
    if (timeLeft === 0 && playerHpRef.current > 0 && !phaseCompleteCalledRef.current) {
      phaseCompleteCalledRef.current = true;
      sounds.playVictory();
      onPhaseComplete(scoreRef.current + 1000, killsRef.current);
    }
  }, [timeLeft, onPhaseComplete]);

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
    if (grantBonusBullets) {
      setActiveReloadBonus(true);
      setTimeout(() => setActiveReloadBonus(false), 1800);
    }
  };

  const handleReload = () => {
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
    if (grenadeCooldownRef.current > 0 || !sceneRef.current) return;
    grenadeCooldownRef.current = 10;
    setGrenadeCooldown(10);
    sounds.playGrenadeThrow();
    sounds.triggerHaptic([25, 30], 'medium');

    const pool = grenadePoolRef.current;
    let grenadeMesh = pool.find((g) => !g.visible) || pool[0];
    if (!grenadeMesh) {
      grenadeMesh = createGrenadeModel();
      sceneRef.current.add(grenadeMesh);
      pool.push(grenadeMesh);
    }
    const startX = playerPosRef.current.x + 0.2;
    const startY = -0.2;
    const startZ = playerPosRef.current.z - 0.8;
    grenadeMesh.visible = true;
    grenadeMesh.position.set(startX, startY, startZ);

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

  const handleSelectWeapon = (nextWpn: Weapon) => {
    currentWeaponRef.current = nextWpn;
    currentAmmoRef.current = nextWpn.magSize;
    reserveAmmoRef.current = nextWpn.totalReserve;
    setCurrentWeapon(nextWpn);
    setCurrentAmmo(nextWpn.magSize);
    setReserveAmmo(nextWpn.totalReserve);
    if (onSelectWeapon) onSelectWeapon(nextWpn);

    // If swapping to a weapon without a scope (Shotgun), unscope automatically
    if (!weaponSupportsScope(nextWpn) && isScopedRef.current) {
      isScopedRef.current = false;
      manualScopeLockRef.current = false;
      autoScopedByHoldRef.current = false;
      setIsScoped(false);
    }

    // Rebuild weapon 3D model in FPS rig smoothly and dispose old weapon geometry/materials
    if (weaponMeshRef.current && activeWeaponSubmeshRef.current) {
      disposeSceneGraph(activeWeaponSubmeshRef.current);
      weaponMeshRef.current.remove(activeWeaponSubmeshRef.current);
      const newModel = createFortniteWeaponModel(nextWpn.id, nextWpn.color);
      weaponMeshRef.current.add(newModel.group);
      activeWeaponSubmeshRef.current = newModel.group;
      pumpSlideRef.current = newModel.pumpSlide || null;
    }

    sounds.playRadioChirp();
    sounds.triggerHaptic([18, 25], 'medium');
  };
  handleSelectWeaponRef.current = handleSelectWeapon;

  // Quick Weapon Swap (SCAR, Pump Shotgun, Sniper, Drum Machine Gun)
  const handleSwapWeapon = () => {
    const list = availableWeapons && availableWeapons.length > 0 ? availableWeapons : INITIAL_WEAPONS;
    const currentIdx = list.findIndex((w) => w.id === currentWeaponRef.current.id);
    const nextIdx = (currentIdx + 1) % list.length;
    handleSelectWeapon(list[nextIdx]);
  };
  handleSwapWeaponRef.current = handleSwapWeapon;

  // MAIN THREE.JS SETUP (Runs ONCE on mount!)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect software GL
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(organTheme.fogColor, 0.012);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.05, 140);
    camera.position.set(0, 0, 0);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    const maxPixelRatio = window.innerWidth < 900 ? 1.25 : 1.5;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, maxPixelRatio));
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

    const muzzleLight = new THREE.PointLight(0x38bdf8, 0, 18);
    muzzleLight.position.set(0.3, -0.2, -1.2);
    scene.add(muzzleLight);
    muzzleFlashRef.current = muzzleLight;

    // 3D Tactical Muzzle Flash Starburst Mesh
    const flashGeo = new THREE.PlaneGeometry(0.42, 0.42);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const muzzleSprite = new THREE.Mesh(flashGeo, flashMat);
    muzzleSprite.position.set(0.38, -0.24, -1.05);
    camera.add(muzzleSprite);
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

    // 4. Organ Cavity Tunnel
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
    scene.add(wallMesh);

    // 6. Organ Particles
    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 18;
      particlePositions[i + 1] = (Math.random() - 0.5) * 16;
      particlePositions[i + 2] = -Math.random() * 90;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: organTheme.particleColor,
      size: organTheme.particleSize,
      transparent: true,
      opacity: 0.7,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 5. Dynamic Theme-Specific Panicking Cells, Heroic Frowning Defenders & 3D Organ Environment Props
    function buildThemeElements(theme: OrganTheme) {
      organThemeRef.current = theme;

      // Update lighting, fog, particles & wall texture
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
      }

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

    // 7. FPS White Blood Cell Arms (with Black Ops Tactical Gloves) & Fortnite-Style Weapon
    const fpsGroup = new THREE.Group();
    const leukocyteArms = createLeukocyteFPSArms(currentWeaponRef.current.color);
    fpsGroup.add(leukocyteArms);

    const initialWeaponModel = createFortniteWeaponModel(currentWeaponRef.current.id, currentWeaponRef.current.color);
    fpsGroup.add(initialWeaponModel.group);
    activeWeaponSubmeshRef.current = initialWeaponModel.group;
    pumpSlideRef.current = initialWeaponModel.pumpSlide || null;

    fpsGroup.position.set(0.36, -0.34, -0.82);
    camera.add(fpsGroup);
    scene.add(camera);
    weaponMeshRef.current = fpsGroup;
    fpsGroupRef.current = fpsGroup;

    // 8. TACTICAL SANDBAG BARRICADES (Waist-High Defensive Bunkers with 70 HP each)
    const barricadeConfigs = [
      { x: -2.6, y: -0.92, z: -2.4 },
      { x: 0, y: -0.92, z: -2.4 },
      { x: 2.6, y: -0.92, z: -2.4 },
    ];
    barricadesRef.current = [];
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

      if (eType === 'tank') {
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

      const parachuteGroup = createEnemyParachute(eType === 'tank');
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
      };
      enemyPool.push(slot);
      return slot;
    }

    function resetAndActivatePoolSlot(slot: PooledEnemySlot): PooledEnemySlot {
      slot.inUse = true;
      slot.group.visible = true;
      slot.group.rotation.set(0, 0, 0);
      slot.hpBarFill.scale.set(1, 1, 1);
      slot.hpBarFill.position.x = 0;
      if (slot.leftLeg) slot.leftLeg.rotation.set(0, 0, 0);
      if (slot.rightLeg) slot.rightLeg.rotation.set(0, 0, 0);
      if (slot.leftArm) slot.leftArm.rotation.set(0, 0, 0);
      if (slot.rightArm) slot.rightArm.rotation.set(0, 0, 0);
      if (slot.turret) slot.turret.rotation.set(0, 0, 0);
      if (slot.cannon) slot.cannon.position.z = 0;
      if (slot.scopeGlint) (slot.scopeGlint.material as THREE.MeshBasicMaterial).opacity = 0;
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
      // 3. Recycle oldest slot
      return resetAndActivatePoolSlot(enemyPool[0]);
    }

    function releaseSoldierToPool(soldier: ActiveSoldier) {
      soldier.mesh.visible = false;
      if (soldier.parachuteGroup) soldier.parachuteGroup.visible = false;
      for (let i = 0; i < enemyPool.length; i++) {
        if (enemyPool[i].group === soldier.mesh) {
          enemyPool[i].inUse = false;
          return;
        }
      }
    }

    // Pre-allocate Fixed Enemy Object Pool (5 Strep Troopers, 4 Bacillus Heavy Gunners, 2 Heavy Tanks — zero mid-combat allocations!)
    for (let i = 0; i < 5; i++) allocateEnemyPoolSlot('strep');
    for (let i = 0; i < 4; i++) allocateEnemyPoolSlot('bacillus');
    for (let i = 0; i < 2; i++) allocateEnemyPoolSlot('tank');

    // Pre-allocate Allied Reinforcements & Grenade Pool at startup so [T] and [G] never compile shaders mid-combat!
    {
      const allyPlane = createTacticalAirdropPlane();
      allyPlane.group.visible = false;
      scene.add(allyPlane.group);

      const leftAlly = createAlliedWBCCommando(true);
      leftAlly.group.visible = false;
      scene.add(leftAlly.group);

      const rightAlly = createAlliedWBCCommando(false);
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
      isParachuteDrop: boolean = false
    ) {
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
        forceType === 'tank' ||
        (!forceType && activeTanks < maxTanksAllowed && Math.random() < tankChance);

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

      if (shouldSpawnTank) {
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
      const x = customX !== undefined ? customX : Math.cos(angle) * spawnRadius;
      const groundY = isTank ? -0.5 : Math.sin(angle) * spawnRadius * 0.45;
      const y = isParachuteDrop ? 2.15 : groundY;
      const z = customZ !== undefined ? customZ : -33 - Math.random() * 12;

      pooledSlot.parachuteGroup.visible = isParachuteDrop;
      soldierMesh.position.set(x, y, z);

      const soldierId = nextEnemyIdRef.current++;
      const firingLineZ = isTank
        ? -12.0 - (soldierId % 3) * 1.2
        : -7.2 - (soldierId % 4) * 1.05;

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
        hitsLeft,
        maxHits: hitsLeft,
        hp,
        maxHp: hp,
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
        isParachuting: isParachuteDrop,
        landingY: groundY,
      };

      activeSoldiersRef.current.push(soldier);
      if (isTank) {
        triggerBiologyConceptRef.current?.('enemy_tank_biofilm');
      } else {
        triggerBiologyConceptRef.current?.('enemy_bacteria');
      }
    }

    // Immediate opening vanguard squad scales with levelIndex & phaseIndex
    const initialSquadSize = 3 + Math.min(4, Math.floor((levelNumber - 1) / 2) + (phaseNumber - 1));
    for (let i = 0; i < initialSquadSize; i++) {
      spawnSoldierOrTank(-22 - i * 4.4);
    }

    // Dynamic Spawning Frequency scaled by Level Index (0..8), Phase Progression (0..2), and Live Wave (1..3)!
    const diffScaleGlobal = ((levelNumber - 1) * 3 + (phaseNumber - 1)) / 26;
    const getDynamicSpawnDelayMs = () => {
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
      if (isPausedForConceptRef.current || isGamePausedRef.current) return;
      const nowMs = performance.now();
      if (nowMs < nextDynamicSpawnAt) return;
      nextDynamicSpawnAt = nowMs + getDynamicSpawnDelayMs();

      const wave = getWaveNumber();
      const nonBossCount = activeSoldiersRef.current.filter((s) => !s.isBoss).length;
      const hasActiveBoss = activeSoldiersRef.current.some((s) => s.isBoss);
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
    // ============================================================================
    const debrisMeshPool: THREE.Mesh[] = [];
    for (let i = 0; i < 32; i++) {
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
      let mesh: THREE.Mesh | undefined;
      if (activeParticlesRef.current.length >= debrisMeshPool.length) {
        const oldest = activeParticlesRef.current.shift();
        if (oldest) mesh = oldest.mesh;
      }
      if (!mesh) {
        for (let i = 0; i < debrisMeshPool.length; i++) {
          if (!debrisMeshPool[i].visible) {
            mesh = debrisMeshPool[i];
            break;
          }
        }
      }
      if (!mesh) {
        const oldest = activeParticlesRef.current.shift();
        mesh = oldest ? oldest.mesh : debrisMeshPool[0];
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

    // Pre-allocated Shell Casing Pool (10 meshes)
    const shellMeshPool: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const sh = new THREE.Mesh(sharedShellGeo, sharedShellMat);
      sh.visible = false;
      scene.add(sh);
      shellMeshPool.push(sh);
    }

    // Pre-allocated Player/Allied Tracer Pool (12 groups)
    const playerTracerPool: THREE.Group[] = [];
    for (let i = 0; i < 12; i++) {
      const tr = createPlayerBulletTracerMesh(0x38bdf8);
      tr.visible = false;
      scene.add(tr);
      playerTracerPool.push(tr);
    }
    function acquirePlayerTracer(colorHex: number): THREE.Group {
      if (activePlayerTracersRef.current.length >= playerTracerPool.length) {
        const oldest = activePlayerTracersRef.current.shift();
        if (oldest) {
          setPlayerBulletTracerColor(oldest.mesh, colorHex);
          oldest.mesh.visible = true;
          return oldest.mesh;
        }
      }
      for (let i = 0; i < playerTracerPool.length; i++) {
        if (!playerTracerPool[i].visible) {
          const g = playerTracerPool[i];
          setPlayerBulletTracerColor(g, colorHex);
          g.visible = true;
          return g;
        }
      }
      const oldest = activePlayerTracersRef.current.shift();
      if (oldest) {
        setPlayerBulletTracerColor(oldest.mesh, colorHex);
        oldest.mesh.visible = true;
        return oldest.mesh;
      }
      const fallback = createPlayerBulletTracerMesh(colorHex);
      scene.add(fallback);
      playerTracerPool.push(fallback);
      return fallback;
    }

    // Pre-allocated Enemy Bullet & Heavy Tank Shell Pools (14 Spitzer bullets + 5 Tank shells)
    const enemyBulletPool: THREE.Group[] = [];
    const tankShellPool: THREE.Group[] = [];
    for (let i = 0; i < 14; i++) {
      const b = createEnemyBulletMesh(false);
      b.visible = false;
      scene.add(b);
      enemyBulletPool.push(b);
    }
    for (let i = 0; i < 5; i++) {
      const t = createEnemyBulletMesh(true);
      t.visible = false;
      scene.add(t);
      tankShellPool.push(t);
    }
    function acquireEnemyProjectileMesh(isHeavy: boolean): THREE.Group {
      const pool = isHeavy ? tankShellPool : enemyBulletPool;
      for (let i = 0; i < pool.length; i++) {
        if (!pool[i].visible) {
          pool[i].visible = true;
          return pool[i];
        }
      }
      const m = createEnemyBulletMesh(isHeavy);
      scene.add(m);
      pool.push(m);
      return m;
    }

    // Pre-allocated Boss Rocket Pool (4 guided missiles)
    const bossRocketPool: Array<{ group: THREE.Group; flame: THREE.Mesh }> = [];
    for (let i = 0; i < 4; i++) {
      const rk = createBossRocketMesh();
      rk.group.visible = false;
      scene.add(rk.group);
      bossRocketPool.push(rk);
    }
    function acquireBossRocketMesh(): { group: THREE.Group; flame: THREE.Mesh } {
      for (let i = 0; i < bossRocketPool.length; i++) {
        if (!bossRocketPool[i].group.visible) {
          bossRocketPool[i].group.visible = true;
          return bossRocketPool[i];
        }
      }
      const rk = createBossRocketMesh();
      scene.add(rk.group);
      bossRocketPool.push(rk);
      return rk;
    }

    // Pre-allocated Mortar Bomb Pool (3 mortar shells)
    const mortarBombPool: THREE.Group[] = [];
    for (let i = 0; i < 3; i++) {
      const mb = createMortarBombMesh();
      mb.visible = false;
      scene.add(mb);
      mortarBombPool.push(mb);
    }
    function acquireMortarBombMesh(): THREE.Group {
      for (let i = 0; i < mortarBombPool.length; i++) {
        if (!mortarBombPool[i].visible) {
          mortarBombPool[i].visible = true;
          return mortarBombPool[i];
        }
      }
      const mb = createMortarBombMesh();
      scene.add(mb);
      mortarBombPool.push(mb);
      return mb;
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
      const now = performance.now();
      const activeWpn = currentWeaponRef.current;
      if (now - lastShotTimeRef.current < activeWpn.fireRate) return;
      if (isReloadingRef.current) return;

      if (currentAmmoRef.current <= 0) {
        sounds.playDryFire();
        if (reserveAmmoRef.current > 0 && !isReloadingRef.current) {
          handleReloadRef.current?.();
        }
        return;
      }

      currentAmmoRef.current -= 1;
      setCurrentAmmo(currentAmmoRef.current);
      lastShotTimeRef.current = now;
      if (currentAmmoRef.current === 0 && reserveAmmoRef.current > 0) {
        setTimeout(() => {
          if (currentAmmoRef.current === 0 && !isReloadingRef.current) {
            handleReloadRef.current?.();
          }
        }, 180);
      }

      sounds.playShoot(activeWpn.category);

      recoilRef.current.z = isScopedRef.current ? 0.16 : 0.32;
      recoilRef.current.rotX = isScopedRef.current ? 0.09 : 0.18;
      cameraShakeRef.current = Math.max(
        cameraShakeRef.current,
        activeWpn.category === 'SHOTGUN' ? 0.35 : isScopedRef.current ? 0.1 : 0.18
      );

      // Animate SPAS-12 Pump Shotgun Forend Slide on shot!
      if (activeWpn.category === 'SHOTGUN' && pumpSlideRef.current) {
        pumpSlideRef.current.position.z = -0.32;
        setTimeout(() => {
          if (pumpSlideRef.current) pumpSlideRef.current.position.z = -0.45;
        }, 220);
      }

      if (muzzleFlashRef.current) {
        muzzleFlashRef.current.intensity = 5.2;
        if (visionModeRef.current === 'nvg') {
          muzzleFlashRef.current.color.setHex(0x22c55e);
        } else if (visionModeRef.current === 'thermal') {
          muzzleFlashRef.current.color.setHex(0xffffff);
        } else {
          muzzleFlashRef.current.color.setHex(0x38bdf8);
        }
      }

      if (muzzleSpriteRef.current) {
        (muzzleSpriteRef.current.material as THREE.MeshBasicMaterial).opacity = 0.95;
        muzzleSpriteRef.current.rotation.z = Math.random() * Math.PI * 2;
      }

      // Eject 3D Brass Bullet Shell Casing from pre-allocated shellMeshPool
      let shell: THREE.Mesh | undefined;
      if (activeShellsRef.current.length >= shellMeshPool.length) {
        const oldShell = activeShellsRef.current.shift();
        if (oldShell) shell = oldShell.mesh;
      }
      if (!shell) {
        for (let i = 0; i < shellMeshPool.length; i++) {
          if (!shellMeshPool[i].visible) {
            shell = shellMeshPool[i];
            break;
          }
        }
      }
      if (!shell) {
        const oldShell = activeShellsRef.current.shift();
        shell = oldShell ? oldShell.mesh : shellMeshPool[0];
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

      // 1:1 True Crosshair Aim Vector (when scoped, center reticle is (0, 0); in hipfire, exact crosshair NDC)
      if (isScopedRef.current) {
        hitVector.set(0, 0);
      } else {
        hitVector.set(aimPosRef.current.x, aimPosRef.current.y);
      }

      // Save the player's true unassisted aim point BEFORE any auto-aim torso nudge!
      // Headshots are ONLY awarded if the player's true unassisted aim is on the head!
      const rawAimX = hitVector.x;
      const rawAimY = hitVector.y;

      const soldiers = activeSoldiersRef.current;

      // If AUTO-AIM is enabled, gently nudge shot vector PARTWAY closer toward nearest enemy's TORSO/CHEST (NEVER the head!)
      if (autoAimEnabledRef.current && soldiers.length > 0) {
        let bestDist = 0.36;
        let lockedBodyNdcX = 0;
        let lockedBodyNdcY = 0;
        let hasLock = false;
        for (let i = 0; i < soldiers.length; i++) {
          const s = soldiers[i];
          if (s.mesh.position.z >= -2) continue;

          // Project ONLY Enemy Torso / Center-of-Mass (never snap to head!)
          const bodyYOffset = s.isRobot ? 1.85 : s.isTank ? 0.35 : 0.18;
          _v2.copy(s.mesh.position);
          _v2.y += bodyYOffset;
          _v2.project(camera);
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
          // Soft 42% pull toward torso center-of-mass so auto-aim helps you move closer to the enemy without playing for you or auto-headshotting!
          hitVector.set(
            THREE.MathUtils.lerp(hitVector.x, lockedBodyNdcX, 0.42),
            THREE.MathUtils.lerp(hitVector.y, lockedBodyNdcY, 0.42)
          );
        }
      }

      raycaster.setFromCamera(hitVector, camera);

      // Spawn a visible 3D Pointed Spitzer Bullet Projectile from playerTracerPool!
      {
        _v1.set(
          playerPosRef.current.x + (isScopedRef.current ? 0.0 : 0.28),
          isScopedRef.current ? -0.18 : -0.22,
          playerPosRef.current.z - 0.85
        );
        _v2.copy(raycaster.ray.direction).multiplyScalar(42).add(_v1);
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
          vx: raycaster.ray.direction.x * pSpeed,
          vy: raycaster.ray.direction.y * pSpeed,
          vz: raycaster.ray.direction.z * pSpeed,
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

      for (let i = soldiers.length - 1; i >= 0; i--) {
        const soldier = soldiers[i];
        if (soldier.mesh.position.z >= -2) continue;

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
        // Measure headshot precision strictly against the player's TRUE unassisted aim (rawAimX, rawAimY)!
        const rawHeadNdcDist = Math.hypot(_v1.x - rawAimX, _v1.y - rawAimY);
        const headNdcY = _v1.y;

        _v2.copy(soldier.mesh.position);
        _v2.y += bodyYOffset;
        const distSqBody3D = raycaster.ray.distanceSqToPoint(_v2);
        _v2.project(camera);
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
          soldier.mesh.position.z -= soldier.isTank ? 0.35 : soldier.isBoss ? 0.25 : 0.5;
          break;
        }

        // 2. General Body Hit (Soldiers, Tanks, Bosses) via analytical 3D ray-sphere check
        const bodyRadiusSq = soldier.isRobot
          ? 4.8
          : soldier.isTank
          ? 1.65
          : soldier.isBoss
          ? 2.35
          : 0.85;
        if (distSqBody3D <= bodyRadiusSq) {
          hitRegistered = true;
          hitSoldier = soldier;
          totalDamage = baseNormalShotDamage;
          soldier.hp -= totalDamage;
          soldier.mesh.position.z -= soldier.isTank ? 0.14 : soldier.isBoss ? 0.1 : 0.2;
          break;
        }
      }

      // 2D Hitbox & Assist Check: clean, responsive body hitboxes for both Manual Aim and Auto-Aim (never grants free headshots!)
      if (!hitRegistered) {
        for (let i = soldiers.length - 1; i >= 0; i--) {
          const soldier = soldiers[i];
          if (soldier.mesh.position.z >= -2) continue;

          const bodyYOffset = soldier.isRobot ? 1.85 : soldier.isTank ? 0.35 : 0.18;
          _v2.copy(soldier.mesh.position);
          _v2.y += bodyYOffset;
          _v2.project(camera);
          const distBody2D = Math.hypot(_v2.x - hitVector.x, _v2.y - hitVector.y);

          const assistRadius = autoAimEnabledRef.current
            ? soldier.isRobot
              ? 0.42
              : soldier.isTank
              ? 0.28
              : soldier.isBoss
              ? 0.32
              : 0.19
            : soldier.isRobot
            ? 0.34
            : soldier.isTank
            ? 0.21
            : soldier.isBoss
            ? 0.24
            : 0.145;
          if (distBody2D < assistRadius) {
            hitRegistered = true;
            hitSoldier = soldier;
            criticalHit = false;
            totalDamage = baseNormalShotDamage;
            soldier.hp -= totalDamage;
            soldier.mesh.position.z -= soldier.isTank ? 0.14 : soldier.isBoss ? 0.1 : 0.2;
            break;
          }
        }
      }

      if (hitRegistered && hitSoldier) {
        sounds.playHitmarker(criticalHit);

        // Spawn Fortnite-Style Floating Damage Number + HEADSHOT! banner at exact 3D impact projection!
        const markerId = now + Math.random();
        const isArmoredTarget = Boolean(
          hitSoldier.type === 'tank' || hitSoldier.isHelicopter || hitSoldier.isRobot || hitSoldier.isJet
        );
        const scatterX = Math.round((Math.random() - 0.5) * 34);
        const scatterY = Math.round((Math.random() - 0.5) * 18);
        setHitmarkers((prev) => [
          ...prev.slice(-9),
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
          setHitmarkers((prev) => prev.filter((m) => m.id !== markerId));
        }, 750);

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
          triggerExplosion(hitSoldier.mesh.position);
          releaseSoldierToPool(hitSoldier);
          const sIdx = soldiers.indexOf(hitSoldier);
          if (sIdx !== -1) soldiers.splice(sIdx, 1);
        }

        if (eliminatedSoldier) {
          sounds.playKillConfirm();
          killsRef.current += 1;
          comboStreakRef.current += 1;
          const points = eliminatedSoldier.value * (criticalHit ? 2 : 1);
          scoreRef.current += points;

          setKills(killsRef.current);
          setComboStreak(comboStreakRef.current);
          setScore(scoreRef.current);

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
      }
    }

    executeShotRef.current = executeShot;

    // Cached container rect avoids synchronous layout reflows on every touchmove/mousemove event!
    let cachedRect = container.getBoundingClientRect();

    // Professional FPS Aiming (Fortnite / Black Ops style):
    // 1:1 NDC alignment (no 1.15x distortion) + smooth relative drag when scoped or touch-dragging!
    const updateAimPosition = (clientX: number, clientY: number, isRelativeDrag: boolean = false, prevX?: number, prevY?: number) => {
      if (cachedRect.width === 0 || cachedRect.height === 0) {
        cachedRect = container.getBoundingClientRect();
      }
      const w = cachedRect.width || window.innerWidth;
      const h = cachedRect.height || window.innerHeight;

      if (isScopedRef.current && isRelativeDrag && prevX !== undefined && prevY !== undefined) {
        // When Scoped (ADS), dragging smoothly pans the camera optic with precision ADS sensitivity
        const dxNorm = ((clientX - prevX) / w) * 2;
        const dyNorm = -((clientY - prevY) / h) * 2;
        const adsSens = currentWeaponRef.current.category === 'SNIPER' ? 0.28 : 0.42;
        baseAimYawRef.current = THREE.MathUtils.clamp(baseAimYawRef.current - dxNorm * adsSens, -0.58, 0.58);
        baseAimPitchRef.current = THREE.MathUtils.clamp(baseAimPitchRef.current + dyNorm * adsSens, -0.40, 0.40);
        targetAimPosRef.current.x = 0;
        targetAimPosRef.current.y = 0;
        aimPosRef.current.x = 0;
        aimPosRef.current.y = 0;
        syncCrosshairDom(0, 0);
        return;
      }

      if (isRelativeDrag && prevX !== undefined && prevY !== undefined) {
        // Smooth touch-drag aiming in hipfire (combines responsive thumb delta with subtle target slowdown)
        const dxNorm = ((clientX - prevX) / w) * 2 * 1.15;
        const dyNorm = -((clientY - prevY) / h) * 2 * 1.15;
        targetAimPosRef.current.x = Math.max(-0.94, Math.min(0.94, targetAimPosRef.current.x + dxNorm));
        targetAimPosRef.current.y = Math.max(-0.90, Math.min(0.90, targetAimPosRef.current.y + dyNorm));
      } else {
        // True 1:1 cursor-to-crosshair NDC mapping (zero 1.15x overshoot!)
        const x = ((clientX - cachedRect.left) / w) * 2 - 1;
        const y = -((clientY - cachedRect.top) / h) * 2 + 1;
        targetAimPosRef.current.x = Math.max(-0.94, Math.min(0.94, x));
        targetAimPosRef.current.y = Math.max(-0.90, Math.min(0.90, y));
        // On desktop mouse move while scoped, smoothly steer the optic across the battlefield
        if (isScopedRef.current) {
          const adsYawSpan = currentWeaponRef.current.category === 'SNIPER' ? 0.34 : 0.46;
          const adsPitchSpan = currentWeaponRef.current.category === 'SNIPER' ? 0.26 : 0.36;
          baseAimYawRef.current = THREE.MathUtils.clamp(-targetAimPosRef.current.x * adsYawSpan, -0.58, 0.58);
          baseAimPitchRef.current = THREE.MathUtils.clamp(targetAimPosRef.current.y * adsPitchSpan, -0.40, 0.40);
        }
      }

      syncCrosshairDom(targetAimPosRef.current.x, targetAimPosRef.current.y);
    };

    // Dedicated Multi-Touch Handlers for Phone (Allows simultaneous Moving & Hold-Shoot Scoping!)
    const handleTouchStart = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault(); // Prevents mobile OS long-press magnifying glass ("zooming lens")!
      sounds.unlockAudio();
      cachedRect = container.getBoundingClientRect();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const clientX = touch.clientX;
        const clientY = touch.clientY;

        // If touch begins in bottom-left movement zone (left 45%, bottom 55%)
        if (
          movementTouchIdRef.current === null &&
          clientX - cachedRect.left < cachedRect.width * 0.45 &&
          clientY - cachedRect.top > cachedRect.height * 0.45
        ) {
          movementTouchIdRef.current = touch.identifier;
          joystickCenterRef.current = { x: clientX, y: clientY };
          joystickOffsetRef.current = { x: 0, y: 0 };
          setJoystickDisplay({ x: clientX, y: clientY });
          sounds.triggerHaptic(10, 'light');
        } else if (firingTouchIdRef.current === null) {
          // Hold Touch in Aim/Shoot Zone: tap aims smoothly & fires, hold for 2s deploys tactical scope!
          firingTouchIdRef.current = touch.identifier;
          lastFiringTouchPosRef.current = { x: clientX, y: clientY };
          isPointerDownRef.current = true;
          startHoldShootScopeTimer();
          if (!isScopedRef.current) {
            updateAimPosition(clientX, clientY, false);
            aimPosRef.current.x = targetAimPosRef.current.x;
            aimPosRef.current.y = targetAimPosRef.current.y;
          }
          executeShot();
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === movementTouchIdRef.current && joystickCenterRef.current) {
          const dx = touch.clientX - joystickCenterRef.current.x;
          const dy = touch.clientY - joystickCenterRef.current.y;
          const dist = Math.hypot(dx, dy);
          const maxDist = 45;
          const clampedX = dist > 0 ? (dx / Math.max(dist, maxDist)) * Math.min(dist, maxDist) : 0;
          const clampedY = dist > 0 ? (dy / Math.max(dist, maxDist)) * Math.min(dist, maxDist) : 0;
          joystickOffsetRef.current = { x: clampedX, y: clampedY };
          if (joystickKnobDomRef.current) {
            joystickKnobDomRef.current.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
          }
          moveInputRef.current.x = clampedX / maxDist;
          moveInputRef.current.z = clampedY / maxDist;
        } else if (touch.identifier === firingTouchIdRef.current) {
          const prevX = lastFiringTouchPosRef.current.x;
          const prevY = lastFiringTouchPosRef.current.y;
          lastFiringTouchPosRef.current = { x: touch.clientX, y: touch.clientY };
          updateAimPosition(touch.clientX, touch.clientY, true, prevX, prevY);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === movementTouchIdRef.current) {
          movementTouchIdRef.current = null;
          joystickCenterRef.current = null;
          joystickOffsetRef.current = { x: 0, y: 0 };
          setJoystickDisplay(null);
          moveInputRef.current.x = 0;
          moveInputRef.current.z = 0;
        }
        if (touch.identifier === firingTouchIdRef.current) {
          firingTouchIdRef.current = null;
          isPointerDownRef.current = false;
          setIsFiring(false);
          cancelHoldShootScope();
        }
      }
    };

    // Desktop Mouse Handlers (Hold Left-Click 2s deploys optic sight, Right-Click locks optic!)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleMouseDown = (e: MouseEvent) => {
      sounds.unlockAudio();
      setAudioSuspended(false);
      lastMouseClientPosRef.current = { x: e.clientX, y: e.clientY };
      if (e.button === 2) {
        e.preventDefault();
        handleToggleScope();
        return;
      }
      isPointerDownRef.current = true;
      setIsFiring(true);
      startHoldShootScopeTimer();
      updateAimPosition(e.clientX, e.clientY, false);
      if (!isScopedRef.current) {
        aimPosRef.current.x = targetAimPosRef.current.x;
        aimPosRef.current.y = targetAimPosRef.current.y;
      }
      executeShot();
    };

    const handleMouseMove = (e: MouseEvent) => {
      lastMouseClientPosRef.current = { x: e.clientX, y: e.clientY };
      updateAimPosition(e.clientX, e.clientY, false);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) return;
      isPointerDownRef.current = false;
      setIsFiring(false);
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
      keysDownRef.current[e.key.toLowerCase()] = true;

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        sounds.unlockAudio();
        sounds.triggerHaptic(14, 'medium');
        setIsGamePaused((prev) => !prev);
      } else if (e.key === '1') {
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
      } else if (e.key === 't' || e.key === 'T') {
        handleAirdropReinforcementsRef.current ? handleAirdropReinforcementsRef.current() : handleAirdropReinforcements();
      } else if (e.key === 'n' || e.key === 'N' || e.key === 'v' || e.key === 'V') {
        handleToggleVisionMode();
      } else if (e.key === 'm' || e.key === 'M') {
        handleSoundToggle();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDownRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

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
    let lastDamageTakenTime = 0;
    let regenAccumulator = 0;
    let lastCoverState = false;
    let lastCoverHp = 100;
    let lastTargetLockedState = false;
    let lastHudSyncTime = 0;
    let prevPlayerX = 0;
    let smoothedPlayerVelX = 0;

    // Helper: Trigger Dynamic Screen Shake, Haptics & Directional Damage HUD Indicator (scales up as HP lowers!)
    const triggerDirectionalDamageFeedback = (
      sourceX: number,
      sourceZ: number,
      damageAmount: number,
      sourceType: DirectionalDamageIndicator['sourceType'],
      isSplash: boolean
    ) => {
      sounds.triggerHaptic([45, 25, 50], 'heavy');
      const currentHp = Math.max(0, playerHpRef.current);
      // Missing HP multiplier: 1.0x at full health up to 2.25x at critical low HP (< 20%)
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

      // Directional roll impulse based on which side the blast came from
      const relX = sourceX - playerPosRef.current.x;
      const relZ = sourceZ - playerPosRef.current.z;
      const sideSign = relX < -0.25 ? -1 : relX > 0.25 ? 1 : (Math.random() < 0.5 ? -1 : 1);
      cameraRollShakeRef.current = sideSign * shakePower * 0.085;

      // Compute angle in degrees relative to forward (-Z is 0 deg, -X is -45 deg, +X is +45 deg)
      const rawAngleDeg = Math.atan2(relX, Math.max(1.5, -relZ)) * (180 / Math.PI);
      const clampedAngleDeg = Math.max(-78, Math.min(78, rawAngleDeg * 1.65));
      const sector: 'left' | 'center' | 'right' =
        relX < -0.75 ? 'left' : relX > 0.75 ? 'right' : 'center';

      // Intensity scales with both the blast severity and how low the player's HP is
      const intensity = Math.min(
        1.0,
        0.42 + ((100 - currentHp) / 100) * 0.48 + (isSplash ? 0.15 : 0.08)
      );

      const indId = nextDamageIndicatorIdRef.current++;
      setDamageIndicators((prev) => [
        ...prev.slice(-3),
        {
          id: indId,
          angleDeg: Math.round(clampedAngleDeg),
          sector,
          sourceType,
          intensity,
          isSplash,
        },
      ]);

      setTimeout(() => {
        setDamageIndicators((prev) => prev.filter((item) => item.id !== indId));
      }, 1350);
    };

    function animate() {
      const nowTime = performance.now();
      // Freeze 3D simulation & timer delta when paused for a Concept Popup or User Pause Menu!
      if (isPausedForConceptRef.current || isGamePausedRef.current) {
        lastFrameTime = nowTime;
        if (!renderedPausedFrameRef.current) {
          renderedPausedFrameRef.current = true;
          renderer.render(scene, camera);
        }
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      const delta = Math.min(Math.max(0.001, (nowTime - lastFrameTime) / 1000), 0.05);
      lastFrameTime = nowTime;
      elapsedAccumulator += delta;
      const elapsed = elapsedAccumulator;

      // Continuous fire while holding Shoot (executeShot internally enforces each weapon's fireRate cooldown)
      if (isPointerDownRef.current) {
        executeShot();
      }

      // 1. UPDATE PLAYER 3D POSITION (Left/Right & Front/Back Movement)
      let inputX = moveInputRef.current.x;
      let inputZ = moveInputRef.current.z;

      // Keyboard WASD input
      if (keysDownRef.current['a'] || keysDownRef.current['arrowleft']) inputX -= 1;
      if (keysDownRef.current['d'] || keysDownRef.current['arrowright']) inputX += 1;
      if (keysDownRef.current['w'] || keysDownRef.current['arrowup']) inputZ -= 1;
      if (keysDownRef.current['s'] || keysDownRef.current['arrowdown']) inputZ += 1;

      const moveSpeed = isScopedRef.current ? 4.4 : 6.2;
      playerPosRef.current.x += inputX * moveSpeed * delta;
      playerPosRef.current.z += inputZ * moveSpeed * delta;

      // Clamp movement within organ tunnel boundaries (generous forward/backward & lateral range)
      playerPosRef.current.x = Math.max(-3.5, Math.min(3.5, playerPosRef.current.x));
      playerPosRef.current.z = Math.max(-2.6, Math.min(2.0, playerPosRef.current.z));

      // Track smoothed lateral player velocity so Enemy AI can predictively lead shots!
      const instVelX = (playerPosRef.current.x - prevPlayerX) / Math.max(0.008, delta);
      prevPlayerX = playerPosRef.current.x;
      smoothedPlayerVelX = THREE.MathUtils.damp(smoothedPlayerVelX, instVelX, 8, delta);

      // 2. UPDATE CAMERA, DYNAMIC HP-SCALED SCREEN SHAKE, SIGHT SCOPE ZOOM (ADS) & RESPONSIVE PITCH/YAW AIMING
      const shakeAmt = cameraShakeRef.current;
      const shakeX =
        shakeAmt > 0.005
          ? (Math.sin(elapsed * 58) * 0.65 + (Math.random() - 0.5) * 0.75) * shakeAmt
          : 0;
      const shakeY =
        shakeAmt > 0.005
          ? (Math.cos(elapsed * 64) * 0.65 + (Math.random() - 0.5) * 0.75) * shakeAmt
          : 0;

      camera.position.x = playerPosRef.current.x + shakeX;
      camera.position.y = shakeY;
      camera.position.z = playerPosRef.current.z;

      // Smoothly zoom camera FOV when Black Ops Sight Scope (ADS) is engaged!
      const targetFov = isScopedRef.current
        ? currentWeaponRef.current.category === 'SNIPER'
          ? 24
          : currentWeaponRef.current.category === 'SHOTGUN'
          ? 65
          : 40
        : 65;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 18, delta);
        camera.updateProjectionMatrix();
      }

      // Soft Continuous Auto-Aim Pull (Fortnite / Black Ops Aim Assist):
      // Gently guides aim closer toward the nearest enemy's TORSO/CHEST (never the head!)
      if (autoAimEnabledRef.current && activeSoldiersRef.current.length > 0) {
        let closestDist = 0.34;
        let pullTargetX = 0;
        let pullTargetY = 0;
        let foundAssistTarget = false;
        const curAimX = isScopedRef.current ? 0 : targetAimPosRef.current.x;
        const curAimY = isScopedRef.current ? 0 : targetAimPosRef.current.y;

        for (let i = 0; i < activeSoldiersRef.current.length; i++) {
          const s = activeSoldiersRef.current[i];
          if (s.mesh.position.z >= -2.5) continue;
          const bodyYOffset = s.isRobot ? 1.85 : s.isTank ? 0.35 : 0.18;
          _v1.copy(s.mesh.position);
          _v1.y += bodyYOffset;
          _v1.project(camera);
          if (_v1.z >= 1) continue;
          const d = Math.hypot(_v1.x - curAimX, _v1.y - curAimY);
          if (d < closestDist && d > 0.025) {
            closestDist = d;
            pullTargetX = _v1.x;
            pullTargetY = _v1.y;
            foundAssistTarget = true;
          }
        }

        if (foundAssistTarget) {
          if (isScopedRef.current) {
            // In ADS, gently nudge camera yaw/pitch toward enemy torso
            baseAimYawRef.current = THREE.MathUtils.clamp(
              baseAimYawRef.current - pullTargetX * delta * 1.15,
              -0.58,
              0.58
            );
            baseAimPitchRef.current = THREE.MathUtils.clamp(
              baseAimPitchRef.current + pullTargetY * delta * 0.95,
              -0.40,
              0.40
            );
          } else {
            // In Hipfire, gently pull crosshair partway toward enemy torso
            targetAimPosRef.current.x = THREE.MathUtils.damp(
              targetAimPosRef.current.x,
              pullTargetX,
              2.6,
              delta
            );
            targetAimPosRef.current.y = THREE.MathUtils.damp(
              targetAimPosRef.current.y,
              pullTargetY,
              2.6,
              delta
            );
            syncCrosshairDom(targetAimPosRef.current.x, targetAimPosRef.current.y);
          }
        }
      }

      // High-frequency 60 FPS sub-pixel aim interpolation (buttery smooth manual & assisted aiming!)
      aimPosRef.current.x = THREE.MathUtils.damp(aimPosRef.current.x, targetAimPosRef.current.x, 30, delta);
      aimPosRef.current.y = THREE.MathUtils.damp(aimPosRef.current.y, targetAimPosRef.current.y, 30, delta);

      // Responsive pitch (up/down aim) & yaw (left/right aim) with horizon stabilization
      cameraRollShakeRef.current = THREE.MathUtils.damp(cameraRollShakeRef.current, 0, 12, delta);
      const targetRoll = -inputX * 0.03 + cameraRollShakeRef.current;
      // In Hipfire, keep camera parallax subtle (0.07) so the 3D world never swims away from under your crosshair!
      const pitchFactor = isScopedRef.current ? 0.0 : 0.07;
      const yawFactor = isScopedRef.current ? 0.0 : 0.07;
      const targetYaw = -playerPosRef.current.x * 0.018 - aimPosRef.current.x * yawFactor + baseAimYawRef.current;
      const targetPitch = aimPosRef.current.y * pitchFactor + baseAimPitchRef.current + Math.abs(cameraRollShakeRef.current) * 0.25;
      const camDamp = isScopedRef.current ? 24 : 18;
      camera.rotation.z = THREE.MathUtils.damp(camera.rotation.z, targetRoll, 14, delta);
      camera.rotation.y = THREE.MathUtils.damp(camera.rotation.y, targetYaw, camDamp, delta);
      camera.rotation.x = THREE.MathUtils.damp(camera.rotation.x, targetPitch, camDamp, delta);

      if (cameraShakeRef.current > 0.005) {
        cameraShakeRef.current *= 0.87;
      } else {
        cameraShakeRef.current = 0;
      }

      // Strictly ONE Boss Per Phase (Phase 1: Helicopter, Phase 2: Cyber-Robot, Phase 3: F-16 Jet)
      const phaseBossType: 'helicopter' | 'robot' | 'jet' =
        phaseNumber === 1 ? 'helicopter' : phaseNumber === 2 ? 'robot' : 'jet';

      if (timeLeftRef.current <= 38 && !bossSpawnedRef.current[phaseBossType]) {
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

        // Check proximity contact fuse against any enemy soldier, Bio-Tank, or Boss
        const soldiers = activeSoldiersRef.current;
        let hitEnemyInFlight = false;
        for (let j = 0; j < soldiers.length; j++) {
          const s = soldiers[j];
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

          // AOE Frag Shrapnel Damage to all enemies, tanks & bosses within 10.5-unit blast radius!
          const gPos = g.mesh.position;
          let hitCount = 0;
          let killCount = 0;
          for (let j = soldiers.length - 1; j >= 0; j--) {
            const s = soldiers[j];
            // Use horizontal distance so hovering Bosses (Helicopter/Jet) and tall Tanks take full blast damage
            const horizDist = Math.hypot(s.mesh.position.x - gPos.x, s.mesh.position.z - gPos.z);
            if (horizDist < 10.5) {
              hitCount++;
              const falloff = horizDist < 5.0 ? 1.0 : 0.7;
              const fragHpDmg = Math.round(360 * falloff);
              const fragHitsDmg = horizDist < 5.0 ? 4 : 3;
              s.hp -= fragHpDmg;
              s.hitsLeft = Math.max(0, s.hitsLeft - fragHitsDmg);
              if (!s.isHelicopter && !s.isRobot && !s.isJet) {
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
                triggerExplosion(s.mesh.position);
                releaseSoldierToPool(s);
                activeSoldiersRef.current.splice(j, 1);
                if (s.isHelicopter || s.isRobot || s.isJet) {
                  setBossInfo(null);
                  setBossDefeatedBanner(true);
                }
                sounds.playKillConfirm();
                killsRef.current += 1;
                scoreRef.current += s.value + 150;
                setKills(killsRef.current);
                setScore(scoreRef.current);
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
          particles.splice(i, 1);
        }
      }

      // Scroll organ tunnel
      wallTexture.offset.y -= delta * 0.14;

      // 2b. ANIMATE 3D ORGAN ENVIRONMENT PROPS (Realistic 360° Metachronal Beating Cilia, Smoothly Moving Mucus on All Walls, Smooth Muscle, Acid/Bile & Synapses!)
      if (organEnvPropsRef.current) {
        const env = organEnvPropsRef.current;
        env.ciliaList.forEach((c) => {
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
        });
        env.flowingBlobs.forEach((b) => {
          b.mesh.position.z += b.speed * delta;
          const ciliaryLift = Math.sin(elapsed * 5.8 - b.mesh.position.z * 0.42 + b.phase) * 0.14;
          b.mesh.position.x = b.baseX - Math.cos(b.angle) * ciliaryLift;
          b.mesh.position.y = b.baseY - Math.sin(b.angle) * ciliaryLift;
          if (b.mesh.position.z > 2.5) {
            b.mesh.position.z = -59.5;
          }
        });
        env.muscleRings.forEach((ring, rIdx) => {
          const squeeze = 1 + Math.sin(elapsed * 3.2 + rIdx * 0.85) * 0.055;
          const baseSx = ring.userData.sx || 1;
          const baseSy = ring.userData.sy || 1;
          ring.scale.set(baseSx * squeeze, baseSy * squeeze, 1);
        });
        if (env.roadSigns) {
          // Sparse Road Signs (only 2 per loop, spaced 44m apart)
          const moveBoost = Math.abs(inputX) * 1.4 + Math.max(0, -inputZ * 4.2) + Math.max(0, inputZ * 1.2);
          env.roadSigns.forEach((sign) => {
            sign.mesh.position.z += (sign.speed + moveBoost) * delta;
            if (sign.mesh.position.z > 2.8) {
              sign.mesh.position.z = -86;
            }
          });
        }
        if (env.landmarks) {
          // Animate 3D Side Landmarks: Fibrinogen Fountain (pulsing golden streams) & Thromboglobin Tower (rotating prothrombin dish)
          const moveBoost = Math.abs(inputX) * 1.4 + Math.max(0, -inputZ * 4.2);
          env.landmarks.forEach((lm) => {
            lm.mesh.position.z += (lm.speed + moveBoost) * delta;
            if (lm.rotor) {
              lm.rotor.rotation.y += delta * 2.6;
            }
            if (lm.streams) {
              const pulse = 0.92 + Math.sin(elapsed * 6.5) * 0.12;
              lm.streams.forEach((st, sIdx) => {
                st.scale.set(1, pulse + Math.sin(elapsed * 8 + sIdx) * 0.08, 1);
              });
            }
            if (lm.mesh.position.z > 3.5) {
              lm.mesh.position.z = -86;
            }
            // Also show landmark on the passing ticker when right next to the player
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
          });
        }
      }

      // 3. ANIMATE THEME-SPECIFIC PANICKING CELLS (RBCs, Goblet Cells, Gastric/Villi Cells, Neurones in visible flank lanes)
      panickingRbcsRef.current.forEach((rbc) => {
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
      });

      // 3b. ANIMATE VISIBLE PANICKING PLATELETS (Waving little arms & asking for help along the lower flanks!)
      panickingPlateletsRef.current.forEach((plt) => {
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
      });

      // 3b-bis. RANDOM SCENES OF PLATELETS & PANICKING CELLS HIDING BEHIND SANDBAG BARRICADES THEN LEAVING (Zero-allocation pooled meshes!)
      if (elapsed >= nextRefugeeSceneTimeRef.current) {
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
              const helpMsg = sounds.speakCellHelpCry(organThemeRef.current.id, refCell.isPlatelet);
              setCellDistressBanner(helpMsg);
              setTimeout(() => {
                setCellDistressBanner((prev) => (prev === helpMsg ? null : prev));
              }, 3400);
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

        const distZ = Math.abs(playerPosRef.current.z - _v1.z);
        const flightTime = distZ / Math.max(10, bulletSpeed);
        const leadFactor = soldier.isTank || soldier.isBoss ? 0.55 : soldier.type === 'bacillus' ? 0.42 : 0.25;
        const spread = soldier.isTank ? 0.18 : 0.26;
        const aimX = Math.max(
          -3.4,
          Math.min(
            3.4,
            playerPosRef.current.x + smoothedPlayerVelX * flightTime * leadFactor + (Math.random() - 0.5) * spread
          )
        );

        _v2.set(aimX, -0.15, playerPosRef.current.z);
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
            ((soldier.dodgeTargetX || 0) - (soldier.dodgeOffsetX || 0)) * 0.15;
          soldier.mesh.rotation.x = 0.22;

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
        } else if (soldier.isJet) {
          soldier.mesh.position.z += soldier.speed * delta;
          const baseJetX = Math.sin(elapsed * 1.5 + soldier.walkOffset) * 2.0 + (soldier.dodgeOffsetX || 0);
          soldier.mesh.position.x = Math.max(-3.6, Math.min(3.6, baseJetX));
          soldier.mesh.position.y = 1.25 + Math.sin(elapsed * 2.2) * 0.24 + (soldier.dodgeOffsetY || 0);
          soldier.mesh.rotation.z =
            Math.sin(elapsed * 2.4) * 0.25 -
            ((soldier.dodgeTargetX || 0) - (soldier.dodgeOffsetX || 0)) * 0.22;
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
          }
          soldier.mesh.rotation.x = soldier.hullRock || 0;

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
          // IMPROVED TACTICAL BACTERIA SOLDIER AI:
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
            // Choose a flanking lane on the opposite side of the player's current position to establish crossfire
            if (soldier.flankTargetX === undefined) {
              const flankSign = soldier.id % 2 === 0 ? -1 : 1;
              soldier.flankTargetX = Math.max(
                -3.3,
                Math.min(3.3, -playerPosRef.current.x * 0.55 + flankSign * (1.35 + (soldier.id % 3) * 0.65))
              );
            }

            // Reactive Evasive Sidestep Juke when player aims at this soldier!
            if (isUnderPlayerAim && (soldier.evadeCooldown ?? 0) <= 0 && soldier.mesh.position.z > -32) {
              soldier.evadeCooldown = 2.4;
              const jukeDir = soldier.mesh.position.x > 0 ? -1 : 1;
              soldier.flankTargetX = Math.max(-3.3, Math.min(3.3, soldier.mesh.position.x + jukeDir * 1.65));
              if (soldier.mesh.position.z > -26 && Math.random() < 0.55) {
                soldier.stanceState = 'crouching';
                soldier.stanceTimer = 0.25;
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
            const lateralSteer = THREE.MathUtils.clamp(lateralGoal - soldier.mesh.position.x, -1.8, 1.8);
            soldier.mesh.position.x +=
              (lateralSteer * 1.15 + Math.sin(elapsed * 3.5 + soldier.walkOffset) * 0.95) * delta;
            soldier.mesh.position.x = Math.max(-3.5, Math.min(3.5, soldier.mesh.position.x));
            soldier.mesh.position.y = THREE.MathUtils.damp(
              soldier.mesh.position.y,
              Math.abs(runCycle) * 0.06,
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
              const sideShift = (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 1.2);
              soldier.flankTargetX = Math.max(-3.3, Math.min(3.3, soldier.mesh.position.x + sideShift));
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
          setComboStreak(0);
          setOperatorMood('hit');
          setTimeout(() => setOperatorMood('normal'), 400);
          sounds.playQuizWrong();

          if (playerHpRef.current <= 0) {
            onPhaseDefeat(scoreRef.current, killsRef.current);
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
            setBarricadeHps(barricadesRef.current.map((b) => Math.round((b.hp / b.maxHp) * 100)));
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
          const shatterCenter = new THREE.Vector3(bar.x, bar.y + 0.15, bar.z);
          triggerExplosion(shatterCenter);
          triggerBarricadeShatter(shatterCenter);
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
          setPlayerHp(playerHpRef.current);
          setOperatorMood('hit');
          triggerDirectionalDamageFeedback(bar.x, bar.z, splashDamage, sourceType, true);
          setTimeout(() => setOperatorMood('normal'), 450);
          if (playerHpRef.current <= 0) {
            onPhaseDefeat(scoreRef.current, killsRef.current);
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
        for (const bar of barricadesRef.current) {
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
            rockets.splice(i, 1);
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
              setPlayerHp(playerHpRef.current);
              setOperatorMood('hit');
              triggerDirectionalDamageFeedback(
                r.mesh.position.x,
                r.mesh.position.z - 4,
                r.damage,
                'BOSS MISSILE',
                false
              );
              setTimeout(() => setOperatorMood('normal'), 450);
              if (playerHpRef.current <= 0) {
                onPhaseDefeat(scoreRef.current, killsRef.current);
              }
            }
            r.mesh.visible = false;
            rockets.splice(i, 1);
            continue;
          }
        }

        if (r.mesh.position.z > playerPosRef.current.z + 3.5 || r.life <= 0) {
          r.mesh.visible = false;
          rockets.splice(i, 1);
        }
      }

      // 4c-bis. BLÉRIOT WW2 PLANE MORTAR BOMBING RUNS ON BARRICADES (2 in Phase 1, 3 in Phase 2, 4 in Phase 3)
      bleriotScheduleRef.current.forEach((sched) => {
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
          activeBleriotRunsRef.current.splice(i, 1);
        }
      }

      // Animate Falling Mortar Shells & Detonate on Target Barricade with Splash Damage (Less than Barricade Destruction!)
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
          activeMortarBombsRef.current.splice(i, 1);
        }
      }

      // 4c-ter. ENEMY TROOP AIRDROP (1 Tank + 2 Flanking Soldiers: 1 drop in Phase 1, 2 in Phase 2, 3 in Phase 3!)
      enemyAirdropScheduleRef.current.forEach((sched, dropIdx) => {
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
          activeEnemyAirdropsRef.current.splice(i, 1);
        }
      }

      // 4c-quater. INTERACTIVE 3D ORGAN ENVIRONMENTAL HAZARDS (Stomach Acid Geysers, Mucus Surge, Bile Jet, Synaptic Arc, Systolic Vortex!)
      organHazardScheduleRef.current.forEach((sched, hIdx) => {
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
          pooledHazard.group.position.set(laneX, -1.65, -8.5);
          pooledHazard.group.visible = true;
          const rMat = pooledHazard.warningRing.material as THREE.MeshBasicMaterial;
          rMat.color.setHex(hazardColorHex);
          rMat.opacity = 0.85;
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
            plume.rotation.y += delta * (idx % 2 === 0 ? 4.5 : -4.5);
            const hScale = 0.85 + Math.sin(elapsed * 12 + idx) * 0.25;
            plume.scale.set(1, hScale, 1);
            (plume.material as THREE.MeshBasicMaterial).opacity = Math.min(
              0.72,
              hz.activeTimer * 0.45
            );
          });

          // Damage & Slow Enemies caught in the active organ hazard lane!
          for (let sIdx = activeSoldiersRef.current.length - 1; sIdx >= 0; sIdx--) {
            const s = activeSoldiersRef.current[sIdx];
            if (Math.abs(s.mesh.position.x - hz.laneX) <= 1.35 && s.mesh.position.z > -20 && s.mesh.position.z < -2) {
              // Mucus / Acid slows pathogen advance and dissolves their outer capsule
              s.mesh.position.z -= s.speed * 0.42 * delta;
              if (nowTime - hz.lastDamageTime >= 650 && !s.isBoss) {
                s.hp -= 16;
                s.hitsLeft = Math.max(0.2, s.hitsLeft - 0.35);
                if (s.hpBarFill) {
                  const pct = Math.max(0.01, s.hitsLeft / s.maxHits);
                  s.hpBarFill.scale.x = pct;
                  s.hpBarFill.position.x = -(0.82 * (1 - pct)) / 2;
                }
              }
            }
          }

          // Check if player is standing exposed in the hazard lane (bunker cover shields the player!)
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
            activeOrganHazardsRef.current.splice(i, 1);
          }
        }
      }

      // Check if player is currently in cover behind an INTACT sandbag bunker (bar.hp > 0)
      const activeCoverBarricade = barricadesRef.current.find(
        (bar) => bar.hp > 0 && playerPosRef.current.z >= -1.8 && Math.abs(playerPosRef.current.x - bar.x) <= 1.25
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

      // Passive Leukocyte Cellular Regeneration when in cover or out of damage for 2.2s (keeps all phases fair & beatable!)
      if (playerHpRef.current > 0 && playerHpRef.current < 100 && (inCover || elapsed - lastDamageTakenTime > 2.2)) {
        regenAccumulator += delta * (inCover ? 4.8 : 3.0);
        if (regenAccumulator >= 1.0) {
          const healPts = Math.floor(regenAccumulator);
          regenAccumulator -= healPts;
          playerHpRef.current = Math.min(100, playerHpRef.current + healPts);
          setPlayerHp(playerHpRef.current);
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

        // Collision test against intact sandbag barricades (Bunkers absorb enemy fire and lose HP!)
        for (const bar of barricadesRef.current) {
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
            bullets.splice(i, 1);
            hit = true;
            break;
          }
        }

        if (hit) continue;

        // Collision test against Player or Bunker Cover
        const pz = playerPosRef.current.z;
        if (b.mesh.position.z >= pz - 0.5 && b.mesh.position.z <= pz + 0.7) {
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
              bullets.splice(i, 1);
              continue;
            }

            // Player is exposed in the open: take damage
            sounds.playQuizWrong();
            lastDamageTakenTime = elapsed;
            if (b.isTank) {
              triggerExplosion(b.mesh.position);
            }
            playerHpRef.current = Math.max(0, playerHpRef.current - b.damage);
            setPlayerHp(playerHpRef.current);
            setOperatorMood('hit');
            triggerDirectionalDamageFeedback(
              b.mesh.position.x - b.vx * 0.15,
              b.mesh.position.z - 6,
              b.damage,
              b.isTank ? 'TANK SHELL' : 'BALLISTIC HIT',
              false
            );
            setTimeout(() => setOperatorMood('normal'), 400);

            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate([40, 30, 40]);
            }

            b.mesh.visible = false;
            bullets.splice(i, 1);

            if (playerHpRef.current <= 0) {
              onPhaseDefeat(scoreRef.current, killsRef.current);
            }
            continue;
          }
        }

        // Expired or passed behind player into the camera
        if (b.mesh.position.z > playerPosRef.current.z + 4 || b.life <= 0) {
          b.mesh.visible = false;
          bullets.splice(i, 1);
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
            leftAlly.group.position.set(-3.2, 4.4, -14);
            leftAlly.group.rotation.set(0, 0, 0);
            leftAlly.parachuteGroup.visible = true;
            leftAlly.group.visible = true;

            const rightAlly = prebuiltAlliedRef.current.rightAlly;
            rightAlly.group.position.set(3.2, 4.4, -14);
            rightAlly.group.rotation.set(0, 0, 0);
            rightAlly.parachuteGroup.visible = true;
            rightAlly.group.visible = true;

            ad.allies.push({
              group: leftAlly.group,
              parachuteGroup: leftAlly.parachuteGroup,
              landed: false,
              targetY: -0.45,
              x: -3.2,
              z: -14,
              lastFireTime: performance.now(),
            });

            ad.allies.push({
              group: rightAlly.group,
              parachuteGroup: rightAlly.parachuteGroup,
              landed: false,
              targetY: -0.45,
              x: 3.2,
              z: -14,
              lastFireTime: performance.now() + 300,
            });
          }

          // Hide plane once it clears the front sector
          if (ad.plane.group.position.z > 25) {
            ad.plane.group.visible = false;
            ad.plane = null;
          }
        }

        // Animate Allied Commandos Falling & Suppressing
        const currentNow = performance.now();
        for (let aIdx = 0; aIdx < ad.allies.length; aIdx++) {
          const ally = ad.allies[aIdx];
          if (!ally.landed) {
            ally.group.position.y -= delta * 3.8;
            ally.group.rotation.z = Math.sin(elapsed * 4 + aIdx) * 0.12;
            if (ally.group.position.y <= ally.targetY) {
              ally.group.position.y = ally.targetY;
              ally.landed = true;
              ally.group.rotation.z = 0;
              ally.parachuteGroup.visible = false;
              sounds.playRadioChirp();
            }
          } else {
            ally.dodgeTimer = (ally.dodgeTimer || 0) + delta;

            if (ally.dodgeTimer > 2.4 && !ally.isDodging) {
              ally.isDodging = true;
              ally.dodgeTimer = 0;
              ally.dodgeDirection = aIdx === 0 ? 1 : -1;
              ally.rollProgress = 0;
            }

            if (ally.isDodging) {
              ally.rollProgress = (ally.rollProgress || 0) + delta * 3.5;
              ally.group.rotation.z = (ally.dodgeDirection || 1) * ally.rollProgress * Math.PI * 2;
              ally.group.position.x += (ally.dodgeDirection || 1) * delta * 3.6;
              ally.group.position.x = Math.max(-4.2, Math.min(4.2, ally.group.position.x));

              if (ally.rollProgress >= 1.0) {
                ally.isDodging = false;
                ally.group.rotation.z = 0;
              }
            } else {
              ally.group.rotation.z = Math.sin(elapsed * 6 + aIdx) * 0.05;
              ally.group.position.y = ally.targetY + Math.abs(Math.sin(elapsed * 8)) * 0.03;
            }

            if (currentNow - ally.lastFireTime > 750) {
              ally.lastFireTime = currentNow;

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

              if (targetSoldier) {
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

                // Spawn a realistic 3D Pointed Spitzer Bullet from Allied Commando toward target soldier (from playerTracerPool!)
                _v1.copy(ally.group.position);
                _v1.y += 0.25;
                _v1.z += 0.45;
                _v2.copy(targetSoldier.mesh.position);
                _v2.y += 0.25;
                _v3.copy(_v2).sub(_v1).normalize();
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
                  triggerExplosion(targetSoldier.mesh.position);
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
        }

        ad.activeTimer -= delta;
        if (ad.activeTimer <= 0) {
          ad.allies.forEach((ally) => {
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
          pTracers.splice(i, 1);
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
          shells.splice(i, 1);
        }
      }

      // 6. BLACK OPS AN/PEQ-15 TACTICAL LASER SIGHT TRACKING & TARGET LOCK DETECTION (1:1 Raycast Aligned!)
      if (laserLineRef.current && laserDotRef.current) {
        _v1.set(
          playerPosRef.current.x + (isScopedRef.current ? 0.0 : 0.34) + aimPosRef.current.x * 0.06,
          (isScopedRef.current ? -0.52 : -0.26) + aimPosRef.current.y * 0.06,
          playerPosRef.current.z - 0.85
        );

        // Compute exact 3D point along the true crosshair ray so the laser dot sits 100% under the crosshair!
        hitVector.set(isScopedRef.current ? 0 : aimPosRef.current.x, isScopedRef.current ? 0 : aimPosRef.current.y);
        raycaster.setFromCamera(hitVector, camera);
        _v2.copy(raycaster.ray.direction).multiplyScalar(36).add(camera.position);

        let lockedOnEnemy = false;

        for (let i = 0; i < activeSoldiersRef.current.length; i++) {
          const s = activeSoldiersRef.current[i];
          if (s.mesh.position.z >= -2) continue;
          _v3.copy(s.mesh.position);
          _v3.y += s.isRobot ? 1.85 : s.isTank ? 0.45 : 0.25;
          _v4.copy(_v3).project(camera);
          const d = Math.hypot(_v4.x - hitVector.x, _v4.y - hitVector.y);
          const lockRadius = autoAimEnabledRef.current ? 0.24 : 0.145;
          if (d < lockRadius) {
            lockedOnEnemy = true;
            const enemyDist = Math.max(4, Math.abs(s.mesh.position.z - camera.position.z));
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

      // 7. TARGET LOCK RANGEFINDER (Throttled to every 320ms for zero React re-render lag)
      if (nowTime - lastHudSyncTime >= 320) {
        lastHudSyncTime = nowTime;
        const locks: TargetHudLock[] = [];
        const sorted = [...activeSoldiersRef.current]
          .filter((s) => s.mesh.position.z < -3)
          .sort((a, b) => b.mesh.position.z - a.mesh.position.z)
          .slice(0, 2);

        sorted.forEach((s) => {
          _v1.copy(s.mesh.position);
          _v1.y += s.isRobot ? 3.55 : s.isHelicopter || s.isJet ? 1.65 : s.isTank ? 1.55 : 1.35;
          _v1.project(camera);
          if (_v1.z < 1 && _v1.x >= -0.95 && _v1.x <= 0.95 && _v1.y >= -0.95 && _v1.y <= 0.95) {
            const dist = Math.abs(s.mesh.position.z - playerPosRef.current.z);
            locks.push({
              id: s.id,
              name: s.name,
              dist: Math.round(dist * 10) / 10,
              x: (_v1.x + 1) * 50,
              y: (-_v1.y + 1) * 50,
              isTank: Boolean(s.isTank || s.isBoss),
              hpPercent: Math.round((s.hitsLeft / s.maxHits) * 100),
            });
          }
        });
        setTargetLocks(locks);

        // Sync live radar blips for Fortnite Top-Right Minimap
        const blips: Array<{ x: number; y: number; isTank: boolean; isAllied: boolean }> = [];
        for (const s of activeSoldiersRef.current) {
          const rx = Math.max(8, Math.min(92, 50 + ((s.mesh.position.x - playerPosRef.current.x) / 9) * 42));
          const ry = Math.max(8, Math.min(92, 85 + (s.mesh.position.z / 42) * 75));
          blips.push({
            x: Math.round(rx),
            y: Math.round(ry),
            isTank: Boolean(s.isTank || s.isBoss),
            isAllied: false,
          });
        }
        if (airdropRef.current) {
          for (const ally of airdropRef.current.allies) {
            const ax = Math.max(10, Math.min(90, 50 + ((ally.group.position.x - playerPosRef.current.x) / 9) * 42));
            const ay = Math.max(10, Math.min(90, 85 + (ally.group.position.z / 42) * 75));
            blips.push({ x: Math.round(ax), y: Math.round(ay), isTank: false, isAllied: true });
          }
        }
        setRadarBlips(blips);
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
          reloadProgressRef.current = pct;
          if (Math.floor(elapsed * 60) % 2 === 0) {
            setReloadProgress(Math.round(pct));
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

        const scopedNow = isScopedRef.current && !isReloadingRef.current && currentWeaponRef.current.category !== 'SHOTGUN';

        if (scopedNow) {
          // In Black Ops ADS, hide the 3D gun mesh so no weapon receiver or slide clips into the camera/glass as a black box!
          weaponMeshRef.current.visible = false;
        } else {
          weaponMeshRef.current.visible = true;
          // In hipfire: x = 0.36, y = -0.34, z = -0.82
          const baseWpnX = 0.36;
          const baseWpnY = -0.34 + reloadOffsetY;
          const baseWpnZ = -0.84 + reloadOffsetZ;

          const targetX = baseWpnX - inputX * 0.07 + aimPosRef.current.x * 0.09;
          const targetY = baseWpnY - Math.abs(inputX) * 0.015 + aimPosRef.current.y * 0.09;
          const targetRotZ = inputX * 0.1 + reloadRotZ;
          weaponMeshRef.current.position.x = THREE.MathUtils.damp(weaponMeshRef.current.position.x, targetX, 16, delta);
          weaponMeshRef.current.position.y = THREE.MathUtils.damp(weaponMeshRef.current.position.y, targetY, 16, delta);
          weaponMeshRef.current.position.z = THREE.MathUtils.damp(weaponMeshRef.current.position.z, baseWpnZ + recoilRef.current.z, 16, delta);
          weaponMeshRef.current.rotation.x = THREE.MathUtils.damp(weaponMeshRef.current.rotation.x, 0.04 - recoilRef.current.rotX + reloadRotX, 16, delta);
          weaponMeshRef.current.rotation.z = THREE.MathUtils.damp(weaponMeshRef.current.rotation.z, targetRotZ, 14, delta);
        }
      }

      if (muzzleFlashRef.current && muzzleFlashRef.current.intensity > 0) {
        muzzleFlashRef.current.intensity = THREE.MathUtils.damp(muzzleFlashRef.current.intensity, 0, 24, delta);
      }

      if (muzzleSpriteRef.current && muzzleSpriteRef.current.material) {
        muzzleSpriteRef.current.visible = !isScopedRef.current;
        const mat = muzzleSpriteRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = THREE.MathUtils.damp(mat.opacity, 0, 28, delta);
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    }

    // Frame-0 GPU Buffer & Material Warm-Up for pooled Boss, Aircraft & Rocket meshes so zero GPU upload stall occurs when the Boss spawns at 38s!
    {
      const warmupMeshes: Array<{ obj: THREE.Object3D; prevVis: boolean; prevPos: THREE.Vector3 }> = [];
      const registerWarmup = (obj?: THREE.Object3D) => {
        if (!obj) return;
        warmupMeshes.push({ obj, prevVis: obj.visible, prevPos: obj.position.clone() });
        obj.visible = true;
        obj.position.set(0, 0, -28);
      };
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
      cancelAnimationFrame(animationFrameId);
      clearInterval(spawnInterval);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

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

      {/* Subtle Vignette */}
      <div className={`absolute inset-0 hud-vignette pointer-events-none z-10 ${playerHp < 35 ? 'danger-vignette' : ''}`} />
      {operatorMood === 'hit' && <div className="absolute inset-0 visor-damage z-10 animate-pulse" />}

      {/* SUBTLE EDGE-ONLY DIRECTIONAL DAMAGE PULSE (Never blocks center view) */}
      {damageIndicators.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
          {damageIndicators.map((ind) => {
            const hpDangerRatio = Math.max(0, (100 - playerHp) / 100);
            const alpha = Math.min(0.85, ind.intensity * (0.5 + hpDangerRatio * 0.35));
            return (
              <div
                key={ind.id}
                className="absolute inset-0 transition-opacity duration-300"
                style={{
                  opacity: alpha * 0.65,
                  background:
                    ind.sector === 'left'
                      ? `radial-gradient(ellipse at 0% 50%, rgba(239, 68, 68, ${alpha * 0.5}) 0%, transparent 55%)`
                      : ind.sector === 'right'
                      ? `radial-gradient(ellipse at 100% 50%, rgba(239, 68, 68, ${alpha * 0.5}) 0%, transparent 55%)`
                      : `radial-gradient(ellipse at 50% 0%, rgba(239, 68, 68, ${alpha * 0.5}) 0%, transparent 55%)`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* AUTHENTIC TACTICAL HOLOGRAPHIC SIGHT (PRE-MOUNTED IN DOM SO SCOPE ASSET APPEARS INSTANTLY ON FIRST TIME!) */}
      <div
        className={`fixed inset-0 pointer-events-none z-30 select-none overflow-hidden transition-opacity duration-100 ${
          isScoped ? 'opacity-100 visible animate-ads-snap' : 'opacity-0 invisible'
        }`}
      >
          {/* Tactical Peripheral Tunnel Vignette - pulls focus cleanly through the optical glass */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle 38vh at 50% 50%, transparent 40%, rgba(0,0,0,0.4) 68%, rgba(0,0,0,0.85) 100%)',
            }}
          />

          {/* Weapon Rail & Receiver Anchor extending to bottom of viewport */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end pointer-events-none">
            {/* Optic Sight Frame matching IMG_5388 reference */}
            <div className="relative h-[72vh] sm:h-[82vh] max-h-[720px] aspect-[920/965] flex items-center justify-center">
              <img
                src="/assets/scope_optic_clean.png"
                alt="Tactical Optic Scope"
                loading="eager"
                decoding="sync"
                className="w-full h-full object-contain filter drop-shadow-[0_12px_32px_rgba(0,0,0,0.9)] pointer-events-none"
                draggable={false}
              />

              {/* Circular Reflex Optical Lens Glass */}
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  top: '19.5%',
                  left: '20.5%',
                  width: '59%',
                  height: '56%',
                  background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.06) 0%, rgba(245,158,11,0.02) 40%, rgba(6,182,212,0.05) 80%, rgba(0,0,0,0.12) 100%)',
                  boxShadow: 'inset 0 0 18px rgba(0,0,0,0.6), inset 0 0 6px rgba(245,158,11,0.15)',
                }}
              >
                {/* Subtle Anti-Reflective Lens Glare Slant */}
                <div
                  className="absolute inset-0 rounded-full pointer-events-none opacity-40"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 42%, rgba(245,158,11,0.08) 55%, transparent 100%)',
                  }}
                />

                {/* CURVED PERIMETER HUD ARCS ROUNDING LEFT & RIGHT LENS EDGES */}
                <svg
                  viewBox="0 0 200 200"
                  className="absolute -inset-[6%] w-[112%] h-[112%] pointer-events-none overflow-visible"
                >
                  {/* Left Curved Health Track (135° to 225°) */}
                  <path
                    d="M 35 165 A 92 92 0 0 1 35 35"
                    fill="none"
                    stroke="rgba(24, 24, 27, 0.85)"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  {/* Left Curved Health Fill Arc */}
                  <path
                    d="M 35 165 A 92 92 0 0 1 35 35"
                    fill="none"
                    stroke={playerHp < 35 ? '#f43f5e' : playerHp < 65 ? '#f59e0b' : '#10b981'}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray="145"
                    strokeDashoffset={145 - (145 * Math.max(0, Math.min(100, playerHp))) / 100}
                    style={{
                      filter:
                        playerHp < 35
                          ? 'drop-shadow(0 0 8px rgba(244,63,94,0.9))'
                          : 'drop-shadow(0 0 6px rgba(16,185,129,0.75))',
                      transition: 'stroke-dashoffset 150ms ease-out, stroke 150ms ease-out',
                    }}
                  />

                  {/* Right Curved Magazine / Ability Energy Track (45° to -45°) */}
                  <path
                    d="M 165 165 A 92 92 0 0 0 165 35"
                    fill="none"
                    stroke="rgba(24, 24, 27, 0.85)"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  {/* Right Curved Magazine Fill Arc */}
                  <path
                    d="M 165 165 A 92 92 0 0 0 165 35"
                    fill="none"
                    stroke={isReloading ? '#f59e0b' : currentAmmo === 0 ? '#f43f5e' : '#22d3ee'}
                    strokeWidth="5"
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
                      filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.75))',
                      transition: 'stroke-dashoffset 120ms ease-out',
                    }}
                  />
                </svg>

                {/* LEFT ROUNDED SCOPE TELEMETRY: HEALTH & COVER STATUS */}
                <div className="absolute top-1/2 -left-3 sm:-left-6 -translate-x-full -translate-y-1/2 flex flex-col items-end gap-1.5 pointer-events-none font-mono">
                  <div className="px-2 py-1 bg-zinc-950/90 border-r-2 border-emerald-400 border-y border-l border-emerald-500/30 rounded-l-xl shadow-[0_0_14px_rgba(0,0,0,0.85)] flex flex-col items-end">
                    <span className="text-[8px] tracking-widest text-zinc-400 uppercase">VITALITY</span>
                    <div className="flex items-center gap-1">
                      <Shield className={`w-3.5 h-3.5 ${playerHp < 35 ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`} />
                      <span className={`text-xs sm:text-sm font-black tabular-nums ${playerHp < 35 ? 'text-rose-400 animate-pulse' : 'text-emerald-300'}`}>
                        {playerHp}%
                      </span>
                    </div>
                  </div>
                  <div className={`px-2 py-0.5 bg-zinc-950/90 border-r-2 rounded-l-lg text-[9px] font-bold tracking-wider uppercase shadow-md ${
                    isPlayerInCover ? 'border-cyan-400 text-cyan-300' : 'border-amber-500/70 text-amber-400'
                  }`}>
                    {isPlayerInCover ? `BUNKER ${activeCoverHp}%` : 'EXPOSED'}
                  </div>
                </div>

                {/* RIGHT ROUNDED SCOPE TELEMETRY: ABILITIES & AMMO ARC */}
                <div className={`absolute top-1/2 -right-3 sm:-right-6 translate-x-full -translate-y-1/2 flex flex-col items-start gap-1 font-mono ${isScoped ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                  {/* Top of Right Curve: Live Ammo Badge */}
                  <div className="-ml-2 px-2 py-0.5 bg-zinc-950/90 border-l-2 border-cyan-400 border-y border-r border-cyan-500/30 rounded-r-lg shadow-md flex items-center gap-1.5">
                    <span className="text-[8px] text-cyan-400 uppercase tracking-wider">AMMO</span>
                    <span className={`text-xs font-black tabular-nums ${currentAmmo === 0 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
                      {isReloading ? `${reloadProgress}%` : `${currentAmmo}/${reserveAmmo}`}
                    </span>
                  </div>

                  {/* Upper-Mid Right Curve: STIM [E] */}
                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.triggerHaptic([20, 30, 20], 'medium');
                      handleStimpack();
                    }}
                    disabled={stimCooldown > 0 || playerHp >= 100}
                    className={`px-2 py-0.5 rounded-r-lg border-l-2 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md transition-all ${
                      stimCooldown === 0 && playerHp < 100
                        ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300 cursor-pointer hover:bg-emerald-900'
                        : 'bg-zinc-950/85 border-zinc-700 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>STIM {stimCooldown > 0 ? `${stimCooldown}S` : '[E]'}</span>
                  </button>

                  {/* Lower-Mid Right Curve: FRAG [G] */}
                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.triggerHaptic([25, 20], 'medium');
                      handleThrowGrenade();
                    }}
                    disabled={grenadeCooldown > 0}
                    className={`px-2 py-0.5 rounded-r-lg border-l-2 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md transition-all ${
                      grenadeCooldown === 0
                        ? 'bg-amber-950/90 border-amber-400 text-amber-300 cursor-pointer hover:bg-amber-900'
                        : 'bg-zinc-950/85 border-zinc-700 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    <Bomb className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>FRAG {grenadeCooldown > 0 ? `${grenadeCooldown}S` : '[G]'}</span>
                  </button>

                  {/* Bottom of Right Curve: AIRDROP [T] */}
                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.triggerHaptic([35, 25, 45], 'heavy');
                      handleAirdropReinforcements();
                    }}
                    disabled={reinforceCooldown > 0 || isAirdropActive}
                    className={`-ml-2 px-2 py-0.5 rounded-r-lg border-l-2 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md transition-all ${
                      reinforceCooldown === 0 && !isAirdropActive
                        ? 'bg-cyan-950/90 border-cyan-400 text-cyan-300 cursor-pointer hover:bg-cyan-900'
                        : 'bg-zinc-950/85 border-zinc-700 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    <Plane className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>{isAirdropActive ? 'ACTIVE' : reinforceCooldown > 0 ? `AIR ${reinforceCooldown}S` : 'AIR [T]'}</span>
                  </button>
                </div>

                {/* Luminous Holographic Laser Reticle System */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Center Glowing Dot */}
                  <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b,0_0_4px_#ffffff] flex items-center justify-center">
                    <div className="w-0.5 h-0.5 rounded-full bg-white" />
                  </div>

                  {/* Left Chevron >> */}
                  <div className="absolute left-[24%] flex items-center text-amber-500/90 text-xs font-black tracking-tighter drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]">
                    &gt;&gt;
                  </div>

                  {/* Right Chevron << */}
                  <div className="absolute right-[24%] flex items-center text-amber-500/90 text-xs font-black tracking-tighter drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]">
                    &lt;&lt;
                  </div>

                  {/* Reticle Range Brackets [ . ] */}
                  <div className="absolute flex items-center justify-center gap-6 pointer-events-none">
                    <div className="w-2 h-3 border-l-2 border-t-2 border-amber-400/80 shadow-[0_0_4px_#f59e0b]" />
                    <div className="w-2 h-3 border-r-2 border-t-2 border-amber-400/80 shadow-[0_0_4px_#f59e0b]" />
                  </div>
                </div>
              </div>

              {/* Tactical HUD Telemetry Badge under the lens */}
              <div className="absolute bottom-[14%] left-1/2 -translate-x-1/2 px-3 py-0.5 bg-zinc-950/90 border border-amber-500/40 text-[9px] font-mono tracking-widest text-amber-400 uppercase whitespace-nowrap shadow-md">
                {currentWeapon.category === 'SNIPER' ? '12X BALLISTIC OPTIC // LOCK: ACTIVE' : 'HOLO REFLEX SIGHT // HEADSHOT 3X'}
              </div>
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
        className="hud-layer-fixed fixed inset-0 z-40 pointer-events-none flex flex-col justify-between select-none"
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

          {/* TOP-CENTER: Boss Health Bar, Exfil Button, Killstreak & Threat Alerts */}
          <div className="flex flex-col items-center gap-1 max-w-[46vw] sm:max-w-md">
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

            {(hazardAlert || bleriotAlert || enemyAirdropAlert || damageIndicators.length > 0) && (
              <div className="bg-rose-950/90 border border-rose-400 rounded-md px-2.5 py-0.5 text-[8px] sm:text-[10px] font-black tracking-wider uppercase text-rose-200 shadow-lg max-w-full truncate">
                {hazardAlert
                  ? hazardAlert
                  : bleriotAlert
                  ? bleriotAlert
                  : enemyAirdropAlert
                  ? enemyAirdropAlert
                  : (() => {
                      const latest = damageIndicators[damageIndicators.length - 1];
                      const dirArrow = latest.sector === 'left' ? '◀ LEFT' : latest.sector === 'right' ? 'RIGHT ▶' : '▲ FRONT';
                      return `ALERT [${dirArrow}]: ${latest.sourceType} FIRE — MOVE TO COVER!`;
                    })()}
              </div>
            )}
          </div>

          {/* TOP-RIGHT: FORTNITE SQUARE MINIMAP + 4 TELEMETRY ICON BADGES BELOW */}
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
                <span
                  key={bIdx}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none ${
                    blip.isAllied
                      ? 'w-2 h-2 rounded-full bg-sky-400 border border-white shadow-[0_0_6px_#38bdf8]'
                      : blip.isTank
                      ? 'w-2.5 h-2.5 rotate-45 bg-amber-400 border border-rose-600 shadow-[0_0_8px_#f59e0b]'
                      : 'w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_5px_#f43f5e]'
                  }`}
                  style={{ left: `${blip.x}%`, top: `${blip.y}%` }}
                />
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
                <span className="text-[10px] sm:text-xs font-black text-amber-300 tabular-nums">
                  {score}
                </span>
              </div>
            </div>
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
              {/* Posture / Bunker Cover Status Pill */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded text-[8px] sm:text-[10px] font-black uppercase tracking-wider border shadow-md ${
                    isPlayerInCover
                      ? 'bg-sky-950/90 border-sky-400 text-sky-200'
                      : 'bg-slate-950/85 border-amber-400/60 text-amber-300'
                  }`}
                >
                  {isPlayerInCover ? `🛡️ BUNKER SHIELD ${activeCoverHp}%` : '⚠️ EXPOSED [MOVE A/D TO COVER]'}
                </span>
              </div>

              {/* TOP BAR: FORTNITE CYAN/BLUE SHIELD BAR (Bunker Cover / Bio-Armor) */}
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

                        {/* Center Fortnite Weapon Silhouette Icon */}
                        <div className="flex items-center justify-center my-auto">
                          <svg
                            viewBox="0 0 48 20"
                            className="w-8 h-3.5 sm:w-10 sm:h-4 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]"
                            fill="currentColor"
                          >
                            {wpn.category === 'ASSAULT' && (
                              <path d="M2 8h10l3-3h15v2h14v2H32l-2 3h-5v5h-3v-5h-6l-3 5H8l2-5H2V8z" />
                            )}
                            {wpn.category === 'SHOTGUN' && (
                              <path d="M3 9h12l2-2h27v3H28v2H18l-4 5H9l3-6H3V9z" />
                            )}
                            {wpn.category === 'SNIPER' && (
                              <path d="M1 9h11l2-2h6V5h10v2h17v2H30l-2 3h-6v5h-3v-5h-5l-4 5H5l3-6H1V9z" />
                            )}
                            {wpn.category === 'MACHINE_GUN' && (
                              <path d="M6 8h9l2-3h14v3h11v2H31v3a4 4 0 1 1-8 0v-1h-5l-3 5H10l2-5H6V8z" />
                            )}
                          </svg>
                        </div>

                        {/* Bottom-Right Ammo Readout inside tile (matches Fortnite "21", "88", "107") */}
                        <div className="flex items-center justify-end gap-0.5 w-full leading-none">
                          <span
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

                {/* Slot 7: WBC AIRDROP REINFORCEMENTS [T] */}
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
                <span className="text-sm font-black text-white">{timeLeft}s</span>
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
    </div>
  );
};

