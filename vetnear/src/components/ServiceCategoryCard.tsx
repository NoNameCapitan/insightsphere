"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEventHandler } from "react";
import { ServiceIcon } from "@/components/icons/ServiceIcons";
import type { PlaceCategory } from "@/lib/types";

/** Long enough for the slowest one-shot icon animation (hotel rock, 3.4s). */
const TAP_ANIMATION_MS = 3500;

/** Maps taxonomy categories to the `service-card--*` styling variants. */
const CARD_VARIANT: Partial<Record<PlaceCategory, string>> = {
  veterinary_clinic: "clinic",
  emergency_vet: "emergency",
  pet_store: "store",
  vet_pharmacy: "pharmacy",
  grooming: "grooming",
  pet_boarding: "hotel",
  shelter: "shelter",
  dog_training: "training",
  pet_friendly_place: "friendly",
};

type ServiceCategoryCardProps = {
  category: PlaceCategory;
  label: string;
  /** Optional one-line explanation shown under the label (care-path cards). */
  description?: string;
  /** "tile" = centered icon over label; "row" = icon, text, trailing arrow. */
  layout?: "tile" | "row";
  /** Row layout only: larger icon and heading for the primary care path. */
  featured?: boolean;
  /** Renders a next/link when set; otherwise a <button> using onClick. */
  href?: string;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
};

/**
 * Category / care-path card: a soft icon badge with a custom inline SVG and a
 * contextual micro-animation (heartbeat, bag bounce, capsule tilt, scissor
 * snip, cozy rock, emergency pulse — see globals.css). Desktop animates on
 * hover/focus-visible; touch devices get a single run on tap via the
 * `service-card--tap` class. prefers-reduced-motion disables all movement.
 */
export function ServiceCategoryCard({
  category,
  label,
  description,
  layout = "tile",
  featured = false,
  href,
  onClick,
  className,
  ariaLabel,
}: ServiceCategoryCardProps) {
  const [tapping, setTapping] = useState(false);
  const tappingRef = useRef(false);
  const stopTimer = useRef<number | undefined>(undefined);

  const playOnce = useCallback(() => {
    if (tappingRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    tappingRef.current = true;
    setTapping(true);
    stopTimer.current = window.setTimeout(() => {
      tappingRef.current = false;
      setTapping(false);
    }, TAP_ANIMATION_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(stopTimer.current), []);

  const handlePointerDown: PointerEventHandler<HTMLElement> = (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen") playOnce();
  };

  const isRow = layout === "row";

  const classes = [
    "card service-card",
    `service-card--${CARD_VARIANT[category] ?? "generic"}`,
    tapping ? "service-card--tap" : "",
    isRow
      ? `care-card ${featured ? "care-card--featured" : ""} transition active:scale-[0.99]`
      : "flex flex-col items-center gap-2 p-4 text-center transition active:scale-[0.98]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = isRow ? (
    <>
      <span aria-hidden className="service-card__icon shrink-0">
        <ServiceIcon category={category} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block font-display font-bold leading-tight text-ink ${
            featured ? "text-lg" : "text-base"
          }`}
        >
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs leading-snug text-ink/55">
            {description}
          </span>
        )}
      </span>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        className="care-card__arrow h-5 w-5"
      >
        <path
          d="M9 5.5 15.5 12 9 18.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  ) : (
    <>
      <span aria-hidden className="service-card__icon">
        <ServiceIcon category={category} />
      </span>
      <span className="service-card__label text-sm font-bold leading-tight">
        {label}
      </span>
      {description && (
        <span className="text-[11px] font-normal leading-snug text-ink/55">
          {description}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        aria-label={ariaLabel}
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
