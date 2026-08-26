# Roadmap

La roadmap segue vertical slice verificabili. Le date verranno assegnate soltanto dopo il consolidamento di UX e architettura.

## Gate A — Product e UX design — completato

- user journey;
- stati del picker e del pannello;
- microcopy;
- scorciatoie e conflitti;
- accessibilità e tastiera;
- clipboard negata o non disponibile;
- limite sessione;
- responsive e liste lunghe;
- preview e redazione dei dati.

**Uscita:** flussi e stati approvati il 26 agosto 2026.

## Gate B — Technical design e hardening — review indipendente pendente

- schema `UiTarget` v1;
- contratti dei package;
- strategia development-only;
- modello di configurazione;
- threat model;
- strategia di test;
- ADR delle decisioni tecniche.

**Uscita:** nessun rischio Critical e nessun High senza decisione.

Stato corrente: technical design approvato, finding integrati, nessun Critical o High aperto. Manca la seconda review da revisore indipendente.

## Implementazione proposta

1. Baseline repository, workspace e CI.
2. Schema `UiTarget` v1 e formatter deterministici.
3. Estrazione DOM e redazione indipendenti dal framework.
4. Session store con limite configurabile.
5. Overlay e selezione browser.
6. Clipboard e gestione degli errori.
7. Pannello accessibile.
8. Adapter Angular.
9. Demo Angular con attivazione development-only.
10. Controllo automatico della build production.
11. E2E Chrome ed Edge e verifica manuale dei flussi principali.
12. Packaging e release `0.1.0-alpha`.

## Dopo l’MVP

- validazione e supporto ufficiale Firefox;
- validazione e supporto ufficiale Safari;
- valutazione di adapter aggiuntivi sulla base di richieste reali;
- eventuali note per sessione e target;
- eventuali integrazioni, mantenute fuori dal runtime base.
