import React, { useState } from 'react';
import { StudentProfile } from '../types/game';
import { sounds } from '../services/soundEffects';
import { Shield, User, GraduationCap, ArrowRight, Sparkles } from 'lucide-react';

interface StudentProfileModalProps {
  currentProfile: StudentProfile | null;
  isOpen: boolean;
  onSave: (profile: StudentProfile) => void;
  onClose?: () => void;
  allowCancel?: boolean;
}

const COMMON_CLASSES = [
  'Grade 7-A',
  'Grade 7-B',
  'Grade 8-A',
  'Grade 8-B',
  'Science Class 1',
  'Science Class 2',
  'Biology Lab A',
];

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  currentProfile,
  isOpen,
  onSave,
  onClose,
  allowCancel = false,
}) => {
  const [name, setName] = useState(currentProfile?.name || '');
  const [className, setClassName] = useState(currentProfile?.className || '');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanClass = className.trim();

    if (!cleanName) {
      setError('Please enter your name or student callsign.');
      return;
    }
    if (cleanName.length < 2) {
      setError('Name must be at least 2 characters long.');
      return;
    }

    sounds.unlockAudio();
    sounds.playRadioChirp();
    onSave({
      name: cleanName,
      className: cleanClass || 'Science Unit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-slate-950 border-2 border-cyan-500/80 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.35)] p-6 sm:p-7 text-left overflow-hidden">
        
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Header Icon + Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)] shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-mono font-bold tracking-widest text-cyan-400 uppercase">
              Student Operative Registration
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white tracking-wide">
              {currentProfile ? 'Update Student Callsign' : 'Enter Your Name & Class'}
            </h2>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 mb-5 leading-relaxed">
          Your name and class will appear on the <strong className="text-amber-400 font-bold">Classroom Leaderboard</strong> and your tactical combat debriefs!
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>Student Name / Callsign *</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Alex M. or BioWarrior-7"
              maxLength={24}
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-medium text-sm focus:outline-hidden focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 placeholder:text-slate-500"
            />
          </div>

          {/* Class Field */}
          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
              <span>Class / Grade / Section (Optional)</span>
            </label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. Grade 8-A, Period 3, etc."
              maxLength={20}
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-medium text-sm focus:outline-hidden focus:border-amber-400 focus:ring-1 focus:ring-amber-400 placeholder:text-slate-500"
            />

            {/* Quick Class Suggestion Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {COMMON_CLASSES.map((cls) => (
                <button
                  type="button"
                  key={cls}
                  onClick={() => setClassName(cls)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    className === cls
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  +{cls}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-xs font-mono text-red-400 bg-red-950/60 border border-red-500/60 p-2.5 rounded-lg">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2.5">
            {allowCancel && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-display font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-display font-extrabold text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
            >
              <span>CONFIRM &amp; ENTER ARENA</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1 text-cyan-300">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Classroom Mode Enabled</span>
          </span>
          <span>Stored on device &amp; scoreboard</span>
        </div>
      </div>
    </div>
  );
};
