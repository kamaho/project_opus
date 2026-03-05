import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Personvernerklæring — Revizo",
  description: "Les om hvordan Revizo behandler dine personopplysninger.",
};

export default function PersonvernPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Personvernerklæring
      </h1>
      <div className="mt-8 space-y-6 text-sm text-muted-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground">
            1. Behandlingsansvarlig
          </h2>
          <p className="mt-2">
            Save Solutions AS (org.nr. 933 882 867) er behandlingsansvarlig for
            personopplysninger som samles inn gjennom Revizo.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            2. Hvilke opplysninger vi samler inn
          </h2>
          <p className="mt-2">
            Vi samler inn informasjon du oppgir ved registrering (navn, e-post,
            organisasjon), bruksdata, og teknisk informasjon som IP-adresse og
            nettlesertype.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            3. Formål
          </h2>
          <p className="mt-2">
            Opplysningene brukes for å levere tjenesten, gi kundesupport,
            forbedre produktet, og oppfylle juridiske forpliktelser.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            4. Dine rettigheter
          </h2>
          <p className="mt-2">
            Du har rett til innsyn, retting, sletting og dataportabilitet. Kontakt
            oss på{" "}
            <a
              href="mailto:hei@revizo.ai"
              className="text-foreground underline underline-offset-4 hover:text-brand"
            >
              hei@revizo.ai
            </a>{" "}
            for å utøve dine rettigheter.
          </p>
        </section>

        <p className="pt-4 text-xs">Sist oppdatert: Mars 2026</p>
      </div>
    </div>
  );
}
