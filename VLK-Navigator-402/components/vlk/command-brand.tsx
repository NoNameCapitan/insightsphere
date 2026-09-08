import Image from "next/image";

type CommandBrandProps = {
  className?: string;
  decorative?: boolean;
  priority?: boolean;
  size?: number;
};

export function CommandBrand({
  className = "",
  decorative = false,
  priority = false,
  size = 52,
}: CommandBrandProps) {
  return (
    <Image
      src="/vlk-command-emblem.png"
      unoptimized
      width={size}
      height={size}
      sizes={`${size}px`}
      priority={priority}
      alt={decorative ? "" : "Емблема VLK Навігатора 402"}
      aria-hidden={decorative || undefined}
      className={`object-contain ${className}`}
    />
  );
}
