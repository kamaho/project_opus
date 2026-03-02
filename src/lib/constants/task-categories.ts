import type { TaskCategory } from "@/lib/db/schema";

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  missing_documentation: "Mangler dokumentasjon",
  needs_correction: "Må korrigeres",
  needs_approval: "Trenger godkjenning",
  follow_up_external: "Purring til ekstern",
  flag_for_later: "Flagg til senere",
  clarify: "Avklare",
  document: "Dokumentere",
  reconcile: "Avstemme",
  correct: "Korrigere",
  follow_up: "Følge opp",
  control: "Kontrollere",
  report: "Rapportere",
  other: "Annet",
};

export const TASK_CATEGORY_GROUPS: { label: string; items: TaskCategory[] }[] = [
  {
    label: "Daglige oppgaver",
    items: ["reconcile", "document", "clarify", "correct"],
  },
  {
    label: "Oppfølging",
    items: ["follow_up", "follow_up_external", "control", "report"],
  },
  {
    label: "Annet",
    items: ["needs_approval", "missing_documentation", "needs_correction", "flag_for_later", "other"],
  },
];

export const TASK_CATEGORY_COLORS: Record<TaskCategory, string> = {
  missing_documentation: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  needs_correction: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  needs_approval: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  follow_up_external: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  flag_for_later: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300",
  clarify: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  document: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  reconcile: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  correct: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  follow_up: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  control: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  report: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  other: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};
