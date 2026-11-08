import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { LevelConfig, Weapon, BiologyConceptCard, HitMarkerInfo } from '../types/game';
import { BIOLOGY_CONCEPT_CARDS } from '../data/curriculumData';
import { sounds } from '../services/soundEffects';
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

  const handleSwapSpyWeapon = (idx?: number) => {
    const nextIdx = typeof idx === 'number' ? idx : (activeSpyWeaponIdx + 1) % SPY_WEAPONS.length;
    const nextW = SPY_WEAPONS[nextIdx];
    setActiveSpyWeaponIdx(nextIdx);
    setMaxAmmo(nextW.magSize);
    setAmmo(nextW.magSize);
    sounds.playRadioChirp();
    sounds.triggerHaptic([16, 22], 0.6);
  };
  const handleSwapSpyWeaponRef = useRef<((idx?: number) => void) | null>(null);
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
    camera.position.set(0, 0, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: window.innerWidth >= 900, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 900 ? 1.25 : 1.5));
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

    // Pathogen Command Bases
    const basePositions = [
      { id: 'base-1', name: 'Pathogen Command Relay Alpha', x: -7.5, z: -54 },
      { id: 'base-2', name: 'Central Bio-Reactor Core Omega', x: 0, z: -146 }
    ];
    basePositions.forEach(bp => {
      const bm = createEnemyBioBaseModel();
      bm.group.position.set(bp.x, -2.5, bp.z);
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
        radarDish: bm.radarDish
      });
    });

    // Armored Bio-Tanks
    const tankPositions = [
      { id: 'tank-1', name: 'Armored Bio-Tank MK-I', x: 5.5, z: -16 },
      { id: 'tank-2', name: 'Siege Bio-Tank MK-II', x: 5.5, z: -84 },
      { id: 'tank-3', name: 'Citadel Guard Tank MK-III', x: -6.5, z: -130 }
    ];
    tankPositions.forEach(tp => {
      const tm = createBacteriaTank();
      tm.group.position.set(tp.x, -2.1, tp.z);
      tm.group.scale.setScalar(1.35);
      tm.group.rotation.y = Math.PI;
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
        turret: tm.turret
      });
    });

    // Pathogen Spore Artillery Batteries (Mortar Cannon Installations)
    const artilleryPositions = [
      { id: 'artillery-1', name: 'Pathogen Spore Artillery Alpha', x: -6.5, z: -38 },
      { id: 'artillery-2', name: 'Pathogen Spore Artillery Beta', x: 6.0, z: -102 }
    ];
    artilleryPositions.forEach(ap => {
      const art = createBacterialArtilleryModel();
      art.group.position.set(ap.x, -2.5, ap.z);
      art.group.rotation.y = Math.PI;
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
        barrel: art.barrel
      });
    });

    // Bacterial Generals (Crimson Berets, Gold Epaulets, Officers)
    const generalPositions = [
      { id: 'gen-1', name: 'General Necrosis (Sector 1 Commander)', x: -2.5, z: -14 },
      { id: 'gen-2', name: 'General Toxoid (Artillery Overseer)', x: 2.5, z: -58 },
      { id: 'gen-3', name: 'Supreme General Virulence', x: 0, z: -135 }
    ];
    generalPositions.forEach(gp => {
      const gm = createPathogenGeneralModel();
      gm.group.position.set(gp.x, -2.5, gp.z);
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
        headGroup: gm.headGroup
      });
    });

    // Groups of Bacteria Talking to Each Other (Standing in Circles Facing Inward!)
    const talkingSquadsData = [
      {
        id: 'squad-1',
        pos: [-3.5, -2.5, -22] as [number, number, number],
        lines: [
          'General Necrosis ordered extra sentries near the cartilage ring!',
          'Relax, no leukocyte could sneak past the cilia thicket...',
          'Keep your flagella down, the mucus current is fast today!'
        ],
        offsets: [[-0.8, 0, 0.6], [0.8, 0, 0.6], [0, 0, -0.8]]
      },
      {
        id: 'squad-2',
        pos: [4.5, -2.5, -74] as [number, number, number],
        lines: [
          'Did you check the spore artillery? All canisters primed!',
          'I heard an immune siren in the vocal cords...',
          'Watch the vesicular crates, stay in formation.'
        ],
        offsets: [[-0.7, 0, 0.5], [0.7, 0, -0.5]]
      },
      {
        id: 'squad-3',
        pos: [-2.5, -2.5, -116] as [number, number, number],
        lines: [
          'Supreme General Virulence said the bronchial barrage is ready!',
          'Keep watch behind the cartilage barrier, no slacking!'
        ],
        offsets: [[-0.6, 0, 0.5], [0.6, 0, -0.5]]
      }
    ];

    const talkingSquads: Array<{
      id: string;
      pos: THREE.Vector3;
      lines: string[];
      currentLineIndex: number;
      timer: number;
    }> = [];

    talkingSquadsData.forEach((sqData, sqIdx) => {
      const sqPos = new THREE.Vector3(...sqData.pos);
      sqData.offsets.forEach((off, mIdx) => {
        const soldier = mIdx % 2 === 0 ? createBacillusSoldier() : createStreptococcusSoldier();
        soldier.group.position.set(sqPos.x + off[0], sqPos.y, sqPos.z + off[2]);
        soldier.group.lookAt(sqPos.x, sqPos.y, sqPos.z);
        scene.add(soldier.group);
        targets.push({
          id: `talker-${sqIdx}-${mIdx}`,
          kind: 'GUARD',
          name: `Pathogen Sentry (${sqData.id})`,
          mesh: soldier.group,
          hp: 70,
          maxHp: 70,
          sabotaged: false,
          alerted: false,
          facingAngle: soldier.group.rotation.y,
          speed: 2.2,
          shootCooldown: 2.5
        });
      });
      talkingSquads.push({
        id: sqData.id,
        pos: sqPos,
        lines: sqData.lines,
        currentLineIndex: 0,
        timer: sqIdx * 1.5
      });
    });

    // Lone Patrolling Sentries
    const guardPositions = [
      { x: 3.5, z: -4 },
      { x: -5.5, z: -42 },
      { x: 5.0, z: -72 },
      { x: -3.5, z: -98 },
      { x: 4.5, z: -120 }
    ];
    guardPositions.forEach((gp, idx) => {
      const tr = createBacillusSoldier();
      tr.group.position.set(gp.x, -2.5, gp.z);
      tr.group.scale.setScalar(1.15);
      tr.group.rotation.y = Math.PI;
      scene.add(tr.group);
      targets.push({
        id: `guard-${idx}`,
        kind: 'GUARD',
        name: 'Trachea Sentry',
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
        rightArm: tr.rightArm
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

    const sharedParticleGeo = new THREE.SphereGeometry(0.16, 5, 5);
    const particlePool: THREE.Mesh[] = [];
    for (let i = 0; i < 36; i++) {
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

      const muzzleWorldPos = new THREE.Vector3();
      pistolModel.group.getWorldPosition(muzzleWorldPos);
      muzzleWorldPos.y += 0.08;
      bulletMesh.position.copy(muzzleWorldPos);

      let shootDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();

      // Smart Auto-Aim toward nearest General or Guard in front of player
      if (stateRef.current.autoAim) {
        let bestTarget: SpyTarget | null = null;
        let bestScore = Infinity;
        for (const t of targets) {
          if (t.hp <= 0 || t.sabotaged) continue;
          _v1.copy(t.mesh.position).add(new THREE.Vector3(0, 2.0, 0));
          const dist = _v1.distanceTo(camera.position);
          if (dist > 65) continue;
          _v2.copy(_v1).sub(camera.position).normalize();
          const angle = shootDir.angleTo(_v2);
          const maxCone = stateRef.current.isScoped ? 0.38 : 0.28;
          if (angle < maxCone) {
            const priorityWeight = t.kind === 'GENERAL' ? 0.5 : 1.0;
            const score = angle * dist * priorityWeight;
            if (score < bestScore) {
              bestScore = score;
              bestTarget = t;
            }
          }
        }
        if (bestTarget) {
          const aimPos = bestTarget.mesh.position.clone().add(
            new THREE.Vector3(0, bestTarget.kind === 'GENERAL' ? 2.3 : 1.7, 0)
          );
          shootDir = aimPos.sub(muzzleWorldPos).normalize();
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

    const handleTouchStart = (e: TouchEvent) => {
      if (isConceptModalOpenRef.current) return;
      if (e.cancelable) e.preventDefault(); // Block mobile OS long-press magnifying glass ("zooming lens")!
      sounds.unlockAudio();
      refreshCachedRect();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const clientX = touch.clientX;
        const clientY = touch.clientY;

        // Bottom-left zone (left 48%, bottom 65%) activates the Virtual Movement Joystick!
        if (
          movementTouchIdRef.current === null &&
          clientX - cachedRect.left < cachedRect.width * 0.48 &&
          clientY - cachedRect.top > cachedRect.height * 0.35
        ) {
          movementTouchIdRef.current = touch.identifier;
          joystickCenterRef.current = { x: clientX, y: clientY };
          joystickOffsetRef.current = { x: 0, y: 0 };
          sounds.triggerHaptic(8, 0.25);
          setJoystickDisplay({ x: clientX, y: clientY });
        } else if (firingTouchIdRef.current === null) {
          // Tap fires silenced shot immediately; holding for 3s deploys covert optic!
          firingTouchIdRef.current = touch.identifier;
          startHoldShootScopeTimer();
          updateAimFromClient(clientX, clientY);
          triggerShootRef.current = true;
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
          moveInputRef.current.x = clampedX / maxDist;
          moveInputRef.current.z = clampedY / maxDist;
          // Direct DOM transform update — zero React state re-render!
          if (joystickKnobDomRef.current) {
            joystickKnobDomRef.current.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
          }
        } else if (touch.identifier === firingTouchIdRef.current) {
          updateAimFromClient(touch.clientX, touch.clientY);
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

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    const domElem = renderer.domElement;
    domElem.addEventListener('mousemove', onMouseMove);
    domElem.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    domElem.addEventListener('contextmenu', onContextMenu);
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

      // Camera aim rotation based on mouse / touch aim (smooth full-range pitch up/down & yaw left/right)
      const targetRotY = -mouseRef.current.x * (stateRef.current.isScoped ? 0.65 : 0.45);
      const targetRotX = mouseRef.current.y * (stateRef.current.isScoped ? 0.52 : 0.35);
      camera.rotation.y += (targetRotY - camera.rotation.y) * 0.18;
      camera.rotation.x += (targetRotX - camera.rotation.x) * 0.18;

      // 3D Silenced Pistol Scope-In (ADS) & Recoil Recovery
      if (stateRef.current.isScoped) {
        // Hide 3D gun mesh while scoped so it never clips into the optic lens as a black box!
        pistolModel.group.visible = false;
      } else {
        pistolModel.group.visible = true;
        const targetPistolX = 0.35;
        const targetPistolY = -0.35;
        const targetPistolZ = -0.85;
        pistolModel.group.position.x += (targetPistolX - pistolModel.group.position.x) * 0.22;
        pistolModel.group.position.y += (targetPistolY - pistolModel.group.position.y) * 0.22;
        pistolModel.group.position.z += (targetPistolZ - pistolModel.group.position.z) * 0.2;
        pistolModel.slideMesh.position.z += (-0.05 - pistolModel.slideMesh.position.z) * 0.25;
      }

      if (triggerShootRef.current) {
        triggerShootRef.current = false;
        fireSilencedShot();
      }

      // Check nearby Tank, Base, or Artillery for Sabotage [E]
      let closestSabotage: SpyTarget | null = null;
      let closestDist = Infinity;
      for (const t of targets) {
        if ((t.kind === 'TANK' || t.kind === 'BASE' || t.kind === 'ARTILLERY') && !t.sabotaged && t.hp > 0) {
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

      // Execute [E] Interact: Open Bio-Security Door OR Plant Bio-Sabotage Charge!
      if (triggerInteractRef.current) {
        triggerInteractRef.current = false;

        if (closestClosedDoor) {
          closestClosedDoor.isOpen = true;
          (closestClosedDoor.statusLight.material as THREE.MeshBasicMaterial).color.setHex(0x10b981);
          sounds.triggerHaptic([14, 25, 22], 0.65);
          sounds.playActiveReloadLock();
          setAlertMessage(`UNLOCKED: ${closestClosedDoor.name} — Take the turn & stay crouched!`);
        } else if (closestSabotage) {
          closestSabotage.sabotaged = true;
          closestSabotage.hp = 0;
          sounds.playExplosion();
          _v1.copy(closestSabotage.mesh.position).add(new THREE.Vector3(0, 2, 0));
          spawnParticles(_v1, 0x10b981, 14);

          if (closestSabotage.kind === 'TANK') {
            closestSabotage.mesh.rotation.z = 0.35;
            closestSabotage.mesh.position.y = -2.6;
            stateRef.current.tanksSabotaged += 1;
            setTanksSabotaged(stateRef.current.tanksSabotaged);
            setAlertMessage(`SABOTAGED: ${closestSabotage.name} disabled silently!`);
          } else if (closestSabotage.kind === 'ARTILLERY') {
            closestSabotage.mesh.rotation.z = 0.55;
            closestSabotage.mesh.position.y = -2.7;
            stateRef.current.artillerySabotaged += 1;
            setArtillerySabotaged(stateRef.current.artillerySabotaged);
            setAlertMessage(`SABOTAGED: ${closestSabotage.name} disarmed silently!`);
          } else if (closestSabotage.kind === 'BASE') {
            if (closestSabotage.coreMesh) {
              (closestSabotage.coreMesh.material as THREE.MeshStandardMaterial).color.setHex(0x334155);
              (closestSabotage.coreMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
            }
            stateRef.current.basesSabotaged += 1;
            setBasesSabotaged(stateRef.current.basesSabotaged);
            setAlertMessage(`SABOTAGED: ${closestSabotage.name} core neutralized!`);
          }

          stateRef.current.kills += 1;
          stateRef.current.score += closestSabotage.maxHp * 3;
        }
      }

      // =====================================================================
      // Update Targets & Stealth Vision Logic
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
          if (t.leftArm && t.rightArm) {
            t.leftArm.rotation.x = Math.sin(now * 0.002) * 0.08;
            t.rightArm.rotation.x = -Math.sin(now * 0.002) * 0.08;
          }
          t.mesh.rotation.y += (t.facingAngle - t.mesh.rotation.y) * 0.1;

          const isPlayerExposed =
            !stateRef.current.isCrouching &&
            !stateRef.current.isBehindCover &&
            !stateRef.current.stealthCloakActive;

          if (isPlayerExposed && distToPlayer < 12) {
            t.alerted = true;
            t.facingAngle = 0;
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
            t.leftLeg.rotation.x = Math.sin(now * 0.008) * 0.5;
            t.rightLeg.rotation.x = -Math.sin(now * 0.008) * 0.5;
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
              const stealthMultiplier =
                !t.alerted || stateRef.current.isCrouching || stateRef.current.stealthCloakActive ? 3.0 : 1.25;
              const finalDmg = Math.round(b.damage * stealthMultiplier);
              t.hp -= finalDmg;
              stateRef.current.score += finalDmg * 2;
              sounds.playHitmarker(true);
              spawnParticles(b.mesh.position, 0x38bdf8, 6);

              // Project 3D hit position to screen & spawn Fortnite-style floating damage number!
              const proj = _v1.clone().project(camera);
              const screenX = Math.max(15, Math.min(85, (proj.x + 1) * 50));
              const screenY = Math.max(15, Math.min(82, (-proj.y + 1) * 50));
              const dmgId = performance.now() + Math.random();
              const isCritStealth = stealthMultiplier >= 3.0;
              setSpyDamageNumbers(prev => [
                ...prev.slice(-8),
                {
                  id: dmgId,
                  x: screenX,
                  y: screenY,
                  offsetX: Math.round((Math.random() - 0.5) * 30),
                  offsetY: Math.round((Math.random() - 0.5) * 16),
                  isCritical: isCritStealth,
                  isArmored: t.kind === 'TANK' || t.kind === 'BASE',
                  damage: finalDmg,
                },
              ]);
              window.setTimeout(() => {
                setSpyDamageNumbers(prev => prev.filter(m => m.id !== dmgId));
              }, 680);

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
                  t.mesh.rotation.z = 0.35;
                  stateRef.current.tanksSabotaged += 1;
                  setTanksSabotaged(stateRef.current.tanksSabotaged);
                  setAlertMessage(`NEUTRALIZED: ${t.name} destroyed!`);
                } else if (t.kind === 'ARTILLERY') {
                  t.sabotaged = true;
                  t.mesh.rotation.z = 0.55;
                  t.mesh.position.y = -2.7;
                  stateRef.current.artillerySabotaged += 1;
                  setArtillerySabotaged(stateRef.current.artillerySabotaged);
                  setAlertMessage(`NEUTRALIZED: ${t.name} destroyed!`);
                } else if (t.kind === 'BASE') {
                  t.sabotaged = true;
                  if (t.coreMesh) {
                    (t.coreMesh.material as THREE.MeshStandardMaterial).color.setHex(0x334155);
                    (t.coreMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
                  }
                  stateRef.current.basesSabotaged += 1;
                  setBasesSabotaged(stateRef.current.basesSabotaged);
                  setAlertMessage(`SABOTAGED: ${t.name} destroyed!`);
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

      // Update talking squads dialogue & 2D speech bubble projection
      const currentDialogues: Array<{ id: string; x: number; y: number; text: string }> = [];
      const camPos = camera.position;
      talkingSquads.forEach((sq) => {
        sq.timer += dt;
        if (sq.timer > 4.5) {
          sq.timer = 0;
          sq.currentLineIndex = (sq.currentLineIndex + 1) % sq.lines.length;
        }
        const dist = sq.pos.distanceTo(camPos);
        if (dist < 32 && sq.pos.z < camPos.z) {
          _v1.copy(sq.pos).add(new THREE.Vector3(0, 3.2, 0));
          _v1.project(camera);
          if (_v1.z < 1) {
            const screenX = (_v1.x * 0.5 + 0.5) * 100;
            const screenY = (-(_v1.y * 0.5) + 0.5) * 100;
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
      setSquadDialogues(currentDialogues);

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
      className="relative w-full h-screen bg-slate-950 overflow-hidden select-none font-sans"
    >
      {/* 3D WebGL Viewport */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-crosshair" />

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

      {/* AUTHENTIC TACTICAL HOLOGRAPHIC SIGHT (MATCHING USER REFERENCE IMG_5388) */}
      {isScoped ? (
        <div className="fixed inset-0 pointer-events-none z-30 select-none overflow-hidden animate-ads-snap font-mono">
          {/* Tactical Peripheral Tunnel Vignette */}
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

                {/* LEFT ROUNDED SCOPE TELEMETRY: HEALTH & CLOAK */}
                <div className="absolute top-1/2 -left-3 sm:-left-6 -translate-x-full -translate-y-1/2 flex flex-col items-end gap-1.5 pointer-events-none font-mono">
                  <div className="px-2 py-1 bg-zinc-950/90 border-r-2 border-emerald-400 border-y border-l border-emerald-500/30 rounded-l-xl shadow-[0_0_14px_rgba(0,0,0,0.85)] flex flex-col items-end">
                    <span className="text-[8px] tracking-widest text-zinc-400 uppercase">VITALITY</span>
                    <div className="flex items-center gap-1">
                      <Shield className={`w-3.5 h-3.5 ${hp < 35 ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`} />
                      <span className={`text-xs sm:text-sm font-black tabular-nums ${hp < 35 ? 'text-rose-400 animate-pulse' : 'text-emerald-300'}`}>
                        {hp}%
                      </span>
                    </div>
                  </div>
                  <div className={`px-2 py-0.5 bg-zinc-950/90 border-r-2 rounded-l-lg text-[9px] font-bold tracking-wider uppercase shadow-md ${
                    stealthCloakActive ? 'border-cyan-400 text-cyan-300' : isBehindCover ? 'border-emerald-400 text-emerald-300' : 'border-amber-500/70 text-amber-400'
                  }`}>
                    {stealthCloakActive ? `CLOAK ${stealthEnergy}%` : isBehindCover ? 'IN COVER' : isCrouching ? 'LOW PROFILE' : 'EXPOSED'}
                  </div>
                </div>

                {/* RIGHT ROUNDED SCOPE TELEMETRY: SPY ABILITIES & AMMO ARC */}
                <div className="absolute top-1/2 -right-3 sm:-right-6 translate-x-full -translate-y-1/2 flex flex-col items-start gap-1 pointer-events-auto font-mono">
                  <div className="-ml-2 px-2 py-0.5 bg-zinc-950/90 border-l-2 border-cyan-400 border-y border-r border-cyan-500/30 rounded-r-lg shadow-md flex items-center gap-1.5">
                    <span className="text-[8px] text-cyan-400 uppercase tracking-wider">AMMO</span>
                    <span className={`text-xs font-black tabular-nums ${ammo === 0 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
                      {isReloading ? 'RLD' : `${ammo}/${maxAmmo}`}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.triggerHaptic(12, 0.4);
                      toggleCloak();
                    }}
                    className={`px-2 py-0.5 rounded-r-lg border-l-2 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md cursor-pointer transition-all ${
                      stealthCloakActive
                        ? 'bg-cyan-950/90 border-cyan-400 text-cyan-300'
                        : 'bg-zinc-950/90 border-cyan-500/50 text-slate-200 hover:bg-cyan-950/60'
                    }`}
                  >
                    <EyeOff className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>CLK {stealthEnergy}% [V]</span>
                  </button>

                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.triggerHaptic(12, 0.4);
                      handleHeal();
                    }}
                    className="px-2 py-0.5 rounded-r-lg border-l-2 border-emerald-400 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md cursor-pointer transition-all"
                  >
                    <Shield className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>STIM [SPC]</span>
                  </button>

                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.triggerHaptic(10, 0.3);
                      toggleCrouch();
                    }}
                    className={`-ml-2 px-2 py-0.5 rounded-r-lg border-l-2 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md cursor-pointer transition-all ${
                      isCrouching
                        ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300'
                        : 'bg-zinc-950/90 border-amber-400/60 text-amber-300'
                    }`}
                  >
                    <ArrowDownToLine className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>{isCrouching ? 'LOW [C]' : 'CROUCH [C]'}</span>
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
      ) : (
        /* Sleek Covert Suppressed Hipfire Crosshair */
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
          className="absolute transform -translate-x-1/2 -translate-y-full pointer-events-none z-25 transition-all duration-150"
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

      {/* FORTNITE-STYLE FLOATING DAMAGE NUMBERS (Secret Spy Mode) */}
      {spyDamageNumbers.map((marker) => (
        <div
          key={marker.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
          style={{
            left: `calc(${marker.x}% + ${marker.offsetX || 0}px)`,
            top: `calc(${marker.y}% + ${marker.offsetY || 0}px)`,
          }}
        >
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
          CALL OF DUTY: BLACK OPS COVERT INFILTRATION HUD — TOP TELEMETRY BAR
          (Angled chamfered dark-carbon military frames, 92%+ unobstructed 3D view)
         ===================================================================== */}
      <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between gap-2 pointer-events-none z-40 font-mono">
        {/* Left: Direct Back Button + Pause [ESC] Button + Covert Operative Vitality + Optical Cloak Telemetry */}
        <div className="flex items-center gap-1 sm:gap-1.5 pointer-events-auto">
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
            className="h-9 px-2.5 sm:px-3 bg-zinc-950/95 hover:bg-rose-950/80 border-l-2 border-rose-500 border-t border-r border-b border-rose-500/50 text-rose-300 font-black text-[11px] sm:text-xs tracking-wider uppercase flex items-center gap-1 sm:gap-1.5 shadow-[0_0_15px_rgba(244,63,94,0.25)] cursor-pointer whitespace-nowrap"
            style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)' }}
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
            className="h-9 px-2.5 sm:px-3 bg-zinc-950/95 hover:bg-amber-950/70 border-l-2 border-amber-500 border-t border-r border-b border-amber-500/50 text-amber-300 font-black text-[11px] sm:text-xs tracking-wider uppercase flex items-center gap-1 sm:gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.25)] cursor-pointer whitespace-nowrap"
            style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)' }}
            title="Pause Infiltration [ESC]"
          >
            <Pause className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
            <span>PAUSE [ESC]</span>
          </button>

          <div
            className="bg-black/80 border-l-2 border-amber-500 border-y border-r border-white/10 px-2.5 py-1 flex items-center gap-2.5 text-[10px] sm:text-xs text-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.75)]"
            style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] tracking-widest text-amber-400 font-bold uppercase">VIT</span>
                <div className="flex gap-0.5">
                  {[0, 1, 2, 3, 4].map(seg => {
                    const active = (hp / maxHp) * 5 > seg;
                    const low = hp < 35;
                    return (
                      <span
                        key={seg}
                        className={`w-2 h-2.5 ${
                          active
                            ? low
                              ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]'
                              : 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.7)]'
                            : 'bg-white/10'
                        }`}
                      />
                    );
                  })}
                </div>
                <span className={`font-bold tabular-nums ${hp < 35 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                  {hp}%
                </span>
              </div>
            </div>

            <span className="text-white/15">|</span>

            {/* Cloak Energy Segmented Bar */}
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] tracking-widest text-cyan-400 font-bold uppercase">CLK</span>
              <div className="w-10 h-2 bg-white/10 overflow-hidden border border-cyan-500/30">
                <div
                  className="h-full bg-cyan-400 transition-all duration-150"
                  style={{ width: `${stealthEnergy}%` }}
                />
              </div>
              <span className="text-cyan-300 font-bold tabular-nums">{stealthEnergy}%</span>
            </div>

            <span className="text-white/15 hidden sm:inline">|</span>

            {/* Cover / Stealth Posture Status */}
            <span
              className={`px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase border ${
                stealthCloakActive
                  ? 'bg-cyan-950/80 border-cyan-400/60 text-cyan-300'
                  : isBehindCover
                  ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-300'
                  : 'bg-amber-950/80 border-amber-400/60 text-amber-300'
              }`}
            >
              {stealthCloakActive
                ? 'OPTIC CLOAK'
                : coverObjectName
                ? 'IN COVER'
                : isCrouching
                ? 'STEALTH CROUCH'
                : 'EXPOSED'}
            </span>
          </div>
        </div>

        {/* Right: Classified Black Ops HVT & Sabotage Telemetry */}
        <div
          className="bg-black/80 border-r-2 border-amber-500 border-y border-l border-white/10 px-2.5 py-1 flex items-center gap-2.5 text-[10px] sm:text-xs text-slate-100 tabular-nums shadow-[0_4px_16px_rgba(0,0,0,0.75)]"
          style={{ clipPath: 'polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px)' }}
        >
          <span className="hidden md:inline text-[9px] text-amber-400 font-bold tracking-widest uppercase">
            OP: BLACKLIGHT
          </span>
          <span className="hidden md:inline text-white/15">|</span>
          <span className="flex items-center gap-1" title="Generals Eliminated">
            <Skull className="w-3 h-3 text-amber-400" />
            <strong className={generalsEliminated >= totalGenerals ? 'text-emerald-400' : 'text-white'}>
              {generalsEliminated}/{totalGenerals}
            </strong>
          </span>
          <span className="flex items-center gap-1" title="Bio-Tanks Sabotaged">
            <Bomb className="w-3 h-3 text-cyan-400" />
            <strong className={tanksSabotaged >= totalTanks ? 'text-emerald-400' : 'text-white'}>
              {tanksSabotaged}/{totalTanks}
            </strong>
          </span>
          <span className="flex items-center gap-1" title="Spore Artillery Sabotaged">
            <Target className="w-3 h-3 text-red-400" />
            <strong className={artillerySabotaged >= totalArtillery ? 'text-emerald-400' : 'text-white'}>
              {artillerySabotaged}/{totalArtillery}
            </strong>
          </span>
          <span className="flex items-center gap-1" title="Enemy Bases Sabotaged">
            <Shield className="w-3 h-3 text-emerald-400" />
            <strong className={basesSabotaged >= totalBases ? 'text-emerald-400' : 'text-white'}>
              {basesSabotaged}/{totalBases}
            </strong>
          </span>
          <span className="text-white/15">|</span>
          <span className="text-amber-300 font-bold">
            {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Slim Tactical Directive Feed Strip */}
      {alertMessage && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 pointer-events-none z-10 max-w-[92vw] font-mono">
          <div
            className="bg-black/80 border-l-2 border-amber-500 border-y border-r border-white/15 px-3 py-0.5 text-[10px] text-amber-300 tracking-wider uppercase truncate shadow-md"
            style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)' }}
          >
            {alertMessage}
          </div>
        </div>
      )}

      {/* Tactical Context Action Prompt for Bio-Security Doors or C4 Sabotage */}
      {(nearbyDoorName || nearbySabotageTarget) && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 font-mono">
          <button
            onClick={() => {
              sounds.unlockAudio();
              handleInteractOrSabotage();
            }}
            className="bg-black/90 hover:bg-amber-950/90 border border-amber-400 text-amber-300 font-bold px-4 py-1.5 shadow-[0_0_20px_rgba(245,158,11,0.35)] flex items-center gap-2 text-[11px] uppercase tracking-widest cursor-pointer whitespace-nowrap"
            style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
          >
            {nearbyDoorName ? (
              <>
                <DoorOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>BREACH {nearbyDoorName} [E]</span>
              </>
            ) : (
              <>
                <Bomb className="w-3.5 h-3.5 text-amber-400" />
                <span>PLANT C4: {nearbySabotageTarget} [E]</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* =====================================================================
          CALL OF DUTY: BLACK OPS SPEC-OPS BOTTOM CONTROL DECK & WEAPON HUB
          (Chunky tactile buttons, prominent weapon switcher, Safari-safe)
         ===================================================================== */}
      <div className="absolute bottom-2.5 sm:bottom-4 left-1.5 right-1.5 pb-[max(1rem,env(safe-area-inset-bottom))] px-[max(0.35rem,env(safe-area-inset-left))] pr-[max(0.35rem,env(safe-area-inset-right))] flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2 z-40 pointer-events-none font-mono">
        {/* Left/Center: Chunky Tactical Action Buttons */}
        <div
          className="bg-black/90 border-l-4 border-amber-500 border-y border-r border-amber-500/40 p-1 sm:p-1.5 flex items-center gap-1 sm:gap-1.5 pointer-events-auto overflow-x-auto max-w-full no-scrollbar shadow-[0_4px_25px_rgba(0,0,0,0.9)]"
          style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)' }}
        >
          {/* CROUCH Button */}
          <button
            onClick={() => {
              sounds.unlockAudio();
              sounds.triggerHaptic(10, 0.3);
              toggleCrouch();
            }}
            className={`h-9 sm:h-11 px-2 sm:px-3 text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap border transition-all select-none ${
              isCrouching
                ? 'bg-emerald-950 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                : 'bg-zinc-900 hover:bg-zinc-800 border-white/20 text-slate-100 hover:border-amber-400/60'
            }`}
            title="Toggle Crouch / Stealth Low Profile [C]"
          >
            <ArrowDownToLine className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            <div className="flex flex-col text-left leading-tight">
              <span>{isCrouching ? 'LOW' : 'CROUCH'}</span>
              <span className="text-[8px] sm:text-[9px] opacity-60 font-sans">[C]</span>
            </div>
          </button>

          {/* C4 / BREACH Context Action */}
          <button
            onClick={() => {
              sounds.unlockAudio();
              sounds.triggerHaptic(14, 0.45);
              handleInteractOrSabotage();
            }}
            disabled={!nearbyDoorName && !nearbySabotageTarget}
            className={`h-9 sm:h-11 px-2 sm:px-3 text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap border transition-all select-none ${
              nearbyDoorName || nearbySabotageTarget
                ? 'bg-amber-500/30 border-amber-400 text-amber-300 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.45)]'
                : 'bg-zinc-950/70 border-white/10 text-zinc-600 cursor-not-allowed'
            }`}
            title="Interact or Detonate C4 [E]"
          >
            {nearbyDoorName ? <DoorOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" /> : <Bomb className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />}
            <div className="flex flex-col text-left leading-tight">
              <span>{nearbyDoorName ? 'BREACH' : 'PLANT C4'}</span>
              <span className="text-[8px] sm:text-[9px] opacity-60 font-sans">[E]</span>
            </div>
          </button>

          {/* STEALTH CLOAK */}
          <button
            onClick={() => {
              sounds.unlockAudio();
              sounds.triggerHaptic(12, 0.4);
              toggleCloak();
            }}
            className={`h-9 sm:h-11 px-2 sm:px-3 text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap border transition-all select-none ${
              stealthCloakActive
                ? 'bg-cyan-950 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.4)]'
                : 'bg-zinc-900 hover:bg-zinc-800 border-white/20 text-slate-100 hover:border-cyan-400/60'
            }`}
            title="Toggle Active Camouflage Cloak [V]"
          >
            <EyeOff className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${stealthCloakActive ? 'text-cyan-300 animate-pulse' : 'text-cyan-400'}`} />
            <div className="flex flex-col text-left leading-tight">
              <span>CLOAK</span>
              <span className="text-[8px] sm:text-[9px] opacity-60 font-sans">{stealthEnergy}%</span>
            </div>
          </button>

          {/* ADS / SCOPE */}
          <button
            onClick={() => {
              if (holdShootTimerRef.current) {
                clearTimeout(holdShootTimerRef.current);
                holdShootTimerRef.current = null;
              }
              autoScopedByHoldRef.current = false;
              sounds.unlockAudio();
              sounds.triggerHaptic(10, 0.35);
              setIsScoped(prev => {
                const next = !prev;
                stateRef.current.isScoped = next;
                return next;
              });
            }}
            className={`h-9 sm:h-11 px-2 sm:px-3 text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap border transition-all select-none ${
              isScoped
                ? 'bg-cyan-950 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.4)]'
                : 'bg-zinc-900 hover:bg-zinc-800 border-white/20 text-slate-100 hover:border-amber-400/60'
            }`}
            title="Toggle Optic Sight Scope [F] or Right-Click"
          >
            <Crosshair className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <div className="flex flex-col text-left leading-tight">
              <span>{isScoped ? 'SCOPED' : 'SCOPE'}</span>
              <span className="text-[8px] sm:text-[9px] opacity-60 font-sans">[F]</span>
            </div>
          </button>

          {/* RELOAD */}
          <button
            onClick={() => {
              sounds.unlockAudio();
              sounds.triggerHaptic(10, 0.3);
              handleReload();
            }}
            className="h-9 sm:h-11 px-2 sm:px-3 text-[10px] sm:text-xs font-black uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 border border-white/20 text-slate-100 hover:border-amber-400/60 cursor-pointer flex items-center gap-1 sm:gap-1.5 whitespace-nowrap transition-all select-none"
            title="Reload Weapon [R]"
          >
            <div className="flex flex-col text-left leading-tight">
              <span>RLD</span>
              <span className="text-[8px] sm:text-[9px] opacity-60 font-sans">[R]</span>
            </div>
          </button>

          {/* STIM HEAL */}
          <button
            onClick={() => {
              sounds.unlockAudio();
              sounds.triggerHaptic(12, 0.4);
              handleHeal();
            }}
            className="h-9 sm:h-11 px-2 sm:px-3 text-[10px] sm:text-xs font-black uppercase tracking-wider bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 cursor-pointer flex items-center gap-1 sm:gap-1.5 whitespace-nowrap transition-all select-none shadow-[0_0_10px_rgba(16,185,129,0.25)]"
            title="Inject Medical Bio-Stim [SPACE]"
          >
            <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            <div className="flex flex-col text-left leading-tight">
              <span>STIM</span>
              <span className="text-[8px] sm:text-[9px] opacity-75 font-sans">[SPACE]</span>
            </div>
          </button>

          {/* AUTO-LOCK TOGGLE */}
          <button
            onClick={() => {
              sounds.unlockAudio();
              sounds.triggerHaptic(10, 0.3);
              onToggleAutoAim();
            }}
            className={`h-9 sm:h-11 px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider cursor-pointer whitespace-nowrap border transition-all flex items-center gap-1 select-none ${
              autoAimEnabled
                ? 'bg-amber-950/90 border-amber-400/80 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                : 'bg-zinc-900 border-white/15 text-zinc-500'
            }`}
            title="Toggle Target Lock-On Assist"
          >
            <Target className={`w-3.5 h-3.5 ${autoAimEnabled ? 'text-amber-400' : 'text-zinc-600'}`} />
            <span>{autoAimEnabled ? 'LOCK' : 'OFF'}</span>
          </button>

          {/* AUDIO MUTE TOGGLE */}
          <button
            onClick={() => {
              sounds.unlockAudio();
              sounds.triggerHaptic(8, 0.25);
              onToggleSound();
            }}
            className="h-9 sm:h-11 px-2 sm:px-2.5 bg-zinc-900 hover:bg-zinc-800 border border-white/20 text-slate-200 cursor-pointer flex items-center justify-center transition-all select-none"
            title="Toggle Tactical Audio"
          >
            {!soundEnabled ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />}
          </button>
        </div>

        {/* Right: Prominent Tactical Weapon Hub & Weapon Switcher */}
        <div
          className="bg-black/90 border-r-4 border-amber-500 border-y border-l border-amber-500/40 p-1.5 sm:p-2 flex items-center gap-2 sm:gap-2.5 pointer-events-auto shadow-[0_4px_25px_rgba(0,0,0,0.9)] max-w-full"
          style={{ clipPath: 'polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px)' }}
        >
          {/* Active Weapon Card */}
          <div className="flex flex-col text-left leading-tight min-w-[90px] sm:min-w-[130px]">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="text-[7px] sm:text-[8px] px-1 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase tracking-widest">
                [SPEC-OPS]
              </span>
              <span className="text-[8px] sm:text-[9px] text-zinc-400 uppercase">SLOT {activeSpyWeaponIdx + 1}</span>
            </div>
            <span className="text-[10px] sm:text-xs font-black text-amber-400 tracking-wide truncate max-w-[90px] sm:max-w-[150px] uppercase">
              {activeSpyWeapon.name}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm sm:text-lg font-black text-white tabular-nums tracking-tight">
                {isReloading ? 'RELOAD' : ammo.toString().padStart(2, '0')}
              </span>
              <span className="text-[9px] sm:text-[10px] text-zinc-500 font-bold">/ {maxAmmo}</span>
            </div>
          </div>

          {/* Quick Swap & Slot Buttons */}
          <div className="flex flex-col gap-1">
            {/* Cycle / Swap Weapon Button */}
            <button
              onClick={() => {
                sounds.unlockAudio();
                sounds.triggerHaptic(12, 0.4);
                handleSwapSpyWeapon();
              }}
              className="h-7 sm:h-8 px-2 sm:px-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-[10px] sm:text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-all shadow-[0_0_12px_rgba(245,158,11,0.4)] select-none"
              style={{ clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}
              title="Swap Weapon Mode [Q]"
            >
              <span>SWAP</span>
              <span className="text-[8px] sm:text-[9px] font-sans opacity-75">[Q]</span>
            </button>

            {/* Quick Slots [1], [2], [3] */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {SPY_WEAPONS.map((wpn, idx) => {
                const isActive = idx === activeSpyWeaponIdx;
                return (
                  <button
                    key={wpn.id}
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.triggerHaptic(10, 0.3);
                      handleSwapSpyWeapon(idx);
                    }}
                    className={`h-5 sm:h-6 px-1 sm:px-1.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider cursor-pointer border flex items-center gap-0.5 select-none transition-all ${
                      isActive
                        ? 'bg-amber-500 border-amber-300 text-black shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                        : 'bg-zinc-900 hover:bg-zinc-800 border-white/20 text-zinc-300'
                    }`}
                    title={`Equip ${wpn.name} [${idx + 1}]`}
                  >
                    <span className="text-[7px] opacity-75">[{idx + 1}]</span>
                    <span className="truncate max-w-[36px] sm:max-w-[44px] leading-none">{wpn.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
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
