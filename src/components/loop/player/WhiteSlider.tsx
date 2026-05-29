export function WhiteSlider({
  value,
  min = 0,
  max = 100,
  step = 0.5,
  onChange,
  onCommit,
  className = "",
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  className?: string;
}) {
  let pct = max - min > 0 ? ((value - min) / (max - min)) * 100 : 0;
  pct = Math.max(0, Math.min(100, pct || 0));

  return (
    <div className={`group relative flex items-center ${className}`} style={{ height: 20 }}>
      {/* Track — always a crisp white line */}
      <div className="relative h-[2px] w-full rounded-full bg-white/25">
        {/* Filled portion — bright white */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white transition-none"
          style={{ width: `${pct}%` }}
        />
        {/* Thumb — always visible white dot */}
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.5)] transition-transform group-hover:scale-125"
          style={{ left: `${pct}%` }}
        />
      </div>
      {/* Invisible range for interaction */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
