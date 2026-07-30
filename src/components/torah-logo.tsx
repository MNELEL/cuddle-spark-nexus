import { cn } from "@/lib/utils";

interface TorahLogoProps {
  className?: string;
  size?: number;
}

/**
 * Torah-style brand mark: a stylized scroll inspired by the Torah.
 * Use as a drop-in replacement for GraduationCap in the public-facing chrome.
 */
export function TorahLogo({ className, size = 32 }: TorahLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("inline-block", className)}
    >
      {/* Left spindle */}
      <rect x="4" y="4" width="4" height="24" rx="1.5" className="fill-amber" />
      <rect x="3" y="22" width="6" height="3" rx="1" className="fill-amber-glow" />
      {/* Right spindle */}
      <rect x="24" y="4" width="4" height="24" rx="1.5" className="fill-amber" />
      <rect x="23" y="22" width="6" height="3" rx="1" className="fill-amber-glow" />
      {/* Scroll body */}
      <rect x="8" y="6" width="16" height="20" rx="2" className="fill-primary" />
      {/* Decorative lines representing text columns */}
      <rect x="11" y="10" width="3" height="10" rx="0.5" className="fill-primary-foreground/80" />
      <rect x="18" y="10" width="3" height="10" rx="0.5" className="fill-primary-foreground/80" />
      {/* Center divider */}
      <rect x="15" y="10" width="1" height="10" className="fill-primary-foreground/40" />
      {/* Lower scroll roll hint */}
      <path
        d="M10 24.5C10 25.3 10.7 26 11.5 26H20.5C21.3 26 22 25.3 22 24.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="text-primary-foreground/60"
      />
    </svg>
  );
}
