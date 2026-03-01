---
title: Slik kobler du Tripletex
sidebar_position: 2
---

# Slik kobler du Tripletex

Koble Revizo til Tripletex for automatisk synk av regnskapsdata.

## Forutsetninger

- Tripletex-konto med tilgang til API (consumer token og employee token).
- Revizo-klient opprettet.

## Steg 1: Åpne Tripletex-innstillinger

1. Gå til **Innstillinger** → **Integrasjoner** / **Tripletex**.
2. Klikk **Konfigurer Tripletex** for den aktuelle klienten.

## Steg 2: Velg selskap og kontoer

1. Velg Tripletex-selskap fra listen.
2. Velg hvilke kontoer som skal være **Mengde 1** (hovedbok) og **Mengde 2** (bank).
3. Sett startdato for synk.

## Steg 3: Kjør synk

Klikk **Synkroniser** for å hente data. Etter første synk kan du sette opp automatisk synk (cron) eller kjøre manuelt ved behov.

## Feilsøking

Hvis synk feiler, sjekk at API-nøklene er gyldige og at du bruker riktig miljø (test vs. produksjon). Ved vedvarende feil: kontakt support med feilmeldingen.
