# UI Target Picker

UI Target Picker è una libreria TypeScript development-only che trasforma la selezione visuale di un elemento web in un riferimento tecnico strutturato e condivisibile.

Lo scopo è ridurre l’ambiguità di richieste come “modifica il riquadro in basso”: l’utente indica direttamente l’elemento e ottiene contesto utile per una chat AI, una issue o una conversazione tecnica.

> Stato: **core ed estrazione DOM implementati**. I package restano privati: non c’è ancora una versione pubblicata su npm, né overlay, pannello o adapter Angular.

## Decisioni approvate

- Utenti principali: sviluppatori, QA, designer e product owner.
- Uso principale: selezionare elementi in sviluppo o staging controllato e condividere il risultato con AI o collaboratori tecnici.
- Architettura: core TypeScript indipendente dal framework, componente browser e primo adapter Angular.
- Distribuzione iniziale: pacchetti npm installati come dipendenze di sviluppo.
- Privacy: nessuna rete o telemetria, sessione in memoria, esclusione dei valori dei campi sensibili e redazione configurabile.
- Produzione: attivazione esplicita e controllo automatico che il picker non sia incluso nella build production della demo.
- Formati MVP: testo umano e JSON versionato.
- Browser supportati inizialmente: Chrome ed Edge Stable su Windows 11; Firefox, Safari e altri sistemi operativi restano sperimentali fino alla verifica reale.
- Licenza prevista: MIT.

## Cosa funziona oggi

```ts
import { createTargetExtractor } from "@ui-target-picker/browser";
import { createSessionStore, formatSession } from "@ui-target-picker/core";

const extractor = createTargetExtractor({ privacy: { preset: "balanced" } });
const session = createSessionStore();

const result = extractor.extract(document.querySelector("button")!);
if (result.ok) {
  session.add(result.value);
}

const output = formatSession(session.getSession(), "text");
```

```text
[UI-TARGET 1]
catturato:    10:24:31 UTC
rotta:        /orders/import
elemento:     button.rail__groupheader
percorso DOM: [data-testid="group"] > [data-testid="group-toggle"]
ruolo:        button
stato:        type="button", aria-expanded="false"
testo:        "Brand non riconosciuto"
riferimenti:  data-testid="group-toggle"
box:          353x54 px @ x:413, y:588 - viewport 1920x945
```

Implementato: schema `UiTarget` v1, normalizzazione, policy privacy `balanced`/`strict`, redattore personalizzato, session store con limiti e undo, formatter testo e JSON deterministici, estrazione DOM con boundary sensibili e contratto del resolver di componente.

Da fare: overlay e selezione con puntatore e tastiera, pannello accessibile, clipboard, adapter Angular, demo e gate della build production.

Dettagli in [Uso della libreria](docs/usage.md).

## Sviluppo

```bash
pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## MVP

L’MVP comprenderà:

- evidenziazione e selezione di elementi DOM;
- raccolta ordinata di più target;
- estrazione deterministica di contesto tecnico non sensibile;
- output testuale e JSON con schema versionato;
- sessione in memoria con limite configurabile;
- scorciatoie configurabili;
- redazione privacy configurabile;
- pannello accessibile;
- adapter Angular;
- applicazione demo;
- test unitari, di accessibilità ed end-to-end;
- esclusione verificabile dalle build di produzione.

## Non-obiettivi dell’MVP

- adapter React, Vue o Svelte;
- estensione browser o integrazione VS Code;
- screenshot e registrazioni;
- invio automatico a chat o issue tracker;
- individuazione automatica di file sorgente e numero di riga;
- telemetria;
- persistenza remota;
- supporto production.

## Criteri di successo

L’MVP è approvabile quando:

- non legge valori di input, password o altri campi esclusi;
- non esegue richieste di rete e non include telemetria;
- non lascia firme del picker nella build production della demo;
- produce la stessa estrazione a parità di DOM, configurazione e clock e gli stessi byte a parità di modello sanificato;
- identifica correttamente i componenti Angular nei casi supportati;
- rispetta le soglie tecniche e di usabilità definite nei quality gate;
- supera typecheck, test unitari, controlli di accessibilità ed E2E sui browser supportati.

## Documentazione

- [Indice della documentazione](docs/README.md)
- [Uso della libreria](docs/usage.md)
- [Requisiti di prodotto](docs/product-requirements.md)
- [Product e UX design](docs/ux-design.md)
- [Technical design](docs/technical-design.md)
- [Schema UiTarget v1](docs/schema-v1.md)
- [Contratto API](docs/api-contract.md)
- [Specifica estrazione DOM](docs/extraction-spec.md)
- [Quality gate](docs/quality-gates.md)
- [Tracciabilità MVP](docs/traceability.md)
- [Design review e hardening](docs/reviews/hardening-2026-08-26.md)
- [Consolidamento](docs/consolidation.md)
- [Architettura iniziale](docs/architecture.md)
- [Privacy e sicurezza](docs/security-and-privacy.md)
- [Roadmap](docs/roadmap.md)
- [Riferimento storico del prototipo](docs/prototype-reference.md)

## Principio guida

UI Target Picker non sostituisce DevTools, gli inspector dei framework o i test end-to-end. Trasforma un gesto visuale in contesto tecnico condivisibile con il minor attrito possibile.

## Licenza

MIT, vedi [LICENSE](LICENSE).
