# ADR-0002 — Tre package, ESM e output ES2022

- Stato: accettato
- Data: 2026-08-26

## Contesto

Il modello e i formatter devono restare indipendenti dal DOM; il runtime visuale dipende dal browser; la risoluzione dei componenti dipende dal framework.

## Decisione

Creare `core`, `browser` e `angular` con dipendenze `angular → browser → core`. Pubblicare esclusivamente ESM ES2022, dichiarazioni TypeScript e source map. Dichiarare entrypoint con `exports`, `type: module` e `sideEffects: false`. Compilare in modalità `NodeNext` e usare estensioni `.js` negli import relativi per mantenere valido l’output ESM anche senza bundler.

Non creare bundle UMD o CommonJS nell’MVP. Non usare un bundler per le librerie finché non emerge una necessità verificata.

## Alternative considerate

- singolo package con subpath: riduce la gestione release ma indebolisce l’isolamento delle dipendenze e obbliga ogni consumer a installare l’intero prodotto.
- CJS più ESM: aumenta matrice di build e test per un tool destinato a browser moderni e bundler correnti.
- Angular Package Format: necessario per librerie con artefatti Angular compilati; l’adapter MVP usa contratti TypeScript e debug globals, quindi non introduce componenti, direttive o servizi Angular.

## Conseguenze

- i consumer devono usare una toolchain capace di risolvere ESM ed `exports`;
- l’adapter Angular non importa `@angular/core` a runtime nell’MVP, ma dichiara `@angular/core: ^22.0.0` come peer dependency per esprimere la matrice supportata;
- se in futuro verranno introdotti artefatti Angular compilati, il package dovrà passare ad Angular Package Format e partial compilation.

## Condizioni di revisione

Riconsiderare APF se l’integrazione richiede provider, direttive, componenti o schematics Angular. Riconsiderare CJS soltanto davanti a consumer reali non compatibili con ESM.
