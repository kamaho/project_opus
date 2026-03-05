import { cn } from "@/lib/utils";

const STYLES: Record<string, { bg: string; text: string; label: string }> = {
  done: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", label: "Ferdig" },
  on_track: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", label: "På sporet" },
  at_risk: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", label: "Risiko" },
  overdue: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", label: "Forfalt" },
  not_started: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", label: "Ikke startet" },
};

export default function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? STYLES.not_started;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap",
        style.bg,
        style.text
      )}
    >
      {style.label}
    </span>
  );
}
