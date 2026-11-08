import React, { useEffect, useState } from 'react';
import { LevelConfig, PlayerStats, Weapon } from '../types/game';
import { CURRICULUM_LEVELS } from '../data/curriculumData';
import { sounds } from '../services/soundEffects';
import { Zap, BookOpen, Volume2, VolumeX, Star, Play, Crosshair, CheckCircle2 } from 'lucide-react';
import { Trophy, UserCheck, Shield } from 'lucide-react';
import { RankBadge } from './RankBadge';

interface TitleScreenProps {
  playerStats: PlayerStats;
  selectedLevel: LevelConfig;
  activeWeapon: Weapon;
  soundEnabled: boolean;
  autoAimEnabled: boolean;
  onSelectLevel: (level: LevelConfig) => void;
  onStartGame: () => void;
  onQuickCombat?: () => void;
  onOpenArmory: () => void;
  onOpenIntelGuide: () => void;
  onToggleSound: () => void;
  onToggleAutoAim: () => void;
  onOpenLeaderboard: () => void;
  onOpenProfile: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  playerStats,
  selectedLevel,
  activeWeapon,
  soundEnabled,
  autoAimEnabled,
  onSelectLevel,
  onStartGame,
  onQuickCombat,
  onOpenArmory,
  onOpenIntelGuide,
  onToggleSound,
  onToggleAutoAim,
  onOpenLeaderboard,
  onOpenProfile,
}) => {
  const [stageFilter, setStageFilter] = useState<'ALL' | 'Stage 7' | 'Stage 8' | 'SECRET'>('ALL');

  const secretLevel = CURRICULUM_LEVELS.find((lvl) => lvl.isSecret) || CURRICULUM_LEVELS[CURRICULUM_LEVELS.length - 1];

  const filteredLevels = CURRICULUM_LEVELS.filter((lvl) => {
    if (stageFilter === 'ALL') return true;
    if (stageFilter === 'SECRET') return Boolean(lvl.isSecret);
    return lvl.stage === stageFilter && !lvl.isSecret;
  });

  // Listen for Enter to start game directly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sounds.unlockAudio();
        sounds.playCombatAlarm();
        onStartGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStartGame]);

  return (
    <div className="relative w-full h-full min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between overflow-y-auto select-none">
      {/* Bright, Clean Game Lobby Ambient Lighting */}
      <div className="absolute -top-40 left-1/4 w-[36rem] h-[36rem] rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 right-1/4 w-[36rem] h-[36rem] rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

      {/* TOP BAR CONTRACT: 3 Zones (Brand Wordmark — Nav Links — Primary Action) */}
      <header className="relative z-10 w-full border-b border-slate-800 bg-slate-950/90 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <span className="text-lg sm:text-xl font-display font-bold tracking-wider text-white whitespace-nowrap shrink-0">
            BIO-OPS: CELLULAR WARFARE
          </span>

          {/* Zone 2: Clean single-line navigation links */}
          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-300">
            <button
              onClick={() => {
                sounds.unlockAudio();
                sounds.playRadioChirp();
                onOpenLeaderboard();
              }}
              className="text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer font-bold"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Leaderboard</span>
            </button>
            <button
              onClick={() => {
                sounds.unlockAudio();
                sounds.playRadioChirp();
                onOpenArmory();
              }}
              className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Weapons Armory
            </button>
            <button
              onClick={() => {
                sounds.unlockAudio();
                sounds.playRadioChirp();
                onOpenIntelGuide();
              }}
              className="hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Science Study Guide
            </button>
            <button
              onClick={() => {
                sounds.unlockAudio();
                onToggleSound();
              }}
              className="hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {soundEnabled ? 'Sound: On' : 'Sound: Off'}
            </button>
          </nav>

          {/* Zone 3: Student Profile Callsign Badge & Primary Play Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            {playerStats.studentProfile ? (
              <button
                onClick={() => {
                  sounds.unlockAudio();
                  sounds.playRadioChirp();
                  onOpenProfile();
                }}
                className="px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400/80 text-left transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
                title="Click to edit student name or class"
              >
                <div className="w-7 h-7 rounded-md bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="hidden sm:block leading-tight">
                  <div className="text-xs font-display font-bold text-white truncate max-w-[130px]">
                    {playerStats.studentProfile.name}
                  </div>
                  <div className="text-[10px] font-mono text-cyan-300 truncate max-w-[130px]">
                    {playerStats.studentProfile.className || 'Science Unit'}
                  </div>
                </div>
              </button>
            ) : (
              <button
                onClick={() => {
                  sounds.unlockAudio();
                  sounds.playRadioChirp();
                  onOpenProfile();
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span>Enter Callsign</span>
              </button>
            )}

            <button
              onClick={() => {
                sounds.unlockAudio();
                sounds.playCombatAlarm();
                onStartGame();
              }}
              className="px-4 py-2 text-xs sm:text-sm font-display font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
            >
              Play Now
            </button>
          </div>
        </div>
      </header>

      {/* MAIN GAME MENU WORKSPACE: Two Clear Columns */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">
          
          {/* LEFT COLUMN (7 cols): Main Game Launchpad & Simple Student Instructions */}
          <div className="lg:col-span-7 bg-slate-950/90 border border-slate-800 rounded-xl p-6 sm:p-8 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="text-xs sm:text-sm font-mono text-cyan-400">
                  <span>Cambridge Science Stage 7 &amp; 8</span>
                  <span aria-hidden="true" className="mx-2">·</span>
                  <span>Interactive 3D Game</span>
                </div>
                <RankBadge
                  xp={playerStats.rankXp || playerStats.totalKills * 50 + playerStats.questionsCorrect * 150}
                  compact
                />
              </div>

              <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-white tracking-tight leading-tight">
                Defend the Human Body
              </h1>

              <p className="text-sm sm:text-base text-slate-300 mt-3 leading-relaxed max-w-2xl">
                Play as an elite White Blood Cell soldier inside human organs. Answer science questions to unlock combat phases, then protect Red Blood Cells from invading bacteria, tanks, helicopters, cyber-robots, and fighter jets!
              </p>

              {/* Selected Mission & Equipped Weapon Summary Box */}
              <div className="mt-5 p-4 rounded-lg bg-slate-900 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono text-amber-400">
                    CURRENTLY SELECTED MISSION ({selectedLevel.stage})
                  </div>
                  <div className="text-lg sm:text-xl font-display font-bold text-white mt-0.5">
                    {selectedLevel.title}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-300 mt-0.5">
                    {selectedLevel.topic}
                  </div>
                </div>

                <div className="sm:text-right border-t sm:border-t-0 border-slate-800 pt-3 sm:pt-0">
                  <div className="text-xs font-mono text-slate-400">EQUIPPED WEAPON</div>
                  <div className="text-sm sm:text-base font-display font-bold text-cyan-300 mt-0.5">
                    {activeWeapon.name}
                  </div>
                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.playRadioChirp();
                      onOpenArmory();
                    }}
                    className="mt-1 text-xs font-semibold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                  >
                    Change Weapon
                  </button>
                </div>
              </div>

              {/* PRE-GAME AIMING MODE SELECTOR (Auto-Aim vs Manual Black Ops Sight Scope Aim) */}
              <div className="mt-3 p-3.5 rounded-lg bg-slate-900/90 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-mono font-bold text-cyan-400">
                    AIMING SYSTEM (CHOOSE BEFORE DEPLOYMENT)
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    {autoAimEnabled
                      ? 'Auto-Aim Assist ON: Crosshair & laser snap smoothly onto nearby targets.'
                      : 'Manual Black Ops Aim: Use Sight Scope (Right-Click / [F]) to line up shots manually!'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => {
                      if (!autoAimEnabled) {
                        sounds.unlockAudio();
                        sounds.playRadioChirp();
                        onToggleAutoAim();
                      }
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-display font-bold transition-all cursor-pointer whitespace-nowrap ${
                      autoAimEnabled
                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    AUTO-AIM: ON
                  </button>
                  <button
                    onClick={() => {
                      if (autoAimEnabled) {
                        sounds.unlockAudio();
                        sounds.playRadioChirp();
                        onToggleAutoAim();
                      }
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-display font-bold transition-all cursor-pointer whitespace-nowrap ${
                      !autoAimEnabled
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    MANUAL SCOPE AIM
                  </button>
                </div>
              </div>
            </div>

            {/* GIANT, UNMISTAKABLE START BUTTONS */}
            <div className="mt-5 pt-5 border-t border-slate-800/80 flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Primary Button: Play Mission (Quiz + 3D Combat) */}
                <button
                  onClick={() => {
                    sounds.unlockAudio();
                    sounds.playCombatAlarm();
                    onStartGame();
                  }}
                  className="w-full py-4 px-6 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-base sm:text-lg tracking-wide flex items-center justify-center gap-2.5 shadow-[0_0_25px_rgba(16,185,129,0.45)] active:scale-98 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-5 h-5 fill-slate-950 shrink-0" />
                  <span>PLAY MISSION (QUIZ + 3D)</span>
                </button>

                {/* Secondary Direct Button: Jump Straight to 3D Action Arena */}
                {onQuickCombat && (
                  <button
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.playCombatAlarm();
                      onQuickCombat();
                    }}
                    className="w-full py-4 px-6 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-extrabold text-base sm:text-lg tracking-wide flex items-center justify-center gap-2.5 shadow-[0_0_25px_rgba(245,158,11,0.4)] active:scale-98 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Crosshair className="w-5 h-5 shrink-0" />
                    <span>INSTANT 3D BATTLE</span>
                  </button>
                )}
              </div>

              {/* CLASSIFIED SECRET SPY ATTACK DIRECT LAUNCH BANNER */}
              {secretLevel && (
                <div className="p-3.5 rounded-lg bg-purple-950/60 border border-purple-500/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(168,85,247,0.25)]">
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>🕵️ SECRET SPY ATTACK: SILENCED PISTOL &amp; BASE SABOTAGE</span>
                    </div>
                    <div className="text-sm sm:text-base font-display font-extrabold text-white truncate">
                      {secretLevel.title} — Assassinate Generals &amp; Sabotage Tanks/Bases!
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        sounds.unlockAudio();
                        sounds.playCombatAlarm();
                        onSelectLevel(secretLevel);
                        onStartGame();
                      }}
                      className="px-3.5 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-slate-950 font-display font-extrabold text-xs uppercase tracking-wider cursor-pointer transition-all shadow-[0_0_15px_rgba(168,85,247,0.5)] whitespace-nowrap"
                    >
                      Play Spy Mission
                    </button>
                    {onQuickCombat && (
                      <button
                        onClick={() => {
                          sounds.unlockAudio();
                          sounds.playCombatAlarm();
                          onSelectLevel(secretLevel);
                          onQuickCombat();
                        }}
                        className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs uppercase tracking-wider cursor-pointer transition-all shadow-[0_0_15px_rgba(16,185,129,0.45)] whitespace-nowrap"
                      >
                        Instant 3D Spy Attack
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Utility Buttons Row (Leaderboard, Weapons, Study Guide, Sound) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-1">
                <button
                  onClick={() => {
                    sounds.unlockAudio();
                    sounds.playRadioChirp();
                    onOpenLeaderboard();
                  }}
                  className="py-2.5 px-3 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/70 text-xs sm:text-sm font-display font-bold text-amber-300 flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                >
                  <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Leaderboard</span>
                </button>

                <button
                  onClick={() => {
                    sounds.unlockAudio();
                    sounds.playRadioChirp();
                    onOpenArmory();
                  }}
                  className="py-2.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs sm:text-sm font-display font-bold text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Weapons</span>
                </button>

                <button
                  onClick={() => {
                    sounds.unlockAudio();
                    sounds.playRadioChirp();
                    onOpenIntelGuide();
                  }}
                  className="py-2.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs sm:text-sm font-display font-bold text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <BookOpen className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Study Guide</span>
                </button>

                <button
                  onClick={() => {
                    sounds.unlockAudio();
                    onToggleSound();
                  }}
                  className="py-2.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs sm:text-sm font-display font-bold text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span>{soundEnabled ? 'Sound: ON' : 'Sound: OFF'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (5 cols): Clear, Simple Mission Selector */}
          <div className="lg:col-span-5 bg-slate-950/90 border border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-base sm:text-lg font-display font-bold text-white">
                  1. Choose Your Science Topic
                </h2>
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  {filteredLevels.length} Missions
                </span>
              </div>

              {/* Interactive Stage Filter Tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg mb-4">
                {(['ALL', 'Stage 7', 'Stage 8', 'SECRET'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      sounds.unlockAudio();
                      sounds.playRadioChirp();
                      setStageFilter(tab);
                    }}
                    className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-display font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      stageFilter === tab
                        ? tab === 'SECRET'
                          ? 'bg-purple-500 text-slate-950 shadow-xs'
                          : 'bg-cyan-500 text-slate-950 shadow-xs'
                        : tab === 'SECRET'
                        ? 'text-purple-300 hover:text-purple-200'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {tab === 'ALL' ? 'All Topics' : tab === 'SECRET' ? '★ Secret Op' : tab}
                  </button>
                ))}
              </div>

              {/* Clean, High-Contrast Mission List (All topics unlocked for students!) */}
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {filteredLevels.map((lvl) => {
                  const isSelected = lvl.id === selectedLevel.id;
                  const stars = playerStats.starsEarned[lvl.id] || 0;
                  const highScore = playerStats.highScores[lvl.id] || 0;

                  return (
                    <button
                      key={lvl.id}
                      onClick={() => {
                        sounds.unlockAudio();
                        sounds.playRadioChirp();
                        onSelectLevel(lvl);
                      }}
                      className={`w-full p-3.5 rounded-lg border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? lvl.isSecret
                            ? 'bg-purple-950/80 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.35)]'
                            : 'bg-cyan-950/70 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                          : lvl.isSecret
                          ? 'bg-purple-950/30 border-purple-800/80 hover:border-purple-500'
                          : 'bg-slate-900/90 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                          <span className={lvl.isSecret ? 'text-purple-300 font-bold' : 'text-cyan-400 font-bold'}>
                            {lvl.isSecret ? '★ CLASSIFIED SECRET' : lvl.stage}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{lvl.topic}</span>
                        </div>
                        <div className="text-sm sm:text-base font-display font-bold text-white mt-0.5 truncate">
                          {lvl.title}
                        </div>
                        {highScore > 0 && (
                          <div className="text-xs font-mono text-amber-400 mt-0.5 tabular-nums">
                            Best Score: {highScore}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <div className="flex items-center space-x-0.5">
                          {[1, 2, 3].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= stars ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 text-xs font-display font-bold text-cyan-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>SELECTED</span>
                          </span>
                        ) : (
                          <span className="text-xs font-mono text-slate-400">Select</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between tabular-nums">
              <span>Total Pathogens Defeated: <strong className="text-white">{playerStats.totalKills}</strong></span>
              <span>Press <strong className="text-emerald-400">ENTER</strong> to Start</span>
            </div>
          </div>
        </div>

        {/* SIMPLE 3-STEP STUDENT GUIDE STRIP */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 sm:p-5">
          <div>
            <div className="text-xs font-mono text-cyan-400 font-bold">STEP 1 · PICK A TOPIC</div>
            <div className="text-sm text-slate-200 mt-1">
              Select any Stage 7 or Stage 8 Science topic from the mission list on the right.
            </div>
          </div>
          <div>
            <div className="text-xs font-mono text-emerald-400 font-bold">STEP 2 · CLICK PLAY</div>
            <div className="text-sm text-slate-200 mt-1">
              Click <strong>Play Mission</strong> to answer 3 science questions, or click <strong>Instant 3D Battle</strong> to jump straight into combat.
            </div>
          </div>
          <div>
            <div className="text-xs font-mono text-amber-400 font-bold">STEP 3 · CLEAR TACTICAL CONTROLS</div>
            <div className="text-sm text-slate-200 mt-1">
              <strong>Walk:</strong> WASD / Arrows · <strong>Aim:</strong> Mouse / Touch · <strong>Sight Scope:</strong> Right-Click or [F] · <strong>Shoot:</strong> Left-Click / Space · <strong>Swap Gun:</strong> [Q].
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
