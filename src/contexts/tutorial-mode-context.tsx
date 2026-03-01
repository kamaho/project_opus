"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecordedStep {
  elementSelector: string;
  title: string;
  description: string;
  pathname: string;
  tooltipPosition: "top" | "bottom" | "left" | "right";
}

export interface PlaybackStep {
  id: string;
  stepOrder: number;
  elementSelector: string;
  title: string;
  description: string | null;
  pathname: string | null;
  tooltipPosition: "top" | "bottom" | "left" | "right";
}

export type TutorialMode = "idle" | "recording" | "playing";

interface TutorialModeContextValue {
  mode: TutorialMode;

  /** @deprecated Use mode !== 'idle' for active check. Kept for backward compat. */
  enabled: boolean;
  /** @deprecated Use startRecording/startPlayback/stopPlayback. */
  setEnabled: (value: boolean) => void;
  /** @deprecated */
  toggle: () => void;

  // Recording
  recordedSteps: RecordedStep[];
  startRecording: () => void;
  addStep: (step: RecordedStep) => void;
  removeStep: (index: number) => void;
  stopRecording: () => void;
  /** Called after save completes */
  clearRecording: () => void;

  // Playback
  activeTutorialId: string | null;
  activeTutorialName: string | null;
  playbackSteps: PlaybackStep[];
  currentStepIndex: number;
  startPlayback: (tutorialId: string, name: string, steps: PlaybackStep[]) => void;
  nextStep: () => void;
  prevStep: () => void;
  stopPlayback: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const TutorialModeContext = createContext<TutorialModeContextValue | null>(null);

export function useTutorialMode(): TutorialModeContextValue {
  const ctx = useContext(TutorialModeContext);
  if (!ctx) {
    throw new Error("useTutorialMode must be used within TutorialModeProvider");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function TutorialModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<TutorialMode>("idle");

  // -- Recording state --
  const [recordedSteps, setRecordedSteps] = useState<RecordedStep[]>([]);

  const startRecording = useCallback(() => {
    setRecordedSteps([]);
    setMode("recording");
  }, []);

  const addStep = useCallback((step: RecordedStep) => {
    setRecordedSteps((prev) => [...prev, step]);
  }, []);

  const removeStep = useCallback((index: number) => {
    setRecordedSteps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const stopRecording = useCallback(() => {
    setMode("idle");
  }, []);

  const clearRecording = useCallback(() => {
    setRecordedSteps([]);
  }, []);

  // -- Playback state --
  const [activeTutorialId, setActiveTutorialId] = useState<string | null>(null);
  const [activeTutorialName, setActiveTutorialName] = useState<string | null>(null);
  const [playbackSteps, setPlaybackSteps] = useState<PlaybackStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const startPlayback = useCallback(
    (tutorialId: string, name: string, steps: PlaybackStep[]) => {
      setActiveTutorialId(tutorialId);
      setActiveTutorialName(name);
      setPlaybackSteps(steps);
      setCurrentStepIndex(0);
      setMode("playing");
    },
    []
  );

  const nextStep = useCallback(() => {
    setCurrentStepIndex((prev) =>
      prev < playbackSteps.length - 1 ? prev + 1 : prev
    );
  }, [playbackSteps.length]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const stopPlayback = useCallback(() => {
    setMode("idle");
    setActiveTutorialId(null);
    setActiveTutorialName(null);
    setPlaybackSteps([]);
    setCurrentStepIndex(0);
  }, []);

  const enabled = mode !== "idle";
  const setEnabled = useCallback(
    (value: boolean) => {
      if (value && mode === "idle") startRecording();
      if (!value && mode !== "idle") {
        stopRecording();
        stopPlayback();
      }
    },
    [mode, startRecording, stopRecording, stopPlayback]
  );
  const toggle = useCallback(() => setEnabled(!enabled), [setEnabled, enabled]);

  const value: TutorialModeContextValue = {
    mode,
    enabled,
    setEnabled,
    toggle,
    recordedSteps,
    startRecording,
    addStep,
    removeStep,
    stopRecording,
    clearRecording,
    activeTutorialId,
    activeTutorialName,
    playbackSteps,
    currentStepIndex,
    startPlayback,
    nextStep,
    prevStep,
    stopPlayback,
  };

  return (
    <TutorialModeContext.Provider value={value}>
      {children}
    </TutorialModeContext.Provider>
  );
}
