import { motion } from 'framer-motion';
import { Play, Sparkles } from 'lucide-react';
import { useListeningIntelligence } from '@/hooks/useListeningIntelligence';
import { usePlayback, type Track } from '@/hooks/usePlayback';
import { Reveal } from './Reveal';

interface AIHeroMixProps {
  section: {
    id: string;
    title: string;
    tracks: Track[];
  };
}

export function AIHeroMix({ section }: AIHeroMixProps) {
  const { playTrack, addToQueue } = usePlayback();
  const identity = useListeningIntelligence(s => s.getTasteIdentity());

  if (!section || !section.tracks || section.tracks.length === 0) return null;

  const coverArt = section.tracks[0]?.albumArt;

  const handlePlayMix = () => {
    // Play first track, queue the rest
    playTrack(section.tracks[0]);
    section.tracks.slice(1, 10).forEach(t => addToQueue(t));
  };

  return (
    <Reveal delay={0.1}>
      <div className="group relative mt-12 mb-16 overflow-hidden rounded-3xl" style={{ transformStyle: 'preserve-3d', perspective: '1200px' }}>
        {/* Animated Background - Reduced blur on mobile for performance */}
        <div 
          className="absolute inset-0 z-0 scale-110 blur-2xl opacity-40 md:blur-3xl md:opacity-60 transition-transform duration-1000 group-hover:scale-125"
          style={{ backgroundImage: `url(${coverArt})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-black/80 via-black/40 to-transparent" />
        
        {/* Main Content */}
        <div className="relative z-10 flex flex-col items-start p-8 sm:p-12 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            {identity && (
              <div className="mb-4 flex items-center gap-2 rounded-full bg-black/40 md:bg-white/10 px-4 py-1.5 md:backdrop-blur-md border border-white/10 w-fit">
                <Sparkles className="h-4 w-4 text-[oklch(0.80_0.22_290)]" />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">Live Identity: {identity}</span>
              </div>
            )}
            
            <h2 className="mb-4 font-display text-[clamp(2.5rem,5vw,4rem)] font-bold leading-[1.1] tracking-tight text-white mix-blend-overlay drop-shadow-2xl">
              {section.title}
            </h2>
            <p className="text-sm md:text-base text-white/70 max-w-md font-medium leading-relaxed">
              An evolving AI rotation generated specifically for your real-time sonic fingerprint and emotional listening state.
            </p>
            
            <div className="mt-8 flex gap-4">
              <button
                onClick={handlePlayMix}
                className="flex items-center gap-2 rounded-full px-8 py-4 font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-2xl"
                style={{ background: 'linear-gradient(135deg, oklch(0.72 0.23 290), oklch(0.65 0.21 244))' }}
              >
                <Play className="h-5 w-5 fill-current" />
                Play My Mix
              </button>
            </div>
          </div>
          
          <div className="mt-8 md:mt-0 flex shrink-0 -space-x-4">
             {section.tracks.slice(0, 5).map((t, i) => (
                <img 
                  key={t.id} 
                  src={t.albumArt} 
                  alt={t.title}
                  className="h-20 w-20 rounded-full border-4 border-black object-cover shadow-2xl transition-transform duration-300 group-hover:-translate-y-2"
                  style={{ zIndex: 5 - i, transitionDelay: `${i * 50}ms` }}
                />
             ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}
