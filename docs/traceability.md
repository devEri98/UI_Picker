# Tracciabilità MVP

> Stato: baseline del piano di verifica. Le colonne Codice ed Evidenza verranno completate con percorsi e risultati reali durante l’implementazione.

## Requisiti funzionali

| Requisito | Design responsabile | Evidenza prevista |
|---|---|---|
| FR-001 | `browser`: overlay e lettura geometria | Integration test DOM ed E2E senza layout shift. |
| FR-002 | `browser`: state machine e shortcut config | Unit test degli stati ed E2E temporanea/continua. |
| FR-003 | `browser`: pointer state machine in capture phase | E2E su handler `pointerdown`, button, link, drag handle e rilascio su target diverso senza side effect target/bubble o nativo. |
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
| FR-015 | `core` snapshot undo + `browser` feedback | Undo valido senza timeout e invalidato da mutazione successiva o destroy. |
| FR-016 | Extractor e session budget | Fixture 1–10 MiB, limiti byte e rifiuto oltre soglia. |
| FR-017 | API privacy/resolver fail-closed | Type test e matrice callback/resolver throw o output invalido. |

## Requisiti non funzionali

| Requisito | Design responsabile | Evidenza prevista |
|---|---|---|
| NFR-001 | Architettura senza transport; policy CI | Static denylist ed E2E zero-request dopo load su tutti i sink definiti. |
| NFR-002 | Traversal con sensitive subtree boundary | Canary annidati in antenati; assenza in store, undo, subscriber, preview e clipboard. |
| NFR-003 | Extractor stabile + formatter deterministico | Clock fissato per estrazione; golden byte-for-byte sullo stesso modello. |
| NFR-004 | Boot no-op, replacement e module graph | Stats/metafile, mutation fixture, scan marker ed E2E negativo. |
| NFR-005 | Package graph `browser → core` | Project references, lint dei confini e dependency graph aciclico. |
| NFR-006 | Aggregatore UXR-001…012 | Pass soltanto quando ogni requisito UXR ha evidenza. |
| NFR-007 | Matrice Windows 11 branded | E2E Chrome/Edge Stable con versione registrata a ogni release. |
| NFR-008 | Matrice browser documentata | Test sperimentali separati; nessuna claim prima dell’approvazione. |
| NFR-009 | Policy dipendenze | Sezione motivazione nelle PR, lockfile review e audit CI. |
| NFR-010 | Controller clipboard esplicito | E2E che verifica clipboard invariata dopo la cattura. |

## Requisiti UX e accessibilità

| Requisito | Design responsabile | Evidenza prevista |
|---|---|---|
| UXR-001 | State machine fail-safe | Alt → blur/hidden/destroy senza keyup; al ritorno click host non intercettato. |
| UXR-002 | Focus matrix | Rimozione prima/media/ultima, clear, collapse e undo solo tastiera. |
| UXR-003 | Dialog fallback clipboard | Tab/Shift+Tab, Esc prioritario, close e ritorno focus con trigger presente/assente. |
| UXR-004 | Panel collision handling | Focus in ogni corner e viewport piccolo, mai interamente coperto. |
| UXR-005 | Semantic panel controls | Accessibility tree, nomi, stati e ordine Tab. |
| UXR-006 | Live region contract | Sequenze capture/remove/undo/copy, deduplica e ordine annunci. |
| UXR-007 | WCAG 2.2 AA | Axe, contrasto, 320 CSS px/400%, forced-colors e target size. |
| UXR-008 | Motion policy | Reduced-motion e input non bloccato durante transizioni. |
| UXR-009 | Drag alternatives | Frecce, Shift+frecce e reset posizione solo tastiera. |
| UXR-010 | Reflow/long content | Rotte/path/testi lunghi senza scroll orizzontale. |
| UXR-011 | Feedback e recovery | Empty, success, warning, error, limit e clipboard denied. |
| UXR-012 | Shortcut exclusions | IME, input, textarea, select, contenteditable e role textbox/searchbox. |

## Catena di evidenza

Per ogni slice completata:

```text
Requisito → sezione di design → file sorgente → test → risultato CI o evidenza manuale
```

Un test presente ma non eseguito non costituisce evidenza. Un risultato riferito al prototipo SerialOrders non costituisce evidenza del nuovo repository.
