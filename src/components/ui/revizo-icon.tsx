import { cn } from "@/lib/utils";

interface RevizoIconProps {
  className?: string;
  size?: number;
}

export function RevizoIcon({ className, size = 16 }: RevizoIconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-icon-no-bg.png"
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden="true"
    />
  );
}

interface AiAvatarProps {
  className?: string;
  size?: number;
}

export function AiAvatar({ className, size = 24 }: AiAvatarProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/ai-avatar.gif"
      alt=""
      width={size}
      height={size}
      style={{ minWidth: size, minHeight: size, maxWidth: size, maxHeight: size }}
      className={cn("shrink-0 rounded-full object-cover", className)}
      aria-hidden="true"
    />
  );
}
