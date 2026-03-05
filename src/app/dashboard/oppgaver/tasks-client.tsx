"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMembersMap, initials } from "@/hooks/use-members-map";
import type { OrgMember } from "@/hooks/use-members-map";
import {
  CheckSquare,
  Plus,
  Search,
  AlertCircle,
  CheckCircle2,
  ArrowUpDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  Circle,
  Timer,
  Pause,
  XCircle,
  Mail,
  UserCheck,
  ClipboardCheck,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useFormatting } from "@/contexts/ui-preferences-context";
import { CreateTaskDialog } from "./create-task-dialog";
import { TaskDetailDialog } from "./task-detail-dialog";
import { TASK_CATEGORY_LABELS, TASK_CATEGORY_COLORS } from "@/lib/constants/task-categories";
import type { TaskCategory } from "@/lib/db/schema";
import { toast } from "sonner";

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
  completedAt: string | null;
  completedBy: string | null;
  resolution: string | null;
  metadata: Record<string, unknown> | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  companyName: string | null;
  clientName: string | null;
  externalContactName?: string | null;
  externalContactEmail?: string | null;
  linkedDeadlineId?: string | null;
  deadlineName?: string | null;
  deadlineSlug?: string | null;
  deadlineDueDate?: string | null;
  deadlinePeriodLabel?: string | null;
  deadlineAssigneeId?: string | null;
}

interface TaskStats {
  total: number;
  open: number;
  inProgress: number;
  overdue: number;
  completedThisMonth: number;
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

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Circle; className: string }> = {
  open: { label: "Åpen", icon: Circle, className: "text-blue-500" },
  in_progress: { label: "Pågår", icon: Timer, className: "text-amber-500" },
  waiting: { label: "Venter", icon: Pause, className: "text-muted-foreground" },
  completed: { label: "Fullført", icon: CheckCircle2, className: "text-green-500" },
  cancelled: { label: "Avbrutt", icon: XCircle, className: "text-muted-foreground" },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  critical: { label: "Kritisk", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20" },
  high: { label: "Høy", className: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20" },
  medium: { label: "Medium", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20" },
  low: { label: "Lav", className: "bg-muted text-muted-foreground border-border" },
};

export function TasksClient({
  companies,
  clients: clientOptions,
  stats: initialStats,
}: {
  companies: CompanyOption[];
  clients: ClientOption[];
  stats: TaskStats;
}) {
  const { fmtDate } = useFormatting();
  const { user } = useUser();
  const { membersMap: memberMap } = useMembersMap();
  const searchParams = useSearchParams();
  const initialTab = useMemo(() => {
    if (searchParams.get("deadlineId")) return "all";
    const t = searchParams.get("tab");
    if (t === "all" || t === "mine" || t === "unassigned") return t;
    return "mine";
  }, [searchParams]);
  const deadlineIdFilter = searchParams.get("deadlineId");

  const [taskList, setTaskList] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [worklistTab, setWorklistTab] = useState<string>(initialTab);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("due_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [viewingTask, setViewingTask] = useState<TaskRow | null>(null);
  const [stats, setStats] = useState(initialStats);

  const fetchTasks = useCallback(async () => {
    const params = new URLSearchParams();

    if (worklistTab === "mine") {
      params.set("assignee", "me");
    } else if (worklistTab === "unassigned") {
      params.set("assignee", "unassigned");
    }

    if (statusFilter === "active") {
      params.set("status", "open,in_progress,waiting");
    } else if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    if (companyFilter !== "all") params.set("companyId", companyFilter);
    if (deadlineIdFilter) params.set("deadlineId", deadlineIdFilter);
    if (searchQuery) params.set("search", searchQuery);
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);

    const res = await fetch(`/api/tasks?${params}`);
    if (res.ok) {
      const data = await res.json();
      setTaskList(data);
    }
    setLoading(false);
  }, [worklistTab, statusFilter, priorityFilter, companyFilter, deadlineIdFilter, searchQuery, sortBy, sortDir]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const STATUS_LABELS: Record<string, string> = {
    open: "Åpen",
    in_progress: "Under arbeid",
    completed: "Fullført",
    cancelled: "Avbrutt",
    on_hold: "På vent",
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      toast.success(`Status endret til ${STATUS_LABELS[newStatus] ?? newStatus}`);
      fetchTasks();
    } else {
      toast.error("Kunne ikke endre status. Prøv igjen.");
    }
  };

  const handleAssignToMe = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeId: user?.id }),
    });
    if (res.ok) {
      toast.success("Oppgave tildelt deg");
      fetchTasks();
    } else {
      toast.error("Kunne ikke tildele oppgaven. Prøv igjen.");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Oppgave slettet");
      setStats((s) => ({ ...s, total: s.total - 1 }));
      fetchTasks();
    } else {
      toast.error("Kunne ikke slette oppgaven. Prøv igjen.");
    }
  };

  const isOverdue = (task: TaskRow) => {
    if (!task.dueDate) return false;
    if (task.status === "completed" || task.status === "cancelled") return false;
    return new Date(task.dueDate) < new Date(new Date().toDateString());
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const renderAssignee = (task: TaskRow) => {
    if (task.externalContactId && task.externalContactName) {
      return (
        <span className="flex items-center gap-1.5 truncate">
          <Mail className="size-3 shrink-0 text-violet-600" />
          <span className="truncate">{task.externalContactName}</span>
        </span>
      );
    }
    if (task.assigneeId) {
      const member = memberMap.get(task.assigneeId);
      if (member) {
        return (
          <span className="flex items-center gap-1.5 truncate">
            <Avatar size="sm">
              {member.imageUrl && <AvatarImage src={member.imageUrl} alt={member.name} />}
              <AvatarFallback>{initials(member.name)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{member.name}</span>
          </span>
        );
      }
      return <span className="truncate text-muted-foreground">{task.assigneeId.slice(0, 8)}...</span>;
    }
    return <span className="text-muted-foreground">—</span>;
  };

  const colSpan = 9;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CheckSquare className="size-6 text-muted-foreground" />
            <h1 className="text-2xl font-semibold">Oppgaver</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Administrer oppgaver, frister og oppfølging per klient og team.
          </p>
        </div>
        <Button onClick={() => { setEditingTask(null); setShowCreateDialog(true); }}>
          <Plus className="size-4 mr-1.5" />
          Ny oppgave
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Åpne"
          value={stats.open}
          icon={<Circle className="size-4 text-blue-500" />}
        />
        <StatCard
          label="Pågår"
          value={stats.inProgress}
          icon={<Timer className="size-4 text-amber-500" />}
        />
        <StatCard
          label="Forfalt"
          value={stats.overdue}
          icon={<AlertCircle className="size-4 text-red-500" />}
          highlight={stats.overdue > 0}
        />
        <StatCard
          label="Fullført denne mnd"
          value={stats.completedThisMonth}
          icon={<CheckCircle2 className="size-4 text-green-500" />}
        />
      </div>

      {/* Worklist tabs */}
      <Tabs value={worklistTab} onValueChange={setWorklistTab}>
        <TabsList>
          <TabsTrigger value="mine">Min arbeidsliste</TabsTrigger>
          <TabsTrigger value="all">Alle oppgaver</TabsTrigger>
          <TabsTrigger value="unassigned">Ikke tildelt</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Søk oppgaver..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Aktive</SelectItem>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="open">Åpen</SelectItem>
            <SelectItem value="in_progress">Pågår</SelectItem>
            <SelectItem value="waiting">Venter</SelectItem>
            <SelectItem value="completed">Fullført</SelectItem>
            <SelectItem value="cancelled">Avbrutt</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Prioritet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="critical">Kritisk</SelectItem>
            <SelectItem value="high">Høy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Lav</SelectItem>
          </SelectContent>
        </Select>
        {companies.length > 0 && (
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Selskap" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle selskap</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Task table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-8">
                  <span className="sr-only">Status</span>
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  <button onClick={() => toggleSort("title")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Oppgave
                    <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-36">
                  <button onClick={() => toggleSort("category")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Kategori
                    <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-36">
                  Tildelt til
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-24">
                  <button onClick={() => toggleSort("priority")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Prioritet
                    <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-32">Selskap</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-36">Koblet frist</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-28">
                  <button onClick={() => toggleSort("due_date")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Frist
                    <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground w-10">
                  <span className="sr-only">Handlinger</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={colSpan} className="px-3 py-12 text-center text-muted-foreground">
                    Laster oppgaver...
                  </td>
                </tr>
              ) : taskList.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-3 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <CheckSquare className="size-8 text-muted-foreground/40" />
                      <p className="text-muted-foreground">
                        {worklistTab === "mine" ? "Ingen oppgaver i din arbeidsliste" : "Ingen oppgaver funnet"}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditingTask(null); setShowCreateDialog(true); }}
                      >
                        <Plus className="size-3.5 mr-1" />
                        Opprett oppgave
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                taskList.map((task) => {
                  const sc = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.open;
                  const pc = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
                  const overdue = isOverdue(task);
                  const StatusIcon = sc.icon;
                  const categoryKey = task.category as TaskCategory | null;
                  const categoryLabel = categoryKey ? TASK_CATEGORY_LABELS[categoryKey] : null;
                  const categoryColor = categoryKey ? TASK_CATEGORY_COLORS[categoryKey] : null;

                  return (
                    <tr
                      key={task.id}
                      onClick={() => setViewingTask(task)}
                      className={cn(
                        "group hover:bg-muted/30 transition-colors cursor-pointer",
                        task.status === "completed" && "opacity-60"
                      )}
                    >
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex items-center justify-center">
                              <StatusIcon className={cn("size-4", sc.className)} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40">
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                              const Icon = cfg.icon;
                              return (
                                <DropdownMenuItem
                                  key={key}
                                  onClick={() => handleStatusChange(task.id, key)}
                                  className="gap-2"
                                >
                                  <Icon className={cn("size-3.5", cfg.className)} />
                                  {cfg.label}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <span className={cn(
                            "font-medium",
                            task.status === "completed" && "line-through"
                          )}>
                            {task.title}
                          </span>
                          {task.clientName && (
                            <span className="text-xs text-muted-foreground">
                              {task.clientName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {categoryLabel ? (
                          <Badge variant="outline" className={cn("text-[10px] font-medium whitespace-nowrap", categoryColor)}>
                            {categoryLabel}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs max-w-[140px]">
                        {renderAssignee(task)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className={cn("text-[11px] font-medium", pc.className)}>
                          {pc.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs truncate max-w-[130px]">
                        {task.companyName ?? "—"}
                      </td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        {task.linkedDeadlineId && task.deadlineName ? (
                          <Link
                            href={`/dashboard/frister/${task.linkedDeadlineId}`}
                            className="group/dl flex items-center gap-1.5 max-w-[160px]"
                          >
                            {task.deadlineAssigneeId && memberMap.has(task.deadlineAssigneeId) && (
                              <Avatar className="size-4 shrink-0">
                                <AvatarImage src={memberMap.get(task.deadlineAssigneeId)!.imageUrl} />
                                <AvatarFallback className="text-[8px]">{initials(memberMap.get(task.deadlineAssigneeId)!.name)}</AvatarFallback>
                              </Avatar>
                            )}
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="flex items-center gap-1 text-xs font-medium truncate group-hover/dl:underline">
                                <ClipboardCheck className="size-3 shrink-0 text-muted-foreground" />
                                {task.deadlineName}
                              </span>
                              {task.deadlineDueDate && (() => {
                                const d = new Date(task.deadlineDueDate);
                                const now = new Date(new Date().toDateString());
                                const diff = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
                                const label = diff < 0 ? `${Math.abs(diff)}d forfalt` : diff === 0 ? "I dag" : `${diff}d igjen`;
                                const color = diff < 0 ? "text-red-500" : diff <= 7 ? "text-amber-500" : "text-muted-foreground";
                                return <span className={cn("text-[10px] tabular-nums", color)}>{label}</span>;
                              })()}
                            </div>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className={cn(
                        "px-3 py-2.5 text-xs tabular-nums",
                        overdue ? "text-red-500 font-medium" : "text-muted-foreground"
                      )}>
                        {task.dueDate ? (
                          <span className="flex items-center gap-1">
                            {overdue && <AlertCircle className="size-3" />}
                            {fmtDate(task.dueDate)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted">
                              <MoreHorizontal className="size-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {!task.assigneeId && !task.externalContactId && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleAssignToMe(task.id)}
                                  className="gap-2"
                                >
                                  <UserCheck className="size-3.5" />
                                  Tildel meg
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingTask(task);
                                setShowCreateDialog(true);
                              }}
                              className="gap-2"
                            >
                              <Pencil className="size-3.5" />
                              Rediger
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteTask(task.id)}
                              className="gap-2 text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                              Slett
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && taskList.length > 0 && (
          <div className="border-t px-3 py-2 text-xs text-muted-foreground">
            {taskList.length} {taskList.length === 1 ? "oppgave" : "oppgaver"}
          </div>
        )}
      </div>

      <TaskDetailDialog
        task={viewingTask}
        open={!!viewingTask}
        onOpenChange={(v) => { if (!v) setViewingTask(null); }}
        onEdit={(t) => {
          setViewingTask(null);
          setEditingTask(t);
          setShowCreateDialog(true);
        }}
        memberMap={memberMap}
        fmtDate={fmtDate}
      />

      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        companies={companies}
        clients={clientOptions}
        editingTask={editingTask}
        onSaved={() => {
          fetchTasks();
          setEditingTask(null);
        }}
      />
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
