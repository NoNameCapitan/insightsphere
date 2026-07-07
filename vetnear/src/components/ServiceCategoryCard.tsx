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
 * the `service-card--tap` class. prefers-reduced-motion disables all movement.
 */
export function ServiceCategoryCard({
  category,
  label,
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
    `service-card--${CARD_VARIANT[category] ?? "generic"}`,
    tapping ? "service-card--tap" : "",
    "flex flex-col items-center gap-2 p-4 text-center transition active:scale-[0.98]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span aria-hidden className="service-card__icon">
        <ServiceIcon category={category} />
      </span>
      <span className="service-card__label text-xs font-semibold leading-tight">
        {label}
      </span>
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
