import React, { useState } from 'react';
import { LeaderboardEntry } from '../types/game';
import { getBestScoresPerStudent } from '../services/storage';
import { sounds } from '../services/soundEffects';
import { Trophy, Medal, Search, X, RotateCcw, Sparkles, Cloud, Users, Award } from 'lucide-react';

interface LeaderboardModalProps {
  isOpen: boolean;
  entries: LeaderboardEntry[];
  currentStudentName?: string;
  isCloudLive?: boolean;
  onClose: () => void;
  onResetToDefaults?: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  entries,
  currentStudentName,
  isCloudLive = true,
  onClose,
  onResetToDefaults,
}) => {
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'BEST_PER_STUDENT' | 'ALL_ENTRIES'>('BEST_PER_STUDENT');

  if (!isOpen) return null;

  // Choose base list: personal best deduplicated vs all game sessions
  const baseEntries = viewMode === 'BEST_PER_STUDENT' ? getBestScoresPerStudent(entries) : entries;

  // Extract unique classes
  const classes = Array.from(
    new Set(entries.map((e) => e.className).filter((c) => Boolean(c && c.trim())))
  );

  const filtered = baseEntries.filter((entry) => {
    const matchesClass = filterClass === 'ALL' || entry.className === filterClass;
    const matchesSearch =
      searchQuery.trim() === '' ||
      entry.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.levelTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.className.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClass && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 select-none">
      <div className="relative w-full max-w-2xl bg-slate-950 border border-amber-500/80 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.25)] flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)] shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-mono font-bold tracking-widest text-amber-400 uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Classroom Defense Hall of Fame</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white tracking-wide">
                Student Leaderboard
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Cloud Status Badge */}
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono border ${
                isCloudLive
                  ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/50'
                  : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}
              title={isCloudLive ? 'Connected to free Firebase Firestore database' : 'Local storage cache active'}
            >
              <Cloud className="w-3 h-3 text-emerald-400" />
              <span>{isCloudLive ? 'Cloud Synced' : 'Local Cache'}</span>
            </div>

            <button
              onClick={() => {
                sounds.playRadioChirp();
                onClose();
              }}
              className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Mode Selector: Personal Best vs All Entries */}
        <div className="px-4 py-2.5 bg-slate-900/50 border-b border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              onClick={() => {
                sounds.playRadioChirp();
                setViewMode('BEST_PER_STUDENT');
              }}
              className={`px-3 py-1 rounded-md text-xs font-display font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'BEST_PER_STUDENT'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Personal Best (Top Scores)</span>
            </button>
            <button
              onClick={() => {
                sounds.playRadioChirp();
                setViewMode('ALL_ENTRIES');
              }}
              className={`px-3 py-1 rounded-md text-xs font-display font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'ALL_ENTRIES'
                  ? 'bg-cyan-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>All Match Logs ({entries.length})</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            {viewMode === 'BEST_PER_STUDENT' ? (
              <span className="text-amber-300 font-medium">Showing highest score per student</span>
            ) : (
              <span>All chronological game submissions</span>
            )}
          </div>
        </div>

        {/* Controls: Search & Class Filter */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/60 flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or class..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-400"
            />
          </div>

          {/* Class Filter Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto py-1">
            <button
              onClick={() => {
                sounds.playRadioChirp();
                setFilterClass('ALL');
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterClass === 'ALL'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              All Classes
            </button>
            {classes.map((cls) => (
              <button
                key={cls}
                onClick={() => {
                  sounds.playRadioChirp();
                  setFilterClass(cls);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                  filterClass === cls
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard Table / Cards */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-mono text-sm">
              No operative records found matching your filter.
            </div>
          ) : (
            filtered.map((item, index) => {
              const isTop1 = index === 0 && filterClass === 'ALL' && !searchQuery;
              const isTop2 = index === 1 && filterClass === 'ALL' && !searchQuery;
              const isTop3 = index === 2 && filterClass === 'ALL' && !searchQuery;
              const isCurrentStudent = Boolean(
                currentStudentName &&
                  item.studentName.toLowerCase() === currentStudentName.toLowerCase()
              );

              return (
                <div
                  key={item.id}
                  className={`p-3 sm:p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                    isTop1
                      ? 'bg-amber-950/40 border-amber-400/90 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                      : isTop2
                      ? 'bg-slate-800/60 border-slate-400/70'
                      : isTop3
                      ? 'bg-amber-950/20 border-amber-600/60'
                      : isCurrentStudent
                      ? 'bg-cyan-950/50 border-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  {/* Left: Rank # and Student Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 sm:w-8 h-7 sm:h-8 rounded-lg flex items-center justify-center font-display font-extrabold text-xs sm:text-sm shrink-0 ${
                        isTop1
                          ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_#f59e0b]'
                          : isTop2
                          ? 'bg-slate-300 text-slate-950'
                          : isTop3
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isTop1 ? (
                        <Medal className="w-4 h-4" />
                      ) : (
                        <span>#{index + 1}</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-sm sm:text-base text-white truncate">
                          {item.studentName}
                        </span>
                        {item.className && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-cyan-300 font-semibold">
                            {item.className}
                          </span>
                        )}
                        {isCurrentStudent && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400 text-[9px] font-mono text-cyan-200 font-bold">
                            YOU
                          </span>
                        )}
                        {viewMode === 'BEST_PER_STUDENT' && (
                          <span className="px-1 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-[8px] font-mono text-amber-400 uppercase">
                            Personal Best
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                        <span>{item.levelTitle}</span>
                        {item.date && (
                          <>
                            <span aria-hidden="true" className="mx-1.5">·</span>
                            <span className="text-slate-500">{item.date}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Score & Kills */}
                  <div className="text-right shrink-0">
                    <div className="text-base sm:text-lg font-display font-extrabold text-amber-400 tabular-nums">
                      {item.score.toLocaleString()} <span className="text-[10px] font-mono text-slate-400 font-normal">PTS</span>
                    </div>
                    <div className="text-[11px] font-mono text-cyan-400">
                      {item.kills} Pathogens Cleared
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Info */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span>Operatives Ranked: <strong className="text-white">{filtered.length}</strong></span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400">Free Firebase Cloud Sync Active</span>
          </div>

          {onResetToDefaults && (
            <button
              onClick={() => {
                if (window.confirm('Reset local leaderboard cache to default sample records?')) {
                  onResetToDefaults();
                }
              }}
              className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
              title="Reset records"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Cache</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
