export interface Question {
  id: string;
  topic: string;
  stage: 'Stage 7' | 'Stage 8';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  cambridgeConcept: string;
  hint?: string;
}

export interface LevelConfig {
  id: string;
  title: string;
  codename: string;
  stage: 'Stage 7' | 'Stage 8';
  topic: string;
  organSector: string;
  description: string;
  briefing: string;
  targetPathogen: string;
  questions: Question[]; // 9 questions (3 for phase 1, 3 for phase 2, 3 for phase 3)
  enemyTypes: ('strep' | 'phage' | 'bacillus' | 'capsid' | 'amoeba_boss' | 'tank')[];
}

export interface Weapon {
  id: string;
  name: string;
  category: 'ASSAULT' | 'SHOTGUN' | 'SNIPER' | 'MACHINE_GUN';
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  description: string;
  damage: number;
  fireRate: number; // ms between shots
  magSize: number;
  currentMag: number;
  totalReserve: number;
  reloadTime: number; // ms
  pellets?: number;
  color: string;
}

export interface Enemy {
  id: number;
  type: 'strep' | 'phage' | 'bacillus' | 'capsid' | 'amoeba_boss' | 'tank';
  name: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  value: number;
  isBoss?: boolean;
  wiggleSeed: number;
}

export interface HitMarkerInfo {
  id: number;
  x: number;
  y: number;
  isCritical: boolean;
  damage: number;
}

export interface KillfeedEntry {
  id: number;
  text: string;
  weapon: string;
  time: number;
}

export interface StudentProfile {
  name: string;
  className: string;
}

export interface LeaderboardEntry {
  id: string;
  studentName: string;
  className: string;
  score: number;
  kills: number;
  levelTitle: string;
  stage: 'Stage 7' | 'Stage 8' | string;
  date: string;
  timestamp: number;
  rankTitle?: string;
  isVictory?: boolean;
}

export interface PlayerStats {
  unlockedLevelIndex: number;
  highScores: Record<string, number>;
  starsEarned: Record<string, number>; // 1-3 stars per level
  totalKills: number;
  questionsAnswered: number;
  questionsCorrect: number;
  selectedWeaponId: string;
  soundEnabled: boolean;
  rankXp: number;
  studentProfile?: StudentProfile;
}

export interface RankInfo {
  level: number;
  title: string;
  code: string;
  minXp: number;
  nextXp: number;
  color: string;
  stars: number;
}

