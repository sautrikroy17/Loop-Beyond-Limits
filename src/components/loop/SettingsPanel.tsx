import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Sliders, Zap, Lightbulb, Moon, Volume2, Infinity, Mic2, Eye, Sparkles, MonitorPlay, Activity, Clock, RefreshCw
} from 'lucide-react';
import { useSettings, PremiumMode } from '@/hooks/useSettings';
import { useListeningIntelligence } from '@/hooks/useListeningIntelligence';

const PREMIUM_MODES: { id: PremiumMode; label: string; sub: string; icon: React.ReactNode; color: string }[] = [
  { id: 'none', label: 'Classic', sub: 'Standard Loop UI', icon: <MonitorPlay />, color: 'oklch(0.5 0 0)' },
  { id: 'aura', label: 'Aura Mode', sub: 'UI adapts to album art', icon: <Sparkles />, color: 'oklch(0.7 0.2 150)' },
  { id: 'night-drive', label: 'Night Drive', sub: 'Deep indigo & slow sweeping motion', icon: <Moon />, color: 'oklch(0.60 0.28 285)' },
  { id: 'club-neon', label: 'Club Neon', sub: 'High contrast fast physics', icon: <Zap />, color: 'oklch(0.85 0.35 320)' },
  { id: 'dreamscape', label: 'Dreamscape', sub: 'Soft pastel washes & high blur', icon: <Sparkles />, color: 'oklch(0.80 0.12 300)' },
  { id: 'cinema-atmos', label: 'Cinema Atmos', sub: 'Ultra-dark minimal breath', icon: <Eye />, color: 'oklch(0.85 0.05 260)' },
  { id: 'midnight', label: 'Midnight', sub: 'Cinematic deep dark', icon: <Moon />, color: 'oklch(0.3 0.1 260)' },
  { id: 'focus', label: 'Focus Mode', sub: 'Zero distractions', icon: <Eye />, color: 'oklch(0.8 0.05 200)' },
  { id: 'party', label: 'Party Mode', sub: 'Max neon visuals', icon: <Zap />, color: 'oklch(0.85 0.34 290)' },
];

const SLEEP_TIMER_OPTIONS = [
  { id: 0,  label: 'Off' },
  { id: 15, label: '15m' },
  { id: 30, label: '30m' },
  { id: 45, label: '45m' },
  { id: 60, label: '1h' },
  { id: 90, label: '1.5h' },
];

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="text-white/35">{icon}</span>
      <span className="text-[10px] font-bold uppercase tracking-[0.38em] text-white/40">{title}</span>
    </div>
  );
}

function Toggle({ label, sub, checked, onToggle }: {
  label: string; sub?: string; checked: boolean; onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between py-3">
      <div>
        <div className="text-[13px] font-medium text-white/90">{label}</div>
        {sub && <div className="mt-0.5 text-[10px] text-white/40">{sub}</div>}
      </div>
      <button
        onClick={onToggle}
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ background: checked ? 'oklch(0.72 0.26 248)' : 'oklch(0.18 0.02 260)' }}
      >
        <motion.div
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md"
          animate={{ x: checked ? 20 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}

export function SettingsPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const s = useSettings();
  const identity = useListeningIntelligence(state => state.getTasteIdentity());

  // Prevent background scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [isOpen]);

  const timeRemainingMs = s.sleepTimerTarget ? Math.max(0, s.sleepTimerTarget - Date.now()) : 0;
  const timeRemainingStr = timeRemainingMs > 0 
    ? `${Math.ceil(timeRemainingMs / 60000)}m left`
    : '';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center sm:justify-end sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative flex h-full w-full flex-col overflow-hidden bg-[oklch(0.08_0.02_260)] sm:h-auto sm:max-h-[85vh] sm:w-[480px] sm:rounded-3xl border border-white/5 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.04] p-6 pb-5">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight text-white flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-[oklch(0.72_0.26_248)]" />
                  Loop Control Center
                </h2>
                <div className="mt-1 text-[11px] font-medium text-white/35 uppercase tracking-widest">
                  Live Status: {identity}
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.04] transition-colors hover:bg-white/[0.08]"
              >
                <X className="h-4 w-4 text-white/50" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollbarWidth: 'none' }}>
              
              {/* Gen Z Premium Modes */}
              <div className="mb-10">
                <SectionHeader icon={<Activity className="h-4 w-4" />} title="Immersive Modes" />
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {PREMIUM_MODES.map(mode => {
                    const isActive = s.premiumMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => s.setPremiumMode(mode.id)}
                        className={`relative flex flex-col items-start p-4 rounded-2xl border transition-all duration-300 ${isActive ? 'bg-white/10 border-white/20' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                        style={{ boxShadow: isActive ? `0 0 20px ${mode.color}20` : 'none' }}
                      >
                        <div className={`p-2 rounded-full mb-3 ${isActive ? 'bg-white/20' : 'bg-white/5'}`} style={{ color: mode.color }}>
                          {mode.icon}
                        </div>
                        <div className="text-[13px] font-bold text-white mb-1">{mode.label}</div>
                        <div className="text-[10px] text-white/40 text-left leading-tight">{mode.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Playback Settings */}
              <div className="mb-10 rounded-2xl bg-white/[0.02] p-5 border border-white/[0.04]">
                <SectionHeader icon={<Volume2 className="h-4 w-4" />} title="Playback" />
                
                <Toggle
                  label="Karaoke Auto-Open"
                  sub="Automatically maximize lyrics when playing a new track"
                  checked={s.karaokeAutoOpen}
                  onToggle={() => s.toggle('karaokeAutoOpen')}
                />
                
                <Toggle
                  label="Smart Autoplay"
                  sub="AI engine fetches similar tracks when queue ends"
                  checked={s.autoplay}
                  onToggle={() => s.toggle('autoplay')}
                />

                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-[13px] font-medium text-white/90 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-white/40" />
                      Sleep Timer
                    </div>
                    {timeRemainingStr && (
                      <div className="text-[11px] font-mono font-bold text-[oklch(0.72_0.26_248)]">
                        {timeRemainingStr}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SLEEP_TIMER_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => s.setSleepTimer(opt.id === 0 ? null : opt.id)}
                        className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
                          (opt.id === 0 && !s.sleepTimerTarget) || (opt.id !== 0 && s.sleepTimerTarget !== null && timeRemainingMs > 0 && Math.abs((s.sleepTimerTarget - Date.now()) - opt.id * 60000) < 600000) 
                            ? 'bg-white/20 text-white' 
                            : 'bg-white/5 text-white/40 hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Visuals Engine */}
              <div className="mb-6 rounded-2xl bg-white/[0.02] p-5 border border-white/[0.04]">
                <SectionHeader icon={<Eye className="h-4 w-4" />} title="Visuals Engine" />
                
                <div className="mb-6">
                  <div className="flex justify-between mb-2">
                    <span className="text-[13px] font-medium text-white/90">Visual Intensity</span>
                    <span className="text-[11px] font-mono text-white/40">{Math.round(s.effectIntensity * 100)}%</span>
                  </div>
                  <div className="relative h-6 flex items-center">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={s.effectIntensity}
                      onChange={(e) => s.setEffectIntensity(parseFloat(e.target.value))}
                      className="peer absolute inset-0 z-20 w-full opacity-0 cursor-ew-resize"
                      disabled={s.premiumMode === 'focus' || s.premiumMode === 'party'}
                    />
                    <div className={`h-1.5 w-full rounded-full bg-white/10 overflow-hidden ${s.premiumMode === 'focus' || s.premiumMode === 'party' ? 'opacity-30' : ''}`}>
                      <div 
                        className="h-full bg-[oklch(0.72_0.26_248)] transition-all duration-150"
                        style={{ width: `${s.effectIntensity * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-white/30 flex justify-between">
                    <span>Minimal</span>
                    <span>Cinematic</span>
                  </div>
                </div>

                <Toggle
                  label="Immersive Reactive Effects"
                  sub="Sync background glow and blur with music data"
                  checked={s.immersiveEffects}
                  onToggle={() => s.toggle('immersiveEffects')}
                />
                
                <Toggle
                  label="Reduce Motion"
                  sub="Disable physics simulation and slow gradients"
                  checked={s.reducedMotion}
                  onToggle={() => s.toggle('reducedMotion')}
                />
              </div>

              {/* System / Troubleshooting */}
              <div className="mb-6 rounded-2xl bg-white/[0.02] p-5 border border-white/[0.04]">
                <SectionHeader icon={<RefreshCw className="h-4 w-4" />} title="System" />
                
                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-[13px] font-medium text-white/90">Reload Application</div>
                    <div className="mt-0.5 text-[10px] text-white/40">Force refresh if the UI gets stuck</div>
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="flex h-8 items-center gap-2 rounded-full bg-white/5 px-4 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/10"
                  >
                    Reload
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
