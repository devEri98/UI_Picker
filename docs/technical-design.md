# Technical design — MVP

> Stato: approvato il 26 agosto 2026 e aggiornato dai finding di hardening. Le versioni citate dovranno essere ricontrollate prima dello scaffold.

## Fonti della baseline

- [Node.js release status](https://nodejs.org/en/about/previous-releases)
- [Compatibilità Angular, Node.js e TypeScript](https://angular.dev/reference/versions)
- [Release e supporto Angular](https://angular.dev/reference/releases)
- [pnpm workspaces](https://pnpm.io/workspaces)
- [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [Angular debug global `getComponent`](https://angular.dev/api/core/globals/getComponent)
- [Browser Playwright](https://playwright.dev/docs/browsers)
- [Impostazioni di sicurezza pnpm](https://pnpm.io/settings)
- [GitHub dependency review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)

## Baseline della toolchain

| Area | Decisione |
|---|---|
| Runtime di sviluppo | Node.js 24 LTS, minimo `24.15.0`. |
| Package manager | pnpm 11.24.0 tramite Corepack, versione fissata nel repository. |
| Workspace | pnpm workspace con protocollo `workspace:` e lockfile condiviso. |
| Linguaggio | TypeScript 6.0.3 in strict mode. |
| Output librerie | ESM, ES2022, dichiarazioni TypeScript e source map. |
| Build librerie | `tsc --build` con project references, `NodeNext` ed estensioni `.js` esplicite negli import relativi; nessun bundler aggiuntivo nell’MVP. |
| Demo | Angular 22, applicazione standalone. |
| Unit e integration test | Vitest 4.1.11 con jsdom 30.0.1. |
| E2E | Playwright su Google Chrome e Microsoft Edge stable. |
| Lint | ESLint flat config con typescript-eslint. |
| Formattazione | Prettier, separato dal lint. |
| CI | GitHub Actions con installazione frozen, typecheck, lint, test, build, E2E e pack verification. |

Node 24 è scelto perché è LTS e soddisfa la baseline di Angular 22. Node 26 è ancora Current e non viene usato come runtime principale. La baseline è stata riverificata il 26 agosto 2026 sulle fonti ufficiali. Il computer locale usa Node `24.19.0`, installato nella directory utente e conforme ai requisiti di Angular 22.

## Struttura del workspace

```text
packages/
  core/
    src/
    package.json
    tsconfig.json
  browser/
    src/
    package.json
    tsconfig.json
  angular/
    src/
    package.json
    tsconfig.json
examples/
  angular-demo/
docs/
  adr/
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig.base.json
tsconfig.json
```

Nomi npm provvisori:

- `@ui-target-picker/core`;
- `@ui-target-picker/browser`;
- `@ui-target-picker/angular`.

Lo scope deve essere verificato e controllato prima della prima pubblicazione. I package restano privati fino alla release alpha.

## Responsabilità dei package

### `core`

Non dipende dal DOM, da Angular o da globali browser. Contiene:

- modello `UiTargetSessionV1`;
- schema JSON v1;
- normalizzazione di stringhe già raccolte;
- contratti di redazione;
- session store in memoria;
- formatter text e JSON;
- errori e result type pubblici.

### `browser`

Dipende da `core` e contiene:

- lettura controllata del DOM;
- firma e percorso dell’elemento;
- ruolo e stato semantico;
- overlay;
- gestione di puntatore e tastiera;
- controller della sessione;
- pannello;
- clipboard;
- persistenza esclusiva della posizione del pannello;
- lifecycle e disposer.

### `angular`

Dipende dai contratti di `browser` e fornisce:

- feature detection delle Angular debug globals;
- risoluzione del componente e dell’owning component;
- risalita della gerarchia degli host;
- fallback configurabile sui selettori custom element;
- helper di integrazione development-only per Angular.

L’adapter non legge proprietà di dominio o stato interno dell’istanza. L’istanza restituita dalle debug globals viene usata soltanto per ricavare un nome normalizzato del costruttore.

## Regola delle dipendenze

```mermaid
flowchart LR
    A[angular] --> B[browser]
    B --> C[core]
    D[angular-demo] --> A
    D --> B
```

- nessun ciclo tra workspace package;
- dipendenze locali dichiarate con `workspace:`;
- nessun deep import tra package;
- API pubblica esposta soltanto dagli entrypoint dichiarati in `exports`;
- ogni package dichiara `type: module` e `sideEffects: false`;
- nessun codice si avvia al top level dell’import.
- gli import relativi sorgente usano estensioni `.js`, così l’ESM emesso funziona anche senza un bundler;
- i tre package condividono la stessa versione durante l’alpha e vengono rilasciati insieme.

## API browser

Il contratto normativo è in [`api-contract.md`](api-contract.md). Definisce controller, stato, lifecycle, subscriber, copy single-flight, scorciatoie, privacy policy, trust boundary e resolver.

`createUiTargetPicker` non installa listener finché non viene chiamato `enable`. Dopo `destroy`, il controller non può essere riattivato e non emette feedback tardivi.

## Contratto del resolver

Resolver e adapter custom sono codice privilegiato del consumer perché ricevono un `Element`. Ogni output viene considerato non fidato, validato, limitato e redatto. `host` deve essere connected, nello stesso document e antenato del target; non viene serializzato. Errori o risultati invalidi omettono il componente senza impedire la cattura DOM.

L’adapter MVP dichiara `@angular/core: ^22.0.0` come peer dependency e restituisce motivi `unavailable` tipizzati.

## Pipeline dei dati

```mermaid
flowchart LR
    A[DOM e resolver] --> B[Candidati grezzi effimeri]
    B --> C[Allowlist]
    C --> D[Redazione]
    D --> E[Normalizzazione e limiti]
    E --> F[UiTargetV1 sanificato]
    F --> G[Sessione in memoria]
    G --> H[Anteprima]
    H --> I[Formatter text o JSON]
    I --> J[Clipboard esplicita]
```

I candidati grezzi non entrano mai nella sessione, undo, log, subscriber o eventi pubblici. La sola eccezione è il custom redactor privilegiato, che riceve una stringa grezza alla volta secondo il contratto dichiarato. La sessione conserva esclusivamente il modello già sanificato.

## Default privacy

- preset predefinito: `balanced`; preset `strict` sostituisce pathname, id e classi e disabilita testo e riferimenti;
- rotta: solo `pathname`;
- query string e hash: esclusi, opt-in con redazione obbligatoria;
- testo visibile: raccolto soltanto da nodi Text ammessi, normalizzato e limitato; l’intero subtree di input, textarea, select/option, contenteditable e controlli equivalenti viene saltato anche catturando un antenato;
- attributi: allowlist `aria-label`, `title`, `placeholder`, `data-testid`;
- valori dei controlli: sempre esclusi e non riattivabili tramite configurazione generica;
- HTML, cookie, storage dell’app ospitante, rete e stato framework: esclusi; è ammesso soltanto uno store namespaced opzionale per versione e coordinate del pannello;
- geometria: arrotondata a interi;
- callback di redazione applicata a ogni stringa candidata, incluso `pathname`, prima della memorizzazione.

Le opzioni non possono disabilitare gli invarianti assoluti, come la proibizione di leggere password o valori correnti dei controlli.

Il preset `balanced` conserva il rischio residuo che qualsiasi stringa DOM o resolver ammessa—pathname, id, classi, attributi, testo o nomi componente—contenga dati personali. Il rischio è ridotto da ambienti controllati, budget, redazione, anteprima e copia esplicita; viene dichiarato nella checklist di release. Il preset `strict` è richiesto per staging con dati realistici non sintetici.

La callback personalizzata è codice trusted del consumer: riceve un candidato grezzo alla volta e può teoricamente conservarlo o inviarlo. Non riceve `Element`, `Window`, storage, cookie o istanze framework. La garanzia “nessuna rete” copre soltanto il codice controllato dalla libreria.

Algoritmi, boundary e budget normativi sono definiti in [`extraction-spec.md`](extraction-spec.md).

## Strategia development-only

Il package non promette che una condizione runtime rimuova il codice dalla build. La strategia usa più livelli:

1. nessun side effect all’import;
2. inizializzazione esplicita;
3. entrypoint no-op disponibile come default sicuro;
4. demo Angular con file replacement: no-op di default e boot reale soltanto nelle configurazioni consentite;
5. import dinamico del runtime reale nel boot development;
6. controllo strutturale di stats/metafile che vieta entrypoint e moduli runtime in ogni chunk initial o lazy;
7. scansione complementare di marker su tutti gli asset;
8. test E2E che dimostra l’assenza di UI e listener in production;
9. mutation fixture che importa intenzionalmente il runtime e deve far fallire il gate strutturale.

Le guide per i consumer devono dichiarare che un semplice `if (production)` runtime non costituisce prova di esclusione dal bundle.

## Sessione e concorrenza

- la sessione è ordinata e limitata;
- ogni cattura produce un target immutabile;
- tutte le mutazioni passano da un reducer sincrono con azioni tipizzate;
- rimozione e clear creano un singolo snapshot di undo, valido fino alla successiva mutazione della sessione o a `destroy`;
- la copia è single-flight: mentre una Promise è pendente il comando è disabilitato e richieste ulteriori ricevono `COPY_IN_PROGRESS`;
- dopo 10 secondi senza esito la copia torna `idle` con `COPY_TIMEOUT`; un esito tardivo viene ignorato;
- ogni comando copy cattura immediatamente lo snapshot sanificato e il conteggio a cui si riferisce;
- cambiare formato non modifica i target;
- la navigazione SPA non azzera la sessione;
- refresh, `destroy` e chiusura scheda la eliminano;
- posizione pannello e sessione usano store separati; lo store posizione contiene soltanto versione e coordinate namespaced.

## Error handling

Gli errori pubblici sono discriminated union, non stringhe arbitrarie:

```ts
type PickerError =
  | { code: "CLIPBOARD_DENIED"; recoverable: true }
  | { code: "CLIPBOARD_UNAVAILABLE"; recoverable: true }
  | { code: "TARGET_NOT_SELECTABLE"; recoverable: true }
  | { code: "TARGET_LIMIT_REACHED"; recoverable: true }
  | { code: "TARGET_TOO_LARGE"; recoverable: true }
  | { code: "SESSION_SIZE_LIMIT_REACHED"; recoverable: true }
  | { code: "COPY_IN_PROGRESS"; recoverable: true }
  | { code: "COPY_TIMEOUT"; recoverable: true }
  | { code: "RESOLVER_FAILED"; recoverable: true; adapter: string }
  | { code: "CONTROLLER_DESTROYED"; recoverable: false };
```

Il messaggio utente viene risolto dal layer browser, mantenendo il core indipendente dalla lingua.

## Strategia di test

### Core

- schema e type guard;
- normalizzazione;
- redazione;
- session store e limite;
- undo;
- formatter deterministici;
- omissione dei campi opzionali.

### Browser

- estrazione normativa con subtree sensibili annidati e canary;
- firma, percorso e semantica;
- esclusione valori sensibili;
- lifecycle idempotente;
- stato delle scorciatoie;
- copy single-flight, timeout, esito tardivo, reject e destroy durante Promise pendente;
- pannello e focus.

### Angular adapter

- debug globals disponibili, assenti e fallite;
- `getComponent` e `getOwningComponent`;
- normalizzazione dei nomi;
- gerarchia degli host;
- fallback selector configurabile;
- nessuna lettura delle proprietà dell’istanza.

### E2E

- cattura singola, continua e da tastiera;
- esclusione del click applicativo;
- sessione, limite, rimozione, clear e undo;
- copia text e JSON;
- clipboard negata;
- accessibilità e focus;
- navigazione SPA e refresh;
- build development e production;
- Chrome e Edge stable reali, non soltanto Chromium generico.

## Pipeline CI

Required checks, ambienti, artifact, matrice browser, accessibilità, metriche e release sono definiti in [`quality-gates.md`](quality-gates.md). Il pack smoke test installa i tarball in un consumer temporaneo senza path mapping.

## Supply chain e pubblicazione

- lockfile obbligatorio e installazione frozen in CI;
- `minimumReleaseAge` pnpm iniziale di 1440 minuti, con eccezioni motivate e versionate;
- script di installazione consentiti tramite allowlist, senza autorizzazione globale;
- dependency review sulle pull request con soglia `moderate`;
- azioni GitHub fissate a commit e aggiornate tramite Dependabot;
- package packati e verificati prima della pubblicazione;
- build e test in job senza OIDC; tarball trasferito con digest SHA-256;
- job publish separato con `id-token: write`, senza checkout o action superflue;
- pubblicazione tramite npm trusted publishing, senza token persistente e con provenance automatica;
- branch e release environment protetti prima della prima alpha pubblica.

## Criteri del gate tecnico

- schema v1 approvato;
- confini e dipendenze dei package approvati;
- default privacy approvati;
- strategia development-only verificabile;
- test strategy tracciabile ai requisiti;
- nessuna decisione tecnica critica ancora implicita;
- prerequisito Node aggiornato prima dello scaffold.
