"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";

export interface ClientOption {
  id: string;
  matchGroup: string;
  company: string;
}

export interface EditGroupInfo {
  id: string;
  name: string;
  members: { clientId: string }[];
}

interface ClientGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientOption[];
  preselectedIds?: string[];
  /** When set, dialog is in edit mode for this group */
  editGroup?: EditGroupInfo | null;
  onSave: (name: string, clientIds: string[]) => Promise<void>;
}

export function ClientGroupDialog({
  open,
  onOpenChange,
  clients,
  preselectedIds = [],
  editGroup = null,
  onSave,
}: ClientGroupDialogProps) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const isEdit = !!editGroup;
  useEffect(() => {
    if (!open) return;
    if (editGroup) {
      setName(editGroup.name);
      setSelected(new Set(editGroup.members.map((m) => m.clientId)));
    } else {
      setName("");
      setSelected(new Set(preselectedIds));
    }
    setSearch("");
  }, [open, editGroup, preselectedIds]);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.matchGroup.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q)
    );
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim() || selected.size < 2) return;
    setSaving(true);
    try {
      await onSave(name.trim(), Array.from(selected));
      if (!isEdit) {
        setName("");
        setSelected(new Set());
        setSearch("");
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Rediger gruppe" : "Opprett klientgruppe"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Gruppenavn</Label>
            <Input
              id="group-name"
              placeholder="F.eks. Alle 1920-kontoer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Velg klienter ({selected.size} valgt)</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søk etter klient eller selskap..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border">
              {filtered.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                >
                  <Checkbox
                    checked={selected.has(c.id)}
                    onCheckedChange={() => toggle(c.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.matchGroup}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.company}</p>
                  </div>
                </label>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                  Ingen klienter funnet
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || selected.size < 2 || saving}
          >
            {saving ? "Lagrer..." : isEdit ? "Lagre" : "Opprett gruppe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
