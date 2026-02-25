import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  numeric,
  jsonb,
  index,
  varchar,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Companies (tenant = Clerk organization)
// ---------------------------------------------------------------------------
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    orgNumber: text("org_number"),
    // Self-reference: FK added in migration (avoids circular type)
    parentCompanyId: uuid("parent_company_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_companies_tenant").on(t.tenantId)]
);

// ---------------------------------------------------------------------------
// Accounts (konto)
// ---------------------------------------------------------------------------
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  accountNumber: text("account_number").notNull(),
  name: text("name").notNull(),
  accountType: text("account_type", {
    enum: ["ledger", "bank"],
  }).notNull(),
  currency: text("currency").default("NOK"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Parser configurations (innlesningsskript)
// ---------------------------------------------------------------------------
export const parserConfigs = pgTable("parser_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  fileType: text("file_type", {
    enum: ["csv", "excel", "camt", "xml", "fixed"],
  }).notNull(),
  config: jsonb("config").notNull(),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Clients (avstemmingsenhet = Set 1 + Set 2)
// ---------------------------------------------------------------------------
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  set1AccountId: uuid("set1_account_id")
    .notNull()
    .references(() => accounts.id),
  set2AccountId: uuid("set2_account_id")
    .notNull()
    .references(() => accounts.id),
  openingBalanceSet1: numeric("opening_balance_set1", { precision: 18, scale: 2 }).default("0"),
  openingBalanceSet2: numeric("opening_balance_set2", { precision: 18, scale: 2 }).default("0"),
  openingBalanceDate: date("opening_balance_date"),
  allowTolerance: boolean("allow_tolerance").default(false),
  toleranceAmount: numeric("tolerance_amount", { precision: 18, scale: 2 }).default("0"),
  status: text("status", { enum: ["active", "archived"] }).default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Matching rules (avstemmingsregler)
// ---------------------------------------------------------------------------
export const matchingRules = pgTable(
  "matching_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => clients.id),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    priority: integer("priority").notNull(),
    isActive: boolean("is_active").default(true),
    ruleType: text("rule_type", {
      enum: ["one_to_one", "many_to_one", "many_to_many"],
    }).notNull(),
    isInternal: boolean("is_internal").default(false),
    dateMustMatch: boolean("date_must_match").default(true),
    dateToleranceDays: integer("date_tolerance_days").default(0),
    compareCurrency: text("compare_currency", {
      enum: ["local", "foreign"],
    }).default("local"),
    allowTolerance: boolean("allow_tolerance").default(false),
    toleranceAmount: numeric("tolerance_amount", { precision: 18, scale: 2 }).default("0"),
    conditions: jsonb("conditions").default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_matching_rules_client").on(t.clientId, t.priority),
    index("idx_matching_rules_tenant").on(t.tenantId, t.priority),
  ]
);

// ---------------------------------------------------------------------------
// Imports (file import batches)
// ---------------------------------------------------------------------------
export const imports = pgTable(
  "imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(), // 1 or 2
    filename: text("filename").notNull(),
    filePath: text("file_path").notNull(),
    fileHash: text("file_hash"),
    fileSize: integer("file_size"),
    parserConfigId: uuid("parser_config_id").references(() => parserConfigs.id),
    recordCount: integer("record_count").default(0),
    status: text("status", {
      enum: ["pending", "processing", "completed", "failed", "duplicate"],
    }).default("pending"),
    errorMessage: text("error_message"),
    importedBy: text("imported_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_imports_client_set").on(t.clientId, t.setNumber),
    index("idx_imports_client_deleted").on(t.clientId, t.deletedAt),
    index("idx_imports_file_hash").on(t.clientId, t.setNumber, t.fileHash),
  ]
);

// ---------------------------------------------------------------------------
// Matches (groups of matched transactions)
// ---------------------------------------------------------------------------
export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  ruleId: uuid("rule_id").references(() => matchingRules.id),
  matchType: text("match_type", { enum: ["auto", "manual"] }).notNull(),
  difference: numeric("difference", { precision: 18, scale: 2 }).default("0"),
  matchedAt: timestamp("matched_at", { withTimezone: true }).defaultNow(),
  matchedBy: text("matched_by"),
});

// ---------------------------------------------------------------------------
// Transactions (transaksjoner/poster)
// ---------------------------------------------------------------------------
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(), // 1 or 2
    importId: uuid("import_id").references(() => imports.id),
    accountNumber: text("account_number"),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    foreignAmount: numeric("foreign_amount", { precision: 18, scale: 2 }),
    currency: text("currency").default("NOK"),
    date1: date("date1").notNull(),
    reference: text("reference"),
    description: text("description"),
    textCode: text("text_code"),
    dim1: text("dim1"),
    dim2: text("dim2"),
    dim3: text("dim3"),
    dim4: text("dim4"),
    dim5: text("dim5"),
    dim6: text("dim6"),
    dim7: text("dim7"),
    dim8: text("dim8"),
    dim9: text("dim9"),
    dim10: text("dim10"),
    sign: text("sign", { enum: ["+", "-"] }),
    date2: date("date2"),
    buntref: text("buntref"),
    notat: text("notat"),
    bilag: text("bilag"),
    faktura: text("faktura"),
    forfall: text("forfall"),
    periode: text("periode"),
    importNumber: text("import_number"),
    avgift: text("avgift"),
    tilleggstekst: text("tilleggstekst"),
    ref2: text("ref2"),
    ref3: text("ref3"),
    ref4: text("ref4"),
    ref5: text("ref5"),
    ref6: text("ref6"),
    anleggsnr: text("anleggsnr"),
    anleggsbeskrivelse: text("anleggsbeskrivelse"),
    bilagsart: text("bilagsart"),
    avsnr: text("avsnr"),
    tid: text("tid"),
    avvikendeDato: text("avvikende_dato"),
    rate: text("rate"),
    kundenavn: text("kundenavn"),
    kontonummerBokforing: text("kontonummer_bokforing"),
    matchId: uuid("match_id").references(() => matches.id),
    matchStatus: text("match_status", {
      enum: ["unmatched", "matched", "correction"],
    }).default("unmatched"),
    notatAuthor: text("notat_author"),
    mentionedUserId: text("mentioned_user_id"),
    notatCreatedAt: timestamp("notat_created_at", { withTimezone: true }),
    /** For manual transactions: amount that was added to client opening balance when created. Reversed on delete. */
    openingBalanceDelta: numeric("opening_balance_delta", { precision: 18, scale: 2 }).default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_transactions_client_set").on(t.clientId, t.setNumber),
    index("idx_transactions_unmatched").on(t.clientId, t.setNumber, t.matchStatus),
    index("idx_transactions_amount").on(t.clientId, t.amount),
    index("idx_transactions_date").on(t.clientId, t.date1),
    index("idx_transactions_amount_date").on(t.clientId, t.amount, t.date1),
    index("idx_transactions_created").on(t.clientId, t.createdAt),
    index("idx_transactions_dedup").on(t.clientId, t.setNumber, t.amount, t.date1, t.reference),
    index("idx_transactions_import_id").on(t.importId),
    index("idx_transactions_match_id").on(t.matchId),
  ]
);

// ---------------------------------------------------------------------------
// Audit logs (append-only)
// ---------------------------------------------------------------------------
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id").notNull(),
    userId: text("user_id").notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_audit_logs_tenant").on(t.tenantId, t.createdAt),
    index("idx_audit_logs_entity").on(t.entityType, t.entityId),
  ]
);

// ---------------------------------------------------------------------------
// Transaction attachments (vedlegg per transaksjon)
// ---------------------------------------------------------------------------
export const transactionAttachments = pgTable(
  "transaction_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    filePath: text("file_path").notNull(),
    fileSize: integer("file_size"),
    contentType: text("content_type"),
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_attachments_transaction").on(t.transactionId),
    index("idx_attachments_client").on(t.clientId),
  ]
);

// ---------------------------------------------------------------------------
// Notifications (varsler)
// ---------------------------------------------------------------------------
export const NOTIFICATION_TYPES = [
  "note_mention",
  "match_completed",
  "import_completed",
  "assignment",
  "deadline_reminder",
  "system",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id").notNull(),
    userId: text("user_id").notNull(),
    fromUserId: text("from_user_id"),
    type: text("type", { enum: [...NOTIFICATION_TYPES] }).notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    read: boolean("read").default(false),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    groupKey: text("group_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_notifications_user").on(t.userId, t.read, t.createdAt),
    index("idx_notifications_tenant").on(t.tenantId, t.createdAt),
  ]
);

// ---------------------------------------------------------------------------
// Knowledge Articles (AI knowledge base)
// ---------------------------------------------------------------------------
export const knowledgeArticles = pgTable("knowledge_articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  title: text("title").notNull(),
  slug: text("slug").unique().notNull(),
  content: text("content").notNull(),
  summary: text("summary"),
  keywords: text("keywords").array().default([]),
  appliesTo: text("applies_to").array().default([]),
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  source: text("source"),
  sourceUrl: text("source_url"),
  confidence: numeric("confidence", { precision: 3, scale: 2 }).default("1.00"),
  version: integer("version").default(1),
  status: text("status", { enum: ["published", "draft", "archived"] }).default("published"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Knowledge Snippets (quick facts)
// ---------------------------------------------------------------------------
export const knowledgeSnippets = pgTable("knowledge_snippets", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: uuid("article_id").references(() => knowledgeArticles.id, { onDelete: "set null" }),
  fact: text("fact").notNull(),
  context: text("context"),
  triggerPhrases: text("trigger_phrases").array().default([]),
  priority: integer("priority").default(0),
  alwaysInclude: boolean("always_include").default(false),
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Product Guides (step-by-step)
// ---------------------------------------------------------------------------
export const productGuides = pgTable("product_guides", {
  id: uuid("id").primaryKey().defaultRandom(),
  feature: text("feature").notNull(),
  title: text("title").notNull(),
  slug: text("slug").unique().notNull(),
  description: text("description"),
  prerequisites: text("prerequisites").array().default([]),
  steps: jsonb("steps").default([]),
  difficulty: text("difficulty", { enum: ["beginner", "intermediate", "advanced"] }).default("beginner"),
  estimatedTimeMinutes: integer("estimated_time_minutes"),
  roles: text("roles").array().default([]),
  keywords: text("keywords").array().default([]),
  status: text("status", { enum: ["published", "draft", "archived"] }).default("published"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Knowledge FAQ
// ---------------------------------------------------------------------------
export const knowledgeFaq = pgTable("knowledge_faq", {
  id: uuid("id").primaryKey().defaultRandom(),
  question: text("question").notNull(),
  questionVariants: text("question_variants").array().default([]),
  answer: text("answer").notNull(),
  answerAction: text("answer_action"),
  category: text("category"),
  feature: text("feature"),
  priority: integer("priority").default(0),
  timesMatched: integer("times_matched").default(0),
  status: text("status", { enum: ["published", "draft", "archived"] }).default("published"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Regulatory Deadlines (norske frister)
// ---------------------------------------------------------------------------
export const regulatoryDeadlines = pgTable("regulatory_deadlines", {
  id: uuid("id").primaryKey().defaultRandom(),
  obligation: text("obligation").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  frequency: text("frequency", { enum: ["monthly", "bimonthly", "quarterly", "yearly"] }).notNull(),
  periodStartMonth: integer("period_start_month"),
  periodEndMonth: integer("period_end_month"),
  deadlineRule: jsonb("deadline_rule").notNull(),
  exceptions: jsonb("exceptions").default([]),
  appliesToEntity: text("applies_to_entity").array().default([]),
  appliesToRole: text("applies_to_role").array().default([]),
  legalReference: text("legal_reference"),
  legalUrl: text("legal_url"),
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// AI User Memory (per user per org)
// ---------------------------------------------------------------------------
export const aiUserMemory = pgTable(
  "ai_user_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    organizationId: text("organization_id").notNull(),
    memoryType: text("memory_type").notNull(),
    content: text("content").notNull(),
    confidence: numeric("confidence", { precision: 3, scale: 2 }).default("0.80"),
    lastRelevantAt: timestamp("last_relevant_at", { withTimezone: true }).defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_ai_memory_user_org").on(t.userId, t.organizationId)]
);

// ---------------------------------------------------------------------------
// AI Conversations
// ---------------------------------------------------------------------------
export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    organizationId: text("organization_id").notNull(),
    messages: jsonb("messages").default([]),
    mode: text("mode", { enum: ["support", "onboarding"] }).default("support"),
    pageContext: text("page_context"),
    toolsUsed: text("tools_used").array().default([]),
    tokensUsed: integer("tokens_used").default(0),
    rating: integer("rating"),
    feedback: text("feedback"),
    resolved: boolean("resolved"),
    escalated: boolean("escalated").default(false),
    durationSeconds: integer("duration_seconds"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_ai_conv_user_org").on(t.userId, t.organizationId),
    index("idx_ai_conv_created").on(t.createdAt),
  ]
);

// ---------------------------------------------------------------------------
// User Onboarding
// ---------------------------------------------------------------------------
export const userOnboarding = pgTable(
  "user_onboarding",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    organizationId: text("organization_id").notNull(),
    profileCompleted: boolean("profile_completed").default(false),
    firstClientCreated: boolean("first_client_created").default(false),
    bankConnected: boolean("bank_connected").default(false),
    firstMatchRun: boolean("first_match_run").default(false),
    teamInvited: boolean("team_invited").default(false),
    notificationsConfigured: boolean("notifications_configured").default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("idx_user_onboarding_user").on(t.userId)]
);

// ---------------------------------------------------------------------------
// Agent Report Configs (per-client scheduled matching & reporting)
// ---------------------------------------------------------------------------
export const SCHEDULE_PRESETS = [
  "daily",
  "weekly_mon",
  "weekly_tue",
  "weekly_wed",
  "weekly_thu",
  "weekly_fri",
  "weekly_sat",
  "weekly_sun",
  "biweekly",
  "monthly_1",
  "monthly_15",
] as const;

export type SchedulePreset = (typeof SCHEDULE_PRESETS)[number];

export const agentReportConfigs = pgTable(
  "agent_report_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    createdBy: text("created_by").notNull(),
    enabled: boolean("enabled").default(false).notNull(),

    reportTypes: jsonb("report_types")
      .default(sql`'["open_items"]'::jsonb`)
      .notNull(),

    smartMatchEnabled: boolean("smart_match_enabled").default(true).notNull(),
    smartMatchSchedule: text("smart_match_schedule"),

    reportSchedule: text("report_schedule"),

    specificDates: jsonb("specific_dates").default(sql`'[]'::jsonb`),

    preferredTime: text("preferred_time").default("03:00"),

    nextMatchRun: timestamp("next_match_run", { withTimezone: true }),
    nextReportRun: timestamp("next_report_run", { withTimezone: true }),
    lastMatchRun: timestamp("last_match_run", { withTimezone: true }),
    lastReportRun: timestamp("last_report_run", { withTimezone: true }),
    lastMatchCount: integer("last_match_count"),

    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_agent_config_client").on(t.clientId),
    index("idx_agent_config_tenant").on(t.tenantId),
    index("idx_agent_config_next_match").on(t.enabled, t.nextMatchRun),
    index("idx_agent_config_next_report").on(t.enabled, t.nextReportRun),
  ]
);

// ---------------------------------------------------------------------------
// Agent Job Logs (execution history)
// ---------------------------------------------------------------------------
export const agentJobLogs = pgTable(
  "agent_job_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    configId: uuid("config_id")
      .notNull()
      .references(() => agentReportConfigs.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    clientId: uuid("client_id").notNull(),
    jobType: text("job_type", {
      enum: ["smart_match", "report", "both"],
    }).notNull(),
    status: text("status", {
      enum: ["success", "failed", "partial"],
    }).notNull(),
    matchCount: integer("match_count"),
    transactionCount: integer("transaction_count"),
    reportSent: boolean("report_sent").default(false),
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_agent_logs_config").on(t.configId, t.createdAt),
    index("idx_agent_logs_client").on(t.clientId, t.createdAt),
  ]
);
