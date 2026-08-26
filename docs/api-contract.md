# Contratto API pubblico — MVP

> Stato: approvato nel Gate B. I type test renderanno questo documento eseguibile durante lo scaffold.

## Controller

```ts
function createUiTargetPicker(
  options?: UiTargetPickerOptions,
): UiTargetPickerController;

interface UiTargetPickerOptions {
  readonly resolver?: ComponentResolver;
  readonly shortcuts?: Partial<UiTargetPickerShortcuts>;
  readonly privacy?: Partial<PrivacyPolicy>;
  readonly maxTargets?: number;
  readonly initialFormat?: OutputFormat;
}

interface UiTargetPickerController {
  enable(): LifecycleResult;
  disable(): LifecycleResult;
  destroy(): LifecycleResult;
  getState(): Readonly<UiTargetPickerState>;
  getSession(): Readonly<UiTargetSessionV1>;
  copy(format?: OutputFormat): Promise<CopyResult>;
  subscribe(listener: StateListener): Unsubscribe;
}

type LifecycleResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: ControllerDestroyedError };

type OutputFormat = "text" | "json";
type Unsubscribe = () => void;
type StateListener = (state: Readonly<UiTargetPickerState>) => void;
type ControllerDestroyedError = {
  readonly code: "CONTROLLER_DESTROYED";
  readonly recoverable: false;
};
```

- `maxTargets` accetta interi da 1 a 20; valori fuori range rendono invalida l'inizializzazione;
- `enable`, `disable` e `destroy` sono idempotenti;
- dopo `destroy`, la sessione è vuota, i subscriber sono rimossi e il controller non può essere riattivato;
- `getState` e `getSession` restituiscono snapshot profondamente immutabili;
- `subscribe` emette soltanto stato e target già sanificati, mai candidati grezzi;
- la funzione di unsubscribe è idempotente.

## Stato

```ts
interface UiTargetPickerState {
  readonly lifecycle: "created" | "enabled" | "disabled" | "destroyed";
  readonly selectionMode: "inactive" | "temporary" | "continuous";
  readonly copyState: "idle" | "pending";
  readonly targetCount: number;
  readonly maxTargets: number;
  readonly outputFormat: OutputFormat;
  readonly lastError?: PickerError;
}

type PickerError =
  | CopyError
  | { readonly code: "TARGET_NOT_SELECTABLE"; readonly recoverable: true }
  | { readonly code: "TARGET_LIMIT_REACHED"; readonly recoverable: true }
  | { readonly code: "TARGET_TOO_LARGE"; readonly recoverable: true }
  | { readonly code: "SESSION_SIZE_LIMIT_REACHED"; readonly recoverable: true }
  | {
      readonly code: "RESOLVER_FAILED";
      readonly recoverable: true;
      readonly adapter: string;
    };
```

La perdita di focus o visibilità forza sempre `selectionMode: "inactive"`. `lastError` contiene soltanto codici e metadata sanificati.

## Copia single-flight

```ts
type CopyResult =
  | {
      readonly ok: true;
      readonly format: OutputFormat;
      readonly targetCount: number;
    }
  | {
      readonly ok: false;
      readonly error: CopyError;
    };

type CopyError =
  | { readonly code: "COPY_IN_PROGRESS"; readonly recoverable: true }
  | { readonly code: "COPY_TIMEOUT"; readonly recoverable: true }
  | { readonly code: "CLIPBOARD_DENIED"; readonly recoverable: true }
  | { readonly code: "CLIPBOARD_UNAVAILABLE"; readonly recoverable: true }
  | { readonly code: "CONTROLLER_DESTROYED"; readonly recoverable: false };
```

- è consentita una sola copia pendente;
- il comando cattura subito snapshot, formato e conteggio;
- mentre `copyState` è `pending`, il pulsante è disabilitato e una chiamata ulteriore restituisce `COPY_IN_PROGRESS`;
- un reject ripristina sempre lo stato `idle`;
- dopo 10 secondi senza esito, il controller torna `idle`, restituisce `COPY_TIMEOUT` e ignora l'eventuale completamento tardivo;
- se `destroy` avviene durante la Promise, il risultato può risolversi ma non aggiorna UI, subscriber o sessione distrutti.

## Scorciatoie

```ts
interface UiTargetPickerShortcuts {
  readonly temporarySelection: KeyboardShortcut;
  readonly continuousSelection: KeyboardShortcut;
  readonly captureFocused: KeyboardShortcut;
}

interface KeyboardShortcut {
  readonly code: string;
  readonly alt?: boolean;
  readonly ctrl?: boolean;
  readonly shift?: boolean;
  readonly meta?: boolean;
}
```

Una configurazione invalida o duplicata viene rifiutata all’inizializzazione. Le scorciatoie non operano durante IME composition o quando l’evento proviene da input, textarea, select, contenteditable o controlli equivalenti.

## Privacy policy

```ts
type PrivacyPreset = "balanced" | "strict";

interface PrivacyPolicy {
  readonly preset: PrivacyPreset;
  readonly includeSearch: boolean;
  readonly includeHash: boolean;
  readonly maxTextLength: number;
  readonly redact?: TrustedRedactor;
}

type CandidateField =
  | "location.pathname"
  | "location.search"
  | "location.hash"
  | "component.name"
  | "component.selector"
  | "component.ancestry"
  | "element.id"
  | "element.class"
  | "element.domPath"
  | "semantics.role"
  | "semantics.state"
  | "content.text"
  | "content.reference";

interface RedactionCandidate {
  readonly field: CandidateField;
  readonly value: string;
}

type RedactionDecision =
  | { readonly action: "keep" }
  | { readonly action: "omit" }
  | {
      readonly action: "replace";
      readonly value: string;
    };

type TrustedRedactor = (
  candidate: Readonly<RedactionCandidate>,
) => RedactionDecision;
```

### Trust boundary

Il redattore personalizzato è codice privilegiato e fidato del consumer. Riceve una stringa grezza alla volta e potrebbe conservarla o inviarla altrove; la garanzia “nessuna rete” riguarda esclusivamente codice e dipendenze controllati dalla libreria. Non riceve `Element`, `Window`, cookie, storage o istanze framework.

Il redattore built-in viene sempre eseguito per primo. Il custom redactor non può riabilitare valori vietati dagli invarianti assoluti.

### Matrice delle decisioni

| Campo | `omit` o errore callback | `replace` invalido |
|---|---|---|
| `location.pathname` | Usa `[redacted]`. | Usa `[redacted]`. |
| `element.id`, `element.class` | Ricostruisce la signature senza il valore. | Omette il valore. |
| `element.domPath` | Omette `domPath`. | Omette `domPath`. |
| `component.*` | Omette il valore; se manca `name`, omette l’intero componente. | Omette il valore invalido. |
| `content.*` | Omette il valore o il contenitore vuoto. | Omette il valore invalido. |
| `location.search/hash` | Omette la proprietà. | Omette il valore invalido. |
| `semantics.role` | Omette `role` o il contenitore semantico vuoto. | Omette il valore invalido. |
| `semantics.state` | Omette la coppia. | Omette la coppia invalida. |

`element.tag` non passa al custom redactor: deriva da `localName`, viene validato e costituisce il fallback strutturale minimo. `element.signature` viene ricostruito dal tag e dai soli candidati approvati.

Una callback che lancia, restituisce un valore non conforme, vuoto o oltre budget fallisce chiusa secondo la tabella e produce metadata con `reason: "custom-policy"`. Il callback non può fornire testo libero alla metadata.

### Preset

- `balanced`: pathname, componenti, signature, path, testo limitato e riferimenti ammessi dopo redazione;
- `strict`: pathname `[redacted]`, signature basata sul solo tag, niente testo/riferimenti/id/classi, componenti e geometria ammessi dopo validazione.

Query e hash richiedono opt-in esplicito anche nel preset `balanced` e mostrano un warning persistente nel pannello.

`maxTextLength` accetta soltanto interi da 0 a 80; `0` disabilita il testo. `includeSearch` e `includeHash` sono booleani. Valori configurati fuori contratto rendono invalida l'inizializzazione invece di essere corretti implicitamente.

## Resolver

```ts
interface ComponentResolver {
  readonly adapter: string;
  resolve(element: Element): ComponentResolutionResult;
}

interface ComponentResolution {
  readonly host: Element;
  readonly name: string;
  readonly selector?: string;
  readonly ancestry?: readonly string[];
}

type ComponentResolutionResult =
  | { readonly status: "resolved"; readonly value: ComponentResolution }
  | {
      readonly status: "unavailable";
      readonly reason:
        | "DEBUG_GLOBALS_MISSING"
        | "NO_COMPONENT"
        | "UNSUPPORTED_VERSION";
    };
```

Resolver e adapter custom sono codice privilegiato del consumer: ricevono un `Element` e possono accedere al DOM. Non sono supportati resolver remoti o non fidati. `adapter` deve essere un identificatore ASCII di massimo 64 caratteri. Ogni output viene validato, limitato, redatto ed escapato prima dello storage; throw, valori runtime invalidi, host detached, cross-document o non antenato producono `unavailable` e la cattura DOM continua.

Il package Angular dichiara `@angular/core: ^22.0.0` come peer dependency per l’MVP. Versioni diverse non sono dichiarate supportate finché non entrano nella matrice verificata.

## Test del contratto

- snapshot dei tipi pubblici esportati;
- exhaustiveness check di tutte le union;
- configurazioni scorciatoie e privacy valide/invalide;
- callback keep/omit/replace/throw/output invalido;
- resolver resolved/unavailable/throw/output ostile;
- snapshot immutabili;
- single-flight, timeout, esito tardivo e destroy durante copy;
- consumer ESM installato dai tarball, senza path mapping.
