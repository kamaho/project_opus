# Design — Revizo

Designet er inspirert av **Vercel**, **Linear**, **Apple** og **Supabase**. De utgjør vårt faste utgangspunkt for UI og visuell stil.

> **Komplett designsystem:** Se [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for farger, typografi, spacing, komponentregler, interaksjonsmønstre og avviksprotokoll. Alle UI-endringer **må** følge det dokumentet.

## Referanser

| Tjeneste   | Styrker vi tar inn |
|-----------|--------------------|
| **Vercel** | Monokrom palett, Geist-font, skarp presisjon, mørke CTA-knapper, balanse mellom tetthet og luft |
| **Linear** | Minimal sidebar, lav kontrast grå, subtil accent, keyboard-first, glatte mikro-overganger |
| **Apple**  | Piksel-perfekt justering, optisk balanse, gjennomtenkte tomme tilstander, hvert detalj med hensikt |
| **Supabase** | Lesbare datatabeller, tydelig statushierarki, mørkmodus gjort riktig |

## Prinsipper

- **Minimal** — få elementer, tydelig hierarki, ingen visuell støy
- **Profesjonell SaaS** — troverdig, raskt å skanne, fokus på innhold
- **Konsistent spacing og typografi** — god lesbarhet, forutsigbare avstander
- **Subtil farge** — nøytral grå som base, neon grønn brand-accent brukt sparsomt
- **Tynne rammer** — diskré borders, lette skygger kun der det trengs

## Teknisk

- **Fonter**: Geist Sans + Geist Mono (via `next/font`)
- **Radius**: 8px (`--radius: 0.5rem`)
- **Palett**: oklch-basert i `src/app/globals.css`
- **Brand-farge**: Neon grønn (Supabase-inspirert) — kun til identitetsdetaljer (se DESIGN_SYSTEM.md §14)
- **Komponenter**: shadcn/ui (New York variant), tilpasset gjennom CSS-variabler
- **Ikoner**: Lucide React — ingen andre ikonbiblioteker

## Referanse-frontend

For konkrete mønstre på kontooversikt, matching-visning, toolbar og transaksjonstabeller:
se [REVIZO_CLIENT_REFERENCE.md](./REVIZO_CLIENT_REFERENCE.md).
