import React from 'react';
import { Weapon } from '../types/game';
import { INITIAL_WEAPONS } from '../data/curriculumData';
import { sounds } from '../services/soundEffects';
import { X, Shield, Zap, Target, Gauge } from 'lucide-react';

interface ArmoryModalProps {
  selectedWeaponId: string;
  onSelectWeapon: (weapon: Weapon) => void;
  onClose: () => void;
}

export const ArmoryModal: React.FC<ArmoryModalProps> = ({
  selectedWeaponId,
  onSelectWeapon,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-none flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-3xl bg-slate-950 border border-slate-700 rounded-lg shadow-2xl p-4 sm:p-6 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg sm:text-xl font-display font-bold text-white tracking-widest uppercase">
              LEUKOCYTE BIO-ARMORY
            </h2>
          </div>
          <button
            onClick={() => {
              sounds.playRadioChirp();
              onClose();
            }}
            className="p-1.5 rounded bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Weapons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4 overflow-y-auto pr-1">
          {INITIAL_WEAPONS.map((wpn) => {
            const isEquipped = wpn.id === selectedWeaponId;
            return (
              <div
                key={wpn.id}
                onClick={() => {
                  sounds.playShoot(wpn.category);
                  onSelectWeapon(wpn);
                }}
                className={`p-4 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                  isEquipped
                    ? 'bg-amber-950/30 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold tracking-wider" style={{ color: wpn.color }}>
                      ★ {wpn.rarity} {wpn.category}
                    </span>
                    {isEquipped && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-display font-bold bg-amber-500 text-black">
                        EQUIPPED
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-display font-bold text-white mt-1">
                    {wpn.name}
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-1 leading-relaxed">
                    {wpn.description}
                  </p>
                </div>

                {/* Stat Gauges */}
                <div className="mt-4 pt-3 border-t border-slate-800 space-y-2 text-xs font-mono">
                  <div>
                    <div className="flex justify-between text-slate-300 mb-0.5">
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3 text-red-400" /> DAMAGE
                      </span>
                      <span className="font-bold">{wpn.damage}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-red-500"
                        style={{ width: `${Math.min(100, (wpn.damage / 220) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-0.5">
                      <span className="flex items-center gap-1">
                        <Gauge className="w-3 h-3 text-cyan-400" /> FIRE RATE
                      </span>
                      <span className="font-bold">{Math.round(1000 / wpn.fireRate)} /sec</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-cyan-500"
                        style={{ width: `${Math.max(10, (1 - wpn.fireRate / 1500) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                    <span>MAG: <strong className="text-white">{wpn.magSize}</strong></span>
                    <span>RELOAD: <strong className="text-white">{(wpn.reloadTime / 1000).toFixed(1)}s</strong></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-3 flex justify-end">
          <button
            onClick={() => {
              sounds.playRadioChirp();
              onClose();
            }}
            className="px-5 py-2 rounded bg-amber-500 hover:bg-amber-400 text-black font-display font-bold text-xs uppercase tracking-wider"
          >
            CONFIRM LOADOUT
          </button>
        </div>
      </div>
    </div>
  );
};
