-- Migration: 0032_seed_deadline_templates
-- Seeds the 10 mandatory Norwegian regulatory deadline templates.
-- Idempotent: uses ON CONFLICT (slug) DO NOTHING.

BEGIN;

INSERT INTO deadline_templates (name, slug, description, category, periodicity, due_date_rule, is_system)
VALUES
  (
    'MVA-melding',
    'mva-termin',
    'Merverdiavgift — innlevering av mva-melding',
    'tax',
    'bimonthly',
    '{"type":"offset_after_period","offset_months":1,"day":10}',
    true
  ),
  (
    'A-melding',
    'a-melding',
    'Arbeidsgiveravgift og forskuddstrekk — månedlig rapportering',
    'payroll',
    'monthly',
    '{"type":"offset_after_period","offset_months":1,"day":5}',
    true
  ),
  (
    'Forskuddsskatt AS T1',
    'forskuddsskatt-as-t1',
    'Forskuddsskatt for aksjeselskaper — 1. termin',
    'tax',
    'annual',
    '{"type":"fixed_annual","month":2,"day":15,"applies_to":["AS","ASA"]}',
    true
  ),
  (
    'Forskuddsskatt AS T2',
    'forskuddsskatt-as-t2',
    'Forskuddsskatt for aksjeselskaper — 2. termin',
    'tax',
    'annual',
    '{"type":"fixed_annual","month":4,"day":15,"applies_to":["AS","ASA"]}',
    true
  ),
  (
    'Forskuddsskatt AS T3',
    'forskuddsskatt-as-t3',
    'Forskuddsskatt for aksjeselskaper — 3. termin',
    'tax',
    'annual',
    '{"type":"fixed_annual","month":9,"day":15,"applies_to":["AS","ASA"]}',
    true
  ),
  (
    'Forskuddsskatt AS T4',
    'forskuddsskatt-as-t4',
    'Forskuddsskatt for aksjeselskaper — 4. termin',
    'tax',
    'annual',
    '{"type":"fixed_annual","month":11,"day":15,"applies_to":["AS","ASA"]}',
    true
  ),
  (
    'Skattemelding AS',
    'skattemelding-as',
    'Skattemelding for aksjeselskaper',
    'tax',
    'annual',
    '{"type":"fixed_annual","month":5,"day":31,"applies_to":["AS","ASA"]}',
    true
  ),
  (
    'Skattemelding ENK',
    'skattemelding-enk',
    'Skattemelding for enkeltpersonforetak',
    'tax',
    'annual',
    '{"type":"fixed_annual","month":4,"day":30,"applies_to":["ENK"]}',
    true
  ),
  (
    'Årsregnskap',
    'arsregnskap',
    'Årsregnskap — 6 måneder etter regnskapsårets slutt',
    'reporting',
    'annual',
    '{"type":"offset_after_period","offset_months":6,"day":null}',
    true
  ),
  (
    'Aksjonærregisteroppgave',
    'aksjonaerregisteroppgave',
    'Aksjonærregisteroppgave for aksjeselskaper',
    'reporting',
    'annual',
    '{"type":"fixed_annual","month":1,"day":31,"applies_to":["AS","ASA"]}',
    true
  )
ON CONFLICT (slug) DO NOTHING;

COMMIT;
