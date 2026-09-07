# Documentazione

La documentazione distingue requisiti approvati, design ancora in evoluzione ed evidenze storiche del prototipo.

| Documento | Stato | Scopo |
|---|---|---|
| [Uso della libreria](usage.md) | Implementato | API disponibile oggi, opzioni, preset e invarianti. |
| [Requisiti di prodotto](product-requirements.md) | Approvato per l’MVP | Problema, utenti, requisiti, non-goals e criteri di successo. |
| [Product e UX design](ux-design.md) | Approvato per l’MVP | Journey, stati, pannello, microcopy, accessibilità e recovery. |
| [Technical design](technical-design.md) | Approvato, hardening applicato | Toolchain, package, API, dati, build, test e CI. |
| [Schema UiTarget v1](schema-v1.md) | Approvato, hardening applicato | Contratto macchina e regole deterministiche. |
| [Contratto API](api-contract.md) | Approvato nel Gate B | Tipi pubblici, privacy, resolver, lifecycle e copy. |
| [Specifica estrazione DOM](extraction-spec.md) | Approvato nel Gate B | Algoritmi normativi, subtree sensibili e budget. |
| [Quality gate](quality-gates.md) | Approvato nel Gate B | Browser/OS, accessibilità, CI, release e metriche. |
| [Tracciabilità MVP](traceability.md) | Baseline | Requisiti, responsabilità ed evidenze previste. |
| [Design review e hardening](reviews/hardening-2026-08-26.md) | Correzioni integrate | Finding Security, Architecture, Data, UX e Operations. |
| [Review indipendente](reviews/independent-review-2026-08-26.md) | Completata | Finding deduplicati, correzioni e verdetti finali. |
| [Consolidamento](consolidation.md) | Gate B chiuso | Correzioni, rischio residuo e condizioni di implementazione. |
| [Architettura iniziale](architecture.md) | Sintesi | Confini tecnici e collegamento ai documenti correnti. |
| [Privacy e sicurezza](security-and-privacy.md) | Baseline approvata | Dati ammessi, esclusioni e invarianti di sicurezza. |
| [Roadmap](roadmap.md) | Proposta | Sequenza delle vertical slice e gate. |
| [Riferimento del prototipo](prototype-reference.md) | Storico | Comportamento ed evidenze del prototipo SerialOrders. |

## Decision record

- [ADR-0001 — pnpm workspace e TypeScript project references](adr/0001-pnpm-typescript-workspace.md)
- [ADR-0002 — Tre package, ESM e output ES2022](adr/0002-package-boundaries-and-esm.md)
- [ADR-0003 — Integrazione development-only fail-safe](adr/0003-development-only-fail-safe.md)
- [ADR-0004 — Redazione prima della memorizzazione](adr/0004-redact-before-storage.md)
- [ADR-0005 — Shadow DOM open per il pannello](adr/0005-shadow-dom-panel-isolation.md)
- [ADR-0006 — Supply chain e pubblicazione con provenance](adr/0006-supply-chain-and-publishing.md)

## Regola editoriale

Ogni documento deve distinguere:

- **Fatto:** verificato nel repository o in una fonte indicata.
- **Decisione:** scelta approvata per il nuovo prodotto.
- **Assunzione:** ipotesi da verificare.
- **Rischio:** evento possibile con impatto sul prodotto.
- **Evidenza storica:** risultato riferito al prototipo, non al nuovo repository.
