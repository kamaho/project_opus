import { cn } from "@/lib/utils";

interface Props {
  dueDate: string;
  status: string;
}

export default function DaysRemaining({ dueDate, status }: Props) {
  if (status === "done") {
    return <span className="text-xs text-emerald-600 dark:text-emerald-400">Fullført</span>;
  }

  const due = new Date(dueDate.slice(0, 10) + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = due.getTime() - today.getTime();
  const days = Math.ceil(diffMs / 86_400_000);

  let label: string;
  let color: string;

  if (days < 0) {
    label = `${Math.abs(days)}d forfalt`;
    color = "text-red-600 dark:text-red-400";
  } else if (days === 0) {
    label = "I dag";
    color = "text-amber-600 dark:text-amber-400";
  } else if (days === 1) {
    label = "I morgen";
    color = "text-amber-600 dark:text-amber-400";
  } else if (days <= 3) {
    label = `${days}d igjen`;
    color = "text-amber-600 dark:text-amber-400";
  } else if (days <= 7) {
    label = `${days}d igjen`;
    color = "text-blue-600 dark:text-blue-400";
  } else {
    const formatted = due.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
    label = formatted;
    color = "text-muted-foreground";
  }

  return (
    <span className={cn("text-xs font-medium tabular-nums whitespace-nowrap", color)}>
      {label}
    </span>
  );
}
