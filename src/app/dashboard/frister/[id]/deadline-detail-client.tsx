"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ClipboardCheck, Plus, LayoutTemplate, ArrowRight, UserCircle, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/dashboard/frister/status-badge";
import DaysRemaining from "@/components/dashboard/frister/days-remaining";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CreateTaskDialog } from "@/app/dashboard/oppgaver/create-task-dialog";
import { TemplatePickerDialog } from "@/components/dashboard/frister/template-picker-dialog";
import { useMembersMap, initials } from "@/hooks/use-members-map";
import type { DeadlineWithSummary } from "@/lib/deadlines/types";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
}

export default function DeadlineDetailClient() {
  const params = useParams();
  const deadlineId = params.id as string;

  const [deadline, setDeadline] = useState<DeadlineWithSummary | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; companyId: string; companyName: string }[]>([]);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const { membersMap } = useMembersMap();

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/deadlines/${deadlineId}`);
      if (!res.ok) return;
      const data = await res.json();
      setDeadline(data.deadline);
      setTasks(data.tasks ?? []);
    } catch (err) {
      console.error("Failed to fetch deadline detail:", err);
    } finally {
      setLoading(false);
    }
  }, [deadlineId]);

  const updateAssignee = useCallback(async (assigneeId: string | null) => {
    setAssigneeOpen(false);
    if (!deadline) return;
    setDeadline({ ...deadline, assigneeId });
    try {
      await fetch(`/api/deadlines/${deadlineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId }),
      });
    } catch (err) {
      console.error("Failed to update assignee:", err);
      fetchDetail();
    }
  }, [deadline, deadlineId, fetchDetail]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    if (createDialogOpen && companies.length === 0) {
      fetch("/api/companies")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setCompanies(data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
        })
        .catch(() => {});
      fetch("/api/clients")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          if (Array.isArray(data))
            setClients(data.map((c: { id: string; name: string; companyId: string; companyName?: string }) => ({
              id: c.id,
              name: c.name,
              companyId: c.companyId,
              companyName: c.companyName ?? "",
            })));
        })
        .catch(() => {});
    }
  }, [createDialogOpen, companies.length]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!deadline) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Frist ikke funnet</p>
        <Link
          href="/dashboard/frister"
          className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Tilbake til frister
        </Link>
      </div>
    );
  }

  // Derive progress from tasks so it stays in sync with optimistic updates
  const completed = tasks.filter((t) => t.status === "completed").length;
  const total = tasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
        <Link href="/dashboard/frister">
          <ChevronLeft className="h-4 w-4" />
          Tilbake til frister
        </Link>
      </Button>

      {/* Header card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                {deadline.template.name}
              </CardTitle>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{deadline.company.name}</span>
                <span>·</span>
                <span>{deadline.periodLabel}</span>
                {deadline.template.category && (
                  <>
                    <span>·</span>
                    <span className="capitalize">{deadline.template.category}</span>
                  </>
                )}
              </div>
              {deadline.template.description && (
                <p className="text-xs text-muted-foreground mt-1">{deadline.template.description}</p>
              )}
              {/* Ansvarlig — the person who owns/oversees this deadline */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground">Ansvarlig:</span>
                <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted transition-colors">
                      {deadline.assigneeId && membersMap.has(deadline.assigneeId) ? (
                        <>
                          <Avatar className="size-4">
                            <AvatarImage src={membersMap.get(deadline.assigneeId)!.imageUrl} />
                            <AvatarFallback className="text-[8px]">{initials(membersMap.get(deadline.assigneeId)!.name)}</AvatarFallback>
                          </Avatar>
                          <span>{membersMap.get(deadline.assigneeId)!.name}</span>
                        </>
                      ) : (
                        <>
                          <UserCircle className="size-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Ikke tildelt</span>
                        </>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-1" align="start">
                    <div className="space-y-0.5">
                      {Array.from(membersMap.values()).map((member) => (
                        <button
                          key={member.id}
                          onClick={() => updateAssignee(member.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted transition-colors",
                            deadline.assigneeId === member.id && "bg-muted"
                          )}
                        >
                          <Avatar className="size-5">
                            <AvatarImage src={member.imageUrl} />
                            <AvatarFallback className="text-[8px]">{initials(member.name)}</AvatarFallback>
                          </Avatar>
                          <span className="flex-1 text-left truncate">{member.name}</span>
                          {deadline.assigneeId === member.id && <Check className="size-3 text-emerald-500" />}
                        </button>
                      ))}
                      {deadline.assigneeId && (
                        <>
                          <div className="my-1 h-px bg-border" />
                          <button
                            onClick={() => updateAssignee(null)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                          >
                            <X className="size-3.5" />
                            <span>Fjern ansvarlig</span>
                          </button>
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <DaysRemaining dueDate={deadline.dueDate} status={deadline.status} />
              <StatusBadge status={deadline.status} />
            </div>
          </div>
        </CardHeader>
        {total > 0 && (
          <CardContent className="pt-0 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    deadline.status === "done" ? "bg-emerald-500" :
                    deadline.status === "overdue" ? "bg-red-500" :
                    deadline.status === "at_risk" ? "bg-amber-500" : "bg-blue-500"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {completed}/{total} oppgaver fullført
              </span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Task progress + actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Oppgavefremdrift</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {total === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm text-muted-foreground">
                Ingen oppgaver knyttet til denne fristen ennå
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Opprett oppgave
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setTemplatePickerOpen(true)}
                >
                  <LayoutTemplate className="h-3.5 w-3.5" />
                  Bruk mal
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fullført</span>
                  <span className="font-medium tabular-nums">{completed} av {total} oppgaver ({progress}%)</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      progress === 100 ? "bg-emerald-500" :
                      deadline.status === "overdue" ? "bg-red-500" :
                      deadline.status === "at_risk" ? "bg-amber-500" : "bg-blue-500"
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-xs"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                    Ny oppgave
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-xs"
                    onClick={() => setTemplatePickerOpen(true)}
                  >
                    <LayoutTemplate className="h-3 w-3" />
                    Bruk mal
                  </Button>
                </div>
                <Link
                  href={`/dashboard/oppgaver?deadlineId=${deadlineId}&tab=all`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Åpne oppgaver for denne fristen
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        companies={companies}
        clients={clients}
        editingTask={null}
        defaultDueDate={deadline.dueDate}
        defaultLinkedDeadlineId={deadlineId}
        onSaved={fetchDetail}
      />

      <TemplatePickerDialog
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        deadlineId={deadlineId}
        deadlineSlug={deadline.template.slug}
        deadlineName={`${deadline.template.name} — ${deadline.periodLabel}`}
        onApplied={fetchDetail}
      />
    </div>
  );
}
