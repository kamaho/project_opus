/**
 * Core types for the deadline computation system.
 * These types define the shapes used in deadline_templates.due_date_rule (JSONB)
 * and the inputs to computeDueDate().
 */

export type FixedAnnualRule = {
  type: "fixed_annual";
  month: number;
  day: number;
  applies_to?: string[];
  adjust_for_holidays?: boolean;
};

export type OffsetAfterPeriodRule = {
  type: "offset_after_period";
  offset_months: number;
  /** Day of month for the due date. null = last day of the month. */
  day: number | null;
  adjust_for_holidays?: boolean;
};

export type DueDateRule = FixedAnnualRule | OffsetAfterPeriodRule;

export type Period = {
  year: number;
  /** 1-based term number (e.g. 1-6 for bimonthly, 1-4 for quarterly) */
  term?: number;
  /** 1-based month (1-12) */
  month?: number;
};

export type CompanyContext = {
  mvaTermType: "bimonthly" | "monthly" | "annual" | "exempt";
  fiscalYearEnd: string;
  orgForm?: string;
};

/**
 * Task status mapping for deadline computation:
 * - "open"        -> not started (no work begun)
 * - "in_progress" -> active work
 * - "waiting"     -> blocked (external input)
 * - "completed"   -> done
 * - "cancelled"   -> excluded from progress calculations
 */

export type DeadlineComputedStatus = "not_started" | "on_track" | "at_risk" | "overdue" | "done";

export interface TaskSummary {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  blocked: number;
}

export interface DeadlineWithSummary {
  id: string;
  tenantId: string;
  templateId: string;
  companyId: string;
  dueDate: string;
  periodLabel: string;
  status: DeadlineComputedStatus;
  /** Clerk userId of the person responsible for this deadline (owner/leder) */
  assigneeId: string | null;
  completedAt: string | null;
  template: {
    name: string;
    slug: string;
    category: string;
    description: string | null;
  };
  company: {
    id: string;
    name: string;
    orgNumber: string | null;
  };
  taskSummary: TaskSummary;
}

export interface DeadlineListResponse {
  deadlines: DeadlineWithSummary[];
  summary: {
    total: number;
    done: number;
    onTrack: number;
    atRisk: number;
    overdue: number;
    notStarted: number;
  };
}
