import { useEffect, useState } from "react";

type Accent = "amber" | "turquoise" | "neutral";

function accentClass(a: Accent) {
  if (a === "amber") return "border-amber/50 bg-amber/20";
  if (a === "turquoise") return "border-turquoise/50 bg-turquoise/20";
  return "border-border bg-muted/40";
}

export interface SeatFillGridProps {
  rows?: number;
  cols?: number;
  /** delay between seats, ms */
  stagger?: number;
  className?: string;
}

/** Decorative, non-interactive seating grid with a staggered fill-in animation. */
export function SeatFillGrid({ rows = 4, cols = 8, stagger = 50, className = "" }: SeatFillGridProps) {
  const total = rows * cols;
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) setAnimate(true);
  }, []);

  const accents: Accent[] = Array.from({ length: total }, (_, i) => {
    if (i % 7 === 2) return "amber";
    if (i % 5 === 1) return "turquoise";
    return "neutral";
  });

  return (
    <div
      aria-hidden="true"
      role="presentation"
      // decorative only: hidden from assistive tech and not focusable/interactive
      tabIndex={-1}
      className={`pointer-events-none select-none grid gap-2 ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {accents.map((a, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`aspect-square rounded-xl border ${accentClass(a)} ${
            animate ? "animate-scale-in" : ""
          }`}
          style={
            animate
              ? {
                  animationDelay: `${Math.min(i * stagger, 1200)}ms`,
                  animationFillMode: "both",
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}

export default SeatFillGrid;