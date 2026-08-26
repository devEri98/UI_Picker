# ADR-0001 — pnpm workspace e TypeScript project references

- Stato: accettato
- Data: 2026-08-26

## Contesto

Il progetto contiene tre librerie correlate e una demo Angular. Servono installazioni riproducibili, confini verificabili e pubblicazione indipendente dei package, senza introdurre un orchestratore monorepo non necessario.

## Decisione

Usare pnpm 11 con workspace, protocollo `workspace:`, lockfile condiviso e divieto dei cicli. Usare TypeScript 6 con project references e `tsc --build` per typecheck ed emissione delle librerie.

Runtime di sviluppo: Node 24 LTS, minimo 24.15.0.

## Alternative considerate

- npm workspaces: adeguato, ma con garanzie meno esplicite sui collegamenti locali rispetto al protocollo `workspace:` scelto.
- Turborepo o Nx: utili su repository più grandi, ma aggiungerebbero configurazione e caching prima che esista un problema misurato.
- un solo package: più semplice da pubblicare, ma confonderebbe core, DOM e adapter Angular e renderebbe più facile introdurre dipendenze accidentali.

## Conseguenze

- serve pnpm/Corepack nel workflow locale e CI;
- ogni package mantiene `package.json` e `tsconfig` propri;
- la graph deve restare aciclica;
- la gestione release multi-package verrà aggiunta soltanto prima della prima pubblicazione.

## Condizioni di revisione

Riconsiderare un orchestratore se tempi CI o numero di package rendono insufficiente `tsc --build` più script pnpm.
