---
name: Matching Engine Architecture
overview: "Bygge en komplett automatisk matching-motor for transaksjoner: hash-basert indeksering for O(n) ytelse ved 100k+ poster, prioritetsbasert regel-pipeline med 1:1, Many:1, Many:Many og intern matching, preview/confirm-flyt, regel-UI, og auto-match-knapp i matching-view."
todos: []
isProject: false
---

# Matching Engine — Arkitektur og implementeringsplan

## Navaerende tilstand

- **Manuell matching fungerer** — bru