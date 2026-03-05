"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Mail, Plus, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  email: string;
  company: string | null;
}

export type ContactAction = "purring" | "dokumentforespørsel" | "kontoutskrift";

const ACTION_LABELS: Record<ContactAction, string> = {
  purring: "Send purring",
  dokumentforespørsel: "Send dokumentasjonsforespørsel",
  kontoutskrift: "Send kontoutskrift",
};

interface ContactPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ContactAction;
  kundeNavn: string;
  defaultMessage?: string;
  onConfirm: (contact: Contact, message?: string) => Promise<void>;
}

export function ContactPickerDialog({
  open,
  onOpenChange,
  action,
  kundeNavn,
  defaultMessage,
  onConfirm,
}: ContactPickerDialogProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    if (open) {
      setLoading(true);
      setSelected(null);
      setMessage(defaultMessage ?? "");
      setShowCreate(false);
      setNewName("");
      setNewEmail("");
      fetch("/api/contacts")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setContacts(data);
        })
        .catch((err) => console.error("[contact-picker] Failed to load contacts:", err))
        .finally(() => setLoading(false));
    }
  }, [open, defaultMessage]);

  const filtered = contacts.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company?.toLowerCase().includes(q) ?? false)
    );
  });

  const handleCreateContact = useCallback(async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim() }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setContacts((prev) => [...prev, created]);
      setSelected(created);
      setShowCreate(false);
      toast.success(`Kontakt ${created.name} opprettet`);
    } catch {
      toast.error("Kunne ikke opprette kontakt");
    } finally {
      setSubmitting(false);
    }
  }, [newName, newEmail]);

  const handleSubmit = useCallback(async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await onConfirm(selected, message.trim() || undefined);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Handlingen feilet");
    } finally {
      setSubmitting(false);
    }
  }, [selected, message, onConfirm, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ACTION_LABELS[action]}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Velg mottaker for {kundeNavn}
        </p>

        <div className="space-y-3 pt-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Søk kontakter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="max-h-48 overflow-y-auto rounded-md border">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                Ingen kontakter funnet
              </p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/50",
                    selected?.id === c.id && "bg-accent",
                  )}
                  onClick={() => setSelected(selected?.id === c.id ? null : c)}
                >
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{c.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{c.email}</p>
                  </div>
                  {selected?.id === c.id && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>

          {!showCreate ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-3 w-3" />
              Ny kontakt
            </Button>
          ) : (
            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px]">Navn</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-7 text-xs"
                    placeholder="Ola Nordmann"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">E-post</Label>
                  <Input
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="h-7 text-xs"
                    type="email"
                    placeholder="ola@firma.no"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setShowCreate(false)}
                >
                  Avbryt
                </Button>
                <Button
                  size="sm"
                  className="h-6 text-[11px]"
                  disabled={!newName.trim() || !newEmail.trim() || submitting}
                  onClick={handleCreateContact}
                >
                  Opprett
                </Button>
              </div>
            </div>
          )}

          {action === "dokumentforespørsel" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Melding til mottaker (valgfritt)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Beskriv hvilken dokumentasjon du trenger..."
                className="min-h-[80px] text-xs"
              />
            </div>
          )}

          {action === "purring" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Purremelding (valgfritt)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Vi viser til utestående faktura(er)..."
                className="min-h-[60px] text-xs resize-none"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button
              size="sm"
              disabled={!selected || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Sender...
                </>
              ) : (
                ACTION_LABELS[action]
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
