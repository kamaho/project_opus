import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bruksvilkår — Revizo",
  description: "Les bruksvilkårene for Revizo.",
};

export default function VilkarPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Bruksvilkår
      </h1>
      <div className="mt-8 space-y-6 text-sm text-muted-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground">
            1. Aksept av vilkår
          </h2>
          <p className="mt-2">
            Ved å opprette en konto og bruke Revizo aksepterer du disse
            bruksvilkårene. Tjenesten leveres av Save Solutions AS
            (org.nr. 933 882 867).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            2. Tjenestebeskrivelse
          </h2>
          <p className="mt-2">
            Revizo er en skybasert plattform for automatisk avstemming og
            regnskapskontroll. Tjenesten kobles til tredjeparts
            regnskapssystemer via API-integrasjoner.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            3. Brukerens ansvar
          </h2>
          <p className="mt-2">
            Du er ansvarlig for å holde påloggingsinformasjonen din
            konfidensiell og for all aktivitet som skjer under din konto.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            4. Betaling og abonnement
          </h2>
          <p className="mt-2">
            Abonnementer faktureres månedlig eller årlig i henhold til valgt
            plan. Priser er oppgitt eks. MVA. Du kan si opp abonnementet når som
            helst, og det løper ut ved periodens slutt.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            5. Kontakt
          </h2>
          <p className="mt-2">
            Spørsmål om bruksvilkårene rettes til{" "}
            <a
              href="mailto:hei@revizo.ai"
              className="text-foreground underline underline-offset-4 hover:text-brand"
            >
              hei@revizo.ai
            </a>
            .
          </p>
        </section>

        <p className="pt-4 text-xs">Sist oppdatert: Mars 2026</p>
      </div>
    </div>
  );
}
