"use client";

import { useState } from "react";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  Plus,
  X,
  Send,
  Building2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface InviteEntry {
  id: string;
  email: string;
  role: "org:admin" | "org:member";
}

interface StepInviteTeamProps {
  onNext: () => void;
}

export function StepInviteTeam({ onNext }: StepInviteTeamProps) {
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const orgList = useOrganizationList();

  const [orgName, setOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [invites, setInvites] = useState<InviteEntry[]>([
    { id: crypto.randomUUID(), email: "", role: "org:member" },
  ]);
  const [sending, setSending] = useState(false);

  async function handleCreateOrg() {
    if (!orgName.trim() || !orgList?.createOrganization || !orgList?.setActive)
      return;
    setCreatingOrg(true);
    try {
      const org = await orgList.createOrganization({ name: orgName.trim() });
      await orgList.setActive({ organization: org.id });
      toast.success("Organisasjon opprettet!");
    } catch (err) {
      toast.error("Kunne ikke opprette organisasjon. Prøv igjen.");
      console.error(err);
    } finally {
      setCreatingOrg(false);
    }
  }

  function addInvite() {
    setInvites((prev) => [
      ...prev,
      { id: crypto.randomUUID(), email: "", role: "org:member" },
    ]);
  }

  function removeInvite(id: string) {
    setInvites((prev) => prev.filter((inv) => inv.id !== id));
  }

  function updateInvite(id: string, updates: Partial<InviteEntry>) {
    setInvites((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv))
    );
  }

  async function handleSendInvites() {
    const validInvites = invites.filter((inv) => inv.email.trim());
    if (!validInvites.length) {
      onNext();
      return;
    }
    if (!organization) {
      toast.error("Opprett en organisasjon først.");
      return;
    }
    setSending(true);
    let successCount = 0;
    for (const inv of validInvites) {
      try {
        await organization.inviteMember({
          emailAddress: inv.email.trim(),
          role: inv.role,
        });
        successCount++;
      } catch (err: unknown) {
        const clerkErr = err as { errors?: { message?: string }[] };
        const msg =
          clerkErr?.errors?.[0]?.message ?? "Kunne ikke sende invitasjon";
        toast.error(`${inv.email}: ${msg}`);
      }
    }
    if (successCount > 0) {
      toast.success(
        `${successCount} invitasjon${successCount > 1 ? "er" : ""} sendt!`
      );
    }
    setSending(false);
    onNext();
  }

  if (!orgLoaded) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Opprett organisasjon
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Gi organisasjonen din et navn. Du kan invitere teamet ditt etterpå.
          </p>
        </div>
        <div className="max-w-sm mx-auto space-y-3">
          <Input
            placeholder="Firmanavn"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
            autoFocus
          />
          <Button
            onClick={handleCreateOrg}
            disabled={!orgName.trim() || creatingOrg}
            className="w-full"
          >
            {creatingOrg ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Opprett organisasjon"
            )}
          </Button>
        </div>
        <button
          onClick={onNext}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Hopp over
        </button>
      </div>
    );
  }

  const hasValidEmails = invites.some((inv) => inv.email.trim());

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Inviter teamet ditt
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Legg til kollegaer som skal bruke Revizo.
          Du kan alltid invitere flere senere.
        </p>
      </div>

      <div className="space-y-3 max-w-lg mx-auto">
        {invites.map((inv) => (
          <div key={inv.id} className="flex items-center gap-2">
            <Input
              type="email"
              placeholder="navn@firma.no"
              value={inv.email}
              onChange={(e) =>
                updateInvite(inv.id, { email: e.target.value })
              }
              className="flex-1"
            />
            <Select
              value={inv.role}
              onValueChange={(val) =>
                updateInvite(inv.id, {
                  role: val as InviteEntry["role"],
                })
              }
            >
              <SelectTrigger className={cn("w-[160px]")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="org:admin">Administrator</SelectItem>
                <SelectItem value="org:member">Medarbeider</SelectItem>
              </SelectContent>
            </Select>
            {invites.length > 1 && (
              <button
                onClick={() => removeInvite(inv.id)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}

        <button
          onClick={addInvite}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Legg til flere
        </button>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button
          size="lg"
          onClick={handleSendInvites}
          disabled={sending}
          className="gap-2"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : hasValidEmails ? (
            <>
              Send invitasjoner
              <Send className="h-4 w-4" />
            </>
          ) : (
            <>
              Fortsett
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
        {hasValidEmails && (
          <button
            onClick={onNext}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Hopp over — jeg inviterer senere
          </button>
        )}
      </div>
    </div>
  );
}
