"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Circle,
  Timer,
  Pause,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Pencil,
  Mail,
  Calendar,
  Building2,
  User2,
  Tag,
  FileText,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_CATEGORY_LABELS, TASK_CATEGORY_COLORS } from "@/lib/constants/task-categories";
import type { TaskCategory } from "@/lib/db/schema";

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
}

interface OrgMember {
  id: string;
  name: string;
  imageUrl?: string;
}

interface TaskDetailDialogProps {
  task: TaskRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (task: TaskRow) => void;
  memberMap: Map<string, OrgMember>;
  fmtDate: (d: string) => string;
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

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex items-center gap-2 w-32 shrink-0 text-muted-foreground text-xs pt-0.5">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex-1 text-sm min-w-0">{children}</div>
    </div>
  );
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onEdit,
  memberMap,
  fmtDate,
}: TaskDetailDialogProps) {
  if (!task) return null;

  const sc = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.open;
  const pc = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
  const StatusIcon = sc.icon;
  const categoryKey = task.category as TaskCategory | null;
  const categoryLabel = categoryKey ? TASK_CATEGORY_LABELS[categoryKey] : null;
  const categoryColor = categoryKey ? TASK_CATEGORY_COLORS[categoryKey] : null;

  const isOverdue = task.dueDate && task.status !== "completed" && task.status !== "cancelled" &&
    new Date(task.dueDate) < new Date(new Date().toDateString());

  const assigneeMember = task.assigneeId ? memberMap.get(task.assigneeId) : null;
  const completedByMember = task.completedBy ? memberMap.get(task.completedBy) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-lg leading-snug pr-8">{task.title}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-1 divide-y">
          <DetailRow icon={<StatusIcon className={cn("size-3.5", sc.className)} />} label="Status">
            <div className="flex items-center gap-2">
              <span className={cn("font-medium", sc.className)}>{sc.label}</span>
              {isOverdue && (
                <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                  <AlertCircle className="size-3" />
                  Forfalt
                </span>
              )}
            </div>
          </DetailRow>

          <DetailRow icon={<Tag className="size-3.5" />} label="Prioritet">
            <Badge variant="outline" className={cn("text-[11px] font-medium", pc.className)}>
              {pc.label}
            </Badge>
          </DetailRow>

          {categoryLabel && (
            <DetailRow icon={<Tag className="size-3.5" />} label="Kategori">
              <Badge variant="outline" className={cn("text-[11px] font-medium", categoryColor)}>
                {categoryLabel}
              </Badge>
            </DetailRow>
          )}

          <DetailRow icon={<User2 className="size-3.5" />} label="Tildelt til">
            {task.externalContactId && task.externalContactName ? (
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3 text-violet-600" />
                  {task.externalContactName}
                </span>
                {task.externalContactEmail && (
                  <span className="text-xs text-muted-foreground">{task.externalContactEmail}</span>
                )}
              </div>
            ) : assigneeMember ? (
              <span className="flex items-center gap-1.5">
                <Avatar size="sm">
                  {assigneeMember.imageUrl && <AvatarImage src={assigneeMember.imageUrl} alt={assigneeMember.name} />}
                  <AvatarFallback>{initials(assigneeMember.name)}</AvatarFallback>
                </Avatar>
                {assigneeMember.name}
              </span>
            ) : (
              <span className="text-muted-foreground">Ikke tildelt</span>
            )}
          </DetailRow>

          {task.companyName && (
            <DetailRow icon={<Building2 className="size-3.5" />} label="Selskap">
              <span>{task.companyName}</span>
            </DetailRow>
          )}

          {task.clientName && (
            <DetailRow icon={<FileText className="size-3.5" />} label="Klient">
              <span>{task.clientName}</span>
            </DetailRow>
          )}

          <DetailRow icon={<Calendar className="size-3.5" />} label="Frist">
            {task.dueDate ? (
              <span className={cn(isOverdue && "text-red-500 font-medium")}>
                {fmtDate(task.dueDate)}
              </span>
            ) : (
              <span className="text-muted-foreground">Ingen frist</span>
            )}
          </DetailRow>

          {task.description && (
            <DetailRow icon={<FileText className="size-3.5" />} label="Beskrivelse">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{task.description}</p>
            </DetailRow>
          )}

          {task.status === "completed" && task.completedAt && (
            <DetailRow icon={<CheckCircle2 className="size-3.5 text-green-500" />} label="Fullført">
              <div className="flex flex-col gap-0.5">
                <span>{fmtDateTime(task.completedAt)}</span>
                {completedByMember && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    av {completedByMember.name}
                  </span>
                )}
              </div>
            </DetailRow>
          )}

          {task.resolution && (
            <DetailRow icon={<FileText className="size-3.5" />} label="Løsning">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{task.resolution}</p>
            </DetailRow>
          )}

          {task.metadata && Object.keys(task.metadata).length > 0 && (
            <DetailRow icon={<Tag className="size-3.5" />} label="Kontekst">
              <div className="space-y-0.5 text-xs text-muted-foreground">
                {!!task.metadata.reportCustomerName && (
                  <div>Kunde: <span className="text-foreground">{String(task.metadata.reportCustomerName)}</span></div>
                )}
                {!!task.metadata.invoiceRef && (
                  <div>Ref: <span className="text-foreground">{String(task.metadata.invoiceRef)}</span></div>
                )}
              </div>
            </DetailRow>
          )}

          <DetailRow icon={<Clock className="size-3.5" />} label="Opprettet">
            <span className="text-muted-foreground text-xs">{fmtDateTime(task.createdAt)}</span>
          </DetailRow>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Lukk
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onEdit(task);
            }}
          >
            <Pencil className="size-3.5 mr-1.5" />
            Rediger
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
