import React from 'react';
import { LevelConfig } from '../types/game';
import { sounds } from '../services/soundEffects';
import { AlertOctagon, RotateCcw, BookOpen, Home } from 'lucide-react';

interface DefeatModalProps {
  level: LevelConfig;
  onRetry: () => void;
  onOpenIntelGuide: () => void;
  onMainMenu: () => void;
}

export const DefeatModal: React.FC<DefeatModalProps> = ({
  level,
  onRetry,
  onOpenIntelGuide,
  onMainMenu,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-md bg-slate-950 border border-red-600/80 rounded-lg shadow-[0_0_40px_rgba(239,68,68,0.3)] p-5 sm:p-7 text-center">
        
        {/* Defeat Icon */}
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-red-950/60 border-2 border-red-500 flex items-center justify-center text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]">
          <AlertOctagon className="w-8 h-8" />
        </div>

        <div className="text-xs font-mono uppercase tracking-widest text-red-400">
          OPERATIVE COMPROMISED
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-white uppercase tracking-wider mt-1">
          MEMBRANE BREACHED
        </h2>
        <div className="text-xs font-mono text-slate-400 mt-1">
          Pathogen infection overwhelmed host white blood cell defenses in {level.title}.
        </div>

        {/* Suggestion */}
        <div className="my-5 p-3 rounded bg-red-950/30 border border-red-900/50 text-xs font-mono text-red-300 text-left">
          <strong className="text-red-400 block mb-1">TACTICAL DIRECTIVE:</strong>
          Use your stimpack healing bursts (+40 HP) when taking heavy hits. Keep moving and eliminate close-range pathogens before they touch the cell wall!
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={() => {
              sounds.playCombatAlarm();
              onRetry();
            }}
            className="w-full py-2.5 rounded bg-red-600 hover:bg-red-500 text-white font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.5)] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RE-DEPLOY LEUKOCYTE</span>
          </button>
          
          <button
            onClick={() => {
              sounds.playRadioChirp();
              onOpenIntelGuide();
            }}
            className="w-full py-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-display text-cyan-400 uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>STUDY CAMBRIDGE INTEL DOSSIER</span>
          </button>

          <button
            onClick={() => {
              sounds.playRadioChirp();
              onMainMenu();
            }}
            className="w-full py-2 text-xs font-mono text-slate-500 hover:text-slate-300 uppercase tracking-wider cursor-pointer"
          >
            RETURN TO WAR ROOM
          </button>
        </div>
      </div>
    </div>
  );
};
