"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const SparkleButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  return (
    <span className="sparkle-btn-wrap relative inline-flex">
      <button
        ref={ref}
        className={cn(
          "sparkle-btn-core relative z-[1] inline-flex items-center gap-2 rounded-full",
          "px-4 py-2 text-sm font-medium text-white",
          "hover:scale-[1.04] active:scale-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      >
        {/* Rotating spark border */}
        <span className="sparkle-spark pointer-events-none absolute inset-0 overflow-hidden rounded-full">
          <span className="sparkle-spark-inner absolute left-1/2 top-0 aspect-square w-[200%] -translate-x-1/2 -translate-y-[15%] -rotate-90 opacity-70 transition-opacity duration-300" />
        </span>
        <span className="sparkle-btn-backdrop pointer-events-none absolute inset-[1.5px] z-[-1] rounded-full" />

        {/* Sparkle icon */}
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
          <path
            d="M14.187 8.096L15 5.25L15.813 8.096C16.023 8.831 16.417 9.501 16.958 10.041C17.498 10.582 18.168 10.976 18.903 11.186L21.75 12L18.904 12.813C18.169 13.023 17.499 13.417 16.959 13.958C16.418 14.498 16.024 15.168 15.814 15.903L15 18.75L14.187 15.904C13.977 15.169 13.583 14.499 13.042 13.959C12.502 13.418 11.832 13.024 11.097 12.814L8.25 12L11.096 11.187C11.831 10.977 12.501 10.583 13.041 10.042C13.582 9.502 13.976 8.832 14.186 8.097L14.187 8.096Z"
            fill="currentColor"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="sparkle-path origin-center"
            style={{ animation: "sparkle-bounce 0.6s ease-in-out infinite alternate", animationPlayState: "paused" }}
          />
          <path
            d="M6 14.25L5.741 15.285C5.593 15.879 5.286 16.421 4.853 16.853C4.421 17.286 3.879 17.593 3.285 17.741L2.25 18L3.285 18.259C3.879 18.407 4.421 18.714 4.853 19.147C5.286 19.579 5.593 20.122 5.741 20.715L6 21.75L6.259 20.715C6.407 20.122 6.714 19.58 7.146 19.147C7.579 18.714 8.121 18.408 8.714 18.259L9.75 18L8.714 17.741C8.121 17.593 7.579 17.286 7.146 16.853C6.714 16.42 6.407 15.878 6.259 15.285L6 14.25Z"
            fill="currentColor"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="sparkle-path origin-center"
            style={{ animation: "sparkle-bounce 0.6s 0.15s ease-in-out infinite alternate", animationPlayState: "paused" }}
          />
          <path
            d="M6.5 4L6.303 4.592C6.248 4.757 6.155 4.908 6.031 5.031C5.908 5.155 5.757 5.248 5.592 5.303L5 5.5L5.592 5.697C5.757 5.752 5.908 5.845 6.031 5.969C6.155 6.092 6.248 6.243 6.303 6.409L6.5 7L6.697 6.409C6.752 6.243 6.845 6.092 6.969 5.969C7.092 5.845 7.243 5.752 7.409 5.697L8 5.5L7.409 5.303C7.243 5.248 7.092 5.155 6.969 5.031C6.845 4.908 6.752 4.757 6.697 4.592L6.5 4Z"
            fill="currentColor"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="sparkle-path origin-center"
            style={{ animation: "sparkle-bounce 0.6s 0.3s ease-in-out infinite alternate", animationPlayState: "paused" }}
          />
        </svg>

        <span className="relative">{children}</span>
      </button>
    </span>
  );
});

SparkleButton.displayName = "SparkleButton";

export { SparkleButton };
