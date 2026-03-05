-- Task Templates (oppgavemaler)
CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  deadline_slug TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_templates_tenant ON task_templates (tenant_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_slug ON task_templates (deadline_slug);

-- Seed system task templates
INSERT INTO task_templates (tenant_id, name, description, deadline_slug, is_system, items) VALUES

-- MVA-termin
(NULL, 'MVA-termin sjekkliste', 'Standard sjekkliste for MVA-skattemelding per termin', 'mva-skattemelding', true, '[
  {"title":"Avstem utgående MVA","description":"Kontroller at utgående MVA i regnskapet stemmer med MVA-meldingen","routine":"1. Kjør saldobalanse for MVA-kontoer (2700-2740)\n2. Sammenlign med MVA-oppstilling fra regnskapssystemet\n3. Kontroller at alle MVA-koder er korrekte\n4. Undersøk eventuelle differanser","priority":"high","category":"vat","sortOrder":1,"offsetDays":-7},
  {"title":"Avstem inngående MVA","description":"Kontroller fradragsberettiget inngående MVA","routine":"1. Gjennomgå inngående MVA-transaksjoner for perioden\n2. Kontroller at alle bilag har gyldig MVA-dokumentasjon\n3. Verifiser at korrekt MVA-sats er brukt\n4. Sjekk for eventuelle fradragsbegrensninger","priority":"high","category":"vat","sortOrder":2,"offsetDays":-6},
  {"title":"Kontroller MVA-koder","description":"Verifiser at riktige MVA-koder er brukt på alle transaksjoner","routine":"1. Kjør rapport over MVA-koder brukt i perioden\n2. Kontroller mot standard kodeoversikt\n3. Sjekk spesielle transaksjoner (omvendt avgiftsplikt, fritatt omsetning)\n4. Korriger eventuelle feilkodinger","priority":"medium","category":"vat","sortOrder":3,"offsetDays":-5},
  {"title":"Sjekk periodisering","description":"Kontroller at transaksjoner er bokført i riktig termin","routine":"1. Gjennomgå transaksjoner rundt terminskiftet\n2. Kontroller at fakturadato og bokføringsdato er i samme termin\n3. Sjekk kreditnotaer og korreksjoner","priority":"medium","category":"vat","sortOrder":4,"offsetDays":-4},
  {"title":"Fyll ut og kontroller MVA-melding","description":"Forbered MVA-skattemeldingen for innsending","routine":"1. Generer MVA-melding fra regnskapssystemet\n2. Kontroller alle poster mot avstemminger\n3. Verifiser totalbeløp\n4. Dokumenter eventuelle avvik","priority":"high","category":"vat","sortOrder":5,"offsetDays":-2},
  {"title":"Send inn MVA-skattemelding","description":"Lever MVA-skattemeldingen via Altinn","routine":"1. Logg inn på Altinn\n2. Last opp eller fyll ut MVA-meldingen\n3. Kontroller oppsummeringen\n4. Signer og send inn\n5. Lagre kvittering","priority":"critical","category":"vat","sortOrder":6,"offsetDays":0}
]'::jsonb),

-- A-melding
(NULL, 'A-melding sjekkliste', 'Månedlig sjekkliste for A-melding (lønn og arbeidsgiveravgift)', 'a-melding', true, '[
  {"title":"Kontroller lønnsgrunnlag","description":"Verifiser at alle ansatte har korrekt lønnsgrunnlag for måneden","routine":"1. Sammenlign lønnskjøring med forrige måned\n2. Kontroller nye ansettelser og oppsigelser\n3. Verifiser variable tillegg (overtid, bonus)\n4. Sjekk sykefravær og permisjoner","priority":"high","category":"payroll","sortOrder":1,"offsetDays":-3},
  {"title":"Kontroller skattetrekk","description":"Verifiser at korrekt skattetrekk er beregnet","routine":"1. Kontroller skattekort for alle ansatte\n2. Verifiser tabelltrekk vs prosenttrekk\n3. Sjekk frikort og fribeløp\n4. Kontroller ekstra skattetrekk der aktuelt","priority":"high","category":"payroll","sortOrder":2,"offsetDays":-2},
  {"title":"Avstem arbeidsgiveravgift","description":"Kontroller AGA-beregning mot lønnsgrunnlag","routine":"1. Beregn AGA basert på lønnsgrunnlag og sone\n2. Kontroller soneinnplassering for ansatte\n3. Verifiser fribeløp\n4. Avstem mot bokført AGA","priority":"medium","category":"payroll","sortOrder":3,"offsetDays":-2},
  {"title":"Send inn A-melding","description":"Lever A-meldingen via Altinn innen fristen","routine":"1. Generer A-melding fra lønnssystemet\n2. Kontroller oppsummeringen\n3. Verifiser antall ansatte og beløp\n4. Send inn via Altinn\n5. Lagre kvittering","priority":"critical","category":"payroll","sortOrder":4,"offsetDays":0}
]'::jsonb),

-- Årsregnskap
(NULL, 'Årsregnskap sjekkliste', 'Komplett sjekkliste for utarbeidelse av årsregnskap', 'aarsregnskap', true, '[
  {"title":"Bankavstemminger","description":"Avstem alle bankkontoer per 31.12","routine":"1. Innhent kontoutskrifter for alle bankkontoer\n2. Avstem saldo mot regnskap\n3. Identifiser og forklarer differanser\n4. Kontroller utestående sjekker og overføringer","priority":"critical","category":"reconciliation","sortOrder":1,"offsetDays":-90},
  {"title":"Avstem kundefordringer","description":"Gjennomgå og avstem kundefordringer","routine":"1. Kjør aldersfordelt saldoliste\n2. Vurder tapsavsetning for gamle poster\n3. Send saldoforespørsler til vesentlige kunder\n4. Kontroller valutakurser for utenlandske fordringer","priority":"high","category":"reconciliation","sortOrder":2,"offsetDays":-75},
  {"title":"Avstem leverandørgjeld","description":"Gjennomgå og avstem leverandørgjeld","routine":"1. Kjør aldersfordelt leverandørliste\n2. Kontroller mot mottatte fakturaer etter årsslutt\n3. Vurder om det er utgifter som hører til regnskapsåret\n4. Periodiser vesentlige poster","priority":"high","category":"reconciliation","sortOrder":3,"offsetDays":-75},
  {"title":"Varetelling og varelager","description":"Kontroller varelager og foreta nedskrivningsvurdering","routine":"1. Kontroller varetellingslister\n2. Avstem mot bokført beholdning\n3. Vurder ukurans og nedskrivning\n4. Kontroller verdsettelse (laveste verdis prinsipp)","priority":"high","category":"reconciliation","sortOrder":4,"offsetDays":-60},
  {"title":"Avskrivninger","description":"Beregn og bokfør årets avskrivninger","routine":"1. Oppdater anleggsregister med nye investeringer\n2. Fjern solgte/utrangerte eiendeler\n3. Beregn planmessige avskrivninger\n4. Vurder ekstraordinære nedskrivninger\n5. Bokfør avskrivninger","priority":"medium","category":"reconciliation","sortOrder":5,"offsetDays":-45},
  {"title":"Skattekostnad","description":"Beregn årets skattekostnad og utsatt skatt","routine":"1. Beregn midlertidige forskjeller\n2. Beregn endring i utsatt skatt/skattefordel\n3. Beregn betalbar skatt\n4. Bokfør skattekostnad\n5. Avstem mot skattemelding","priority":"high","category":"tax","sortOrder":6,"offsetDays":-30},
  {"title":"Noter til årsregnskapet","description":"Utarbeid påkrevde noter","routine":"1. Gjennomgå notekravene i regnskapsloven\n2. Oppdater standardnoter\n3. Utarbeid spesialnotoer der nødvendig\n4. Kontroller konsistens med regnskapstall","priority":"medium","category":"reporting","sortOrder":7,"offsetDays":-21},
  {"title":"Årsberetning","description":"Utarbeid årsberetning (for selskaper som er pliktige)","routine":"1. Beskriv virksomhetens art og tilholdssted\n2. Redegjør for årsregnskapet og forutsetningen om fortsatt drift\n3. Omtal arbeidsmiljø, likestilling og ytre miljø\n4. Kommenter fremtidsutsikter","priority":"medium","category":"reporting","sortOrder":8,"offsetDays":-14},
  {"title":"Styrebehandling","description":"Forbered og gjennomfør styrebehandling av årsregnskapet","routine":"1. Send årsregnskap og årsberetning til styremedlemmer\n2. Innkall til styremøte\n3. Styret vedtar årsregnskapet\n4. Innhent signaturer\n5. Protokoller vedtaket","priority":"critical","category":"reporting","sortOrder":9,"offsetDays":-7},
  {"title":"Innsending til Regnskapsregisteret","description":"Send årsregnskap til Brønnøysundregistrene","routine":"1. Forbered innsending via Altinn\n2. Last opp årsregnskap, årsberetning og revisjonsberetning\n3. Kontroller alle vedlegg\n4. Signer og send inn\n5. Lagre kvittering","priority":"critical","category":"reporting","sortOrder":10,"offsetDays":0}
]'::jsonb),

-- Skattemelding selskap
(NULL, 'Skattemelding selskap sjekkliste', 'Sjekkliste for utarbeidelse av skattemelding for aksjeselskap', 'skattemelding-selskap', true, '[
  {"title":"Kontroller regnskapsmessig resultat","description":"Verifiser at regnskapsmessig resultat er korrekt som utgangspunkt","routine":"1. Avstem resultatregnskap mot saldobalanse\n2. Kontroller at alle periodiseringer er bokført\n3. Verifiser at avskrivninger er korrekte\n4. Sjekk uvanlige poster","priority":"high","category":"tax","sortOrder":1,"offsetDays":-21},
  {"title":"Midlertidige forskjeller","description":"Beregn midlertidige forskjeller mellom regnskap og skatt","routine":"1. Oppdater oversikt over driftsmidler (saldogrupper)\n2. Beregn skattemessige avskrivninger\n3. Identifiser alle midlertidige forskjeller\n4. Beregn utsatt skatt/skattefordel","priority":"high","category":"tax","sortOrder":2,"offsetDays":-14},
  {"title":"Permanente forskjeller","description":"Identifiser og dokumenter permanente forskjeller","routine":"1. Gjennomgå representasjonskostnader\n2. Kontroller kontingenter og gaver\n3. Identifiser skattefrie inntekter (fritaksmetoden)\n4. Dokumenter ikke-fradragsberettigede kostnader","priority":"medium","category":"tax","sortOrder":3,"offsetDays":-14},
  {"title":"Næringsoppgave","description":"Utfyll næringsoppgave (RF-1167/RF-1175)","routine":"1. Mapnummertall til riktige poster i næringsoppgaven\n2. Kontroller balansepostene\n3. Verifiser resultatpostene\n4. Avstem mot årsregnskap","priority":"high","category":"tax","sortOrder":4,"offsetDays":-7},
  {"title":"Fyll ut skattemelding","description":"Komplett utfylling av skattemeldingen","routine":"1. Overfør tall fra næringsoppgave\n2. Fyll ut tilleggsopplysninger\n3. Kontroller fremførbart underskudd\n4. Beregn betalbar skatt\n5. Dobbeltsjekk alle beløp","priority":"critical","category":"tax","sortOrder":5,"offsetDays":-3},
  {"title":"Send inn skattemelding","description":"Lever skattemeldingen via Altinn","routine":"1. Kontroller alle vedlegg\n2. Signer skattemeldingen\n3. Send inn via Altinn\n4. Lagre kvittering og kopi","priority":"critical","category":"tax","sortOrder":6,"offsetDays":0}
]'::jsonb),

-- Forskuddsskatt selskap
(NULL, 'Forskuddsskatt selskap', 'Oppgaver for forskuddsskatt for aksjeselskap', 'forskuddsskatt-selskap', true, '[
  {"title":"Vurder forskuddsskatt","description":"Vurder om innbetalt forskuddsskatt er tilstrekkelig","routine":"1. Estimer årets skattbare inntekt\n2. Beregn forventet skatt\n3. Sammenlign med utskrevet forskuddsskatt\n4. Vurder om tilleggsskatt bør innbetales","priority":"medium","category":"tax","sortOrder":1,"offsetDays":-7},
  {"title":"Betal forskuddsskatt","description":"Innbetal forskuddsskatt innen fristen","routine":"1. Kontroller KID og kontonummer\n2. Registrer betaling\n3. Bokfør betalingen\n4. Lagre kvittering","priority":"high","category":"tax","sortOrder":2,"offsetDays":0}
]'::jsonb),

-- Aksjonærregisteroppgave
(NULL, 'Aksjonærregisteroppgave', 'Sjekkliste for aksjonærregisteroppgaven (RF-1086)', 'aksjonaerregisteroppgaven', true, '[
  {"title":"Kontroller aksjonæroversikt","description":"Verifiser aksjonærlisten og eierandeler","routine":"1. Innhent forhåndsutfylt oppgave fra Altinn\n2. Kontroller aksjonærlisten mot aksjebok\n3. Registrer eventuelle endringer i eierskap\n4. Verifiser antall aksjer og pålydende","priority":"high","category":"reporting","sortOrder":1,"offsetDays":-7},
  {"title":"Registrer utbytte","description":"Registrer vedtatt utbytte i oppgaven","routine":"1. Kontroller generalforsamlingsprotokoll\n2. Registrer utbytte per aksjonær\n3. Verifiser kildeskatt for utenlandske aksjonærer\n4. Kontroller skjermingsfradrag","priority":"high","category":"reporting","sortOrder":2,"offsetDays":-3},
  {"title":"Send inn oppgave","description":"Lever aksjonærregisteroppgaven via Altinn","routine":"1. Kontroller oppsummering\n2. Verifiser alle aksjonærer og beløp\n3. Signer og send inn\n4. Lagre kvittering","priority":"critical","category":"reporting","sortOrder":3,"offsetDays":0}
]'::jsonb)

ON CONFLICT DO NOTHING;
