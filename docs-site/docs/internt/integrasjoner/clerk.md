---
title: Clerk — Autentisering
sidebar_position: 2
---


## Oversikt

Clerk håndterer all autentisering, brukerstyring og multi-tenancy (organisasjoner) i Revizo.
Alle beskyttede ruter krever en gyldig Clerk-sesjon. Organisasjoner i Clerk mapper direkte
til `tenant_id` i databasen.

## Arkitektur

```
Bruker → Clerk Middleware → Route Handlers → Clerk auth() → orgId/userId
                                                ↓
                                         Database (tenant_id = orgId)
```

### Sentrale konsepter

| Clerk-konsept | Revizo-konsept | Beskrivelse |
|---|---|---|
| `userId` | `user_id` i DB | Unik identifikator per bruker |
| `orgId` | `tenant_id` i DB | Organisasjon = regnskapsbyrå/team |
| `orgSlug` | — | URL-vennlig org-navn |
| Session | — | Autentisert økt, maks 8 timer |

### Multi-tenancy

Revizo bruker Clerk Organizations for multi-tenancy. Hver organisasjon er et regnskapsbyrå
eller team. All data i databasen er scopet til `tenant_id` (= Clerk `orgId`), og alle
database-queries MÅ filtrere på dette for å unngå datalekasje mellom klienter.

## Filer i kodebasen

| Fil | Beskrivelse |
|---|---|
| `src/middleware.ts` | Clerk middleware — beskytter alle ruter unntatt offentlige |
| `src/app/layout.tsx` | `<ClerkProvider>` wrapper rundt hele appen |
| `src/lib/notifications.ts` | Henter brukerinfo (e-post, navn) via `clerkClient()` |
| `src/lib/ai/actions.ts` | Henter brukerinfo for AI-kontekst |
| Alle API routes | Bruker `auth()` for å hente `userId` og `orgId` |

## Miljøvariabler

| Variabel | Beskrivelse | Påkrevd |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Offentlig nøkkel (klient-side) | Ja |
| `CLERK_SECRET_KEY` | Hemmelig nøkkel (server-side) | Ja |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Innloggings-URL (`/sign-in`) | Ja |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Registrerings-URL (`/sign-up`) | Ja |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Redirect etter innlogging (`/dashboard`) | Ja |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Redirect etter registrering (`/onboarding`) | Ja |

## Nøkkelfunksjoner

### Server-side

```typescript
import { auth } from "@clerk/nextjs/server";

// I en API route:
const { userId, orgId } = await auth();
if (!userId || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

### Hente brukerinfo (server-side)

```typescript
import { clerkClient } from "@clerk/nextjs/server";

const clerk = await clerkClient();
const user = await clerk.users.getUser(userId);
// user.emailAddresses[0]?.emailAddress
// user.fullName, user.firstName
```

### Client-side hooks

```typescript
import { useUser, useOrganization } from "@clerk/nextjs";

const { user } = useUser();
const { organization } = useOrganization();
```

### UI-komponenter

```typescript
import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";

// <UserButton /> — brukermenyen i sidebar
// <OrganizationSwitcher /> — bytte mellom organisasjoner
```

## Middleware

Middleware-filen (`src/middleware.ts`) beskytter alle ruter. Offentlige ruter er:

- `/sign-in(.*)` — Innlogging
- `/sign-up(.*)` — Registrering
- `/api/health` — Helsesjekk

Alle andre ruter krever gyldig autentisering.

### Session timeout

Sesjonstimeout (maks 8 timer for finansdata) konfigureres i **Clerk Dashboard** under
*Sessions → Inactivity timeout / Maximum lifetime*. Dette er IKKE konfigurert i kode.

## Feilsøking

### Bruker får «Unauthorized» (401)

1. Sjekk at brukeren er innlogget (Clerk session aktiv)
2. Sjekk at brukeren er medlem av en organisasjon (`orgId` mangler)
3. Sjekk at `CLERK_SECRET_KEY` er korrekt i miljøvariabler
4. Se Clerk Dashboard → Users for å verifisere brukerstatus

### Bruker ser ikke data fra andre i teamet

1. Sjekk at begge brukere er i **samme organisasjon** i Clerk
2. Sjekk at de bruker samme organisasjon (OrganizationSwitcher)
3. Verifiser at `orgId` matcher `tenant_id` i databasen

### «Organization not found» eller manglende orgId

1. Bruker har ikke valgt en organisasjon enda
2. Bruker ble fjernet fra organisasjonen
3. Se Clerk Dashboard → Organizations

### Webhook-problemer (hvis brukt)

Clerk webhooks brukes ikke direkte i koden per nå. Brukerdata hentes on-demand via
`clerkClient()`.

## Clerk Dashboard

URL: https://dashboard.clerk.com

Her kan du:
- Se og administrere brukere
- Administrere organisasjoner
- Konfigurere sesjonstimeout
- Se innloggingslogger
- Oppdatere API-nøkler

## Viktig å vite

- Clerk er **kritisk** — uten den fungerer ingenting (ingen innlogging, ingen data)
- `orgId` er limet mellom Clerk og databasen — ALL data er scopet til dette
- Sesjonstimeout er konfigurert i Dashboard, ikke i kode
- E-postadresser hentes fra Clerk, ikke lagret i egen database
