import { cn } from "@/lib/utils";

const SOURCE_CONFIG: Record<string, { label: string; className: string; title: string }> = {
  tripletex: {
    label: "Tx",
    className: "bg-[#1d4354] text-white",
    title: "Tripletex",
  },
  visma_nxt: {
    label: "V",
    className: "bg-[#1a1a6c] text-white",
    title: "Visma Business NXT",
  },
};

interface IntegrationBadgeProps {
  sources: string[];
  size?: "sm" | "md";
  className?: string;
}

export function IntegrationBadge({ sources, size = "sm", className }: IntegrationBadgeProps) {
  if (sources.length === 0) return null;

  const sizeClass = size === "sm"
    ? "h-4 min-w-[16px] px-1 text-[8px]"
    : "h-5 min-w-[20px] px-1.5 text-[9px]";

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {sources.map((source) => {
        const config = SOURCE_CONFIG[source];
        if (!config) return null;
        return (
          <span
            key={source}
            className={cn(
              "inline-flex items-center justify-center rounded font-bold leading-none shrink-0",
              sizeClass,
              config.className
            )}
            title={config.title}
          >
            {config.label}
          </span>
        );
      })}
    </span>
  );
}
