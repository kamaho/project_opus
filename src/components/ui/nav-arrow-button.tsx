"use client";

import { cn } from "@/lib/utils";

interface NavArrowButtonProps {
  className?: string;
  onClick?: () => void;
}

export function NavArrowButton({ className, onClick }: NavArrowButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("nav-arrow-btn group/nav", className)}
      aria-label="Åpne"
    >
      <span className="nav-arrow-btn__ring nav-arrow-btn__ring--default" />
      <span className="nav-arrow-btn__ring nav-arrow-btn__ring--hover" />
      <span className="nav-arrow-btn__track">
        <span className="nav-arrow-btn__icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5">
            <path
              fill="currentColor"
              d="M4 13h12.17l-5.59 5.59L12 20l8-8-8-8-1.41 1.41L16.17 11H4v2z"
            />
          </svg>
        </span>
        <span className="nav-arrow-btn__icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5">
            <path
              fill="currentColor"
              d="M4 13h12.17l-5.59 5.59L12 20l8-8-8-8-1.41 1.41L16.17 11H4v2z"
            />
          </svg>
        </span>
      </span>
    </button>
  );
}
