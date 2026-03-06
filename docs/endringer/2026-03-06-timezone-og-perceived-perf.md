# 2026-03-06 — Tidssone-fikser og opplevd ytelse (Runde 4)

**Type:** Bugfix, ytelse
**Utført av:** Claude (AI-agent) + kmh0751
**Status:** Fullført

---

## Del 1: Tidssone-bugfikser

### Problem

`toISOString().slice(0, 10)` ble brukt i hele kodebasen for å konvertere `Date`-objekter til `"YYYY-MM-DD"`-strenger. Denne metoden konverterer til UTC først — i CET (UTC+1) betyr det at lokal midnatt (f.eks. 5. mars 00:00) blir 4. mars 23:00 i UTC, og `.slice(0, 10)` returnerer **feil dato** (4. mars i stedet for 5. mars).

**Synlig effekt:** Frist-widgeten på dashboard viste "4. mars" for A-melding, mens kalenderen (som beregner dato fra regel) korrekt viste 5. mars.

### Rotårsak

Feilen påvirket tre lag:

1. **Visning** — Dato-grenser i frist-widget, standard datoer i dialoger
2. **API-kall** — Feil datofiltre sendt til API-er (f.eks. `fromDate`/`toDate` for fristlisten)
3. **Lagring** — Oppgave-dueDate og Excel-parsing kunne lagre feil dato i databasen

### Løsning

Erstattet alle `toISOString().slice(0, 10)` med lokaltids-formatering:
```typescript
const d = new Date();
`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
```

For server-side deadline-queries (der `db.execute` kan returnere `Date`-objekter fra postgres-js), lagt til `toDateStr()`-helper som bruker `getUTC*`-metoder (fordi postgres-js parser DATE-kolonner som UTC midnight):
```typescript
function toDateStr(v: unknown): string {
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  }
  return String(v).slice(0, 10);
}
```

### Filer endret (11 filer, ~20 instanser)

| Fil | Endring |
|-----|---------|
| `src/components/dashboard/modules/deadline-widget.tsx` | `fmt`-funksjon for tidsgruppegrenser → lokaltid. `dl.dueDate` normalisert med `.slice(0, 10)` |
| `src/components/dashboard/dashboard-data-provider.tsx` | `fromDate`/`toDate` for frist-API → lokaltid |
| `src/app/dashboard/frister/frister-client.tsx` | `getDefaultFrom()`/`getDefaultTo()` → lokaltid. `getMonthKey()` normalisert |
| `src/lib/deadlines/queries.ts` | `toDateStr()`-helper for `mapRowToDeadlineWithSummary` og oppgave-rader |
| `src/components/dashboard/frister/days-remaining.tsx` | `dueDate` normalisert med `.slice(0, 10)` |
| `src/components/reports/report-generator-dialog.tsx` | Default `asOfDate` → lokaltid |
| `src/components/matching/matching-view-client.tsx` | `cellToString()` og manuell transaksjonsdato → lokaltid |
| `src/app/dashboard/oppgaver/create-task-dialog.tsx` | Frist-datofiltre → lokaltid |
| `src/app/api/task-templates/[id]/apply/route.ts` | Oppgave `dueDate`-beregning → lokaltid (fikser potensielt feil lagret dato) |
| `src/lib/parsers/excel-parser.ts` | `cellToString()` og `rowToStrArray()` → lokaltid (fikser feil import-datoer) |
| `src/components/clients/comparison-overlay.tsx` | Nedlastingsfilnavn → lokaltid |
| `src/lib/export/templates/matching/matching-viewmodel.ts` | Match-dato → lokaltid |
| `src/app/api/import/route.ts` | Transaksjonsdato-parsing forenklet |
| `src/app/dashboard/clients/[clientId]/matching/page.tsx` | Transaksjonsdato-parsing forenklet |

---

## Del 2: Opplevd ytelse (Runde 4)

### Filosofi

Runde 1–3 optimaliserte faktisk hastighet (færre queries, caching, virtualisering). Runde 4 optimaliserer **opplevd** hastighet — brukeren ser noe umiddelbart, selv om data fortsatt laster.

### 1. `loading.tsx` route-skjeletter

Allerede implementert for 12 dashboard-ruter i tidligere runder. Lagt til manglende:

| Rute | Status |
|------|--------|
| `src/app/dashboard/verktoy/loading.tsx` | **Ny** |
| Alle andre dashboard-ruter | Allerede eksisterer |

### 2. Suspense-grenser: Klientsiden

Refaktorert `src/app/dashboard/clients/page.tsx` — den mest navigerte siden:

**Før:** `page.tsx` ventet på alle DB-queries → rendret alt samtidig.
**Etter:** Streame-arkitektur med Suspense:

```
<Page>
  Auth-sjekk (instant)
  <Suspense fallback={<ClientsTableSkeleton />}>
    <ClientsContent />  ← async server component med all datahenting
  </Suspense>
</Page>
```

Ny fil `src/app/dashboard/clients/clients-data.ts` med `fetchClientsPageData()` som:
- Kjører alle DB-queries (clients, companies, groups, transactions)
- Wrappet i `unstable_cache` med 30s TTL og `["clients", "companies"]`-tagger
- Returnerer typed union: `"data" | "empty" | "sync-in-progress"`

**Matching-siden** ble vurdert men utsatt — krever full omstrukturering av `MatchingViewClient` (kompleks delt tilstand for seleksjon, drag-matching). Allerede optimalisert med parallelle queries og detaljert `loading.tsx`.

### 3. Prefetch-audit

| Lokasjon | Før | Etter |
|----------|-----|-------|
| **Klienttabell rader** | `onClick → router.push()` | Lagt til `router.prefetch()` på `onMouseEnter` via ny `onRowHover`-prop i `DataTable` |
| **Rapport-kort** | `onClick → router.push()` | Lagt til `router.prefetch()` på `onMouseEnter` |
| **Kalender frist-elementer** | `onClick → router.push()` | Byttet til `<Link href={route}>` for automatisk prefetch |
| **"Vis alle"-knapp (klientfilter)** | `onClick → router.push()` | Byttet til `<Link href="/dashboard/clients">` |
| **Sidebar** | `<Link>` | ✓ Allerede korrekt |
| **Breadcrumb** | `router.replace` for URL-sync | ✓ Allerede korrekt (ikke navigasjon) |

### 4. Server-side cache (stale-while-revalidate)

Klientliste-queryen (tyngste siden, hyppigst navigert) wrappet i `unstable_cache`:

- **TTL:** 30 sekunder
- **Tagger:** `["clients", "companies"]` — invalideres automatisk ved opprettelse/sletting
- **Effekt:** Tilbake-navigasjon til klientlisten viser cached data umiddelbart i stedet for full server-render

### Filer endret/opprettet (Del 2)

| Fil | Operasjon | Beskrivelse |
|-----|-----------|-------------|
| `src/app/dashboard/verktoy/loading.tsx` | Ny | Skeleton for verktøy-siden |
| `src/app/dashboard/clients/page.tsx` | Endret | Suspense-wrapping, ekstrahert datahenting |
| `src/app/dashboard/clients/clients-data.ts` | Ny | Cached datahenting for klientlisten |
| `src/components/ui/data-table.tsx` | Endret | Ny `onRowHover`-prop for prefetch |
| `src/app/dashboard/clients/accounts-table.tsx` | Endret | `router.prefetch` på row hover |
| `src/app/dashboard/clients/clients-page-client.tsx` | Endret | "Vis alle" → `<Link>` |
| `src/components/reports/report-card.tsx` | Endret | `router.prefetch` på hover |
| `src/app/dashboard/kalender/day-popover.tsx` | Endret | Frist-elementer → `<Link>` |

---

## Samlet effekt

| Optimalisering | Målbar effekt |
|----------------|---------------|
| Timezone-fikser | Korrekte datoer i alle tidssoner (CET, UTC) |
| `loading.tsx` skjeletter | Instant feedback ved all navigasjon |
| Suspense streaming (klientside) | Side-shell vises umiddelbart; data streamer inn |
| Server-cache (30s TTL) | Tilbake-navigasjon til klientlisten er instant |
| Prefetch på hover | Navigasjon til klient/rapport/frist er pre-lastet før klikk |
| `<Link>` i stedet for `router.push` | Automatisk Next.js prefetch ved synlighet i viewport |
