# Revizo dokumentasjon (Docusaurus)

Dette er Revizo sin dokumentasjonsside — både for **kunder** (sluttbrukere og utviklere) og **internt** (ansatte).

## Kom i gang

```bash
npm install
npm start
```

Åpne http://localhost:3000. Endringer i `docs/` og `src/` oppdateres live.

## To typer bygg

| Bygg | Kommando | Bruk |
|------|----------|------|
| **Offentlig** (docs.revizo.no) | `npm run build:public` | Kun kundeinnhold. `docs/internt/` ekskluderes. |
| **Internt** (internt.revizo.no) | `npm run build` eller `npm run build:internal` | Alt innhold inkl. integrasjoner, arkitektur, driftsetup. |

Miljøvariabelen `DOCS_PUBLIC_ONLY=true` styrer om `internt/` inkluderes i build (se `docusaurus.config.ts`).

## Node.js

Ved Node 25+ kan build feile med «localStorage». Da bruker vi `NODE_OPTIONS='--no-webstorage'` i skriptene. Anbefalt: Node 20 LTS.

## Deploy (Vercel)

- **Prosjekt 1 (offentlig):** Build command: `npm run build:public`, output: `build`.
- **Prosjekt 2 (internt):** Build command: `npm run build`, output: `build`. Beskytt med Vercel Password Protection eller Cloudflare Access.

Se også `docs/DOCUSAURUS_STRATEGY.md` i project_opus for helhetlig strategi.
