"use client";

import {
  UserCog,
  Users,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  Timer,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface TeamMember {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  role: string;
  assignedClients: number;
  tasksOpen: number;
  tasksInProgress: number;
  tasksOverdue: number;
  tasksCompletedThisMonth: number;
}

const ROLE_LABELS: Record<string, string> = {
  "org:admin": "Admin",
  "org:member": "Medlem",
  admin: "Admin",
  basic_member: "Medlem",
};

export function TeamClient({ members }: { members: TeamMember[] }) {
  const totalClients = members.reduce((s, m) => s + m.assignedClients, 0);
  const totalOpen = members.reduce((s, m) => s + m.tasksOpen, 0);
  const totalInProgress = members.reduce((s, m) => s + m.tasksInProgress, 0);
  const totalOverdue = members.reduce((s, m) => s + m.tasksOverdue, 0);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <UserCog className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Team</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Teamoversikt med kapasitetsvisning og oppgavefordeling.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Teammedlemmer"
          value={members.length}
          icon={<Users className="size-4 text-muted-foreground" />}
        />
        <StatCard
          label="Tildelte klienter"
          value={totalClients}
          icon={<Briefcase className="size-4 text-muted-foreground" />}
        />
        <StatCard
          label="Åpne oppgaver"
          value={totalOpen + totalInProgress}
          icon={<Circle className="size-4 text-blue-500" />}
        />
        <StatCard
          label="Forfalte oppgaver"
          value={totalOverdue}
          icon={<AlertCircle className="size-4 text-red-500" />}
          highlight={totalOverdue > 0}
        />
      </div>

      {/* Team member cards */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Medlem</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-24">Rolle</th>
                <th className="px-4 py-2.5 text-center font-medium text-muted-foreground w-20">Klienter</th>
                <th className="px-4 py-2.5 text-center font-medium text-muted-foreground w-20">Åpne</th>
                <th className="px-4 py-2.5 text-center font-medium text-muted-foreground w-20">Pågår</th>
                <th className="px-4 py-2.5 text-center font-medium text-muted-foreground w-20">Forfalt</th>
                <th className="px-4 py-2.5 text-center font-medium text-muted-foreground w-24">Fullført (mnd)</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-40">Kapasitet</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((m) => {
                const totalActive = m.tasksOpen + m.tasksInProgress;
                const capacityPct = Math.min(100, (totalActive / Math.max(1, totalActive + 3)) * 100);
                const initials = `${(m.firstName ?? "")[0] ?? ""}${(m.lastName ?? "")[0] ?? ""}`.toUpperCase() || "?";
                const fullName = [m.firstName, m.lastName].filter(Boolean).join(" ") || "Ukjent bruker";

                return (
                  <tr key={m.userId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {m.imageUrl && <AvatarImage src={m.imageUrl} alt={fullName} />}
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[11px]">
                        {ROLE_LABELS[m.role] ?? m.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">{m.assignedClients}</td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      <span className={m.tasksOpen > 0 ? "text-blue-600 dark:text-blue-400 font-medium" : "text-muted-foreground"}>
                        {m.tasksOpen}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      <span className={m.tasksInProgress > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}>
                        {m.tasksInProgress}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      <span className={m.tasksOverdue > 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}>
                        {m.tasksOverdue}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      <span className={m.tasksCompletedThisMonth > 0 ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}>
                        {m.tasksCompletedThisMonth}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              capacityPct > 80 ? "bg-red-500" :
                              capacityPct > 50 ? "bg-amber-500" :
                              "bg-green-500"
                            )}
                            style={{ width: `${capacityPct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground tabular-nums w-6 text-right">
                          {totalActive}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {members.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-muted-foreground">Ingen teammedlemmer funnet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-lg border bg-card px-4 py-3",
      highlight && "border-red-500/30 bg-red-500/5"
    )}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <p className={cn("text-2xl font-semibold tabular-nums", highlight && "text-red-500")}>
        {value}
      </p>
    </div>
  );
}
