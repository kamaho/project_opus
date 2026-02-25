"use client";

import { type ReactNode } from "react";
import { TutorialOverlay } from "./tutorial-overlay";

/** Renders the full-screen tutorial overlay when tutorial mode is on, plus children. */
export function TutorialOverlayGate({ children }: { children: ReactNode }) {
  return (
    <>
      <TutorialOverlay />
      {children}
    </>
  );
}
