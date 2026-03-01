"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Contact {
  id: string;
  name: string;
  email: string;
  role: string | null;
  company: string | null;
  phone: string | null;
  notes: string | null;
}

type FormState = {
  name: string;
  email: string;
  role: string;
  company: string;
  phone: string;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  email: "",
  role: "",
  company: "",
  phone: "",
  notes: "",
};

export function ContactsTab({ isEn }: { isEn: boolean }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts");
      if (res.ok) setContacts(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      email: c.email,
      role: c.role ?? "",
      company: c.company ?? "",
      phone: c.phone ?? "",
      notes: c.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch("/api/contacts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...form }),
        });
        if (res.ok) {
          const updated: Contact = await res.json();
          setContacts((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c))
          );
          setDialogOpen(false);
        }
      } else {
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (res.ok) {
          const created: Contact = await res.json();
          setContacts((prev) => [...prev, created]);
          setDialogOpen(false);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/contacts?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        {isEn ? "Loading contacts..." : "Laster kontakter..."}
      </div>
    );
  }

  const isEditing = editingId !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">
            {isEn ? "Contact list" : "Kontaktliste"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isEn
              ? "External contacts such as auditors, clients, and collaborators. The AI assistant can use these to send reports directly."
              : "Eksterne kontaktpersoner som revisorer, kunder og samarbeidspartnere. AI-assistenten kan bruke disse til å sende rapporter direkte."}
          </p>
        </div>

        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 size-4" />
          {isEn ? "Add contact" : "Legg til kontakt"}
        </Button>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? isEn ? "Edit contact" : "Rediger kontakt"
                : isEn ? "New contact" : "Ny kontakt"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? isEn
                  ? "Update the contact details below."
                  : "Oppdater kontaktopplysningene under."
                : isEn
                  ? "Add an external contact person. Name and email are required."
                  : "Legg til en ekstern kontaktperson. Navn og e-post er påkrevd."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isEn ? "Name" : "Navn"} *</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Kari Nordmann"
                />
              </div>
              <div className="space-y-2">
                <Label>{isEn ? "Email" : "E-post"} *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, email: e.target.value }))
                  }
                  placeholder="kari@firma.no"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isEn ? "Role" : "Rolle"}</Label>
                <Input
                  value={form.role}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, role: e.target.value }))
                  }
                  placeholder={isEn ? "e.g. Auditor" : "f.eks. Revisor"}
                />
              </div>
              <div className="space-y-2">
                <Label>{isEn ? "Company" : "Selskap"}</Label>
                <Input
                  value={form.company}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, company: e.target.value }))
                  }
                  placeholder="Firma AS"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isEn ? "Phone" : "Telefon"}</Label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="+47 123 45 678"
                />
              </div>
              <div className="space-y-2">
                <Label>{isEn ? "Notes" : "Notater"}</Label>
                <Input
                  value={form.notes}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder={isEn ? "Optional notes" : "Valgfrie notater"}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {isEn ? "Cancel" : "Avbryt"}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.email.trim()}
            >
              {saving
                ? isEn
                  ? "Saving..."
                  : "Lagrer..."
                : isEditing
                  ? isEn
                    ? "Save changes"
                    : "Lagre endringer"
                  : isEn
                    ? "Add"
                    : "Legg til"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <Users className="mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">
            {isEn ? "No contacts yet" : "Ingen kontakter ennå"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground max-w-[320px]">
            {isEn
              ? "Add your auditor, clients, or other contacts. The AI assistant will be able to look them up when sending reports."
              : "Legg til revisor, kunder eller andre kontakter. AI-assistenten kan slå dem opp når den sender rapporter."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isEn ? "Name" : "Navn"}</TableHead>
                <TableHead>{isEn ? "Email" : "E-post"}</TableHead>
                <TableHead>{isEn ? "Role" : "Rolle"}</TableHead>
                <TableHead>{isEn ? "Company" : "Selskap"}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.role ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.company ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(c.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
