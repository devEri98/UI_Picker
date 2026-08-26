# ADR-0003 — Integrazione development-only fail-safe

- Stato: accettato
- Data: 2026-08-26

## Contesto

Una condizione runtime può impedire l’avvio del picker senza rimuoverne il codice dai chunk di produzione. Il prodotto deve fornire un’integrazione verificabile e sicura per default.

## Decisione

- nessun side effect all’import;
- controller avviato esplicitamente;
- boot predefinito no-op;
- demo Angular con file replacement soltanto per ambienti consentiti;
- import dinamico del runtime reale nel boot development;
- build production verificata cercando firme univoche e tramite test comportamentale;
- documentazione consumer che distingue disabilitazione runtime ed esclusione dal bundle.

## Alternative considerate

- `if (!production)`: non dimostra l’assenza del codice prodotto.
- variabile globale runtime: semplice, ma conserva il runtime nel bundle.
- inizializzazione automatica al semplice import: ergonomica, ma rende più facile l’inclusione accidentale e ostacola lifecycle e test.

## Conseguenze

- l’integrazione richiede un piccolo file boot nel consumer;
- la demo deve costruire sia development sia production in CI;
- non si promette automaticamente l’esclusione per ogni bundler: si fornisce un pattern e un controllo riproducibile.

## Condizioni di revisione

Creare integrazioni dedicate per altri bundler soltanto dopo l’arrivo dei relativi adapter o di consumer verificati.
