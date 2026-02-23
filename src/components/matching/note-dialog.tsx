"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, AtSign } from "lucide-react";
import { useOrganization } from "@clerk/nextjs";

interface NoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  transactionIds: string[];
  onSaved?: (text: string) => void;
}

interface OrgMember {
  id: string;
  name: string;
  email: string;
}

export function NoteDialog({
  open,
  onOpenChange,
  clientId,
  transactionIds,
  onSaved,
}: NoteDialogProps) {
  const [text, setText] = useState("");
  const [mentionSearch, setMentionSearch] = useState("");
  const [selectedMention, setSelectedMention] = useState<OrgMember | null>(null);
  const [showMention, setShowMention] = useState(false);
  const [saving, setSaving] = useState(false);
  const { memberships } = useOrganization({ memberships: { pageSize: 50 } });

  useEffect(() => {
    if (open) {
      setText("");
      setSelectedMention(null);
      setShowMention(false);
    }
  }, [open]);

  const members: OrgMember[] = (memberships?.data ?? []).map((m) => {
    const pub = m.publicUserData;
    return {
      id: pub?.userId ?? "",
      name: [pub?.firstName, pub?.lastName].filter(Boolean).join(" ") || "Ukjent",
      email: pub?.identifier ?? "",
    };
  });

  const filteredMembers = mentionSearch
    ? members.filter(
        (m) =>
          m.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
          m.email.toLowerCase().includes(mentionSearch.toLowerCase())
      )
    : members;

  const handleSave = useCallback(async () => {
    if (!text.trim() || transactionIds.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/transactions/bulk-note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionIds,
          text: text.trim(),
          mentionedUserId: selectedMention?.id,
        }),
      });
      if (res.ok) {
        onSaved?.(text.trim());
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  }, [text, selectedMention, clientId, transactionIds, onSaved, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Legg til notat på {transactionIds.length} transaksjon{transactionIds.length > 1 ? "er" : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Notat</Label>
            <Textarea
              placeholder="Skriv et notat…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[100px] text-sm resize-none"
              autoFocus
            />
          </div>

          {showMention ? (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Varsle bruker</Label>
              {selectedMention ? (
                <div className="flex items-center gap-2 text-sm border rounded-md px-2 py-1.5">
                  <AtSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{selectedMention.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 ml-auto shrink-0"
                    onClick={() => setSelectedMention(null)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Søk etter bruker…"
                    value={mentionSearch}
                    onChange={(e) => setMentionSearch(e.target.value)}
                    className="h-8 text-sm"
                  />
                  {filteredMembers.length > 0 && (
                    <div className="max-h-40 overflow-auto border rounded-md">
                      {filteredMembers.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                          onClick={() => {
                            setSelectedMention(m);
                            setMentionSearch("");
                          }}
                        >
                          <span className="font-medium">{m.name}</span>
                          <span className="text-muted-foreground ml-1 text-xs">{m.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowMention(true)}
            >
              <AtSign className="h-3 w-3" />
              Varsle en bruker
            </button>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={saving || !text.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Lagre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
