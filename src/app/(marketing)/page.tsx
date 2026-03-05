import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Zap,
  Link2,
  BarChart3,
  FileSpreadsheet,
  Upload,
  Smartphone,
  CalendarDays,
  MessageSquare,
  Mail,
  Check,
  ChevronRight,
} from "lucide-react";
import { BentoCard } from "@/components/marketing/bento-card";

export default function LandingPage() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,oklch(0.95_0.04_280),transparent_70%)]" />
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-24 sm:px-6 sm:pt-32 lg:pt-40">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Full kontroll over regnskapet
              <span className="block text-muted-foreground">
                — uten å bytte system
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Revizo kobler seg til regnskapssystemet du allerede bruker, og gir
              deg automatisk avstemming, sanntidsoversikt og rapporter som sparer
              deg timer hver uke.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/priser">
                  Kom i gang
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="#funksjoner">Se hvordan det fungerer</Link>
              </Button>
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="mx-auto mt-16 max-w-4xl">
            <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
              <div className="flex items-center gap-1.5 border-b border-border/50 px-4 py-3">
                <div className="size-2.5 rounded-full bg-muted-foreground/20" />
                <div className="size-2.5 rounded-full bg-muted-foreground/20" />
                <div className="size-2.5 rounded-full bg-muted-foreground/20" />
                <div className="ml-3 h-5 w-48 rounded bg-muted" />
              </div>
              <div className="p-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    {
                      label: "Klienter",
                      value: "24",
                      sub: "23 OK, 1 avvik",
                      color: "text-emerald-600 dark:text-emerald-400",
                    },
                    {
                      label: "Kontoer avstemt",
                      value: "342",
                      sub: "av 360",
                      color: "text-foreground",
                    },
                    {
                      label: "Spart denne uken",
                      value: "12t",
                      sub: "vs. manuell",
                      color: "text-brand",
                    },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-muted/50 p-4">
                      <p className="text-xs font-medium text-muted-foreground">
                        {s.label}
                      </p>
                      <p
                        className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${s.color}`}
                      >
                        {s.value}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {s.sub}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem ───────────────────────────────────────────────────── */}
      <section className="border-t border-border/50 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Du vet det allerede: Avstemming tar for lang tid.
            </h2>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-3">
            {[
              {
                icon: FileSpreadsheet,
                title: "Manuell sjekk",
                desc: "Hundrevis av kontoer sjekkes manuelt mot hovedbok — konto for konto, linje for linje.",
              },
              {
                icon: Upload,
                title: "Eksport og import",
                desc: "Data flyttes mellom systemer med Excel-filer. Feil sniker seg inn, og tid kastes bort.",
              },
              {
                icon: BarChart3,
                title: "Ingen oversikt",
                desc: "Lederne spør «er alt i orden?» — men det finnes ikke ett sted å sjekke status for alle klienter.",
              },
            ].map((p) => (
              <div
                key={p.title}
                className="rounded-lg border border-border/50 bg-card p-6"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <p.icon className="size-5 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solution ──────────────────────────────────────────────────── */}
      <section className="border-t border-border/50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Slik løser Revizo det
            </h2>
          </div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-8 md:grid-cols-3">
            {[
              {
                icon: Link2,
                title: "Koble til — ikke bytt",
                desc: "Revizo sitter oppå Tripletex, Visma og PowerOffice. Ingen migrering, ingen dobbeltarbeid. Kontoer og saldoer er klare på sekunder.",
              },
              {
                icon: Zap,
                title: "Avstem det som betyr noe",
                desc: "Ikke alle 200 kontoer — bare de som trenger det. Smart Match håndterer det rutinemessige. Du tar unntakene.",
              },
              {
                icon: Smartphone,
                title: "Lederen ser grønt",
                desc: "Dashboard på mobil viser status for alle klienter. Åpne, se grønt, lukk. Eller se rødt og vit nøyaktig hvor.",
              },
            ].map((s) => (
              <div key={s.title} className="text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-brand/10">
                  <s.icon className="size-6 text-brand" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features (Bento Grid) ─────────────────────────────────────── */}
      <section
        id="funksjoner"
        className="scroll-mt-20 border-t border-border/50 bg-muted/30"
      >
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Alt du trenger for moderne avstemming
            </h2>
            <p className="mt-3 text-muted-foreground">
              Bygget for regnskapsbyråer som vil jobbe smartere, ikke hardere.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Smart Match — large */}
            <BentoCard
              title="Smart Match"
              description="Automatisk matching av transaksjoner basert på 50+ regler"
              className="lg:col-span-2"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 rounded-md bg-background/80 px-3 py-2 text-xs">
                  <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-blue-600 dark:text-blue-400">
                    Bank
                  </span>
                  <span className="flex-1 truncate text-muted-foreground">
                    Betaling NETS AS 15.03
                  </span>
                  <span className="font-mono tabular-nums text-foreground">
                    -12 450,00
                  </span>
                </div>
                <div className="flex items-center justify-center">
                  <div className="h-5 w-px bg-brand/40" />
                  <Zap className="mx-1 size-3 text-brand" />
                  <div className="h-5 w-px bg-brand/40" />
                </div>
                <div className="flex items-center gap-3 rounded-md bg-background/80 px-3 py-2 text-xs">
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-emerald-600 dark:text-emerald-400">
                    Hovedbok
                  </span>
                  <span className="flex-1 truncate text-muted-foreground">
                    Leverandørgjeld — NETS AS
                  </span>
                  <span className="font-mono tabular-nums text-foreground">
                    12 450,00
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3" />
                  Differanse: 0,00
                </div>
              </div>
            </BentoCard>

            {/* Filimport */}
            <BentoCard
              title="Filimport"
              description="Excel, CSV og CAMT.053 — dra og slipp"
            >
              <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border/70 bg-background/50 px-4 py-5">
                <Upload className="size-6 text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground">
                  Slipp filer her eller klikk
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3" />3 filer importert — 1 247
                  transaksjoner
                </div>
              </div>
            </BentoCard>

            {/* Rapporter */}
            <BentoCard
              title="Rapporter"
              description="PDF og Excel med åpne poster, klar for revisor"
            >
              <div className="overflow-hidden rounded-md border border-border/50 bg-background/80">
                <div className="border-b border-border/50 bg-muted/50 px-3 py-1.5 text-[10px] font-medium text-muted-foreground">
                  Avstemmingsrapport — Klient AS
                </div>
                <div className="space-y-1.5 p-3 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Konto 1500 — Kundefordringer
                    </span>
                    <span className="font-mono tabular-nums text-foreground">
                      3 åpne
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Konto 2400 — Leverandørgjeld
                    </span>
                    <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      0 åpne
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Konto 1920 — Bankkonto
                    </span>
                    <span className="font-mono tabular-nums text-foreground">
                      1 åpen
                    </span>
                  </div>
                </div>
              </div>
            </BentoCard>

            {/* Mobil-dashboard — large */}
            <BentoCard
              title="Mobil-dashboard"
              description="Leder ser status for alle klienter på telefonen"
              className="lg:col-span-2"
            >
              <div className="mx-auto w-44 overflow-hidden rounded-xl border border-border/50 bg-background/80">
                <div className="border-b border-border/50 bg-muted/50 px-3 py-1.5 text-center text-[10px] font-medium">
                  Klientoversikt
                </div>
                <div className="divide-y divide-border/30">
                  {[
                    { name: "Solstad AS", ok: true },
                    { name: "Fjell Holding", ok: true },
                    { name: "Nordvik Bygg", ok: false },
                    { name: "Berge & Co", ok: true },
                  ].map((c) => (
                    <div
                      key={c.name}
                      className="flex items-center justify-between px-3 py-1.5 text-[10px]"
                    >
                      <span className="text-muted-foreground">{c.name}</span>
                      <span
                        className={`size-2 rounded-full ${
                          c.ok
                            ? "bg-emerald-500"
                            : "bg-red-500 animate-pulse"
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </BentoCard>

            {/* Sanntidsdata */}
            <BentoCard
              title="Sanntidsdata"
              description="Webhooks holder data oppdatert automatisk"
            >
              <div className="space-y-2">
                {[
                  { time: "14:32", text: "Tripletex → 3 nye transaksjoner" },
                  { time: "14:28", text: "Smart Match → 2 matchet" },
                  { time: "14:15", text: "Rapport generert" },
                ].map((e) => (
                  <div key={e.time} className="flex items-start gap-2 text-[11px]">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <div>
                      <span className="font-mono text-muted-foreground">
                        {e.time}
                      </span>{" "}
                      <span className="text-foreground">{e.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </BentoCard>

            {/* Oppgaver og frister */}
            <BentoCard
              title="Oppgaver og frister"
              description="Norske regnskapsfrister, tildeling og påminnelser"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-md bg-background/80 px-2.5 py-1.5 text-[11px]">
                  <CalendarDays className="size-3 text-red-500" />
                  <span className="text-foreground">
                    MVA-melding — 10. apr
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-md bg-background/80 px-2.5 py-1.5 text-[11px]">
                  <CalendarDays className="size-3 text-amber-500" />
                  <span className="text-foreground">
                    A-melding — 5. apr
                  </span>
                </div>
              </div>
            </BentoCard>

            {/* AI-assistent */}
            <BentoCard
              title="AI-assistent"
              description="Spør om hjelp med avstemming og regnskap"
            >
              <div className="space-y-2">
                <div className="ml-auto max-w-[80%] rounded-lg bg-brand/10 px-3 py-2 text-[11px] text-foreground">
                  Hvorfor stemmer ikke konto 1500?
                </div>
                <div className="mr-auto flex items-start gap-2 max-w-[90%]">
                  <MessageSquare className="mt-0.5 size-3 shrink-0 text-brand" />
                  <div className="rounded-lg bg-muted/80 px-3 py-2 text-[11px] text-muted-foreground">
                    Konto 1500 har 3 uavstemte poster fra mars. Den største er
                    en faktura på 45 200 kr til Berge & Co.
                  </div>
                </div>
              </div>
            </BentoCard>

            {/* Dokumentforespørsler */}
            <BentoCard
              title="Dokumentforespørsler"
              description="Be kunder om dokumenter med magic link"
            >
              <div className="overflow-hidden rounded-md border border-border/50 bg-background/80">
                <div className="border-b border-border/50 bg-muted/50 px-3 py-1.5 text-[10px] text-muted-foreground">
                  <Mail className="mb-0.5 mr-1 inline size-3" />
                  Dokumentforespørsel fra Byrå AS
                </div>
                <div className="space-y-2 p-3 text-[10px]">
                  <p className="text-muted-foreground">
                    Vi trenger kontoutskrift for mars 2026.
                  </p>
                  <div className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground">
                    Last opp dokument
                    <ChevronRight className="size-2.5" />
                  </div>
                </div>
              </div>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ── Integrations ──────────────────────────────────────────────── */}
      <section className="border-t border-border/50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Fungerer med systemet du allerede bruker
            </h2>
          </div>
          <div className="mx-auto mt-12 grid max-w-2xl gap-4 sm:grid-cols-3">
            {[
              { name: "Tripletex", status: "Tilgjengelig nå", available: true },
              { name: "Visma Business NXT", status: "Kommer snart", available: false },
              { name: "PowerOffice", status: "Kommer snart", available: false },
            ].map((i) => (
              <div
                key={i.name}
                className="flex flex-col items-center rounded-lg border border-border/50 bg-card p-6 text-center"
              >
                <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-lg font-bold text-muted-foreground">
                  {i.name[0]}
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">
                  {i.name}
                </h3>
                <p
                  className={`mt-1 text-xs ${
                    i.available
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {i.available ? "✓ " : ""}
                  {i.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Preview ───────────────────────────────────────────── */}
      <section className="border-t border-border/50 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Fra 1 990 kr/mnd
            </h2>
            <p className="mt-3 text-muted-foreground">
              Tre pakker tilpasset byråer i alle størrelser. 14 dager gratis
              prøveperiode.
            </p>
            <Button className="mt-6" asChild>
              <Link href="/priser">
                Se alle priser
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── CTA Close ─────────────────────────────────────────────────── */}
      <section className="border-t border-border/50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Klar til å ta kontroll?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Kom i gang i dag — første 14 dager er gratis.
            </p>
            <Button size="lg" className="mt-6" asChild>
              <Link href="/priser">
                Kom i gang gratis
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
