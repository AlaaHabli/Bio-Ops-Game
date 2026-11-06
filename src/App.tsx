/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LevelConfig, PlayerStats, Weapon } from './types/game';
import { CURRICULUM_LEVELS, INITIAL_WEAPONS } from './data/curriculumData';
import { loadPlayerStats, savePlayerStats } from './services/storage';
import { sounds } from './services/soundEffects';
import { TitleScreen } from './components/TitleScreen';
import { MissionBriefingModal } from './components/MissionBriefingModal';
import { QuizPhase } from './components/QuizPhase';
import { CombatView } from './components/CombatView';
import { VictoryModal } from './components/VictoryModal';
import { DefeatModal } from './components/DefeatModal';
import { ArmoryModal } from './components/ArmoryModal';
import { IntelArchive } from './components/IntelArchive';

type GameState = 'TITLE' | 'BRIEFING' | 'QUIZ' | 'COMBAT' | 'VICTORY' | 'DEFEAT';

export default function App() {
  const [playerStats, setPlayerStats] = useState<PlayerStats>(() => loadPlayerStats());
  const [selectedLevel, setSelectedLevel] = useState<LevelConfig>(CURRICULUM_LEVELS[0]);
  const [activeWeapon, setActiveWeapon] = useState<Weapon>(() => {
    const stats = loadPlayerStats();
    return INITIAL_WEAPONS.find((w) => w.id === stats.selectedWeaponId) || INITIAL_WEAPONS[0];
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const stats = loadPlayerStats();
    return stats.soundEnabled;
  });
  const [autoAimEnabled, setAutoAimEnabled] = useState<boolean>(true);

  const [gameState, setGameState] = useState<GameState>('TITLE');
  const [phaseNumber, setPhaseNumber] = useState<number>(1); // 1, 2, or 3
  const [accumulatedScore, setAccumulatedScore] = useState<number>(0);
  const [accumulatedKills, setAccumulatedKills] = useState<number>(0);

  // Modals
  const [isArmoryOpen, setIsArmoryOpen] = useState<boolean>(false);
  const [isIntelOpen, setIsIntelOpen] = useState<boolean>(false);

  // Sync sound settings
  useEffect(() => {
    sounds.setEnabled(soundEnabled);
  }, [soundEnabled]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sounds.setEnabled(next);
    const updatedStats = { ...playerStats, soundEnabled: next };
    setPlayerStats(updatedStats);
    savePlayerStats(updatedStats);
  };

  const handleToggleAutoAim = () => {
    setAutoAimEnabled((prev) => !prev);
  };

  const handleSelectWeapon = (weapon: Weapon) => {
    setActiveWeapon(weapon);
    const updatedStats = { ...playerStats, selectedWeaponId: weapon.id };
    setPlayerStats(updatedStats);
    savePlayerStats(updatedStats);
  };

  const handleStartMission = () => {
    sounds.unlockAudio();
    setPhaseNumber(1);
    setAccumulatedScore(0);
    setAccumulatedKills(0);
    setGameState('QUIZ');
  };

  const handleQuickCombat = () => {
    sounds.unlockAudio();
    setPhaseNumber(1);
    setAccumulatedScore(0);
    setAccumulatedKills(0);
    setGameState('COMBAT');
  };

  const handleCommenceOperation = () => {
    sounds.unlockAudio();
    setPhaseNumber(1);
    setAccumulatedScore(0);
    setAccumulatedKills(0);
    setGameState('QUIZ');
  };

  // Called when student gets 3 correct answers in current quiz phase
  const handleDeployCombat = () => {
    sounds.unlockAudio();
    setGameState('COMBAT');
  };

  // Called when 60-second combat phase ends with player surviving
  const handlePhaseComplete = (earnedScore: number, earnedKills: number) => {
    const newScore = accumulatedScore + earnedScore;
    const newKills = accumulatedKills + earnedKills;
    setAccumulatedScore(newScore);
    setAccumulatedKills(newKills);

    if (phaseNumber < 3) {
      // Advance to next quiz phase (e.g. Phase 2 or Phase 3)
      setPhaseNumber((prev) => prev + 1);
      setGameState('QUIZ');
    } else {
      // Phase 3 completed -> LEVEL VICTORY! All 9 questions verified and all waves cleared!
      const levelId = selectedLevel.id;
      const currentHigh = playerStats.highScores[levelId] || 0;
      const starsEarned = newScore > 3500 ? 3 : newScore > 2000 ? 2 : 1;

      const currentLvlIdx = CURRICULUM_LEVELS.findIndex((l) => l.id === levelId);
      const nextUnlockedIdx = Math.max(playerStats.unlockedLevelIndex, currentLvlIdx + 1);

      const updatedStats: PlayerStats = {
        ...playerStats,
        unlockedLevelIndex: Math.min(CURRICULUM_LEVELS.length - 1, nextUnlockedIdx),
        highScores: {
          ...playerStats.highScores,
          [levelId]: Math.max(currentHigh, newScore),
        },
        starsEarned: {
          ...playerStats.starsEarned,
          [levelId]: Math.max(playerStats.starsEarned[levelId] || 0, starsEarned),
        },
        totalKills: playerStats.totalKills + newKills,
        rankXp: (playerStats.rankXp || 0) + newScore + newKills * 50,
      };

      setPlayerStats(updatedStats);
      savePlayerStats(updatedStats);
      setGameState('VICTORY');
    }
  };

  const handlePhaseDefeat = () => {
    setGameState('DEFEAT');
  };

  const handleNextLevel = () => {
    const currentIdx = CURRICULUM_LEVELS.findIndex((l) => l.id === selectedLevel.id);
    const nextIdx = (currentIdx + 1) % CURRICULUM_LEVELS.length;
    setSelectedLevel(CURRICULUM_LEVELS[nextIdx]);
    setGameState('BRIEFING');
  };

  const handleReplay = () => {
    handleCommenceOperation();
  };

  const handleMainMenu = () => {
    setGameState('TITLE');
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 font-tactical select-none">
      
      {/* 1. TITLE SCREEN */}
      {gameState === 'TITLE' && (
        <TitleScreen
          playerStats={playerStats}
          selectedLevel={selectedLevel}
          activeWeapon={activeWeapon}
          soundEnabled={soundEnabled}
          autoAimEnabled={autoAimEnabled}
          onSelectLevel={setSelectedLevel}
          onStartGame={handleStartMission}
          onQuickCombat={handleQuickCombat}
          onOpenArmory={() => setIsArmoryOpen(true)}
          onOpenIntelGuide={() => setIsIntelOpen(true)}
          onToggleSound={handleToggleSound}
          onToggleAutoAim={handleToggleAutoAim}
        />
      )}

      {/* 2. MISSION BRIEFING MODAL */}
      {gameState === 'BRIEFING' && (
        <MissionBriefingModal
          level={selectedLevel}
          activeWeapon={activeWeapon}
          onDeploy={handleCommenceOperation}
          onCancel={handleMainMenu}
        />
      )}

      {/* 3. CAMBRIDGE CHECKPOINT QUIZ PHASE */}
      {gameState === 'QUIZ' && (
        <QuizPhase
          level={selectedLevel}
          phaseNumber={phaseNumber}
          activeWeapon={activeWeapon}
          soundEnabled={soundEnabled}
          onThreeCorrectAchieved={handleDeployCombat}
          onOpenArmory={() => setIsArmoryOpen(true)}
          onOpenIntelGuide={() => setIsIntelOpen(true)}
        />
      )}

      {/* 4. 60-SECOND THREE.JS FPS COMBAT PHASE */}
      {gameState === 'COMBAT' && (
        <CombatView
          level={selectedLevel}
          phaseNumber={phaseNumber}
          activeWeapon={activeWeapon}
          soundEnabled={soundEnabled}
          autoAimEnabled={autoAimEnabled}
          playerXp={playerStats.rankXp || (playerStats.totalKills * 50 + playerStats.questionsCorrect * 150)}
          onPhaseComplete={handlePhaseComplete}
          onPhaseDefeat={handlePhaseDefeat}
          onToggleSound={handleToggleSound}
          onToggleAutoAim={handleToggleAutoAim}
        />
      )}

      {/* 5. VICTORY DEBRIEF */}
      {gameState === 'VICTORY' && (
        <VictoryModal
          level={selectedLevel}
          score={accumulatedScore}
          kills={accumulatedKills}
          stars={accumulatedScore > 3500 ? 3 : accumulatedScore > 2000 ? 2 : 1}
          onNextLevel={handleNextLevel}
          onReplay={handleReplay}
          onMainMenu={handleMainMenu}
        />
      )}

      {/* 6. DEFEAT SCREEN */}
      {gameState === 'DEFEAT' && (
        <DefeatModal
          level={selectedLevel}
          onRetry={handleCommenceOperation}
          onOpenIntelGuide={() => setIsIntelOpen(true)}
          onMainMenu={handleMainMenu}
        />
      )}

      {/* GLOBAL MODALS */}
      {isArmoryOpen && (
        <ArmoryModal
          selectedWeaponId={activeWeapon.id}
          onSelectWeapon={handleSelectWeapon}
          onClose={() => setIsArmoryOpen(false)}
        />
      )}

      {isIntelOpen && (
        <IntelArchive onClose={() => setIsIntelOpen(false)} />
      )}
    </div>
  );
}
