import React, { useState, useEffect, useRef } from 'react';
import {
  ArenaPlayer,
  MultiplayerRoom,
  createMultiplayerRoom,
  joinMultiplayerRoom,
  listActiveRooms,
  subscribeToMultiplayerRoom,
  startMultiplayerMatch,
  submitPlayerAnswer,
  advanceToCombatWave,
  updatePlayerCombatStats,
  advanceNextRoundOrPodium,
  leaveMultiplayerRoom,
} from '../services/multiplayerService';
import { sounds } from '../services/soundEffects';
import {
  Users,
  Swords,
  Trophy,
  X,
  Play,
  Copy,
  Check,
  Sparkles,
  Zap,
  Bomb,
  Plane,
  Heart,
  Crown,
  Medal,
  Timer,
  Crosshair,
  Volume2,
  VolumeX,
  Shield,
  ArrowRight,
  Flame,
  Radio,
} from 'lucide-react';
import { recordScoreToLeaderboard } from '../services/storage';

interface MultiplayerArenaModalProps {
  isOpen: boolean;
  studentName: string;
  className: string;
  onClose: () => void;
}

export const MultiplayerArenaModal: React.FC<MultiplayerArenaModalProps> = ({
  isOpen,
  studentName,
  className,
  onClose,
}) => {
  // Navigation / Tab state in lobby
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [selectedStage, setSelectedStage] = useState<'Grade 5' | 'Stage 7' | 'Stage 8'>('Stage 7');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [activeRoomsList, setActiveRoomsList] = useState<MultiplayerRoom[]>([]);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Room state
  const [currentRoom, setCurrentRoom] = useState<MultiplayerRoom | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<ArenaPlayer[]>([]);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // In-Game match state
  const [quizTimer, setQuizTimer] = useState<number>(15);
  const [combatTimer, setCombatTimer] = useState<number>(35);
  const [hasAnsweredThisRound, setHasAnsweredThisRound] = useState<boolean>(false);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [wasAnswerCorrect, setWasAnswerCorrect] = useState<boolean | null>(null);
  const [earnedBonus, setEarnedBonus] = useState<number>(0);
  const [attackBuffActive, setAttackBuffActive] = useState<boolean>(false);

  // Combat Simulation within Multiplayer Arena
  const [myCombatHp, setMyCombatHp] = useState<number>(100);
  const [myCombatKills, setMyCombatKills] = useState<number>(0);
  const [myCombatScore, setMyCombatScore] = useState<number>(0);
  const [grenadeCount, setGrenadeCount] = useState<number>(3);
  const [airdropReady, setAirdropReady] = useState<boolean>(true);
  const [combatWaveEnemies, setCombatWaveEnemies] = useState<
    { id: number; name: string; hp: number; maxHp: number; x: number; y: number }[]
  >([]);

  // Load public active rooms list on open
  useEffect(() => {
    if (!isOpen) return;
    listActiveRooms().then((rooms) => setActiveRoomsList(rooms));
  }, [isOpen]);

  // Subscribe to real-time room updates when in room
  useEffect(() => {
    if (!currentRoom?.id) return;
    const unsub = subscribeToMultiplayerRoom(
      currentRoom.id,
      (updatedRoom) => {
        if (!updatedRoom) {
          // Room was closed
          setCurrentRoom(null);
          setMyPlayerId(null);
          return;
        }
        setCurrentRoom(updatedRoom);
      },
      (players) => {
        setRoomPlayers(players);
      }
    );
    return () => unsub();
  }, [currentRoom?.id]);

  // Handle Quiz Freeze Timer & Phase Transition
  useEffect(() => {
    if (!currentRoom || currentRoom.status !== 'quiz') return;

    // Reset local answer state on new round
    setHasAnsweredThisRound(false);
    setSelectedAnswerIndex(null);
    setWasAnswerCorrect(null);
    setQuizTimer(15);
    sounds.playCombatAlarm();

    const timer = setInterval(() => {
      setQuizTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Only host triggers room transition to combat
          if (currentRoom.hostId === myPlayerId) {
            advanceToCombatWave(currentRoom.id);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentRoom?.status, currentRoom?.currentRound, currentRoom?.hostId, myPlayerId]);

  // Spawn Combat Enemies when combat wave begins
  useEffect(() => {
    if (!currentRoom || currentRoom.status !== 'combat') return;

    setCombatTimer(35);
    sounds.playAirdropPlane();

    // Spawn 8 pathogens in the arena
    const spawned = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      name: i % 2 === 0 ? 'Streptococcus' : 'Bacteriophage',
      hp: 100,
      maxHp: 100,
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 50,
    }));
    setCombatWaveEnemies(spawned);

    const timer = setInterval(() => {
      setCombatTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Only host advances next round or triggers podium
          if (currentRoom.hostId === myPlayerId) {
            advanceNextRoundOrPodium(
              currentRoom.id,
              currentRoom.currentRound,
              currentRoom.totalRounds,
              currentRoom.stage
            );
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentRoom?.status, currentRoom?.currentRound, currentRoom?.hostId, myPlayerId]);

  // Save Top Score to Leaderboard on Podium
  useEffect(() => {
    if (!currentRoom || currentRoom.status !== 'podium') return;
    sounds.playVictory();

    // Record player's final arena score to school-wide cloud leaderboard
    if (myCombatScore > 0) {
      recordScoreToLeaderboard({
        studentName: studentName.trim() || 'Arena Fighter',
        className: className.trim() || 'Science Unit',
        levelTitle: `Arena Deathmatch: ${currentRoom.stage}`,
        stage: currentRoom.stage,
        score: myCombatScore,
        kills: myCombatKills,
        isVictory: true,
      });
    }
  }, [currentRoom?.status]);

  if (!isOpen) return null;

  const isHost = Boolean(currentRoom && myPlayerId && currentRoom.hostId === myPlayerId);

  // --- ACTIONS ---

  const handleCreateRoom = async () => {
    sounds.playRadioChirp();
    setIsJoining(true);
    setErrorMessage(null);
    try {
      const { roomId, playerId } = await createMultiplayerRoom(
        studentName || 'Student Host',
        className || 'Science Unit',
        selectedStage
      );
      setMyPlayerId(playerId);
      setCurrentRoom({
        id: roomId,
        roomCode: roomId.replace('room_', ''),
        hostId: playerId,
        hostName: studentName || 'Student Host',
        stage: selectedStage,
        status: 'lobby',
        currentRound: 1,
        totalRounds: 3,
        currentQuestionIndex: 0,
        questionStartTime: 0,
        combatStartTime: 0,
        lastUpdated: Date.now(),
      });
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to create room');
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinByCode = async (codeToJoin?: string) => {
    const code = (codeToJoin || joinCodeInput).trim().toUpperCase();
    if (!code) {
      setErrorMessage('Please enter a 4-letter room code.');
      return;
    }
    sounds.playRadioChirp();
    setIsJoining(true);
    setErrorMessage(null);
    try {
      const { roomId, playerId, room } = await joinMultiplayerRoom(
        code,
        studentName || 'Classmate',
        className || 'Science Unit'
      );
      setMyPlayerId(playerId);
      setCurrentRoom(room);
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to join room');
    } finally {
      setIsJoining(false);
    }
  };

  const handleStartGame = async () => {
    if (!currentRoom || !isHost) return;
    sounds.unlockAudio();
    sounds.playCombatAlarm();
    try {
      await startMultiplayerMatch(currentRoom.id, currentRoom.stage);
    } catch (e) {
      console.error('Start error:', e);
    }
  };

  const handleAnswerQuestion = async (index: number) => {
    if (hasAnsweredThisRound || !currentRoom?.activeQuestion || !myPlayerId) return;

    sounds.unlockAudio();
    const isCorrect = index === currentRoom.activeQuestion.correctIndex;
    setSelectedAnswerIndex(index);
    setHasAnsweredThisRound(true);
    setWasAnswerCorrect(isCorrect);

    if (isCorrect) {
      sounds.playQuizCorrect();
      setAttackBuffActive(true);
      setMyCombatHp(150); // +50 overshield
    } else {
      sounds.playQuizWrong();
      setAttackBuffActive(false);
    }

    const timeTaken = 15 - quizTimer;
    const bonus = await submitPlayerAnswer(currentRoom.id, myPlayerId, index, isCorrect, timeTaken);
    setEarnedBonus(bonus);
    setMyCombatScore((prev) => prev + bonus);
  };

  const handleShootEnemy = async (enemyId: number) => {
    sounds.unlockAudio();
    sounds.playShoot('SHOTGUN');

    const dmg = attackBuffActive ? 60 : 40;
    setCombatWaveEnemies((prev) =>
      prev
        .map((e) => {
          if (e.id === enemyId) {
            const nextHp = e.hp - dmg;
            return { ...e, hp: nextHp };
          }
          return e;
        })
        .filter((e) => {
          if (e.hp <= 0) {
            sounds.playExplosion();
            const earnedPts = 120;
            setMyCombatKills((k) => k + 1);
            setMyCombatScore((s) => s + earnedPts);
            if (currentRoom && myPlayerId) {
              updatePlayerCombatStats(currentRoom.id, myPlayerId, 1, earnedPts, myCombatHp);
            }
            return false;
          }
          return true;
        })
    );
  };

  const handleThrowFrag = () => {
    if (grenadeCount <= 0) return;
    sounds.unlockAudio();
    sounds.playExplosion();
    setGrenadeCount((c) => c - 1);

    // Obliterate all low HP enemies
    const killsEarned = combatWaveEnemies.length;
    const earnedPts = killsEarned * 100;
    setMyCombatKills((k) => k + killsEarned);
    setMyCombatScore((s) => s + earnedPts);
    setCombatWaveEnemies([]);

    if (currentRoom && myPlayerId) {
      updatePlayerCombatStats(currentRoom.id, myPlayerId, killsEarned, earnedPts, myCombatHp);
    }
  };

  const handleCallAirdrop = () => {
    if (!airdropReady) return;
    sounds.unlockAudio();
    sounds.playAirdropPlane();
    setAirdropReady(false);
    setMyCombatHp(150);
    setMyCombatScore((s) => s + 250);
    setAttackBuffActive(true);
  };

  const handleLeaveMatch = async () => {
    sounds.playRadioChirp();
    if (currentRoom && myPlayerId) {
      await leaveMultiplayerRoom(currentRoom.id, myPlayerId);
    }
    setCurrentRoom(null);
    setMyPlayerId(null);
    setMyCombatKills(0);
    setMyCombatScore(0);
    onClose();
  };

  const handleCopyCode = async () => {
    if (!currentRoom) return;
    sounds.playRadioChirp();
    try {
      await navigator.clipboard.writeText(currentRoom.roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-950 border border-amber-500/80 rounded-2xl shadow-[0_0_60px_rgba(245,158,11,0.35)] flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)] shrink-0">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold tracking-widest text-amber-400 uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Classroom Arcade Arena · Live Multiplayer</span>
              </div>
              <h2 className="text-lg sm:text-2xl font-display font-extrabold text-white tracking-wide">
                Bio-Ops: Multiplayer Deathmatch
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentRoom && (
              <span className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-400 text-amber-300 font-mono text-xs font-bold">
                ROOM: {currentRoom.roomCode}
              </span>
            )}

            <button
              onClick={handleLeaveMatch}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Leave Room"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error Toast */}
        {errorMessage && (
          <div className="p-2.5 bg-rose-950 border-b border-rose-500 text-rose-200 text-xs font-mono flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-xs text-rose-400 hover:text-white">✕</button>
          </div>
        )}

        {/* -------------------- 1. LOBBY VIEW -------------------- */}
        {!currentRoom && (
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-6">
            {/* Tab Selector: Create or Join */}
            <div className="flex items-center justify-center gap-2 border-b border-slate-800 pb-4">
              <button
                onClick={() => {
                  sounds.playRadioChirp();
                  setActiveTab('create');
                }}
                className={`px-5 py-2.5 rounded-xl font-display font-bold text-sm transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'create'
                    ? 'bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Crown className="w-4 h-4" />
                <span>Host Arena Match</span>
              </button>
              <button
                onClick={() => {
                  sounds.playRadioChirp();
                  setActiveTab('join');
                }}
                className={`px-5 py-2.5 rounded-xl font-display font-bold text-sm transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'join'
                    ? 'bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Join by Room Code</span>
              </button>
            </div>

            {/* TAB: CREATE ROOM */}
            {activeTab === 'create' && (
              <div className="max-w-xl mx-auto space-y-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
                <div>
                  <label className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider block mb-2">
                    1. Select Science Curriculum Stage
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Grade 5', 'Stage 7', 'Stage 8'] as const).map((stage) => (
                      <button
                        key={stage}
                        onClick={() => setSelectedStage(stage)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer font-display font-bold text-xs sm:text-sm ${
                          selectedStage === stage
                            ? 'bg-amber-950/80 border-amber-400 text-amber-300 shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {stage}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 space-y-1">
                  <div className="text-cyan-400 font-bold">MATCH STRUCTURE (WAYGROUND ARCADE STYLE):</div>
                  <p>• 3 Rounds total · Science Quiz Freeze (15s) + 3D Battle Arena (35s)</p>
                  <p>• Correct science answers give speed points + Over-Shield + Attack Buffs</p>
                  <p>• Top 3 players crowned in the Victory Royale Podium!</p>
                </div>

                <button
                  onClick={handleCreateRoom}
                  disabled={isJoining}
                  className="w-full py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black text-base tracking-wide flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(245,158,11,0.45)] cursor-pointer transition-all"
                >
                  <Play className="w-5 h-5 fill-slate-950" />
                  <span>{isJoining ? 'CREATING ROOM...' : 'CREATE ARENA MATCH'}</span>
                </button>
              </div>
            )}

            {/* TAB: JOIN ROOM */}
            {activeTab === 'join' && (
              <div className="max-w-xl mx-auto space-y-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
                <div>
                  <label className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider block mb-2">
                    Enter 4-Letter Room Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                      placeholder="e.g. CELL"
                      className="flex-1 px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl font-display font-bold text-xl text-center tracking-widest text-white uppercase placeholder:text-slate-600 focus:outline-hidden focus:border-cyan-400"
                    />
                    <button
                      onClick={() => handleJoinByCode()}
                      disabled={isJoining}
                      className="px-6 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-sm tracking-wide shrink-0 cursor-pointer shadow-md"
                    >
                      {isJoining ? 'JOINING...' : 'JOIN MATCH'}
                    </button>
                  </div>
                </div>

                {/* Active Classroom Matches List */}
                <div className="pt-4 border-t border-slate-800">
                  <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Active Classroom Matches</span>
                    <button
                      onClick={() => listActiveRooms().then(setActiveRoomsList)}
                      className="text-cyan-400 hover:underline text-[10px]"
                    >
                      Refresh
                    </button>
                  </div>

                  {activeRoomsList.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs font-mono">
                      No active matches right now. Be the first to host one!
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeRoomsList.map((room) => (
                        <div
                          key={room.id}
                          className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                        >
                          <div>
                            <div className="font-display font-bold text-white text-sm flex items-center gap-2">
                              <span>Room Code: {room.roomCode}</span>
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                                {room.stage}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              Host: {room.hostName} · Status: {room.status.toUpperCase()}
                            </div>
                          </div>
                          <button
                            onClick={() => handleJoinByCode(room.roomCode)}
                            className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-400 text-cyan-300 font-mono text-xs font-bold cursor-pointer"
                          >
                            Join »
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------- 2. ROOM LOBBY ROSTER (WAITING FOR PLAYERS) -------------------- */}
        {currentRoom && currentRoom.status === 'lobby' && (
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-6">
            {/* Big Room Code Header */}
            <div className="text-center py-4 bg-slate-900/80 border border-amber-500/50 rounded-2xl space-y-2">
              <span className="text-xs font-mono text-amber-400 uppercase tracking-widest font-bold">
                ROOM CODE · SHARE WITH CLASSMATES
              </span>
              <div className="flex items-center justify-center gap-3">
                <span className="text-4xl sm:text-6xl font-display font-black tracking-widest text-amber-300">
                  {currentRoom.roomCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 cursor-pointer"
                  title="Copy Code"
                >
                  {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs font-mono text-slate-400">
                Curriculum Topic: <strong className="text-white">{currentRoom.stage}</strong> · 3 Rounds Deathmatch
              </p>
            </div>

            {/* Connected Classmates Roster */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                <span>CONNECTED OPERATIVES ({roomPlayers.length})</span>
                <span className="text-emerald-400">Live Firebase Sync Active</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {roomPlayers.map((player) => (
                  <div
                    key={player.playerId}
                    className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-display font-bold text-sm text-white truncate flex items-center gap-1.5">
                        <span>{player.studentName}</span>
                        {player.playerId === currentRoom.hostId && (
                          <span title="Host">
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-cyan-400 truncate">
                        {player.className}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/60 text-emerald-300 text-[10px] font-mono font-bold shrink-0">
                      READY
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Launch Game Button (Host Only) */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs font-mono text-slate-400 text-center sm:text-left">
                {isHost
                  ? 'As host, when everyone is in, click Start to begin Round 1 Quiz Freeze!'
                  : 'Waiting for host to start the match...'}
              </div>

              {isHost && (
                <button
                  onClick={handleStartGame}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black text-base tracking-wide flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(245,158,11,0.5)] cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-slate-950" />
                  <span>START MATCH NOW</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* -------------------- 3. QUIZ FREEZE PHASE (WAYGROUND ARCADE STYLE) -------------------- */}
        {currentRoom && currentRoom.status === 'quiz' && currentRoom.activeQuestion && (
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-5 bg-gradient-to-b from-indigo-950/40 via-slate-950 to-slate-950">
            {/* Freeze Alarm Header */}
            <div className="p-3 bg-amber-950/80 border border-amber-400/80 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                <span className="text-xs sm:text-sm font-mono font-black text-amber-300 tracking-wider uppercase">
                  ROUND {currentRoom.currentRound}/3 · SCIENCE QUIZ FREEZE — ALL OPERATIVES LOCKED!
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-black/60 border border-amber-400/60 text-amber-400 font-mono font-black text-sm tabular-nums">
                <Timer className="w-4 h-4" />
                <span>{quizTimer}S</span>
              </div>
            </div>

            {/* Question Card */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
              <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">
                TOPIC: {currentRoom.activeQuestion.topic} · {currentRoom.activeQuestion.cambridgeConcept}
              </div>
              <h3 className="text-base sm:text-xl font-display font-extrabold text-white leading-relaxed">
                {currentRoom.activeQuestion.question}
              </h3>
            </div>

            {/* Answer Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentRoom.activeQuestion.options.map((opt, idx) => {
                const isSelected = selectedAnswerIndex === idx;
                const isCorrect = idx === currentRoom.activeQuestion!.correctIndex;

                let btnStyle = 'bg-slate-900 border-slate-700 text-white hover:border-amber-400';
                if (hasAnsweredThisRound) {
                  if (isSelected && isCorrect) {
                    btnStyle = 'bg-emerald-950 border-emerald-400 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.5)]';
                  } else if (isSelected && !isCorrect) {
                    btnStyle = 'bg-rose-950 border-rose-500 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.5)]';
                  } else if (isCorrect) {
                    btnStyle = 'bg-emerald-950/60 border-emerald-500 text-emerald-300';
                  } else {
                    btnStyle = 'bg-slate-950 border-slate-800 text-slate-500 opacity-60';
                  }
                }

                return (
                  <button
                    key={opt}
                    onClick={() => handleAnswerQuestion(idx)}
                    disabled={hasAnsweredThisRound}
                    className={`p-4 rounded-xl border text-left font-display font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-3 ${btnStyle}`}
                  >
                    <span className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-xs shrink-0 font-mono">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>

            {/* Answer Feedback Banner */}
            {hasAnsweredThisRound && (
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono font-bold ${
                  wasAnswerCorrect
                    ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300'
                    : 'bg-rose-950/80 border-rose-500 text-rose-300'
                }`}
              >
                <span>
                  {wasAnswerCorrect
                    ? `✓ CORRECT! +${earnedBonus} COMBAT POINTS & ATTACK BUFF ACTIVATED (+50% DAMAGE)`
                    : '✗ INCORRECT! REBOOT DELAY PENALTY IN ARENA'}
                </span>
                <span>Unfreezing in {quizTimer}s...</span>
              </div>
            )}
          </div>
        )}

        {/* -------------------- 4. COMBAT WAVE ARENA (35s) -------------------- */}
        {currentRoom && currentRoom.status === 'combat' && (
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4 bg-slate-950">
            {/* Live Combat Top HUD */}
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded bg-rose-600 text-white font-mono text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-4 h-4" />
                  <span>ROUND {currentRoom.currentRound}/3 ARENA BATTLE</span>
                </span>
                <span className="text-xs font-mono text-cyan-300">
                  Defeat bacteria swarms to take #1 rank!
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-emerald-400 font-mono text-xs font-bold bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                  <span>{myCombatHp} HP</span>
                </div>
                <div className="flex items-center gap-1 text-amber-400 font-mono text-xs font-bold bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  <Timer className="w-3.5 h-3.5" />
                  <span>{combatTimer}S LEFT</span>
                </div>
              </div>
            </div>

            {/* Arena Main Battle Workspace: Live Enemies + Leaderboard Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Battle Arena Canvas Area (8 cols) */}
              <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 min-h-[300px] flex flex-col justify-between relative overflow-hidden">
                {/* Arena Targets Grid */}
                <div>
                  <div className="text-[11px] font-mono text-slate-400 mb-2 flex items-center justify-between">
                    <span>PATHOGEN TARGETS ({combatWaveEnemies.length} REMAINING)</span>
                    {attackBuffActive && (
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5" /> ATTACK BUFF ACTIVE (+50% DMG)
                      </span>
                    )}
                  </div>

                  {combatWaveEnemies.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                      <Trophy className="w-10 h-10 text-amber-400 mx-auto animate-bounce" />
                      <div className="text-base font-display font-bold text-white">
                        WAVE OBLITERATED! BONUS POINTS EARNED!
                      </div>
                      <p className="text-xs font-mono text-cyan-400">Next round starting soon...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {combatWaveEnemies.map((enemy) => (
                        <button
                          key={enemy.id}
                          onClick={() => handleShootEnemy(enemy.id)}
                          className="p-3 bg-slate-950 hover:bg-slate-800 border-2 border-rose-500/60 hover:border-amber-400 rounded-xl text-center transition-all cursor-crosshair flex flex-col items-center justify-between shadow-md active:scale-95"
                        >
                          <Crosshair className="w-6 h-6 text-rose-400 mb-1" />
                          <div className="font-display font-bold text-xs text-white truncate w-full">
                            {enemy.name}
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div
                              className="bg-rose-500 h-full"
                              style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-mono text-cyan-300 mt-1">CLICK TO SHOOT</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Combat Controls Bar */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleThrowFrag}
                      disabled={grenadeCount <= 0}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer ${
                        grenadeCount > 0
                          ? 'bg-amber-950 border border-amber-400 text-amber-300 hover:bg-amber-900'
                          : 'bg-slate-950 border border-slate-800 text-slate-600'
                      }`}
                    >
                      <Bomb className="w-3.5 h-3.5" />
                      <span>FRAG GRENADE ({grenadeCount})</span>
                    </button>

                    <button
                      onClick={handleCallAirdrop}
                      disabled={!airdropReady}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer ${
                        airdropReady
                          ? 'bg-cyan-950 border border-cyan-400 text-cyan-300 hover:bg-cyan-900'
                          : 'bg-slate-950 border border-slate-800 text-slate-600'
                      }`}
                    >
                      <Plane className="w-3.5 h-3.5" />
                      <span>{airdropReady ? 'AIR DROP' : 'AIR RECHARGING'}</span>
                    </button>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-display font-extrabold text-amber-400">
                      {myCombatScore.toLocaleString()} PTS
                    </div>
                    <div className="text-[10px] font-mono text-cyan-400">{myCombatKills} Kills</div>
                  </div>
                </div>
              </div>

              {/* Live Arena Scoreboard Sidebar (4 cols) */}
              <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-amber-400 font-bold mb-3 border-b border-slate-800 pb-2">
                    <span>LIVE MATCH RANKINGS</span>
                    <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                  </div>

                  <div className="space-y-2">
                    {roomPlayers.map((player, rankIdx) => {
                      const isMe = player.playerId === myPlayerId;
                      return (
                        <div
                          key={player.playerId}
                          className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                            rankIdx === 0
                              ? 'bg-amber-950/60 border-amber-400/80 shadow-xs'
                              : isMe
                              ? 'bg-cyan-950/50 border-cyan-400/80'
                              : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-display font-black text-xs text-amber-400">
                              #{rankIdx + 1}
                            </span>
                            <span className="font-display font-bold text-white truncate">
                              {player.studentName} {isMe && '(YOU)'}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-display font-black text-amber-300">
                              {player.score.toLocaleString()}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400 ml-1">PTS</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] font-mono text-slate-400 text-center">
                  Scores update synchronously across all devices
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- 5. PODIUM VICTORY ROYALE -------------------- */}
        {currentRoom && currentRoom.status === 'podium' && (
          <div className="p-6 flex-1 overflow-y-auto space-y-6 text-center bg-gradient-to-b from-amber-950/30 via-slate-950 to-slate-950">
            <div className="space-y-1">
              <span className="text-xs font-mono text-amber-400 font-bold uppercase tracking-widest">
                MULTIPLAYER MATCH COMPLETE
              </span>
              <h2 className="text-3xl sm:text-5xl font-display font-black text-white tracking-wide">
                VICTORY ROYALE PODIUM
              </h2>
            </div>

            {/* Top 3 Podium Boxes */}
            <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto items-end pt-4">
              {/* 2nd Place */}
              <div className="p-4 rounded-t-2xl bg-slate-900 border-t-2 border-x-2 border-slate-400 flex flex-col items-center">
                <Medal className="w-8 h-8 text-slate-300 mb-1" />
                <span className="text-xs font-mono text-slate-400">2ND PLACE</span>
                <div className="font-display font-bold text-sm text-white truncate max-w-full">
                  {roomPlayers[1]?.studentName || 'Silver'}
                </div>
                <div className="text-xs font-mono text-amber-400 font-bold mt-1">
                  {roomPlayers[1]?.score.toLocaleString() || 0} PTS
                </div>
              </div>

              {/* 1st Place (Champion) */}
              <div className="p-5 rounded-t-2xl bg-amber-950/80 border-t-4 border-x-2 border-amber-400 flex flex-col items-center shadow-[0_0_30px_rgba(245,158,11,0.4)]">
                <Crown className="w-10 h-10 text-amber-400 mb-1 animate-bounce" />
                <span className="text-xs font-mono text-amber-300 font-black">CHAMPION #1</span>
                <div className="font-display font-black text-base text-white truncate max-w-full">
                  {roomPlayers[0]?.studentName || 'Champion'}
                </div>
                <div className="text-sm font-mono text-amber-400 font-black mt-1">
                  {roomPlayers[0]?.score.toLocaleString() || 0} PTS
                </div>
              </div>

              {/* 3rd Place */}
              <div className="p-3 rounded-t-2xl bg-slate-900 border-t-2 border-x-2 border-amber-700 flex flex-col items-center">
                <Medal className="w-7 h-7 text-amber-700 mb-1" />
                <span className="text-xs font-mono text-slate-400">3RD PLACE</span>
                <div className="font-display font-bold text-xs text-white truncate max-w-full">
                  {roomPlayers[2]?.studentName || 'Bronze'}
                </div>
                <div className="text-xs font-mono text-amber-400 font-bold mt-1">
                  {roomPlayers[2]?.score.toLocaleString() || 0} PTS
                </div>
              </div>
            </div>

            <div className="p-4 max-w-md mx-auto rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-300">
              ✓ All scores have been automatically recorded to the classroom cloud leaderboard!
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleLeaveMatch}
                className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm cursor-pointer shadow-lg"
              >
                Return to Main Menu
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">● Wayground Arcade Real-Time Engine</span>
            <span aria-hidden="true">·</span>
            <span>Firebase Cloud Room</span>
          </div>

          <button
            onClick={handleLeaveMatch}
            className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
          >
            Leave Arena
          </button>
        </div>
      </div>
    </div>
  );
};
