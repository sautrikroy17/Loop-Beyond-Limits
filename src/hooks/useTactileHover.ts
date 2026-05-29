import { useMemo } from "react";
import { useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";

const defaultEase = [0.16, 1, 0.3, 1] as const;

export function useTactileHover({
  maxTilt = 2,
  spotlightStrength = 0.15,
  stiffness = 260,
  damping = 22,
}: {
  maxTilt?: number;
  spotlightStrength?: number;
  stiffness?: number;
  damping?: number;
} = {}) {
  // Pointer position in percentages inside the element.
  const px = useMotionValue(50);
  const py = useMotionValue(50);
  const hover = useMotionValue(0);

  const hoverSpring = useSpring(hover, { stiffness, damping });

  const rx = useSpring(useTransform(py, [0, 100], [maxTilt, -maxTilt]), { stiffness, damping });
  const ry = useSpring(useTransform(px, [0, 100], [-maxTilt, maxTilt]), { stiffness, damping });

  const spotlightOpacity = useTransform(hoverSpring, [0, 1], [0, 1]);

  const spotlightBg = useMotionTemplate`radial-gradient(closest-side at ${px}% ${py}%, oklch(0.7 0.22 290 / ${spotlightStrength}), transparent 70%)`;
  const spotlightEdgeBg = useMotionTemplate`radial-gradient(closest-side at ${px}% ${py}%, oklch(0.76 0.19 238 / ${spotlightStrength * 0.7}), transparent 68%)`;

  const bind = useMemo(
    () => ({
      onMouseEnter: () => hover.set(1),
      onMouseLeave: () => {
        hover.set(0);
        px.set(50);
        py.set(50);
      },
      onMouseMove: (e: React.MouseEvent<HTMLElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        px.set(Math.max(0, Math.min(100, x)));
        py.set(Math.max(0, Math.min(100, y)));
      },
    }),
    [hover, px, py],
  );

  const transformStyle = useMemo(
    () => ({
      transformPerspective: 1000,
    }),
    [],
  );

  return {
    bind,
    rx,
    ry,
    hoverSpring,
    spotlightOpacity,
    spotlightBg,
    spotlightEdgeBg,
    transformStyle,
    transition: { type: "spring", stiffness, damping, ease: defaultEase },
  };
}
