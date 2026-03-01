"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTutorialMode } from "@/contexts/tutorial-mode-context";

interface TutorialSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TutorialSaveDialog({ open, onOpenChange }: TutorialSaveDialogProps) {
  const { recordedSteps, stopRecording, clearRecording } = useTutorialMode();
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"all" | "specific">("all");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim() || recordedSteps.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tutorials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          pathnamePattern: pathname,
          visibility,
          steps: recordedSteps.map((s) => ({
            elementSelector: s.elementSelector,
            title: s.title,
            description: s.description || undefined,
            pathname: s.pathname,
            tooltipPosition: s.tooltipPosition,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? "Kunne ikke lagre tutorial");
        return;
      }
      toast.success("Tutorial lagret");
      stopRecording();
      clearRecording();
      onOpenChange(false);
      setName("");
      setDescription("");
      router.refresh();
    } catch {
      toast.error("Kunne ikke lagre tutorial");
    } finally {
      setSaving(false);
    }
  }, [name, description, visibility, pathname, recordedSteps, stopRecording, clearRecording, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lagre tutorial</DialogTitle>
          <DialogDescription>
            {recordedSteps.length} steg tatt opp. Gi tutorial et navn og velg synlighet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tutorial-name">Navn</Label>
            <Input
              id="tutorial-name"
              placeholder="F.eks. Hvordan importere transaksjoner"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tutorial-desc">Beskrivelse (valgfritt)</Label>
            <Input
              id="tutorial-desc"
              placeholder="Kort beskrivelse av hva tutorialen viser"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Synlighet</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisibility("all")}
                className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                  visibility === "all"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted border-border hover:bg-muted/80"
                }`}
              >
                Alle brukere
              </button>
              <button
                type="button"
                onClick={() => setVisibility("specific")}
                className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                  visibility === "specific"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted border-border hover:bg-muted/80"
                }`}
              >
                Spesifikke roller
              </button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Side: <span className="font-mono">{pathname}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || recordedSteps.length === 0 || saving}
          >
            {saving ? "Lagrer..." : "Lagre tutorial"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
