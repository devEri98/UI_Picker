# Review indipendente — 26 agosto 2026

## Metodo

Tre revisori separati hanno esaminato in sola lettura sicurezza e privacy, architettura e API, UX e qualità. I finding sovrapposti sono stati deduplicati in questo registro. Nessun revisore ha modificato il design durante la prima lettura.

## Esito iniziale

- Critical: 0
- High: 7
- Medium: 19
- Low: 2

Tutti i finding hanno una correzione documentale e un'evidenza obbligatoria. Gli stessi revisori hanno completato la riverifica dopo le correzioni.

Durante la riverifica UX è emerso un ulteriore High, registrato come `IR-H08` e corretto prima della chiusura del gate.

## Verdetto finale

- security/privacy: **PASS**, nessun finding aperto;
- architecture/API: **PASS**, nessun finding aperto;
- UX/quality: **PASS**, nessun finding aperto;
- Gate B documentale: **approvato**.

Le chiusure a livello di design non sostituiscono i test: ogni evidenza indicata resta obbligatoria nelle slice di implementazione.

## Finding High

| ID | Area | Finding | Correzione | Evidenza richiesta | Stato |
|---|---|---|---|---|---|
| IR-H01 | Privacy | La cattura di un antenato poteva aggregare testo proveniente da discendenti sensibili. | Traversal nodo per nodo che salta l'intero sottoalbero di controlli, contenteditable, ruoli editabili, confini configurati e UI del picker. | Canary segreto assente da store, undo, subscriber, preview e clipboard. | Chiuso. |
| IR-H02 | Production | Marker testuali ed E2E non dimostravano da soli l'assenza del runtime nei chunk. | Controllo di stats/metafile su tutto il grafo initial e lazy, mutation fixture, marker ed E2E negativo. | Il gate deve fallire quando una fixture reintroduce intenzionalmente un modulo runtime. | Chiuso. |
| IR-H03 | Trust boundary | L'ADR vietava valori grezzi ai callback ma il redactor personalizzato li richiede. | Il redactor è ora esplicitamente codice trusted del consumer e riceve una sola stringa candidata, senza DOM o globali. | Type test e test throw/output invalido fail-closed. | Chiuso. |
| IR-H04 | Input | La modalità temporanea poteva restare armata se `Alt` non generava `keyup` dopo un cambio finestra. | Disarmo anche su blur, documento nascosto, perdita del modificatore e destroy; nessun riarmo automatico. | E2E `Alt → blur/hidden → ritorno → click host` non intercettato. | Chiuso. |
| IR-H05 | Focus | Rimozione, clear, collapse e undo non avevano una destinazione focus deterministica. | Matrice focus normativa per prima/media/ultima riga, clear, collapse, undo e trigger assente. | E2E solo tastiera per ogni transizione. | Chiuso. |
| IR-H06 | Clipboard | Il fallback manuale non definiva semantica modale, ordine Esc e recupero focus. | Dialog modale nominato, focus iniziale sull'output, focus trap, Esc prioritario e ritorno al trigger o fallback stabile. | E2E Tab/Shift+Tab/Esc/close con trigger presente e rimosso. | Chiuso. |
| IR-H07 | Tracciabilità UX | `NFR-006` aggregava troppi comportamenti senza criteri atomici verificabili. | Dodici requisiti `UXR` separati e collegati a evidenze specifiche. | Gate di tracciabilità verde soltanto se ogni UXR possiede test o evidenza manuale. | Chiuso. |
| IR-H08 | Input | La sola soppressione del `click` lasciava eseguire azioni applicative su `pointerdown`. | State machine capture su `pointerdown`, compatibilità mouse, `pointerup`, `pointercancel` e `click`; cattura una volta al completamento valido. | E2E su handler `pointerdown`, button, link e drag handle senza side effect. | Chiuso. |

## Finding Medium

| ID | Area | Finding | Correzione ed evidenza richiesta | Stato |
|---|---|---|---|---|
| IR-M01 | Privacy | Il rischio residuo è esteso a ogni stringa ammessa, inclusi pathname, ID, classi, attributi e resolver; preset strict obbligatorio con dati realistici. | Chiuso. |
| IR-M02 | Resource exhaustion | Budget normativi per stringhe, path, stati, riferimenti, target JSON e sessione; riduzione deterministica e errori tipizzati. | Chiuso. |
| IR-M03 | Resolver | Resolver custom dichiarato trusted; output validato, limitato, redatto e fail-closed. | Chiuso. |
| IR-M04 | Network | Garanzia limitata al codice e alle dipendenze della libreria; static denylist più test zero-request dopo il load. | Chiuso. |
| IR-M05 | Supply chain | Build/test senza credenziali OIDC; publish separato dall'artefatto immutabile verificato tramite SHA-256. | Chiuso. |
| IR-M06 | API privacy | `PrivacyPolicy` completa, range validati, metadata chiusa e comportamento obbligatorio per campi required, optional e invalidi. | Chiuso. |
| IR-M07 | Redaction metadata | Riferimento tramite campo logico canonico, non JSON Pointer, così può indicare anche una proprietà omessa. | Chiuso. |
| IR-M08 | Determinismo | Separati determinismo dell'estrazione con clock fissato e serializzazione byte-for-byte dello stesso modello. | Chiuso. |
| IR-M09 | Clipboard concurrency | Operazione single-flight con snapshot esplicito, esito tipizzato, timeout di 10 secondi e completamento tardivo ignorato. | Chiuso. |
| IR-M10 | Algoritmi DOM | Selezionabilità, soppressione del click, text preview, signature, DOM path e semantica resi normativi. | Chiuso. |
| IR-M11 | Angular | Peer range `^22.0.0`, matrice fixture e casi di fallback del resolver espliciti. | Chiuso. |
| IR-M12 | Undo | Disponibile senza timeout e invalidato soltanto da mutazione successiva o destroy. | Chiuso. |
| IR-M13 | Compatibilità | Claim ufficiale ristretto a Chrome ed Edge Stable su Windows 11, con versione registrata a ogni release. | Chiuso. |
| IR-M14 | Screen reader | NVDA + Chrome come test candidato release; Edge come smoke test manuale. | Chiuso. |
| IR-M15 | Accessibilità | Baseline WCAG 2.2 AA con reflow, 400%, forced colors, contrasto, target size e reduced motion. | Chiuso. |
| IR-M16 | Panel placement | Se il pannello copre interamente il focus, si sposta nel quadrante opposto conservando il focus. | Chiuso. |
| IR-M17 | Event model | Target valido derivato da `composedPath`; click host bloccato in capture phase anche se l'estrazione fallisce. | Chiuso. |
| IR-M18 | CI | Check richiesti, merge policy, timeout, retry, `failOnFlakyTests`, retention e job a11y definiti. | Chiuso. |
| IR-M19 | Metriche | “Pochi secondi” sostituito con soglie misurabili tecniche e usability task-based. | Chiuso. |

## Finding Low

| ID | Area | Finding | Correzione ed evidenza richiesta | Stato |
|---|---|---|---|---|
| IR-L01 | Live region | Contratto per status/alert, deduplica e serializzazione degli annunci. | Chiuso. |
| IR-L02 | Storage | Sessione solo in memoria; l'unica persistenza ammessa è la posizione del pannello, versionata e namespaced. | Chiuso. |

## Documenti correttivi

- [`../api-contract.md`](../api-contract.md)
- [`../extraction-spec.md`](../extraction-spec.md)
- [`../quality-gates.md`](../quality-gates.md)
- [`../product-requirements.md`](../product-requirements.md)
- [`../technical-design.md`](../technical-design.md)
- [`../ux-design.md`](../ux-design.md)
- [`../schema-v1.md`](../schema-v1.md)
- [`../security-and-privacy.md`](../security-and-privacy.md)
- [`../traceability.md`](../traceability.md)
- [`../adr/0003-development-only-fail-safe.md`](../adr/0003-development-only-fail-safe.md)
- [`../adr/0004-redact-before-storage.md`](../adr/0004-redact-before-storage.md)
- [`../adr/0006-supply-chain-and-publishing.md`](../adr/0006-supply-chain-and-publishing.md)
