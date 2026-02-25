# Revizo — Domain Specification

> This document describes the business domain, rules, and data flows for a reconciliation SaaS
> targeting Norwegian accountants. It serves as the primary context for AI-assisted development
> of the new platform. The product consolidates two existing modules (transaction matching and
> balance reconciliation) into a single unified application with feature toggles.

---

## 1. Product Overview

### What we do
We automate reconciliation for accounting firms, focusing on:
- **Transaction matching** — matching records between two data sets (typically general ledger vs. bank)
- **Balance reconciliation** — verifying accounting balances against reported figures (Altinn/A-melding) and outstanding items

### Architecture vision
- **Single unified application** with feature activation/deactivation per tenant
- Replace two separate legacy modules with one modern platform
- Modular design allowing future expansion

### Key competitive advantages
1. **Flexible file parser engine** — can handle virtually any file format (CSV, Excel, XML/CAMT, bank-specific formats, fixed-length) via declarative configuration
2. **Custom matching rules** — configurable, priority-based rule engine that can be tailored per customer
3. **Future ambition**: AI-assisted rule generation based on pattern recognition

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

#### Report structure for A-melding reports
Each report follows a common pattern:
- **Timeline view**: Bi-monthly terms (jan-feb, mar-apr, mai-jun, jul-aug, sep-okt, nov-des) showing Altinn vs. ERP trend
- **Comparison table**: "Rapportert A07" (reported) vs. "Bokført" (booked) vs. "Differanse" (difference)
- **Term view**: Current term figures
- **YTD view**: Year-to-date cumulative figures
- **Detail expansion**: "Utvid detaljer" to drill into individual entries
- **Altinn reference**: Links back to Altinn submission reference
- **Action**: Approve (Godkjenn / Opprett rapport) or Cancel (Avbryt / Slett rapport)

#### Reports based on vouchers/transactions (no A-melding)
These use transaction data from the accounting system and require matching to determine outstanding items.

| Report | Norwegian | What is shown |
|--------|-----------|--------------|
| Accounts receivable | Kundefordringer | Outstanding customer balances with individual vouchers. Shows per customer: voucher number, invoice number, date, due date, text, notes, amount. Header shows: account (e.g., 1500), period end date, account balance, reconciliation amount, difference |
| Accounts payable | Leverandørgjeld | Same structure as receivable, for supplier balances |
| Accruals | Periodiseringer | Outstanding accrual entries |

**Key insight**: The reason transaction matching is needed for these reports is that the accounting system API does not indicate whether an item is paid/settled. This is only determined by matching transactions on our end (e.g., an invoice against a payment).

**Improvement opportunity**: Accounts receivable and payable should be transformed into an **aged trial balance** (aldersfordelt saldoliste) with better filtering capabilities.

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

---

## 5. Integrations

### 5.1 Accounting system integrations
Multiple integrations via API to different Norwegian accounting systems. Each integration is somewhat unique but serves the same purpose: fetching chart of accounts, balances, transactions, and vouchers.

Known systems (non-exhaustive): Tripletex, Visma, PowerOffice, Xledger, and others.

### 5.2 Bank integrations
- **SFTP connections** to banks for automatic file delivery
- Currently a major bottleneck due to manual setup process
- Bank files follow standard formats (CAMT.053, bank-specific CSV, etc.)

### 5.3 Altinn integration
- API connection to Altinn for fetching A-melding data (A07 reports)
- Used for balance reconciliation reports (MVA, AGA, Forskuddstrekk, Lønn, Feriepenger)

---

## 6. Current Pain Points & Opportunities

### Onboarding is too manual
- Setting up tenants, accounts, balances, and parser scripts is time-consuming
- WindowTool (current admin GUI) creates the database and environment, but much is still filled in manually
- **Opportunity**: Streamlined onboarding wizard with template-based setup

### SFTP bank connections are a bottleneck
- Manual coordination with banks
- **Opportunity**: Self-service SFTP setup or explore open banking APIs

### Rule builder UX is poor
- Current rule builder is unintuitive
- **Opportunity**: Visual, drag-and-drop rule builder with clear previews

### Report design needs improvement
- Current reports are functional but poorly designed and lack user-friendliness
- **Opportunity**: Modern, clean report UI with better data visualization

### Accounts receivable/payable need enhancement
- Should become proper aged trial balance (aldersfordelt saldoliste)
- Better filtering and sorting capabilities needed

---

## 7. MVP Scope

### In scope for demo
- [ ] Core data model (tenant → company → account → client → sets)
- [ ] File upload and parsing (CSV and CAMT.053 at minimum)
- [ ] Transaction matching with standard rule set
- [ ] Manual matching for unmatched transactions
- [ ] One complete end-to-end flow demonstrable to leadership

### Consciously deferred
- [ ] SFTP bank connections
- [ ] Accounting system API integrations
- [ ] Altinn API integration
- [ ] Balance reconciliation reports (MVA, AGA, Lønn, Feriepenger, etc.)
- [ ] Currency reconciliation
- [ ] Customer migration from legacy system
- [ ] Multi-user / role-based access
- [ ] Audit logging / revision trail
- [ ] AI-assisted rule generation
- [ ] Onboarding wizard
- [ ] Custom parser script creation UI

### Foundation requirements (build from day 1)
- [ ] Multi-tenant architecture
- [ ] Feature toggle system (to activate/deactivate modules per tenant)
- [ ] Extensible parser engine (easy to add new formats)
- [ ] Configurable rule engine (rules stored as data, not code)
- [ ] Clean API design (ready for future integrations)
- [ ] Proper data model that supports both transaction matching and balance reconciliation

---

## 8. Glossary

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
| Opening post | Åpningspost | An open item created when matching with tolerance/deviation |
| Parser script | Innlesningsskript | Declarative configuration for file import |
| Term | Termin | Bi-monthly reporting period (jan-feb, mar-apr, etc.) |
| YTD | Year-to-date | Cumulative figures from January 1 to current period |
