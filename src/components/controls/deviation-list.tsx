"use client";

import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  ListTodo,
  Mail,
  FileUp,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface Deviation {
  id: string;
  severity: string;
  category: string;
  description: string;
  reference: string;
  amount: number;
}

interface DeviationListProps {
  deviations: Deviation[];
  onCreateTask?: (dev: Deviation) => void;
  onSendMessage?: (dev: Deviation) => void;
  onRequestDoc?: (dev: Deviation) => void;
}

const NOK = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

const SEVERITY_ICON = {
  ok: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
} as const;

const SEVERITY_COLOR = {
  ok: "text-green-600 dark:text-green-400",
  info: "text-blue-600 dark:text-blue-400",
  warning: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
} as const;

export function DeviationList({
  deviations,
  onCreateTask,
  onSendMessage,
  onRequestDoc,
}: DeviationListProps) {
  const hasActions = !!(onCreateTask || onSendMessage || onRequestDoc);

  if (deviations.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 py-4">
        <CheckCircle2 className="h-4 w-4" />
        <span>Ingen avvik funnet.</span>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold mb-2">Avvik ({deviations.length})</h3>
        <div className="space-y-1">
          {deviations.map((dev) => {
            const Icon = SEVERITY_ICON[dev.severity as keyof typeof SEVERITY_ICON] ?? Info;
            const color = SEVERITY_COLOR[dev.severity as keyof typeof SEVERITY_COLOR] ?? SEVERITY_COLOR.info;

            return (
              <div
                key={dev.id}
                className={cn(
                  "group relative flex items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  hasActions && "hover:bg-blue-50/60 dark:hover:bg-blue-950/20 hover:border-blue-300/50 dark:hover:border-blue-700/40"
                )}
              >
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", color)} />
                <div className="flex-1 min-w-0">
                  <p className="leading-snug">{dev.description}</p>
                  {dev.reference && dev.reference !== "Total" && (
                    <p className="text-xs text-muted-foreground mt-0.5">Ref: {dev.reference}</p>
                  )}
                </div>
                <span className="font-mono tabular-nums text-xs shrink-0 mt-0.5">
                  {NOK.format(dev.amount)} kr
                </span>

                {hasActions && (
                  <div className="absolute right-28 top-0 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 backdrop-blur-sm rounded-md border shadow-sm px-1 py-0.5">
                    {onCreateTask && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onCreateTask(dev)}
                            className="p-1 rounded hover:bg-muted transition-colors"
                          >
                            <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Opprett oppgave</TooltipContent>
                      </Tooltip>
                    )}
                    {onSendMessage && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onSendMessage(dev)}
                            className="p-1 rounded hover:bg-muted transition-colors"
                          >
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Send purring</TooltipContent>
                      </Tooltip>
                    )}
                    {onRequestDoc && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onRequestDoc(dev)}
                            className="p-1 rounded hover:bg-muted transition-colors"
                          >
                            <FileUp className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Dokumentasjonsforespørsel</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
