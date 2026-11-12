"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEventHandler } from "react";
import { ServiceIcon, TileIcon, type TileIconName } from "@/components/icons/ServiceIcons";
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
  /** Taxonomy category; omit for a non-category card and pass `tile` instead. */
  category?: PlaceCategory;
  /** Clay tile to show when there is no category (e.g. "everything nearby"). */
  tile?: TileIconName;
  label: string;
  /** Optional one-line explanation shown under the label (care-path cards). */
  description?: string;
  /** Renders a next/link when set; otherwise a <button> using onClick. */
  href?: string;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
};

/**
 * Public category card for the landing page: a soft icon badge with a custom
 * inline SVG and a contextual micro-animation (heartbeat, bag bounce, capsule
 * tilt, scissor snip, cozy rock, emergency pulse — see globals.css). Desktop
 * animates on hover/focus-visible; touch devices get a single run on tap via
 * the `service-card--tap` class. Interaction is deliberately calm: a ring and
 * shadow on hover/focus and a small icon bounce on press.
 * prefers-reduced-motion disables all movement.
 */
export function ServiceCategoryCard({
  category,
  tile,
  label,
  description,
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

  const classes = [
    "card service-card",
    `service-card--${(category && CARD_VARIANT[category]) ?? "generic"}`,
    tapping ? "service-card--tap" : "",
    "flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-4 text-center",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span aria-hidden className="service-card__icon">
        {category ? <ServiceIcon category={category} /> : tile ? <TileIcon name={tile} /> : null}
      </span>
      <span className="service-card__label mt-1 text-sm font-semibold leading-tight text-ink">
        {label}
      </span>
      {description && (
        <span className="text-xs font-normal leading-snug text-ink/55">
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
