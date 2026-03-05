import { cn } from "@/lib/utils";

interface BentoCardProps {
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}

export function BentoCard({
  title,
  description,
  className,
  children,
}: BentoCardProps) {
  return (
    <div
      className={cn(
        "group overflow-hidden rounded-xl border border-border/50 bg-card p-5 transition-colors hover:border-border",
        className
      )}
    >
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}
