"use client";

import { TutorialRecordingOverlay } from "./tutorial-recording-overlay";
import { TutorialPlaybackOverlay } from "./tutorial-playback-overlay";

export function TutorialOverlay() {
  return (
    <>
      <TutorialRecordingOverlay />
      <TutorialPlaybackOverlay />
    </>
  );
}
