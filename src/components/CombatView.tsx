import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { LevelConfig, Weapon, HitMarkerInfo, KillfeedEntry } from '../types/game';
import { sounds } from '../services/soundEffects';
import { voipManager, OrganVoipClip } from '../services/voipManager';
import { ORGAN_THEMES, OrganTheme, getOrganThemeForLevel } from '../services/organThemes';
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
} from './CellModels';
import { INITIAL_WEAPONS, CURRICULUM_LEVELS } from '../data/curriculumData';
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
} from 'lucide-react';

interface CombatViewProps {
  level: LevelConfig;
  phaseNumber: number; // 1, 2, or 3
  activeWeapon: Weapon;
  soundEnabled: boolean;
  autoAimEnabled?: boolean;
  playerXp: number;
  onPhaseComplete: (scoreEarned: number, killsEarned: number) => void;
  onPhaseDefeat: () => void;
  onToggleSound?: () => void;
  onToggleAutoAim?: () => void;
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
  sourceType: 'MORTAR SPLASH' | 'BOSS MISSILE' | 'TANK SHELL' | 'BALLISTIC HIT';
  intensity: number; // 0.35 .. 1.0 (scales up as player HP lowers!)
  isSplash: boolean;
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
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Level number (1 to 9) for progressive difficulty scaling across both levels and phases
  const levelNumber = Math.max(1, CURRICULUM_LEVELS.findIndex((l) => l.id === level.id) + 1);

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
  const [isPlayerInCover, setIsPlayerInCover] = useState<boolean>(false);
  const [barricadeHps, setBarricadeHps] = useState<number[]>([100, 100, 100]);
  const [activeCoverHp, setActiveCoverHp] = useState<number>(100);
  const [isFiring, setIsFiring] = useState<boolean>(false);
  const [operatorMood, setOperatorMood] = useState<'normal' | 'shooting' | 'hit'>('normal');
  const [bleriotAlert, setBleriotAlert] = useState<string | null>(null);
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

  const handleToggleScope = () => {
    const next = !isScopedRef.current;
    isScopedRef.current = next;
    setIsScoped(next);
    sounds.playScopeZoom(next);
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

  // Blériot WW2 Plane Mortar Bombing Schedule (2 shells in Phase 1, 3 in Phase 2, 4 in Phase 3)
  const bleriotScheduleRef = useRef<Array<{ triggerTime: number; fired: boolean }>>(
    phaseNumber === 1
      ? [
          { triggerTime: 48, fired: false },
          { triggerTime: 22, fired: false },
        ]
      : phaseNumber === 2
      ? [
          { triggerTime: 50, fired: false },
          { triggerTime: 33, fired: false },
          { triggerTime: 15, fired: false },
        ]
      : [
          { triggerTime: 52, fired: false },
          { triggerTime: 39, fired: false },
          { triggerTime: 26, fired: false },
          { triggerTime: 13, fired: false },
        ]
  );
  const activeBleriotRunsRef = useRef<ActiveBleriotRun[]>([]);
  const activeMortarBombsRef = useRef<ActiveMortarBomb[]>([]);
  const activeBossRocketsRef = useRef<ActiveBossRocket[]>([]);

  // Enemy Troop Airdrop Schedule (1 tank + 2 soldiers on its side: 1 drop in Phase 1, 2 in Phase 2, 3 in Phase 3)
  // Triggered early in each phase so the player immediately sees the hostile C-47 plane & 3 parachutes!
  const enemyAirdropScheduleRef = useRef<Array<{ triggerTime: number; fired: boolean }>>(
    phaseNumber === 1
      ? [{ triggerTime: 52, fired: false }]
      : phaseNumber === 2
      ? [
          { triggerTime: 53, fired: false },
          { triggerTime: 28, fired: false },
        ]
      : [
          { triggerTime: 54, fired: false },
          { triggerTime: 36, fired: false },
          { triggerTime: 18, fired: false },
        ]
  );
  const activeEnemyAirdropsRef = useRef<ActiveEnemyAirdrop[]>([]);
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

  // Virtual Joystick Mobile State
  const joystickCenterRef = useRef<{ x: number; y: number } | null>(null);
  const joystickOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [joystickDisplay, setJoystickDisplay] = useState<{ x: number; y: number } | null>(null);

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

  // Periodic Panicking Cell / Platelet Cries for Help & Tactical Voice Chatter
  useEffect(() => {
    // Trigger an initial platelet/cell help cry 2.8s into the phase so the player immediately hears them asking for help!
    const initialHelpTimer = setTimeout(() => {
      const cry = sounds.speakCellHelpCry(organThemeRef.current.id, true);
      setCellDistressBanner(`🩸 PLATELET SQUAD: "${cry}"`);
      setTimeout(() => setCellDistressBanner(null), 3600);
    }, 2800);

    const voiceInterval = setInterval(() => {
      const roll = Math.random();
      if (roll < 0.52) {
        // 52% chance: Panicking Platelets or Theme Cells audibly cry for help!
        const isPlatelet = Math.random() < 0.55;
        const cry = sounds.speakCellHelpCry(organThemeRef.current.id, isPlatelet);
        const speakerLabel = isPlatelet
          ? '🩸 PANICKING PLATELETS'
          : organThemeRef.current.id === 'alveoli'
          ? '🟢 MUCUS GOBLET CELLS'
          : organThemeRef.current.id === 'brain'
          ? '⚡ SPINAL NEURONES'
          : organThemeRef.current.id === 'stomach' || organThemeRef.current.id === 'intestine'
          ? '🟠 EPITHELIAL VILLI CELLS'
          : '🔴 RED BLOOD CELLS';
        setCellDistressBanner(`${speakerLabel}: "${cry}"`);
        setTimeout(() => setCellDistressBanner(null), 3600);
      } else if (roll < 0.76) {
        const hasTank = activeSoldiersRef.current.some((s) => s.isTank);
        const voipMsg = hasTank ? sounds.speakTankCommander() : sounds.speakStrepGrunt();
        setCellDistressBanner(`🎙️ ${voipMsg}`);
        setTimeout(() => setCellDistressBanner(null), 3400);
      } else if (roll < 0.9) {
        const voipMsg = sounds.speakCommando();
        setCellDistressBanner(`🎙️ ${voipMsg}`);
        setTimeout(() => setCellDistressBanner(null), 3400);
      } else {
        const voipMsg = sounds.speakBacillusHeavy();
        setCellDistressBanner(`🎙️ ${voipMsg}`);
        setTimeout(() => setCellDistressBanner(null), 3400);
      }
    }, 4600);

    return () => {
      clearTimeout(initialHelpTimer);
      clearInterval(voiceInterval);
    };
  }, [isAirdropActive]);

  // VOIP Manager: Randomly plays short, context-specific radio chatter clips from Organs during active combat!
  const triggerContextualOrganVoip = (force: boolean = false) => {
    const hasTank = activeSoldiersRef.current.some((s) => s.isTank);
    const hasBoss = activeSoldiersRef.current.some((s) => s.isBoss);
    const hasDamagedBarricade = barricadesRef.current.some((b) => b.hp < b.maxHp * 0.7);
    const wave: 1 | 2 | 3 =
      timeLeftRef.current > 40 ? 1 : timeLeftRef.current > 20 ? 2 : 3;

    const clip = voipManager.dispatchContextualVoip(
      {
        themeId: organThemeRef.current.id,
        hasTank,
        hasBoss,
        isAirdropActive,
        hasDamagedBarricade,
        playerHp: playerHpRef.current,
        wave,
      },
      force
    );

    if (clip) {
      setOrganRadioComm(clip);
      setTimeout(() => {
        setOrganRadioComm((prev) => (prev === clip ? null : prev));
      }, 4800);
    }
  };

  useEffect(() => {
    let radioTimeout: NodeJS.Timeout | null = null;

    const scheduleNextOrganVoip = (delayMs: number) => {
      radioTimeout = setTimeout(() => {
        triggerContextualOrganVoip(false);
        const nextDelay = 7800 + Math.floor(Math.random() * 3400);
        scheduleNextOrganVoip(nextDelay);
      }, delayMs);
    };

    // Initial Organ VOIP dispatch early in active combat (4.2s)
    scheduleNextOrganVoip(4200);

    return () => {
      if (radioTimeout) clearTimeout(radioTimeout);
    };
  }, []);

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

  // 60-second combat countdown
  const timeLeftRef = useRef<number>(60);
  useEffect(() => {
    sounds.playCombatAlarm();
    timeLeftRef.current = 60;
    const timer = setInterval(() => {
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
    if (timeLeft === 0 && playerHpRef.current > 0) {
      sounds.playVictory();
      onPhaseComplete(scoreRef.current + 1000, killsRef.current);
    }
  }, [timeLeft, onPhaseComplete]);

  // Cooldown timers
  useEffect(() => {
    if (stimCooldown > 0) {
      const t = setTimeout(() => setStimCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [stimCooldown]);

  useEffect(() => {
    if (grenadeCooldown > 0) {
      const t = setTimeout(() => setGrenadeCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [grenadeCooldown]);

  useEffect(() => {
    if (reinforceCooldown > 0) {
      const t = setTimeout(() => setReinforceCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [reinforceCooldown]);

  // Stimpack Heal
  const handleStimpack = () => {
    if (stimCooldown === 0 && playerHpRef.current < 100) {
      sounds.playStimInject();
      const newHp = Math.min(100, playerHpRef.current + 40);
      playerHpRef.current = newHp;
      setPlayerHp(newHp);
      setStimCooldown(12);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 60, 40]);
      }
    }
  };

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

  // Throw Grenade
  const handleThrowGrenade = () => {
    if (grenadeCooldown > 0 || !sceneRef.current) return;
    setGrenadeCooldown(10);
    sounds.playGrenadeThrow();

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([30, 40]);
    }

    // Spawn 3D grenade in scene
    const grenadeMesh = createGrenadeModel();
    grenadeMesh.position.set(playerPosRef.current.x + 0.2, -0.2, playerPosRef.current.z - 0.8);
    sceneRef.current.add(grenadeMesh);

    activeGrenadesRef.current.push({
      mesh: grenadeMesh,
      vx: aimPosRef.current.x * 6,
      vy: 4.5,
      vz: -22.0,
      life: 1.4, // explodes after 1.4s
    });
  };

  // Airdrop WBC Reinforcements Ability (C-130 plane drops 2 allied paratroopers for 10s flank support)
  const handleAirdropReinforcements = () => {
    if (reinforceCooldown > 0 || !sceneRef.current) return;
    setReinforceCooldown(25);
    setIsAirdropActive(true);
    sounds.playRadioChirp();
    sounds.playAirdropPlane();

    // VOIP Manager: Bone Marrow immediately confirms reinforcements on the way!
    const boneMarrowClip = voipManager.triggerEventVoip('airdrop_inbound', organThemeRef.current.id);
    if (boneMarrowClip) {
      setOrganRadioComm(boneMarrowClip);
      setTimeout(() => {
        setOrganRadioComm((prev) => (prev === boneMarrowClip ? null : prev));
      }, 4800);
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([60, 40, 60]);
    }

    // Spawn 3D C-130 Airdrop Transport Plane
    const planeData = createTacticalAirdropPlane();
    planeData.group.position.set(0, 5.2, -65);
    sceneRef.current.add(planeData.group);

    airdropRef.current = {
      plane: { group: planeData.group, propellers: planeData.propellers },
      planeSpeed: 28.0,
      alliesDropped: false,
      allies: [],
      activeTimer: 10.0,
    };
  };

  // Quick Weapon Swap (SCAR, Pump Shotgun, Sniper, Drum Machine Gun)
  const handleSwapWeapon = () => {
    const currentIdx = INITIAL_WEAPONS.findIndex((w) => w.id === currentWeaponRef.current.id);
    const nextIdx = (currentIdx + 1) % INITIAL_WEAPONS.length;
    const nextWpn = INITIAL_WEAPONS[nextIdx];
    currentWeaponRef.current = nextWpn;
    currentAmmoRef.current = nextWpn.magSize;
    reserveAmmoRef.current = nextWpn.totalReserve;
    setCurrentWeapon(nextWpn);
    setCurrentAmmo(nextWpn.magSize);
    setReserveAmmo(nextWpn.totalReserve);

    // Rebuild weapon 3D model in FPS rig smoothly without tearing down scene
    if (weaponMeshRef.current && activeWeaponSubmeshRef.current) {
      weaponMeshRef.current.remove(activeWeaponSubmeshRef.current);
      const newModel = createFortniteWeaponModel(nextWpn.id, nextWpn.color);
      weaponMeshRef.current.add(newModel.group);
      activeWeaponSubmeshRef.current = newModel.group;
      pumpSlideRef.current = newModel.pumpSlide || null;
    }

    sounds.playRadioChirp();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30);
    }
  };

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

    const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.1, 140);
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

      // Clear previous theme meshes
      panickingRbcsRef.current.forEach((r) => scene.remove(r.mesh));
      panickingPlateletsRef.current.forEach((p) => scene.remove(p.mesh));
      barricadeRefugeesRef.current.forEach((br) => scene.remove(br.mesh));
      barricadeRefugeesRef.current = [];
      heroicAntibodiesRef.current.forEach((a) => scene.remove(a.mesh));
      if (organEnvPropsRef.current) {
        scene.remove(organEnvPropsRef.current.group);
      }

      // 5a. Spawn 3D Organ Wall & Floor Anatomical Props (Cilia & Mucus, Smooth Muscle & Acid, Microvilli & Bile, or Neurones)
      const envProps = createOrganEnvironmentProps(theme.id);
      scene.add(envProps.group);
      organEnvPropsRef.current = envProps;

      // 5b. Spawn Theme-Specific Panicking Cells in visible left/right flank lanes (with 3D "HELP US WBC!" speech badges)
      panickingRbcsRef.current = [];
      for (let i = 0; i < 4; i++) {
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
          -10 - i * 14
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

      // 5c. Spawn 5 Highly Visible Panicking Platelets across ALL Organ Themes (with waving arms & 3D "HELP!" speech bubbles!)
      panickingPlateletsRef.current = [];
      const plateletCries = [
        'HELP! PLATELETS!',
        'NEED FIBRIN!',
        'SAVE US WBC!',
        'CLOT NEEDED!',
        'PROTECT US!',
      ];
      for (let i = 0; i < 5; i++) {
        const plData = createPlateletModel(plateletCries[i % plateletCries.length]);
        const side = i % 2 === 0 ? -1 : 1;
        plData.group.position.set(
          side * (2.35 + (i % 2) * 0.78),
          -1.58 - (i % 2) * 0.28,
          -7 - i * 11.5
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

      // 5d. Spawn 6 Heroic Frowning Defenders strictly in OUTER FLANK LANES (|x| = 3.8 to 5.0) and AHEAD OF BARRICADES (z <= -6.5)
      // so they NEVER pass behind or collide with the player!
      heroicAntibodiesRef.current = [];
      for (let i = 0; i < 6; i++) {
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
        defenderData.group.position.set(laneX, laneY, -6.5 - i * 6.2);
        defenderData.group.rotation.y = laneX > 0 ? 0.25 : -0.25;
        scene.add(defenderData.group);
        heroicAntibodiesRef.current.push({
          mesh: defenderData.group,
          baseY: laneY,
          speed: 10.5 + (i % 3) * 2.0,
          trembleSeed: i * 4.2 + 1.5,
        });
      }

      // 5e. Pre-pool 4 Barricade Refugee meshes (2 Platelets + 2 Organ Cells) so mid-combat hiding scenes never allocate CanvasTextures!
      refugeePoolRef.current.forEach((item) => scene.remove(item.mesh));
      refugeePoolRef.current = [];
      const refugeeBadges = ['HIDING IN BUNKER!', 'COVER US WBC!', 'STAY BEHIND BAGS!', 'SAVED BY BUNKER!'];
      for (let pIdx = 0; pIdx < 4; pIdx++) {
        if (pIdx < 2) {
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

    function acquireEnemyFromPool(eType: 'strep' | 'bacillus' | 'tank'): PooledEnemySlot {
      for (let i = 0; i < enemyPool.length; i++) {
        const slot = enemyPool[i];
        if (!slot.inUse && slot.type === eType) {
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
      }
      const newSlot = allocateEnemyPoolSlot(eType);
      newSlot.inUse = true;
      newSlot.group.visible = true;
      return newSlot;
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

    // Pre-allocate Enemy Object Pool (4 Strep Troopers, 3 Bacillus Heavy Gunners, 2 Heavy Tanks - grows on demand)
    for (let i = 0; i < 4; i++) allocateEnemyPoolSlot('strep');
    for (let i = 0; i < 3; i++) allocateEnemyPoolSlot('bacillus');
    for (let i = 0; i < 2; i++) allocateEnemyPoolSlot('tank');

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

    // Pre-allocated Aircraft Pools (1 C-47 Airdrop Plane, 1 Blériot WW2 Bomber - grows on demand)
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
      const p = createTacticalAirdropPlane();
      scene.add(p.group);
      const item = { inUse: true, group: p.group, propellers: p.propellers };
      airdropPlanePool.push(item);
      return item;
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
      const b = createBleriotPlane();
      scene.add(b.group);
      const item = { inUse: true, group: b.group, propeller: b.propeller };
      bleriotPlanePool.push(item);
      return item;
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
      const bossPhaseMultiplier = 1 + phaseIndex * 0.2;
      const bossLevelBonusHits = Math.round(levelIndex * 2.8);
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
        hits = Math.round((18 + bossLevelBonusHits) * bossPhaseMultiplier);
        hp = hits * 45;
        speed = 3.1 + levelIndex * 0.22 + phaseIndex * 0.25;
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
        hits = Math.round((21 + bossLevelBonusHits) * bossPhaseMultiplier);
        hp = hits * 45;
        speed = 2.75 + levelIndex * 0.2 + phaseIndex * 0.22;
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
        hits = Math.round((23 + bossLevelBonusHits) * bossPhaseMultiplier);
        hp = hits * 45;
        speed = 4.2 + levelIndex * 0.22 + phaseIndex * 0.25;
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
      const levelIndex = levelNumber - 1; // 0..8
      const phaseIndex = phaseNumber - 1; // 0..2
      const diffScale = (levelIndex * 3 + phaseIndex) / 26;

      const phaseHpMultiplier = 1 + phaseIndex * 0.26;
      const levelHpMultiplier = 1 + levelIndex * 0.14;

      const activeTanks = activeSoldiersRef.current.filter((s) => s.isTank).length;
      const maxTanksAllowed =
        wave === 1
          ? phaseNumber >= 2 || levelNumber >= 2
            ? 1 + (levelNumber >= 6 ? 1 : 0)
            : 0
          : wave === 2
          ? 1 + (levelNumber >= 4 || phaseNumber >= 2 ? 1 : 0)
          : 1 + (levelNumber >= 3 ? 1 : 0) + (levelNumber >= 7 ? 1 : 0);
      const tankChance =
        wave === 1
          ? phaseNumber >= 2 || levelNumber >= 2
            ? 0.18 + levelIndex * 0.015
            : 0
          : wave === 2
          ? 0.25 + diffScale * 0.16
          : 0.32 + diffScale * 0.18;
      const shouldSpawnTank =
        forceType === 'tank' ||
        (!forceType && activeTanks < maxTanksAllowed && Math.random() < tankChance);

      const bacillusChance = Math.min(
        0.82,
        (wave === 1 ? 0.28 : wave === 2 ? 0.45 : 0.58) + levelIndex * 0.03 + phaseIndex * 0.06
      );

      const waveSpeedBase = wave === 1 ? 4.3 : wave === 2 ? 4.95 : 5.5;
      const difficultySpeedBonus = levelIndex * 0.22 + phaseIndex * 0.36;

      let hp = 160;
      let hitsLeft = 4;
      let speed = waveSpeedBase + difficultySpeedBonus;
      let value = 100;
      let name = 'Strepto Soldier';
      let isTank = false;
      let type: 'strep' | 'bacillus' | 'tank' = 'strep';

      if (shouldSpawnTank) {
        type = 'tank';
        hitsLeft = Math.round(9 * levelHpMultiplier * phaseHpMultiplier);
        hp = hitsLeft * 55;
        speed = 2.7 + wave * 0.26 + levelIndex * 0.11 + phaseIndex * 0.2;
        value = 750 + levelIndex * 65 + phaseIndex * 80;
        name = 'Heavy Bio-Battle Tank';
        isTank = true;
      } else if (forceType === 'bacillus' || (!forceType && Math.random() < bacillusChance)) {
        type = 'bacillus';
        hitsLeft = Math.round(5.5 * levelHpMultiplier * phaseHpMultiplier);
        hp = hitsLeft * 44;
        speed = waveSpeedBase + difficultySpeedBonus - 0.2;
        value = 150 + levelIndex * 18 + phaseIndex * 25;
        name = 'Bacillus Heavy Gunner';
      } else {
        type = 'strep';
        hitsLeft = Math.round(4 * levelHpMultiplier * phaseHpMultiplier);
        hp = hitsLeft * 42;
        speed = waveSpeedBase + difficultySpeedBonus + 0.35;
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
      const nowMs = performance.now();
      if (nowMs < nextDynamicSpawnAt) return;
      nextDynamicSpawnAt = nowMs + getDynamicSpawnDelayMs();

      const wave = getWaveNumber();
      const nonBossCount = activeSoldiersRef.current.filter((s) => !s.isBoss).length;
      const hasActiveBoss = activeSoldiersRef.current.some((s) => s.isBoss);
      const levelWaveBonus = Math.ceil((levelNumber - 1) * 0.75) + (phaseNumber - 1) * 2;
      const bossAdjustment = hasActiveBoss ? -2 : 0;
      const maxEnemiesForWave = Math.max(
        5,
        (wave === 1 ? 4 + phaseNumber : wave === 2 ? 6 + phaseNumber : 7 + phaseNumber) +
          levelWaveBonus +
          bossAdjustment
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

    let lastHitmarkerUiTime = 0;
    let lastBarricadeUiTime = 0;
    let lastBossHitsUiVal = -1;
    let operatorShootingResetTimer: number | null = null;
    let hitmarkerClearTimer: number | null = null;

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
      if (!operatorShootingResetTimer) {
        setOperatorMood('shooting');
      } else {
        window.clearTimeout(operatorShootingResetTimer);
      }
      operatorShootingResetTimer = window.setTimeout(() => {
        operatorShootingResetTimer = null;
        setOperatorMood('normal');
      }, 220);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(25);
      }

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

      hitVector.set(aimPosRef.current.x, aimPosRef.current.y);

      const soldiers = activeSoldiersRef.current;

      // If AUTO-AIM is enabled, magnetize shot vector toward nearest enemy within auto-aim lock cone (zero Vector3 allocation!)
      if (autoAimEnabledRef.current && soldiers.length > 0) {
        let bestDist = 0.55;
        let lockedNdcX = 0;
        let lockedNdcY = 0;
        let hasLock = false;
        for (let i = 0; i < soldiers.length; i++) {
          const s = soldiers[i];
          if (s.mesh.position.z >= -2) continue;
          _v1.copy(s.mesh.position);
          _v1.y += s.isRobot ? 1.2 : s.isTank ? 0.5 : 0.25;
          _v1.project(camera);
          const d = Math.hypot(_v1.x - hitVector.x, _v1.y - hitVector.y);
          if (d < bestDist) {
            bestDist = d;
            lockedNdcX = _v1.x;
            lockedNdcY = _v1.y;
            hasLock = true;
          }
        }
        if (hasLock) {
          hitVector.set(
            THREE.MathUtils.lerp(hitVector.x, lockedNdcX, 0.85),
            THREE.MathUtils.lerp(hitVector.y, lockedNdcY, 0.85)
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

      // Sight Scope (ADS) grants a +20% precision damage bonus!
      const scopeBonus = isScopedRef.current ? 1.2 : 1.0;

      for (let i = soldiers.length - 1; i >= 0; i--) {
        const soldier = soldiers[i];
        if (soldier.mesh.position.z >= -2) continue;

        // Fast 2D NDC bounding check before running analytical 3D ray-sphere checks!
        _v1.copy(soldier.mesh.position);
        _v1.y += soldier.isRobot ? 1.1 : soldier.isTank ? 0.45 : 0.25;
        _v1.project(camera);
        const ndcDist = Math.hypot(_v1.x - hitVector.x, _v1.y - hitVector.y);
        if (ndcDist > 0.48) continue;

        // 1. Tank Turret / Commander WEAK POINT (3.2x Critical Damage!) via analytical 3D ray-sphere check
        if (soldier.isTank && soldier.turret) {
          _v1.copy(soldier.mesh.position);
          _v1.y += 0.72;
          if (raycaster.ray.distanceSqToPoint(_v1) <= 0.34) {
            criticalHit = true;
            hitRegistered = true;
            hitSoldier = soldier;
            totalDamage =
              (activeWpn.category === 'SHOTGUN'
                ? activeWpn.damage * (activeWpn.pellets || 8) * 1.8
                : activeWpn.damage * 3.2) * scopeBonus;
            soldier.hp -= totalDamage;
            soldier.mesh.position.z -= 0.5;
            break;
          }
        }

        // 2. Cyber-Robot Core / Boss / Amoeba Nucleus Critical Hit via analytical 3D ray-sphere check
        if (soldier.coreMesh || soldier.nucleusMesh || soldier.isBoss) {
          _v1.copy(soldier.mesh.position);
          _v1.y += soldier.isRobot ? 1.15 : 0.52;
          const critRadiusSq = soldier.isRobot ? 0.42 : 0.28;
          if (raycaster.ray.distanceSqToPoint(_v1) <= critRadiusSq) {
            criticalHit = true;
            hitRegistered = true;
            hitSoldier = soldier;
            totalDamage = activeWpn.damage * 2.4 * scopeBonus;
            soldier.hp -= totalDamage;
            soldier.mesh.position.z -= 0.6;
            break;
          }
        }

        // 3. General Body Hit (Soldiers, Tanks, Bosses) via analytical 3D ray-sphere check (zero triangle traversal!)
        _v1.copy(soldier.mesh.position);
        _v1.y += soldier.isRobot ? 1.05 : soldier.isTank ? 0.42 : 0.25;
        const bodyRadiusSq = soldier.isTank
          ? 1.55
          : soldier.isBoss
          ? 1.85
          : 0.72;
        if (raycaster.ray.distanceSqToPoint(_v1) <= bodyRadiusSq) {
          hitRegistered = true;
          hitSoldier = soldier;
          totalDamage =
            (activeWpn.category === 'SHOTGUN'
              ? activeWpn.damage * (activeWpn.pellets || 8)
              : activeWpn.damage) * scopeBonus;
          soldier.hp -= totalDamage;
          soldier.mesh.position.z -= soldier.isTank ? 0.14 : soldier.isBoss ? 0.1 : 0.2;
          break;
        }
      }

      // Proximity assist: generous when AUTO-AIM is ON; tight precision hitbox when MANUAL AIM is selected!
      if (!hitRegistered) {
        for (let i = soldiers.length - 1; i >= 0; i--) {
          const soldier = soldiers[i];
          if (soldier.mesh.position.z >= -2) continue;
          _v1.copy(soldier.mesh.position);
          _v1.y += soldier.isRobot ? 1.1 : soldier.isTank ? 0.45 : 0.25;
          _v1.project(camera);
          const dist2D = Math.hypot(_v1.x - hitVector.x, _v1.y - hitVector.y);
          const assistRadius = autoAimEnabledRef.current
            ? soldier.isTank
              ? 0.44
              : soldier.isBoss
              ? 0.46
              : 0.28
            : soldier.isTank
            ? 0.15
            : soldier.isBoss
            ? 0.17
            : 0.11;
          if (dist2D < assistRadius) {
            hitRegistered = true;
            hitSoldier = soldier;
            totalDamage = activeWpn.damage * scopeBonus;
            soldier.hp -= totalDamage;
            soldier.mesh.position.z -= soldier.isTank ? 0.14 : soldier.isBoss ? 0.1 : 0.2;
            break;
          }
        }
      }

      if (hitRegistered && hitSoldier) {
        sounds.playHitmarker(criticalHit);

        if (now - lastHitmarkerUiTime > 160 || criticalHit) {
          lastHitmarkerUiTime = now;
          const markerId = now;
          setHitmarkers([
            {
              id: markerId,
              x: (hitVector.x + 1) * 50,
              y: (-hitVector.y + 1) * 50,
              isCritical: criticalHit,
              damage: Math.round(totalDamage),
            },
          ]);
          if (hitmarkerClearTimer) window.clearTimeout(hitmarkerClearTimer);
          hitmarkerClearTimer = window.setTimeout(() => {
            hitmarkerClearTimer = null;
            setHitmarkers([]);
          }, 180);
        }

        const isBossVehicle = Boolean(hitSoldier.isHelicopter || hitSoldier.isRobot || hitSoldier.isJet);
        const weaponHitPower =
          activeWpn.id === 'bolt_sniper'
            ? criticalHit
              ? 3.2
              : 2.2
            : activeWpn.id === 'pump_shotgun'
            ? criticalHit
              ? 2.2
              : 1.65
            : activeWpn.id === 'drum_gun'
            ? criticalHit
              ? 1.15
              : 0.85
            : criticalHit
            ? 1.35
            : 1.0;
        hitSoldier.hitsLeft = Math.max(
          0,
          Number((hitSoldier.hitsLeft - (isBossVehicle ? (criticalHit ? 1.5 : 1.0) : weaponHitPower)).toFixed(2))
        );

        if (isBossVehicle) {
          const flipDir = (hitSoldier.dodgeTargetX || 1) > 0 ? -1 : 1;
          hitSoldier.dodgeTargetX = flipDir * (1.5 + Math.random() * 1.4);
          hitSoldier.dodgeTargetY = (Math.random() - 0.5) * 0.7;
          hitSoldier.nextDodgeTime = now + 1100 + Math.random() * 600;
        }

        if (hitSoldier.hpBarFill) {
          const pct = Math.max(0.01, hitSoldier.hitsLeft / hitSoldier.maxHits);
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

        const isDefeated = hitSoldier.hitsLeft <= 0;

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

    // Input handlers (Phone and Laptop)
    const updateAimPosition = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      aimPosRef.current = { x: Math.max(-1, Math.min(1, x * 1.15)), y: Math.max(-1, Math.min(1, y * 1.15)) };

      // Dynamic crosshair position tracking where player aims & shoots (throttled to 25Hz for zero React re-render lag)
      const nowAim = performance.now();
      if (nowAim - lastAimUiUpdateRef.current > 40) {
        lastAimUiUpdateRef.current = nowAim;
        const screenX = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
        const screenY = Math.max(6, Math.min(92, ((clientY - rect.top) / rect.height) * 100));
        setAimScreenPos({ x: screenX, y: screenY });
      }
    };

    // Dedicated Multi-Touch Handlers for Phone (Allows simultaneous Moving & Shooting!)
    const handleTouchStart = (e: TouchEvent) => {
      sounds.unlockAudio();
      const rect = container.getBoundingClientRect();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const clientX = touch.clientX;
        const clientY = touch.clientY;

        // If touch begins in bottom-left movement zone (left 45%, bottom 55%)
        if (
          movementTouchIdRef.current === null &&
          clientX - rect.left < rect.width * 0.45 &&
          clientY - rect.top > rect.height * 0.45
        ) {
          movementTouchIdRef.current = touch.identifier;
          joystickCenterRef.current = { x: clientX, y: clientY };
          joystickOffsetRef.current = { x: 0, y: 0 };
          setJoystickDisplay({ x: clientX, y: clientY });
        } else if (firingTouchIdRef.current === null) {
          // Touch in aim/shoot zone
          firingTouchIdRef.current = touch.identifier;
          isPointerDownRef.current = true;
          setIsFiring(true);
          updateAimPosition(clientX, clientY);
          executeShot();
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
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
          moveInputRef.current.x = clampedX / maxDist;
          moveInputRef.current.z = clampedY / maxDist;
        } else if (touch.identifier === firingTouchIdRef.current) {
          updateAimPosition(touch.clientX, touch.clientY);
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
        }
      }
    };

    // Desktop Mouse Handlers (Left-Click Shoot, Right-Click Toggle Black Ops Sight Scope!)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleMouseDown = (e: MouseEvent) => {
      sounds.unlockAudio();
      setAudioSuspended(false);
      if (e.button === 2) {
        e.preventDefault();
        handleToggleScope();
        return;
      }
      isPointerDownRef.current = true;
      setIsFiring(true);
      updateAimPosition(e.clientX, e.clientY);
      executeShot();
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateAimPosition(e.clientX, e.clientY);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) return;
      isPointerDownRef.current = false;
      setIsFiring(false);
    };

    // Keyboard controls for Laptop (WASD movement, F Sight Scope, R reload, Space/E stim, G grenade, Q swap, T airdrop, M sound)
    const handleKeyDown = (e: KeyboardEvent) => {
      keysDownRef.current[e.key.toLowerCase()] = true;

      if (e.key === 'r' || e.key === 'R') {
        handleReload();
      } else if (e.key === 'f' || e.key === 'F') {
        handleToggleScope();
      } else if (e.key === ' ' || e.key === 'e' || e.key === 'E') {
        handleStimpack();
      } else if (e.key === 'g' || e.key === 'G') {
        handleThrowGrenade();
      } else if (e.key === 'q' || e.key === 'Q') {
        handleSwapWeapon();
      } else if (e.key === 't' || e.key === 'T') {
        handleAirdropReinforcements();
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

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // ANIMATION & 60 FPS SIMULATION LOOP
    let animationFrameId = 0;
    const clock = new THREE.Clock();
    let lastDamageTakenTime = 0;
    let regenAccumulator = 0;
    let lastCoverState = false;
    let lastCoverHp = 100;
    let lastTargetLockedState = false;
    let lastHudSyncTime = 0;
    let prevPlayerX = 0;
    let smoothedPlayerVelX = 0;

    // Helper: Trigger Dynamic Screen Shake & Directional Damage HUD Indicator (scales up as HP lowers!)
    const triggerDirectionalDamageFeedback = (
      sourceX: number,
      sourceZ: number,
      damageAmount: number,
      sourceType: DirectionalDamageIndicator['sourceType'],
      isSplash: boolean
    ) => {
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
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();
      const nowTime = performance.now();

      // Automatic fire on hold (SCAR / Drum LMG)
      if (isPointerDownRef.current && (currentWeaponRef.current.category === 'ASSAULT' || currentWeaponRef.current.category === 'MACHINE_GUN')) {
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

      // Clamp movement within organ tunnel boundaries
      playerPosRef.current.x = Math.max(-3.5, Math.min(3.5, playerPosRef.current.x));
      playerPosRef.current.z = Math.max(-0.8, Math.min(0.8, playerPosRef.current.z));

      // Track smoothed lateral player velocity so Enemy AI can predictively lead shots!
      const instVelX = (playerPosRef.current.x - prevPlayerX) / Math.max(0.008, delta);
      prevPlayerX = playerPosRef.current.x;
      smoothedPlayerVelX = THREE.MathUtils.damp(smoothedPlayerVelX, instVelX, 8, delta);

      // 2. UPDATE CAMERA, DYNAMIC HP-SCALED SCREEN SHAKE, SIGHT SCOPE ZOOM (ADS) & STABILIZED HORIZON PITCH
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
          ? 28
          : currentWeaponRef.current.category === 'SHOTGUN'
          ? 50
          : 40
        : 65;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 14, delta);
        camera.updateProjectionMatrix();
      }

      // Stabilized horizon pitch + dynamic rotational roll impulse when hit by mortar splash or boss missiles!
      cameraRollShakeRef.current = THREE.MathUtils.damp(cameraRollShakeRef.current, 0, 10, delta);
      const targetRoll = -inputX * 0.04 + cameraRollShakeRef.current;
      const targetYaw = -playerPosRef.current.x * 0.025 + aimPosRef.current.x * 0.08;
      const targetPitch = aimPosRef.current.y * 0.07 + Math.abs(cameraRollShakeRef.current) * 0.35;
      camera.rotation.z = THREE.MathUtils.damp(camera.rotation.z, targetRoll, 10, delta);
      camera.rotation.y = THREE.MathUtils.damp(camera.rotation.y, targetYaw, 10, delta);
      camera.rotation.x = THREE.MathUtils.damp(camera.rotation.x, targetPitch, 10, delta);

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

      // Update Active Grenades (Parabolic Arc & Detonation)
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

        // Explode on life expiry or hitting ground/enemies
        if (g.life <= 0 || g.mesh.position.y <= -2.5) {
          triggerExplosion(g.mesh.position);

          // AOE Grenade Damage to all enemies in 6.5 radius!
          const gPos = g.mesh.position;
          const soldiers = activeSoldiersRef.current;
          for (let j = soldiers.length - 1; j >= 0; j--) {
            const s = soldiers[j];
            const dist = s.mesh.position.distanceTo(gPos);
            if (dist < 6.5) {
              s.hp -= 280;
              s.hitsLeft -= 3;
              s.mesh.position.z -= 1.5;
              if (s.hpBarFill) {
                const pct = Math.max(0.01, s.hitsLeft / s.maxHits);
                s.hpBarFill.scale.x = pct;
                s.hpBarFill.position.x = -(0.82 * (1 - pct)) / 2;
              }
              if (s.hitsLeft <= 0 || s.hp <= 0) {
                triggerExplosion(s.mesh.position);
                releaseSoldierToPool(s);
                activeSoldiersRef.current.splice(j, 1);
                if (s.isHelicopter || s.isRobot || s.isJet) {
                  setBossInfo(null);
                }
                sounds.playKillConfirm();
                killsRef.current += 1;
                scoreRef.current += s.value;
                setKills(killsRef.current);
                setScore(scoreRef.current);
              }
            }
          }

          scene.remove(g.mesh);
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
          let nearestSign: (typeof env.roadSigns)[0] | null = null;
          let nearestDist = 999;

          env.roadSigns.forEach((sign) => {
            sign.mesh.position.z += (sign.speed + moveBoost) * delta;
            if (sign.mesh.position.z > 2.8) {
              sign.mesh.position.z = -86;
            }
            if (sign.mesh.position.z >= -18.5 && sign.mesh.position.z <= -2.0) {
              const d = Math.abs(sign.mesh.position.z - -8.5);
              if (d < nearestDist) {
                nearestDist = d;
                nearestSign = sign;
              }
            }
          });

          if (nearestSign) {
            const picked = nearestSign as (typeof env.roadSigns)[0];
            if (lastRoadSignTitleRef.current !== picked.title) {
              lastRoadSignTitleRef.current = picked.title;
              setPassingRoadSign({
                code: picked.code,
                title: picked.title,
                subtitle: picked.subtitle,
                distance: picked.distance,
                style: picked.style,
              });
            }
          }
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
        (currentWave === 1 ? 18 : currentWave === 2 ? 20.5 : 22.5) +
        diffScaleGlobal * 4.5;
      const soldierBulletDmg = Math.round(
        (currentWave === 1 ? 8 : currentWave === 2 ? 10 : 11) +
          diffScaleGlobal * 5
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
              const tankShellSpeed = 19.5 + diffScaleGlobal * 4.0;
              const tankShellDmg = Math.round(24 + diffScaleGlobal * 7);
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
              ? 10 + phaseNumber
              : soldier.isRobot
              ? 15 + phaseNumber * 2
              : 12 + phaseNumber * 2;
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
            onPhaseDefeat();
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
          const breachVoip = voipManager.triggerEventVoip('barricade_breached', organThemeRef.current.id);
          if (breachVoip) {
            setOrganRadioComm(breachVoip);
            setTimeout(() => {
              setOrganRadioComm((prev) => (prev === breachVoip ? null : prev));
            }, 4800);
          }
        }
        if (bar.hp <= 0 || nowTime - lastBarricadeUiTime > 200) {
          lastBarricadeUiTime = nowTime;
          setBarricadeHps(barricadesRef.current.map((b) => Math.round((b.hp / b.maxHp) * 100)));
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
            onPhaseDefeat();
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
                onPhaseDefeat();
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
          setBleriotAlert(
            `🪂 ENEMY TROOP AIRDROP #${dropIdx + 1} • 1 BIO-TANK + 2 TROOPS PARACHUTING AHEAD!`
          );
          setTimeout(() => setBleriotAlert(null), 4000);
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

      // Passive Leukocyte Cellular Regeneration when in cover or out of damage for 2.5s (keeps Phase 3 fair & beatable!)
      if (playerHpRef.current > 0 && playerHpRef.current < 100 && (inCover || elapsed - lastDamageTakenTime > 2.5)) {
        regenAccumulator += delta * (inCover ? 3.5 : 2.2);
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
              onPhaseDefeat();
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

          // Drop paratroopers once plane crosses over battle line
          if (!ad.alliesDropped && ad.plane.group.position.z >= -20) {
            ad.alliesDropped = true;

            const leftAlly = createAlliedWBCCommando(true);
            leftAlly.group.position.set(-3.2, 4.4, -14);
            scene.add(leftAlly.group);

            const rightAlly = createAlliedWBCCommando(false);
            rightAlly.group.position.set(3.2, 4.4, -14);
            scene.add(rightAlly.group);

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

          // Discard plane once it clears the front sector
          if (ad.plane.group.position.z > 25) {
            scene.remove(ad.plane.group);
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
            scene.remove(ally.group);
          });
          if (ad.plane) {
            scene.remove(ad.plane.group);
          }
          airdropRef.current = null;
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

      // 6. BLACK OPS AN/PEQ-15 TACTICAL LASER SIGHT TRACKING & TARGET LOCK DETECTION (Zero Vector3 allocation!)
      if (laserLineRef.current && laserDotRef.current) {
        _v1.set(
          playerPosRef.current.x + (isScopedRef.current ? 0.0 : 0.34) + aimPosRef.current.x * 0.08,
          (isScopedRef.current ? -0.52 : -0.26) + aimPosRef.current.y * 0.08,
          playerPosRef.current.z - 0.85
        );

        _v2.set(
          playerPosRef.current.x + aimPosRef.current.x * 20,
          aimPosRef.current.y * 14,
          -46
        );
        let lockedOnEnemy = false;

        for (let i = 0; i < activeSoldiersRef.current.length; i++) {
          const s = activeSoldiersRef.current[i];
          if (s.mesh.position.z >= -2) continue;
          _v3.copy(s.mesh.position);
          _v3.y += s.isRobot ? 1.15 : s.isTank ? 0.45 : 0.25;
          _v4.copy(_v3).project(camera);
          const d = Math.hypot(_v4.x - aimPosRef.current.x, _v4.y - aimPosRef.current.y);
          const lockRadius = autoAimEnabledRef.current ? 0.32 : 0.16;
          if (d < lockRadius) {
            lockedOnEnemy = true;
            _v2.copy(_v3);
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

      // 7. TACTICAL RADAR & TARGET LOCK RANGEFINDER (Throttled to every 260ms for zero React re-render lag)
      if (nowTime - lastHudSyncTime >= 260) {
        lastHudSyncTime = nowTime;
        const blips: Array<{ x: number; y: number; isTank: boolean; isAllied: boolean }> = [];
        activeSoldiersRef.current.forEach((s) => {
          const relX = (s.mesh.position.x - playerPosRef.current.x) / 7.0;
          const relZ = (s.mesh.position.z - playerPosRef.current.z) / -55;
          blips.push({ x: relX, y: Math.max(0, Math.min(1, relZ)), isTank: s.isTank, isAllied: false });
        });
        if (airdropRef.current) {
          airdropRef.current.allies.forEach((a) => {
            const relX = (a.group.position.x - playerPosRef.current.x) / 7.0;
            const relZ = (a.group.position.z - playerPosRef.current.z) / -55;
            blips.push({ x: relX, y: Math.max(0, Math.min(1, relZ)), isTank: false, isAllied: true });
          });
        }
        setRadarBlips(blips);

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

        const baseWpnX = isScopedRef.current && !isReloadingRef.current ? 0.05 : 0.36;
        const baseWpnY = (isScopedRef.current && !isReloadingRef.current ? -0.68 : -0.34) + reloadOffsetY;
        const baseWpnZ = (isScopedRef.current && !isReloadingRef.current ? -0.58 : -0.82) + reloadOffsetZ;

        weaponMeshRef.current.visible = isReloadingRef.current || !isScopedRef.current || camera.fov > 55;

        const targetX = baseWpnX - inputX * (isScopedRef.current ? 0.02 : 0.07) + aimPosRef.current.x * (isScopedRef.current ? 0.02 : 0.09);
        const targetY = baseWpnY - Math.abs(inputX) * 0.02 + aimPosRef.current.y * (isScopedRef.current ? 0.02 : 0.09);
        const targetRotZ = inputX * (isScopedRef.current ? 0.03 : 0.1) + reloadRotZ;
        weaponMeshRef.current.position.x = THREE.MathUtils.damp(weaponMeshRef.current.position.x, targetX, 14, delta);
        weaponMeshRef.current.position.y = THREE.MathUtils.damp(weaponMeshRef.current.position.y, targetY, 14, delta);
        weaponMeshRef.current.position.z = THREE.MathUtils.damp(weaponMeshRef.current.position.z, baseWpnZ + recoilRef.current.z, 14, delta);
        weaponMeshRef.current.rotation.x = THREE.MathUtils.damp(weaponMeshRef.current.rotation.x, 0.04 - recoilRef.current.rotX + reloadRotX, 14, delta);
        weaponMeshRef.current.rotation.z = THREE.MathUtils.damp(weaponMeshRef.current.rotation.z, targetRotZ, 12, delta);
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
      container.removeEventListener('touchend', handleTouchEnd);

      wallGeo.dispose();
      wallMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();

      activeSoldiersRef.current.forEach((s) => scene.remove(s.mesh));
      panickingRbcsRef.current.forEach((r) => scene.remove(r.mesh));
      panickingPlateletsRef.current.forEach((p) => scene.remove(p.mesh));
      barricadeRefugeesRef.current.forEach((br) => scene.remove(br.mesh));
      heroicAntibodiesRef.current.forEach((a) => scene.remove(a.mesh));
      if (organEnvPropsRef.current) scene.remove(organEnvPropsRef.current.group);
      activeBleriotRunsRef.current.forEach((br) => scene.remove(br.group));
      activeEnemyAirdropsRef.current.forEach((ea) => scene.remove(ea.group));
      activeMortarBombsRef.current.forEach((mb) => scene.remove(mb.mesh));
      activeBossRocketsRef.current.forEach((rk) => scene.remove(rk.mesh));
      barricadesRef.current.forEach((b) => scene.remove(b.group));
      activeEnemyBulletsRef.current.forEach((b) => scene.remove(b.mesh));
      activeShellsRef.current.forEach((sh) => scene.remove(sh.mesh));
      if (laserLineRef.current) scene.remove(laserLineRef.current);
      if (laserGlowLineRef.current) scene.remove(laserGlowLineRef.current);
      if (laserDotRef.current) scene.remove(laserDotRef.current);
      if (laserRingRef.current) scene.remove(laserRingRef.current);
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black select-none">
      {/* 3D WebGL Canvas with Dynamic Black Ops Optics Filter */}
      <div
        ref={mountRef}
        className={`absolute inset-0 w-full h-full cursor-none z-0 transition-all ${
          visionMode === 'nvg'
            ? 'filter-nvg'
            : visionMode === 'thermal'
            ? 'filter-thermal'
            : ''
        }`}
      />

      {/* Military Scanlines & Vignette */}
      <div className="absolute inset-0 hud-scanlines pointer-events-none z-10 opacity-30" />
      <div className={`absolute inset-0 hud-vignette pointer-events-none z-10 ${playerHp < 35 ? 'danger-vignette' : ''}`} />
      {operatorMood === 'hit' && <div className="absolute inset-0 visor-damage z-10 animate-pulse" />}

      {/* SUBTLE DIRECTIONAL DAMAGE INDICATOR OVERLAY (Scales in intensity as HP lowers!) */}
      {damageIndicators.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
          {damageIndicators.map((ind) => {
            const hpDangerRatio = Math.max(0, (100 - playerHp) / 100);
            const alpha = Math.min(0.95, ind.intensity * (0.65 + hpDangerRatio * 0.35));
            const ringScale = 1 + hpDangerRatio * 0.22 + (ind.isSplash ? 0.08 : 0);
            const isExplosive = ind.sourceType === 'MORTAR SPLASH' || ind.sourceType === 'BOSS MISSILE';

            return (
              <React.Fragment key={ind.id}>
                {/* Directional Screen-Edge Gradient Pulse (Left, Top-Center, or Right Flank) */}
                <div
                  className="absolute inset-0 transition-opacity duration-300"
                  style={{
                    opacity: alpha * 0.75,
                    background:
                      ind.sector === 'left'
                        ? `radial-gradient(ellipse at 0% 50%, rgba(239, 68, 68, ${alpha * 0.55}) 0%, rgba(249, 115, 22, ${alpha * 0.22}) 32%, transparent 68%)`
                        : ind.sector === 'right'
                        ? `radial-gradient(ellipse at 100% 50%, rgba(239, 68, 68, ${alpha * 0.55}) 0%, rgba(249, 115, 22, ${alpha * 0.22}) 32%, transparent 68%)`
                        : `radial-gradient(ellipse at 50% 0%, rgba(239, 68, 68, ${alpha * 0.58}) 0%, rgba(249, 115, 22, ${alpha * 0.24}) 35%, transparent 70%)`,
                  }}
                />

                {/* Central Tactical Directional Arc & Double-Chevron Pointer */}
                <div
                  className="absolute left-1/2 top-1/2 w-[260px] h-[260px] sm:w-[340px] sm:h-[340px]"
                  style={{
                    transform: `translate(-50%, -50%) rotate(${ind.angleDeg}deg) scale(${ringScale})`,
                    opacity: alpha,
                  }}
                >
                  {/* Glowing Threat Arc at Top of Rotated Ring */}
                  <div
                    className={`absolute top-0 left-1/2 -translate-x-1/2 w-36 sm:w-44 h-12 rounded-t-full border-t-[4px] ${
                      isExplosive
                        ? 'border-amber-400 shadow-[0_-10px_28px_rgba(239,68,68,0.85)]'
                        : 'border-red-500 shadow-[0_-8px_22px_rgba(239,68,68,0.75)]'
                    }`}
                  />
                  {/* Outer & Inner Tactical Threat Chevrons */}
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div
                      className={`w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[12px] ${
                        isExplosive ? 'border-b-amber-400' : 'border-b-red-500'
                      } drop-shadow-[0_0_10px_rgba(239,68,68,0.95)]`}
                    />
                    <div
                      className="w-0 h-0 -mt-1 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[8px] border-b-red-500"
                    />
                  </div>
                </div>

                {/* Subtle Directional Impact Telemetry Tag */}
                <div
                  className={`absolute top-[22%] ${
                    ind.sector === 'left'
                      ? 'left-6 sm:left-12'
                      : ind.sector === 'right'
                      ? 'right-6 sm:right-12'
                      : 'left-1/2 -translate-x-1/2'
                  } px-2.5 py-0.5 rounded bg-red-950/80 border ${
                    isExplosive ? 'border-amber-400/80 text-amber-200' : 'border-red-500/75 text-red-200'
                  } text-[9px] font-mono font-bold tracking-widest uppercase shadow-[0_0_18px_rgba(239,68,68,0.5)]`}
                  style={{ opacity: alpha }}
                >
                  {ind.isSplash ? '💥 SPLASH DAMAGE' : '⚠️ DIRECT IMPACT'} • {ind.sourceType} [{ind.sector.toUpperCase()}]
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* CALL OF DUTY: BLACK OPS SIGHT SCOPE (ADS) OPTICAL OVERLAY — 100% Crystal-Clear Unobstructed Lens */}
      {isScoped && (
        <div
          className="absolute inset-0 pointer-events-none z-15 transition-opacity duration-150"
          style={{
            background: `radial-gradient(circle at ${aimScreenPos.x}% ${aimScreenPos.y}%, transparent 0px, transparent 185px, rgba(6, 182, 212, 0.14) 205px, rgba(2, 6, 23, 0.72) 215px, rgba(0, 0, 0, 0.88) 100%)`,
          }}
        >
          <div
            className="absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
            style={{ left: `${aimScreenPos.x}%`, top: `${aimScreenPos.y}%` }}
          >
            {/* Outer Precision Scope Housing Ring */}
            <div
              className={`w-[320px] h-[320px] sm:w-[420px] sm:h-[420px] rounded-full border-[3px] relative flex items-center justify-center transition-colors ${
                isTargetLocked
                  ? 'border-red-500/90 shadow-[0_0_35px_rgba(239,68,68,0.45)]'
                  : 'border-cyan-400/85 shadow-[0_0_30px_rgba(6,182,212,0.35)]'
              }`}
            >
              {/* Inner Mil-Dot Range Ring */}
              <div
                className={`w-[180px] h-[180px] sm:w-[230px] sm:h-[230px] rounded-full border border-dashed ${
                  isTargetLocked ? 'border-red-400/50' : 'border-cyan-400/45'
                }`}
              />
              {/* Horizontal Stadia Line with Center Aperture Gap so Center Target is Never Covered */}
              <div className={`absolute left-0 w-[42%] h-px ${isTargetLocked ? 'bg-red-500/75' : 'bg-cyan-400/70'}`} />
              <div className={`absolute right-0 w-[42%] h-px ${isTargetLocked ? 'bg-red-500/75' : 'bg-cyan-400/70'}`} />
              {/* Vertical Stadia Line with Center Aperture Gap */}
              <div className={`absolute top-0 h-[42%] w-px ${isTargetLocked ? 'bg-red-500/75' : 'bg-cyan-400/70'}`} />
              <div className={`absolute bottom-0 h-[42%] w-px ${isTargetLocked ? 'bg-red-500/75' : 'bg-cyan-400/70'}`} />

              {/* Bullet Drop Compensator (BDC) Chevrons */}
              <div className="absolute top-[58%] w-3.5 h-px bg-cyan-300/75" />
              <div className="absolute top-[65%] w-5 h-px bg-cyan-300/65" />
              <div className="absolute top-[72%] w-6.5 h-px bg-cyan-300/55" />

              {/* Scope Telemetry Readouts */}
              <div className="absolute top-3.5 text-[9px] font-mono font-bold tracking-widest text-cyan-300 bg-black/70 px-2 py-0.5 rounded border border-cyan-500/40">
                {currentWeapon.category === 'SNIPER'
                  ? 'BALLISTIC 8.0x MIL-DOT OPTIC'
                  : currentWeapon.category === 'MACHINE_GUN'
                  ? 'TARGET FINDER 3.2x OPTIC'
                  : 'EOTECH HOLOGRAPHIC 2.4x SIGHT'}
              </div>
              <div
                className={`absolute bottom-3.5 text-[9px] font-mono font-bold tracking-widest px-2 py-0.5 rounded border ${
                  isTargetLocked
                    ? 'bg-red-950/85 border-red-500 text-red-300'
                    : 'bg-black/70 border-emerald-500/40 text-emerald-300'
                }`}
              >
                {isTargetLocked ? '◆ TARGET ACQUIRED • FIRE WHEN READY' : 'PEQ-15 LASER RANGING ACTIVE'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Black Ops Night-Vision & Thermal Optics Overlays */}
      {visionMode === 'nvg' && (
        <div className="absolute inset-0 nvg-overlay z-10 flex flex-col justify-between p-3 pointer-events-none">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-emerald-400 tracking-wider">
            <span>[ NVG GEN-3 PHOSPHOR • AUTO-GAIN ]</span>
            <span>THERMAL LOAD: {Math.round(((15 - opticsTimeRemaining) / 15) * 100)}%</span>
            <span>ACTIVE: {opticsTimeRemaining}s BEFORE OVERHEAT</span>
          </div>
        </div>
      )}
      {visionMode === 'thermal' && (
        <div className="absolute inset-0 thermal-overlay z-10 flex flex-col justify-between p-3 pointer-events-none">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-orange-400 tracking-wider">
            <span>[ FLIR THERMAL 12µm • WHITE HOT ]</span>
            <span>THERMAL LOAD: {Math.round(((15 - opticsTimeRemaining) / 15) * 100)}%</span>
            <span>ACTIVE: {opticsTimeRemaining}s BEFORE OVERHEAT</span>
          </div>
        </div>
      )}

      {/* Compact Micro Enemy Indicator (Floats high above enemy, never blocks view) */}
      {targetLocks.map((lock) => (
        <div
          key={lock.id}
          className="absolute pointer-events-none z-20 transform -translate-x-1/2 -translate-y-full transition-all duration-75"
          style={{ left: `${lock.x}%`, top: `${lock.y}%` }}
        >
          <div className={`px-1.5 py-0.2 rounded border text-[7px] font-mono leading-tight flex items-center gap-1 ${
            lock.isTank
              ? 'border-red-500/60 bg-black/45 text-red-300'
              : 'border-cyan-400/50 bg-black/40 text-cyan-200'
          }`}>
            <span className="truncate max-w-[64px] font-bold">{lock.name.split(' ')[0]}</span>
            <span className={lock.hpPercent < 40 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>{lock.hpPercent}%</span>
          </div>
        </div>
      ))}

      {/* Virtual Joystick Visual Indicator on Phone */}
      {joystickDisplay && (
        <div
          className="fixed pointer-events-none z-30 transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${joystickDisplay.x}px`, top: `${joystickDisplay.y}px` }}
        >
          <div className="w-24 h-24 rounded-full border-2 border-cyan-400/60 bg-black/40 flex items-center justify-center">
            <div
              className="w-10 h-10 rounded-full bg-cyan-400/80 shadow-[0_0_12px_#06b6d4] transform"
              style={{
                transform: `translate(${joystickOffsetRef.current.x}px, ${joystickOffsetRef.current.y}px)`,
              }}
            />
          </div>
        </div>
      )}

      {/* Hitmarkers */}
      {hitmarkers.map((marker) => (
        <div
          key={marker.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 animate-hitmarker"
          style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
        >
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div className={`absolute w-3.5 h-0.5 ${marker.isCritical ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-white shadow-[0_0_6px_#fff]'} rotate-45`} />
            <div className={`absolute w-3.5 h-0.5 ${marker.isCritical ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-white shadow-[0_0_6px_#fff]'} -rotate-45`} />
            {marker.isCritical && (
              <span className="absolute -top-5 text-[11px] font-display font-bold text-red-400 tracking-wider">
                CRIT
              </span>
            )}
          </div>
        </div>
      ))}

      {/* TACTICAL BLACK OPS HUD OVERLAY */}
      <div className="absolute inset-0 flex flex-col justify-between p-2 sm:p-4 pointer-events-none z-20">
        
        {/* TOP STATUS BAR */}
        <div className="flex items-start justify-between w-full">
          {/* Left: WBC Operator Cam & Sector Info */}
          <div className="flex items-center space-x-2 bg-black/85 border border-slate-700/80 p-1.5 sm:p-2 rounded-md pointer-events-auto shadow-lg">
            <div className="relative w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-slate-900 border-2 border-cyan-400 overflow-hidden shrink-0 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.4)]">
              <div className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 flex items-center justify-center transition-all ${operatorMood === 'shooting' ? 'scale-110' : operatorMood === 'hit' ? 'bg-red-200' : ''}`}>
                <div className="absolute top-2 w-7 h-2.5 bg-cyan-500 rounded-xs shadow-[0_0_6px_#06b6d4]" />
                <div className="absolute top-2.5 flex space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
                <div className={`absolute bottom-2 ${operatorMood === 'shooting' ? 'w-3 h-2 rounded-full bg-black' : operatorMood === 'hit' ? 'w-3 h-0.5 bg-red-800' : 'w-2 h-0.5 bg-slate-600'}`} />
              </div>
            </div>

            <div className="text-left">
              <div className="flex items-center space-x-1.5 flex-wrap">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-bold">
                  {organTheme.name}
                </span>
                <button
                  onClick={() => {
                    sounds.playRadioChirp();
                    const curIdx = ORGAN_THEMES.findIndex((t) => t.id === organTheme.id);
                    const nextTheme = ORGAN_THEMES[(curIdx + 1) % ORGAN_THEMES.length];
                    setOrganTheme(nextTheme);
                    organThemeRef.current = nextTheme;
                    if (rebuildOrganThemeRef.current) {
                      rebuildOrganThemeRef.current(nextTheme);
                    }
                  }}
                  className="px-1.5 py-0.5 rounded bg-cyan-950/90 hover:bg-cyan-800 border border-cyan-500/60 text-[8px] font-mono text-cyan-200 font-bold uppercase tracking-wider cursor-pointer transition-colors"
                  title="Switch Anatomical Organ Setting (Bloodstream, Trachea/Alveoli, Stomach Acid, Intestine Microvilli, Brain/Spinal Cord)"
                >
                  [ORGAN THEME ↻]
                </button>
                <RankBadge xp={playerXp + score} compact />
              </div>
              <div className="text-[8px] font-mono text-slate-300 mt-0.5 truncate max-w-[230px] sm:max-w-[300px]">
                <span className="text-emerald-300 font-semibold">{organTheme.heroicDefenderLabel}</span>
                {' · '}
                <span className="text-amber-300">{organTheme.panickingCellLabel}</span>
              </div>
              <div className={`mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-bold tracking-wide border transition-all ${
                isPlayerInCover 
                  ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                  : 'bg-slate-900/80 border-amber-500/50 text-amber-300'
              }`}>
                <span>
                  {isPlayerInCover
                    ? `🛡️ IN COVER (SANDBAG HP: ${activeCoverHp}%)`
                    : '⚠️ EXPOSED (STAND BEHIND SANDBAGS)'}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[8px] font-mono text-slate-300">
                <span>BUNKERS:</span>
                {barricadeHps.map((bhp, idx) => (
                  <span
                    key={idx}
                    className={`px-1 rounded border ${
                      bhp > 50
                        ? 'border-emerald-500/60 bg-emerald-950/60 text-emerald-300'
                        : bhp > 0
                        ? 'border-amber-500/60 bg-amber-950/60 text-amber-300'
                        : 'border-red-500/60 bg-red-950/60 text-red-400'
                    }`}
                  >
                    {idx === 0 ? 'L' : idx === 1 ? 'C' : 'R'}:{bhp}%
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Center: Black Ops Azimuth Compass Tape, Countdown Clock & Clear Controls Strip */}
          <div className="flex flex-col items-center">
            {/* Level, Phase & Wave Progression Header */}
            <div className="flex items-center space-x-1.5 font-mono text-[9px] text-cyan-300 bg-black/85 px-2.5 py-0.5 rounded border border-cyan-800/80 mb-1 shadow-md">
              <Compass className="w-3 h-3 text-cyan-400 animate-spin-slow" />
              <span className="font-bold text-cyan-300">LVL {levelNumber}</span>
              <span aria-hidden="true">·</span>
              <span className="font-bold text-white">PHASE {phaseNumber}/3</span>
              <span aria-hidden="true">·</span>
              <span
                className={`font-bold ${
                  timeLeft > 40
                    ? 'text-emerald-400'
                    : timeLeft > 20
                    ? 'text-amber-400'
                    : 'text-red-400 animate-pulse'
                }`}
              >
                {timeLeft > 40
                  ? 'WAVE 1/3 (VANGUARD)'
                  : timeLeft > 20
                  ? 'WAVE 2/3 (ARMORED + BOSS)'
                  : 'WAVE 3/3 (FINAL SWARM)'}
              </span>
            </div>

            <div className="bg-black/85 border border-amber-500/70 px-3 sm:px-4 py-1 rounded-md flex items-center space-x-2 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
              <span className="text-[10px] font-display font-semibold text-amber-400 tracking-wider">
                DEFENSE
              </span>
              <span className="text-xl sm:text-3xl font-display font-bold text-white tracking-widest tabular-nums">
                00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
              </span>
            </div>

            {/* Clear Tactical Controls Bar */}
            <div className="hidden md:flex items-center gap-2 mt-1 px-2.5 py-0.5 rounded bg-slate-950/90 border border-slate-700/80 text-[8px] font-mono text-slate-300">
              <span><strong className="text-cyan-400">WALK:</strong> WASD</span>
              <span>·</span>
              <span><strong className="text-emerald-400">AIM:</strong> MOUSE</span>
              <span>·</span>
              <span><strong className="text-amber-400">SCOPE:</strong> R-CLICK / F</span>
              <span>·</span>
              <span><strong className="text-red-400">SHOOT:</strong> L-CLICK</span>
            </div>

            {bleriotAlert && (
              <div className="mt-1.5 px-2.5 py-1 rounded bg-red-950/90 border border-red-500 text-[10px] font-mono font-bold text-red-200 tracking-wider animate-pulse shadow-[0_0_14px_rgba(239,68,68,0.65)]">
                {bleriotAlert}
              </div>
            )}

            {/* Funny Anatomical Highway Sign / 3D Landmark Ticker */}
            {passingRoadSign && (
              <div
                className={`mt-1 px-2.5 py-0.5 rounded-md border-2 shadow-md flex items-center gap-2 transition-all duration-300 ${
                  passingRoadSign.style === 'roundabout'
                    ? 'bg-sky-950/90 border-sky-300 text-white'
                    : passingRoadSign.style === 'warning'
                    ? 'bg-amber-950/90 border-yellow-300 text-amber-100'
                    : passingRoadSign.style === 'landmark'
                    ? 'bg-indigo-950/90 border-yellow-300 text-white'
                    : 'bg-emerald-950/90 border-slate-100 text-white'
                }`}
              >
                <span
                  className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-black tracking-tighter ${
                    passingRoadSign.style === 'warning' || passingRoadSign.style === 'landmark'
                      ? 'bg-yellow-300 text-slate-950'
                      : 'bg-white text-slate-950'
                  }`}
                >
                  {passingRoadSign.code}
                </span>
                <div className="text-left leading-tight">
                  <div className="text-[9px] sm:text-[10px] font-display font-black tracking-wider uppercase flex items-center gap-1.5">
                    <span>{passingRoadSign.title}</span>
                    <span className="text-[8px] font-mono font-bold opacity-85">[{passingRoadSign.distance}]</span>
                  </div>
                  <div className="text-[7px] sm:text-[8px] font-mono text-slate-200/90 tracking-wide">
                    {passingRoadSign.subtitle}
                  </div>
                </div>
              </div>
            )}

            {/* VOIP Manager: Context-Specific Radio Chatter Clips from Organs */}
            {organRadioComm && (
              <div className="mt-1 px-2.5 py-1 rounded-md bg-slate-950/92 border border-cyan-400/85 shadow-[0_0_15px_rgba(6,182,212,0.45)] max-w-xs sm:max-w-md flex items-center gap-2">
                <div className="flex items-end gap-0.5 h-3.5 shrink-0">
                  <span className="w-0.5 h-2 bg-cyan-400 animate-pulse" />
                  <span className="w-0.5 h-3.5 bg-emerald-400 animate-bounce" />
                  <span className="w-0.5 h-2.5 bg-cyan-300 animate-pulse" />
                  <span className="w-0.5 h-3 bg-emerald-400 animate-bounce" />
                </div>
                <div className="text-left leading-tight">
                  <div className="flex items-center gap-1.5 text-[8px] font-mono font-bold text-cyan-300 uppercase tracking-wider flex-wrap">
                    <span>📻 [VOIP {organRadioComm.frequency}] {organRadioComm.callsign}</span>
                    <span
                      className={`px-1 rounded text-white text-[7px] ${
                        organRadioComm.urgency === 'REINFORCE'
                          ? 'bg-emerald-600/90'
                          : organRadioComm.urgency === 'CRITICAL'
                          ? 'bg-red-600/90'
                          : 'bg-amber-600/90'
                      }`}
                    >
                      {organRadioComm.urgency}
                    </span>
                  </div>
                  <div className="text-[8px] sm:text-[9px] font-mono text-slate-100">
                    "{organRadioComm.message}"
                  </div>
                </div>
              </div>
            )}

            {/* Audible Cell & Platelet Distress Callout Subtitle */}
            {cellDistressBanner && !organRadioComm && (
              <div className="mt-1 px-2.5 py-0.5 rounded bg-amber-950/90 border border-amber-400/80 text-[8px] sm:text-[9px] font-mono font-bold text-amber-200 shadow-md">
                {cellDistressBanner}
              </div>
            )}
          </div>

          {/* Right: Threat Radar + Score + Scope / Aim Mode / Optics Toggles */}
          <div className="bg-black/85 border border-slate-700/80 p-1.5 sm:p-2 rounded-md text-right pointer-events-auto flex items-center gap-2 sm:gap-3 shadow-lg">
            {/* Tactical Circular Threat Radar */}
            <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-slate-950/95 border-2 border-cyan-500/80 overflow-hidden shadow-[0_0_12px_rgba(6,182,212,0.3)] shrink-0">
              <div className="absolute inset-1 rounded-full border border-cyan-500/30" />
              <div className="absolute inset-3.5 rounded-full border border-cyan-500/30" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-px bg-cyan-500/20" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-full w-px bg-cyan-500/20" />
              </div>
              <div className="absolute inset-0 radar-sweep-line pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 bg-cyan-300 rounded-full shadow-[0_0_6px_#06b6d4]" />
              {radarBlips.map((b, i) => {
                const posX = Math.max(10, Math.min(90, 50 + b.x * 38));
                const posY = Math.max(10, Math.min(90, 50 - b.y * 40));
                return (
                  <div
                    key={i}
                    className={`absolute rounded-full transform -translate-x-1/2 -translate-y-1/2 ${
                      b.isAllied
                        ? 'bg-sky-400 w-1.5 h-1.5 shadow-[0_0_6px_#38bdf8]'
                        : b.isTank
                        ? 'bg-red-500 w-2.5 h-2.5 shadow-[0_0_8px_#ef4444]'
                        : 'bg-red-400 w-1.5 h-1.5'
                    }`}
                    style={{ left: `${posX}%`, top: `${posY}%` }}
                  />
                );
              })}
            </div>

            <div className="flex flex-col items-end">
              <div className="text-base sm:text-xl font-display font-bold text-amber-400 tabular-nums">
                {score}
              </div>
              <div className="text-[9px] font-mono text-cyan-400">
                KILLS: <span className="font-bold">{kills}</span>
                {comboStreak >= 3 && (
                  <span className="ml-1 px-1 py-0.2 bg-red-950 border border-red-500 text-red-300 font-bold rounded">
                    {comboStreak}x
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-1 mt-1">
                {/* Auto-Aim vs Manual Aim Live Toggle */}
                {onToggleAutoAim && (
                  <button
                    onClick={onToggleAutoAim}
                    className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold flex items-center gap-1 active:scale-95 cursor-pointer shadow transition-all ${
                      autoAimEnabled
                        ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300'
                        : 'bg-amber-950/90 border-amber-400 text-amber-300'
                    }`}
                    title="Switch between Auto-Aim Lock-On and Manual Scope Precision Aiming"
                  >
                    <Crosshair className="w-2.5 h-2.5" />
                    <span>{autoAimEnabled ? 'AIM: AUTO' : 'AIM: MANUAL'}</span>
                  </button>
                )}

                {/* Black Ops Sight Scope (ADS) Toggle Button */}
                <button
                  onClick={handleToggleScope}
                  className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold flex items-center gap-1 active:scale-95 cursor-pointer shadow transition-all ${
                    isScoped
                      ? 'bg-cyan-950 border-cyan-300 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.7)]'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300'
                  }`}
                  title="Toggle Black Ops Sight Scope (ADS) [Right-Click or Key: F]"
                >
                  <Crosshair className="w-2.5 h-2.5 text-cyan-400" />
                  <span>{isScoped ? 'SCOPE: ON [F]' : 'SCOPE [F]'}</span>
                </button>

                {/* Audio Mute/Unmute Toggle Button */}
                <button
                  onClick={handleSoundToggle}
                  className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold flex items-center gap-1 active:scale-95 cursor-pointer shadow transition-all ${
                    soundEnabled && !audioSuspended
                      ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300'
                      : 'bg-red-950/90 border-red-500 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.6)]'
                  }`}
                  title="Toggle Audio / Mute [Key: M]"
                >
                  {soundEnabled && !audioSuspended ? (
                    <Volume2 className="w-2.5 h-2.5 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-2.5 h-2.5 text-red-400" />
                  )}
                  <span>{soundEnabled && !audioSuspended ? 'AUDIO [M]' : 'UNMUTE'}</span>
                </button>

                {/* Optics Mode Toggle Button with Overheat & Cooling */}
                <button
                  onClick={handleToggleVisionMode}
                  disabled={opticsCooldown > 0}
                  className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold flex items-center gap-1 transition-all ${
                    opticsCooldown > 0
                      ? 'bg-red-950/90 border-red-500 text-red-300 cursor-not-allowed'
                      : visionMode === 'nvg'
                      ? 'bg-emerald-950 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)] cursor-pointer active:scale-95'
                      : visionMode === 'thermal'
                      ? 'bg-orange-950 border-orange-400 text-orange-300 shadow-[0_0_10px_rgba(251,146,60,0.5)] cursor-pointer active:scale-95'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300 cursor-pointer active:scale-95'
                  }`}
                  title="Toggle Black Ops Optics (Normal / NVG / Thermal) [Key: N]"
                >
                  <Eye className="w-2.5 h-2.5" />
                  <span>
                    {opticsCooldown > 0
                      ? `COOLING (${opticsCooldown}s)`
                      : visionMode === 'nvg'
                      ? `NVG (${opticsTimeRemaining}s)`
                      : visionMode === 'thermal'
                      ? `FLIR (${opticsTimeRemaining}s)`
                      : 'OPTICS [N]'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* AUDIO ACTIVATION / UNMUTE ALERT BANNER */}
        {(!soundEnabled || audioSuspended) && (
          <div className="w-full flex justify-center pointer-events-auto my-1 z-35">
            <button
              onClick={handleSoundToggle}
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-black text-xs tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.85)] border-2 border-amber-300 flex items-center gap-2 cursor-pointer active:scale-95 animate-pulse"
            >
              <Volume2 className="w-4 h-4 text-black" />
              <span>{!soundEnabled ? '⚠️ AUDIO MUTED • TAP HERE TO UNMUTE' : '🔊 AUDIO IN STANDBY • TAP TO ACTIVATE HARDWARE'}</span>
            </button>
          </div>
        )}

        {/* PHASE BOSS HEALTH BAR */}
        {bossInfo && (
          <div className="w-full max-w-md mx-auto my-1 bg-black/90 border-2 border-red-500 rounded p-1.5 shadow-[0_0_16px_rgba(239,68,68,0.5)] pointer-events-none">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-red-400 mb-1">
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-red-500" />
                <span>BOSS THREAT: {bossInfo.name.toUpperCase()}</span>
              </span>
              <span className="text-white bg-red-950 px-1.5 py-0.5 rounded border border-red-500">
                {bossInfo.hitsLeft} / {bossInfo.maxHits} HITS
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-xs overflow-hidden p-0.5 border border-red-800">
              <div
                className="h-full bg-gradient-to-r from-red-600 via-red-500 to-amber-500 rounded-xs transition-all duration-150"
                style={{ width: `${Math.max(0, Math.min(100, (bossInfo.hitsLeft / Math.max(1, bossInfo.maxHits)) * 100))}%` }}
              />
            </div>
          </div>
        )}

        {/* TOP CENTER 2-SECOND KILLSTREAK BANNER */}
        {activeStreak && (
          <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 pointer-events-none z-30 flex flex-col items-center animate-bounce">
            <div
              className="px-5 py-2 rounded-lg border-2 bg-black/90 shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-md flex items-center gap-2.5"
              style={{ borderColor: activeStreak.color, boxShadow: `0 0 25px ${activeStreak.color}77` }}
            >
              <Skull className="w-6 h-6 animate-pulse" style={{ color: activeStreak.color }} />
              <div className="text-center">
                <div
                  className="text-lg sm:text-2xl font-display font-extrabold tracking-widest uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,1)]"
                  style={{ color: activeStreak.color }}
                >
                  {activeStreak.label}
                </div>
                <div className="text-[10px] sm:text-xs font-mono font-bold text-slate-200 tracking-wider">
                  {activeStreak.sublabel}
                </div>
              </div>
              <div
                className="px-2 py-1 rounded text-xs font-mono font-black border"
                style={{ borderColor: activeStreak.color, color: activeStreak.color, backgroundColor: `${activeStreak.color}22` }}
              >
                {activeStreak.count}x
              </div>
            </div>
          </div>
        )}

        {/* CALL OF DUTY: BLACK OPS DYNAMIC BALLISTIC CROSSHAIR & LASER RETICLE */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center transition-all duration-75 z-25"
          style={{ left: `${aimScreenPos.x}%`, top: `${aimScreenPos.y}%` }}
        >
          <div className="relative w-16 h-16 flex items-center justify-center">
            {/* Outer Corner Target-Lock Brackets */}
            <div
              className={`absolute w-9 h-9 transition-all duration-100 ${
                isFiring ? 'scale-125' : isScoped ? 'scale-75' : 'scale-100'
              }`}
            >
              <div className={`absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 ${isTargetLocked ? 'border-red-500' : 'border-cyan-400/80'}`} />
              <div className={`absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 ${isTargetLocked ? 'border-red-500' : 'border-cyan-400/80'}`} />
              <div className={`absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 ${isTargetLocked ? 'border-red-500' : 'border-cyan-400/80'}`} />
              <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 ${isTargetLocked ? 'border-red-500' : 'border-cyan-400/80'}`} />
            </div>

            {/* Dynamic Ballistic Stems (Expand on Recoil, Tighten in Scope) */}
            <div
              className={`absolute w-0.5 transition-all duration-75 ${
                isFiring ? 'h-4 -top-5' : isScoped ? 'h-3 -top-2.5' : 'h-3.5 -top-3.5'
              } ${isTargetLocked ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-emerald-400 shadow-[0_0_6px_#22c55e]'}`}
            />
            <div
              className={`absolute w-0.5 transition-all duration-75 ${
                isFiring ? 'h-4 -bottom-5' : isScoped ? 'h-3 -bottom-2.5' : 'h-3.5 -bottom-3.5'
              } ${isTargetLocked ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-emerald-400 shadow-[0_0_6px_#22c55e]'}`}
            />
            <div
              className={`absolute h-0.5 transition-all duration-75 ${
                isFiring ? 'w-4 -left-5' : isScoped ? 'w-3 -left-2.5' : 'w-3.5 -left-3.5'
              } ${isTargetLocked ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-emerald-400 shadow-[0_0_6px_#22c55e]'}`}
            />
            <div
              className={`absolute h-0.5 transition-all duration-75 ${
                isFiring ? 'w-4 -right-5' : isScoped ? 'w-3 -right-2.5' : 'w-3.5 -right-3.5'
              } ${isTargetLocked ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-emerald-400 shadow-[0_0_6px_#22c55e]'}`}
            />

            {/* Rotating Target-Lock Diamond when over an Enemy */}
            {isTargetLocked && (
              <div className="absolute w-5 h-5 border-2 border-red-500 rotate-45 shadow-[0_0_10px_#ef4444]" />
            )}

            {/* Inner Ballistic Ring & Bright PEQ-15 Laser Center Bead */}
            <div
              className={`w-5 h-5 rounded-full border transition-colors ${
                isTargetLocked ? 'border-red-500/80' : 'border-emerald-400/50'
              }`}
            />
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isTargetLocked
                  ? 'bg-red-400 shadow-[0_0_10px_#ef4444]'
                  : 'bg-emerald-300 shadow-[0_0_10px_#22c55e]'
              }`}
            />

            {/* TACTICAL RELOAD BAR & ACTIVE SPEED-RELOAD SWEET SPOT BELOW CROSSHAIR */}
            {isReloading && (
              <div className="absolute -bottom-11 w-40 bg-slate-950/95 border border-amber-400/80 rounded p-1 shadow-[0_0_15px_rgba(245,158,11,0.45)] flex flex-col items-center">
                <div className="text-[7px] font-mono font-bold text-amber-300 tracking-wider uppercase mb-0.5 whitespace-nowrap">
                  🔄 {reloadStageLabel} ({reloadProgress}%)
                </div>
                <div className="relative w-full h-2 bg-slate-800 rounded-xs overflow-hidden border border-slate-600">
                  {/* Sweet-Spot Active Reload Zone [45%..78%] */}
                  <div
                    className="absolute top-0 bottom-0 bg-emerald-400/45 border-x border-emerald-300"
                    style={{ left: '45%', width: '33%' }}
                  />
                  {/* Moving Reload Progress Fill */}
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-cyan-400 transition-all duration-75"
                    style={{ width: `${reloadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {activeReloadBonus && !isReloading && (
              <div className="absolute -bottom-9 px-2 py-0.5 rounded bg-emerald-950/95 border border-emerald-400 text-[8px] font-mono font-black text-emerald-300 whitespace-nowrap shadow-[0_0_12px_rgba(16,185,129,0.6)]">
                ⚡ TACTICAL SPEED RELOAD! +BONUS ROUNDS
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM CONTROLS & TOUCH CLUSTER */}
        <div className="flex items-end justify-between w-full pointer-events-auto gap-2">
          
          {/* Leukocyte HP Bar & Abilities (Stimpack + Grenade + Airdrop) */}
          <div className="flex flex-col space-y-1.5 w-44 sm:w-60">
            <div className="flex items-center justify-between text-xs font-display">
              <span className="flex items-center gap-1 text-slate-300">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>LEUKOCYTE HP</span>
              </span>
              <span className={`font-bold tabular-nums ${playerHp < 35 ? 'text-red-400' : 'text-emerald-400'}`}>
                {playerHp}%
              </span>
            </div>

            <div className="w-full h-3 bg-slate-900 border border-slate-700 rounded-xs p-0.5">
              <div
                className={`h-full transition-all duration-200 rounded-xs ${
                  playerHp > 60 ? 'bg-emerald-500' : playerHp > 30 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${playerHp}%` }}
              />
            </div>

            {/* Tactical Abilities Cluster: Stimpack + Grenade + Airdrop Reinforcements */}
            <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
              <button
                onClick={handleStimpack}
                disabled={stimCooldown > 0 || playerHp >= 100}
                className={`flex items-center justify-center space-x-1 py-1.5 px-1 rounded border text-[10px] sm:text-[11px] font-display font-semibold transition-all ${
                  stimCooldown === 0 && playerHp < 100
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 active:scale-95 cursor-pointer shadow'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>{stimCooldown > 0 ? `${stimCooldown}s` : 'STIM [E]'}</span>
              </button>

              <button
                onClick={handleThrowGrenade}
                disabled={grenadeCooldown > 0}
                className={`flex items-center justify-center space-x-1 py-1.5 px-1 rounded border text-[10px] sm:text-[11px] font-display font-semibold transition-all ${
                  grenadeCooldown === 0
                    ? 'bg-amber-950/80 border-amber-500 text-amber-300 active:scale-95 cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Bomb className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{grenadeCooldown > 0 ? `${grenadeCooldown}s` : 'FRAG [G]'}</span>
              </button>

              <button
                onClick={handleAirdropReinforcements}
                disabled={reinforceCooldown > 0 || isAirdropActive}
                className={`flex items-center justify-center space-x-1 py-1.5 px-1 rounded border text-[10px] sm:text-[11px] font-display font-semibold transition-all ${
                  reinforceCooldown === 0 && !isAirdropActive
                    ? 'bg-cyan-950/90 border-cyan-400 text-cyan-200 active:scale-95 cursor-pointer shadow-[0_0_14px_rgba(6,182,212,0.5)] animate-pulse'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Plane className="w-3 h-3 text-cyan-400 shrink-0" />
                <span>
                  {isAirdropActive ? 'ACTIVE' : reinforceCooldown > 0 ? `${reinforceCooldown}s` : 'AIRDROP [T]'}
                </span>
              </button>
            </div>
          </div>

          {/* MOBILE LARGE CONTROLS (Sight Scope + Reload + Dedicated Fire Trigger) */}
          <div className="flex items-center space-x-1.5 sm:hidden">
            <button
              onClick={handleToggleScope}
              className={`w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center active:scale-95 shadow-lg cursor-pointer ${
                isScoped
                  ? 'bg-cyan-900/95 border-cyan-300 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.7)]'
                  : 'bg-slate-900/90 border-slate-600 text-slate-200'
              }`}
            >
              <Crosshair className="w-4 h-4 text-cyan-400" />
              <span className="text-[7px] font-mono font-bold">SCOPE</span>
            </button>

            <button
              onClick={handleReload}
              disabled={isReloading}
              className="w-12 h-12 rounded-full bg-slate-900/90 border-2 border-slate-600 active:border-cyan-400 flex flex-col items-center justify-center text-slate-200 active:scale-95 shadow-lg cursor-pointer"
            >
              <RotateCcw className={`w-4 h-4 ${isReloading ? 'animate-spin text-amber-400' : ''}`} />
              <span className="text-[7px] font-mono">RELOAD</span>
            </button>

            <button
              onTouchStart={(e) => {
                e.stopPropagation();
                sounds.unlockAudio();
                isPointerDownRef.current = true;
                setIsFiring(true);
                executeShotRef.current?.();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                isPointerDownRef.current = false;
                setIsFiring(false);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                sounds.unlockAudio();
                isPointerDownRef.current = true;
                setIsFiring(true);
                executeShotRef.current?.();
              }}
              onMouseUp={(e) => {
                e.stopPropagation();
                isPointerDownRef.current = false;
                setIsFiring(false);
              }}
              className="w-18 h-18 rounded-full bg-red-600/95 border-4 border-red-400 active:bg-red-500 flex flex-col items-center justify-center text-white active:scale-95 shadow-[0_0_25px_rgba(239,68,68,0.7)] cursor-pointer"
            >
              <Crosshair className="w-7 h-7" />
              <span className="text-[10px] font-display font-bold">FIRE</span>
            </button>
          </div>

          {/* Right Weapon Info, Sight Scope Button, Weapon Switch Button & Ammo Counter */}
          <div className="bg-black/85 border border-slate-700 p-2 sm:p-2.5 rounded-md text-right min-w-[145px] sm:min-w-[195px] flex flex-col items-end">
            <div className="w-full grid grid-cols-2 gap-1 mb-1.5">
              {/* Prominent Sight Scope (ADS) Button */}
              <button
                onClick={handleToggleScope}
                className={`px-2 py-1.5 rounded border text-[9px] sm:text-[10px] font-display font-black flex items-center justify-center gap-1 active:scale-95 cursor-pointer transition-all ${
                  isScoped
                    ? 'bg-emerald-600 border-emerald-300 text-white shadow-[0_0_12px_rgba(16,185,129,0.7)]'
                    : 'bg-slate-800 hover:bg-slate-700 border-cyan-500/60 text-cyan-200'
                }`}
              >
                <Crosshair className="w-3 h-3" />
                <span>{isScoped ? 'SCOPED' : 'SCOPE [F]'}</span>
              </button>

              {/* Prominent Weapon Switch Button */}
              <button
                onClick={handleSwapWeapon}
                className="px-2 py-1.5 rounded bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 border border-cyan-300 text-[9px] sm:text-[10px] font-display font-black text-white flex items-center justify-center gap-0.5 active:scale-95 cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.5)]"
              >
                <span>SWAP [Q]</span>
                <ChevronRight className="w-3 h-3 text-cyan-200" />
              </button>
            </div>

            <div className="text-[10px] font-mono font-bold tracking-wider" style={{ color: currentWeapon.color }}>
              ★ {currentWeapon.rarity} {currentWeapon.category}
            </div>
            <div className="text-xs sm:text-sm font-display font-bold text-slate-100">
              {currentWeapon.name}
            </div>

            <div className="flex items-baseline justify-end space-x-1.5 mt-0.5">
              <span className={`text-2xl sm:text-3xl font-display font-bold tabular-nums ${currentAmmo <= 5 ? 'text-red-400' : 'text-white'}`}>
                {isReloading ? '--' : currentAmmo}
              </span>
              <span className="text-xs sm:text-sm font-mono text-slate-400">
                / {reserveAmmo}
              </span>
            </div>

            <div className="text-[8px] sm:text-[9px] font-mono text-slate-400">
              {isReloading ? (
                <span className="text-amber-400 font-bold">RELOADING...</span>
              ) : currentAmmo === 0 ? (
                <span className="text-red-400 font-bold">PRESS R TO RELOAD</span>
              ) : (
                <span>{autoAimEnabled ? 'AUTO-AIM ON • L-CLICK FIRE' : 'MANUAL AIM • SCOPE [F] + FIRE'}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

