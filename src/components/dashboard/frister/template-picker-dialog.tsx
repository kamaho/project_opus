"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle2, ChevronRight, LayoutTemplate, Loader2, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TemplateEditorDialog } from "./template-editor-dialog";

interface TemplateItem {
  title: string;
  description?: string;
  routine?: string;
  priority: string;
  category?: string;
  sortOrder: number;
  offsetDays: number;
}

interface TaskTemplate {
  id: string;
  name: string;
  description: string | null;
  deadlineSlug: string | null;
  isSystem: boolean;
  items: TemplateItem[];
}

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deadlineId: string;
  deadlineSlug: string;
  deadlineName: string;
  onApplied: () => void;
}

const PRIORITY_LABELS: Record<string, string> = {
  low: "Lav",
  medium: "Normal",
  high: "Høy",
  critical: "Kritisk",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-muted-foreground",
  high: "text-amber-600 dark:text-amber-400",
  critical: "text-red-600 dark:text-red-400",
};

export function TemplatePickerDialog({
  open,
  onOpenChange,
  deadlineId,
  deadlineSlug,
  deadlineName,
  onApplied,
}: TemplatePickerDialogProps) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/task-templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        const suggested = data.find((t: TaskTemplate) => t.deadlineSlug === deadlineSlug);
        if (suggested) setSelectedId(suggested.id);
      }
    } catch {
      toast.error("Kunne ikke laste maler");
    } finally {
      setLoading(false);
    }
  }, [deadlineSlug]);

  useEffect(() => {
    if (open) {
      setSelectedId(null);
      fetchTemplates();
    }
  }, [open, fetchTemplates]);

  const handleApply = async () => {
    if (!selectedId) return;
    setApplying(true);

    try {
      const res = await fetch(`/api/task-templates/${selectedId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadlineId }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.count} oppgaver opprettet`);
        onOpenChange(false);
        onApplied();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error ?? "Kunne ikke bruke malen");
      }
    } catch {
      toast.error("Noe gikk galt");
    } finally {
      setApplying(false);
    }
  };

  const suggestedTemplates = templates.filter((t) => t.deadlineSlug === deadlineSlug);
  const otherTemplates = templates.filter((t) => t.deadlineSlug !== deadlineSlug);
  const selectedTemplate = templates.find((t) => t.id === selectedId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5" />
            Velg oppgavemal
          </DialogTitle>
          <DialogDescription>
            Velg en mal for å opprette oppgaver knyttet til {deadlineName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Ingen maler tilgjengelig. Opprett en mal først.
            </p>
          ) : (
            <>
              {suggestedTemplates.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Sparkles className="h-3 w-3" />
                    Anbefalt for denne fristen
                  </div>
                  {suggestedTemplates.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      selected={selectedId === t.id}
                      onSelect={() => setSelectedId(t.id)}
                      suggested
                    />
                  ))}
                </div>
              )}

              {otherTemplates.length > 0 && (
                <div className="space-y-2">
                  {suggestedTemplates.length > 0 && (
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Alle maler
                    </div>
                  )}
                  {otherTemplates.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      selected={selectedId === t.id}
                      onSelect={() => setSelectedId(t.id)}
                    />
                  ))}
                </div>
              )}

              {selectedTemplate && (
                <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Forhåndsvisning — {selectedTemplate.items.length} oppgaver
                  </div>
                  <Accordion type="single" collapsible className="space-y-1">
                    {selectedTemplate.items
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((item, i) => (
                        <AccordionItem
                          key={i}
                          value={`item-${i}`}
                          className="border rounded-md bg-background px-3"
                        >
                          <AccordionTrigger className="py-2 text-sm hover:no-underline">
                            <div className="flex items-center gap-2 text-left">
                              <span className="font-medium">{item.title}</span>
                              {item.priority !== "medium" && (
                                <span className={cn("text-[10px]", PRIORITY_COLORS[item.priority])}>
                                  {PRIORITY_LABELS[item.priority]}
                                </span>
                              )}
                              {item.offsetDays !== 0 && (
                                <Badge variant="outline" className="text-[10px] py-0 h-4">
                                  {item.offsetDays > 0 ? "+" : ""}{item.offsetDays}d
                                </Badge>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="text-xs text-muted-foreground space-y-2 pb-2">
                            {item.description && <p>{item.description}</p>}
                            {item.routine && (
                              <div className="border-l-2 border-muted pl-2 whitespace-pre-wrap font-mono text-[11px]">
                                {item.routine}
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                  </Accordion>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => setEditorOpen(true)}
          >
            <Plus className="h-3 w-3" />
            Ny mal
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={applying}>
              Avbryt
            </Button>
            <Button
              onClick={handleApply}
              disabled={!selectedId || applying}
              className="gap-1.5"
            >
              {applying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Oppretter oppgaver...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Bruk mal
                </>
              )}
            </Button>
          </div>
        </div>

        <TemplateEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          onSaved={() => {
            setEditorOpen(false);
            fetchTemplates();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  template,
  selected,
  onSelect,
  suggested,
}: {
  template: TaskTemplate;
  selected: boolean;
  onSelect: () => void;
  suggested?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-lg border p-3 transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-muted-foreground/30 hover:bg-muted/30",
        suggested && !selected && "border-dashed"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{template.name}</span>
            {template.isSystem && (
              <Badge variant="secondary" className="text-[10px] py-0 h-4 shrink-0">
                System
              </Badge>
            )}
          </div>
          {template.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {template.description}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            {template.items.length} oppgaver
          </p>
        </div>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 mt-0.5 transition-colors",
            selected ? "text-primary" : "text-muted-foreground"
          )}
        />
      </div>
    </button>
  );
}
