import React from 'react';
import { LevelConfig, Weapon } from '../types/game';
import { sounds } from '../services/soundEffects';
import { Target, Shield, AlertTriangle, Play, ChevronRight, X } from 'lucide-react';

interface MissionBriefingModalProps {
  level: LevelConfig;
  activeWeapon: Weapon;
  onDeploy: () => void;
  onCancel: () => void;
}

export const MissionBriefingModal: React.FC<MissionBriefingModalProps> = ({
  level,
  activeWeapon,
  onDeploy,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-2xl bg-slate-950 border border-slate-700 rounded-lg shadow-2xl p-5 sm:p-7 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-mono uppercase tracking-widest text-red-400">
              OPERATION ORDER BRIEFING
            </span>
          </div>
          <button
            onClick={() => {
              sounds.playRadioChirp();
              onCancel();
            }}
            className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="my-4 space-y-4 text-left">
          <div>
            <div className="text-xs font-mono text-cyan-400">
              SECTOR: {level.organSector.toUpperCase()} • {level.stage}
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-white uppercase tracking-wider mt-0.5">
              {level.title}
            </h2>
            <div className="text-xs font-mono text-amber-400 font-semibold mt-0.5">
              CODENAME: {level.codename}
            </div>
          </div>

          {/* Narrative Brief */}
          <div className="p-3.5 rounded bg-slate-900/80 border border-slate-800 text-xs sm:text-sm font-tactical text-slate-300 leading-relaxed">
            {level.briefing}
          </div>

          {/* Tactical Mission Protocol */}
          <div className="p-3.5 rounded bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
            <div className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              ENGAGEMENT RULES (3-PHASE COMBAT PROTOCOL):
            </div>
            <div className="flex items-start space-x-2 text-slate-300">
              <span className="text-amber-400 font-bold">1.</span>
              <span>Answer <strong>3 Cambridge questions correctly</strong> in each phase to unlock the weapon firing capacitor.</span>
            </div>
            <div className="flex items-start space-x-2 text-slate-300">
              <span className="text-cyan-400 font-bold">2.</span>
              <span>Engage in <strong>60 seconds of First-Person Shooter combat</strong> defending the bloodstream from invading pathogens.</span>
            </div>
            <div className="flex items-start space-x-2 text-slate-300">
              <span className="text-emerald-400 font-bold">3.</span>
              <span>Complete all 3 phases (9 questions & 3 combat waves) to eradicate the infection and liberate the organ sector!</span>
            </div>
          </div>

          {/* Threat Intelligence */}
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded bg-red-950/30 border border-red-900/60">
              <span className="text-red-400 block font-bold">PRIMARY TARGET:</span>
              <span className="text-slate-200">{level.targetPathogen}</span>
            </div>
            <div className="p-2.5 rounded bg-cyan-950/30 border border-cyan-900/60">
              <span className="text-cyan-400 block font-bold">EQUIPPED WEAPON:</span>
              <span className="text-slate-200">{activeWeapon.name}</span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
          <button
            onClick={() => {
              sounds.playRadioChirp();
              onCancel();
            }}
            className="px-4 py-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-display text-slate-300 uppercase tracking-wider cursor-pointer"
          >
            ABORT MISSION
          </button>
          <button
            onClick={() => {
              sounds.playCombatAlarm();
              onDeploy();
            }}
            className="px-6 py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-display font-bold text-sm tracking-wider uppercase flex items-center space-x-2 shadow-[0_0_20px_rgba(245,158,11,0.5)] active:scale-95 cursor-pointer"
          >
            <span>COMMENCE OPERATION</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
