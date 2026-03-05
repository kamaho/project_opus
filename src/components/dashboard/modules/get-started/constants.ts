export type StepId = "setup" | "smart-panel";

export const STEPS: { id: StepId; label: string }[] = [
  { id: "setup", label: "Arbeidsmappe" },
  { id: "smart-panel", label: "Smart Panel" },
];
