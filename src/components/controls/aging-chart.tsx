"use client";

import { cn } from "@/lib/utils";

interface AgingBucket {
  label: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

interface AgingChartProps {
  buckets: AgingBucket[];
}

const NOK = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

const BUCKET_COLORS = [
  "bg-green-500/80 dark:bg-green-500/60",
  "bg-amber-400/80 dark:bg-amber-400/60",
  "bg-orange-500/80 dark:bg-orange-500/60",
  "bg-red-400/80 dark:bg-red-400/60",
  "bg-red-600/80 dark:bg-red-600/60",
];

export function AgingChart({ buckets }: AgingChartProps) {
  const maxPct = Math.max(...buckets.map((b) => b.percentage), 1);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Aldersfordeling</h3>
      <div className="space-y-2">
        {buckets.map((bucket, i) => (
          <div key={bucket.label} className="grid grid-cols-[140px_1fr_80px_50px] items-center gap-2 text-sm">
            <span className="text-muted-foreground truncate">{bucket.label}</span>
            <div className="h-5 rounded bg-muted/50 overflow-hidden">
              <div
                className={cn("h-full rounded transition-all", BUCKET_COLORS[i] ?? BUCKET_COLORS[4])}
                style={{ width: `${Math.max((bucket.percentage / maxPct) * 100, bucket.count > 0 ? 2 : 0)}%` }}
              />
            </div>
            <span className="font-mono tabular-nums text-right text-xs">
              {NOK.format(bucket.totalAmount)} kr
            </span>
            <span className="text-muted-foreground text-right text-xs font-mono tabular-nums">
              {bucket.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
