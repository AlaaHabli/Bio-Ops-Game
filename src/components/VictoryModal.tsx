import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { LevelConfig } from '../types/game';
import { sounds } from '../services/soundEffects';
import { Award, Star, CheckCircle, ChevronRight, RotateCcw } from 'lucide-react';

interface VictoryModalProps {
  level: LevelConfig;
  score: number;
  kills: number;
  stars: number;
  onNextLevel: () => void;
  onReplay: () => void;
  onMainMenu: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  level,
  score,
  kills,
  stars,
  onNextLevel,
  onReplay,
  onMainMenu,
}) => {
  useEffect(() => {
    sounds.playVictory();
    // Confetti blast
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#06b6d4', '#10b981'],
      });
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-lg bg-slate-950 border border-amber-500/80 rounded-lg shadow-[0_0_40px_rgba(245,158,11,0.25)] p-5 sm:p-7 text-center">
        
        {/* Victory Badge */}
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-500/10 border-2 border-amber-400 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]">
          <Award className="w-8 h-8" />
        </div>

        <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
          INFECTION ERADICATED • HOST ORGAN SECURED
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-white uppercase tracking-wider mt-1">
          MISSION ACCOMPLISHED
        </h2>
        <div className="text-xs font-mono text-slate-400 mt-1">
          {level.title} — {level.codename}
        </div>

        {/* Stars */}
        <div className="flex justify-center items-center space-x-2 my-4">
          {[1, 2, 3].map((s) => (
            <Star
              key={s}
              className={`w-8 h-8 ${
                s <= stars
                  ? 'text-amber-400 fill-amber-400 filter drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                  : 'text-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 my-5 text-left">
          <div className="p-3 rounded bg-slate-900 border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 uppercase block">SCORE</span>
            <span className="text-lg font-display font-bold text-amber-400 tabular-nums">
              {score}
            </span>
          </div>
          <div className="p-3 rounded bg-slate-900 border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 uppercase block">KILLS</span>
            <span className="text-lg font-display font-bold text-cyan-400 tabular-nums">
              {kills}
            </span>
          </div>
          <div className="p-3 rounded bg-slate-900 border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 uppercase block">CHECKPOINT</span>
            <span className="text-lg font-display font-bold text-emerald-400">
              9/9 PASSED
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={onReplay}
            className="w-full sm:w-auto px-4 py-2.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-display text-slate-300 uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>REPLAY OPERATION</span>
          </button>
          <button
            onClick={onNextLevel}
            className="w-full sm:w-auto px-6 py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.5)] active:scale-95 cursor-pointer"
          >
            <span>NEXT OPERATION</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
