import type { TaskCategory } from "@/lib/db/schema";

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  missing_documentation: "Mangler dokumentasjon",
  needs_correction: "Må korrigeres",
  needs_approval: "Trenger godkjenning",
  follow_up_external: "Purring til ekstern",
  flag_for_later: "Flagg til senere",
  other: "Annet",
};

export const TASK_CATEGORY_COLORS: Record<TaskCategory, string> = {
  missing_documentation: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  needs_correction: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  needs_approval: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  follow_up_external: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  flag_for_later: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300",
  other: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};
