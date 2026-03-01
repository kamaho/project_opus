# Modulært Dashboard — Arkitektur

## 1. Konsept

To dashboard-nivåer:
- **Byrå-dashboard** (`/dashboard`) — oversikt over alle klienter i organisasjonen
- **Klient-dashboard** (`/dashboard/clients/[clientId]`) — dypt innblikk i én klient

Begge bruker samme modulsystem. Bruker velger mellom forhåndsdefinerte layouts
og kan toggle hvilke moduler som vises.

### Mobil-first

Dashboardet er **startsiden** i appen — det første brukeren ser.
Ledere og partnere bruker primært mobil for å sjekke status on the go.

**Navigasjonsendring (bottom nav på mobil):**
```
FØR:  Revizo AI  |  Varsler  |  Rapporter  |  Oppgaver
ETTER: Dashboard  |  Varsler  |  Rapporter  |  Oppgaver
```

Revizo AI flyttes til en **FAB (Floating Action Button)** eller ikon i header,
tilgjengelig fra alle sider.

### Mobil-design prinsipper
- **Vertikal stacking:** Alle moduler rendres i én kolonne på mobil (<768px)
- **Kompakte kort:** Moduler viser nøkkeltall og status med minimalt plass
- **Tap targets:** Minimum 44x44px for alle interaktive elementer
- **Pull-to-refresh:** Oppdater dashboard-data ved pull-down
- **Swipe mellom klienter:** I klient-dashboardet, swipe for neste/forrige klient
- **Sticky header:** Dashboard-tittel og hurtigfilter forblir synlig ved scroll
- **Ingen layout-velger på mobil:** Alltid vertikal stack (layout-toggle kun desktop)
- **Skeleton loading:** Vis skjeletter umiddelbart, fyll inn data progressivt

---

## 2. Moduler (v1)

### Byrå-dashboard
| Modul | ID | Beskrivelse | Datakilde |
|-------|----|-------------|-----------|
| Avstemmingsstatus | `reconciliation-overview` | Tabell/kort per klient: matched %, unmatched antall, sist avstemt | clients + matches aggregert |
| Frister | `deadlines` | Kommende frister (mva-termin, årsoppgjør, etc.) sortert på dato | deadlines-tabell (ny) eller hardkodet kalender |
| Nøkkeltall | `key-figures` | Total differanse, antall klienter, aktive avstemminger | Aggregert fra transactions + matches |
| Nylig aktivitet | `recent-activity` | Siste importer, matchinger, rapporter på tvers av klienter | imports + agent_job_logs + matches |

### Klient-dashboard
| Modul | ID | Beskrivelse | Datakilde |
|-------|----|-------------|-----------|
| Avstemmingsstatus | `client-reconciliation` | Visuell: matched vs unmatched, differanse, sist kjørt | transactions + matches for denne klient |
| Frister | `client-deadlines` | Frister relevant for denne klienten | Filtrert på company/client |
| Nøkkeltall | `client-key-figures` | Sum sett 1, sum sett 2, differanse, antall transaksjoner | transactions aggregert |
| Nylig aktivitet | `client-recent-activity` | Siste import, siste match-kjøring, siste rapport | imports + agent_job_logs for klient |

---

## 3. Layouts (forhåndsdefinert)

### Layout A: "Oversikt" (default)
```
┌─────────────────────┬─────────────────────┐
│   Nøkkeltall        │   Frister           │
│   (bred kort-rad)   │   (liste)           │
├─────────────────────┴─────────────────────┤
│   Avstemmingsstatus (full bredde tabell)  │
├───────────────────────────────────────────┤
│   Nylig aktivitet (full bredde)           │
└───────────────────────────────────────────┘
```

### Layout B: "Kompakt"
```
┌────────────┬────────────┬────────────┬────────────┐
│ Nøkkeltall │ Frister    │ Avstemming │ Aktivitet  │
│ (kort)     │ (kort)     │ (kort)     │ (kort)     │
└────────────┴────────────┴────────────┴────────────┘
       (detaljvisning under ved klikk)
```

### Layout C: "Fokus"
```
┌───────────────────────────────────────────┐
│   Avstemmingsstatus (stor, detaljert)     │
├─────────────────────┬─────────────────────┤
│   Nøkkeltall        │   Frister           │
└─────────────────────┴─────────────────────┘
       (Nylig aktivitet skjult)
```

Bruker velger layout + kan toggle individuelle moduler av/på innenfor layouten.

---

## 4. Datamodell — Dashboard-konfigurasjon

### Tabell: `dashboard_configs`

```sql
CREATE TABLE dashboard_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  dashboard_type TEXT NOT NULL,
  layout TEXT NOT NULL DEFAULT 'overview',
  hidden_modules TEXT[] DEFAULT '{}'::text[],
  module_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, user_id, dashboard_type)
);
```

Config er per bruker, ikke per org.

---

## 5. Komponentarkitektur

```
src/components/dashboard/
├── module-registry.ts
├── dashboard-shell.tsx
├── dashboard-toolbar.tsx
├── types.ts
├── layouts/
│   ├── overview-layout.tsx
│   ├── compact-layout.tsx
│   └── focus-layout.tsx
└── modules/
    ├── reconciliation-overview.tsx
    ├── deadlines.tsx
    ├── key-figures.tsx
    ├── recent-activity.tsx
    ├── client-reconciliation.tsx
    ├── client-deadlines.tsx
    ├── client-key-figures.tsx
    └── client-recent-activity.tsx
```

---

## 6. API-ruter

### Dashboard-konfigurasjon
```
GET    /api/dashboard/config?type=agency     → Hent config
PUT    /api/dashboard/config                 → Oppdater layout/hidden modules
```

### Dashboard-data (aggregeringer)
```
GET    /api/dashboard/agency/stats
GET    /api/dashboard/agency/reconciliation
GET    /api/dashboard/agency/activity
GET    /api/dashboard/agency/deadlines

GET    /api/dashboard/clients/[clientId]/stats
GET    /api/dashboard/clients/[clientId]/reconciliation
GET    /api/dashboard/clients/[clientId]/activity
GET    /api/dashboard/clients/[clientId]/deadlines
```

---

## 7. Skalering

For å legge til en ny modul:
1. Opprett komponent i `modules/ny-modul.tsx`
2. Implementer `ModuleProps` interface
3. Registrer i `module-registry.ts`
4. Opprett API-endepunkt for data (hvis nødvendig)
5. Legg til i layout-komponentene der den skal vises

---

## 8. Mobil-spesifikke modulvarianter

Moduler rendrer forskjellig avhengig av viewport.
Se fullstendig arkitekturdokument for wireframes.

---

## 9. Navigasjonsendring

### Bottom Navigation (mobil)
Dashboard erstatter Revizo AI som første tab.
Revizo AI flyttes til FAB (Floating Action Button) over bottom-nav.

---

## 10. Fremtidsklart

- Flere layouts
- Drag-and-drop
- Rollebaserte defaults
- Deling av dashboard-oppsett
- Autorefresh per modul
- PWA + push-varsler
- Offline dashboard
