"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GripVertical,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RuleRow {
  id: string;
  name: string;
  priority: number;
  isActive: boolean | null;
  ruleType: string;
  isInternal: boolean | null;
  dateMustMatch: boolean | null;
  dateToleranceDays: number | null;
  compareCurrency: string | null;
  allowTolerance: boolean | null;
  toleranceAmount: string | null;
  conditions: unknown;
}

interface MatchingRulesClientProps {
  clientId: string;
  initialRules: RuleRow[];
}

const RULE_TYPE_LABELS: Record<string, string> = {
  one_to_one: "1:1",
  many_to_one: "Mange:1",
  many_to_many: "Mange:Mange",
};

function ruleDescription(r: RuleRow): string {
  const parts: string[] = [];
  parts.push(RULE_TYPE_LABELS[r.ruleType] ?? r.ruleType);
  if (r.isInternal) parts.push("intern");
  if (r.dateMustMatch) {
    parts.push(r.dateToleranceDays ? `dato ±${r.dateToleranceDays}d` : "dato lik");
  } else {
    parts.push("uten datokrav");
  }
  if (r.allowTolerance && r.toleranceAmount && parseFloat(r.toleranceAmount) > 0) {
    parts.push(`tol. ±${r.toleranceAmount}`);
  }
  return parts.join(" · ");
}

interface EditFormState {
  name: string;
  ruleType: string;
  isInternal: boolean;
  dateMustMatch: boolean;
  dateToleranceDays: number;
  compareCurrency: string;
  allowTolerance: boolean;
  toleranceAmount: string;
  isActive: boolean;
}

const EMPTY_FORM: EditFormState = {
  name: "",
  ruleType: "one_to_one",
  isInternal: false,
  dateMustMatch: true,
  dateToleranceDays: 0,
  compareCurrency: "local",
  allowTolerance: false,
  toleranceAmount: "0",
  isActive: true,
};

export function MatchingRulesClient({ clientId, initialRules }: MatchingRulesClientProps) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<EditFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const openCreate = useCallback(() => {
    setEditId(null);
    setForm({ ...EMPTY_FORM, name: `Regel ${rules.length + 1}` });
    setEditOpen(true);
  }, [rules.length]);

  const openEdit = useCallback((r: RuleRow) => {
    setEditId(r.id);
    setForm({
      name: r.name,
      ruleType: r.ruleType,
      isInternal: r.isInternal ?? false,
      dateMustMatch: r.dateMustMatch ?? true,
      dateToleranceDays: r.dateToleranceDays ?? 0,
      compareCurrency: r.compareCurrency ?? "local",
      allowTolerance: r.allowTolerance ?? false,
      toleranceAmount: r.toleranceAmount ?? "0",
      isActive: r.isActive ?? true,
    });
    setEditOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (editId) {
        const res = await fetch(
          `/api/clients/${clientId}/matching-rules?ruleId=${editId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          }
        );
        if (!res.ok) { toast.error("Kunne ikke oppdatere regelen"); return; }
      } else {
        const priority = rules.length > 0 ? Math.max(...rules.map((r) => r.priority)) + 1 : 1;
        const res = await fetch(`/api/clients/${clientId}/matching-rules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, priority }),
        });
        if (!res.ok) { toast.error("Kunne ikke opprette regelen"); return; }
      }
      toast.success(editId ? "Regel oppdatert" : "Regel opprettet");
      setEditOpen(false);
      router.refresh();
      const res = await fetch(`/api/clients/${clientId}/matching-rules`);
      if (res.ok) setRules(await res.json());
    } finally {
      setSaving(false);
    }
  }, [editId, form, clientId, rules, router]);

  const handleDelete = useCallback(async (ruleId: string) => {
    const res = await fetch(
      `/api/clients/${clientId}/matching-rules?ruleId=${ruleId}`,
      { method: "DELETE" }
    );
    if (!res.ok) { toast.error("Kunne ikke slette regelen"); return; }
    toast.success("Regel slettet");
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
  }, [clientId]);

  const handleToggle = useCallback(async (ruleId: string, isActive: boolean) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, isActive } : r))
    );
    await fetch(
      `/api/clients/${clientId}/matching-rules?ruleId=${ruleId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }
    );
  }, [clientId]);

  const handleSeedStandard = useCallback(async () => {
    setSeeding(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/matching-rules/seed`, {
        method: "POST",
      });
      if (!res.ok) { toast.error("Kunne ikke seede regler"); return; }
      const data = await res.json();
      if (data.skipped) {
        toast.info("Regler finnes allerede for denne klienten");
      } else {
        toast.success(`${data.seeded} standardregler opprettet`);
        const listRes = await fetch(`/api/clients/${clientId}/matching-rules`);
        if (listRes.ok) setRules(await listRes.json());
      }
    } finally {
      setSeeding(false);
    }
  }, [clientId]);

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Ny regel
        </Button>
        {rules.length === 0 && (
          <Button size="sm" variant="outline" onClick={handleSeedStandard} disabled={seeding}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {seeding ? "Oppretter…" : "Last inn standardregler"}
          </Button>
        )}
      </div>

      {rules.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          <p className="text-sm">Ingen matching-regler konfigurert.</p>
          <p className="text-xs mt-1">
            Opprett en ny regel eller last inn standardregler for å komme i gang.
          </p>
        </div>
      ) : (
        <div className="rounded-md border divide-y">
          {rules.map((r) => (
            <div
              key={r.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 transition-colors",
                !(r.isActive ?? true) && "opacity-50"
              )}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground tabular-nums w-5 shrink-0">
                    {r.priority}
                  </span>
                  <span className="text-sm font-medium truncate">{r.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 pl-7">
                  {ruleDescription(r)}
                </p>
              </div>
              <Switch
                checked={r.isActive ?? true}
                onCheckedChange={(v) => handleToggle(r.id, v)}
              />
              <button
                type="button"
                className="p-1 rounded-sm hover:bg-muted transition-colors"
                onClick={() => openEdit(r)}
                title="Rediger"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                type="button"
                className="p-1 rounded-sm hover:bg-destructive/10 transition-colors"
                onClick={() => handleDelete(r.id)}
                title="Slett"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Rediger regel" : "Ny regel"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Navn</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Regeltype</Label>
                <Select
                  value={form.ruleType}
                  onValueChange={(v) => setForm((f) => ({ ...f, ruleType: v }))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_to_one">1:1</SelectItem>
                    <SelectItem value="many_to_one">Mange:1</SelectItem>
                    <SelectItem value="many_to_many">Mange:Mange</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Valuta</Label>
                <Select
                  value={form.compareCurrency}
                  onValueChange={(v) => setForm((f) => ({ ...f, compareCurrency: v }))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Lokalvaluta</SelectItem>
                    <SelectItem value="foreign">Fremmedvaluta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Intern matching (innen samme mengde)</Label>
              <Switch
                checked={form.isInternal}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isInternal: v }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Dato må stemme</Label>
              <Switch
                checked={form.dateMustMatch}
                onCheckedChange={(v) => setForm((f) => ({ ...f, dateMustMatch: v }))}
              />
            </div>

            {form.dateMustMatch && (
              <div className="space-y-1.5">
                <Label>Datotoleranse (dager)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.dateToleranceDays}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      dateToleranceDays: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="h-8 text-sm"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>Tillat beløpsdifferanse</Label>
              <Switch
                checked={form.allowTolerance}
                onCheckedChange={(v) => setForm((f) => ({ ...f, allowTolerance: v }))}
              />
            </div>

            {form.allowTolerance && (
              <div className="space-y-1.5">
                <Label>Maks differanse</Label>
                <Input
                  value={form.toleranceAmount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, toleranceAmount: e.target.value }))
                  }
                  className="h-8 text-sm font-mono"
                  placeholder="0.00"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(false)}
              >
                Avbryt
              </Button>
              <Button
                size="sm"
                disabled={saving || !form.name.trim()}
                onClick={handleSave}
              >
                {saving ? "Lagrer…" : editId ? "Oppdater" : "Opprett"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
