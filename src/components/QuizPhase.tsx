import React, { useState, useEffect } from 'react';
import { LevelConfig, Question, Weapon } from '../types/game';
import { sounds } from '../services/soundEffects';
import { CheckCircle2, XCircle, Lightbulb, Zap, BookOpen, Home } from 'lucide-react';

interface QuizPhaseProps {
  level: LevelConfig;
  phaseNumber: number; // 1, 2, or 3
  activeWeapon: Weapon;
  soundEnabled: boolean;
  onThreeCorrectAchieved: () => void;
  onOpenArmory: () => void;
  onOpenIntelGuide: () => void;
  onBackToMenu?: () => void;
}

export const QuizPhase: React.FC<QuizPhaseProps> = ({
  level,
  phaseNumber,
  activeWeapon,
  soundEnabled,
  onThreeCorrectAchieved,
  onOpenArmory,
  onOpenIntelGuide,
  onBackToMenu,
}) => {
  // Phase 1: questions 0, 1, 2. Phase 2: questions 3, 4, 5. Phase 3: questions 6, 7, 8.
  const phaseStartIndex = (phaseNumber - 1) * 3;
  const phaseQuestions = level.questions.slice(phaseStartIndex, phaseStartIndex + 3);

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [correctCountInPhase, setCorrectCountInPhase] = useState<number>(0);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [phaseQuestionsAnswered, setPhaseQuestionsAnswered] = useState<boolean[]>([false, false, false]);

  const activeQuestion: Question = phaseQuestions[currentQuestionIdx] || phaseQuestions[0];

  const handleSelectOption = (idx: number) => {
    if (isAnswerSubmitted) return;
    setSelectedOption(idx);
    sounds.playRadioChirp();
  };

  const handleSubmitAnswer = () => {
    if (selectedOption === null || isAnswerSubmitted) return;

    setIsAnswerSubmitted(true);
    const correct = selectedOption === activeQuestion.correctIndex;
    setIsCorrect(correct);

    if (correct) {
      sounds.playQuizCorrect();
      const newCount = correctCountInPhase + 1;
      setCorrectCountInPhase(newCount);

      const updatedStatus = [...phaseQuestionsAnswered];
      updatedStatus[currentQuestionIdx] = true;
      setPhaseQuestionsAnswered(updatedStatus);

      // If user reached 3 correct answers in this phase, trigger countdown to deployment!
      if (newCount >= 3) {
        setTimeout(() => {
          onThreeCorrectAchieved();
        }, 1600);
      }
    } else {
      sounds.playQuizWrong();
    }
  };

  const handleNextQuestion = () => {
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setShowHint(false);

    // If still have questions in this phase, advance to next uncompleted or next question
    if (currentQuestionIdx < 2) {
      setCurrentQuestionIdx((prev) => prev + 1);
    } else {
      // Loop back to any question not yet correctly solved
      const firstUnsolved = phaseQuestionsAnswered.findIndex((solved) => !solved);
      if (firstUnsolved !== -1) {
        setCurrentQuestionIdx(firstUnsolved);
      } else {
        setCurrentQuestionIdx(0);
      }
    }
  };

  const handleRetryCurrent = () => {
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setShowHint(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onBackToMenu) {
        e.preventDefault();
        sounds.playRadioChirp();
        onBackToMenu();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBackToMenu]);

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-3 sm:p-6 bg-[#080a0f] overflow-y-auto">
      {/* Background Military Scanlines */}
      <div className="absolute inset-0 hud-scanlines pointer-events-none opacity-40" />
      <div className="absolute inset-0 hud-vignette pointer-events-none" />

      {/* HEADER: Bio-Ops Tactical Terminal Status */}
      <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-mono text-amber-400 uppercase tracking-widest">
              {level.stage === 'Grade 5' ? 'McGRAW HILL INSPIRE SCIENCE (GRADE 5)' : 'TACTICAL INTEL VERIFICATION (GRADE 7–8)'}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-display font-bold text-white tracking-wider uppercase mt-0.5">
            {level.title} — {level.codename}
          </h2>
          <div className="text-xs font-mono text-slate-400">
            CURRICULUM TOPIC: <span className="text-cyan-400 font-semibold">{level.topic} ({level.stage === 'Stage 7' ? 'Grade 7' : level.stage})</span>
          </div>
        </div>

        {/* Action Quicklinks: Back to Menu, Intel Archive & Armory */}
        <div className="flex items-center space-x-2">
          {onBackToMenu && (
            <button
              onClick={() => {
                sounds.playRadioChirp();
                onBackToMenu();
              }}
              className="px-3 py-1.5 rounded bg-rose-950/70 border border-rose-500/70 hover:bg-rose-900 text-xs font-display font-bold text-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Return to Main Menu [ESC]"
            >
              <Home className="w-3.5 h-3.5 text-rose-400" />
              <span>BACK [ESC]</span>
            </button>
          )}
          <button
            onClick={onOpenIntelGuide}
            className="px-3 py-1.5 rounded bg-slate-900 border border-slate-700 hover:border-cyan-500 text-xs font-display text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">STUDY</span> GUIDE
          </button>
          <button
            onClick={onOpenArmory}
            className="px-3 py-1.5 rounded bg-slate-900 border border-slate-700 hover:border-amber-500 text-xs font-display text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>ARMORY</span>
          </button>
        </div>
      </div>

      {/* PHASE PROGRESS INDICATOR (Every 3 correct answers launches FPS mode) */}
      <div className="relative z-10 w-full max-w-4xl mx-auto my-3 bg-black/60 border border-slate-800 p-3 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-display font-bold tracking-wider text-slate-300">
            PHASE {phaseNumber} OF 3: WEAPON AUTHORIZATION GAUGE
          </span>
          <span className="text-xs font-mono text-amber-400 font-bold">
            {correctCountInPhase} / 3 VERIFIED (3 NEEDED TO DEPLOY)
          </span>
        </div>

        {/* 3 Step Indicator Blocks */}
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((idx) => {
            const isFilled = idx < correctCountInPhase;
            return (
              <div
                key={idx}
                className={`h-2.5 rounded transition-all duration-300 ${
                  isFilled
                    ? 'bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                    : 'bg-slate-800 border border-slate-700'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* MAIN QUESTION TERMINAL CARD */}
      <div className="relative z-10 w-full max-w-4xl mx-auto bg-slate-950/90 border border-slate-800 rounded-lg p-4 sm:p-6 shadow-2xl flex-1 flex flex-col justify-between">
        <div>
          {/* Cambridge Objective Tag */}
          <div className="flex items-center justify-between mb-3 text-xs font-mono">
            <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300">
              QUESTION {currentQuestionIdx + 1} OF 3 (PHASE {phaseNumber})
            </span>
            <span className="text-slate-400 hidden sm:inline">
              {activeQuestion.cambridgeConcept}
            </span>
          </div>

          {/* Question Prompt */}
          <h3 className="text-base sm:text-xl font-display font-semibold text-slate-100 leading-relaxed mb-6">
            {activeQuestion.question}
          </h3>

          {/* Answer Option Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {activeQuestion.options.map((opt, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isSelected = selectedOption === idx;
              let btnStyle = 'border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300';

              if (isAnswerSubmitted) {
                if (idx === activeQuestion.correctIndex) {
                  btnStyle = 'border-emerald-500 bg-emerald-950/80 text-emerald-200 font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)]';
                } else if (isSelected) {
                  btnStyle = 'border-red-500 bg-red-950/80 text-red-200';
                } else {
                  btnStyle = 'border-slate-800 bg-slate-950/40 text-slate-600';
                }
              } else if (isSelected) {
                btnStyle = 'border-cyan-400 bg-cyan-950/80 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.3)]';
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  disabled={isAnswerSubmitted}
                  className={`flex items-start text-left p-3.5 rounded-md border text-sm sm:text-base font-tactical transition-all cursor-pointer ${btnStyle}`}
                >
                  <span className="w-6 h-6 rounded flex items-center justify-center bg-black/40 border border-slate-700 text-xs font-mono font-bold mr-3 shrink-0">
                    {letter}
                  </span>
                  <span className="leading-snug">{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Hint Drawer Toggle */}
          {activeQuestion.hint && !isAnswerSubmitted && (
            <div className="mt-2">
              <button
                onClick={() => setShowHint(!showHint)}
                className="text-xs font-mono text-cyan-400/90 hover:text-cyan-300 flex items-center gap-1.5 transition-colors"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                <span>{showHint ? 'HIDE TACTICAL HINT' : 'REQUEST TACTICAL HINT'}</span>
              </button>
              {showHint && (
                <div className="mt-2 p-2.5 rounded bg-cyan-950/30 border border-cyan-800/50 text-xs font-mono text-cyan-200">
                  {activeQuestion.hint}
                </div>
              )}
            </div>
          )}

          {/* Cambridge Syllabus Explanation / Feedback Banner on submit */}
          {isAnswerSubmitted && (
            <div
              className={`p-3.5 sm:p-4 rounded-md border mt-4 ${
                isCorrect
                  ? 'bg-emerald-950/40 border-emerald-600/70 text-emerald-200'
                  : 'bg-red-950/40 border-red-600/70 text-red-200'
              }`}
            >
              <div className="flex items-center space-x-2 font-display font-bold text-sm sm:text-base mb-1">
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-emerald-400">CREDENTIAL VERIFIED: WEAPON CAPACITORS CHARGING</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-400" />
                    <span className="text-red-400">INCORRECT ANALYSIS: RE-STUDY CHECKPOINT CONCEPT</span>
                  </>
                )}
              </div>
              <p className="text-xs sm:text-sm font-mono text-slate-300 leading-relaxed">
                {activeQuestion.explanation}
              </p>
            </div>
          )}
        </div>

        {/* BOTTOM TERMINAL CONTROLS */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
            <span>OPERATIVE WEAPON:</span>
            <span className="text-white font-bold">{activeWeapon.name}</span>
          </div>

          <div className="flex items-center space-x-3">
            {!isAnswerSubmitted ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={selectedOption === null}
                className={`px-6 py-2.5 rounded font-display font-bold text-sm tracking-wider uppercase transition-all ${
                  selectedOption !== null
                    ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.5)] active:scale-95 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                SUBMIT VERIFICATION
              </button>
            ) : correctCountInPhase >= 3 ? (
              <button
                onClick={onThreeCorrectAchieved}
                className="px-6 py-2.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-display font-bold text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(16,185,129,0.7)] animate-pulse active:scale-95 cursor-pointer"
              >
                {level.isSecret ? 'DEPLOY 3D SPY ATTACK' : 'DEPLOY FPS COMBAT (60s)'}
              </button>
            ) : isCorrect ? (
              <button
                onClick={handleNextQuestion}
                className="px-6 py-2.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-display font-bold text-sm tracking-wider uppercase shadow-[0_0_15px_rgba(6,182,212,0.4)] active:scale-95 cursor-pointer"
              >
                NEXT INTEL QUESTION ({correctCountInPhase}/3)
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRetryCurrent}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-display font-semibold text-xs tracking-wider uppercase active:scale-95 cursor-pointer"
                >
                  RETRY QUESTION
                </button>
                <button
                  onClick={handleNextQuestion}
                  className="px-5 py-2 rounded bg-amber-600 hover:bg-amber-500 text-black font-display font-bold text-xs tracking-wider uppercase active:scale-95 cursor-pointer"
                >
                  TRY NEXT QUESTION
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
