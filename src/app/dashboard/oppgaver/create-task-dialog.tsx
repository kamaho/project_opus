"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  companyId: string | null;
  clientId: string | null;
  dueDate: string | null;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface ClientOption {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  companies,
  clients,
  editingTask,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companies: CompanyOption[];
  clients: ClientOption[];
  editingTask: TaskRow | null;
  onSaved: () => void;
}) {
  const isEditing = !!editingTask;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [companyId, setCompanyId] = useState<string>("none");
  const [clientId, setClientId] = useState<string>("none");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description ?? "");
      setPriority(editingTask.priority);
      setCompanyId(editingTask.companyId ?? "none");
      setClientId(editingTask.clientId ?? "none");
      setDueDate(editingTask.dueDate ?? "");
    } else if (open) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setCompanyId("none");
      setClientId("none");
      setDueDate("");
    }
  }, [open, editingTask]);

  const filteredClients = companyId && companyId !== "none"
    ? clients.filter((c) => c.companyId === companyId)
    : clients;

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      companyId: companyId !== "none" ? companyId : undefined,
      clientId: clientId !== "none" ? clientId : undefined,
      dueDate: dueDate || undefined,
    };

    if (isEditing) {
      await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setSaving(false);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Rediger oppgave" : "Ny oppgave"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Tittel</Label>
            <Input
              id="task-title"
              placeholder="Beskriv oppgaven..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Beskrivelse</Label>
            <textarea
              id="task-desc"
              placeholder="Detaljer (valgfritt)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioritet</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Lav</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">Høy</SelectItem>
                  <SelectItem value="critical">Kritisk</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Frist</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Selskap</Label>
              <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setClientId("none"); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg selskap" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Klient</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg klient" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen</SelectItem>
                  {filteredClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {companyId === "none" ? `(${c.companyName})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button onClick={handleSave} disabled={!title.trim() || saving}>
              {saving ? "Lagrer..." : isEditing ? "Lagre endringer" : "Opprett oppgave"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
