# Quality gate — MVP

> Stato: approvato nel Gate B. Ogni risultato deve indicare commit, sistema operativo, browser/tool version, data e artifact.

## Browser e ambiente supportati

- sistema operativo ufficiale MVP: Windows 11;
- browser: Google Chrome Stable e Microsoft Edge Stable correnti al momento della release;
- policy evergreen: riesecuzione completa a ogni release e almeno mensile sul branch principale;
- contesto primario: `http://localhost` o HTTPS;
- Firefox, Safari, altri sistemi operativi, iframe e Shadow DOM applicativo: sperimentali/non supportati.

Il numero di versione effettivo dei browser viene registrato nel report. Una nuova stable non estende la claim finché la matrice non torna verde.

## Accessibilità

Target: WCAG 2.2 AA per l’interfaccia propria del picker.

Controlli obbligatori:

- tastiera completa;
- focus visibile e non interamente coperto dal pannello;
- reflow a 320 CSS px e zoom 400%;
- contrasto testo 4.5:1 e componenti 3:1;
- Windows forced-colors;
- target pointer minimo 24×24 CSS px o spaziatura equivalente, 32×32 preferito;
- `prefers-reduced-motion`;
- axe senza violazioni Critical o Serious;
- NVDA + Chrome Stable su Windows 11 a ogni release candidate;
- smoke NVDA + Edge Stable.

La checklist screen reader registra owner/revisore, commit, versioni, scenari, atteso, osservato e risultato.

## Focus deterministico

| Azione | Destinazione focus |
|---|---|
| Rimuovi scheda | Stesso controllo nella scheda successiva, altrimenti precedente, altrimenti titolo `Nessun target` con `tabindex="-1"`. |
| Svuota | Titolo `Nessun target` con `tabindex="-1"`. |
| Comprimi scheda/pannello | Toggle che ha causato la chiusura. |
| Undo | Focus invariato, salvo attivazione esplicita dell’utente. |
| Chiudi fallback clipboard | Trigger `Copia tutto`; se assente, testata del pannello. |

Quando l’elemento applicativo focalizzato è interamente coperto, il pannello si ricolloca nel corner sicuro opposto senza spostare il focus.

La suite browser include un target con handler su `pointerdown`, oltre a button, link, drag handle e rilascio su target diverso; durante la cattura nessun handler target/bubble e nessuna azione nativa deve produrre side effect.

## CI sulle pull request

Required checks, senza soft-fail:

```text
format
lint
typecheck
unit-integration
a11y-automated
build-pack-smoke
production-exclusion
e2e-chrome
e2e-edge
dependency-review
```

- job predefiniti con `permissions: contents: read`;
- mai `pull_request_target` con checkout di codice non fidato;
- timeout esplicito per ogni job;
- Playwright `retries: 1` solo in CI e `failOnFlakyTests: true`;
- trace, screenshot e report conservati 14 giorni con commit SHA;
- una violazione axe Critical/Serious blocca il merge;
- test canary deliberatamente falliti devono bloccare PR e release dry-run.

## Pubblicazione

- trigger esclusivo da tag protetto riferito a commit su branch protetto;
- build/test in job senza OIDC;
- tarball immutabile trasferito come artifact con digest SHA-256;
- job publish separato con `contents: read` e `id-token: write`, nessun checkout o action superflua;
- digest verificato prima della pubblicazione;
- npm trusted publishing e provenance riferita al tag/commit atteso;
- lifecycle script disabilitati nel job publish salvo allowlist esplicita.

## Prova di assenza rete

- lint/static denylist per `fetch`, XHR, WebSocket, EventSource, WebTransport, beacon, Worker/ServiceWorker e sink URL creati dal runtime;
- E2E che registra e blocca ogni request dopo il caricamento iniziale della demo;
- enable, capture, preview, copy, undo e destroy devono produrre zero richieste;
- callback e resolver custom sono esclusi dalla garanzia perché codice privilegiato del consumer.

## Prova di esclusione production

Il gate combina:

1. stats/metafile/source-to-chunk map della build Angular;
2. divieto di entrypoint e moduli runtime `@ui-target-picker/*` in ogni initial e lazy chunk;
3. scansione di marker indipendenti su tutti gli asset emessi;
4. E2E negativo senza UI o listener;
5. mutation fixture che importa intenzionalmente il runtime e deve far fallire il controllo strutturale anche con marker rinominati.

La claim vale per la demo Angular e per i pattern di integrazione verificati, non per qualsiasi bundler esistente.

## Metriche

### Latenza tecnica

- overlay aggiornato entro 100 ms p95 dal movimento osservato;
- target presente nel pannello entro 100 ms p95 dal click;
- feedback copy entro 500 ms p95, escluso prompt permesso del browser;
- interazione puntatore con feedback visivo entro 100 ms.

### Usabilità

Scenario moderato: utente nuovo con istruzione iniziale visibile cattura un elemento e copia una sessione testuale.

Gate alpha: almeno 4 partecipanti su 5 completano senza assistenza entro 30 secondi. Il protocollo e i risultati sono allegati alla release candidate; non sostituisce i test automatici.
