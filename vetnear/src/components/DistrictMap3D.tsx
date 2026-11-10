"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { PLACES } from "@/lib/data/places";
import { isSearchablePublicPlace } from "@/lib/data/provenance";
import { DISTRICT_SHAPES, KYIV_MAP_VIEWBOX } from "@/lib/geo/kyivDistrictShapes";
import { ALL_DISTRICTS, DISTRICT_LABELS } from "@/lib/labels";
import type { KyivDistrict } from "@/lib/types";

const { width: W, height: H } = KYIV_MAP_VIEWBOX;
const VIEWBOX = `0 0 ${W} ${H}`;
const shortName = (d: KyivDistrict) => DISTRICT_LABELS[d].replace(" район", "");

function placesWord(n: number): string {
  const d = n % 10;
  const h = n % 100;
  if (d === 1 && h !== 11) return "заклад";
  if (d >= 2 && d <= 4 && (h < 10 || h > 20)) return "заклади";
  return "закладів";
}

/**
 * Small schematic map of Kyiv's ten districts, drawn from real boundaries and
 * tilted in 3D. Each district is its own extruded piece with its own colour:
 * hovering (or focusing) lifts it and shows its name; clicking selects it.
 * The chips under the map do the same job for touch and keyboard users.
 */
export function DistrictMap3D({
  value,
  onChange,
  allowAll = true,
  className = "",
}: {
  value: KyivDistrict | "all" | null;
  onChange: (district: KyivDistrict | "all") => void;
  /** Show the "all districts" chip (filters); forms that need one district hide it. */
  allowAll?: boolean;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [hovered, setHovered] = useState<KyivDistrict | null>(null);
  const selected = value && value !== "all" ? value : null;
  const shown = hovered ?? selected;

  const counts = useMemo(() => {
    const map = {} as Record<KyivDistrict, number>;
    for (const d of ALL_DISTRICTS) map[d] = 0;
    for (const p of PLACES) if (isSearchablePublicPlace(p) && p.district in map) map[p.district] += 1;
    return map;
  }, []);

  const choose = (d: KyivDistrict) => onChange(allowAll && d === selected ? "all" : d);
  const onKey = (event: KeyboardEvent, d: KyivDistrict) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(d);
    }
  };

  // The whole board leans a few degrees towards the pointer (fine pointers only).
  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const node = rootRef.current;
    if (!node || event.pointerType === "touch" || frame.current) return;
    const { clientX, clientY } = event;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const rect = node.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width - 0.5;
      const y = (clientY - rect.top) / rect.height - 0.5;
      node.style.setProperty("--dm-rx", `${(-y * 8).toFixed(2)}deg`);
      node.style.setProperty("--dm-rz", `${(x * 7).toFixed(2)}deg`);
    });
  };
  const handleLeave = () => {
    rootRef.current?.style.setProperty("--dm-rx", "0deg");
    rootRef.current?.style.setProperty("--dm-rz", "0deg");
    setHovered(null);
  };

  return (
    <div
      ref={rootRef}
      className={`district-map ${className}`}
      data-has-active={shown ? "" : undefined}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      <div className="district-map__stage" style={{ aspectRatio: `${W} / ${Math.round(H * 0.72)}` }}>
        <div className="district-map__plane" style={{ aspectRatio: `${W} / ${H}` }}>
          {/* Soft ground shadow under the whole city. */}
          <svg viewBox={VIEWBOX} className="district-map__ground" aria-hidden>
            {ALL_DISTRICTS.map((d) => (
              <path key={d} d={DISTRICT_SHAPES[d].path} fillRule="evenodd" />
            ))}
          </svg>

          {ALL_DISTRICTS.map((d) => (
            <div
              key={d}
              className="district-map__piece"
              data-active={shown === d ? "" : undefined}
              data-selected={selected === d ? "" : undefined}
              style={{ ["--c" as string]: DISTRICT_SHAPES[d].color }}
              aria-hidden
            >
              <svg viewBox={VIEWBOX} className="district-map__side district-map__side--low">
                <path d={DISTRICT_SHAPES[d].path} fillRule="evenodd" />
              </svg>
              <svg viewBox={VIEWBOX} className="district-map__side">
                <path d={DISTRICT_SHAPES[d].path} fillRule="evenodd" />
              </svg>
              <svg viewBox={VIEWBOX} className="district-map__top">
                <path d={DISTRICT_SHAPES[d].path} fillRule="evenodd" />
              </svg>
            </div>
          ))}

          {/* Name tag: stands upright over the active district, facing the viewer. */}
          {shown && (
            <div
              className="district-map__tag"
              style={{
                left: `${(DISTRICT_SHAPES[shown].cx / W) * 100}%`,
                top: `${(DISTRICT_SHAPES[shown].cy / H) * 100}%`,
                ["--c" as string]: DISTRICT_SHAPES[shown].color,
              }}
              aria-hidden
            >
              <span className="district-map__tag-dot" />
              {shortName(shown)}
              <span className="district-map__tag-count">{counts[shown]}</span>
            </div>
          )}

          {/* Hit layer: stays flat, so a lifted piece never slips from under the pointer. */}
          <svg viewBox={VIEWBOX} className="district-map__hit" role="group" aria-label="Райони Києва на карті">
            {ALL_DISTRICTS.map((d) => (
              <path
                key={d}
                d={DISTRICT_SHAPES[d].path}
                fillRule="evenodd"
                role="button"
                tabIndex={0}
                aria-pressed={selected === d}
                aria-label={`${DISTRICT_LABELS[d]}: ${counts[d]} ${placesWord(counts[d])}`}
                onPointerEnter={(event) => event.pointerType !== "touch" && setHovered(d)}
                onPointerLeave={() => setHovered((current) => (current === d ? null : current))}
                onFocus={() => setHovered(d)}
                onBlur={() => setHovered((current) => (current === d ? null : current))}
                onClick={() => choose(d)}
                onKeyDown={(event) => onKey(event, d)}
              />
            ))}
          </svg>
        </div>
      </div>

      <p className="district-map__status" role="status">
        {shown ? (
          <>
            <span className="district-map__tag-dot" style={{ ["--c" as string]: DISTRICT_SHAPES[shown].color }} />
            <strong>{DISTRICT_LABELS[shown]}</strong>
            <span>
              · {counts[shown]} {placesWord(counts[shown])}
              {selected === shown ? " · обрано" : ""}
            </span>
          </>
        ) : (
          <span>Наведіть на район або торкніться його</span>
        )}
      </p>

      <ul className="district-map__legend" aria-label="Райони Києва">
        {allowAll && (
          <li>
            <button type="button" aria-pressed={!selected} onClick={() => onChange("all")} className="district-map__chip">
              Усі райони
            </button>
          </li>
        )}
        {ALL_DISTRICTS.map((d) => (
          <li key={d}>
            <button
              type="button"
              aria-pressed={selected === d}
              onClick={() => choose(d)}
              onPointerEnter={(event) => event.pointerType !== "touch" && setHovered(d)}
              onPointerLeave={() => setHovered((current) => (current === d ? null : current))}
              className="district-map__chip"
              style={{ ["--c" as string]: DISTRICT_SHAPES[d].color }}
            >
              <span className="district-map__tag-dot" />
              {shortName(d)}
            </button>
          </li>
        ))}
      </ul>
      <p className="district-map__credit">Межі районів: © OpenStreetMap contributors</p>
    </div>
  );
}
