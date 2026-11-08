import React, { useState } from 'react';
import { LeaderboardEntry } from '../types/game';
import { getBestScoresPerStudent, deleteLeaderboardEntry } from '../services/storage';
import { sounds } from '../services/soundEffects';
import {
  Trophy,
  Medal,
  Search,
  X,
  RotateCcw,
  Sparkles,
  Cloud,
  Users,
  Award,
  Trash2,
  ShieldAlert,
  ExternalLink,
  Check,
  Key,
} from 'lucide-react';

interface LeaderboardModalProps {
  isOpen: boolean;
  entries: LeaderboardEntry[];
  currentStudentName?: string;
  isCloudLive?: boolean;
  onClose: () => void;
  onResetToDefaults?: () => void;
  onEntryDeleted?: (id: string) => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  entries,
  currentStudentName,
  isCloudLive = true,
  onClose,
  onResetToDefaults,
  onEntryDeleted,
}) => {
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isTeacherMode, setIsTeacherMode] = useState<boolean>(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [showConsoleInfo, setShowConsoleInfo] = useState<boolean>(false);

  if (!isOpen) return null;

  // Deduplicate so each student appears once with their highest Personal Best score
  const baseEntries = getBestScoresPerStudent(entries);

  // Extract unique classes
  const classes = Array.from(
    new Set(baseEntries.map((e) => e.className).filter((c) => Boolean(c && c.trim())))
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

  const handleDeleteRecord = async (item: LeaderboardEntry) => {
    const confirmMsg = `Permanently delete "${item.studentName}" (${item.score.toLocaleString()} pts) from the classroom leaderboard?`;
    if (!window.confirm(confirmMsg)) return;

    sounds.playRadioChirp();
    setIsDeletingId(item.id);
    try {
      await deleteLeaderboardEntry(item.id, item.studentName);
      if (onEntryDeleted) {
        onEntryDeleted(item.id);
      }
      setFeedbackToast(`Removed "${item.studentName}" from leaderboard`);
      setTimeout(() => setFeedbackToast(null), 4000);
    } catch (e) {
      console.error('Delete error:', e);
      setFeedbackToast('Could not delete record');
      setTimeout(() => setFeedbackToast(null), 3000);
    } finally {
      setIsDeletingId(null);
    }
  };

  const firestoreConsoleUrl =
    'https://console.firebase.google.com/project/gen-lang-client-0745019009/firestore/databases/ai-studio-bioopscellularwa-a9127d13-5f40-43d5-84e1-e2f936ebaf37/data/~2Fleaderboard';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 select-none">
      <div className="relative w-full max-w-2xl bg-slate-950 border border-amber-500/80 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.25)] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)] shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold tracking-widest text-amber-400 uppercase flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                <span>Classroom Defense Hall of Fame</span>
              </div>
              <h2 className="text-lg sm:text-xl font-display font-extrabold text-white tracking-wide">
                Student Leaderboard
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Teacher Admin Mode Toggle */}
            <button
              onClick={() => {
                sounds.unlockAudio();
                sounds.playRadioChirp();
                setIsTeacherMode((prev) => !prev);
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                isTeacherMode
                  ? 'bg-rose-950/80 text-rose-300 border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-amber-400'
              }`}
              title="Teacher Mode lets you delete test scores or unwanted entries"
            >
              <Key className="w-3 h-3" />
              <span>{isTeacherMode ? 'Teacher Mode: ON' : 'Teacher Mode'}</span>
            </button>

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
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feedback Toast */}
        {feedbackToast && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/80 px-4 py-1.5 flex items-center justify-between text-xs font-mono text-emerald-200">
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              {feedbackToast}
            </span>
            <button
              onClick={() => setFeedbackToast(null)}
              className="text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Teacher Admin Instructions Banner */}
        {isTeacherMode && (
          <div className="p-3 bg-rose-950/40 border-b border-rose-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono text-rose-200">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>Teacher Mode Active:</strong> Click the red trash icon on any entry to permanently remove it from Firestore and local caches.
              </span>
            </div>
            <button
              onClick={() => setShowConsoleInfo((prev) => !prev)}
              className="text-amber-400 hover:text-amber-300 underline text-[11px] cursor-pointer whitespace-nowrap"
            >
              {showConsoleInfo ? 'Hide Console Link' : 'Open Firebase Console Link'}
            </button>
          </div>
        )}

        {/* Console URL Helper Box */}
        {showConsoleInfo && (
          <div className="p-3 bg-slate-900 border-b border-amber-500/40 text-xs font-mono text-slate-300 space-y-2">
            <div>
              <span className="text-amber-400 font-bold">Direct Firestore Database Link:</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                To edit scores or delete documents directly in Google Firebase Console:
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={firestoreConsoleUrl}
                className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[10px] text-cyan-300 select-all"
              />
              <a
                href={firestoreConsoleUrl}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 shrink-0"
              >
                <span>Console</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div className="px-4 py-1.5 bg-slate-900/50 border-b border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-display font-bold text-amber-300">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Personal Best Mode (1 Unique Record Per Student)</span>
          </div>
          <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{baseEntries.length} Unique Students Ranked</span>
          </div>
        </div>

        {/* Controls: Search & Class Filter */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/60 flex flex-col sm:flex-row gap-2.5 items-center justify-between">
          {/* Search Bar */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or class..."
              className="w-full pl-8 pr-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-400"
            />
          </div>

          {/* Class Filter Badges */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto py-0.5">
            <button
              onClick={() => {
                sounds.playRadioChirp();
                setFilterClass('ALL');
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
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
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
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
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
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
              const isDeletingThis = isDeletingId === item.id;

              return (
                <div
                  key={item.id}
                  className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
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
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-display font-extrabold text-xs shrink-0 ${
                        isTop1
                          ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_#f59e0b]'
                          : isTop2
                          ? 'bg-slate-300 text-slate-950'
                          : isTop3
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isTop1 ? <Medal className="w-3.5 h-3.5" /> : <span>#{index + 1}</span>}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-display font-bold text-xs sm:text-sm text-white truncate">
                          {item.studentName}
                        </span>
                        {item.className && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-[9px] font-mono text-cyan-300 font-semibold">
                            {item.className}
                          </span>
                        )}
                        {isCurrentStudent && (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 border border-cyan-400 text-[8px] font-mono text-cyan-200 font-bold">
                            YOU
                          </span>
                        )}
                        <span className="px-1 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-[8px] font-mono text-amber-400 uppercase">
                          PB
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        <span>{item.levelTitle}</span>
                        {item.date && (
                          <>
                            <span aria-hidden="true" className="mx-1">·</span>
                            <span className="text-slate-500">{item.date}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Score, Kills & Optional Delete Button */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <div className="text-sm sm:text-base font-display font-extrabold text-amber-400 tabular-nums">
                        {item.score.toLocaleString()}{' '}
                        <span className="text-[9px] font-mono text-slate-400 font-normal">PTS</span>
                      </div>
                      <div className="text-[10px] font-mono text-cyan-400">
                        {item.kills} Pathogens
                      </div>
                    </div>

                    {/* Trash Delete Button (Visible in Teacher Mode OR for current student removing their own score) */}
                    {(isTeacherMode || isCurrentStudent) && (
                      <button
                        onClick={() => handleDeleteRecord(item)}
                        disabled={isDeletingThis}
                        className={`p-1.5 rounded-lg border text-rose-400 hover:text-white transition-all cursor-pointer ${
                          isDeletingThis
                            ? 'bg-rose-900/50 border-rose-500 opacity-50 cursor-wait'
                            : 'bg-rose-950/60 border-rose-500/60 hover:bg-rose-600 hover:border-rose-400'
                        }`}
                        title={isTeacherMode ? 'Delete this record from leaderboard' : 'Remove your score from leaderboard'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Info */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Ranked: <strong className="text-white">{filtered.length}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400">Cloud Sync Active</span>
          </div>

          <div className="flex items-center gap-3">
            {onResetToDefaults && (
              <button
                onClick={() => {
                  if (window.confirm('Reset local leaderboard cache to default sample records?')) {
                    onResetToDefaults();
                  }
                }}
                className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
                title="Reset local records"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Cache</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
