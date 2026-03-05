"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, GripVertical, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TemplateItem {
  title: string;
  description?: string;
  routine?: string;
  priority: "low" | "medium" | "high" | "critical";
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

interface TemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingTemplate?: TaskTemplate | null;
  onSaved: () => void;
}

const EMPTY_ITEM: TemplateItem = {
  title: "",
  description: "",
  routine: "",
  priority: "medium",
  category: "",
  sortOrder: 0,
  offsetDays: 0,
};

const PRIORITY_OPTIONS = [
  { value: "low", label: "Lav" },
  { value: "medium", label: "Normal" },
  { value: "high", label: "Høy" },
  { value: "critical", label: "Kritisk" },
] as const;

export function TemplateEditorDialog({
  open,
  onOpenChange,
  editingTemplate,
  onSaved,
}: TemplateEditorDialogProps) {
  const isEditing = !!editingTemplate;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadlineSlug, setDeadlineSlug] = useState("");
  const [items, setItems] = useState<TemplateItem[]>([{ ...EMPTY_ITEM, sortOrder: 1 }]);
  const [saving, setSaving] = useState(false);
  const [expandedItem, setExpandedItem] = useState<number | null>(0);

  const resetForm = useCallback(() => {
    if (editingTemplate) {
      setName(editingTemplate.name);
      setDescription(editingTemplate.description ?? "");
      setDeadlineSlug(editingTemplate.deadlineSlug ?? "");
      setItems(
        editingTemplate.items.length > 0
          ? [...editingTemplate.items].sort((a, b) => a.sortOrder - b.sortOrder)
          : [{ ...EMPTY_ITEM, sortOrder: 1 }]
      );
    } else {
      setName("");
      setDescription("");
      setDeadlineSlug("");
      setItems([{ ...EMPTY_ITEM, sortOrder: 1 }]);
    }
    setExpandedItem(0);
  }, [editingTemplate]);

  useState(() => {
    if (open) resetForm();
  });

  const addItem = () => {
    const maxOrder = items.reduce((max, i) => Math.max(max, i.sortOrder), 0);
    setItems([...items, { ...EMPTY_ITEM, sortOrder: maxOrder + 1 }]);
    setExpandedItem(items.length);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    if (expandedItem === index) setExpandedItem(null);
    else if (expandedItem !== null && expandedItem > index) setExpandedItem(expandedItem - 1);
  };

  const updateItem = (index: number, updates: Partial<TemplateItem>) => {
    setItems(items.map((item, i) => (i === index ? { ...item, ...updates } : item)));
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    next.forEach((item, i) => (item.sortOrder = i + 1));
    setItems(next);
    setExpandedItem(target);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Malen må ha et navn");
      return;
    }
    if (items.some((i) => !i.title.trim())) {
      toast.error("Alle oppgaver må ha en tittel");
      return;
    }

    setSaving(true);

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      deadlineSlug: deadlineSlug.trim() || undefined,
      items: items.map((item, i) => ({
        ...item,
        title: item.title.trim(),
        description: item.description?.trim() || undefined,
        routine: item.routine?.trim() || undefined,
        category: item.category?.trim() || undefined,
        sortOrder: i + 1,
      })),
    };

    try {
      const url = isEditing
        ? `/api/task-templates/${editingTemplate.id}`
        : "/api/task-templates";

      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(isEditing ? "Mal oppdatert" : "Mal opprettet");
        onOpenChange(false);
        onSaved();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error ?? "Kunne ikke lagre malen");
      }
    } catch {
      toast.error("Noe gikk galt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) { if (v) resetForm(); onOpenChange(v); } }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Rediger mal" : "Ny oppgavemal"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Endringer påvirker ikke allerede opprettede oppgaver."
              : "Lag en gjenbrukbar mal med oppgaver som kan knyttes til frister."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* Template metadata */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Malnavn</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="F.eks. MVA-termin sjekkliste"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-slug">Fristtype (slug)</Label>
              <Input
                id="tpl-slug"
                value={deadlineSlug}
                onChange={(e) => setDeadlineSlug(e.target.value)}
                placeholder="F.eks. mva-skattemelding"
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Valgfritt. Kobler malen til en fristtype for automatisk forslag.
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc">Beskrivelse</Label>
            <Textarea
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kort beskrivelse av malen"
              rows={2}
            />
          </div>

          {/* Template items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Oppgaver ({items.length})</Label>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addItem}>
                <Plus className="h-3 w-3" />
                Legg til
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => {
                const isExpanded = expandedItem === index;
                return (
                  <div
                    key={index}
                    className={cn(
                      "rounded-lg border transition-colors",
                      isExpanded ? "bg-muted/30" : "bg-background"
                    )}
                  >
                    {/* Collapsed header */}
                    <div
                      className="flex items-center gap-2 p-2 cursor-pointer"
                      onClick={() => setExpandedItem(isExpanded ? null : index)}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground tabular-nums w-5 shrink-0">
                        {index + 1}.
                      </span>
                      <span className={cn("text-sm flex-1 truncate", !item.title && "text-muted-foreground italic")}>
                        {item.title || "Ny oppgave"}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); moveItem(index, "up"); }}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); moveItem(index, "down"); }}
                          disabled={index === items.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); removeItem(index); }}
                          disabled={items.length <= 1}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded form */}
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3 border-t">
                        <div className="grid grid-cols-2 gap-3 pt-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Tittel</Label>
                            <Input
                              value={item.title}
                              onChange={(e) => updateItem(index, { title: e.target.value })}
                              placeholder="Oppgavetittel"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Prioritet</Label>
                              <Select
                                value={item.priority}
                                onValueChange={(v) => updateItem(index, { priority: v as TemplateItem["priority"] })}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PRIORITY_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value} className="text-xs">
                                      {o.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Dager fra frist</Label>
                              <Input
                                type="number"
                                value={item.offsetDays}
                                onChange={(e) => updateItem(index, { offsetDays: parseInt(e.target.value) || 0 })}
                                className="h-8 text-sm font-mono"
                              />
                              <p className="text-[10px] text-muted-foreground">
                                Negativt = før fristen
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">Beskrivelse</Label>
                          <Textarea
                            value={item.description ?? ""}
                            onChange={(e) => updateItem(index, { description: e.target.value })}
                            placeholder="Hva skal gjøres"
                            rows={2}
                            className="text-sm"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">Rutinebeskrivelse (valgfritt)</Label>
                          <Textarea
                            value={item.routine ?? ""}
                            onChange={(e) => updateItem(index, { routine: e.target.value })}
                            placeholder="1. Åpne systemet&#10;2. Kontroller data&#10;3. Dokumenter avvik"
                            rows={4}
                            className="text-sm font-mono"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Steg-for-steg instruks som vises i oppgaven.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <p className="text-[11px] text-muted-foreground">
            {isEditing && "Endringer påvirker ikke eksisterende oppgaver."}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Avbryt
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Lagrer...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isEditing ? "Lagre endringer" : "Opprett mal"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
