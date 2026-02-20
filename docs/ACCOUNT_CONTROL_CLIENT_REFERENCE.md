# Account Control Client — referanse for views og tabeller

Referanse-frontenden ligger i mappen **account-control-client** (f.eks. `Dashboard branch/account-control-client`). Den er en monorepo med **apps/web** som hovedapp og delte **packages** (features, ui, i18n, etc.). Denne dokumentasjonen beskriver strukturen og mønstre du kan bruke som inspirasjon i project_opus.

---

## Struktur (kort)

- **apps/web** — Next.js-app med App Router, `[lng]` for språk, grupperte ruter:
  - `(main-nav)` — Inbox, **Matching** (→ `/accounts`), Reports, Dashboard, Settings
  - `(main-nav-max)` — matching-siden med full bredde (toolbar + to tabeller)
  - `(onboarding-steps)` — ERP, Companies, Altinn, User creation
  - `(settings-nav)` — Innstillinger (matching, reports, VAT, integrations, import, etc.)
- **packages/features** — view-system, matching-feature (toolbar, dialogs, transaction-options)
- **packages/ui** — shadcn-komponenter, Card, Table, Button, Dialog, Sidebar, Steppers, EmptyState, FileUpload, etc.

---

## Kontoer / Accounts-oversikt

**Fil:** `apps/web/app/[lng]/(main-nav)/accounts/page.tsx`

- **View + ViewLayout:** Generisk `View` med `viewLayoutId="accounts-overview"` og `source={{ type: "in-memory", data: preparedData }}`.
- **Kolonner:** Name (med lenke til `/matching?clientId=...`), Company, OpenPostsCount, balanceSet1, balanceSet2, primaryAudit, secondaryAudit, HasDocuments, HasActiveAlerts, ImportDate, ReconciledDate.
- **Kolonne-definisjoner (columnDefs):**
  - Datoer: `DateTime`-komponent med preset (f.eks. `dateShort`).
  - Saldo: `AccountBalance`-komponent for balanceSet1/balanceSet2.
  - Name: `Link` med `pathname: "/matching"`, `query: { clientId }`.
  - Audit-kolonner: HoverCard med liste over tidspunkter.
  - HasDocuments / HasActiveAlerts: visning som ✓ eller tom.
- **Filtre:** predefinedFilterOptions med "Quick filters" (Has documents, Has alerts, Open posts > 0, Balance set 1 > 0).
- **Paginering:** pageSizeOptions [25, 50, 100], showPagination: true.
- **Visninger:** availableVisualizations: ["table", "list"].

Inspirasjon for project_opus: samme type tabell med kolonnedefs, filtre og lenke fra konto-navn til matching-siden.

---

## Matching-siden (to tabeller)

**Filer:**  
`apps/web/app/[lng]/(main-nav-max)/matching/page.tsx`  
`apps/web/app/[lng]/(main-nav-max)/matching/MatchingDataBridge.tsx`

- **Layout:** `ViewLayout` → `MatchingProvider` (initialParams: clientId, startDate, endDate) → `MatchingToolbar` + `MatchingDataBridge`.
- **Fullscreen:** `useFullscreen(pageRef)` på sidecontaineren.
- **MatchingDataBridge:**
  - Henter `leftData` og `rightData` fra `useMatchingState()`.
  - Kan vise **to tabeller** (venstre/høyre) eller **én kombinert tabell** avhengig av `controlState.combineTables` og om høyre mengde har data.
  - "Split by sign": hvis bare venstre har data, kan venstre deles i positive / ikke-positive som to "mengder".
  - Hver tabell er en `<View<Transaction>>` med:
    - `viewID`: "table1" / "table2" / "tableCombined"
    - `source={{ type: "in-memory", data: leftToRender/rightToRender/combined }}`
    - `options={createTransactionViewOptions({ ... })}`
  - Grid: `grid grid-cols-1 lg:grid-cols-2 gap-1.5 flex-1 min-h-0` for to kolonner.

Inspirasjon: to-panel-layout med felles toolbar, valgfri kombinert visning, og tomme-tilstand-melding (emptyMessage med scope/rekkevidde).

---

## Transaction View-oppsett

**Fil:** `packages/features/src/matching/transactionViewConfig.tsx`

- **createTransactionViewOptions(options):** Returnerer `ViewOptions<Transaction>` med:
  - **propertyOrder:** Avsnr, Fee, Periode, DueDate, CustomerSupplierName, InvoiceNo, Id, HarNotat, Dato1, Dato2, Belop, Billagsnr, Tekst, HasAttachment, Dim1–15, Ref, Buntref, Tekstkode, osv.
  - **columnDefs:** Tilpassede celler for:
    - Avsnr: knapp som åpner Avsnr-dialog
    - HasAttachment: ikon-knapp, onAttachmentClick
    - Dato1, Dato2: DateTime
    - Belop: AccountBalance
    - Tekst, Billagsnr, osv.
  - **paginationOptions:** pageSizeOptions [100, 200, 500], renderStatusLeft med `MatchingStatusLeft` (viser antall rader i tabellen).
  - **emptyMessage:** kan overstyres (f.eks. "Ingen åpne poster i valgt periode").

Inspirasjon: sentral konfig for transaksjonstabeller (kolonner, formatering, paginering, tom tilstand).

---

## Matching Toolbar

**Fil:** `packages/features/src/matching/toolbar/MatchingToolbar.tsx`

- **Innhold:** Pinned actions (Smart match, Match, osv.), TransactionActionsMenu, SelectionSummary, ScopeSelector (Åpne / Lukkede / Åpne per dato), Imports & Exports-knapp, fullscreen-knapp.
- **Dialogs:** Åpnes via atomer (activeDialogAtom): attachments, note, hide, smart match, avsnr, imports-exports. Hver dialog er en egen `<Dialog>` med eget innhold.
- **Styling:** `flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-background p-1.5`.

Inspirasjon: én toolbar med handlinger, scope-valg, sammendrag og dialoger; samme type kan brukes i project_opus med Smart match, Match, Vis poster, Imports & Exports.

---

## View-systemet (generisk)

**Pakke:** `packages/features/src/view/`

- **ViewLayout:** Wrapper med viewLayoutId; persisterer layout/controls (f.eks. combineTables) via viewLayoutAtomsMolecule.
- **View:** Tar `viewID`, `source` (in-memory eller annen type), `options` (columnDefs, paginationOptions, emptyMessage, itemActions, osv.). Må rendres inni ViewLayout.
- **Visualizations:** table (TableView), list (ListView), kanban (KanbanView). Table bruker `useTableViewAdapter` + `renderTable` fra table-pakken.
- **View.Toolbar:** Filter, Display, paginering, osv. per tabell.

Inspirasjon: I project_opus brukes enklere komponenter (TransactionPanel, MatchingToolbar); ved behov kan man innføre mer generiske View/ViewLayout-lignende mønstre og kolonne-/filter-konfig.

---

## Tabell-UI (shadcn)

- **Referanse:** `apps/web/app/[lng]/(main-nav)/dev/reference/components/table/page.tsx` viser:
  - Enkel tabell med TableHeader, TableBody, TableRow, TableCell.
  - Tabell med TableCaption og TableFooter (totals).
  - Søkefelt over tabell (filter).
  - Responsiv tabell med overflow-x-auto.
- **Pakke:** `packages/ui/src/shadcn/components/table.tsx` (Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter, TableCaption).

Inspirasjon: bruk samme primitiver i project_opus for konsistent tabell-UI; legge til footer for totaler og wrapper med overflow for horisontal scroll der det trengs.

---

## Andre nyttige komponenter (packages/ui)

- **EmptyState** — tom tilstand med ikon og tekst.
- **file-upload-box** — filopplasting.
- **StatusBadge** — status-merker.
- **Steppers** (NumberedProgressStepper, DotProgressStepper, SideBySideStepper) — flertrinns-flater.
- **date-picker-range** — datovelger for periode.
- **Combobox** — søk og valg fra liste.

Inspirasjon: EmptyState for tomme tabeller eller ingen kontoer; file-upload/dropzone for import; StatusBadge for avstemmingsstatus; date-picker for "Åpne per dato".

---

## Navigasjon og ruter

- **config/nav.ts:** mainNavData med "Matching" → url `/accounts` (kontooversikt). Fra kontooversikt går brukeren til `/matching?clientId=...`.
- **Matching under (main-nav-max):** egen layout for matching-siden (mer plass til toolbar og to tabeller).

Inspirasjon: beholde Kontoer som inngang, lenke til `/dashboard/clients/[clientId]/matching`; evt. egen layout for matching for full bredde.

---

## Oppsummert: hva å ta med til project_opus

1. **Kontoer-tabell:** Kolonner med formatering (dato, beløp), lenke fra rad til matching, filtre (åpne poster, har dok., saldo), paginering.
2. **Matching-visning:** To paneler (venstre/høyre) med felles toolbar; tom tilstand med tydelig melding; valgfri "kombinert" visning.
3. **Toolbar:** Smart match, Match, Transaksjonshandlinger, Vis poster (Åpne / Lukkede / Åpne per dato), Imports & Exports, fullscreen.
4. **Transaksjonstabell:** Konsistent kolonnedef (ID, Dato, Beløp, Bilag, Tekst, Vedlegg, Merknad), formatering av beløp (rød for negativ), paginering, statuslinje med antall.
5. **Design:** Nøktern, border, rounded, bg-background/muted; knapper med outline/variant; HoverCard for ekstra info (f.eks. audit-liste).

Referansemappen ligger utenfor project_opus; bruk denne doc som indeks når du bygger eller forbedrer views og tabeller.
