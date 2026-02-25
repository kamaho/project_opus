import Image from "next/image";
import { cn } from "@/lib/utils";

interface RevizoLogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export function RevizoLogo({
  className,
  width = 120,
  height = 30,
}: RevizoLogoProps) {
  const src = "/revizo-logo.png";

  return (
    <Image
      src={src}
      alt="Revizo"
      width={width}
      height={height}
      className={cn("shrink-0", className)}
      priority
    />
  );
}
