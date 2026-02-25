import Image from "next/image";
import { cn } from "@/lib/utils";

interface RevizoLogoProps {
  variant?: "default" | "alt";
  className?: string;
  width?: number;
  height?: number;
}

export function RevizoLogo({
  variant = "default",
  className,
  width = 120,
  height = 30,
}: RevizoLogoProps) {
  const src =
    variant === "default" ? "/revizo-logo.svg" : "/revizo-logo-2.svg";

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
