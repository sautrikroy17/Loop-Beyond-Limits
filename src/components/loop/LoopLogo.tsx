import React from 'react';

interface LogoProps {
  size?: number;
  showText?: boolean;
  textSize?: string;
  className?: string;
}

// ── Full logo: image + optional wordmark ───────────────────────────
export function LoopLogo({ size = 28, showText = true, textSize = 'text-lg', className = '' }: LogoProps) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <img 
        src="/logo.png" 
        alt="Loop" 
        width={size} 
        height={size} 
        className="rounded-[22%] object-contain shadow-lg" 
        style={{ width: size, height: size }}
      />
      {showText && (
        <span className={`font-semibold tracking-tight text-white ${textSize}`}>
          Loop
        </span>
      )}
    </span>
  );
}

// Keep these exports for compatibility if they are used elsewhere
export function LoopLogoSVG({ size = 28 }: { size?: number }) {
  return (
    <img 
      src="/logo.png" 
      alt="Loop" 
      width={size} 
      height={size} 
      className="rounded-[22%] object-contain" 
    />
  );
}

export function LoopLogoCanvas({ size = 28 }: { size?: number }) {
  return (
    <img 
      src="/logo.png" 
      alt="Loop" 
      width={size} 
      height={size} 
      className="rounded-[22%] object-contain" 
    />
  );
}
