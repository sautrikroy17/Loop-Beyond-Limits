import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Loader2, Sparkles } from 'lucide-react';
import { getDailyMixFn } from '@/functions/profile';
import { usePlayback, type Track } from '@/hooks/usePlayback';
import { useAuth } from '@/hooks/useAuth';

export function DailyMix() {
  const { user } = useAuth();
  const { playTrack, addToQueue } = usePlayback();
  const [mix, setMix] = useState<Track[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    setLoading(true);

    getDailyMixFn().then((data) => {
      if (mounted) {
        if (data && data.length > 0) {
          setMix(data as Track[]);
        } else {
          setError(true);
        }
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) {
        setError(true);
        setLoading(false);
      }
    });

    return () => { mounted = false; };
  }, [user]);

  if (!user) return null;
  if (error || (!loading && !mix)) return null;

  const handlePlayMix = () => {
    if (!mix || mix.length === 0) return;
    playTrack(mix[0]);
    // For a real app, we might want to replace the queue.
    // For now, let's just queue them up.
    mix.slice(1).forEach(track => addToQueue(track));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative mb-20 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-xl"
    >
      <div className="absolute inset-0 z-0">
        <div className="absolute -left-[10%] -top-[50%] h-[150%] w-[50%] animate-pulse rounded-full bg-primary/10 blur-[60px] md:blur-[100px]" />
        <div className="absolute -right-[10%] -bottom-[50%] h-[150%] w-[50%] animate-pulse rounded-full bg-blue-500/10 blur-[60px] md:blur-[100px]" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Made for you</span>
          </div>
          <h3 className="font-display text-4xl font-bold tracking-tight text-white">
            Your Daily Mix
          </h3>
          <p className="text-sm text-white/50">
            A personalized playlist updated every day based on your listening history.
          </p>
        </div>

        <button
          onClick={handlePlayMix}
          disabled={loading}
          className="group relative flex items-center gap-3 overflow-hidden rounded-full bg-white px-8 py-4 font-bold text-black transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Play className="h-5 w-5 fill-current" />
              <span>Play Mix</span>
            </>
          )}
          <div className="absolute inset-0 flex h-full w-full justify-center [filter:blur(10px)] opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="h-full w-8 bg-white/40 group-hover:animate-shimmer" />
          </div>
        </button>
      </div>

      {mix && mix.length > 0 && (
        <div className="relative mt-8 flex w-full overflow-hidden">
          <div className="flex gap-2">
            {mix.slice(0, 10).map((track, i) => (
              <div 
                key={track.id} 
                className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-white/5 bg-white/10 shadow-lg"
                style={{ zIndex: 10 - i, marginLeft: i === 0 ? 0 : -16, transform: `rotate(${i % 2 === 0 ? i : -i}deg)` }}
                title={track.title}
              >
                {track.albumArt ? (
                  <img src={track.albumArt} alt={track.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-white/10" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
