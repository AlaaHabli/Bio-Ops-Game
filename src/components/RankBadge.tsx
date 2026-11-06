import React from 'react';
import { calculatePlayerRank } from '../services/rankService';
import { Award, Shield, Star, ChevronUp } from 'lucide-react';

interface RankBadgeProps {
  xp: number;
  compact?: boolean;
}

export const RankBadge: React.FC<RankBadgeProps> = ({ xp, compact = false }) => {
  const { currentRank, nextRank, progressPercent } = calculatePlayerRank(xp);

  if (compact) {
    return (
      <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-black/60 border border-slate-700 text-xs font-mono">
        <Shield className="w-3.5 h-3.5" style={{ color: currentRank.color }} />
        <span className="font-bold" style={{ color: currentRank.color }}>
          {currentRank.code}
        </span>
        <span className="text-slate-400 text-[10px]">[{currentRank.title.split(' ')[0]}]</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3 bg-black/70 border border-slate-800 rounded-lg p-2.5 sm:p-3">
      {/* Insignia Shield */}
      <div
        className="w-12 h-12 rounded-lg flex flex-col items-center justify-center border-2 shrink-0 shadow-lg relative"
        style={{ borderColor: currentRank.color, backgroundColor: `${currentRank.color}15` }}
      >
        <Shield className="w-6 h-6" style={{ color: currentRank.color }} />
        <div className="flex items-center justify-center space-x-0.5 -mt-1">
          {Array.from({ length: currentRank.stars }).map((_, i) => (
            <Star key={i} className="w-2.5 h-2.5 fill-current" style={{ color: currentRank.color }} />
          ))}
        </div>
        <span className="absolute -bottom-1.5 text-[8px] font-mono font-bold bg-black px-1 rounded border border-slate-700 text-white">
          LVL {currentRank.level}
        </span>
      </div>

      {/* Info & Progress */}
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="font-bold tracking-wider" style={{ color: currentRank.color }}>
            {currentRank.title}
          </span>
          <span className="text-slate-400 text-[11px] tabular-nums">
            {xp} XP {nextRank ? `/ ${nextRank.minXp}` : '(MAX)'}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-slate-900 rounded-xs overflow-hidden mt-1.5 border border-slate-800">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progressPercent}%`, backgroundColor: currentRank.color }}
          />
        </div>

        {nextRank && (
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1">
            <span>NEXT: {nextRank.title}</span>
            <span>{nextRank.minXp - xp} XP NEEDED</span>
          </div>
        )}
      </div>
    </div>
  );
};
