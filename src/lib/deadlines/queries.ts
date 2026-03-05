/**
 * Reusable DB queries for the deadline system.
 * Uses raw SQL via db.execute for complex joins and correlated subqueries.
 */

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import type { DeadlineWithSummary } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskRow {
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

interface RawDeadlineRow {
  id: string;
  tenant_id: string;
  template_id: string;
  company_id: string;
  due_date: string;
  period_label: string;
  status: string;
  assignee_id: string | null;
  completed_at: string | null;
  template_name: string;
  slug: string;
  category: string;
  template_description: string | null;
  company_name: string;
  org_number: string | null;
  task_total: number;
  task_completed: number;
  task_in_progress: number;
  task_not_started: number;
  task_blocked: number;
}

// ---------------------------------------------------------------------------
// Computed effective status — replaces the stale stored d.status
// ---------------------------------------------------------------------------

const EFFECTIVE_STATUS_SQL = sql`
  CASE
    WHEN d.status = 'done' THEN 'done'
    WHEN d.due_date < CURRENT_DATE THEN 'overdue'
    WHEN d.due_date <= CURRENT_DATE + INTERVAL '7 days'
      AND (SELECT count(*) FROM tasks t
           WHERE t.linked_deadline_id = d.id
           AND t.status NOT IN ('completed','cancelled')) > 0
      THEN 'at_risk'
    WHEN (SELECT count(*) FROM tasks t
          WHERE t.linked_deadline_id = d.id
          AND t.status IN ('in_progress','waiting')) > 0
      THEN 'on_track'
    ELSE 'not_started'
  END`;

// ---------------------------------------------------------------------------
// getDeadlinesForDashboard
// ---------------------------------------------------------------------------

export async function getDeadlinesForDashboard(params: {
  tenantId: string;
  from?: string;
  to?: string;
  status?: string[];
  companyId?: string;
  assignedTo?: string;
}): Promise<DeadlineWithSummary[]> {
  const { tenantId, from, to, status, companyId, assignedTo } = params;

  const conditions = [sql`d.tenant_id = ${tenantId}`];
  if (from) conditions.push(sql`d.due_date >= ${from}`);
  if (to) conditions.push(sql`d.due_date <= ${to}`);
  if (status?.length) {
    conditions.push(sql`(${EFFECTIVE_STATUS_SQL}) IN (${sql.join(status.map((s) => sql`${s}`), sql`, `)})`);
  }
  if (companyId) conditions.push(sql`d.company_id = ${companyId}`);
  if (assignedTo) {
    conditions.push(
      sql`(d.assignee_id = ${assignedTo} OR EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.linked_deadline_id = d.id
          AND t.assignee_id = ${assignedTo}
          AND t.status != 'cancelled'
      ))`
    );
  }

  const whereClause = sql.join(conditions, sql` AND `);

  const rows = await db.execute<RawDeadlineRow>(sql`
    SELECT
      d.id,
      d.tenant_id,
      d.template_id,
      d.company_id,
      d.due_date,
      d.period_label,
      (${EFFECTIVE_STATUS_SQL}) AS status,
      d.assignee_id,
      d.completed_at,
      dt.name AS template_name,
      dt.slug,
      dt.category,
      dt.description AS template_description,
      c.name AS company_name,
      c.org_number,
      (SELECT count(*)::int FROM tasks t WHERE t.linked_deadline_id = d.id AND t.status != 'cancelled') AS task_total,
      (SELECT count(*)::int FROM tasks t WHERE t.linked_deadline_id = d.id AND t.status = 'completed') AS task_completed,
      (SELECT count(*)::int FROM tasks t WHERE t.linked_deadline_id = d.id AND t.status = 'in_progress') AS task_in_progress,
      (SELECT count(*)::int FROM tasks t WHERE t.linked_deadline_id = d.id AND t.status = 'open') AS task_not_started,
      (SELECT count(*)::int FROM tasks t WHERE t.linked_deadline_id = d.id AND t.status = 'waiting') AS task_blocked
    FROM deadlines d
    JOIN deadline_templates dt ON d.template_id = dt.id
    JOIN companies c ON d.company_id = c.id
    WHERE ${whereClause}
    ORDER BY d.due_date ASC
  `);

  return Array.from(rows).map(mapRowToDeadlineWithSummary);
}

// ---------------------------------------------------------------------------
// getDeadlineById
// ---------------------------------------------------------------------------

export async function getDeadlineById(
  deadlineId: string,
  tenantId: string
): Promise<{ deadline: DeadlineWithSummary; tasks: TaskRow[] } | null> {
  const deadlineRows = await db.execute<RawDeadlineRow>(sql`
    SELECT
      d.id,
      d.tenant_id,
      d.template_id,
      d.company_id,
      d.due_date,
      d.period_label,
      (${EFFECTIVE_STATUS_SQL}) AS status,
      d.assignee_id,
      d.completed_at,
      dt.name AS template_name,
      dt.slug,
      dt.category,
      dt.description AS template_description,
      c.name AS company_name,
      c.org_number,
      (SELECT count(*)::int FROM tasks t WHERE t.linked_deadline_id = d.id AND t.status != 'cancelled') AS task_total,
      (SELECT count(*)::int FROM tasks t WHERE t.linked_deadline_id = d.id AND t.status = 'completed') AS task_completed,
      (SELECT count(*)::int FROM tasks t WHERE t.linked_deadline_id = d.id AND t.status = 'in_progress') AS task_in_progress,
      (SELECT count(*)::int FROM tasks t WHERE t.linked_deadline_id = d.id AND t.status = 'open') AS task_not_started,
      (SELECT count(*)::int FROM tasks t WHERE t.linked_deadline_id = d.id AND t.status = 'waiting') AS task_blocked
    FROM deadlines d
    JOIN deadline_templates dt ON d.template_id = dt.id
    JOIN companies c ON d.company_id = c.id
    WHERE d.id = ${deadlineId}
      AND d.tenant_id = ${tenantId}
  `);

  if (deadlineRows.length === 0) return null;

  const taskRows = await db.execute<RawTaskRow>(sql`
    SELECT
      t.id,
      t.title,
      t.description,
      t.status,
      t.priority,
      t.assignee_id AS assignee_id,
      t.due_date,
      t.completed_at,
      t.created_at
    FROM tasks t
    WHERE t.linked_deadline_id = ${deadlineId}
      AND t.tenant_id = ${tenantId}
      AND t.status != 'cancelled'
    ORDER BY t.created_at ASC
  `);

  const deadline = mapRowToDeadlineWithSummary(deadlineRows[0]);
  const tasks: TaskRow[] = Array.from(taskRows).map((r: RawTaskRow) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? null,
    status: r.status,
    priority: r.priority,
    assigneeId: r.assignee_id ?? null,
    dueDate: r.due_date ?? null,
    completedAt: r.completed_at != null ? String(r.completed_at) : null,
    createdAt: String(r.created_at),
  }));

  return { deadline, tasks };
}

interface RawTaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  due_date: string | null;
  completed_at: unknown;
  created_at: unknown;
}

// ---------------------------------------------------------------------------
// getDeadlineSummary
// ---------------------------------------------------------------------------

export async function getDeadlineSummary(
  tenantId: string,
  from: string,
  to: string
): Promise<{
  total: number;
  done: number;
  onTrack: number;
  atRisk: number;
  overdue: number;
  notStarted: number;
}> {
  const rows = await db.execute<SummaryRow>(sql`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE effective_status = 'done')::int AS done,
      count(*) FILTER (WHERE effective_status = 'on_track')::int AS on_track,
      count(*) FILTER (WHERE effective_status = 'at_risk')::int AS at_risk,
      count(*) FILTER (WHERE effective_status = 'overdue')::int AS overdue,
      count(*) FILTER (WHERE effective_status = 'not_started')::int AS not_started
    FROM (
      SELECT d.*, (${EFFECTIVE_STATUS_SQL}) AS effective_status
      FROM deadlines d
      WHERE d.tenant_id = ${tenantId}
        AND d.due_date >= ${from}
        AND d.due_date <= ${to}
    ) d
  `);

  const row = rows[0];

  if (!row) {
    return { total: 0, done: 0, onTrack: 0, atRisk: 0, overdue: 0, notStarted: 0 };
  }

  return {
    total: Number(row.total),
    done: Number(row.done),
    onTrack: Number(row.on_track),
    atRisk: Number(row.at_risk),
    overdue: Number(row.overdue),
    notStarted: Number(row.not_started),
  };
}

interface SummaryRow {
  total: number;
  done: number;
  on_track: number;
  at_risk: number;
  overdue: number;
  not_started: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapRowToDeadlineWithSummary(row: RawDeadlineRow): DeadlineWithSummary {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    templateId: row.template_id,
    companyId: row.company_id,
    dueDate: row.due_date,
    periodLabel: row.period_label,
    status: row.status as DeadlineWithSummary["status"],
    assigneeId: row.assignee_id ?? null,
    completedAt: row.completed_at != null ? String(row.completed_at) : null,
    template: {
      name: row.template_name,
      slug: row.slug,
      category: row.category,
      description: row.template_description ?? null,
    },
    company: {
      id: row.company_id,
      name: row.company_name,
      orgNumber: row.org_number ?? null,
    },
    taskSummary: {
      total: Number(row.task_total) || 0,
      completed: Number(row.task_completed) || 0,
      inProgress: Number(row.task_in_progress) || 0,
      notStarted: Number(row.task_not_started) || 0,
      blocked: Number(row.task_blocked) || 0,
    },
  };
}
