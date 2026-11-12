/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LevelConfig, PlayerStats, Weapon, StudentProfile, LeaderboardEntry } from './types/game';
import { CURRICULUM_LEVELS, INITIAL_WEAPONS } from './data/curriculumData';
import {
  loadPlayerStats,
  savePlayerStats,
  loadStudentProfile,
  saveStudentProfile,
  loadLeaderboard,
  mergeLeaderboardLists,
  subscribeToLeaderboard,
  recordScoreToLeaderboard,
  resetLeaderboardToDefaults,
} from './services/storage';
import { sounds } from './services/soundEffects';
import { TitleScreen } from './components/TitleScreen';
import { MissionBriefingModal } from './components/MissionBriefingModal';
import { QuizPhase } from './components/QuizPhase';
import { CombatView } from './components/CombatView';
import { SpyMissionView } from './components/SpyMissionView';
import { VictoryModal } from './components/VictoryModal';
import { DefeatModal } from './components/DefeatModal';
import { ArmoryModal } from './components/ArmoryModal';
import { IntelArchive } from './components/IntelArchive';
import { StudentProfileModal } from './components/StudentProfileModal';
import { LeaderboardModal } from './components/LeaderboardModal';

type GameState = 'TITLE' | 'BRIEFING' | 'QUIZ' | 'COMBAT' | 'MULTIPLAYER' | 'VICTORY' | 'DEFEAT';

export default function App() {
  const [playerStats, setPlayerStats] = useState<PlayerStats>(() => {
    const stats = loadPlayerStats();
    const profile = loadStudentProfile();
    return profile ? { ...stats, studentProfile: profile } : stats;
  });
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(() => loadStudentProfile());
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>(() => loadLeaderboard());
  const [isCloudLive, setIsCloudLive] = useState<boolean>(true);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

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
  const [mpRoomCode, setMpRoomCode] = useState<string>('BIO-FFA');
  const [mpStartWithQuiz, setMpStartWithQuiz] = useState<boolean>(false);

  // Modals
  const [isArmoryOpen, setIsArmoryOpen] = useState<boolean>(false);
  const [isIntelOpen, setIsIntelOpen] = useState<boolean>(false);

  // Real-time Cloud Leaderboard Subscription (Free Firebase Firestore)
  useEffect(() => {
    const unsubscribe = subscribeToLeaderboard((entries, live) => {
      setLeaderboardEntries(entries);
      setIsCloudLive(live);
    });
    return () => unsubscribe();
  }, []);

  // Prompt student for Name & Class if not yet configured
  useEffect(() => {
    if (!studentProfile) {
      setIsProfileModalOpen(true);
    }
  }, [studentProfile]);

  const handleSaveProfile = (profile: StudentProfile) => {
    saveStudentProfile(profile);
    setStudentProfile(profile);
    const updatedStats = { ...playerStats, studentProfile: profile };
    setPlayerStats(updatedStats);
    savePlayerStats(updatedStats);
    setIsProfileModalOpen(false);

    // Immediately register student on the leaderboard so every student who joins appears even before finishing all 3 phases
    const existingBest = leaderboardEntries
      .filter((e) => e.studentName.trim().toLowerCase() === profile.name.trim().toLowerCase())
      .reduce((max, item) => Math.max(max, item.score), 0);

    recordScoreToLeaderboard({
      studentName: profile.name,
      className: profile.className,
      levelTitle: selectedLevel.title,
      stage: selectedLevel.stage,
      score: Math.max(existingBest, 100),
      kills: updatedStats.totalKills || 0,
      isVictory: false,
    }).then((saved) => {
      setLeaderboardEntries((prev) => mergeLeaderboardLists([saved], prev, loadLeaderboard()));
    });
  };

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

  const handleStartMultiplayer = (roomCode: string, startWithReviveQuiz: boolean) => {
    sounds.unlockAudio();
    setMpRoomCode((roomCode || 'BIO-FFA').trim().toUpperCase());
    setMpStartWithQuiz(startWithReviveQuiz);
    setPhaseNumber(1);
    setAccumulatedScore(0);
    setAccumulatedKills(0);
    setGameState('MULTIPLAYER');
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
    const quizPhaseBonus = 300;
    const updatedScore = accumulatedScore + quizPhaseBonus;
    setAccumulatedScore(updatedScore);

    // Record student's Quiz Phase completion to the leaderboard immediately so they appear even if they don't finish all 3 phases!
    const currentProf = studentProfile || loadStudentProfile() || { name: 'Field Operative', className: 'Science Unit' };
    recordScoreToLeaderboard({
      studentName: currentProf.name,
      className: currentProf.className,
      levelTitle: selectedLevel.title,
      stage: selectedLevel.stage,
      score: updatedScore,
      kills: accumulatedKills,
      isVictory: false,
    }).then((saved) => {
      setLeaderboardEntries((prev) => mergeLeaderboardLists([saved], prev, loadLeaderboard()));
    });

    setGameState('COMBAT');
  };

  // Called when 60-second combat phase ends with player surviving or boss defeated
  const handlePhaseComplete = (earnedScore: number, earnedKills: number) => {
    const newScore = accumulatedScore + earnedScore;
    const newKills = accumulatedKills + earnedKills;
    setAccumulatedScore(newScore);
    setAccumulatedKills(newKills);

    // Save score to classroom leaderboard for the current student
    const currentProf = studentProfile || loadStudentProfile() || { name: 'Field Operative', className: 'Science Unit' };
    recordScoreToLeaderboard({
      studentName: currentProf.name,
      className: currentProf.className,
      levelTitle: selectedLevel.title,
      stage: selectedLevel.stage,
      score: newScore,
      kills: newKills,
      isVictory: phaseNumber >= 3,
    }).then((saved) => {
      setLeaderboardEntries((prev) => mergeLeaderboardLists([saved], prev, loadLeaderboard()));
    });

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

  const handlePhaseDefeat = (earnedScore: number = 0, earnedKills: number = 0) => {
    const finalScore = Math.max(100, accumulatedScore + earnedScore);
    const finalKills = accumulatedKills + earnedKills;
    const currentProf = studentProfile || loadStudentProfile() || { name: 'Field Operative', className: 'Science Unit' };
    recordScoreToLeaderboard({
      studentName: currentProf.name,
      className: currentProf.className,
      levelTitle: selectedLevel.title,
      stage: selectedLevel.stage,
      score: finalScore,
      kills: finalKills,
      isVictory: false,
    }).then((saved) => {
      setLeaderboardEntries((prev) => mergeLeaderboardLists([saved], prev, loadLeaderboard()));
    });
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
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-slate-950 text-slate-100 font-tactical select-none">
      
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
          onStartMultiplayer={handleStartMultiplayer}
          onOpenArmory={() => setIsArmoryOpen(true)}
          onOpenIntelGuide={() => setIsIntelOpen(true)}
          onToggleSound={handleToggleSound}
          onToggleAutoAim={handleToggleAutoAim}
          onOpenLeaderboard={() => {
            setLeaderboardEntries((prev) => mergeLeaderboardLists(prev, loadLeaderboard()));
            setIsLeaderboardOpen(true);
          }}
          onOpenProfile={() => setIsProfileModalOpen(true)}
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

      {/* 3. SCIENCE QUIZ PHASE (GRADE 5 INSPIRE & GRADE 7-8) */}
      {gameState === 'QUIZ' && (
        <QuizPhase
          level={selectedLevel}
          phaseNumber={phaseNumber}
          activeWeapon={activeWeapon}
          soundEnabled={soundEnabled}
          onThreeCorrectAchieved={handleDeployCombat}
          onOpenArmory={() => setIsArmoryOpen(true)}
          onOpenIntelGuide={() => setIsIntelOpen(true)}
          onBackToMenu={handleMainMenu}
        />
      )}

      {/* 4. THREE.JS FPS COMBAT OR SECRET SPY INFILTRATION ATTACK PHASE */}
      {gameState === 'COMBAT' &&
        (selectedLevel.isSecret ? (
          <SpyMissionView
            key={`${selectedLevel.id}-spy-phase-${phaseNumber}`}
            level={selectedLevel}
            phaseNumber={phaseNumber}
            activeWeapon={activeWeapon}
            soundEnabled={soundEnabled}
            autoAimEnabled={autoAimEnabled}
            playerXp={playerStats.rankXp || playerStats.totalKills * 50 + playerStats.questionsCorrect * 150}
            onPhaseComplete={handlePhaseComplete}
            onPhaseDefeat={handlePhaseDefeat}
            onToggleSound={handleToggleSound}
            onToggleAutoAim={handleToggleAutoAim}
            onExitToMenu={handleMainMenu}
            onSelectWeapon={handleSelectWeapon}
            availableWeapons={INITIAL_WEAPONS}
          />
        ) : (
          <CombatView
            key={`${selectedLevel.id}-phase-${phaseNumber}`}
            level={selectedLevel}
            phaseNumber={phaseNumber}
            activeWeapon={activeWeapon}
            soundEnabled={soundEnabled}
            autoAimEnabled={autoAimEnabled}
            playerXp={playerStats.rankXp || playerStats.totalKills * 50 + playerStats.questionsCorrect * 150}
            onPhaseComplete={handlePhaseComplete}
            onPhaseDefeat={handlePhaseDefeat}
            onToggleSound={handleToggleSound}
            onToggleAutoAim={handleToggleAutoAim}
            onExitToMenu={handleMainMenu}
            onSelectWeapon={handleSelectWeapon}
            availableWeapons={INITIAL_WEAPONS}
          />
        ))}

      {/* 4B. LIVE ONLINE 3D MULTIPLAYER OPEN-WORLD DEATHMATCH */}
      {gameState === 'MULTIPLAYER' && (
        <CombatView
          key={`mp-${mpRoomCode}-${selectedLevel.id}`}
          level={selectedLevel.isSecret ? CURRICULUM_LEVELS[0] : selectedLevel}
          phaseNumber={1}
          activeWeapon={activeWeapon}
          soundEnabled={soundEnabled}
          autoAimEnabled={autoAimEnabled}
          playerXp={playerStats.rankXp || playerStats.totalKills * 50 + playerStats.questionsCorrect * 150}
          isMultiplayerDeathmatch={true}
          multiplayerRoomCode={mpRoomCode}
          startWithReviveQuiz={mpStartWithQuiz}
          onPhaseComplete={handlePhaseComplete}
          onPhaseDefeat={handlePhaseDefeat}
          onToggleSound={handleToggleSound}
          onToggleAutoAim={handleToggleAutoAim}
          onExitToMenu={handleMainMenu}
          onSelectWeapon={handleSelectWeapon}
          availableWeapons={INITIAL_WEAPONS}
        />
      )}

      {/* 5. VICTORY DEBRIEF */}
      {gameState === 'VICTORY' && (
        <VictoryModal
          level={selectedLevel}
          score={accumulatedScore}
          kills={accumulatedKills}
          stars={accumulatedScore > 3500 ? 3 : accumulatedScore > 2000 ? 2 : 1}
          studentProfile={studentProfile}
          onOpenLeaderboard={() => {
            setLeaderboardEntries((prev) => mergeLeaderboardLists(prev, loadLeaderboard()));
            setIsLeaderboardOpen(true);
          }}
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

      {/* STUDENT IDENTITY & CLASSROOM LEADERBOARD MODALS */}
      <StudentProfileModal
        isOpen={isProfileModalOpen}
        currentProfile={studentProfile}
        allowCancel={Boolean(studentProfile)}
        onSave={handleSaveProfile}
        onClose={() => setIsProfileModalOpen(false)}
      />

      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        entries={leaderboardEntries}
        currentStudentName={studentProfile?.name}
        isCloudLive={isCloudLive}
        onClose={() => setIsLeaderboardOpen(false)}
        onResetToDefaults={() => {
          resetLeaderboardToDefaults();
          setLeaderboardEntries(loadLeaderboard());
        }}
        onEntryDeleted={(id) => {
          setLeaderboardEntries((prev) => prev.filter((e) => e.id !== id));
        }}
      />
    </div>
  );
}
