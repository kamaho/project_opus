# Design — Account Control

Designet er inspirert av **Railway**, **Linear**, **Vercel** og **Supabase**. De utgjør vårt faste utgangspunkt for UI og visuell stil.

## Referanser

| Tjeneste   | Styrker vi tar inn |
|-----------|--------------------|
| **Linear** | Minimal layout, mørk sidebar, lav kontrast, liten radius, diskré violet/blå accent |
| **Vercel** | Svart/hvit, skarpe kanter, Geist, mye hvitt, tydelige CTA-er |
| **Railway** | Ren dashboard, enkle kort og tabeller, lite dekor |
| **Supabase** | Lesbare tabeller, tydelig grønn accent, mørkmodus-vennlig |

## Prinsipper

- **Minimal** — få elementer, tydelig hierarki
- **Profesjonell SaaS** — troverdig, raskt å skanne
- **Konsistent spacing og typografi** — god lesbarhet
- **Subtil farge** — nøytral grå som base, én tydelig accent
- **Tynde rammer** — diskré borders, lette skygger

## Teknisk

- **Fonter**: Geist (sans + mono)
- **Radius**: 6–8px (Tailwind `--radius`)
- **Palett**: Definert i `src/app/globals.css` (oklch)
- **Komponenter**: shadcn/ui, tilpasset til denne stilen

Nye sider og komponenter skal følge dette utgangspunktet.

## Referanse-frontend (views og tabeller)

For konkrete mønstre på **kontooversikt**, **matching-visning** (to tabeller), **toolbar** og **transaksjonstabeller** er det lagt ved en egen frontend (mappen *account control client*). En oppsummert guide til strukturen og hvordan du bruker den som inspirasjon står i [ACCOUNT_CONTROL_CLIENT_REFERENCE.md](./ACCOUNT_CONTROL_CLIENT_REFERENCE.md).
