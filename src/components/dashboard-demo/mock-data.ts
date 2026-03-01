export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "IN_APPROVAL" | "CHANGES_NEEDED" | "DONE" | "CANCELLED";
export type UserRole = "ADMIN" | "MANAGER" | "ACCOUNTANT" | "CONTROLLER" | "AUDITOR";
export type DeadlineType = "MVA" | "A_MELDING" | "SKATTEMELDING" | "ARSREGNSKAP" | "AKSJONAER" | "FORSKUDDSSKATT";
export type ClientHealthStatus = "ON_TRACK" | "AT_RISK" | "OVERDUE";
export type UrgencyLevel = "CRITICAL" | "HIGH" | "NORMAL";
export type ReturnCategory =
  | "MISSING_VOUCHER"
  | "WRONG_CALCULATION"
  | "MISSING_RECONCILIATION"
  | "WRONG_VAT_CODE"
  | "MISSING_DOCUMENTATION"
  | "INCOMPLETE_CHECKLIST"
  | "OTHER";

export const RETURN_CATEGORY_LABELS: Record<ReturnCategory, string> = {
  MISSING_VOUCHER: "Mangler bilag",
  WRONG_CALCULATION: "Feil beregning",
  MISSING_RECONCILIATION: "Mangler avstemming",
  WRONG_VAT_CODE: "Feil MVA-kode",
  MISSING_DOCUMENTATION: "Mangler dokumentasjon",
  INCOMPLETE_CHECKLIST: "Ufullstendig sjekkliste",
  OTHER: "Annet",
};

export const DEADLINE_TYPE_LABELS: Record<DeadlineType, string> = {
  MVA: "MVA-melding",
  A_MELDING: "A-melding",
  SKATTEMELDING: "Skattemelding",
  ARSREGNSKAP: "Årsregnskap",
  AKSJONAER: "Aksjonærregister",
  FORSKUDDSSKATT: "Forskuddsskatt",
};

export interface MockUser {
  id: string;
  name: string;
  initials: string;
  role: UserRole;
  weeklyCapacityHours: number;
}

export interface MockClient {
  id: string;
  name: string;
  companyType: string;
  status: ClientHealthStatus;
  overdueCount: number;
  atRiskCount: number;
  totalActiveTasks: number;
  completedThisMonth: number;
  nextDeadline?: { date: string; type: DeadlineType; typeLabel: string };
  assignedAccountant?: string;
}

export interface MockTask {
  id: string;
  title: string;
  clientName: string;
  clientId: string;
  dueDate: string;
  internalDueDate?: string;
  status: TaskStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  riskLevel: RiskLevel;
  riskScore: number;
  checklist: { total: number; completed: number };
  deadlineType?: DeadlineType;
  legalDeadlineDate?: string;
  currentStepName?: string;
  assigneeId?: string;
  assigneeName?: string;
  estimatedHours?: number;
}

export interface MockReturnedTask {
  id: string;
  title: string;
  clientName: string;
  returnedAt: string;
  returnedBy: string;
  category: ReturnCategory;
  categoryLabel: string;
  comment: string;
  dueDate: string;
  legalDeadlineDate?: string;
  isUrgent: boolean;
}

export interface MockControlQueueItem {
  id: string;
  title: string;
  clientName: string;
  clientId: string;
  executedBy: string;
  executedByInitials: string;
  completedAt: string;
  dueDate: string;
  legalDeadlineDate?: string;
  daysUntilLegalDeadline?: number;
  urgencyLevel: UrgencyLevel;
  checklist: { total: number; completed: number };
  estimatedControlTimeMinutes?: number;
  isRecheck: boolean;
  previousReturnCount: number;
  executorNote?: string;
  timeInQueueHours: number;
}

export interface MockTeamMemberCapacity {
  userId: string;
  name: string;
  initials: string;
  role: UserRole;
  weeklyCapacityHours: number;
  currentLoad: {
    assignedTasks: number;
    estimatedHours: number;
    utilizationPercent: number;
  };
  taskBreakdown: {
    overdue: number;
    dueThisWeek: number;
    inReview: number;
    changesNeeded: number;
  };
  status: "AVAILABLE" | "NORMAL" | "BUSY" | "OVERLOADED";
}

export interface MockSuggestedAction {
  type: "REASSIGN" | "ESCALATE" | "ASSIGN";
  priority: "HIGH" | "MEDIUM";
  description: string;
  taskId: string;
  taskTitle: string;
  clientName: string;
  fromUserName?: string;
  toUserName?: string;
  reason: string;
  suggestedUserName?: string;
}

export interface MockHeatmapCell {
  month: number;
  monthLabel: string;
  deadlineType: DeadlineType;
  deadlineTypeLabel: string;
  count: number;
  completedCount: number;
  overdueCount: number;
  estimatedHours: number;
  intensity: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

// ---------------------------------------------------------------------------
// Demo users
// ---------------------------------------------------------------------------

export const MOCK_USERS: MockUser[] = [
  { id: "u1", name: "Anna Nordby", initials: "AN", role: "MANAGER", weeklyCapacityHours: 37.5 },
  { id: "u2", name: "Per Hansen", initials: "PH", role: "ACCOUNTANT", weeklyCapacityHours: 37.5 },
  { id: "u3", name: "Lisa Berg", initials: "LB", role: "ACCOUNTANT", weeklyCapacityHours: 37.5 },
  { id: "u4", name: "Erik Sæther", initials: "ES", role: "CONTROLLER", weeklyCapacityHours: 37.5 },
];

// ---------------------------------------------------------------------------
// Demo clients
// ---------------------------------------------------------------------------

export const MOCK_CLIENTS: MockClient[] = [
  {
    id: "c1", name: "Nordvik Bygg AS", companyType: "AS",
    status: "OVERDUE", overdueCount: 2, atRiskCount: 1, totalActiveTasks: 8,
    completedThisMonth: 3,
    nextDeadline: { date: "2026-03-10", type: "MVA", typeLabel: "MVA-melding" },
    assignedAccountant: "Per Hansen",
  },
  {
    id: "c2", name: "Berg Consulting ENK", companyType: "ENK",
    status: "AT_RISK", overdueCount: 0, atRiskCount: 2, totalActiveTasks: 5,
    completedThisMonth: 2,
    nextDeadline: { date: "2026-03-05", type: "A_MELDING", typeLabel: "A-melding" },
    assignedAccountant: "Lisa Berg",
  },
  {
    id: "c3", name: "Fjell Tech AS", companyType: "AS",
    status: "ON_TRACK", overdueCount: 0, atRiskCount: 0, totalActiveTasks: 6,
    completedThisMonth: 4,
    nextDeadline: { date: "2026-04-10", type: "MVA", typeLabel: "MVA-melding" },
    assignedAccountant: "Per Hansen",
  },
  {
    id: "c4", name: "Havbris Restaurant AS", companyType: "AS",
    status: "AT_RISK", overdueCount: 0, atRiskCount: 1, totalActiveTasks: 7,
    completedThisMonth: 5,
    nextDeadline: { date: "2026-03-05", type: "A_MELDING", typeLabel: "A-melding" },
    assignedAccountant: "Lisa Berg",
  },
  {
    id: "c5", name: "Solvik Eiendom ANS", companyType: "ANS",
    status: "ON_TRACK", overdueCount: 0, atRiskCount: 0, totalActiveTasks: 4,
    completedThisMonth: 3,
    nextDeadline: { date: "2026-05-31", type: "SKATTEMELDING", typeLabel: "Skattemelding" },
    assignedAccountant: "Per Hansen",
  },
];

// ---------------------------------------------------------------------------
// Accountant focus tasks (Per Hansen)
// ---------------------------------------------------------------------------

export const MOCK_FOCUS_TASKS: MockTask[] = [
  {
    id: "t1", title: "MVA-melding 1. termin", clientName: "Nordvik Bygg AS", clientId: "c1",
    dueDate: "2026-02-24", internalDueDate: "2026-02-21", status: "IN_PROGRESS",
    priority: "URGENT", riskLevel: "CRITICAL", riskScore: 75,
    checklist: { total: 6, completed: 2 }, deadlineType: "MVA",
    legalDeadlineDate: "2026-03-10", currentStepName: "Utfør",
    assigneeId: "u2", assigneeName: "Per Hansen", estimatedHours: 4,
  },
  {
    id: "t2", title: "A-melding februar", clientName: "Nordvik Bygg AS", clientId: "c1",
    dueDate: "2026-03-05", status: "TODO",
    priority: "HIGH", riskLevel: "HIGH", riskScore: 45,
    checklist: { total: 4, completed: 0 }, deadlineType: "A_MELDING",
    legalDeadlineDate: "2026-03-05", currentStepName: "Utfør",
    assigneeId: "u2", assigneeName: "Per Hansen", estimatedHours: 2,
  },
  {
    id: "t3", title: "Skattemelding næring", clientName: "Berg Consulting ENK", clientId: "c2",
    dueDate: "2026-05-31", status: "TODO",
    priority: "MEDIUM", riskLevel: "MEDIUM", riskScore: 20,
    checklist: { total: 8, completed: 0 }, deadlineType: "SKATTEMELDING",
    legalDeadlineDate: "2026-05-31", currentStepName: "Utfør",
    assigneeId: "u2", assigneeName: "Per Hansen", estimatedHours: 8,
  },
  {
    id: "t4", title: "MVA-melding 1. termin", clientName: "Fjell Tech AS", clientId: "c3",
    dueDate: "2026-03-08", status: "IN_PROGRESS",
    priority: "HIGH", riskLevel: "HIGH", riskScore: 35,
    checklist: { total: 6, completed: 4 }, deadlineType: "MVA",
    legalDeadlineDate: "2026-03-10", currentStepName: "Utfør",
    assigneeId: "u2", assigneeName: "Per Hansen", estimatedHours: 3,
  },
  {
    id: "t5", title: "A-melding februar", clientName: "Fjell Tech AS", clientId: "c3",
    dueDate: "2026-03-05", status: "TODO",
    priority: "MEDIUM", riskLevel: "MEDIUM", riskScore: 18,
    checklist: { total: 4, completed: 0 }, deadlineType: "A_MELDING",
    legalDeadlineDate: "2026-03-05", currentStepName: "Utfør",
    assigneeId: "u2", assigneeName: "Per Hansen", estimatedHours: 1.5,
  },
  {
    id: "t6", title: "Årsregnskap 2025", clientName: "Solvik Eiendom ANS", clientId: "c5",
    dueDate: "2026-07-31", status: "TODO",
    priority: "LOW", riskLevel: "LOW", riskScore: 5,
    checklist: { total: 12, completed: 0 }, deadlineType: "ARSREGNSKAP",
    legalDeadlineDate: "2026-07-31", currentStepName: "Utfør",
    assigneeId: "u2", assigneeName: "Per Hansen", estimatedHours: 16,
  },
];

// ---------------------------------------------------------------------------
// Returned tasks (sent back from control)
// ---------------------------------------------------------------------------

export const MOCK_RETURNED_TASKS: MockReturnedTask[] = [
  {
    id: "t7", title: "MVA-melding 6. termin 2025", clientName: "Havbris Restaurant AS",
    returnedAt: "2026-02-25T14:32:00", returnedBy: "Erik Sæther",
    category: "WRONG_VAT_CODE", categoryLabel: "Feil MVA-kode",
    comment: "Konto 3100 er ført med MVA-kode 3 men skal være kode 1 for denne typen salg. Gjelder bilag 2451-2455.",
    dueDate: "2026-02-28", legalDeadlineDate: "2026-03-10", isUrgent: false,
  },
  {
    id: "t8", title: "A-melding januar", clientName: "Nordvik Bygg AS",
    returnedAt: "2026-02-24T09:15:00", returnedBy: "Erik Sæther",
    category: "MISSING_VOUCHER", categoryLabel: "Mangler bilag",
    comment: "Mangler lønnsslipp for ansatt #4 (Kari Olsen). Kan ikke verifisere uten dette.",
    dueDate: "2026-02-26", legalDeadlineDate: "2026-03-05", isUrgent: true,
  },
];

// ---------------------------------------------------------------------------
// Controller queue
// ---------------------------------------------------------------------------

export const MOCK_CONTROL_QUEUE: MockControlQueueItem[] = [
  {
    id: "t10", title: "MVA-melding 6. termin 2025", clientName: "Fjell Tech AS", clientId: "c3",
    executedBy: "Per Hansen", executedByInitials: "PH",
    completedAt: "2026-02-25T16:45:00", dueDate: "2026-03-01",
    legalDeadlineDate: "2026-03-10", daysUntilLegalDeadline: 12,
    urgencyLevel: "NORMAL",
    checklist: { total: 6, completed: 6 },
    estimatedControlTimeMinutes: 45, isRecheck: false, previousReturnCount: 0,
    timeInQueueHours: 3,
  },
  {
    id: "t11", title: "A-melding januar", clientName: "Havbris Restaurant AS", clientId: "c4",
    executedBy: "Lisa Berg", executedByInitials: "LB",
    completedAt: "2026-02-25T11:20:00", dueDate: "2026-02-28",
    legalDeadlineDate: "2026-03-05", daysUntilLegalDeadline: 7,
    urgencyLevel: "HIGH",
    checklist: { total: 4, completed: 4 },
    estimatedControlTimeMinutes: 30, isRecheck: false, previousReturnCount: 0,
    timeInQueueHours: 8,
  },
  {
    id: "t12", title: "MVA-melding 6. termin 2025", clientName: "Nordvik Bygg AS", clientId: "c1",
    executedBy: "Per Hansen", executedByInitials: "PH",
    completedAt: "2026-02-26T08:10:00", dueDate: "2026-02-27",
    legalDeadlineDate: "2026-03-10", daysUntilLegalDeadline: 12,
    urgencyLevel: "NORMAL",
    checklist: { total: 6, completed: 5 },
    estimatedControlTimeMinutes: 60, isRecheck: true, previousReturnCount: 1,
    executorNote: "Korrigert MVA-koder på konto 3100. Bilag 2451-2455 oppdatert.",
    timeInQueueHours: 1,
  },
  {
    id: "t13", title: "Aksjonærregisteroppgave 2025", clientName: "Fjell Tech AS", clientId: "c3",
    executedBy: "Lisa Berg", executedByInitials: "LB",
    completedAt: "2026-02-24T15:30:00", dueDate: "2026-03-15",
    legalDeadlineDate: "2026-01-31", daysUntilLegalDeadline: -26,
    urgencyLevel: "CRITICAL",
    checklist: { total: 5, completed: 5 },
    estimatedControlTimeMinutes: 20, isRecheck: false, previousReturnCount: 0,
    timeInQueueHours: 30,
  },
];

// ---------------------------------------------------------------------------
// Team capacity
// ---------------------------------------------------------------------------

export const MOCK_TEAM_CAPACITY: MockTeamMemberCapacity[] = [
  {
    userId: "u2", name: "Per Hansen", initials: "PH", role: "ACCOUNTANT",
    weeklyCapacityHours: 37.5,
    currentLoad: { assignedTasks: 14, estimatedHours: 41, utilizationPercent: 110 },
    taskBreakdown: { overdue: 2, dueThisWeek: 4, inReview: 2, changesNeeded: 1 },
    status: "OVERLOADED",
  },
  {
    userId: "u3", name: "Lisa Berg", initials: "LB", role: "ACCOUNTANT",
    weeklyCapacityHours: 37.5,
    currentLoad: { assignedTasks: 11, estimatedHours: 32, utilizationPercent: 85 },
    taskBreakdown: { overdue: 0, dueThisWeek: 3, inReview: 1, changesNeeded: 0 },
    status: "BUSY",
  },
  {
    userId: "u4", name: "Erik Sæther", initials: "ES", role: "CONTROLLER",
    weeklyCapacityHours: 37.5,
    currentLoad: { assignedTasks: 6, estimatedHours: 18, utilizationPercent: 48 },
    taskBreakdown: { overdue: 0, dueThisWeek: 4, inReview: 0, changesNeeded: 0 },
    status: "AVAILABLE",
  },
  {
    userId: "u1", name: "Anna Nordby", initials: "AN", role: "MANAGER",
    weeklyCapacityHours: 20,
    currentLoad: { assignedTasks: 3, estimatedHours: 12, utilizationPercent: 60 },
    taskBreakdown: { overdue: 0, dueThisWeek: 1, inReview: 0, changesNeeded: 0 },
    status: "NORMAL",
  },
];

// ---------------------------------------------------------------------------
// Suggested actions (manager)
// ---------------------------------------------------------------------------

export const MOCK_SUGGESTED_ACTIONS: MockSuggestedAction[] = [
  {
    type: "REASSIGN", priority: "HIGH",
    description: "Omfordel «A-melding feb – Nordvik Bygg AS» fra Per til Lisa",
    taskId: "t2", taskTitle: "A-melding februar", clientName: "Nordvik Bygg AS",
    fromUserName: "Per Hansen", toUserName: "Lisa Berg",
    reason: "Per er på 110 % kapasitet. Lisa har 85 % og kjenner klienten.",
  },
  {
    type: "ESCALATE", priority: "HIGH",
    description: "Aksjonærregisteroppgave – Fjell Tech AS er forfalt",
    taskId: "t13", taskTitle: "Aksjonærregisteroppgave 2025", clientName: "Fjell Tech AS",
    reason: "Lovpålagt frist var 31. januar. Oppgaven ligger fortsatt i kontrollkø.",
  },
  {
    type: "ASSIGN", priority: "MEDIUM",
    description: "Skattemelding næring – Solvik Eiendom er ikke tildelt kontrollør",
    taskId: "t3", taskTitle: "Skattemelding næring", clientName: "Solvik Eiendom ANS",
    suggestedUserName: "Erik Sæther",
    reason: "Erik har lavest belastning (48 %) og er eneste kontrollør.",
  },
];

// ---------------------------------------------------------------------------
// Heatmap data (year 2026)
// ---------------------------------------------------------------------------

function heatmapCell(
  month: number, monthLabel: string,
  deadlineType: DeadlineType,
  count: number, completedCount: number, overdueCount: number,
  estimatedHours: number,
): MockHeatmapCell {
  let intensity: MockHeatmapCell["intensity"] = "NONE";
  if (count === 0) intensity = "NONE";
  else if (overdueCount > 0) intensity = "CRITICAL";
  else if (count <= 5) intensity = "LOW";
  else if (count <= 15) intensity = "MEDIUM";
  else if (count <= 30) intensity = "HIGH";
  else intensity = "CRITICAL";
  return {
    month, monthLabel, deadlineType,
    deadlineTypeLabel: DEADLINE_TYPE_LABELS[deadlineType],
    count, completedCount, overdueCount, estimatedHours, intensity,
  };
}

const M = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];

export const MOCK_HEATMAP: MockHeatmapCell[] = [
  // MVA — bimonthly peaks in Feb, Apr, Jun, Aug, Okt, Des (reporting month after period)
  ...M.map((ml, i) => {
    const isMvaMonth = [1, 3, 5, 7, 9, 11].includes(i);
    const isPast = i < 2; // Jan/Feb "done"
    const count = isMvaMonth ? 5 : 0;
    const completed = isPast && isMvaMonth ? 5 : 0;
    const overdue = i === 1 ? 0 : 0; // all good for past
    return heatmapCell(i, ml, "MVA", count, completed, overdue, count * 4);
  }),
  // A_MELDING — monthly, 5 clients
  ...M.map((ml, i) => {
    const count = 3; // 3 clients with employees
    const completed = i < 2 ? 3 : 0;
    return heatmapCell(i, ml, "A_MELDING", count, completed, 0, count * 1.5);
  }),
  // SKATTEMELDING — annual, May
  ...M.map((ml, i) => {
    const count = i === 4 ? 5 : 0;
    return heatmapCell(i, ml, "SKATTEMELDING", count, 0, 0, count * 8);
  }),
  // ARSREGNSKAP — annual, July
  ...M.map((ml, i) => {
    const count = i === 6 ? 3 : 0;
    return heatmapCell(i, ml, "ARSREGNSKAP", count, 0, 0, count * 16);
  }),
  // AKSJONAER — annual, January
  ...M.map((ml, i) => {
    const count = i === 0 ? 3 : 0;
    const completed = i === 0 ? 2 : 0;
    const overdue = i === 0 ? 1 : 0;
    return heatmapCell(i, ml, "AKSJONAER", count, completed, overdue, count * 3);
  }),
];

// ---------------------------------------------------------------------------
// Stat summaries
// ---------------------------------------------------------------------------

export const MOCK_ACCOUNTANT_STATS = {
  overdue: 2,
  active: 12,
  returned: 2,
  completedThisWeek: 5,
};

export const MOCK_ACCOUNTANT_PROGRESS = {
  weekCompletedPercent: 42,
  monthCompletedPercent: 68,
  deadlinesKept: { kept: 28, total: 31 },
  avgDaysBeforeDeadline: 2.4,
};

export const MOCK_CONTROLLER_STATS = {
  inQueue: 4,
  urgent: 1,
  approvedThisWeek: 7,
  returnedThisWeek: 2,
};

export const MOCK_CONTROLLER_THROUGHPUT = {
  thisWeek: { approved: 7, returned: 2 },
  thisMonth: { approved: 24, returned: 6, firstPassRate: 80 },
  avgControlTimeMinutes: 38,
};

export const MOCK_MANAGER_STATS = {
  activeTasks: 142,
  urgentThisWeek: 8,
  overdue: 3,
  complianceRateMonth: 90,
};
