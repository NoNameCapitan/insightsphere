import { GeneratedVisual } from "@/components/GeneratedVisual";
import { TileIcon, type TileIconName } from "@/components/icons/ServiceIcons";

const ORBIT: TileIconName[] = ["clinic", "pharmacy", "store", "grooming", "boarding", "shelter"];

/**
 * Hero centrepiece: the VetNear pin standing on a "search radius" that pulses
 * outwards, with the care categories orbiting it in real 3D — tiles pass in
 * front of the pin and then behind it. Decorative only (aria-hidden).
 */
export function HeroOrbit({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <div aria-hidden className={`orbit ${className}`}>
      <div className="orbit__scene">
        <div className="orbit__plane orbit__plane--ground">
          <span className="orbit__pulse" />
          <span className="orbit__pulse orbit__pulse--2" />
          <span className="orbit__pulse orbit__pulse--3" />
          <span className="orbit__track" />
        </div>
        <GeneratedVisual
          src="/visuals/c-home-hero.webp"
          className="orbit__pin"
          motion="bob"
          glow
          shine
          shadow
          priority={priority}
          sizes="(max-width: 640px) 200px, 240px"
        />
        <div className="orbit__plane">
          <div className="orbit__ring">
            {ORBIT.map((name, i) => (
              <div key={name} className="orbit__arm" style={{ ["--a" as string]: `${(360 / ORBIT.length) * i}deg` }}>
                <div className="orbit__face">
                  <div className="orbit__spin">
                    <span className="orbit__tile icon3d">
                      <TileIcon name={name} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
