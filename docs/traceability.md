# Tracciabilità MVP

> Stato: baseline del piano di verifica. Le colonne Codice ed Evidenza verranno completate con percorsi e risultati reali durante l’implementazione.

## Requisiti funzionali

| Requisito | Design responsabile | Evidenza prevista |
|---|---|---|
| FR-001 | `browser`: overlay e lettura geometria | Integration test DOM ed E2E senza layout shift. |
| FR-002 | `browser`: state machine e shortcut config | Unit test degli stati ed E2E temporanea/continua. |
| FR-003 | `browser`: listener in capture phase | E2E su button e link con azione ospitante non eseguita. |
| FR-004 | `core`: session store immutabile | Unit test di ordine, append e snapshot. |
| FR-005 | `core`: max target policy | Unit test soglie ed E2E al target 20/21. |
| FR-006 | `browser`: extractor e pipeline privacy | Unit/integration test per ogni campo e caso di omissione. |
| FR-007 | `angular`: `ComponentResolver` | Contract test delle debug globals ed E2E nella demo. |
| FR-008 | `core`: text formatter | Golden test deterministici. |
| FR-009 | `core`: JSON formatter e schema v1 | Schema validation, golden test e pack smoke test. |
| FR-010 | `browser`: controller e pannello | Component test ed E2E copia/rimozione/clear. |
| FR-011 | `browser`: feedback e recovery | Component test delle union error ed E2E clipboard negata. |
| FR-012 | `browser`: target exclusion boundary | E2E su pannello, toast e overlay. |
| FR-013 | `browser`: lifecycle controller | Unit test di idempotenza e leak test dei listener. |
| FR-014 | `browser`: capture focused element | E2E solo tastiera. |
| FR-015 | `core` snapshot undo + `browser` feedback | Unit test scadenza/snapshot ed E2E undo. |

## Requisiti non funzionali

| Requisito | Design responsabile | Evidenza prevista |
|---|---|---|
| NFR-001 | Architettura senza transport; policy CI | Scansione dipendenze e test runtime di fetch/XHR/WebSocket/beacon. |
| NFR-002 | Pipeline redact-before-storage | Test canary su input, textarea, select, password e contenteditable. |
| NFR-003 | `core` normalizzazione e formatter | Golden test byte-for-byte con clock iniettabile. |
| NFR-004 | Boot no-op e file replacement demo | Build production, scan firme ed E2E negativo. |
| NFR-005 | Package graph `browser → core` | Project references, lint dei confini e dependency graph aciclico. |
| NFR-006 | UX design e pannello semantico | Test tastiera, axe, screen reader manuale, zoom 200%. |
| NFR-007 | Playwright branded channels | E2E Google Chrome e Microsoft Edge stable. |
| NFR-008 | Matrice browser documentata | Test sperimentali separati; nessuna claim prima dell’approvazione. |
| NFR-009 | Policy dipendenze | Sezione motivazione nelle PR, lockfile review e audit CI. |
| NFR-010 | Controller clipboard esplicito | E2E che verifica clipboard invariata dopo la cattura. |

## Catena di evidenza

Per ogni slice completata:

```text
Requisito → sezione di design → file sorgente → test → risultato CI o evidenza manuale
```

Un test presente ma non eseguito non costituisce evidenza. Un risultato riferito al prototipo SerialOrders non costituisce evidenza del nuovo repository.
