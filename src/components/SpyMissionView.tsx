import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { LevelConfig, Weapon, BiologyConceptCard, HitMarkerInfo } from '../types/game';
import { BIOLOGY_CONCEPT_CARDS } from '../data/curriculumData';
import { sounds } from '../services/soundEffects';
import { WeaponBlockyIcon } from './WeaponBlockyIcon';
import {
  Crosshair,
  Shield,
  Volume2,
  VolumeX,
  EyeOff,
  Bomb,
  Skull,
  BookOpen,
  DoorOpen,
  ArrowDownToLine,
  Target,
  Pause,
  Play,
  Home,
  Repeat,
  Heart,
  RotateCcw,
} from 'lucide-react';
import {
  createBacillusSoldier,
  createStreptococcusSoldier,
  createBacteriaTank,
  createPathogenGeneralModel,
  createEnemyBioBaseModel,
  createSilencedPistolModel,
  createBacterialArtilleryModel,
  createCiliaTreeModel,
  createVesicularCrateModel,
  createTracheaCartilageBarricadeModel,
  createC4SatchelModel,
  disposeSceneGraph
} from './CellModels';

interface SpyMissionViewProps {
  level: LevelConfig;
  phaseNumber: number;
  activeWeapon: Weapon;
  soundEnabled: boolean;
  autoAimEnabled: boolean;
  playerXp?: number;
  onPhaseComplete: (earnedScore: number, earnedKills: number) => void;
  onPhaseDefeat: (earnedScore?: number, earnedKills?: number) => void;
  onToggleSound: () => void;
  onToggleAutoAim: () => void;
  onExitToMenu?: () => void;
  onSelectWeapon?: (weapon: Weapon) => void;
  availableWeapons?: Weapon[];
}

interface SpyTarget {
  id: string;
  kind: 'GENERAL' | 'TANK' | 'BASE' | 'GUARD' | 'ARTILLERY';
  name: string;
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  sabotaged: boolean;
  alerted: boolean;
  facingAngle: number; // Math.PI = turned around (facing away from spy), 0 = facing spy
  speed: number;
  shootCooldown: number;
  leftLeg?: THREE.Object3D;
  rightLeg?: THREE.Object3D;
  leftArm?: THREE.Object3D;
  rightArm?: THREE.Object3D;
  headGroup?: THREE.Group;
  coreMesh?: THREE.Mesh;
  radarDish?: THREE.Group;
  turret?: THREE.Group;
  barrel?: THREE.Mesh;
  npcRole?: 'STATIC' | 'TALKER' | 'PATROL' | 'DOOR_GUARD';
  patrolMinX?: number;
  patrolMaxX?: number;
  patrolMinZ?: number;
  patrolMaxZ?: number;
  patrolDir?: number;
  patrolPauseTimer?: number;
  guardDoorId?: string;
  guardLine?: string;
  c4Planted?: boolean;
  c4Timer?: number;
  c4LastBeepSec?: number;
  c4Mesh?: THREE.Group;
  c4Led?: THREE.Mesh;
  fireGroup?: THREE.Group;
}

interface BioDoor {
  id: string;
  name: string;
  z: number;
  gapX: number; // Left or right passage turn
  isOpen: boolean;
  openProgress: number;
  group: THREE.Group;
  leftPanel: THREE.Mesh;
  rightPanel: THREE.Mesh;
  statusLight: THREE.Mesh;
}

interface AnatomicalCover {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  mesh: THREE.Group;
}

interface BulletItem {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  isEnemy: boolean;
  damage: number;
}

interface ParticleItem {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export interface SpyWeaponMode {
  id: string;
  name: string;
  category: string;
  magSize: number;
  damage: number;
  fireRate: number;
  color: string;
}

export const SPY_WEAPONS: SpyWeaponMode[] = [
  { id: 'pistol', name: 'SILENCED 9MM SPEC-OPS', category: 'PISTOL', magSize: 12, damage: 45, fireRate: 240, color: '#f59e0b' },
  { id: 'dart', name: 'BIO-TRANQ NEEDLE RIFLE', category: 'SNIPER', magSize: 6, damage: 95, fireRate: 650, color: '#06b6d4' },
  { id: 'vector', name: 'SUPPRESSED VECTOR SMG', category: 'SMG', magSize: 32, damage: 24, fireRate: 110, color: '#10b981' },
];

export const SpyMissionView: React.FC<SpyMissionViewProps> = ({
  level,
  phaseNumber,
  soundEnabled,
  autoAimEnabled,
  onPhaseComplete,
  onPhaseDefeat,
  onToggleSound,
  onToggleAutoAim,
  onExitToMenu,
  onSelectWeapon,
  availableWeapons
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Pause State
  const [isGamePaused, setIsGamePaused] = useState(false);
  const isGamePausedRef = useRef(false);
  isGamePausedRef.current = isGamePaused;

  // Active Spy Weapon Mode & Switcher
  const [activeSpyWeaponIdx, setActiveSpyWeaponIdx] = useState(0);
  const activeSpyWeapon = SPY_WEAPONS[activeSpyWeaponIdx];
  const activeSpyWeaponRef = useRef<SpyWeaponMode>(SPY_WEAPONS[0]);
  activeSpyWeaponRef.current = activeSpyWeapon;

  const [hp, setHp] = useState(100);
  const [maxHp] = useState(100);
  const [ammo, setAmmo] = useState(SPY_WEAPONS[0].magSize);
  const [maxAmmo, setMaxAmmo] = useState(SPY_WEAPONS[0].magSize);
  const [isReloading, setIsReloading] = useState(false);
  const [isScoped, setIsScoped] = useState(false);

  const handleSwapSpyWeapon = (target?: number | 'next' | 'prev') => {
    let nextIdx = 0;
    if (typeof target === 'number') {
      nextIdx = (target + SPY_WEAPONS.length) % SPY_WEAPONS.length;
    } else if (target === 'prev') {
      nextIdx = (activeSpyWeaponIdx - 1 + SPY_WEAPONS.length) % SPY_WEAPONS.length;
    } else {
      nextIdx = (activeSpyWeaponIdx + 1) % SPY_WEAPONS.length;
    }
    const nextW = SPY_WEAPONS[nextIdx];
    setActiveSpyWeaponIdx(nextIdx);
    setMaxAmmo(nextW.magSize);
    setAmmo(nextW.magSize);
    sounds.playRadioChirp();
    sounds.triggerHaptic([16, 22], 0.6);
  };
  const handleSwapSpyWeaponRef = useRef<((target?: number | 'next' | 'prev') => void) | null>(null);
  handleSwapSpyWeaponRef.current = handleSwapSpyWeapon;

  // Stealth & Infiltration states
  const [isCrouching, setIsCrouching] = useState(false);
  const [isBehindCover, setIsBehindCover] = useState(false);
  const [coverObjectName, setCoverObjectName] = useState<string | null>(null);
  const [stealthCloakActive, setStealthCloakActive] = useState(false);
  const [stealthEnergy, setStealthEnergy] = useState(100);

  // Objectives tracking
  const [generalsEliminated, setGeneralsEliminated] = useState(0);
  const [totalGenerals] = useState(3);
  const [tanksSabotaged, setTanksSabotaged] = useState(0);
  const [totalTanks] = useState(3);
  const [artillerySabotaged, setArtillerySabotaged] = useState(0);
  const [totalArtillery] = useState(2);
  const [basesSabotaged, setBasesSabotaged] = useState(0);
  const [totalBases] = useState(2);

  // Bacteria Squad Dialogue Speech Bubbles (Groups talking to each other)
  const [squadDialogues, setSquadDialogues] = useState<Array<{ id: string; x: number; y: number; text: string }>>([]);

  // Interactive prompts (Doors & Sabotage)
  const [nearbySabotageTarget, setNearbySabotageTarget] = useState<string | null>(null);
  const [nearbyDoorName, setNearbyDoorName] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(
    'TRACHEA INFILTRATION: Sneak past ciliated walls, crouch behind trees & crates, eliminate generals & sabotage artillery!'
  );
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [spyDamageNumbers, setSpyDamageNumbers] = useState<HitMarkerInfo[]>([]);

  // Virtual Joystick Mobile/Touch State (matches regular CombatView!)
  const movementTouchIdRef = useRef<number | null>(null);
  const firingTouchIdRef = useRef<number | null>(null);
  const movementTouchStartPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const movementTouchActiveRef = useRef<boolean>(false);
  const joystickCenterRef = useRef<{ x: number; y: number } | null>(null);
  const joystickOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const moveInputRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const [joystickDisplay, setJoystickDisplay] = useState<{ x: number; y: number } | null>(null);
  const joystickKnobDomRef = useRef<HTMLDivElement | null>(null);

  // Callback refs so Three.js useEffect never needs to re-run and destroy WebGL context
  const onPhaseCompleteRef = useRef(onPhaseComplete);
  const onPhaseDefeatRef = useRef(onPhaseDefeat);
  useEffect(() => {
    onPhaseCompleteRef.current = onPhaseComplete;
    onPhaseDefeatRef.current = onPhaseDefeat;
  }, [onPhaseComplete, onPhaseDefeat]);

  // Educational Biology Concept Modal (max 1 popup per mission phase, 1-2 sentences)
  const [activeConceptCard, setActiveConceptCard] = useState<BiologyConceptCard | null>(null);
  const isConceptModalOpenRef = useRef<boolean>(false);
  const hasShownConceptThisMissionRef = useRef<boolean>(false);
  const seenConceptsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem('biowars_seen_concepts_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          seenConceptsRef.current = new Set(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const triggerBiologyConcept = useCallback((conceptId: string) => {
    if (hasShownConceptThisMissionRef.current) return;
    if (seenConceptsRef.current.has(conceptId)) return;
    if (isConceptModalOpenRef.current) return;
    const card = BIOLOGY_CONCEPT_CARDS[conceptId];
    if (!card) return;

    hasShownConceptThisMissionRef.current = true;
    seenConceptsRef.current.add(conceptId);
    try {
      localStorage.setItem('biowars_seen_concepts_v1', JSON.stringify(Array.from(seenConceptsRef.current)));
    } catch {
      // ignore storage errors
    }

    isConceptModalOpenRef.current = true;
    setActiveConceptCard(card);
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, []);

  const dismissConceptCard = useCallback(() => {
    isConceptModalOpenRef.current = false;
    setActiveConceptCard(null);
  }, []);

  // Refs for animation loop access (zero React re-render overhead inside 60 FPS loop!)
  const stateRef = useRef({
    hp: 100,
    ammo: 12,
    isReloading: false,
    isScoped: false,
    autoAim: autoAimEnabled,
    isCrouching: false,
    isBehindCover: false,
    stealthCloakActive: false,
    stealthEnergy: 100,
    generalsEliminated: 0,
    tanksSabotaged: 0,
    artillerySabotaged: 0,
    basesSabotaged: 0,
    kills: 0,
    score: 0,
    gameOver: false
  });

  const holdShootTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoScopedByHoldRef = useRef(false);

  const startHoldShootScopeTimer = useCallback(() => {
    if (stateRef.current.isScoped) return;
    if (holdShootTimerRef.current) {
      clearTimeout(holdShootTimerRef.current);
    }
    holdShootTimerRef.current = setTimeout(() => {
      if (!stateRef.current.isScoped) {
        stateRef.current.isScoped = true;
        autoScopedByHoldRef.current = true;
        setIsScoped(true);
        sounds.playScopeZoom(true);
        sounds.triggerHaptic(14, 0.45);
      }
    }, 2000);
  }, []);

  const cancelHoldShootScope = useCallback(() => {
    if (holdShootTimerRef.current) {
      clearTimeout(holdShootTimerRef.current);
      holdShootTimerRef.current = null;
    }
    if (autoScopedByHoldRef.current) {
      autoScopedByHoldRef.current = false;
      stateRef.current.isScoped = false;
      setIsScoped(false);
      sounds.playScopeZoom(false);
    }
  }, []);

  useEffect(() => {
    stateRef.current.autoAim = autoAimEnabled;
  }, [autoAimEnabled]);

  useEffect(() => {
    sounds.setEnabled(soundEnabled);
    if (soundEnabled) {
      sounds.unlockAudio();
    }
  }, [soundEnabled]);

  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mouseRef = useRef({ x: 0, y: 0, isDown: false });
  const triggerInteractRef = useRef(false);
  const triggerShootRef = useRef(false);

  const toggleCrouch = useCallback(() => {
    sounds.triggerHaptic(12, 0.35);
    setIsCrouching(prev => {
      const next = !prev;
      stateRef.current.isCrouching = next;
      return next;
    });
  }, []);

  const handleReload = useCallback(() => {
    if (stateRef.current.isReloading || stateRef.current.ammo >= maxAmmo) return;
    setIsReloading(true);
    stateRef.current.isReloading = true;
    sounds.triggerHaptic([12, 40, 18], 0.5);
    sounds.playReload(900);
    setTimeout(() => {
      setAmmo(maxAmmo);
      setIsReloading(false);
      stateRef.current.ammo = maxAmmo;
      stateRef.current.isReloading = false;
    }, 900);
  }, [maxAmmo]);

  const toggleCloak = useCallback(() => {
    sounds.triggerHaptic([15, 30, 15], 0.5);
    if (!stateRef.current.stealthCloakActive && stateRef.current.stealthEnergy > 20) {
      setStealthCloakActive(true);
      stateRef.current.stealthCloakActive = true;
      sounds.playNightVisionToggle();
    } else {
      setStealthCloakActive(false);
      stateRef.current.stealthCloakActive = false;
    }
  }, []);

  const handleInteractOrSabotage = useCallback(() => {
    sounds.triggerHaptic(18, 0.55);
    triggerInteractRef.current = true;
  }, []);

  const handleHeal = useCallback(() => {
    setHp(prev => {
      const next = Math.min(maxHp, prev + 35);
      stateRef.current.hp = next;
      return next;
    });
    sounds.triggerHaptic([15, 30, 25], 0.6);
    sounds.playStimInject();
  }, [maxHp]);

  useEffect(() => {
    const timer = setTimeout(() => {
      triggerBiologyConcept('CONCEPT_SPY_INFILTRATION');
    }, 2800);
    return () => clearTimeout(timer);
  }, [triggerBiologyConcept]);

  // MAIN THREE.JS SCENE SETUP (Runs ONCE on mount — never tears down mid-mission!)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffded6); // Bright warm peachy-pink (matches user reference IMG_5389!)
    scene.fog = new THREE.FogExp2(0xffb8aa, 0.007);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 220);
    camera.rotation.order = 'YXZ';
    camera.position.set(0, 0, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: window.innerWidth >= 900, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 900 ? 1.25 : 1.5));
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.zIndex = '0';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Warm, Bright, Luminous Trachea Lighting (Matching User Attachment IMG_5389!)
    const ambientLight = new THREE.AmbientLight(0xffe6dc, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff1e0, 1.5);
    dirLight.position.set(10, 24, 15);
    scene.add(dirLight);

    // Radiant Light at the end of the Trachea (The Distant Bronchial Gateway)
    const distalAirwayLight = new THREE.PointLight(0xffb285, 4.0, 240);
    distalAirwayLight.position.set(0, 7, -165);
    scene.add(distalAirwayLight);

    // Airway lumen warm rosy lanterns along corridor
    [-25, -70, -115].forEach(z => {
      const glow = new THREE.PointLight(0xffa285, 1.8, 65);
      glow.position.set(0, 4, z);
      scene.add(glow);
    });

    // 3D Trachea Respiratory Airway Infiltration Corridor
    const corridorGroup = new THREE.Group();
    scene.add(corridorGroup);

    // Wet Glistening Salmon Mucosal Floor
    const floorGeo = new THREE.PlaneGeometry(38, 220, 10, 36);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xee8588,
      roughness: 0.22,
      metalness: 0.12
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, -2.5, -75);
    corridorGroup.add(floorMesh);

    // Pearlescent C-Shaped Hyaline Cartilage Arch Rings (Tracheal Rings)
    const ribGeo = new THREE.TorusGeometry(18.5, 0.75, 8, 24, Math.PI);
    const ribMat = new THREE.MeshStandardMaterial({
      color: 0xffe4db,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.16,
      roughness: 0.35
    });
    for (let z = 15; z >= -165; z -= 12) {
      const rib = new THREE.Mesh(ribGeo, ribMat);
      rib.position.set(0, -2.5, z);
      corridorGroup.add(rib);
    }

    // Dense Epithelial Cilia Carpets Along Walls (Pointing Inwards, Waving in Airway Lumen)
    const wallCiliaGroup = new THREE.Group();
    const ciliaMat = new THREE.MeshStandardMaterial({
      color: 0xfda4af,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.35,
      roughness: 0.3
    });
    const ciliaGeo = new THREE.CylinderGeometry(0.045, 0.11, 2.5, 6);
    for (let z = 15; z >= -165; z -= 4.2) {
      for (let y = -1.5; y <= 9.5; y += 2.2) {
        // Left wall cilia fronds
        const cLeft = new THREE.Mesh(ciliaGeo, ciliaMat);
        cLeft.position.set(-17.5 + Math.random() * 0.8, y, z + (Math.random() - 0.5) * 2);
        cLeft.rotation.z = Math.PI / 2 - 0.38 + Math.random() * 0.2;
        wallCiliaGroup.add(cLeft);

        // Right wall cilia fronds
        const cRight = new THREE.Mesh(ciliaGeo, ciliaMat);
        cRight.position.set(17.5 - Math.random() * 0.8, y, z + (Math.random() - 0.5) * 2);
        cRight.rotation.z = -Math.PI / 2 + 0.38 - Math.random() * 0.2;
        wallCiliaGroup.add(cRight);
      }
    }
    corridorGroup.add(wallCiliaGroup);

    // Floating Golden Amber Mucus Droplets (Translucent surfactant spheres bobbing gently)
    const mucusDropletMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
      roughness: 0.1,
      metalness: 0.15,
      transparent: true,
      opacity: 0.82
    });
    const dropletGeo = new THREE.SphereGeometry(0.32, 10, 10);
    const floatingDroplets: THREE.Mesh[] = [];
    for (let i = 0; i < 28; i++) {
      const droplet = new THREE.Mesh(dropletGeo, mucusDropletMat);
      droplet.scale.set(1.0, 1.45, 1.0);
      droplet.position.set(
        (Math.random() - 0.5) * 26,
        0.5 + Math.random() * 8.5,
        10 - Math.random() * 170
      );
      corridorGroup.add(droplet);
      floatingDroplets.push(droplet);
    }

    // =========================================================================
    // 1. 3D TRACHEA CARTILAGE VALVES & AIRWAY BULKHEADS
    // =========================================================================
    const doors: BioDoor[] = [];
    const doorConfigs = [
      { id: 'door-1', name: 'Sector 1 Cartilage Valve (Turn Left)', z: -26, gapX: -6.5 },
      { id: 'door-2', name: 'Sector 2 Respiratory Bulkhead (Turn Right)', z: -68, gapX: 6.5 },
      { id: 'door-3', name: 'Bronchial Security Gate (Center)', z: -112, gapX: 0 }
    ];

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xfecdd3,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.15,
      roughness: 0.4
    });
    const doorPanelMat = new THREE.MeshStandardMaterial({
      color: 0xffe4db,
      emissive: 0xfb7185,
      emissiveIntensity: 0.25,
      roughness: 0.35
    });

    doorConfigs.forEach(cfg => {
      const dGroup = new THREE.Group();
      dGroup.position.set(0, -2.5, cfg.z);

      const leftWallWidth = Math.max(2, (cfg.gapX - 3.6) - (-19));
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(leftWallWidth, 9, 1.4), wallMat);
      leftWall.position.set(-19 + leftWallWidth / 2, 4.5, 0);
      dGroup.add(leftWall);

      const rightWallWidth = Math.max(2, 19 - (cfg.gapX + 3.6));
      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(rightWallWidth, 9, 1.4), wallMat);
      rightWall.position.set(19 - rightWallWidth / 2, 4.5, 0);
      dGroup.add(rightWall);

      const headerBeam = new THREE.Mesh(new THREE.BoxGeometry(8.2, 1.6, 1.8), wallMat);
      headerBeam.position.set(cfg.gapX, 8.2, 0);
      dGroup.add(headerBeam);

      const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(3.6, 7.4, 0.6), doorPanelMat);
      leftPanel.position.set(cfg.gapX - 1.8, 3.7, 0);
      dGroup.add(leftPanel);

      const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(3.6, 7.4, 0.6), doorPanelMat);
      rightPanel.position.set(cfg.gapX + 1.8, 3.7, 0);
      dGroup.add(rightPanel);

      const statusLightMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const statusLight = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), statusLightMat);
      statusLight.position.set(cfg.gapX, 7.6, 1.0);
      dGroup.add(statusLight);

      scene.add(dGroup);
      doors.push({
        id: cfg.id,
        name: cfg.name,
        z: cfg.z,
        gapX: cfg.gapX,
        isOpen: false,
        openProgress: 0,
        group: dGroup,
        leftPanel,
        rightPanel,
        statusLight
      });
    });

    // =========================================================================
    // 2. 3D ANATOMICAL THEME TREES, BOXES & BARRICADES (Crouch to hide!)
    // =========================================================================
    const anatomicalCovers: AnatomicalCover[] = [];
    const coverConfigs = [
      // Cilia Trees (Microscopic palm/anemone arbors with golden mucus droplets)
      { id: 'cov-cilia-1', name: 'Ciliated Epithelial Tree', x: -6.0, z: -6, type: 'CILIA_TREE' },
      { id: 'cov-cilia-2', name: 'Ciliated Epithelial Tree', x: 6.5, z: -32, type: 'CILIA_TREE' },
      { id: 'cov-cilia-3', name: 'Ciliated Epithelial Tree', x: -6.5, z: -52, type: 'CILIA_TREE' },
      { id: 'cov-cilia-4', name: 'Ciliated Epithelial Tree', x: 6.0, z: -84, type: 'CILIA_TREE' },
      { id: 'cov-cilia-5', name: 'Ciliated Epithelial Tree', x: -5.5, z: -108, type: 'CILIA_TREE' },
      { id: 'cov-cilia-6', name: 'Ciliated Epithelial Tree', x: 5.5, z: -132, type: 'CILIA_TREE' },

      // Vesicular Storage Crates (Organelle bio-boxes with membrane latches)
      { id: 'cov-crate-1', name: 'Vesicular Ammo Crate', x: 5.5, z: 4, type: 'CRATE' },
      { id: 'cov-crate-2', name: 'Glycogen Storage Crate', x: -5.5, z: -18, type: 'CRATE' },
      { id: 'cov-crate-3', name: 'Vesicular Ammo Crate', x: 5.0, z: -46, type: 'CRATE' },
      { id: 'cov-crate-4', name: 'Glycogen Storage Crate', x: -6.0, z: -64, type: 'CRATE' },
      { id: 'cov-crate-5', name: 'Vesicular Supply Depot', x: 5.5, z: -78, type: 'CRATE' },
      { id: 'cov-crate-6', name: 'Vesicular Ammo Crate', x: -5.5, z: -98, type: 'CRATE' },
      { id: 'cov-crate-7', name: 'Glycogen Storage Crate', x: 5.0, z: -118, type: 'CRATE' },
      { id: 'cov-crate-8', name: 'Vesicular Supply Depot', x: -5.0, z: -140, type: 'CRATE' },

      // Tracheal Hyaline Cartilage Barricades (Anatomical sandbag breastworks)
      { id: 'cov-barr-1', name: 'Tracheal Cartilage Slab', x: -2.0, z: -12, type: 'BARRICADE' },
      { id: 'cov-barr-2', name: 'Tracheal Cartilage Slab', x: 2.0, z: -40, type: 'BARRICADE' },
      { id: 'cov-barr-3', name: 'Tracheal Cartilage Slab', x: -2.5, z: -70, type: 'BARRICADE' },
      { id: 'cov-barr-4', name: 'Tracheal Cartilage Slab', x: 2.5, z: -92, type: 'BARRICADE' },
      { id: 'cov-barr-5', name: 'Tracheal Cartilage Slab', x: 0.0, z: -126, type: 'BARRICADE' }
    ];

    coverConfigs.forEach(cfg => {
      let modelGroup: THREE.Group;
      if (cfg.type === 'CILIA_TREE') {
        const tree = createCiliaTreeModel();
        modelGroup = tree.group;
      } else if (cfg.type === 'CRATE') {
        const crate = createVesicularCrateModel();
        modelGroup = crate.group;
      } else {
        const barricade = createTracheaCartilageBarricadeModel();
        modelGroup = barricade.group;
      }

      modelGroup.position.set(cfg.x, -2.5, cfg.z);
      scene.add(modelGroup);
      anatomicalCovers.push({
        id: cfg.id,
        name: cfg.name,
        x: cfg.x,
        z: cfg.z,
        radius: cfg.type === 'BARRICADE' ? 3.8 : 3.2,
        mesh: modelGroup
      });
    });

    // =========================================================================
    // 3. ATTACH SILENCED PISTOL TO CAMERA
    // =========================================================================
    const pistolModel = createSilencedPistolModel();
    pistolModel.group.position.set(0.45, -0.38, -0.85);
    pistolModel.group.rotation.y = -0.05;
    camera.add(pistolModel.group);
    scene.add(camera);

    // =========================================================================
    // 4. SPAWN SPY TARGETS: GENERALS, ARTILLERY, TANKS, BASES, TALKING SQUADS
    // =========================================================================
    const targets: SpyTarget[] = [];

    // Shared pre-allocated 3D fire & smoke materials/geometries for C4 sabotage (Zero runtime allocations!)
    const flameOuterMat = new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.88 });
    const flameMidMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.92 });
    const flameCoreMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.95 });
    const smokePuffMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.55 });
    const flameConeGeo = new THREE.ConeGeometry(0.55, 1.85, 7);
    const smokeSphereGeo = new THREE.SphereGeometry(0.48, 7, 7);

    const attachSabotageRig = (
      parentGroup: THREE.Group,
      c4LocalPos: [number, number, number],
      fireLocalY: number,
      fireScale = 1.0
    ) => {
      const c4 = createC4SatchelModel();
      c4.group.position.set(c4LocalPos[0], c4LocalPos[1], c4LocalPos[2]);
      c4.group.scale.setScalar(1.15);
      c4.group.visible = false;
      parentGroup.add(c4.group);

      const fireGroup = new THREE.Group();
      fireGroup.position.set(0, fireLocalY, 0);
      fireGroup.scale.setScalar(fireScale);
      fireGroup.visible = false;

      const flameOffsets: Array<[number, number, number, number, THREE.MeshBasicMaterial]> = [
        [0, 0.7, 0, 1.25, flameOuterMat],
        [-0.55, 0.55, 0.35, 0.95, flameMidMat],
        [0.55, 0.6, -0.3, 1.0, flameMidMat],
        [0.2, 0.45, 0.5, 0.8, flameCoreMat],
        [-0.25, 0.5, -0.45, 0.85, flameCoreMat],
      ];
      flameOffsets.forEach(([fx, fy, fz, fScale, mat]) => {
        const cone = new THREE.Mesh(flameConeGeo, mat);
        cone.position.set(fx, fy, fz);
        cone.scale.setScalar(fScale);
        cone.userData.isFlame = true;
        cone.userData.baseScale = fScale;
        fireGroup.add(cone);
      });

      for (let s = 0; s < 3; s++) {
        const smoke = new THREE.Mesh(smokeSphereGeo, smokePuffMat);
        smoke.position.set((s - 1) * 0.45, 1.4 + s * 0.65, (s % 2 === 0 ? 0.25 : -0.25));
        smoke.userData.isSmoke = true;
        smoke.userData.smokeOffset = s * 0.33;
        fireGroup.add(smoke);
      }

      parentGroup.add(fireGroup);
      return { c4Mesh: c4.group, c4Led: c4.ledMesh, fireGroup };
    };

    // Pathogen Command Bases
    const basePositions = [
      { id: 'base-1', name: 'Pathogen Command Relay Alpha', x: -7.5, z: -54 },
      { id: 'base-2', name: 'Central Bio-Reactor Core Omega', x: 0, z: -146 }
    ];
    basePositions.forEach(bp => {
      const bm = createEnemyBioBaseModel();
      bm.group.position.set(bp.x, -2.5, bp.z);
      const rig = attachSabotageRig(bm.group, [0, 1.4, 2.1], 1.1, 1.45);
      scene.add(bm.group);
      targets.push({
        id: bp.id,
        kind: 'BASE',
        name: bp.name,
        mesh: bm.group,
        hp: 500,
        maxHp: 500,
        sabotaged: false,
        alerted: false,
        facingAngle: Math.PI,
        speed: 0,
        shootCooldown: 999,
        coreMesh: bm.coreMesh,
        radarDish: bm.radarDish,
        c4Planted: false,
        c4Timer: 0,
        c4Mesh: rig.c4Mesh,
        c4Led: rig.c4Led,
        fireGroup: rig.fireGroup
      });
    });

    // Armored Bio-Tanks (Desert-Tan & Olive Camo Main Battle Tanks matching IMG_5396)
    const tankPositions = [
      { id: 'tank-1', name: 'Armored Bio-Tank MK-I', x: 5.5, z: -16 },
      { id: 'tank-2', name: 'Siege Bio-Tank MK-II', x: 5.5, z: -84 },
      { id: 'tank-3', name: 'Citadel Guard Tank MK-III', x: -6.5, z: -130 }
    ];
    tankPositions.forEach(tp => {
      const tm = createBacteriaTank();
      // Roadwheels bottom is at local y = -0.31; at scale 1.35 -> y = -2.08 rests treads right on floor (-2.5)
      tm.group.position.set(tp.x, -2.08, tp.z);
      tm.group.scale.setScalar(1.35);
      tm.group.rotation.y = Math.PI;
      const rig = attachSabotageRig(tm.group, [0, 0.95, 1.65], 0.85, 1.25);
      scene.add(tm.group);
      targets.push({
        id: tp.id,
        kind: 'TANK',
        name: tp.name,
        mesh: tm.group,
        hp: 340,
        maxHp: 340,
        sabotaged: false,
        alerted: false,
        facingAngle: Math.PI,
        speed: 0.4,
        shootCooldown: 3.2,
        turret: tm.turret,
        c4Planted: false,
        c4Timer: 0,
        c4Mesh: rig.c4Mesh,
        c4Led: rig.c4Led,
        fireGroup: rig.fireGroup
      });
    });

    // Pathogen Spore Artillery Batteries (Towed Olive-Drab Field Howitzers matching IMG_5395)
    const artilleryPositions = [
      { id: 'artillery-1', name: 'Pathogen Spore Artillery Alpha', x: -6.5, z: -38 },
      { id: 'artillery-2', name: 'Pathogen Spore Artillery Beta', x: 6.0, z: -102 }
    ];
    artilleryPositions.forEach(ap => {
      const art = createBacterialArtilleryModel();
      art.group.position.set(ap.x, -2.5, ap.z);
      art.group.rotation.y = Math.PI;
      const rig = attachSabotageRig(art.group, [0, 1.35, -0.45], 1.0, 1.2);
      scene.add(art.group);
      targets.push({
        id: ap.id,
        kind: 'ARTILLERY',
        name: ap.name,
        mesh: art.group,
        hp: 280,
        maxHp: 280,
        sabotaged: false,
        alerted: false,
        facingAngle: Math.PI,
        speed: 0,
        shootCooldown: 4.0,
        barrel: art.barrel,
        c4Planted: false,
        c4Timer: 0,
        c4Mesh: rig.c4Mesh,
        c4Led: rig.c4Led,
        fireGroup: rig.fireGroup
      });
    });

    // Bacterial Generals (Standing on their boots on the floor y = -2.5; boots at local -1.57 * 1.45 -> y = -0.22)
    const generalPositions = [
      { id: 'gen-1', name: 'General Necrosis (Sector 1 Commander)', x: -2.5, z: -14 },
      { id: 'gen-2', name: 'General Toxoid (Artillery Overseer)', x: 2.5, z: -58 },
      { id: 'gen-3', name: 'Supreme General Virulence', x: 0, z: -135 }
    ];
    generalPositions.forEach(gp => {
      const gm = createPathogenGeneralModel();
      gm.group.position.set(gp.x, -0.22, gp.z);
      gm.group.scale.setScalar(1.45);
      gm.group.rotation.y = Math.PI;
      scene.add(gm.group);
      targets.push({
        id: gp.id,
        kind: 'GENERAL',
        name: gp.name,
        mesh: gm.group,
        hp: 200,
        maxHp: 200,
        sabotaged: false,
        alerted: false,
        facingAngle: Math.PI,
        speed: 2.2,
        shootCooldown: 2.0,
        leftLeg: gm.leftLeg,
        rightLeg: gm.rightLeg,
        leftArm: gm.leftArm,
        rightArm: gm.rightArm,
        headGroup: gm.headGroup,
        npcRole: 'PATROL',
        patrolMinX: gp.x - 2.2,
        patrolMaxX: gp.x + 2.2,
        patrolDir: 1,
        patrolPauseTimer: 0
      });
    });

    // Groups of Living Bipedal Bacteria Standing on Legs & Talking to Each Other
    const talkingSquadsData = [
      {
        id: 'squad-1',
        pos: [-3.5, -0.8, -20.5] as [number, number, number],
        lines: [
          'General Necrosis ordered extra sentries near the cartilage valve!',
          'Relax, no leukocyte could sneak past the cilia thicket...',
          'Keep your flagella steady, the mucus current is strong today!'
        ],
        offsets: [[-0.95, 0, 0.7], [0.95, 0, 0.7], [0, 0, -0.95]]
      },
      {
        id: 'squad-2',
        pos: [4.5, -0.8, -74] as [number, number, number],
        lines: [
          'Did you check the heavy field howitzer? All spore shells primed!',
          'I heard an immune siren echoing down the upper airway...',
          'Watch the vesicular crates and keep your rifle ready.'
        ],
        offsets: [[-0.85, 0, 0.6], [0.85, 0, -0.6]]
      },
      {
        id: 'squad-3',
        pos: [-2.5, -0.8, -116] as [number, number, number],
        lines: [
          'Supreme General Virulence said the bronchial barrage is ready!',
          'Stay sharp behind the cartilage barrier, no slacking!'
        ],
        offsets: [[-0.8, 0, 0.6], [0.8, 0, -0.6]]
      }
    ];

    const talkingSquads: Array<{
      id: string;
      pos: THREE.Vector3;
      lines: string[];
      currentLineIndex: number;
      timer: number;
      chatterCooldown: number;
      memberIds: string[];
    }> = [];

    talkingSquadsData.forEach((sqData, sqIdx) => {
      const sqPos = new THREE.Vector3(...sqData.pos);
      const memberIds: string[] = [];
      sqData.offsets.forEach((off, mIdx) => {
        const isBacillus = mIdx % 2 === 0;
        const soldier = isBacillus ? createBacillusSoldier() : createStreptococcusSoldier();
        soldier.group.scale.setScalar(1.1);
        // Boots rest right on floor y = -2.5 (Bacillus boot local -1.57 * 1.1 = -1.73 -> y = -0.77; Strep -1.40 * 1.1 = -1.54 -> y = -0.96)
        const standingY = isBacillus ? -0.77 : -0.96;
        soldier.group.position.set(sqPos.x + off[0], standingY, sqPos.z + off[2]);
        soldier.group.lookAt(sqPos.x, standingY, sqPos.z);
        scene.add(soldier.group);
        const tid = `talker-${sqIdx}-${mIdx}`;
        memberIds.push(tid);
        targets.push({
          id: tid,
          kind: 'GUARD',
          name: `Pathogen Commando (${sqData.id})`,
          mesh: soldier.group,
          hp: 70,
          maxHp: 70,
          sabotaged: false,
          alerted: false,
          facingAngle: soldier.group.rotation.y,
          speed: 2.4,
          shootCooldown: 2.5,
          leftLeg: soldier.leftLeg,
          rightLeg: soldier.rightLeg,
          leftArm: soldier.leftArm,
          rightArm: soldier.rightArm,
          npcRole: 'TALKER'
        });
      });
      talkingSquads.push({
        id: sqData.id,
        pos: sqPos,
        lines: sqData.lines,
        currentLineIndex: 0,
        timer: sqIdx * 1.5,
        chatterCooldown: 1.2 + sqIdx * 0.9,
        memberIds
      });
    });

    // NPC Door-Defending Sentries (Walk back and forth guarding the 3 Bio-Security Doors!)
    const doorGuardConfigs = [
      {
        id: 'door-guard-1',
        doorId: 'door-1',
        name: 'Valve Gate Defender Alpha',
        x: -6.5,
        z: -23.4,
        minX: -9.6,
        maxX: -3.4,
        line: 'Halt! Sector 1 Cartilage Valve is locked—guard the doorway!'
      },
      {
        id: 'door-guard-2',
        doorId: 'door-2',
        name: 'Bulkhead Gate Defender Beta',
        x: 6.5,
        z: -65.4,
        minX: 3.4,
        maxX: 9.6,
        line: 'Defending Sector 2 Bulkhead! No leukocyte gets through this gate!'
      },
      {
        id: 'door-guard-3',
        doorId: 'door-3',
        name: 'Bronchial Gate Warden Omega',
        x: 0.0,
        z: -109.4,
        minX: -3.2,
        maxX: 3.2,
        line: 'Bronchial Security Gate sealed! Protect Supreme General Virulence!'
      }
    ];
    doorGuardConfigs.forEach((dg) => {
      const defender = createBacillusSoldier();
      defender.group.scale.setScalar(1.18);
      defender.group.position.set(dg.x, -0.65, dg.z);
      defender.group.rotation.y = Math.PI * 0.5;
      scene.add(defender.group);
      targets.push({
        id: dg.id,
        kind: 'GUARD',
        name: dg.name,
        mesh: defender.group,
        hp: 85,
        maxHp: 85,
        sabotaged: false,
        alerted: false,
        facingAngle: Math.PI * 0.5,
        speed: 2.9,
        shootCooldown: 2.2,
        leftLeg: defender.leftLeg,
        rightLeg: defender.rightLeg,
        leftArm: defender.leftArm,
        rightArm: defender.rightArm,
        npcRole: 'DOOR_GUARD',
        patrolMinX: dg.minX,
        patrolMaxX: dg.maxX,
        patrolDir: 1,
        patrolPauseTimer: 0,
        guardDoorId: dg.doorId,
        guardLine: dg.line
      });
    });

    // Corridor Patrolling NPC Sentries (Walk along airway patrol routes on their legs!)
    const guardPositions = [
      { x: 3.5, z: -4, minZ: -11, maxZ: 2 },
      { x: -5.5, z: -42, minZ: -49, maxZ: -34 },
      { x: 5.0, z: -72, minZ: -80, maxZ: -64 },
      { x: -3.5, z: -98, minZ: -105, maxZ: -90 },
      { x: 4.5, z: -120, minZ: -128, maxZ: -114 }
    ];
    guardPositions.forEach((gp, idx) => {
      const isStrep = idx % 2 === 1;
      const tr = isStrep ? createStreptococcusSoldier() : createBacillusSoldier();
      tr.group.scale.setScalar(1.15);
      const standingY = isStrep ? -0.89 : -0.69;
      tr.group.position.set(gp.x, standingY, gp.z);
      tr.group.rotation.y = Math.PI;
      scene.add(tr.group);
      targets.push({
        id: `guard-${idx}`,
        kind: 'GUARD',
        name: isStrep ? 'Streptococcus Patrol Trooper' : 'Bacillus Corridor Sentry',
        mesh: tr.group,
        hp: 75,
        maxHp: 75,
        sabotaged: false,
        alerted: false,
        facingAngle: Math.PI,
        speed: 2.8,
        shootCooldown: 2.4,
        leftLeg: tr.leftLeg,
        rightLeg: tr.rightLeg,
        leftArm: tr.leftArm,
        rightArm: tr.rightArm,
        npcRole: 'PATROL',
        patrolMinZ: gp.minZ,
        patrolMaxZ: gp.maxZ,
        patrolDir: idx % 2 === 0 ? -1 : 1,
        patrolPauseTimer: 0
      });
    });

    // =========================================================================
    // 5. PRE-ALLOCATED OBJECT POOLS FOR BULLETS & PARTICLES (Zero GC / Zero Shader Freeze!)
    // =========================================================================
    const sharedBulletGeo = new THREE.SphereGeometry(0.14, 6, 6);
    const bulletPool: THREE.Mesh[] = [];
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(sharedBulletGeo, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      m.visible = false;
      scene.add(m);
      bulletPool.push(m);
    }
    const acquireBulletMesh = (colorHex: number): THREE.Mesh => {
      for (const m of bulletPool) {
        if (!m.visible) {
          m.visible = true;
          (m.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
          return m;
        }
      }
      const fallback = bulletPool[0];
      fallback.visible = true;
      (fallback.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
      return fallback;
    };

    const sharedParticleGeo = new THREE.SphereGeometry(0.18, 5, 5);
    const particlePool: THREE.Mesh[] = [];
    for (let i = 0; i < 64; i++) {
      const pm = new THREE.Mesh(sharedParticleGeo, new THREE.MeshBasicMaterial({ color: 0x10b981 }));
      pm.visible = false;
      scene.add(pm);
      particlePool.push(pm);
    }

    const bullets: BulletItem[] = [];
    const particles: ParticleItem[] = [];

    const spawnParticles = (pos: THREE.Vector3, color: number, count = 10) => {
      let spawned = 0;
      for (const pm of particlePool) {
        if (!pm.visible) {
          pm.visible = true;
          pm.position.copy(pos);
          pm.scale.setScalar(1);
          (pm.material as THREE.MeshBasicMaterial).color.setHex(color);
          particles.push({
            mesh: pm,
            velocity: new THREE.Vector3(
              (Math.random() - 0.5) * 10,
              Math.random() * 7,
              (Math.random() - 0.5) * 10
            ),
            life: 0,
            maxLife: 0.42 + Math.random() * 0.28
          });
          spawned++;
          if (spawned >= count) break;
        }
      }
    };

    // Scratch vectors to avoid per-frame allocations
    const _v1 = new THREE.Vector3();
    const _v2 = new THREE.Vector3();

    const fireSilencedShot = () => {
      if (stateRef.current.isReloading || stateRef.current.gameOver) return;
      if (stateRef.current.ammo <= 0) {
        handleReload();
        return;
      }

      setAmmo(prev => {
        const next = Math.max(0, prev - 1);
        stateRef.current.ammo = next;
        return next;
      });

      sounds.playShoot('ASSAULT');
      pistolModel.group.position.z = -0.68;
      pistolModel.slideMesh.position.z = 0.14;

      const bulletMesh = acquireBulletMesh(0x38bdf8);

      const cameraLookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
      const convergencePoint = camera.position.clone().addScaledVector(cameraLookDir, 35);
      const muzzleWorldPos = new THREE.Vector3();
      if (stateRef.current.isScoped) {
        muzzleWorldPos.copy(camera.position).addScaledVector(cameraLookDir, 0.75);
      } else {
        pistolModel.group.getWorldPosition(muzzleWorldPos);
        muzzleWorldPos.y += 0.08;
      }
      bulletMesh.position.copy(muzzleWorldPos);

      const shootDir = convergencePoint.sub(muzzleWorldPos).normalize();

      // Soft Auto-Aim Assist toward nearest General or Guard TORSO (helps move closer without auto-headshotting!)
      if (stateRef.current.autoAim) {
        let bestTarget: SpyTarget | null = null;
        let bestScore = Infinity;
        for (const t of targets) {
          if (t.hp <= 0 || t.sabotaged) continue;
          _v1.copy(t.mesh.position);
          _v1.y += 1.25;
          const dist = _v1.distanceTo(camera.position);
          if (dist > 65) continue;
          _v2.copy(_v1).sub(camera.position).normalize();
          const angle = shootDir.angleTo(_v2);
          const maxCone = stateRef.current.isScoped ? 0.26 : 0.22;
          if (angle < maxCone) {
            const priorityWeight = t.kind === 'GENERAL' ? 0.65 : 1.0;
            const score = angle * dist * priorityWeight;
            if (score < bestScore) {
              bestScore = score;
              bestTarget = t;
            }
          }
        }
        if (bestTarget) {
          _v1.copy(bestTarget.mesh.position);
          _v1.y += bestTarget.kind === 'GENERAL' ? 1.35 : 1.15;
          _v2.copy(_v1).sub(muzzleWorldPos).normalize();
          // Gently blend 42% toward torso center so auto-aim assists without auto-headshotting
          shootDir.lerp(_v2, 0.42).normalize();
        }
      }

      bullets.push({
        mesh: bulletMesh,
        velocity: shootDir.multiplyScalar(78),
        isEnemy: false,
        damage: stateRef.current.isScoped ? 95 : 70
      });
    };

    // Input Listeners (Keyboard + Mouse + Virtual Touch Joystick!)
    // Cache bounding rect so touchmove/mousemove NEVER triggers synchronous browser layout reflow
    let cachedRect = container.getBoundingClientRect();
    const refreshCachedRect = () => {
      cachedRect = container.getBoundingClientRect();
    };

    const updateAimFromClient = (clientX: number, clientY: number) => {
      const rWidth = cachedRect.width || window.innerWidth;
      const rHeight = cachedRect.height || window.innerHeight;
      const nx = ((clientX - cachedRect.left) / rWidth) * 2 - 1;
      const ny = -((clientY - cachedRect.top) / rHeight) * 2 + 1;
      mouseRef.current.x = Math.max(-1, Math.min(1, nx));
      mouseRef.current.y = Math.max(-1, Math.min(1, ny));
    };

    let aimTouchStartPos: { x: number; y: number; time: number } | null = null;
    let aimTouchDragged = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (isConceptModalOpenRef.current) return;
      if (e.cancelable) e.preventDefault(); // Block mobile OS long-press magnifying glass ("zooming lens")!
      sounds.unlockAudio();
      refreshCachedRect();
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
          // Right side / Aim area: drag to look/aim smoothly
          firingTouchIdRef.current = touch.identifier;
          aimTouchStartPos = { x: clientX, y: clientY, time: performance.now() };
          aimTouchDragged = false;
          updateAimFromClient(clientX, clientY);
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

          // Activate movement dragging after 7px threshold
          if (!movementTouchActiveRef.current && dist > 7) {
            movementTouchActiveRef.current = true;
            sounds.triggerHaptic(8, 0.25);
            setJoystickDisplay({ x: joystickCenterRef.current.x, y: joystickCenterRef.current.y });
          }

          if (movementTouchActiveRef.current) {
            const maxDist = 45;
            const clampedX = dist > 0 ? (dx / Math.max(dist, maxDist)) * Math.min(dist, maxDist) : 0;
            const clampedY = dist > 0 ? (dy / Math.max(dist, maxDist)) * Math.min(dist, maxDist) : 0;
            joystickOffsetRef.current = { x: clampedX, y: clampedY };
            moveInputRef.current.x = clampedX / maxDist;
            moveInputRef.current.z = clampedY / maxDist;
            if (joystickKnobDomRef.current) {
              joystickKnobDomRef.current.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
            }
          }
        } else if (touch.identifier === firingTouchIdRef.current) {
          if (
            aimTouchStartPos &&
            Math.hypot(touch.clientX - aimTouchStartPos.x, touch.clientY - aimTouchStartPos.y) > 9
          ) {
            aimTouchDragged = true;
          }
          updateAimFromClient(touch.clientX, touch.clientY);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === movementTouchIdRef.current) {
          if (!movementTouchActiveRef.current && movementTouchStartPosRef.current) {
            const dt = performance.now() - movementTouchStartPosRef.current.time;
            const dist = Math.hypot(
              touch.clientX - movementTouchStartPosRef.current.x,
              touch.clientY - movementTouchStartPosRef.current.y
            );
            if (dt < 320 && dist < 12) {
              updateAimFromClient(touch.clientX, touch.clientY);
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
          // Only fire if it was a deliberate quick stationary tap on the right side (never when moving/dragging to aim!)
          if (
            !aimTouchDragged &&
            aimTouchStartPos &&
            performance.now() - aimTouchStartPos.time < 190
          ) {
            triggerShootRef.current = true;
          }
          firingTouchIdRef.current = null;
          aimTouchStartPos = null;
          aimTouchDragged = false;
          cancelHoldShootScope();
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        sounds.unlockAudio();
        sounds.triggerHaptic(12, 0.4);
        setIsGamePaused(prev => !prev);
        return;
      }
      if (isGamePausedRef.current) return;
      if (isConceptModalOpenRef.current) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          dismissConceptCard();
        }
        return;
      }
      keysRef.current[e.code] = true;
      if (e.code === 'KeyQ') {
        e.preventDefault();
        handleSwapSpyWeaponRef.current?.();
      }
      if (e.code === 'Digit1') {
        e.preventDefault();
        handleSwapSpyWeaponRef.current?.(0);
      }
      if (e.code === 'Digit2') {
        e.preventDefault();
        handleSwapSpyWeaponRef.current?.(1);
      }
      if (e.code === 'Digit3') {
        e.preventDefault();
        handleSwapSpyWeaponRef.current?.(2);
      }
      if (e.code === 'KeyR') handleReload();
      if (e.code === 'KeyC') toggleCrouch();
      if (e.code === 'KeyF') {
        setIsScoped(prev => {
          const next = !prev;
          stateRef.current.isScoped = next;
          return next;
        });
      }
      if (e.code === 'KeyV') toggleCloak();
      if (e.code === 'KeyE') {
        e.preventDefault();
        triggerInteractRef.current = true;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handleHeal();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isConceptModalOpenRef.current) return;
      updateAimFromClient(e.clientX, e.clientY);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (isConceptModalOpenRef.current) return;
      sounds.unlockAudio();
      if (e.button === 0) {
        mouseRef.current.isDown = true;
        startHoldShootScopeTimer();
        updateAimFromClient(e.clientX, e.clientY);
        triggerShootRef.current = true;
      } else if (e.button === 2) {
        setIsScoped(prev => {
          const next = !prev;
          stateRef.current.isScoped = next;
          return next;
        });
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        mouseRef.current.isDown = false;
        cancelHoldShootScope();
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    let lastSpyWheelTime = 0;
    const onWheel = (e: WheelEvent) => {
      if (isConceptModalOpenRef.current || isGamePausedRef.current) return;
      e.preventDefault();
      const now = performance.now();
      if (now - lastSpyWheelTime < 120) return;
      lastSpyWheelTime = now;

      const dir = e.deltaY > 0 ? 'next' : 'prev';
      handleSwapSpyWeaponRef.current?.(dir);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    const domElem = renderer.domElement;
    domElem.addEventListener('mousemove', onMouseMove);
    domElem.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    domElem.addEventListener('contextmenu', onContextMenu);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    // Change-guard refs so React setState is NEVER called 60x/second!
    let lastDoorName: string | null = null;
    let lastSabotageName: string | null = null;
    let lastCoverName: string | null = null;
    let lastRoundedEnergy = 100;

    let lastTime = performance.now();
    let animFrameId: number;
    let timeCounter = 0;

    // Frame-0 GPU Shader Warm-Up
    renderer.render(scene, camera);

    const animate = (now: number) => {
      animFrameId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (stateRef.current.gameOver || isConceptModalOpenRef.current || isGamePausedRef.current) {
        renderer.render(scene, camera);
        return;
      }

      timeCounter += dt;
      if (Math.floor(timeCounter) !== Math.floor(timeCounter - dt)) {
        setTimeElapsed(Math.floor(timeCounter));
      }

      // Stealth Cloak Energy Management (Only update React state when integer value changes!)
      if (stateRef.current.stealthCloakActive) {
        const nextEnergy = Math.max(0, stateRef.current.stealthEnergy - dt * 16);
        stateRef.current.stealthEnergy = nextEnergy;
        const rounded = Math.round(nextEnergy);
        if (rounded !== lastRoundedEnergy) {
          lastRoundedEnergy = rounded;
          setStealthEnergy(rounded);
        }
        if (nextEnergy <= 0) {
          stateRef.current.stealthCloakActive = false;
          setStealthCloakActive(false);
        }
      } else if (stateRef.current.stealthEnergy < 100) {
        const nextEnergy = Math.min(100, stateRef.current.stealthEnergy + dt * 11);
        stateRef.current.stealthEnergy = nextEnergy;
        const rounded = Math.round(nextEnergy);
        if (rounded !== lastRoundedEnergy) {
          lastRoundedEnergy = rounded;
          setStealthEnergy(rounded);
        }
      }

      // Camera Scoped FOV & Crouch Eye Height
      const targetFov = stateRef.current.isScoped ? 30 : 60;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov += (targetFov - camera.fov) * 0.15;
        camera.updateProjectionMatrix();
      }

      const targetCamY = stateRef.current.isCrouching ? -0.75 : 0.0;
      camera.position.y += (targetCamY - camera.position.y) * 0.18;

      // Player Infiltration Movement (Virtual Joystick + WASD / Arrow Keys)
      const moveSpeed = (stateRef.current.isCrouching ? 10.5 : 14.5) * dt;
      let inputX = moveInputRef.current.x;
      let inputZ = moveInputRef.current.z;

      if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) inputZ -= 1;
      if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) inputZ += 1;
      if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) inputX -= 1;
      if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) inputX += 1;

      let nextX = camera.position.x + inputX * moveSpeed * 0.88;
      let nextZ = camera.position.z + inputZ * moveSpeed;

      nextX = Math.max(-14.5, Math.min(14.5, nextX));
      nextZ = Math.max(-155, Math.min(16, nextZ));

      // Check collision with closed Bio-Security Doors & Bulkhead Walls
      let blockedByDoor = false;
      for (const door of doors) {
        const crossingZ =
          (camera.position.z >= door.z - 1.5 && nextZ <= door.z + 1.5) ||
          Math.abs(nextZ - door.z) < 1.65;
        if (crossingZ) {
          const inDoorwayGap = Math.abs(nextX - door.gapX) < 3.1;
          if (!inDoorwayGap) {
            blockedByDoor = true;
          } else if (!door.isOpen) {
            blockedByDoor = true;
          }
        }
      }

      camera.position.x = nextX;
      if (!blockedByDoor) {
        camera.position.z = nextZ;
      }

      // Smoothly animate opening Bio-Doors
      let closestClosedDoor: BioDoor | null = null;
      let closestDoorDist = Infinity;
      for (const door of doors) {
        if (door.isOpen && door.openProgress < 1) {
          door.openProgress = Math.min(1, door.openProgress + dt * 2.2);
          door.leftPanel.position.x = door.gapX - 1.8 - door.openProgress * 3.4;
          door.rightPanel.position.x = door.gapX + 1.8 + door.openProgress * 3.4;
        }
        if (!door.isOpen) {
          const dist = Math.hypot(door.gapX - camera.position.x, door.z - camera.position.z);
          if (dist < 11 && dist < closestDoorDist) {
            closestDoorDist = dist;
            closestClosedDoor = door;
          }
        }
      }
      const nextDoorName = closestClosedDoor ? closestClosedDoor.name : null;
      if (nextDoorName !== lastDoorName) {
        lastDoorName = nextDoorName;
        setNearbyDoorName(nextDoorName);
      }

      // Check if player is Crouched or Behind an Anatomical Cover Structure / Bio-Tank
      let foundCoverName: string | null = null;
      for (const cov of anatomicalCovers) {
        const d = Math.hypot(camera.position.x - cov.x, camera.position.z - cov.z);
        if (d < cov.radius) {
          foundCoverName = cov.name;
          break;
        }
      }
      if (!foundCoverName) {
        for (const t of targets) {
          if (t.kind === 'TANK' && t.hp > 0) {
            const d = Math.hypot(camera.position.x - t.mesh.position.x, camera.position.z - t.mesh.position.z);
            if (d < 5.2) {
              foundCoverName = `${t.name} Hull`;
              break;
            }
          }
        }
      }

      const hiddenNow = stateRef.current.isCrouching || Boolean(foundCoverName) || stateRef.current.stealthCloakActive;
      if (hiddenNow !== stateRef.current.isBehindCover) {
        stateRef.current.isBehindCover = hiddenNow;
        setIsBehindCover(hiddenNow);
      }
      if (foundCoverName !== lastCoverName) {
        lastCoverName = foundCoverName;
        setCoverObjectName(foundCoverName);
      }

      // Camera aim rotation based on mouse / touch aim (identical 3D angle in hipfire & scoped so scope aim never deviates!)
      const targetRotY = -mouseRef.current.x * 0.48;
      const targetRotX = mouseRef.current.y * 0.36;
      camera.rotation.y = THREE.MathUtils.damp(camera.rotation.y, targetRotY, 24, dt);
      camera.rotation.x = THREE.MathUtils.damp(camera.rotation.x, targetRotX, 24, dt);

      // 3D Silenced Pistol Scope-In (ADS), Smooth Crosshair Aim Tracking & Recoil Recovery
      if (stateRef.current.isScoped) {
        // Hide 3D gun mesh while scoped so it never clips into the optic lens as a black box!
        pistolModel.group.visible = false;
      } else {
        pistolModel.group.visible = true;
        const aimX = mouseRef.current.x;
        const aimY = mouseRef.current.y;
        const breathBobX = Math.cos(timeCounter * 1.9) * 0.004;
        const breathBobY = Math.sin(timeCounter * 2.7) * 0.006;

        const targetPistolX = 0.34 - inputX * 0.05 + aimX * 0.18 + breathBobX;
        const targetPistolY = -0.34 - Math.abs(inputX) * 0.012 + aimY * 0.14 + breathBobY;
        const targetPistolZ = -0.84 - (Math.abs(aimX) + Math.abs(aimY)) * 0.03;

        const targetPistolRotY = THREE.MathUtils.clamp(-aimX * 0.36, -0.52, 0.52);
        const targetPistolRotX = THREE.MathUtils.clamp(aimY * 0.28, -0.42, 0.42);
        const targetPistolRotZ = -aimX * 0.12 + inputX * 0.08;

        pistolModel.group.position.x = THREE.MathUtils.damp(pistolModel.group.position.x, targetPistolX, 22, dt);
        pistolModel.group.position.y = THREE.MathUtils.damp(pistolModel.group.position.y, targetPistolY, 22, dt);
        pistolModel.group.position.z = THREE.MathUtils.damp(pistolModel.group.position.z, targetPistolZ, 20, dt);
        pistolModel.group.rotation.x = THREE.MathUtils.damp(pistolModel.group.rotation.x, targetPistolRotX, 22, dt);
        pistolModel.group.rotation.y = THREE.MathUtils.damp(pistolModel.group.rotation.y, targetPistolRotY, 22, dt);
        pistolModel.group.rotation.z = THREE.MathUtils.damp(pistolModel.group.rotation.z, targetPistolRotZ, 18, dt);
        pistolModel.slideMesh.position.z = THREE.MathUtils.damp(pistolModel.slideMesh.position.z, -0.05, 24, dt);
      }

      if (triggerShootRef.current) {
        triggerShootRef.current = false;
        fireSilencedShot();
      }

      // Check nearby Tank, Base, or Artillery for Sabotage [E]
      let closestSabotage: SpyTarget | null = null;
      let closestDist = Infinity;
      for (const t of targets) {
        if ((t.kind === 'TANK' || t.kind === 'BASE' || t.kind === 'ARTILLERY') && !t.sabotaged && !t.c4Planted && t.hp > 0) {
          const d = t.mesh.position.distanceTo(camera.position);
          if (d < 14.5 && d < closestDist) {
            closestDist = d;
            closestSabotage = t;
          }
        }
      }

      const nextSabotageName = closestSabotage ? closestSabotage.name : null;
      if (nextSabotageName !== lastSabotageName) {
        lastSabotageName = nextSabotageName;
        setNearbySabotageTarget(nextSabotageName);
      }

      // Execute [E] Interact: Open Bio-Security Door OR Plant Timed C4 Charge!
      if (triggerInteractRef.current) {
        triggerInteractRef.current = false;

        if (closestClosedDoor) {
          closestClosedDoor.isOpen = true;
          (closestClosedDoor.statusLight.material as THREE.MeshBasicMaterial).color.setHex(0x10b981);
          sounds.triggerHaptic([14, 25, 22], 0.65);
          sounds.playActiveReloadLock();
          setAlertMessage(`UNLOCKED: ${closestClosedDoor.name} — Take the turn & stay crouched!`);
        } else if (closestSabotage && !closestSabotage.c4Planted) {
          closestSabotage.c4Planted = true;
          closestSabotage.c4Timer = 3.0;
          closestSabotage.c4LastBeepSec = 3;
          if (closestSabotage.c4Mesh) {
            closestSabotage.c4Mesh.visible = true;
          }
          sounds.playC4Arming();
          sounds.triggerHaptic([18, 30, 18], 0.7);
          setAlertMessage(`💣 C4 ARMED ON ${closestSabotage.name.toUpperCase()} — 3.0s TO DETONATION! STEP BACK!`);
        }
      }

      // =====================================================================
      // Update Timed C4 Countdown, Explosion & Persistent 3D Burning Flames
      // =====================================================================
      for (const t of targets) {
        if (t.c4Planted && !t.sabotaged) {
          t.c4Timer = Math.max(0, (t.c4Timer ?? 0) - dt);
          if (t.c4Led) {
            const ledOn = Math.sin(now * 0.035) > 0;
            (t.c4Led.material as THREE.MeshBasicMaterial).color.setHex(ledOn ? 0xff1111 : 0x450a0a);
          }
          const ceilSec = Math.ceil(t.c4Timer);
          if (t.c4Timer > 0 && ceilSec < (t.c4LastBeepSec ?? 4)) {
            t.c4LastBeepSec = ceilSec;
            sounds.playC4CountdownTick(t.c4Timer <= 1.05);
            setAlertMessage(`💣 C4 DETONATING IN ${ceilSec}s — ${t.name.toUpperCase()}!`);
          }
          if (t.c4Timer <= 0) {
            // DETONATE C4 WITH EXPLOSION + PERSISTENT FIRE!
            t.sabotaged = true;
            t.hp = 0;
            if (t.c4Mesh) t.c4Mesh.visible = false;
            if (t.fireGroup) t.fireGroup.visible = true;

            sounds.playExplosion();
            sounds.playCascadeShockwave();
            sounds.triggerHaptic([45, 30, 65], 1.0);

            _v1.copy(t.mesh.position).add(new THREE.Vector3(0, 1.8, 0));
            spawnParticles(_v1, 0xff4500, 12);
            spawnParticles(_v1, 0xfacc15, 10);
            spawnParticles(_v1, 0xef4444, 8);

            if (t.kind === 'TANK') {
              t.mesh.rotation.z = 0.28;
              t.mesh.position.y = -2.25;
              stateRef.current.tanksSabotaged += 1;
              setTanksSabotaged(stateRef.current.tanksSabotaged);
              setAlertMessage(`💥 C4 DETONATED: ${t.name} engulfed in flames!`);
            } else if (t.kind === 'ARTILLERY') {
              t.mesh.rotation.z = 0.38;
              t.mesh.position.y = -2.6;
              stateRef.current.artillerySabotaged += 1;
              setArtillerySabotaged(stateRef.current.artillerySabotaged);
              setAlertMessage(`💥 C4 DETONATED: ${t.name} destroyed & burning!`);
            } else if (t.kind === 'BASE') {
              if (t.coreMesh) {
                (t.coreMesh.material as THREE.MeshStandardMaterial).color.setHex(0x334155);
                (t.coreMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xff4500);
                (t.coreMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.45;
              }
              stateRef.current.basesSabotaged += 1;
              setBasesSabotaged(stateRef.current.basesSabotaged);
              setAlertMessage(`💥 C4 DETONATED: ${t.name} core incinerated!`);
            }

            stateRef.current.kills += 1;
            stateRef.current.score += t.maxHp * 3;
          }
        }

        // Animate persistent 3D flickering flames & rising smoke on sabotaged/destroyed targets
        if (t.sabotaged && t.fireGroup && t.fireGroup.visible) {
          t.fireGroup.children.forEach((child, cIdx) => {
            if (child.userData.isFlame) {
              const baseS = child.userData.baseScale || 1.0;
              const flicker = 0.82 + Math.sin(now * 0.022 + cIdx * 1.9) * 0.34;
              child.scale.set(baseS * (0.9 + Math.cos(now * 0.015 + cIdx) * 0.12), baseS * flicker, baseS * 0.95);
              child.rotation.y += dt * (2.2 + cIdx * 0.4);
            } else if (child.userData.isSmoke) {
              const cycle = ((now * 0.0007 + (child.userData.smokeOffset || 0)) % 1);
              child.position.y = 1.2 + cycle * 2.5;
              child.scale.setScalar(0.75 + cycle * 0.9);
            }
          });
        }
      }

      // =====================================================================
      // Update Targets, NPC Door Defenders, Corridor Patrols & Stealth Vision
      // =====================================================================
      for (const t of targets) {
        if (t.hp <= 0 || t.sabotaged) continue;

        if (t.kind === 'BASE') {
          if (t.radarDish) t.radarDish.rotation.y += dt * 1.6;
          if (t.coreMesh) {
            t.coreMesh.scale.setScalar(1 + Math.sin(now * 0.005) * 0.08);
          }
          continue;
        }

        const distToPlayer = t.mesh.position.distanceTo(camera.position);

        if (!t.alerted) {
          // Living NPC Behaviors: Door Guards, Corridor Patrols & Conversing Squads
          if (t.npcRole === 'DOOR_GUARD' && t.patrolMinX !== undefined && t.patrolMaxX !== undefined) {
            if ((t.patrolPauseTimer ?? 0) > 0) {
              t.patrolPauseTimer = (t.patrolPauseTimer ?? 0) - dt;
              t.facingAngle = Math.PI; // Look down corridor while pausing at door post
              if (t.leftLeg && t.rightLeg) {
                t.leftLeg.rotation.x = THREE.MathUtils.damp(t.leftLeg.rotation.x, 0, 10, dt);
                t.rightLeg.rotation.x = THREE.MathUtils.damp(t.rightLeg.rotation.x, 0, 10, dt);
              }
              if (t.headGroup) {
                t.headGroup.rotation.y = Math.sin(now * 0.0035) * 0.45;
              }
            } else {
              const dir = t.patrolDir ?? 1;
              t.mesh.position.x += dir * (t.speed * 0.62) * dt;
              t.facingAngle = dir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
              const stride = Math.sin(now * 0.0095) * 0.55;
              if (t.leftLeg && t.rightLeg) {
                t.leftLeg.rotation.x = stride;
                t.rightLeg.rotation.x = -stride;
              }
              if (t.leftArm && t.rightArm) {
                t.leftArm.rotation.x = -stride * 0.55;
                t.rightArm.rotation.x = stride * 0.55;
              }
              if (t.mesh.position.x >= t.patrolMaxX) {
                t.mesh.position.x = t.patrolMaxX;
                t.patrolDir = -1;
                t.patrolPauseTimer = 1.1;
              } else if (t.mesh.position.x <= t.patrolMinX) {
                t.mesh.position.x = t.patrolMinX;
                t.patrolDir = 1;
                t.patrolPauseTimer = 1.1;
              }
            }
          } else if (t.npcRole === 'PATROL' && t.patrolMinZ !== undefined && t.patrolMaxZ !== undefined) {
            if ((t.patrolPauseTimer ?? 0) > 0) {
              t.patrolPauseTimer = (t.patrolPauseTimer ?? 0) - dt;
              if (t.leftLeg && t.rightLeg) {
                t.leftLeg.rotation.x = THREE.MathUtils.damp(t.leftLeg.rotation.x, 0, 10, dt);
                t.rightLeg.rotation.x = THREE.MathUtils.damp(t.rightLeg.rotation.x, 0, 10, dt);
              }
              if (t.headGroup) {
                t.headGroup.rotation.y = Math.sin(now * 0.003) * 0.38;
              }
            } else {
              const dir = t.patrolDir ?? 1;
              t.mesh.position.z += dir * (t.speed * 0.58) * dt;
              t.facingAngle = dir > 0 ? 0 : Math.PI;
              const stride = Math.sin(now * 0.0085) * 0.5;
              if (t.leftLeg && t.rightLeg) {
                t.leftLeg.rotation.x = stride;
                t.rightLeg.rotation.x = -stride;
              }
              if (t.leftArm && t.rightArm) {
                t.leftArm.rotation.x = -stride * 0.5;
                t.rightArm.rotation.x = stride * 0.5;
              }
              if (t.mesh.position.z >= t.patrolMaxZ) {
                t.mesh.position.z = t.patrolMaxZ;
                t.patrolDir = -1;
                t.patrolPauseTimer = 1.4;
              } else if (t.mesh.position.z <= t.patrolMinZ) {
                t.mesh.position.z = t.patrolMinZ;
                t.patrolDir = 1;
                t.patrolPauseTimer = 1.4;
              }
            }
          } else if (t.npcRole === 'PATROL' && t.patrolMinX !== undefined && t.patrolMaxX !== undefined) {
            // Generals pacing command post
            const dir = t.patrolDir ?? 1;
            t.mesh.position.x += dir * (t.speed * 0.45) * dt;
            t.facingAngle = Math.PI + dir * 0.35;
            const stride = Math.sin(now * 0.007) * 0.42;
            if (t.leftLeg && t.rightLeg) {
              t.leftLeg.rotation.x = stride;
              t.rightLeg.rotation.x = -stride;
            }
            if (t.leftArm && t.rightArm) {
              t.leftArm.rotation.x = -stride * 0.4;
              t.rightArm.rotation.x = stride * 0.4;
            }
            if (t.mesh.position.x >= t.patrolMaxX) {
              t.mesh.position.x = t.patrolMaxX;
              t.patrolDir = -1;
            } else if (t.mesh.position.x <= t.patrolMinX) {
              t.mesh.position.x = t.patrolMinX;
              t.patrolDir = 1;
            }
          } else if (t.npcRole === 'TALKER') {
            // Animated conversational gestures, weight shifting on legs & head nodding
            const phase = now * 0.004 + t.mesh.position.x * 1.7;
            if (t.leftArm && t.rightArm) {
              t.leftArm.rotation.x = -0.25 + Math.sin(phase * 1.4) * 0.28;
              t.rightArm.rotation.x = -0.35 - Math.cos(phase * 1.2) * 0.32;
            }
            if (t.leftLeg && t.rightLeg) {
              t.leftLeg.rotation.x = Math.sin(phase * 0.6) * 0.1;
              t.rightLeg.rotation.x = -Math.sin(phase * 0.6) * 0.1;
            }
            if (t.headGroup) {
              t.headGroup.rotation.y = Math.sin(phase * 0.9) * 0.24;
              t.headGroup.rotation.x = Math.cos(phase * 1.3) * 0.12;
            }
          } else {
            if (t.leftArm && t.rightArm) {
              t.leftArm.rotation.x = Math.sin(now * 0.002) * 0.08;
              t.rightArm.rotation.x = -Math.sin(now * 0.002) * 0.08;
            }
          }

          t.mesh.rotation.y += (t.facingAngle - t.mesh.rotation.y) * 0.12;

          const isPlayerExposed =
            !stateRef.current.isCrouching &&
            !stateRef.current.isBehindCover &&
            !stateRef.current.stealthCloakActive;

          const detectRange = t.npcRole === 'DOOR_GUARD' ? 14 : 12;
          if (isPlayerExposed && distToPlayer < detectRange) {
            t.alerted = true;
            t.facingAngle = 0;
            sounds.playBacteriaChatter(true);
            setAlertMessage(`DETECTED BY ${t.name.toUpperCase()}! Crouch [C] behind cover or eliminate!`);
          }
        } else {
          if (
            (stateRef.current.stealthCloakActive ||
              (stateRef.current.isCrouching && stateRef.current.isBehindCover)) &&
            distToPlayer > 9
          ) {
            t.alerted = false;
            t.facingAngle = Math.PI;
            continue;
          }

          t.facingAngle = 0;
          t.mesh.rotation.y += (0 - t.mesh.rotation.y) * 0.12;

          if (distToPlayer > 12) {
            _v1.set(
              camera.position.x - t.mesh.position.x,
              0,
              camera.position.z - t.mesh.position.z
            ).normalize();
            t.mesh.position.addScaledVector(_v1, t.speed * dt);
          }

          if (t.leftLeg && t.rightLeg) {
            t.leftLeg.rotation.x = Math.sin(now * 0.009) * 0.55;
            t.rightLeg.rotation.x = -Math.sin(now * 0.009) * 0.55;
          }
          if (t.leftArm && t.rightArm) {
            t.leftArm.rotation.x = -0.45 + Math.cos(now * 0.009) * 0.25;
            t.rightArm.rotation.x = -0.55;
          }

          t.shootCooldown -= dt;
          if (t.shootCooldown <= 0 && distToPlayer < 38) {
            t.shootCooldown = t.kind === 'GENERAL' ? 1.8 : t.kind === 'TANK' ? 2.6 : 2.3;
            const eBullet = acquireBulletMesh(t.kind === 'GENERAL' ? 0xa855f7 : 0xf43f5e);
            _v1.copy(t.mesh.position).add(new THREE.Vector3(0, 2.0, 0));
            eBullet.position.copy(_v1);
            const aimDir = camera.position.clone().sub(_v1).normalize();
            bullets.push({
              mesh: eBullet,
              velocity: aimDir.multiplyScalar(28),
              isEnemy: true,
              damage: t.kind === 'GENERAL' ? 10 : t.kind === 'TANK' ? 14 : 6
            });
          }
        }
      }

      // Update Bullets (Pooled: hide mesh on expiry/hit instead of scene.remove!)
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.mesh.position.addScaledVector(b.velocity, dt);

        if (b.mesh.position.distanceTo(camera.position) > 130) {
          b.mesh.visible = false;
          bullets.splice(i, 1);
          continue;
        }

        if (b.isEnemy) {
          if (
            stateRef.current.isCrouching &&
            stateRef.current.isBehindCover &&
            b.mesh.position.distanceTo(camera.position) < 2.5
          ) {
            spawnParticles(b.mesh.position, 0x38bdf8, 4);
            b.mesh.visible = false;
            bullets.splice(i, 1);
            continue;
          }

          if (b.mesh.position.distanceTo(camera.position) < 1.5) {
            b.mesh.visible = false;
            bullets.splice(i, 1);
            sounds.triggerHaptic([35, 25, 45], 0.9);
            sounds.playHitmarker(false);
            setHp(prev => {
              const next = Math.max(0, prev - b.damage);
              stateRef.current.hp = next;
              if (next <= 0 && !stateRef.current.gameOver) {
                stateRef.current.gameOver = true;
                onPhaseDefeatRef.current(stateRef.current.score, stateRef.current.kills);
              }
              return next;
            });
            continue;
          }
        } else {
          let hit = false;
          for (const t of targets) {
            if (t.hp <= 0 || t.sabotaged) continue;
            _v1.copy(t.mesh.position).add(new THREE.Vector3(0, 2.0, 0));
            const hitRadius = t.kind === 'BASE' ? 3.5 : t.kind === 'TANK' ? 2.8 : 1.9;
            if (b.mesh.position.distanceTo(_v1) < hitRadius) {
              hit = true;
              const headHeightY = t.mesh.position.y + (t.kind === 'GENERAL' ? 2.35 : 1.85);
              const isHeadshot =
                (t.kind === 'GUARD' || t.kind === 'GENERAL' || t.kind === 'TANK') &&
                b.mesh.position.y >= headHeightY - 0.35;
              const stealthMultiplier =
                isHeadshot || !t.alerted || stateRef.current.isCrouching || stateRef.current.stealthCloakActive
                  ? 3.0
                  : 1.0;
              const finalDmg = isHeadshot && t.kind === 'GUARD' ? Math.max(t.hp, Math.round(b.damage * 3)) : Math.round(b.damage * stealthMultiplier);
              t.hp -= finalDmg;
              stateRef.current.score += finalDmg * 2;
              sounds.playHitmarker(true);
              spawnParticles(b.mesh.position, 0x38bdf8, 6);

              // Project 3D hit position to screen & spawn Fortnite-style floating damage number + HEADSHOT!
              const proj = _v1.clone().project(camera);
              const screenX = Math.max(15, Math.min(85, (proj.x + 1) * 50));
              const screenY = Math.max(15, Math.min(82, (-proj.y + 1) * 50));
              const dmgId = performance.now() + Math.random();
              const isCritStealth = isHeadshot || stealthMultiplier >= 3.0;
              setSpyDamageNumbers(prev => [
                ...prev.slice(-8),
                {
                  id: dmgId,
                  x: screenX,
                  y: screenY,
                  offsetX: Math.round((Math.random() - 0.5) * 30),
                  offsetY: Math.round((Math.random() - 0.5) * 16),
                  isCritical: isCritStealth,
                  isHeadshot,
                  isArmored: t.kind === 'TANK' || t.kind === 'BASE',
                  damage: finalDmg,
                },
              ]);
              window.setTimeout(() => {
                setSpyDamageNumbers(prev => prev.filter(m => m.id !== dmgId));
              }, 750);

              if (t.hp <= 0) {
                t.hp = 0;
                sounds.playKillConfirm();
                spawnParticles(_v1, 0x10b981, 14);
                stateRef.current.kills += 1;

                if (t.kind === 'GENERAL') {
                  t.mesh.visible = false;
                  stateRef.current.generalsEliminated += 1;
                  setGeneralsEliminated(stateRef.current.generalsEliminated);
                  setAlertMessage(`SILENT ASSASSINATION: ${t.name} eliminated!`);
                } else if (t.kind === 'TANK') {
                  t.sabotaged = true;
                  if (t.c4Mesh) t.c4Mesh.visible = false;
                  if (t.fireGroup) t.fireGroup.visible = true;
                  t.mesh.rotation.z = 0.28;
                  stateRef.current.tanksSabotaged += 1;
                  setTanksSabotaged(stateRef.current.tanksSabotaged);
                  setAlertMessage(`NEUTRALIZED: ${t.name} destroyed & burning!`);
                } else if (t.kind === 'ARTILLERY') {
                  t.sabotaged = true;
                  if (t.c4Mesh) t.c4Mesh.visible = false;
                  if (t.fireGroup) t.fireGroup.visible = true;
                  t.mesh.rotation.z = 0.38;
                  t.mesh.position.y = -2.6;
                  stateRef.current.artillerySabotaged += 1;
                  setArtillerySabotaged(stateRef.current.artillerySabotaged);
                  setAlertMessage(`NEUTRALIZED: ${t.name} destroyed & burning!`);
                } else if (t.kind === 'BASE') {
                  t.sabotaged = true;
                  if (t.c4Mesh) t.c4Mesh.visible = false;
                  if (t.fireGroup) t.fireGroup.visible = true;
                  if (t.coreMesh) {
                    (t.coreMesh.material as THREE.MeshStandardMaterial).color.setHex(0x334155);
                    (t.coreMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xff4500);
                  }
                  stateRef.current.basesSabotaged += 1;
                  setBasesSabotaged(stateRef.current.basesSabotaged);
                  setAlertMessage(`SABOTAGED: ${t.name} destroyed & burning!`);
                } else {
                  t.mesh.visible = false;
                }
              } else {
                t.alerted = true;
                t.facingAngle = 0;
              }
              break;
            }
          }
          if (hit) {
            b.mesh.visible = false;
            bullets.splice(i, 1);
            continue;
          }
        }
      }

      // Check Victory Condition
      if (
        stateRef.current.generalsEliminated >= totalGenerals &&
        stateRef.current.tanksSabotaged >= totalTanks &&
        stateRef.current.artillerySabotaged >= totalArtillery &&
        stateRef.current.basesSabotaged >= totalBases &&
        !stateRef.current.gameOver
      ) {
        stateRef.current.gameOver = true;
        sounds.playVictory();
        setTimeout(() => {
          onPhaseCompleteRef.current(stateRef.current.score + 1500, stateRef.current.kills);
        }, 900);
      }

      // Update Particles (Pooled: hide mesh on expiry)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.mesh.visible = false;
          particles.splice(i, 1);
          continue;
        }
        p.mesh.position.addScaledVector(p.velocity, dt);
        p.mesh.scale.setScalar(1 - p.life / p.maxLife);
      }

      // Floating golden mucus droplets gentle bobbing animation
      floatingDroplets.forEach((d, idx) => {
        d.position.y += Math.sin(now * 0.002 + idx) * 0.003;
      });

      // Update talking squads dialogue, audible bacterial chatter & 2D speech bubble projection (throttled to avoid 60Hz React re-renders)
      const camPos = camera.position;
      talkingSquads.forEach((sq) => {
        const hasActiveTalker = targets.some(
          (t) => sq.memberIds.includes(t.id) && t.hp > 0 && !t.alerted
        );
        if (!hasActiveTalker) return;

        sq.timer += dt;
        sq.chatterCooldown = Math.max(0, sq.chatterCooldown - dt);
        const dist = sq.pos.distanceTo(camPos);

        if (sq.timer > 4.2) {
          sq.timer = 0;
          sq.currentLineIndex = (sq.currentLineIndex + 1) % sq.lines.length;
          if (dist < 30 && sq.chatterCooldown <= 0) {
            sounds.playBacteriaChatter(false);
            sq.chatterCooldown = 3.2;
          }
        } else if (dist < 22 && sq.chatterCooldown <= 0) {
          sounds.playBacteriaChatter(false);
          sq.chatterCooldown = 4.0;
        }
      });

      if (now - (stateRef.current as any).lastDialogueSyncTime > 240 || !(stateRef.current as any).lastDialogueSyncTime) {
        (stateRef.current as any).lastDialogueSyncTime = now;
        const currentDialogues: Array<{ id: string; x: number; y: number; text: string }> = [];

        talkingSquads.forEach((sq) => {
          const hasActiveTalker = targets.some(
            (t) => sq.memberIds.includes(t.id) && t.hp > 0 && !t.alerted
          );
          if (!hasActiveTalker) return;
          const dist = sq.pos.distanceTo(camPos);
          if (dist < 34 && sq.pos.z < camPos.z) {
            _v1.copy(sq.pos);
            _v1.y += 2.8;
            _v1.project(camera);
            if (_v1.z < 1) {
              const screenX = Math.round((_v1.x * 0.5 + 0.5) * 100);
              const screenY = Math.round((-(_v1.y * 0.5) + 0.5) * 100);
              if (screenX >= 5 && screenX <= 95 && screenY >= 5 && screenY <= 95) {
                currentDialogues.push({
                  id: sq.id,
                  x: screenX,
                  y: screenY,
                  text: sq.lines[sq.currentLineIndex]
                });
              }
            }
          }
        });

        for (const t of targets) {
          if (t.npcRole === 'DOOR_GUARD' && t.hp > 0 && t.guardLine) {
            const dist = t.mesh.position.distanceTo(camPos);
            if (dist < 28 && t.mesh.position.z < camPos.z) {
              _v1.copy(t.mesh.position);
              _v1.y += 2.75;
              _v1.project(camera);
              if (_v1.z < 1) {
                const screenX = Math.round((_v1.x * 0.5 + 0.5) * 100);
                const screenY = Math.round((-(_v1.y * 0.5) + 0.5) * 100);
                if (screenX >= 5 && screenX <= 95 && screenY >= 5 && screenY <= 95) {
                  currentDialogues.push({
                    id: t.id,
                    x: screenX,
                    y: screenY,
                    text: t.alerted ? 'INTRUDER AT THE GATE! OPEN FIRE!' : t.guardLine
                  });
                }
              }
            }
          }
        }

        if (currentDialogues.length > 0 || (stateRef.current as any).hadDialoguesLastSync) {
          (stateRef.current as any).hadDialoguesLastSync = currentDialogues.length > 0;
          setSquadDialogues(currentDialogues);
        }
      }

      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth || window.innerWidth;
      const h = mountRef.current.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      refreshCachedRect();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (holdShootTimerRef.current) {
        clearTimeout(holdShootTimerRef.current);
      }
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      domElem.removeEventListener('mousemove', onMouseMove);
      domElem.removeEventListener('mousedown', onMouseDown);
      domElem.removeEventListener('contextmenu', onContextMenu);
      disposeSceneGraph(scene);
      disposeSceneGraph(camera);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onTouchStart={() => sounds.unlockAudio()}
      onPointerDown={() => sounds.unlockAudio()}
      className="fixed inset-0 w-full h-full bg-slate-950 overflow-hidden select-none font-sans"
    >
      {/* 3D WebGL Viewport */}
      <div ref={mountRef} className="fixed inset-0 w-full h-full z-0 cursor-crosshair" />

      {/* Stealth Posture & Cloak Vignette */}
      {(stealthCloakActive || isCrouching) && (
        <div
          className={`absolute inset-0 pointer-events-none border-2 transition-all duration-300 ${
            stealthCloakActive
              ? 'border-cyan-400/40 shadow-[inset_0_0_45px_rgba(34,211,238,0.18)]'
              : 'border-emerald-500/30 shadow-[inset_0_0_35px_rgba(16,185,129,0.14)]'
          }`}
        />
      )}

      {/* AUTHENTIC TACTICAL HOLOGRAPHIC SIGHT (PRE-MOUNTED IN DOM FOR INSTANT FIRST-TIME RENDERING) */}
      <div
        className={`fixed inset-0 pointer-events-none z-30 select-none overflow-hidden font-mono transition-opacity duration-100 ${
          isScoped ? 'opacity-100 visible animate-ads-snap' : 'opacity-0 invisible'
        }`}
      >
          {/* Tactical Peripheral Tunnel Vignette */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle 38vh at 50% 50%, transparent 40%, rgba(0,0,0,0.4) 68%, rgba(0,0,0,0.85) 100%)',
            }}
          />

          {/* Centered Optic Sight Frame: Responsive width on portrait mobile so curved Health/Ammo HUD never clips off-screen */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="relative w-[74vw] max-w-[420px] sm:w-auto sm:max-w-none sm:h-[74vh] max-h-[660px] aspect-[920/965] flex items-center justify-center"
              style={{ transform: 'translateY(2.5%)' }}
            >
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
                className="absolute rounded-full pointer-events-none z-20"
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
                  {/* Left Curved Health Track */}
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
                    stroke={hp < 35 ? '#f43f5e' : hp < 65 ? '#f59e0b' : '#10b981'}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray="145"
                    strokeDashoffset={145 - (145 * Math.max(0, Math.min(100, (hp / maxHp) * 100))) / 100}
                    style={{
                      filter:
                        hp < 35
                          ? 'drop-shadow(0 0 8px rgba(244,63,94,0.9))'
                          : 'drop-shadow(0 0 6px rgba(16,185,129,0.75))',
                      transition: 'stroke-dashoffset 150ms ease-out',
                    }}
                  />

                  {/* Right Curved Cloak / Ammo Track */}
                  <path
                    d="M 165 165 A 92 92 0 0 0 165 35"
                    fill="none"
                    stroke="rgba(24, 24, 27, 0.85)"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  {/* Right Curved Ammo Fill Arc */}
                  <path
                    d="M 165 165 A 92 92 0 0 0 165 35"
                    fill="none"
                    stroke={isReloading ? '#f59e0b' : ammo === 0 ? '#f43f5e' : '#22d3ee'}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray="145"
                    strokeDashoffset={145 - 145 * Math.max(0, Math.min(1, ammo / Math.max(1, maxAmmo)))}
                    style={{
                      filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.75))',
                      transition: 'stroke-dashoffset 120ms ease-out',
                    }}
                  />
                </svg>

                {/* LEFT ROUNDED SCOPE TELEMETRY: HEALTH & CLOAK (Phone-safe positioning) */}
                <div className="absolute top-1/2 -left-1 sm:-left-6 -translate-x-[68%] sm:-translate-x-full -translate-y-1/2 flex flex-col items-end gap-1 sm:gap-1.5 pointer-events-none font-mono z-30">
                  <div className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-zinc-950/95 border-r-2 border-emerald-400 border-y border-l border-emerald-500/30 rounded-l-xl shadow-[0_0_14px_rgba(0,0,0,0.9)] flex flex-col items-end">
                    <span className="text-[7px] sm:text-[8px] tracking-widest text-zinc-400 uppercase">VITALITY</span>
                    <div className="flex items-center gap-0.5 sm:gap-1">
                      <Shield className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${hp < 35 ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`} />
                      <span className={`text-[11px] sm:text-sm font-black tabular-nums ${hp < 35 ? 'text-rose-400 animate-pulse' : 'text-emerald-300'}`}>
                        {hp}%
                      </span>
                    </div>
                  </div>
                  <div className={`px-1.5 sm:px-2 py-0.5 bg-zinc-950/95 border-r-2 rounded-l-lg text-[8px] sm:text-[9px] font-bold tracking-wider uppercase shadow-md ${
                    stealthCloakActive ? 'border-cyan-400 text-cyan-300' : isBehindCover ? 'border-emerald-400 text-emerald-300' : 'border-amber-500/70 text-amber-400'
                  }`}>
                    {stealthCloakActive ? `CLOAK ${stealthEnergy}%` : isBehindCover ? 'IN COVER' : isCrouching ? 'LOW PROFILE' : 'EXPOSED'}
                  </div>
                </div>

                {/* RIGHT ROUNDED SCOPE TELEMETRY: SPY ABILITIES & AMMO ARC (Phone-safe positioning) */}
                <div className={`absolute top-1/2 -right-1 sm:-right-6 translate-x-[68%] sm:translate-x-full -translate-y-1/2 flex flex-col items-start gap-1 font-mono z-30 ${isScoped ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                  <div className="-ml-1 sm:-ml-2 px-1.5 sm:px-2 py-0.5 bg-zinc-950/95 border-l-2 border-cyan-400 border-y border-r border-cyan-500/30 rounded-r-lg shadow-md flex items-center gap-1 sm:gap-1.5">
                    <span className="text-[7px] sm:text-[8px] text-cyan-400 uppercase tracking-wider">AMMO</span>
                    <span className={`text-[11px] sm:text-xs font-black tabular-nums ${ammo === 0 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
                      {isReloading ? 'RLD' : `${ammo}/${maxAmmo}`}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.triggerHaptic(12, 0.4);
                      toggleCloak();
                    }}
                    className={`px-1.5 sm:px-2 py-0.5 rounded-r-lg border-l-2 text-[8px] sm:text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md cursor-pointer transition-all ${
                      stealthCloakActive
                        ? 'bg-cyan-950/95 border-cyan-400 text-cyan-300'
                        : 'bg-zinc-950/95 border-cyan-500/50 text-slate-200 hover:bg-cyan-950/60'
                    }`}
                  >
                    <EyeOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-cyan-400 shrink-0" />
                    <span>CLK {stealthEnergy}%</span>
                  </button>

                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.triggerHaptic(12, 0.4);
                      handleHeal();
                    }}
                    className="px-1.5 sm:px-2 py-0.5 rounded-r-lg border-l-2 border-emerald-400 bg-emerald-950/95 hover:bg-emerald-900 text-emerald-300 text-[8px] sm:text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md cursor-pointer transition-all"
                  >
                    <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400 shrink-0" />
                    <span>STIM</span>
                  </button>

                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.triggerHaptic(10, 0.3);
                      toggleCrouch();
                    }}
                    className={`-ml-1 sm:-ml-2 px-1.5 sm:px-2 py-0.5 rounded-r-lg border-l-2 text-[8px] sm:text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md cursor-pointer transition-all ${
                      isCrouching
                        ? 'bg-emerald-950/95 border-emerald-400 text-emerald-300'
                        : 'bg-zinc-950/95 border-amber-400/60 text-amber-300'
                    }`}
                  >
                    <ArrowDownToLine className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400 shrink-0" />
                    <span>{isCrouching ? 'LOW' : 'CROUCH'}</span>
                  </button>
                </div>

                {/* Luminous Holographic Laser Reticle System */}
                <div className="absolute inset-0 flex items-center justify-center">
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

              {/* Covert Silenced Telemetry */}
              <div className="absolute bottom-[14%] left-1/2 -translate-x-1/2 px-3 py-0.5 bg-zinc-950/90 border border-amber-500/40 text-[9px] tracking-widest text-amber-400 uppercase whitespace-nowrap shadow-md">
                COVERT OPTIC // {activeSpyWeapon.name}
              </div>
            </div>
          </div>
      </div>

      {/* Sleek Covert Suppressed Hipfire Crosshair */}
      {!isScoped && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative transition-all duration-150 flex items-center justify-center rounded-full border w-7 h-7 border-amber-400/55">
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-[1.5px] h-2 bg-amber-400/80" />
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-[1.5px] h-2 bg-amber-400/80" />
            <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 h-[1.5px] w-2 bg-amber-400/80" />
            <span className="absolute -right-1.5 top-1/2 -translate-y-1/2 h-[1.5px] w-2 bg-amber-400/80" />
            <div className="w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,1)]" />
          </div>
        </div>
      )}

      {/* REACTIVE SPEECH BUBBLES: GROUPS OF BACTERIA TALKING TO EACH OTHER */}
      {squadDialogues.map((sq) => (
        <div
          key={sq.id}
          className="absolute transform -translate-x-1/2 -translate-y-full pointer-events-none z-20 transition-all duration-150"
          style={{ left: `${sq.x}%`, top: `${sq.y}%` }}
        >
          <div className="relative bg-zinc-950/90 border border-amber-400/70 text-amber-200 text-[10px] sm:text-xs font-mono font-medium px-2.5 py-1.5 rounded shadow-[0_0_12px_rgba(0,0,0,0.85)] max-w-[210px] sm:max-w-[260px] text-center leading-snug">
            <span className="text-[8px] text-amber-400 font-bold uppercase tracking-wider block mb-0.5">
              💬 BACTERIAL CHATTER
            </span>
            &ldquo;{sq.text}&rdquo;
            {/* Speech bubble arrow point */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-zinc-950 border-r border-b border-amber-400/70 transform rotate-45" />
          </div>
        </div>
      ))}

      {/* FORTNITE-STYLE FLOATING DAMAGE NUMBERS + HEADSHOT BANNER (Secret Spy Mode) */}
      {spyDamageNumbers.map((marker) => (
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

      {/* Active Floating Virtual Touch Joystick (Black Ops Tactical Ring) */}
      {joystickDisplay ? (
        <div
          className="fixed z-20 pointer-events-none w-24 h-24 -ml-12 -mt-12 rounded-full border border-amber-500/55 bg-black/55 flex items-center justify-center shadow-[0_0_18px_rgba(245,158,11,0.25)]"
          style={{ left: joystickDisplay.x, top: joystickDisplay.y }}
        >
          <div className="w-16 h-16 rounded-full border border-dashed border-amber-400/30 flex items-center justify-center">
            <div
              ref={joystickKnobDomRef}
              className="w-9 h-9 rounded-full bg-amber-500/85 border border-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.9)]"
              style={{
                transform: `translate3d(${joystickOffsetRef.current.x}px, ${joystickOffsetRef.current.y}px, 0)`,
              }}
            />
          </div>
        </div>
      ) : (
        /* Subtle Translucent Spec-Ops Joystick Hint Ring in Bottom-Left Zone */
        <div className="absolute bottom-12 left-3 z-10 pointer-events-none w-14 h-14 rounded-full border border-amber-500/30 bg-black/50 flex flex-col items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-amber-500/40 border border-amber-400/60" />
          <span className="text-[7px] font-mono font-bold uppercase tracking-widest text-amber-400/80 mt-0.5">
            SNEAK
          </span>
        </div>
      )}

      {/* =====================================================================
          FORTNITE-STYLE COVERT SPY HUD OVERLAY (NETLIFY-SAFE HARDWARE COMPOSITED)
          Matches the Fortnite HUD layout without building materials on Phone & PC.
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
        {/* TOP ROW: TOP-LEFT NAV/UTILITY | TOP-CENTER ALERTS | TOP-RIGHT MINIMAP */}
        <div className="flex items-start justify-between w-full gap-1.5 sm:gap-2">
          {/* Top-Left: Back, Pause [ESC], Audio & Auto-Aim */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 pointer-events-auto">
            <button
              onClick={() => {
                sounds.unlockAudio();
                sounds.triggerHaptic(16, 0.45);
                if (onExitToMenu) {
                  onExitToMenu();
                } else {
                  setIsGamePaused(true);
                }
              }}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-md bg-slate-950/90 hover:bg-rose-950/90 border-2 border-rose-500/80 text-white font-black text-[10px] sm:text-xs tracking-wider uppercase flex items-center gap-1 sm:gap-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.85)] cursor-pointer whitespace-nowrap"
              title="Back to Main Menu"
            >
              <Home className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>BACK</span>
            </button>

            <button
              onClick={() => {
                sounds.unlockAudio();
                sounds.triggerHaptic(14, 0.4);
                setIsGamePaused(true);
              }}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-md bg-slate-950/90 hover:bg-slate-900 border-2 border-amber-400/85 text-amber-300 font-black text-[10px] sm:text-xs tracking-wider uppercase flex items-center gap-1 sm:gap-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.85)] cursor-pointer whitespace-nowrap"
              title="Pause Infiltration [ESC]"
            >
              <Pause className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
              <span>PAUSE</span>
            </button>

            <button
              onClick={() => {
                sounds.unlockAudio();
                sounds.triggerHaptic(8, 0.25);
                onToggleSound();
              }}
              className="h-8 sm:h-9 w-8 sm:w-9 rounded-md bg-slate-950/85 hover:bg-slate-900 border border-white/25 text-white flex items-center justify-center shadow-md cursor-pointer"
              title="Toggle Audio"
            >
              {!soundEnabled ? (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400" />
              )}
            </button>

            <button
              onClick={() => {
                sounds.unlockAudio();
                sounds.triggerHaptic(10, 0.3);
                onToggleAutoAim();
              }}
              className={`h-8 sm:h-9 px-2 sm:px-2.5 rounded-md font-black text-[9px] sm:text-[11px] tracking-wider uppercase border flex items-center gap-1 shadow-md cursor-pointer ${
                autoAimEnabled
                  ? 'bg-sky-600/85 border-sky-300 text-white'
                  : 'bg-slate-950/85 border-white/20 text-slate-400'
              }`}
              title="Toggle Soft Target Assist"
            >
              <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>{autoAimEnabled ? 'ASSIST: ON' : 'ASSIST: OFF'}</span>
            </button>
          </div>

          {/* Top-Center: Alert Banner & Context Breach/Sabotage Prompt */}
          <div className="flex flex-col items-center gap-1 max-w-[46vw] sm:max-w-md">
            {alertMessage && (
              <div className="bg-slate-950/90 border border-amber-400 rounded-md px-3 py-0.5 text-[9px] sm:text-xs font-black text-amber-300 tracking-wider uppercase truncate max-w-full shadow-lg">
                {alertMessage}
              </div>
            )}

            {(nearbyDoorName || nearbySabotageTarget) && (
              <button
                onClick={() => {
                  sounds.unlockAudio();
                  handleInteractOrSabotage();
                }}
                className="pointer-events-auto bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 border-2 border-white text-slate-950 font-black px-3.5 py-1 rounded-md shadow-[0_0_18px_rgba(250,204,21,0.75)] flex items-center gap-1.5 text-[10px] sm:text-xs uppercase tracking-wider cursor-pointer whitespace-nowrap"
              >
                {nearbyDoorName ? (
                  <>
                    <DoorOpen className="w-3.5 h-3.5 text-slate-950" />
                    <span>BREACH {nearbyDoorName} [E]</span>
                  </>
                ) : (
                  <>
                    <Bomb className="w-3.5 h-3.5 text-slate-950" />
                    <span>PLANT C4: {nearbySabotageTarget} [E]</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Top-Right: Fortnite Square Minimap + Spy Objectives Row Below */}
          <div className="flex flex-col items-end gap-1 pointer-events-auto shrink-0">
            <div
              className="w-20 h-20 sm:w-28 sm:h-28 rounded-md border-2 border-slate-900/95 shadow-[0_6px_20px_rgba(0,0,0,0.85)] overflow-hidden relative"
              style={{
                background: 'radial-gradient(circle at 50% 45%, rgba(244,63,94,0.3) 0%, #0f172a 68%, #020617 100%)',
              }}
            >
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)',
                  backgroundSize: '25% 25%',
                }}
              />
              <div className="absolute inset-2 rounded-full border border-white/15 pointer-events-none" />
              <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 text-center pointer-events-none">
                <span
                  className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-white block truncate"
                  style={{
                    textShadow:
                      '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.95)',
                  }}
                >
                  TRACHEA LUMEN
                </span>
              </div>
              <div className="absolute bottom-[14%] left-1/2 -translate-x-1/2 pointer-events-none">
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
            </div>

            {/* Spy Objectives Telemetry Strip Below Minimap */}
            <div className="flex items-center justify-end gap-1.5 bg-slate-950/85 border border-white/15 rounded-md px-2 py-0.5 shadow-lg text-[10px] sm:text-xs font-black tabular-nums">
              <span className="flex items-center gap-0.5 text-amber-300" title="Generals Eliminated">
                <Skull className="w-3 h-3 text-amber-400" />
                {generalsEliminated}/{totalGenerals}
              </span>
              <span className="flex items-center gap-0.5 text-sky-300" title="Bio-Tanks Sabotaged">
                <Bomb className="w-3 h-3 text-sky-400" />
                {tanksSabotaged}/{totalTanks}
              </span>
              <span className="flex items-center gap-0.5 text-rose-300" title="Spore Artillery Sabotaged">
                <Target className="w-3 h-3 text-rose-400" />
                {artillerySabotaged}/{totalArtillery}
              </span>
              <span className="flex items-center gap-0.5 text-emerald-300" title="Bases Sabotaged">
                <Shield className="w-3 h-3 text-emerald-400" />
                {basesSabotaged}/{totalBases}
              </span>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: SLANTED CLOAK/HEALTH BARS + FORTNITE HOTBAR + 10-SEGMENT XP BAR */}
        <div className="flex flex-col w-full gap-1 sm:gap-1.5">
          <div className="flex items-end justify-between w-full gap-2">
            {/* Bottom-Left: Fortnite Slanted Blue Cloak Energy Bar + Green Health Bar */}
            <div className="flex flex-col gap-1 pointer-events-auto pl-1 sm:pl-2">
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded text-[8px] sm:text-[10px] font-black uppercase tracking-wider border shadow-md ${
                    stealthCloakActive
                      ? 'bg-sky-950/90 border-sky-400 text-sky-200'
                      : isBehindCover
                      ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
                      : 'bg-slate-950/85 border-amber-400/60 text-amber-300'
                  }`}
                >
                  {stealthCloakActive
                    ? '👻 OPTIC CLOAK ACTIVE'
                    : coverObjectName
                    ? `🛡️ IN COVER (${coverObjectName})`
                    : isCrouching
                    ? '🥷 STEALTH CROUCH'
                    : '⚠️ EXPOSED'}
                </span>
              </div>

              {/* Top Slanted Bar: Blue Cloak Shield Energy */}
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shrink-0">
                  <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 fill-sky-400/30" />
                </div>
                <div
                  className="relative w-28 sm:w-48 md:w-56 h-3 sm:h-4 bg-slate-950/85 border-2 border-white/85 shadow-md overflow-hidden"
                  style={{ transform: 'skewX(-16deg)' }}
                >
                  <div
                    className="h-full transition-all duration-150"
                    style={{
                      width: `${Math.max(0, Math.min(100, stealthEnergy))}%`,
                      background: 'linear-gradient(90deg, #0284c7 0%, #00b4d8 55%, #38bdf8 100%)',
                    }}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-end pr-2 text-[8px] sm:text-[10px] font-black text-white tabular-nums"
                    style={{ transform: 'skewX(16deg)', textShadow: '0 1px 3px rgba(0,0,0,0.95)' }}
                  >
                    {stealthEnergy} | 100
                  </div>
                </div>
              </div>

              {/* Bottom Slanted Bar: Vibrant Green Health Bar */}
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shrink-0">
                  <Heart
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                      hp < 35 ? 'text-rose-500 fill-rose-500 animate-pulse' : 'text-lime-400 fill-lime-400'
                    }`}
                  />
                </div>
                <div
                  className="relative w-32 sm:w-52 md:w-64 h-4 sm:h-5 bg-slate-950/90 border-2 border-white/95 shadow-lg overflow-hidden"
                  style={{ transform: 'skewX(-16deg)' }}
                >
                  <div
                    className="h-full transition-all duration-150"
                    style={{
                      width: `${Math.max(0, Math.min(100, hp))}%`,
                      background:
                        hp < 35
                          ? 'linear-gradient(90deg, #dc2626 0%, #ef4444 60%, #f87171 100%)'
                          : 'linear-gradient(90deg, #16a34a 0%, #22c55e 55%, #84cc16 100%)',
                    }}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-between px-2 text-[9px] sm:text-xs font-black text-white tabular-nums"
                    style={{ transform: 'skewX(16deg)', textShadow: '0 1px 3px rgba(0,0,0,0.95)' }}
                  >
                    <span>HP</span>
                    <span>{hp} | {maxHp}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom-Right: Fortnite Spy Weapons + Covert Equipment Hotbar */}
            <div className="flex flex-col items-end gap-1 pointer-events-auto">
              {/* Action Utility Row Above Hotbar (Includes Dedicated Mobile/Touch FIRE Button!) */}
              <div className="flex items-center gap-1">
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    sounds.unlockAudio();
                    sounds.triggerHaptic(14, 0.45);
                    triggerShootRef.current = true;
                    startHoldShootScopeTimer();
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    cancelHoldShootScope();
                  }}
                  onPointerCancel={() => cancelHoldShootScope()}
                  className="h-8 sm:h-9 px-3 sm:px-3.5 rounded-md bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 border-2 border-white text-white font-black text-[10px] sm:text-xs uppercase tracking-wider flex items-center gap-1 shadow-[0_0_16px_rgba(244,63,94,0.75)] active:scale-95 cursor-pointer"
                >
                  <Crosshair className="w-3.5 h-3.5 text-yellow-200" />
                  <span>FIRE</span>
                </button>

                <button
                  onClick={() => {
                    if (holdShootTimerRef.current) {
                      clearTimeout(holdShootTimerRef.current);
                      holdShootTimerRef.current = null;
                    }
                    autoScopedByHoldRef.current = false;
                    sounds.unlockAudio();
                    sounds.triggerHaptic(10, 0.35);
                    setIsScoped((prev) => {
                      const next = !prev;
                      stateRef.current.isScoped = next;
                      return next;
                    });
                  }}
                  className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-md text-[9px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1 border shadow-md cursor-pointer ${
                    isScoped
                      ? 'bg-amber-400 text-slate-950 border-white'
                      : 'bg-slate-950/85 hover:bg-slate-900 border-white/30 text-white'
                  }`}
                >
                  <Crosshair className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>SCOPE [F]</span>
                </button>

                <button
                  onClick={() => {
                    sounds.unlockAudio();
                    sounds.triggerHaptic(10, 0.3);
                    handleReload();
                  }}
                  className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-md bg-slate-950/85 hover:bg-slate-900 border border-white/30 text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-white flex items-center gap-1 shadow-md cursor-pointer"
                >
                  <RotateCcw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 ${isReloading ? 'animate-spin' : ''}`} />
                  <span>RLD [R]</span>
                </button>

                <button
                  onClick={() => {
                    sounds.unlockAudio();
                    sounds.triggerHaptic(10, 0.3);
                    toggleCrouch();
                  }}
                  className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-md text-[9px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1 border shadow-md cursor-pointer ${
                    isCrouching
                      ? 'bg-emerald-500 text-slate-950 border-white'
                      : 'bg-slate-950/85 hover:bg-slate-900 border-white/30 text-white'
                  }`}
                >
                  <ArrowDownToLine className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>{isCrouching ? 'LOW [C]' : 'CROUCH [C]'}</span>
                </button>

                <button
                  onClick={() => {
                    sounds.unlockAudio();
                    sounds.triggerHaptic(12, 0.4);
                    handleSwapSpyWeapon();
                  }}
                  className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 border border-white text-[9px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md cursor-pointer"
                >
                  <Repeat className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>SWAP [Q]</span>
                </button>
              </div>

              {/* Fortnite Square Hotbar Tiles: 3 Spy Weapons + Gap + Cloak / C4 / Medkit */}
              <div className="flex items-end gap-1 sm:gap-1.5">
                {SPY_WEAPONS.map((wpn, idx) => {
                  const isActive = idx === activeSpyWeaponIdx;
                  const rarityBg =
                    idx === 0
                      ? 'from-sky-500/90 via-blue-700/90 to-slate-950/95 border-sky-300'
                      : idx === 1
                      ? 'from-purple-500/90 via-purple-800/90 to-slate-950/95 border-purple-300'
                      : 'from-amber-400/90 via-orange-700/90 to-slate-950/95 border-yellow-200';
                  return (
                    <div key={wpn.id} className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => {
                          sounds.unlockAudio();
                          sounds.triggerHaptic(10, 0.3);
                          handleSwapSpyWeapon(idx);
                        }}
                        className={`w-11 h-11 sm:w-14 sm:h-14 rounded-md bg-gradient-to-b ${rarityBg} relative flex flex-col justify-between p-1 cursor-pointer transition-all ${
                          isActive
                            ? '-translate-y-1.5 border-2 border-white ring-2 ring-white/80 shadow-[0_6px_18px_rgba(56,189,248,0.65)]'
                            : 'border border-white/40 opacity-90 hover:opacity-100'
                        }`}
                      >
                        <span
                          className="text-[7px] sm:text-[8px] font-black uppercase text-white truncate max-w-full leading-none"
                          style={{ textShadow: '0 1px 2px #000' }}
                        >
                          {wpn.name.split(' ')[0]}
                        </span>
                        <div className="flex items-center justify-center my-auto w-full">
                          <WeaponBlockyIcon
                            weaponId={wpn.id}
                            className="w-9 h-4.5 sm:w-11 sm:h-5.5"
                          />
                        </div>
                        <span
                          className="text-[9px] sm:text-xs font-black text-white text-right w-full leading-none tabular-nums"
                          style={{ textShadow: '0 1px 3px #000' }}
                        >
                          {isActive ? (isReloading ? 'RLD' : ammo) : wpn.magSize}
                        </span>
                      </button>
                      <span className="px-1.5 py-0.2 rounded bg-slate-950/90 border border-white/25 text-[8px] sm:text-[9px] font-black text-white leading-tight">
                        {idx + 1}
                      </span>
                    </div>
                  );
                })}

                <div className="w-1 sm:w-2 shrink-0" />

                {/* Cloak Tile [V] */}
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.triggerHaptic(12, 0.4);
                      toggleCloak();
                    }}
                    className={`w-11 h-11 sm:w-14 sm:h-14 rounded-md bg-gradient-to-b from-cyan-400/95 via-sky-800/95 to-slate-950/95 relative flex flex-col justify-between p-1 cursor-pointer transition-all ${
                      stealthCloakActive
                        ? '-translate-y-1.5 border-2 border-white ring-2 ring-cyan-300'
                        : 'border border-cyan-300/60'
                    }`}
                  >
                    <span className="text-[7px] sm:text-[8px] font-black uppercase text-white leading-none">
                      CLOAK
                    </span>
                    <div className="flex items-center justify-center my-auto">
                      <EyeOff className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <span className="text-[9px] sm:text-[11px] font-black text-white text-right w-full leading-none tabular-nums">
                      {stealthEnergy}%
                    </span>
                  </button>
                  <span className="px-1.5 py-0.2 rounded bg-slate-950/90 border border-white/25 text-[8px] sm:text-[9px] font-black text-cyan-300 leading-tight">
                    V
                  </span>
                </div>

                {/* C4 / Breach Tile [E] */}
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.triggerHaptic(14, 0.45);
                      handleInteractOrSabotage();
                    }}
                    disabled={!nearbyDoorName && !nearbySabotageTarget}
                    className={`w-11 h-11 sm:w-14 sm:h-14 rounded-md bg-gradient-to-b from-orange-500/95 via-rose-800/95 to-slate-950/95 relative flex flex-col justify-between p-1 cursor-pointer transition-all ${
                      nearbyDoorName || nearbySabotageTarget
                        ? '-translate-y-1 border-2 border-amber-300 animate-pulse'
                        : 'border border-white/30 opacity-75'
                    }`}
                  >
                    <span className="text-[7px] sm:text-[8px] font-black uppercase text-white leading-none">
                      {nearbyDoorName ? 'DOOR' : 'C4'}
                    </span>
                    <div className="flex items-center justify-center my-auto">
                      {nearbyDoorName ? (
                        <DoorOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      ) : (
                        <Bomb className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      )}
                    </div>
                    <span className="text-[9px] sm:text-[11px] font-black text-white text-right w-full leading-none">
                      ACT
                    </span>
                  </button>
                  <span className="px-1.5 py-0.2 rounded bg-slate-950/90 border border-white/25 text-[8px] sm:text-[9px] font-black text-amber-300 leading-tight">
                    E
                  </span>
                </div>

                {/* Stim Medkit Tile [SPC] */}
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.triggerHaptic(12, 0.4);
                      handleHeal();
                    }}
                    className="w-11 h-11 sm:w-14 sm:h-14 rounded-md bg-gradient-to-b from-lime-500/95 via-emerald-700/95 to-slate-950/95 border-2 border-lime-300 relative flex flex-col justify-between p-1 cursor-pointer transition-all hover:-translate-y-1"
                  >
                    <span className="text-[7px] sm:text-[8px] font-black uppercase text-white leading-none">
                      STIM
                    </span>
                    <div className="flex items-center justify-center my-auto">
                      <div className="w-5 h-4 sm:w-6 sm:h-5 rounded-sm bg-white flex items-center justify-center shadow-md border border-rose-500">
                        <span className="text-rose-600 font-black text-xs sm:text-sm leading-none">+</span>
                      </div>
                    </div>
                    <span className="text-[9px] sm:text-[11px] font-black text-white text-right w-full leading-none">
                      +35
                    </span>
                  </button>
                  <span className="px-1.5 py-0.2 rounded bg-slate-950/90 border border-white/25 text-[8px] sm:text-[9px] font-black text-lime-300 leading-tight">
                    SPC
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom-Edge Full-Width 10-Segment Fortnite Gold XP Bar */}
          <div className="grid grid-cols-10 gap-1 w-full h-1.5 sm:h-2 pt-0.5 pointer-events-none">
            {Array.from({ length: 10 }).map((_, segIdx) => {
              const totalDone = generalsEliminated + tanksSabotaged + artillerySabotaged + basesSabotaged;
              const totalReq = Math.max(1, totalGenerals + totalTanks + totalArtillery + totalBases);
              const filledCount = Math.max(2, Math.round((totalDone / totalReq) * 10));
              const isFilled = segIdx < filledCount;
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
                  SPY-OPS TACTICAL COMMAND // PAUSED
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
                <span className="text-sm font-black text-amber-400">TRACHEA</span>
              </div>
              <div>
                <span className="text-[9px] text-zinc-400 block uppercase">ELAPSED TIME</span>
                <span className="text-sm font-black text-white">
                  {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-zinc-400 block uppercase">STEALTH ENERGY</span>
                <span className="text-sm font-black text-cyan-400">{stealthEnergy}%</span>
              </div>
              <div>
                <span className="text-[9px] text-zinc-400 block uppercase">HVT ELIMINATED</span>
                <span className="text-sm font-black text-emerald-400">{generalsEliminated}/{totalGenerals}</span>
              </div>
            </div>

            {/* Tactical Weapon Currently Equipped */}
            <div className="flex items-center justify-between px-3 py-2 bg-black/60 border border-amber-500/30 text-xs">
              <span className="text-zinc-400 uppercase">ACTIVE WEAPON:</span>
              <span className="font-black text-amber-400">{activeSpyWeapon.name}</span>
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

              {/* 3. Restart Mission */}
              <button
                onClick={() => {
                  sounds.unlockAudio();
                  sounds.triggerHaptic(15, 'medium');
                  setHp(100);
                  stateRef.current.hp = 100;
                  setStealthEnergy(100);
                  stateRef.current.stealthEnergy = 100;
                  setIsGamePaused(false);
                }}
                className="w-full h-10 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-amber-400/50 text-zinc-300 font-bold text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Repeat className="w-3.5 h-3.5 text-amber-400" />
                <span>RESTART SPEC-OPS MISSION</span>
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

      {/* =====================================================================
          COMPACT 1-2 SENTENCE EDUCATIONAL BIOLOGY INTEL BRIEF
          (Appears at most ONCE during the mission, pauses game cleanly)
         ===================================================================== */}
      {activeConceptCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 font-mono">
          <div
            className="bg-zinc-950 border-l-4 border-amber-500 border-y border-r border-white/20 max-w-md w-full p-5 shadow-[0_0_40px_rgba(0,0,0,0.95)] space-y-3"
            style={{ clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))' }}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                CLASSIFIED BIO-INTEL // {activeConceptCard.category}
              </span>
              <span className="text-[10px] text-cyan-400 uppercase tracking-widest">SIM PAUSED</span>
            </div>

            <h3 className="text-base font-extrabold text-white tracking-wide uppercase font-sans">
              {activeConceptCard.title}
            </h3>

            <p className="text-sm text-slate-200 leading-relaxed font-sans">
              {activeConceptCard.scientificFact}
            </p>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  sounds.triggerHaptic(12, 0.4);
                  dismissConceptCard();
                }}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold uppercase tracking-widest cursor-pointer transition-colors"
                style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
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
