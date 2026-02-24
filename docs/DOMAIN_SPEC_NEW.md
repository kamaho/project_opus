# Account Control — Domain Specification

> This document describes the business domain, rules, and data flows for a reconciliation SaaS
> targeting Norwegian accountants. It serves as the primary context for AI-assisted development
> of the new platform. The product consolidates multiple modules into a single unified application
> with feature toggles: transaction matching, balance reconciliation, task management,
> annual reporting, and a public API.
>
> **Important**: This document describes what we are *building*, not a copy of the legacy system.
> Where the legacy system has known limitations or poor UX, this spec describes the improved
> target state.

---

## 1. Product Overview

### What we do
We automate reconciliation and compliance documentation for accounting firms, focusing on:
- **Transaction matching** — matching records between two data sets (typically general ledger vs. bank)
- **Balance reconciliation** — verifying accounting balances against reported figures (Altinn/A-melding) and outstanding items
- **Task management** — workflow automation for deadlines, exceptions, approvals, and team coordination
- **Annual reporting** — audit-ready documentation package generated continuously throughout the year
- **Public API** — programmatic access to reconciliation data and operations for integrators

### Architecture vision
- **Single unified application** with feature activation/deactivation per tenant
- Replace two separate legacy modules with one modern platform
- **Exception-based workflow** — system handles routine reconciliation automatically; users only see and act on discrepancies
- **API-first design** — UI and public API share the same service layer for identical behavior
- Modular design allowing future expansion

### Key competitive advantages
1. **Flexible file parser engine** — can handle virtually any file format (CSV, Excel, XML/CAMT, bank-specific formats, fixed-length) via declarative configuration
2. **Custom matching rules** — configurable, priority-based rule engine that can be tailored per customer
3. **Audit-ready year-round** — continuous documentation generation means no scrambling at revision time
4. **Exception-only interface** — accountants focus on what matters, not routine matching
5. **Controller dashboard** — real-time balance visibility and reconciliation status across all companies
6. **Future ambition**: AI-assisted rule generation based on pattern recognition

### Target users
| Role | Norwegian | Primary value |
|------|-----------|---------------|
| Accountant | Regnskapsfører | Exception-only workflow, massive time savings on routine reconciliation |
| Controller / CFO | Controller | Real-time balance oversight, reconciliation status dashboard, audit confidence |
| Auditor | Revisor | Complete documentation package, no additional requests, structured format |
| Team lead | Teamleder | Workload distribution, deadline tracking, quality assurance |

---

## 2. Core Concepts & Data Model

### Tenant hierarchy
```
Tenant (accounting firm)
  └── Company (konsern/selskap)
       └── Account (konto)
            └── Client (avstemmingsenhet)
                 ├── Set 1 / Mengde 1 (typically: general ledger / hovedbok)
                 └── Set 2 / Mengde 2 (typically: bank)
```

### Key entities

| Entity | Norwegian term | Description |
|--------|---------------|-------------|
| Tenant | Tenant | The accounting firm — top-level isolation boundary |
| Company | Selskap | A company within the firm's client portfolio, part of a group (konsern) |
| Account | Konto | A specific account (identified by account number) to be reconciled |
| Client | Klient | A reconciliation unit pairing Set 1 and Set 2 |
| Set / Mengde | Mengde | One side of a reconciliation — a collection of transactions from a single source |
| Transaction | Transaksjon/Post | An individual record within a set |
| Parser script | Innlesningsskript | Declarative configuration mapping file fields to internal fields |
| Matching rule | Avstemmingsregel | A rule defining how transactions from Set 1 and Set 2 are matched |
| Balance report | Rapport | A reconciliation report comparing accounting data against reported/external data |
| Task | Oppgave | A trackable work item with assignee, deadline, and status |
| Annual report | Årsrapport | Audit-ready documentation package for a fiscal year |

### Onboarding data requirements
When setting up a new customer, the following information is needed:
- Corporate structure (group name, company names)
- Which accounts to reconcile
- Account numbers for general ledger and bank
- Opening balances as of a specific date
- Example files for both accounting and bank data
- Whether currency reconciliation is needed
- Which accounting system they use
- Which bank(s) they use

---

## 3. Transaction Matching Module

### 3.1 Customer types (onboarding levels)

All three types share the same core data model (Client = Set 1 + Set 2). The difference is how data enters the system.

#### File-based (Filbasert)
- **Set 1 (ledger):** Manual file upload by user
- **Set 2 (bank):** Manual file upload by user
- **Onboarding:** Manual setup of tenant, accounts, balances, parser scripts via admin tool
- **Ongoing:** User uploads files and runs reconciliation

#### Automatic bank (Automatisk bank)
- **Set 1 (ledger):** Manual file upload by user
- **Set 2 (bank):** Automatic via SFTP connection to bank
- **Onboarding:** Same as file-based PLUS SFTP setup with the bank (major bottleneck today)
- **Ongoing:** Bank files arrive automatically; user uploads ledger files

#### Fully automatic (Helautomatisk)
- **Set 1 (ledger):** Automatic via API integration with accounting system
- **Set 2 (bank):** File-based or SFTP (bank side still requires file/SFTP setup)
- **Onboarding:** Integration setup with accounting system + bank-side setup as above
- **Ongoing:** Ledger data syncs automatically; bank data arrives via file/SFTP

### 3.2 File parser engine

The parser system is a **declarative, configuration-driven file import engine**. It is NOT hardcoded per format. A parser configuration (script) maps fields from the source file to internal fields.

#### Supported formats
- CSV (various delimiters, decimal formats)
- Excel (.xlsx)
- XML — specifically CAMT.053 / ISO 20022
- Bank-specific formats (Nordea/Klink, DNB Telepay, Danske Bank, Nornett)
- Fixed-length formats (Header-ID based)
- Opening balance files (Åpningsposter)
- Credit/Debit/Foreign amount variants

#### Parser configuration example (CAMT.053)
```
FILETYPE;CAMT
BARENYE;Dato1;
BARENYE;Belop;
PARSEMODE;SUMRECORDS;
SIGNSWITCH;Belop LIKE '%%'
[Transer]
Kontonr;AccountIdentification
Valutakode;CurrencyCode
Belop;TxAmt
Valbelop;TxAmt
Dato1;Dato1
Dim1;Proprietary
Dim2;Dim2
Dim3;CodeOrProprietary
Dim4;AcctSvcrRef
Dim5;RmtInf
Dim6;Ustrd
Dim7;AddtlTxInf
Ref;Text
Tekst;Proprietary
Tekstkode;AccountIdentification
Fortegn;Fortegn
CHECKDUPLICATES
```

#### Parser configuration concepts
| Directive | Purpose |
|-----------|---------|
| FILETYPE | Identifies the file format (CSV, CAMT, EXCEL, etc.) |
| BARENYE | Specifies which fields to import (only new/relevant data) |
| PARSEMODE | How to process records (e.g., SUMRECORDS) |
| SIGNSWITCH | Rules for sign inversion on amounts |
| [Transer] | Field mapping section: InternalField;SourceField |
| CHECKDUPLICATES | Enable duplicate detection |

#### Internal transaction fields
| Field | Description |
|-------|-------------|
| Kontonr | Account number |
| Valutakode | Currency code |
| Belop | Amount (local currency) |
| Valbelop | Amount (foreign currency) |
| Dato1 | Primary date |
| Dim1-Dim7 | Dimension fields (flexible, used for various metadata) |
| Ref | Reference number |
| Tekst | Description text |
| Tekstkode | Text code |
| Fortegn | Sign (+/-) |

### 3.3 Matching rule engine

Matching runs as a **priority-based rule pipeline**. Rules execute in order (priority 1 first). Each rule processes unmatched transactions left by previous rules.

#### Standard rule set (10 rules)

| Priority | Type | Date condition | Description |
|----------|------|---------------|-------------|
| 1 | 1:1 | date equal | Match one record in Set 1 against one in Set 2, dates must match |
| 2 | 1:1 | date not equal | Match one record in Set 1 against one in Set 2, dates need not match |
| 3 | Internal 1:1 | date equal | Match records within the same set (e.g., internal ledger offsets), dates must match |
| 4 | Internal 1:1 | date not equal | Internal matching, dates need not match |
| 5 | Many:1 | date equal | Multiple records in Set 1 against one in Set 2, dates must match |
| 6 | Many:1 | date not equal | Multiple records in Set 1 against one in Set 2, dates need not match |
| 7 | Internal Many:1 | date equal | Multiple internal records against one, dates must match |
| 8 | Internal Many:1 | date not equal | Multiple internal records against one, dates need not match |
| 9 | Many:Many | date equal | Multiple records on both sides, dates must match |
| 10 | Many:Many | date not equal | Multiple records on both sides, dates need not match |

#### Rule configuration parameters
Each rule can be configured with:
- **Match type**: 1:1, Many:1, Internal Many:1, Many:Many
- **Set assignment**: Which set is Mengde 1, which is Mengde 2
- **Conditions (Forhold)**: Date comparison rules (Date1 Equals Date1, etc.)
- **Filters (Betingelse)**: Field-level matching criteria
- **Amount comparison**: Local currency (lokalvaluta) or foreign currency (fremmedvaluta)
- **Tolerance (Avstem med differanse)**: Allow matching with a permitted deviation
- **Date tolerance (Datoavvik)**: Allow matching within a date range
- **Account filter (Konto)**: Restrict rule to specific accounts
- **Summing (Summér beløp etter)**: Group and sum amounts by specified field

#### Rule customization
- Most bank customers use the standard rule set
- Large/complex customers require custom rules — this is a key differentiator
- **Future vision**: AI-driven rule suggestion based on transaction pattern analysis

### 3.4 Manual matching

Transactions remaining after all rules have run must be handled manually:
- User selects transactions from both sets that should match
- Selected transactions must **sum to zero** to be reconciled
- **Internal matching**: User can select multiple transactions within a single set — as long as they sum to zero, they can be matched against each other
- **Cross-set matching**: User can select one or more transactions in Mengde 1 against one or more in Mengde 2
- **Tolerance setting**: If enabled, matching with a deviation creates an opening post (åpningspost)
- Opening posts carry forward and must be resolved

### 3.5 Currency reconciliation
- Optional feature per account
- Amounts can be compared in either local currency or foreign currency
- Currency code is tracked per transaction

---

## 4. Balance Reconciliation Module

### 4.1 Data sources
- **Accounting data**: Always fetched via API integration with the customer's accounting system (ERP)
  - Retrieves: chart of accounts (hovedbokskontoer), balances (saldoer), transactions, vouchers (bilag)
- **A-melding data**: Fetched via API from Altinn (A07 report)
  - Contains: reported salary, employer's tax, withholding tax, holiday pay data

### 4.2 Report types

#### Reports reconciled against A-melding (Altinn)
These compare aggregated accounting figures against what was reported to tax authorities.

| Report | Norwegian | What is compared |
|--------|-----------|-----------------|
| VAT | MVA | Accounting VAT entries vs. reported VAT (multiple categories: A-G + line 19) |
| Employer's tax | Arbeidsgiveravgift (AGA) | Calculated AGA from accounting vs. reported AGA. Shows: base amount (grunnlag), AGA amount, both per term and YTD |
| Withholding tax | Forskuddstrekk | Booked withholding vs. reported withholding (note: this report will be deprecated soon) |
| Salary | Lønn | Accounting salary entries vs. reported salary in A-melding. Shows: taxable benefits, employer's tax-liable benefits, holiday pay, refunds, pension, active shareholders |
| Holiday pay | Feriepenger | Complex calculation: basis from ledger accounts, accrued holiday pay (rates: 12% standard + 2.3% over 60), paid-out holiday pay, opening balance, closing balance vs. account balance |

#### Report structure for A-melding reports (target UX)
Each report follows a common pattern, but the new design prioritizes clarity and actionability:
- **Summary card at top**: Difference highlighted prominently — green (OK), yellow (minor), red (needs attention)
- **Timeline view**: Bi-monthly terms (jan-feb, mar-apr, mai-jun, jul-aug, sep-okt, nov-des) showing Altinn vs. ERP trend as a visual chart
- **Comparison table**: "Rapportert A07" (reported) vs. "Bokført" (booked) vs. "Differanse" (difference)
- **Term view**: Current term figures
- **YTD view**: Year-to-date cumulative figures
- **Detail expansion**: Drill-down into individual entries with clear source tracing
- **Altinn reference**: Links back to Altinn submission reference
- **Actions**: Approve (creates immutable approved report) or Flag for review (creates task)
- **Audit note**: Free-text field for documenting explanations of differences — stored as part of audit trail

#### Reports based on vouchers/transactions (no A-melding)
These use transaction data from the accounting system and require matching to determine outstanding items.

| Report | Norwegian | Target state |
|--------|-----------|-------------|
| Accounts receivable | Kundefordringer | **Aged trial balance** (aldersfordelt saldoliste) with customer grouping, aging buckets (0-30, 31-60, 61-90, 90+), filtering by amount/customer/age, and drill-down to individual vouchers |
| Accounts payable | Leverandørgjeld | Same structure as receivable — aged trial balance for supplier balances |
| Accruals | Periodiseringer | Outstanding accrual entries with period tracking and resolution status |

**Key insight**: The accounting system API does not indicate whether an item is paid/settled. This is only determined by matching transactions on our end (e.g., an invoice against a payment).

**Improvement over legacy**: The legacy system shows a flat list of outstanding vouchers per customer. The new platform transforms this into a proper aged trial balance with:
- Aging buckets with configurable ranges
- Sortable/filterable columns
- Summary totals per aging bucket
- Export capability
- Visual indicators for overdue items

### 4.3 Embedded transaction matching
The balance module includes a built-in version of the transaction matching engine. In this context:
- Set 1 (Mengde 1) comes automatically from the accounting system integration
- Set 2 (Mengde 2) works like regular transaction matching (file upload, SFTP, or integration)
- Same matching rules apply

### 4.4 Holiday pay report detail (Feriepengerapport)
This is the most complex report. Structure:
1. **Holiday pay basis** (Grunnlag feriepenger): Lists ledger accounts contributing to basis (e.g., account 5000 "Faste lønninger") with amounts
2. **Accrued holiday pay** (Påløpte feriepenger): Calculates based on rates:
   - 12.00% — Standard (Avtalefestet)
   - 2.30% — Supplement for employees over 60
3. **Owed holiday pay** (Skyldige feriepenger):
   - Paid out holiday pay (with/without withholding tax)
   - Opening balance (IB)
   - Closing balance vs. account balance (Saldo konto)
   - Difference
   - Holiday pay list comparison
4. **Employer's tax on owed holiday pay**: Calculated at zone-specific rates (e.g., 14.10% Sone I)
5. **User inputs**: Some fields require manual entry (paid holiday pay amounts, personal income for active shareholders)

### 4.5 MVA report detail (VAT reconciliation)
Structure:
- **Term view**: Shows each VAT category (A through G + line 19) per bi-monthly term
- **Summary**: Total reported vs. total from accounting vs. difference
- **Categories**: A. Total turnover/input/import, B. Domestic turnover/input, C. Export, D. Import of goods, E. Reverse charge purchases, F. Deductible input VAT, G. Deductible import VAT, 19. Amount to pay/receive

### 4.6 AGA report detail (Employer's tax reconciliation)
Structure:
- **Per term**: Shows grunnlag (base amount) and calculated AGA from both accounting and A-melding
- **Zone-based rates**: AGA rates vary by geographical zone (Sone I: 14.10%, Sone Ia: 10.60%, Sone II-V: varying rates, Sone V (Svalbard): 0%)
- **YTD cumulative**: Running total showing accumulated difference
- **Multi-zone support**: Companies with employees in multiple zones show per-zone breakdown

### 4.7 Salary report detail (Lønnsrapport)
Structure:
- **Categories**: Taxable benefits (skattepliktige ytelser), employer's tax-liable benefits, holiday pay, refunds, pension, active shareholder income
- **Per term comparison**: Reported vs. booked per bi-monthly term
- **Person-level drill-down**: Ability to see individual employee contributions (from A-melding data)
- **YTD summary**: Accumulated figures with running difference

---

## 5. Task Management Module

### 5.1 Purpose
The task module manages workflow for the accounting firm. Tasks can be created automatically by the system (e.g., when a reconciliation finds a difference) or manually by users. The module tracks deadlines, assignments, and completion across all companies and reconciliation types.

### 5.2 Task types

#### System-generated tasks
These are created automatically when certain conditions are met:
- **Reconciliation difference** — when a balance report shows a difference above a configurable threshold
- **Unmatched transactions** — when automatic matching leaves items unmatched beyond a configured period
- **Upcoming deadline** — periodic tasks generated based on Norwegian accounting calendar (e.g., A-melding due dates, MVA filing deadlines)
- **Overdue items** — aged receivables/payables beyond threshold
- **Report approval needed** — when a reconciliation report is ready for review

#### User-created tasks
- Free-form tasks with title, description, assignee, deadline
- Can be linked to a specific company, account, or report
- Support for subtasks/checklists

### 5.3 Task data model

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| tenantId | UUID | Tenant isolation |
| companyId | UUID? | Optional — link to specific company |
| reportId | UUID? | Optional — link to specific reconciliation report |
| accountId | UUID? | Optional — link to specific account |
| type | enum | `reconciliation_difference`, `unmatched_items`, `deadline`, `overdue_items`, `approval_needed`, `manual` |
| title | string | Task title |
| description | string? | Detailed description or system-generated explanation |
| status | enum | `open`, `in_progress`, `waiting`, `completed`, `cancelled` |
| priority | enum | `low`, `medium`, `high`, `critical` |
| assigneeId | UUID? | Assigned user |
| createdBy | UUID | User or system that created the task |
| dueDate | date? | Deadline |
| completedAt | timestamp? | When the task was completed |
| completedBy | UUID? | Who completed it |
| resolution | string? | How the task was resolved (free text or structured) |
| metadata | jsonb | Flexible data — e.g., difference amount, threshold, linked transactions |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### 5.4 Norwegian accounting calendar

The task module includes a built-in calendar of Norwegian accounting deadlines. These generate recurring tasks per company:

| Deadline | Frequency | Description |
|----------|-----------|-------------|
| A-melding | Monthly (5th of following month) | Report salary, tax, and social security data to Altinn |
| MVA-oppgave | Bi-monthly (1 month + 10 days after term end) | VAT return filing |
| Skattemelding | Annual (May 31) | Corporate tax return |
| Årsregnskap | Annual (varies, typically June 30) | Annual financial statements |
| Revisjonsberetning | Annual (follows årsregnskap) | Audit report |
| Forskuddsskatt | Quarterly (Feb 15, Apr 15, Sep 15, Nov 15) | Advance corporate tax payments |

Tenants can customize which deadlines are active per company and add their own custom recurring deadlines.

### 5.5 Task views

#### List view (default)
- Sortable by due date, priority, company, status, type
- Filterable by all fields
- Groupable by company, assignee, or status
- Overdue tasks highlighted

#### Calendar view
- Month/week view showing tasks by due date
- Norwegian accounting deadlines pre-populated
- Color-coded by priority and status

#### Dashboard view (for controllers/team leads)
- Tasks per assignee with workload distribution
- Overdue count and aging
- Completion rate trends
- Exception resolution time metrics

### 5.6 Task automation rules

Tenants can configure rules for automatic task creation:
- **Threshold-based**: Create task when difference exceeds X NOK
- **Time-based**: Create task when items are unmatched for X days
- **Assignment rules**: Auto-assign based on company owner, account type, or amount threshold
- **Escalation**: Auto-escalate (change priority) if task is overdue by X days

### 5.7 Comments and activity log

Each task has a comment thread and activity log:
- Comments support @mentions for notifications
- Activity log tracks all status changes, reassignments, and edits
- Attachments can be added (e.g., supporting documentation)
- The entire history is part of the audit trail

---

## 6. Annual Reporting Module (Årsrapportering)

### 6.1 Purpose
The annual reporting module generates audit-ready documentation packages. Instead of scrambling at year-end, the system continuously accumulates reconciliation results, approvals, and exception documentation throughout the year. When audit time comes, the package is ready.

### 6.2 Core concept: Continuous preparation
Every action in the system contributes to the annual report:
- **Approved reconciliation reports** — stored immutably with timestamp, approver, and any notes
- **Exception documentation** — every manual matching, correction post, or flagged difference is documented with who, when, why
- **Task resolutions** — completed tasks include resolution notes that explain how exceptions were handled
- **Balance trend data** — monthly/bi-monthly snapshots showing balance development over the year

### 6.3 Report package structure

An annual report package for a company contains:

#### 6.3.1 Summary (Oppsummering)
- Company overview: name, org number, fiscal year
- Reconciliation coverage: which accounts/reports were reconciled, completion status
- Exception summary: total exceptions found, resolved, outstanding
- Overall status: fully reconciled / partially reconciled / issues outstanding

#### 6.3.2 Balance documentation (Balansedokumentasjon)
For each reconciled account/report type:
- **Bank reconciliation** (per account): Final reconciled balance, list of outstanding items (if any), matching statistics (auto vs. manual), correction posts
- **MVA**: Per-term comparison Altinn vs. accounting, full-year summary, any differences with explanations
- **AGA**: Per-term comparison with zone breakdown, full-year summary
- **Lønn**: Per-term salary reconciliation summary
- **Feriepenger**: Full holiday pay calculation with basis, accruals, payments, and closing balance
- **Kundefordringer**: Aged trial balance as of year-end
- **Leverandørgjeld**: Aged trial balance as of year-end
- **Periodiseringer**: Outstanding accruals with status

#### 6.3.3 Exception log (Avvikslogg)
Chronological list of all exceptions encountered during the year:
- What the exception was
- Which account/report it relates to
- Who handled it and when
- Resolution description
- Supporting documentation (if attached)

#### 6.3.4 Approval trail (Godkjenningslogg)
Every report approval with:
- Report type and period
- Approved by (user name and role)
- Approval timestamp
- Any notes added at approval time

### 6.4 Report generation

- **On-demand generation**: User clicks "Generate annual report" for a company and year
- **Format**: PDF export with structured sections, or interactive web view
- **Incremental**: Shows progress — which parts are complete, which are missing
- **Incomplete handling**: Clearly marks sections that are not yet reconciled or approved, so the user/auditor knows what remains

### 6.5 Auditor access (future)

- Read-only link for auditors to access a company's annual report package
- No Account Control login required — token-based access with expiry
- Auditors can leave comments/questions on specific sections
- Comments create tasks for the accountant

### 6.6 Data immutability rules

- Once a report is approved, it becomes immutable — no edits, only new versions
- If a correction is needed after approval, a new version is created with change documentation
- All versions are retained for the full retention period (Bokføringsloven: 5-10 years)
- Deletion is never allowed within the retention period

---

## 7. Integrations

### 7.1 Accounting system integrations
Multiple integrations via API to different Norwegian accounting systems. Each integration is somewhat unique but serves the same purpose: fetching chart of accounts, balances, transactions, and vouchers.

Known systems (non-exhaustive): Tripletex, Visma, PowerOffice, Xledger, and others.

#### Integration adapter pattern
Each accounting system has its own adapter that implements a common interface:
```
interface AccountingSystemAdapter {
  getChartOfAccounts(companyId): Account[]
  getBalances(companyId, period): Balance[]
  getTransactions(companyId, accountId, dateRange): Transaction[]
  getVouchers(companyId, dateRange): Voucher[]
}
```
This allows adding new integrations without changing core business logic.

### 7.2 Bank integrations
- **SFTP connections** to banks for automatic file delivery
- Currently a major bottleneck due to manual setup process
- Bank files follow standard formats (CAMT.053, bank-specific CSV, etc.)
- **Future**: Explore open banking APIs (PSD2) as alternative to SFTP

### 7.3 Altinn integration
- API connection to Altinn for fetching A-melding data (A07 reports)
- Used for balance reconciliation reports (MVA, AGA, Forskuddstrekk, Lønn, Feriepenger)
- Authentication via Altinn API keys / Maskinporten

### 7.4 Public API
Account Control exposes a public REST API for programmatic access. See DEVELOPMENT_RULES.md section 6.2 for full specification. Key capabilities:
- List and manage companies
- Retrieve reconciliation reports and their status
- Trigger reconciliation runs
- Manage tasks (CRUD)
- Subscribe to webhooks for events (report completed, difference found, task overdue, etc.)
- Manage API keys with granular scopes

---

## 8. Controller Dashboard

### 8.1 Purpose
A real-time overview for controllers, CFOs, and team leads. Shows the health of all reconciliations across all companies at a glance.

### 8.2 Dashboard components

#### Company overview grid
- All companies in a tenant, each showing:
  - Reconciliation status (traffic light: green/yellow/red)
  - Last reconciled date
  - Number of open exceptions
  - Number of overdue tasks
  - Click to drill into company detail

#### KPI cards
- **Auto-match rate**: Percentage of transactions matched automatically (target: 70-90%)
- **Open exceptions**: Total across all companies
- **Overdue tasks**: Count with aging breakdown
- **Reports pending approval**: Count
- **Reconciliation coverage**: Percentage of accounts/reports that are up-to-date

#### Activity feed
- Recent approvals, completed tasks, new exceptions
- Filterable by company or user

#### Balance monitoring
- Per-account balance trend over time
- Alert when balance deviates from expected range
- Quick access to underlying report

---

## 9. Current Pain Points & Improvements

### Onboarding is too manual
- **Legacy**: Setting up tenants, accounts, balances, and parser scripts is time-consuming
- **Target**: Streamlined onboarding wizard with template-based setup, accounting system auto-detection

### SFTP bank connections are a bottleneck
- **Legacy**: Manual coordination with banks
- **Target**: Self-service SFTP setup guide + explore open banking APIs

### Rule builder UX is poor
- **Legacy**: Current rule builder is unintuitive
- **Target**: Visual, drag-and-drop rule builder with clear previews and "test against sample data" capability

### Report design needs improvement
- **Legacy**: Reports are functional but poorly designed and lack user-friendliness
- **Target**: Modern, clean report UI with data visualization, exception highlighting, and inline documentation

### Accounts receivable/payable need enhancement
- **Legacy**: Flat list of outstanding vouchers per customer
- **Target**: Proper aged trial balance (aldersfordelt saldoliste) with filtering, sorting, aging buckets, and export

### No task management
- **Legacy**: Exception handling is ad-hoc, no tracking
- **Target**: Full task module with automation, deadlines, and audit trail

### No structured annual reporting
- **Legacy**: Audit documentation compiled manually at year-end
- **Target**: Continuous preparation with on-demand report generation

---

## 10. Scope & Roadmap

### Phase 1 — Core transaction matching (MVP)
- [x] Core data model (tenant → company → account → client → sets)
- [x] File upload and parsing (comprehensive format support)
- [x] Manual matching (1:1, many:1, many:many, internal)
- [x] Balance tracking (opening balance, running saldo)
- [ ] Automatic matching with standard rule set
- [ ] Rule configuration UI

### Phase 2 — Balance reconciliation
- [ ] Accounting system integration (start with one system, e.g., Tripletex)
- [ ] Altinn API integration for A-melding
- [ ] MVA report with new UX
- [ ] AGA report
- [ ] Salary report
- [ ] Holiday pay report
- [ ] Accounts receivable — aged trial balance
- [ ] Accounts payable — aged trial balance
- [ ] Accruals report

### Phase 3 — Task management & workflow
- [ ] Task data model and CRUD
- [ ] Norwegian accounting calendar with recurring deadlines
- [ ] Automatic task creation rules (threshold, time, overdue)
- [ ] Task assignment and escalation
- [ ] Task views (list, calendar, dashboard)
- [ ] Comments and activity log

### Phase 4 — Annual reporting & audit
- [ ] Continuous documentation accumulation
- [ ] Report approval workflow (immutable approved reports)
- [ ] Annual report package generation
- [ ] PDF export
- [ ] Auditor access (read-only token-based)

### Phase 5 — Public API & integrations
- [ ] API key management with scopes
- [ ] Public REST API endpoints
- [ ] Webhooks for events
- [ ] OpenAPI documentation
- [ ] Rate limiting

### Phase 6 — Intelligence & automation
- [ ] AI-assisted rule suggestion
- [ ] Anomaly detection in balances
- [ ] Smart exception classification
- [ ] Predictive deadline management

### Foundation requirements (build from day 1)
- [x] Multi-tenant architecture
- [ ] Feature toggle system (to activate/deactivate modules per tenant)
- [x] Extensible parser engine (easy to add new formats)
- [ ] Configurable rule engine (rules stored as data, not code)
- [x] Clean API design (ready for future integrations)
- [x] Proper data model that supports both transaction matching and balance reconciliation

---

## 11. Glossary

| Term | Norwegian | Definition |
|------|-----------|------------|
| Reconciliation | Avstemming | The process of verifying that two sets of records match |
| General ledger | Hovedbok | The primary accounting record |
| Set / Quantity | Mengde | One side of a reconciliation (Set 1 or Set 2) |
| Voucher | Bilag | An accounting document/entry |
| Balance | Saldo | Account balance at a point in time |
| A-melding | A-melding | Monthly report to Norwegian tax authorities containing salary, tax, and social security data |
| Employer's tax | Arbeidsgiveravgift (AGA) | Social security contributions paid by employer |
| Withholding tax | Forskuddstrekk | Tax withheld from employee salary |
| Holiday pay | Feriepenger | Mandatory holiday pay accrual in Norway |
| VAT | MVA (Merverdiavgift) | Value Added Tax |
| Aged trial balance | Aldersfordelt saldoliste | Report showing outstanding items grouped by age |
| Opening balance | Inngående balanse (IB) | Balance at the start of a period |
| Closing balance | Utgående balanse (UB) | Balance at the end of a period |
| Opening post | Åpningspost | An open item created when matching with tolerance/deviation |
| Parser script | Innlesningsskript | Declarative configuration for file import |
| Term | Termin | Bi-monthly reporting period (jan-feb, mar-apr, etc.) |
| YTD | Year-to-date | Cumulative figures from January 1 to current period |
| Exception | Avvik | A discrepancy that requires manual review |
| Approval | Godkjenning | Formal sign-off that a report is correct |
| Immutable report | Låst rapport | An approved report that cannot be edited, only versioned |
| Annual report | Årsrapport | Complete audit documentation package for a fiscal year |
| Audit trail | Revisjonslogg | Chronological record of all actions for compliance |
| Task | Oppgave | A trackable work item with assignee and deadline |
| Fiscal year | Regnskapsår | The 12-month accounting period |
| Audit / Revision | Revisjon | External review of financial statements by an auditor |
| Zone rate | Sonesats | Geographically determined AGA rate in Norway |
| Open banking | Åpen bank (PSD2) | API-based bank data access as alternative to SFTP |
| Maskinporten | Maskinporten | Machine-to-machine authentication for Norwegian public APIs |
