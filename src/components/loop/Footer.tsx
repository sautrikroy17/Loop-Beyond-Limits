import { motion } from 'framer-motion';
import { LoopLogoCanvas } from './LoopLogo';

export function Footer() {
  return (
    <footer className="relative pb-10 pt-20">
      <div className="mx-auto max-w-6xl px-6">
        {/* Gradient rule */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mb-14 h-px w-full origin-center"
          style={{
            background:
              'linear-gradient(90deg, transparent, oklch(0.72 0.23 290 / 0.5), oklch(0.72 0.20 242 / 0.5), transparent)',
          }}
        />

        <div className="flex flex-col items-center gap-8 text-center">
          {/* Logo mark */}
          <div className="flex flex-col items-center gap-3">
            <LoopLogoCanvas size={72} />
            <div
              className="font-display text-[clamp(1.8rem,6vw,4rem)] font-semibold leading-none tracking-tight"
              style={{
                background:
                  'linear-gradient(135deg, oklch(0.90 0.08 290) 0%, oklch(0.60 0.06 290) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              LOOP
            </div>
          </div>

          <p className="max-w-xs text-sm leading-relaxed text-white/28">
            LOOP - Beyond Limits
            <br />
            Built for the next generation of listeners.
          </p>

          {/* Social links */}
          <div className="flex items-center gap-3">
            <a
              href="https://www.instagram.com/__krishh17__/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-white/35 transition-all hover:border-white/14 hover:bg-white/[0.07] hover:text-white/70"
              aria-label="Instagram"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
              </svg>
            </a>
          </div>

          {/* Legal */}
          <div className="flex flex-col items-center justify-center gap-4 text-white/22 mt-4">
            <span className="text-sm font-semibold tracking-wide text-white/60 hover:text-white transition-colors duration-300">
              Created by Sautrik Roy ©
            </span>
            <div className="flex items-center gap-5 text-[11px]">
              <a href="#" className="transition-colors hover:text-white/50">Privacy</a>
              <a href="#" className="transition-colors hover:text-white/50">Terms</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}