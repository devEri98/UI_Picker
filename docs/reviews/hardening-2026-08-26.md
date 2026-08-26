# Design review e hardening — 26 agosto 2026

> Ambito: requisiti, UX, schema v1, architettura, privacy, test e release. Queste sono review strutturate per ruolo condotte dall’agente principale; la verifica indipendente da un secondo agente o revisore resta un gate separato.

## Sintesi

| Severità | Trovati | Risolti o ridotti | Aperti |
|---|---:|---:|---:|
| Critical | 0 | 0 | 0 |
| High | 4 | 4 | 0 |
| Medium | 11 | 11 | 0 |
| Low | 1 | 1 | 0 |

Rimane un rischio residuo Medium accettato: il testo visibile può contenere dati personali non identificabili automaticamente. Il preset `strict`, l’anteprima e la copia esplicita consentono di ridurlo, ma non eliminarlo mantenendo il caso d’uso principale.

## Security reviewer

| ID | Sev. | Scenario | Impatto | Evidenza nel design iniziale | Correzione consolidata | Test richiesto | Stato |
|---|---|---|---|---|---|---|---|
| SEC-R01 | High | Il runtime entra nel bundle production anche se non viene avviato. | Codice diagnostico e superficie di cattura distribuiti agli utenti finali. | Controllo basato soprattutto su firme testuali. | Boot no-op, file replacement, import dinamico, più marker indipendenti e E2E negativo. | Build production, scan chunk/entrypoint ed E2E senza UI/listener. | Risolto nel design. |
| SEC-R02 | High | Testo o pathname contengono dati personali. | Condivisione involontaria tramite clipboard. | Limite e callback, ma un solo profilo privacy. | Preset `balanced` dichiarato, preset `strict`, redazione su ogni stringa, anteprima e copia esplicita. | Canary PII, strict preset e verifica clipboard invariata dopo capture. | Ridotto a rischio Medium accettato. |
| SEC-R03 | Medium | Testo catturato viene renderizzato come markup. | XSS nel contesto dell’applicazione ospitante. | Regola generale di rendering sicuro. | Divieto esplicito di `innerHTML`, `eval` ed esecuzione di stringhe. | Payload HTML/script in ogni campo visibile nel pannello. | Risolto nel design. |
| SEC-R04 | Medium | Dipendenza, install script o credenziale npm compromessi. | Compromissione dei consumer o della release. | Lockfile e audit generici. | Release age, script allowlist, dependency review, azioni pin, trusted publishing e provenance. | PR con dipendenza vulnerabile, pack verification e dry-run release. | Risolto nel design. |

## Architecture reviewer

| ID | Sev. | Scenario | Impatto | Evidenza nel design iniziale | Correzione consolidata | Test richiesto | Stato |
|---|---|---|---|---|---|---|---|
| ARCH-R01 | High | `tsc` emette import relativi senza estensione in ESM. | Il package funziona nel bundler ma fallisce in Node ESM o nel pack smoke test. | ESM ES2022 senza strategia di resolution esplicita. | `NodeNext` ed estensioni `.js` negli import sorgente relativi. | Import dei tarball da Node ESM e consumer bundler. | Risolto nel design. |
| ARCH-R02 | Medium | `getSession` espone riferimenti dello store. | Il consumer muta lo stato senza passare dal controller. | Tipo readonly solo compile-time. | Snapshot profondo senza riferimenti mutabili condivisi. | Tentativi di mutazione e confronto store prima/dopo. | Risolto nel design. |
| ARCH-R03 | Medium | CSS dell’host altera il pannello o viceversa. | UI illeggibile, collisioni e comportamento non deterministico. | Isolamento ancora aperto. | Shadow DOM `open`, reset mirato e token interni; ADR-0005. | Host con reset aggressivo, light/dark e z-index elevati. | Risolto nel design. |

## Domain e data reviewer

| ID | Sev. | Scenario | Impatto | Evidenza nel design iniziale | Correzione consolidata | Test richiesto | Stato |
|---|---|---|---|---|---|---|---|
| DATA-R01 | Medium | `redactions.field` usa una notazione ambigua. | Consumer diversi interpretano percorsi differenti. | Dot path libero. | JSON Pointer RFC 6901 nel campo `path`. | Schema validation ed escaping `~` e `/`. | Risolto nel design. |
| DATA-R02 | Medium | Clear, undo, capture e copy si intersecano. | Copia o ripristino riferiti a una sessione diversa da quella mostrata. | Coda clipboard ma mutazioni non formalizzate. | Reducer sincrono, un livello undo e snapshot catturato al comando copy. | Test con sequenze rapide e Promise clipboard ritardate. | Risolto nel design. |
| DATA-R03 | Medium | Unicode o caratteri speciali producono path instabili/non validi. | Output non deterministico o impossibile da riutilizzare. | Normalizzazione spazi, escaping non definito. | Unicode NFC, `CSS.escape` e escaping dedicato degli attributi. | Virgolette, backslash, controllo, emoji e forme Unicode equivalenti. | Risolto nel design. |

## UX reviewer

| ID | Sev. | Scenario | Impatto | Evidenza nel design iniziale | Correzione consolidata | Test richiesto | Stato |
|---|---|---|---|---|---|---|---|
| UX-R01 | Medium | Undo scompare dopo un timeout breve. | Utenti di tastiera o screen reader perdono il recupero. | “Breve periodo” non definito. | Undo persistente fino alla successiva mutazione o destroy. | Sola tastiera, screen reader e sequenze di mutazione. | Risolto nel design. |
| UX-R02 | Medium | Clipboard negata senza focus management. | L’output manuale esiste ma non è raggiungibile in modo prevedibile. | Fallback manuale generico. | Vista read-only con titolo, istruzioni, focus in entrata e ritorno al trigger. | E2E clipboard denied solo tastiera. | Risolto nel design. |
| UX-R03 | Low | Le scorciatoie si attivano durante editing o IME. | Interruzione dell’input dell’applicazione ospitante. | Divieto generale già presente. | Invariante tracciato per input, textarea, select, contenteditable e composizione IME. | E2E su ogni contesto editabile. | Confermato e tracciato. |

## Quality e operations reviewer

| ID | Sev. | Scenario | Impatto | Evidenza nel design iniziale | Correzione consolidata | Test richiesto | Stato |
|---|---|---|---|---|---|---|---|
| OPS-R01 | High | I test usano solo Chromium generico. | Differenze dei canali Chrome/Edge ufficialmente supportati non rilevate. | Playwright indicato senza requisito runner dettagliato. | Canali branded `chrome` e `msedge`, con job compatibile. | E2E sui due canali stable. | Risolto nel design. |
| OPS-R02 | Medium | Il tarball pubblicato differisce dal workspace testato. | Entry point o tipi mancanti nella release. | Build package senza consumer esterno. | `pnpm pack`, install smoke test e import ESM del tarball. | Consumer temporaneo senza path mapping. | Risolto nel design. |
| OPS-R03 | Medium | La release non è collegabile al sorgente e al workflow. | Auditabilità debole e maggiore rischio supply-chain. | Provenance non specificata. | npm trusted publishing e provenance da environment protetto. | Dry run e verifica attestazione sulla prima alpha. | Risolto nel design. |

## Limite di indipendenza

La separazione per ruolo riduce omissioni ma non rende questa review indipendente dall’autore del design. Prima di dichiarare concluso il gate di hardening serve una seconda review da persona o agente distinto, senza modifiche dirette al design e con finding consolidati separatamente.
