"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrganization, useUser } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Check, FileUp, Mail, User2, UserPlus, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_CATEGORIES } from "@/lib/db/schema";
import { TASK_CATEGORY_LABELS } from "@/lib/constants/task-categories";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  category?: string | null;
  assigneeId: string | null;
  externalContactId?: string | null;
  notifyExternal?: boolean | null;
  companyId: string | null;
  clientId: string | null;
  dueDate: string | null;
  externalContactName?: string | null;
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

interface Contact {
  id: string;
  name: string;
  email: string;
  company: string | null;
}

interface OrgMember {
  id: string;
  name: string;
  imageUrl?: string;
}

type AssigneeSelection =
  | { type: "none" }
  | { type: "me" }
  | { type: "member"; id: string; name: string; imageUrl?: string }
  | { type: "external"; id: string; name: string; email: string };

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
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
  const { user } = useUser();
  const { memberships } = useOrganization({ memberships: { pageSize: 50 } });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState<string>("none");
  const [companyId, setCompanyId] = useState<string>("none");
  const [clientId, setClientId] = useState<string>("none");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState<AssigneeSelection>({ type: "none" });
  const [notifyExternal, setNotifyExternal] = useState(true);
  const [requestDocument, setRequestDocument] = useState(false);
  const [documentMessage, setDocumentMessage] = useState("");
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [externalContacts, setExternalContacts] = useState<Contact[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentUserId = user?.id;

  const members: OrgMember[] = (memberships?.data ?? []).map((m) => {
    const pub = m.publicUserData;
    return {
      id: pub?.userId ?? "",
      name: [pub?.firstName, pub?.lastName].filter(Boolean).join(" ") || "Ukjent",
      imageUrl: pub?.imageUrl ?? undefined,
    };
  });

  useEffect(() => {
    if (open && !contactsLoaded) {
      fetch("/api/contacts")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setExternalContacts(data);
          setContactsLoaded(true);
        })
        .catch(() => setContactsLoaded(true));
    }
  }, [open, contactsLoaded]);

  useEffect(() => {
    if (open && editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description ?? "");
      setPriority(editingTask.priority);
      setCategory(editingTask.category ?? "none");
      setCompanyId(editingTask.companyId ?? "none");
      setClientId(editingTask.clientId ?? "none");
      setDueDate(editingTask.dueDate ?? "");

      if (editingTask.externalContactId) {
        setAssignee({
          type: "external",
          id: editingTask.externalContactId,
          name: editingTask.externalContactName ?? "Ekstern",
          email: "",
        });
      } else if (editingTask.assigneeId === currentUserId) {
        setAssignee({ type: "me" });
      } else if (editingTask.assigneeId) {
        const m = members.find((mem) => mem.id === editingTask.assigneeId);
        setAssignee(m ? { type: "member", id: m.id, name: m.name, imageUrl: m.imageUrl } : { type: "none" });
      } else {
        setAssignee({ type: "none" });
      }
      setNotifyExternal(editingTask.notifyExternal ?? false);
    } else if (open) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setCategory("none");
      setCompanyId("none");
      setClientId("none");
      setDueDate("");
      setAssignee({ type: "none" });
      setNotifyExternal(true);
      setRequestDocument(false);
      setDocumentMessage("");
    }
  }, [open, editingTask, currentUserId, members.length]);

  const filteredClients = companyId && companyId !== "none"
    ? clients.filter((c) => c.companyId === companyId)
    : clients;

  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);

    const assigneeId =
      assignee.type === "me" ? (currentUserId ?? undefined) :
      assignee.type === "member" ? assignee.id :
      undefined;

    const externalContactId = assignee.type === "external" ? assignee.id : undefined;

    const shouldRequestDoc = assignee.type === "external" && requestDocument && !isEditing;

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      category: category !== "none" ? category : null,
      assigneeId: assigneeId ?? null,
      externalContactId: externalContactId ?? null,
      notifyExternal: shouldRequestDoc ? false : assignee.type === "external" ? notifyExternal : false,
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
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok && shouldRequestDoc && externalContactId) {
        const task = await res.json();
        await fetch("/api/document-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: externalContactId,
            taskId: task.id,
            clientId: clientId !== "none" ? clientId : undefined,
            message: documentMessage.trim() || undefined,
            expiresInDays: 14,
          }),
        });
      }
    }

    setSaving(false);
    onOpenChange(false);
    onSaved();
  }, [title, description, priority, category, assignee, notifyExternal, currentUserId, companyId, clientId, dueDate, isEditing, editingTask, onOpenChange, onSaved]);

  const assigneeLabel =
    assignee.type === "none" ? "Velg person..." :
    assignee.type === "me" ? "Meg selv" :
    assignee.type === "member" ? assignee.name :
    `${assignee.name} (ekstern)`;

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
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg kategori..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen</SelectItem>
                  {TASK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {TASK_CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>

          <div className="space-y-1.5">
            <Label>Tildel til</Label>
            <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start font-normal">
                  {assignee.type === "none" ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <UserPlus className="h-3.5 w-3.5" />
                      Velg person...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 truncate">
                      {assignee.type === "external" ? (
                        <Mail className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                      ) : (
                        <User2 className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {assigneeLabel}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-1" align="start">
                <div className="max-h-64 overflow-y-auto">
                  {currentUserId && (
                    <button
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors",
                        assignee.type === "me" && "bg-accent"
                      )}
                      onClick={() => {
                        setAssignee(assignee.type === "me" ? { type: "none" } : { type: "me" });
                        setAssigneeOpen(false);
                      }}
                    >
                      <User2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Meg selv</span>
                      {assignee.type === "me" && <Check className="h-3 w-3 ml-auto shrink-0" />}
                    </button>
                  )}

                  {members.length > 0 && (
                    <div className="px-2 pt-2 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      <Users className="h-3 w-3 inline mr-1" />
                      Teammedlemmer
                    </div>
                  )}
                  {members
                    .filter((m) => m.id !== currentUserId)
                    .map((m) => (
                    <button
                      key={m.id}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors",
                        assignee.type === "member" && assignee.id === m.id && "bg-accent"
                      )}
                      onClick={() => {
                        setAssignee(
                          assignee.type === "member" && assignee.id === m.id
                            ? { type: "none" }
                            : { type: "member", id: m.id, name: m.name, imageUrl: m.imageUrl }
                        );
                        setAssigneeOpen(false);
                      }}
                    >
                      <Avatar size="sm">
                        {m.imageUrl && <AvatarImage src={m.imageUrl} alt={m.name} />}
                        <AvatarFallback>{initials(m.name)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{m.name}</span>
                      {assignee.type === "member" && assignee.id === m.id && (
                        <Check className="h-3 w-3 ml-auto shrink-0" />
                      )}
                    </button>
                  ))}

                  {externalContacts.length > 0 && (
                    <div className="px-2 pt-2 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      <Mail className="h-3 w-3 inline mr-1" />
                      Eksterne kontakter
                    </div>
                  )}
                  {externalContacts.map((c) => (
                    <button
                      key={c.id}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors",
                        assignee.type === "external" && assignee.id === c.id && "bg-accent"
                      )}
                      onClick={() => {
                        setAssignee(
                          assignee.type === "external" && assignee.id === c.id
                            ? { type: "none" }
                            : { type: "external", id: c.id, name: c.name, email: c.email }
                        );
                        setAssigneeOpen(false);
                      }}
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0 text-violet-600" />
                      <div className="flex flex-col items-start min-w-0">
                        <span className="truncate text-sm">{c.name}</span>
                        <span className="truncate text-[11px] text-muted-foreground">{c.email}</span>
                      </div>
                      {assignee.type === "external" && assignee.id === c.id && (
                        <Check className="h-3 w-3 ml-auto shrink-0" />
                      )}
                    </button>
                  ))}

                  {members.length === 0 && externalContacts.length === 0 && (
                    <p className="px-2 py-3 text-xs text-muted-foreground text-center">
                      Ingen tilgjengelige
                    </p>
                  )}
                </div>
                {assignee.type !== "none" && (
                  <button
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 border-t mt-1 pt-1.5"
                    onClick={() => { setAssignee({ type: "none" }); setAssigneeOpen(false); }}
                  >
                    <X className="h-3 w-3" />
                    Fjern tildeling
                  </button>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {assignee.type === "external" && (
            <div className="space-y-3">
              {!isEditing && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="request-doc-create"
                    checked={requestDocument}
                    onCheckedChange={(v) => {
                      setRequestDocument(v === true);
                      if (v === true) setNotifyExternal(false);
                    }}
                  />
                  <Label htmlFor="request-doc-create" className="text-sm font-normal cursor-pointer flex items-center gap-1.5">
                    <FileUp className="h-3.5 w-3.5 text-emerald-600" />
                    Be om dokumentasjon (opplastingslenke)
                  </Label>
                </div>
              )}

              {requestDocument && !isEditing && (
                <div className="space-y-1.5 pl-6">
                  <Label htmlFor="doc-msg-create" className="text-xs text-muted-foreground">
                    Melding til mottaker (valgfritt)
                  </Label>
                  <Textarea
                    id="doc-msg-create"
                    value={documentMessage}
                    onChange={(e) => setDocumentMessage(e.target.value)}
                    placeholder="Beskriv hvilken dokumentasjon du trenger..."
                    className="min-h-[60px] text-sm resize-none"
                  />
                </div>
              )}

              {!requestDocument && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="notify-ext-create"
                    checked={notifyExternal}
                    onCheckedChange={(v) => setNotifyExternal(v === true)}
                  />
                  <Label htmlFor="notify-ext-create" className="text-sm font-normal cursor-pointer">
                    Send purring på e-post
                  </Label>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
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
