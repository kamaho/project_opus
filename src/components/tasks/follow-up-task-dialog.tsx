"use client";

import { useCallback, useEffect, useState } from "react";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { TASK_CATEGORY_LABELS, TASK_CATEGORY_GROUPS } from "@/lib/constants/task-categories";
import { toast } from "sonner";

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

export interface FollowUpTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onTitleChange: (title: string) => void;
  clientId?: string;
  clientName?: string;
  infoRows?: { label: string; value: string }[];
  onSubmit: (payload: FollowUpPayload) => Promise<boolean>;
}

export interface FollowUpPayload {
  title: string;
  category: string | null;
  assigneeId: string | null;
  externalContactId: string | null;
  notifyExternal: boolean;
  requestDocument?: boolean;
  documentMessage?: string;
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

export function FollowUpTaskDialog({
  open,
  onOpenChange,
  title,
  onTitleChange,
  clientName,
  infoRows,
  onSubmit,
}: FollowUpTaskDialogProps) {
  const { user } = useUser();
  const { memberships } = useOrganization({ memberships: { pageSize: 50 } });

  const [category, setCategory] = useState<string>("");
  const [assignee, setAssignee] = useState<AssigneeSelection>({ type: "none" });
  const [notifyExternal, setNotifyExternal] = useState(true);
  const [requestDocument, setRequestDocument] = useState(false);
  const [documentMessage, setDocumentMessage] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setCategory("");
      setAssignee({ type: "none" });
      setNotifyExternal(true);
      setRequestDocument(false);
      setDocumentMessage("");
      setSaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (open && !contactsLoaded) {
      fetch("/api/contacts")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setContacts(data);
          setContactsLoaded(true);
        })
        .catch(() => setContactsLoaded(true));
    }
  }, [open, contactsLoaded]);

  const members: OrgMember[] = (memberships?.data ?? []).map((m) => {
    const pub = m.publicUserData;
    return {
      id: pub?.userId ?? "",
      name: [pub?.firstName, pub?.lastName].filter(Boolean).join(" ") || "Ukjent",
      imageUrl: pub?.imageUrl ?? undefined,
    };
  });

  const currentUserId = user?.id;

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);

    const isExternal = assignee.type === "external";
    const payload: FollowUpPayload = {
      title: title.trim(),
      category: category || null,
      assigneeId:
        assignee.type === "me" ? (currentUserId ?? null) :
        assignee.type === "member" ? assignee.id :
        null,
      externalContactId: isExternal ? assignee.id : null,
      notifyExternal: isExternal ? notifyExternal : false,
      requestDocument: isExternal ? requestDocument : false,
      documentMessage: isExternal && requestDocument ? documentMessage.trim() || undefined : undefined,
    };

    const ok = await onSubmit(payload);
    setSaving(false);
    if (ok) onOpenChange(false);
  }, [title, category, assignee, notifyExternal, currentUserId, onSubmit, onOpenChange]);

  const assigneeLabel =
    assignee.type === "none" ? "Velg person..." :
    assignee.type === "me" ? "Meg selv" :
    assignee.type === "member" ? assignee.name :
    `${assignee.name} (ekstern)`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Opprett oppgave</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="followup-title">Tittel</Label>
            <Input
              id="followup-title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Velg kategori..." />
              </SelectTrigger>
              <SelectContent>
                {TASK_CATEGORY_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.items.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {TASK_CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
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
                  {/* Me shortcut */}
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

                  {/* Team members */}
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

                  {/* External contacts */}
                  {contacts.length > 0 && (
                    <div className="px-2 pt-2 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      <Mail className="h-3 w-3 inline mr-1" />
                      Eksterne kontakter
                    </div>
                  )}
                  {contacts.map((c) => (
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

                  {members.length === 0 && contacts.length === 0 && (
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
              <div className="flex items-center gap-2">
                <Checkbox
                  id="request-document"
                  checked={requestDocument}
                  onCheckedChange={(v) => {
                    setRequestDocument(v === true);
                    if (v === true) setNotifyExternal(false);
                  }}
                />
                <Label htmlFor="request-document" className="text-sm font-normal cursor-pointer flex items-center gap-1.5">
                  <FileUp className="h-3.5 w-3.5 text-emerald-600" />
                  Be om dokumentasjon (opplastingslenke)
                </Label>
              </div>

              {requestDocument && (
                <div className="space-y-1.5 pl-6">
                  <Label htmlFor="doc-message" className="text-xs text-muted-foreground">
                    Melding til mottaker (valgfritt)
                  </Label>
                  <Textarea
                    id="doc-message"
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
                    id="notify-external"
                    checked={notifyExternal}
                    onCheckedChange={(v) => setNotifyExternal(v === true)}
                  />
                  <Label htmlFor="notify-external" className="text-sm font-normal cursor-pointer">
                    Send purring på e-post
                  </Label>
                </div>
              )}
            </div>
          )}

          {infoRows && infoRows.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
              {infoRows.map((row) => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span>{row.value}</span>
                </div>
              ))}
              {clientName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Klient</span>
                  <span>{clientName}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button onClick={handleSubmit} disabled={saving || !title.trim()}>
              {saving ? "Oppretter..." : "Opprett oppgave"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
