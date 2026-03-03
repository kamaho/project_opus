---
title: Slik kobler du Tripletex
sidebar_position: 2
---

# Slik kobler du Tripletex til Revizo

Koble Revizo til Tripletex for automatisk synkronisering av regnskapsdata.
Når tilkoblingen er satt opp, henter Revizo posteringer og banktransaksjoner
automatisk — du slipper manuell filimport.

## Hva du trenger

Før du starter trenger du:

1. **Administratortilgang** i Revizo (kun administratorer kan koble integrasjoner)
2. **Consumer token** fra Tripletex
3. **Employee token** fra Tripletex
4. Minst én **klient** opprettet i Revizo

:::tip Hvor finner jeg API-nøklene i Tripletex?
Gå til **Tripletex → Innstillinger → Integrasjon → API-tilgang**. Her finner du
consumer token og employee token. Kopier begge verdiene.
:::

## Steg 1: Koble til Tripletex

1. Åpne **Integrasjoner** i sidemenyen i Revizo
2. Finn **Tripletex** i listen og klikk **Konfigurer**
3. Du ser nå tilkoblingsdialogen med status «Ikke tilkoblet»

### Lim inn API-nøkler

1. Lim inn **Consumer token** i det første feltet
2. Lim inn **Employee token** i det andre feltet
3. Hvis du bruker Tripletex sitt **testmiljø**, kryss av for «Bruk testmiljø»
4. Klikk **Koble til Tripletex**

Revizo verifiserer nå tilkoblingen mot Tripletex. Hvis alt er i orden ser du
en grønn hake og selskapsnavn fra Tripletex.

:::caution Feil ved tilkobling?
Vanlige årsaker:
- **Consumer token er ugyldig** — sjekk at du har kopiert hele tokenet
- **Employee token er ugyldig** — sjekk at tokenet ikke har utløpt
- **Feil miljø** — testmiljø-tokens fungerer ikke mot produksjon og omvendt
:::

## Steg 2: Velg klient og selskap

Etter at tilkoblingen er verifisert vises konfigurasjonen:

1. **Velg klient** — velg hvilken Revizo-klient som skal kobles til Tripletex
2. **Velg Tripletex-selskap** — velg selskapet fra listen (Revizo henter tilgjengelige selskaper automatisk)

## Steg 3: Velg kontoer

Revizo henter kontoplanen fra Tripletex automatisk. Du kan søke etter kontonummer
eller kontonavn.

### Sett 1 — Hovedbok

Velg én eller flere kontoer fra **hovedboken** som Revizo skal hente posteringer fra.
Disse blir «Sett 1» i avstemmingen.

### Sett 2 — Bank

Velg én eller flere **bankkontoer** som Revizo skal hente banktransaksjoner fra.
Disse blir «Sett 2» i avstemmingen.

:::info Tips
Du kan velge flere kontoer for hvert sett. For eksempel kan du velge
konto 1920 og 1930 som bankkontoer.
:::

## Steg 4: Velg transaksjonsfelt

Du kan velge hvilke felt som skal hentes fra Tripletex. Beløp og dato hentes alltid.

| Felt | Beskrivelse | Standard |
|---|---|---|
| Beskrivelse | Tekst fra posteringen | På |
| Bilagsnummer | Bilagsnummer (voucher) | På |
| Fakturanummer | Fakturanummer | Av |
| Referanse | Referansefelt | På |
| Valutabeløp | Beløp i utenlandsk valuta | Av |
| Kontonummer | Kontonummer fra kontoplanen | På |

## Steg 5: Velg startdato og intervall

1. **Synkroniser fra dato** — velg startdato for datahenting (standard: 1. januar gjeldende år)
2. **Intervall** — hvor ofte Revizo skal synkronisere automatisk (standard: 60 minutter)

## Steg 6: Start synkronisering

Klikk **Koble til og synkroniser**. Revizo henter nå:
1. Selskapsinformasjon og kontoplan
2. Posteringer fra hovedboken (Sett 1)
3. Banktransaksjoner (Sett 2)
4. Åpningsbalanser

Du ser et sammendrag med antall posteringer og banktransaksjoner som ble hentet.

---

## Automatisk synkronisering

Etter førstegangsoppsett synkroniserer Revizo automatisk med Tripletex i bakgrunnen.
Kun **nye** posteringer og transaksjoner hentes — data som allerede er importert
hentes ikke på nytt.

Du kan se status for automatisk synk under klientens konfigurasjon:
- **Status**: Aktiv / Pauset
- **Siste synk**: Tidspunkt for siste vellykkede synk
- **Sett 1**: Antall valgte hovedbok-kontoer
- **Sett 2**: Antall valgte bankkontoer

### Synkroniser manuelt

Du kan når som helst klikke **Synkroniser nå** for å hente nye data umiddelbart.

---

## Endre konfigurasjon

Du kan endre konto-valg, felt, startdato og intervall etter oppsett:

1. Gå til **Integrasjoner → Tripletex**
2. Velg klienten du vil endre
3. Endre innstillingene
4. Klikk **Oppdater og synkroniser**

---

## Koble fra Tripletex

For å koble fra Tripletex, kontakt administrator. Data som allerede er importert
beholdes i Revizo.

---

## Vanlige spørsmål

### Hva skjer med data som allerede er importert?

Data beholdes i Revizo selv om du endrer konfigurasjon eller kobler fra Tripletex.
Revizo overskriver ikke eksisterende data.

### Kan jeg koble samme klient til et annet Tripletex-selskap?

Ja. Endre Tripletex-selskap i konfigurasjonen og kjør synk på nytt.
Eksisterende data beholdes.

### Støttes flere kontoer?

Ja. Du kan velge flere kontoer for både Sett 1 (hovedbok) og Sett 2 (bank).

### Hva betyr «inkrementell synk»?

Revizo husker hva som allerede er hentet. Ved neste synk hentes kun nye posteringer
og transaksjoner. Dette gjør synkroniseringen rask og effektiv.

### Hva skjer hvis Tripletex er nede?

Revizo prøver automatisk opptil 3 ganger med økende ventetid. Hvis Tripletex
fortsatt er utilgjengelig, vises en feilmelding. Data som allerede er importert
påvirkes ikke. Synken prøver igjen ved neste automatiske kjøring.

### Hvilke rettigheter trenger tokenet i Tripletex?

Employee-tokenet trenger lesetilgang til:
- Kontoplan
- Hovedboksposteringer
- Banktransaksjoner
- Saldo/balanse
- Selskapsinformasjon

For regnskapsførere som jobber med flere klienter: tokenet bør ha
tilgang til alle relevante selskaper.

---

## Feilsøking

### «Tripletex-autentisering feilet»

- Sjekk at du har kopiert riktig consumer token og employee token
- Sjekk at du bruker riktig miljø (test vs. produksjon)
- Sjekk at tokenene ikke har utløpt i Tripletex

### «Ingen tilgang»

- Employee-tokenet har ikke nødvendige rettigheter
- Sjekk tilgangsinnstillinger i Tripletex under **Innstillinger → Integrasjon**

### «Kunne ikke koble til Tripletex»

- Sjekk internettforbindelsen
- Tripletex kan ha nedetid — sjekk [status.tripletex.no](https://status.tripletex.no)

### Synkronisering viser 0 nye poster

- Dette er normalt hvis det ikke er nye posteringer siden sist
- Sjekk at startdato (`Synkroniser fra dato`) er riktig
- Sjekk at valgte kontoer faktisk har posteringer i Tripletex

### Noe annet?

Kontakt support med feilmeldingen du ser, og vi hjelper deg videre.
