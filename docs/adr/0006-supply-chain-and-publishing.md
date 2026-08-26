# ADR-0006 — Supply chain e pubblicazione con provenance

- Stato: accettato
- Data: 2026-08-26

## Contesto

Il progetto verrà installato come dipendenza di sviluppo e potrà eseguire codice nel browser del consumer. Dipendenze, script di installazione e credenziali di pubblicazione sono quindi parte del threat model.

## Decisione

- lockfile pnpm condiviso e frozen in CI;
- attesa minima iniziale di 1440 minuti per nuove release, con eccezioni esplicite;
- allowlist degli script di installazione;
- dependency review sulle pull request a severità `moderate`;
- GitHub Actions fissate a commit;
- pack e smoke test del tarball;
- build e test in job privo di OIDC;
- trasferimento del tarball immutabile con digest SHA-256;
- job publish separato, privilegi minimi, senza checkout di codice non fidato;
- npm trusted publishing da environment protetto, con provenance e senza token persistenti.

## Alternative considerate

- pubblicazione manuale locale: semplice, ma produce evidenza più debole e usa credenziali persistenti.
- accettare tutti gli install script: compatibile con più package, ma amplia inutilmente la superficie di attacco.
- bloccare ogni nuova dipendenza: massimo controllo, ma impedisce aggiornamenti necessari; la review esplicita è proporzionata al rischio.

## Conseguenze

- alcune release urgenti possono richiedere un’eccezione motivata alla release age;
- la prima pubblicazione richiede configurazione dello scope npm e del trusted publisher;
- il repository pubblico può usare la dependency review disponibile per i repository pubblici.

## Condizioni di revisione

La policy viene rivalutata prima di ogni cambio del canale di pubblicazione o introduzione di dipendenze runtime.
