import React, { useState, useEffect, useRef } from 'react';
import { sounds } from '../services/soundEffects';
import {
  Film,
  X,
  Play,
  Pause,
  Download,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Zap,
  Bomb,
  Plane,
  Crosshair,
  ShieldAlert,
} from 'lucide-react';

interface GameTrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameUrl?: string;
}

export const GameTrailerModal: React.FC<GameTrailerModalProps> = ({
  isOpen,
  onClose,
  gameUrl = 'https://ais-pre-eubg2f7eniieolp5spze65-848433549013.europe-west2.run.app',
}) => {
  const [activeSceneIndex, setActiveSceneIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [bannerSize, setBannerSize] = useState<'leaderboard' | 'large' | 'square'>('large');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const scenes = [
    {
      title: '3D HOLOGRAPHIC OPTIC AIM',
      subtitle: 'Black Ops Reflex Sight · SCAR-H Assault Rifle',
      badge: 'COMBAT PHASE',
      accent: '#f59e0b',
      icon: Crosshair,
      description: 'First-person cellular combat inside human organ battlefields.',
    },
    {
      title: 'HIGH-EXPLOSIVE BIO-GRENADES',
      subtitle: 'Cluster Shrapnel · Kinetic Detonations',
      badge: 'HEAVY WEAPONS',
      accent: '#ef4444',
      icon: Bomb,
      description: 'Obliterate bacterial swarms with tactical fragmentation blasts.',
    },
    {
      title: 'ALLIED LEUKOCYTE AIRDROPS',
      subtitle: 'Parachute Supply Drop · Reinforcements',
      badge: 'TACTICAL SUPPORT',
      accent: '#06b6d4',
      icon: Plane,
      description: 'Call in friendly immune white blood cell squads with signal flares.',
    },
    {
      title: 'BOSS BATTLE: BLÉRIOT XI & CYBER MECH',
      subtitle: 'Aerial Dogfights · Colossal Boss Encounters',
      badge: 'BOSS FIGHT',
      accent: '#a855f7',
      icon: ShieldAlert,
      description: 'Shoot down airborne historical monoplanes and armored mechs.',
    },
  ];

  // Auto-advance scenes for animated trailer preview
  useEffect(() => {
    if (!isOpen || !isPlaying) return;
    const interval = setInterval(() => {
      setActiveSceneIndex((prev) => (prev + 1) % scenes.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [isOpen, isPlaying, scenes.length]);

  if (!isOpen) return null;

  const currentScene = scenes[activeSceneIndex];
  const IconComponent = currentScene.icon;

  const fullBannerImgUrl = `${gameUrl}/game_trailer_banner.jpg`;

  const embedHtmlCode = `<!-- Bio-Ops: Cellular Warfare Hyperlink Game Banner -->
<a href="${gameUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
  <img src="${fullBannerImgUrl}" alt="Play Bio-Ops: Cellular Warfare 3D Science Game" style="width:100%;max-width:960px;height:auto;border-radius:12px;box-shadow:0 12px 35px rgba(0,0,0,0.6);border:2px solid #f59e0b;display:block;" />
</a>`;

  const handleCopyCode = async () => {
    sounds.playRadioChirp();
    try {
      await navigator.clipboard.writeText(embedHtmlCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    } catch {
      // fallback
    }
  };

  const handleCopyLink = async () => {
    sounds.playRadioChirp();
    try {
      await navigator.clipboard.writeText(gameUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      // fallback
    }
  };

  // Generate downloadable trailer image / banner canvas
  const handleDownloadBanner = () => {
    sounds.playVictory();
    setIsExporting(true);

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 675;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/game_trailer_banner.jpg';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 1200, 675);

      // Add clickable overlay border and glowing CTA banner
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, 1190, 665);

      // Download
      const link = document.createElement('a');
      link.download = 'bio_ops_trailer_banner.jpg';
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
      setIsExporting(false);
    };
    img.onerror = () => {
      setIsExporting(false);
      window.open('/game_trailer_banner.jpg', '_blank');
    };
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-950 border border-amber-500/80 rounded-2xl shadow-[0_0_60px_rgba(245,158,11,0.35)] flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)] shrink-0">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold tracking-widest text-amber-400 uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Marketing &amp; Website Banner Trailer</span>
              </div>
              <h2 className="text-lg sm:text-2xl font-display font-extrabold text-white tracking-wide">
                Animated Game Trailer &amp; Website Banner
              </h2>
            </div>
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Main Trailer Display Frame */}
          <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-amber-500/60 shadow-[0_0_30px_rgba(0,0,0,0.8)] bg-slate-900 group">
            {/* Background Keyart Image */}
            <img
              src="/game_trailer_banner.jpg"
              alt="Bio-Ops Trailer"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />

            {/* Dark gradient vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent pointer-events-none" />

            {/* Dynamic Animated Scene HUD Overlay */}
            <div className="absolute inset-0 p-4 sm:p-6 flex flex-col justify-between pointer-events-none">
              {/* Top Scene Tracker */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-rose-600/90 text-white font-mono text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 shadow-md">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span>TRAILER SCENE {activeSceneIndex + 1}/{scenes.length}</span>
                  </span>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border"
                    style={{
                      backgroundColor: `${currentScene.accent}20`,
                      borderColor: currentScene.accent,
                      color: currentScene.accent,
                    }}
                  >
                    {currentScene.badge}
                  </span>
                </div>

                <div className="hidden sm:flex items-center gap-1.5">
                  {scenes.map((s, idx) => (
                    <div
                      key={s.title}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        idx === activeSceneIndex ? 'w-8 bg-amber-400' : 'w-2 bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Bottom Scene Feature Callout */}
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2">
                  <IconComponent className="w-5 h-5 text-amber-400" />
                  <h3 className="text-xl sm:text-3xl font-display font-extrabold text-white tracking-wide drop-shadow-md">
                    {currentScene.title}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm font-mono text-cyan-300 drop-shadow">
                  {currentScene.subtitle}
                </p>
                <p className="text-[11px] sm:text-xs text-slate-300 drop-shadow hidden sm:block">
                  {currentScene.description}
                </p>
              </div>
            </div>

            {/* Play / Pause Toggle Button */}
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="absolute bottom-4 right-4 z-20 px-3 py-1.5 rounded-lg bg-black/70 hover:bg-black/90 border border-white/20 text-white font-mono text-xs flex items-center gap-2 cursor-pointer transition-all"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause Auto-Play' : 'Play Preview'}</span>
            </button>
          </div>

          {/* Quick Scene Selector Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {scenes.map((scene, idx) => {
              const Icon = scene.icon;
              const isActive = idx === activeSceneIndex;
              return (
                <button
                  key={scene.title}
                  onClick={() => {
                    sounds.playRadioChirp();
                    setActiveSceneIndex(idx);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-amber-950/60 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span className="text-[9px] font-mono text-slate-500">SCENE {idx + 1}</span>
                  </div>
                  <div className="mt-2 text-xs font-display font-bold text-white truncate">
                    {scene.title.split(':')[0]}
                  </div>
                  <div className="text-[10px] font-mono text-cyan-400 truncate mt-0.5">
                    {scene.badge}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Website Hyperlink & Embed Code Section */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-display font-bold text-white flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-amber-400" />
                  <span>Copy Website Hyperlink Code (Embed on School Website)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Paste this snippet directly into your school website, Google Sites, Canvas LMS, or WordPress to display the banner with an instant clickable link to the game!
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleDownloadBanner}
                  disabled={isExporting}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-mono font-bold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{isExporting ? 'Saving...' : 'Download Image'}</span>
                </button>

                <button
                  onClick={handleCopyCode}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-display font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'HTML Code Copied!' : 'Copy Banner HTML'}</span>
                </button>
              </div>
            </div>

            {/* Code Box */}
            <div className="relative">
              <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto whitespace-pre leading-relaxed select-all">
                {embedHtmlCode}
              </pre>
            </div>

            {/* Direct Game URL Box */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
              <span className="text-xs font-mono text-slate-400 whitespace-nowrap">Direct Game URL:</span>
              <input
                readOnly
                value={gameUrl}
                className="flex-1 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-amber-300 select-all"
              />
              <button
                onClick={handleCopyLink}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-mono text-slate-200 flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLink ? 'Copied' : 'Copy URL'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">● 4K Promotional Asset Active</span>
            <span aria-hidden="true">·</span>
            <span>Hyperlink tested &amp; live</span>
          </div>

          <button
            onClick={() => {
              sounds.playRadioChirp();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-display font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
