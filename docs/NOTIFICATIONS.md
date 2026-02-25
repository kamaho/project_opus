# Varslingssystem

Revizo har et varslingssystem med to kanaler: in-app varsler og e-postvarsler via Resend.

## Arkitektur

```
Hendelse (import, match, notat)
    │
    └── src/lib/notifications.ts
            │
            ├── createNotification() → notifications-tabell (in-app)
            │
            └── sendXxxEmail() → Resend API → brukerens e-post
                    (src/lib/resend.ts)
```

## Varslingstyper

| Type | Beskrivelse | In-app | E-post |
|------|-------------|--------|--------|
| `note_mention` | Noen nevnte deg i et notat (@-mention) | Ja | Ja |
| `match_completed` | Smart Match fullført | Ja | Ja |
| `import_completed` | Filimport fullført | Ja | Ja |
| `assignment` | Oppgave tildelt | Ja | Nei |
| `deadline_reminder` | Regulatorisk frist nærmer seg | Ja | Nei |
| `system` | Systemvarsler | Ja | Nei |

## In-app varsler

### Database (`notifications`-tabellen)

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| `id` | uuid (PK) | |
| `tenant_id` | text | Org-ID |
| `user_id` | text | Mottaker (Clerk user ID) |
| `from_user_id` | text | Avsender (nullable) |
| `type` | text (enum) | Varslingstype |
| `title` | text | Tittel |
| `body` | text | Innhold (nullable) |
| `link` | text | Lenke til relevant side (nullable) |
| `read` | boolean | Lest/ulest |
| `entity_type` | text | Relatert entitet (f.eks. "transaction") |
| `entity_id` | text | ID til relatert entitet |
| `group_key` | text | For gruppering av like varsler |

### UI-komponent

`NotificationBell` (`src/components/layout/notification-bell.tsx`) vises i headeren:
- Poller `/api/notifications?unread=true` for å vise antall uleste
- Klikk åpner dropdown med varselliste
- Hvert varsel har ikon, tittel, tidspunkt og lenke
- "Marker alle som lest"-knapp

### API-endepunkter

| Metode | Rute | Beskrivelse |
|--------|------|-------------|
| GET | `/api/notifications` | Liste varsler (params: `unread`, `limit`) |
| PATCH | `/api/notifications/[id]` | Marker som lest |
| POST | `/api/notifications/read-all` | Marker alle som lest |

## E-postvarsler (Resend)

### Konfigurasjon

```
RESEND_API_KEY=re_...
RESEND_FROM_ADDRESS=Revizo <noreply@accountcontrol.no>
```

### E-postmaler

Alle e-poster bruker en felles layout (`emailLayout()`) med:
- Revizo-header med brand-prikk
- Kort med innhold
- Footer med avsenderinfo

#### Notat-nevnelse
**Trigger:** Bruker nevnt med @-mention i et transaksjonsnotat
**Innhold:** Hvem som nevnte deg, transaksjonsbeskrivelse, notattekst, CTA-knapp

#### Smart Match fullført
**Trigger:** Automatisk matching fullført
**Innhold:** Antall matchgrupper, antall transaksjoner, CTA-knapp

#### Import fullført
**Trigger:** Filimport fullført
**Innhold:** Antall poster, mengde (1/2), filnavn, CTA-knapp

#### Agent-rapport
**Trigger:** Revizo Agent har kjørt automatisk Smart Match og/eller generert rapport
**Innhold:** Nye matcher, åpne poster per mengde, saldo, differanse, PDF-vedlegg, CTA-knapp

### Design tokens

E-postmalene bruker e-postsikre hex-farger som matcher designsystemet:

| Token | Verdi | Bruk |
|-------|-------|------|
| `brand` | `#38c96c` | Brand-accent (neon grønn) |
| `btnBg` | `#171717` | Primærknapp |
| `fg` | `#171717` | Tekst |
| `muted` | `#737373` | Sekundærtekst |

## Opprettelse av varsler

### Programmatisk

```typescript
import { createNotification } from "@/lib/notifications";

await createNotification({
  tenantId: orgId,
  userId: targetUserId,
  fromUserId: currentUserId,
  type: "note_mention",
  title: "Du ble nevnt i et notat",
  body: noteText,
  link: `/dashboard/clients/${clientId}?highlight=${txId}`,
  entityType: "transaction",
  entityId: txId,
});
```

### Hjelpefunksjoner

| Funksjon | Trigger | Oppretter in-app | Sender e-post |
|----------|---------|-----------------|---------------|
| `notifyNoteMention()` | @-mention i notat | Ja | Ja (ikke self-mention) |
| `notifySmartMatchCompleted()` | Smart Match fullført | Ja | Ja |
| `notifyImportCompleted()` | Filimport fullført | Ja | Ja |

Alle e-postfunksjoner håndterer feil uten å kaste — de logger eventuelle feil men avbryter ikke flyten.

## Filreferanser

| Fil | Innhold |
|-----|---------|
| `src/lib/notifications.ts` | Opprettelse og hjelpefunksjoner |
| `src/lib/resend.ts` | E-postmaler og Resend-integrasjon |
| `src/components/layout/notification-bell.tsx` | In-app varsel-UI |
| `src/app/api/notifications/route.ts` | Liste varsler |
| `src/app/api/notifications/[id]/route.ts` | Marker som lest |
| `src/app/api/notifications/read-all/route.ts` | Marker alle som lest |
