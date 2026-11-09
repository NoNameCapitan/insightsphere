"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEventHandler,
  type PointerEventHandler,
  type ReactNode,
} from "react";

/** Length of one full left → right → bottom paw cycle (matches globals.css). */
const PAW_CYCLE_MS = 3600;

type AnimatedCTAButtonProps = {
  children: ReactNode;
  /** Renders a next/link when set; otherwise a plain <button>. */
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  className?: string;
  ariaLabel?: string;
  /**
   * Play a single paw cycle ~1.5s after mount on touch-only devices (no hover),
   * so the landing hero still gets the effect on mobile. Off by default.
   */
  playOnMount?: boolean;
};

/**
 * Cute white pet paw drawn inline (no external assets). Points "up" — the
 * per-side wrapper in globals.css rotates it toward the button.
 */
function PawSvg({ gradientId }: { gradientId: string }) {
  return (
    <svg
      width="62"
      height="86"
      viewBox="0 0 62 86"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0.35" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Little arm reaching in, fading out so it never shows a hard edge. */}
      <rect x="16" y="40" width="30" height="46" rx="15" fill={`url(#${gradientId})`} />
      {/* Toes */}
      <circle cx="17" cy="18" r="10.5" fill="#FFFFFF" />
      <circle cx="31" cy="13.5" r="11.5" fill="#FFFFFF" />
      <circle cx="45" cy="18" r="10.5" fill="#FFFFFF" />
      {/* Palm */}
      <ellipse cx="31" cy="37" rx="24" ry="21" fill="#FFFFFF" />
      {/* Toe slits — soft brand-tinted lines that make it read as a paw. */}
      <path
        d="M23.8 9.5 C25 13.5, 25 18.5, 23.8 22"
        stroke="#B3D6CB"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M38.2 9.5 C37 13.5, 37 18.5, 38.2 22"
        stroke="#B3D6CB"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Hero CTA with a playful paw-helper: on hover/focus a small white paw slides
 * in from the left, taps the button, leaves, then repeats from the right and
 * from below. Touch devices get a single cycle on tap (and optionally shortly
 * after load). All movement lives in globals.css (`animated-cta*` classes) and
 * fully respects prefers-reduced-motion. The paws are absolutely positioned
 * and pointer-events-free, so they never shift layout or block clicks.
 */
export function AnimatedCTAButton({
  children,
  href,
  onClick,
  className,
  ariaLabel,
  playOnMount = false,
}: AnimatedCTAButtonProps) {
  const [tapping, setTapping] = useState(false);
  const tappingRef = useRef(false);
  const stopTimer = useRef<number | undefined>(undefined);
  // useId can contain ":" which is not valid inside url(#…) references.
  const gradientId = `cta-paw-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const playOnce = useCallback(() => {
    if (tappingRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    tappingRef.current = true;
    setTapping(true);
    stopTimer.current = window.setTimeout(() => {
      tappingRef.current = false;
      setTapping(false);
    }, PAW_CYCLE_MS + 100);
  }, []);

  useEffect(() => {
    if (!playOnMount) return;
    // Only auto-play where hover can't trigger the effect (touch devices).
    if (!window.matchMedia("(hover: none)").matches) return;
    const startTimer = window.setTimeout(playOnce, 1500);
    return () => window.clearTimeout(startTimer);
  }, [playOnMount, playOnce]);

  useEffect(() => () => window.clearTimeout(stopTimer.current), []);

  const handlePointerDown: PointerEventHandler<HTMLElement> = (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen") playOnce();
  };

  const classes = ["animated-cta", tapping ? "animated-cta--tap" : "", className]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span className="animated-cta__label">{children}</span>
      <span aria-hidden className="animated-cta__paw animated-cta__paw--left">
        <PawSvg gradientId={`${gradientId}-l`} />
      </span>
      <span aria-hidden className="animated-cta__paw animated-cta__paw--right">
        <PawSvg gradientId={`${gradientId}-r`} />
      </span>
      <span aria-hidden className="animated-cta__paw animated-cta__paw--bottom">
        <PawSvg gradientId={`${gradientId}-b`} />
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        aria-label={ariaLabel}
        onClick={onClick}
        onPointerDown={handlePointerDown}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      aria-label={ariaLabel}
      onClick={onClick}
      onPointerDown={handlePointerDown}
    >
      {content}
    </button>
  );
}
