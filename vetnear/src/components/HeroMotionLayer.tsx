import Image from "next/image";

// The I-asset ("motion layer") sliced into separate elements so each piece
// moves on its own: a slowly orbiting ring, a twinkling star, a bobbing
// check bubble and a drifting route arrow. Each piece also sits at its own
// depth and shifts against the pointer (--mx/--my from the hero). Decorative.
const PIECES = [
  { name: "ring", depth: 34, className: "motion-piece--ring right-[-3rem] top-6 h-36 w-36 sm:h-52 sm:w-52" },
  { name: "check", depth: -22, className: "motion-piece--check right-[8%] top-[46%] hidden h-20 w-20 sm:block lg:right-[3%]" },
  { name: "sparkle", depth: -16, className: "motion-piece--sparkle left-[4%] top-[14%] h-14 w-14 sm:h-20 sm:w-20" },
  { name: "arrow", depth: 26, className: "motion-piece--arrow bottom-[18%] left-[-2rem] hidden h-24 w-40 md:block" },
] as const;

export function HeroMotionLayer() {
  return (
    <>
      {PIECES.map((p) => (
        <span key={p.name} aria-hidden className={`motion-piece ${p.className}`} style={{ ["--depth" as string]: `${p.depth}px` }}>
          <Image src={`/visuals/parts/motion-${p.name}.webp`} alt="" width={300} height={300} sizes="210px" />
        </span>
      ))}
    </>
  );
}
