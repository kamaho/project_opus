---
title: Feilsøking
sidebar_position: 3
---

# FAQ — Feilsøking

## Import feiler

- Sjekk filformat (Excel, CSV, CAMT.053) og at kolonnenavn/felt matcher.
- Sjekk filstørrelse (grenser i appen).
- Prøv en mindre fil først.

## Smart Match finner ikke matcher

- Sjekk at begge mengder har data i valgt periode.
- Juster regler under Innstillinger for matching.
- Noen poster må kanskje matches manuelt.

## Tripletex-integrasjon

### Tilkobling feiler

- **«Autentisering feilet»** — Sjekk at consumer token og employee token er korrekte. Sjekk at du bruker riktig miljø (test vs. produksjon).
- **«Ingen tilgang»** — Employee-tokenet mangler nødvendige rettigheter. Sjekk tilgangsinnstillinger i Tripletex under Innstillinger → Integrasjon.
- **«Kunne ikke koble til»** — Sjekk internettforbindelsen. Tripletex kan ha nedetid — sjekk [status.tripletex.no](https://status.tripletex.no).

### Synk feiler

- Sjekk at valgt selskap og kontoer finnes i Tripletex.
- Sjekk at startdato ikke er i fremtiden.
- Revizo prøver automatisk opptil 3 ganger. Hvis det fortsatt feiler, vent til neste automatiske synk.

### Synk viser 0 nye poster

- Normalt hvis det ikke er nye posteringer siden sist.
- Revizo henter kun **nye** data (inkrementell synk).
- Sjekk at kontoene du har valgt faktisk har posteringer i Tripletex for perioden.

Se også: [Slik kobler du Tripletex](/guider/integrasjoner/tripletex) for detaljert veiledning.

---

[support@accountcontrol.no](mailto:support@accountcontrol.no)
