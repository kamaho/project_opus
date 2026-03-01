"use client";

import { cn } from "@/lib/utils";

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 448 512"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("panel-toggle-icon", className)}
      aria-hidden
    >
      <path d="M32 32C14.3 32 0 46.3 0 64v96c0 17.7 14.3 32 32 32s32-14.3 32-32V96h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V352zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32h64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H320zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H320c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V352z" />
    </svg>
  );
}

function CompressIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 448 512"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("panel-toggle-icon", className)}
      aria-hidden
    >
      <path d="M160 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V64zM32 320c-17.7 0-32 14.3-32 32s14.3 32 32 32H96v64c0 17.7 14.3 32 32 32s32-14.3 32-32V352c0-17.7-14.3-32-32-32H32zM352 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H352V64zM320 320c-17.7 0-32 14.3-32 32v96c0 17.7 14.3 32 32 32s32-14.3 32-32V384h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H320z" />
    </svg>
  );
}

interface PanelSizeToggleProps {
  expanded: boolean;
  onClick: () => void;
  className?: string;
}

export function PanelSizeToggle({ expanded, onClick, className }: PanelSizeToggleProps) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={expanded ? "Minimer panel" : "Utvid panel"}
      aria-label={expanded ? "Minimer panel" : "Utvid panel"}
      className={cn(
        "flex items-center justify-center shrink-0 rounded-md transition-colors",
        "text-muted-foreground hover:text-foreground hover:bg-muted/60",
        className,
      )}
    >
      {expanded ? (
        <CompressIcon className="h-3 w-3" />
      ) : (
        <ExpandIcon className="h-3 w-3" />
      )}
    </button>
  );
}
