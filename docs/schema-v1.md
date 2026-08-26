# Schema `UiTarget` v1

> Stato: approvato il 26 agosto 2026 e aggiornato dai finding di hardening. Questo documento definisce il contratto macchina dell’MVP; il file JSON Schema eseguibile verrà creato insieme al package `core`.

## Obiettivi

- struttura piccola e leggibile;
- valori già sanificati prima della memorizzazione;
- ordine stabile;
- distinzione tra dato assente e stringa vuota;
- nessun identificatore casuale necessario;
- evoluzione esplicita tramite `schemaVersion`.

## Sessione

```ts
interface UiTargetSessionV1 {
  readonly schema: "ui-target-picker/session";
  readonly schemaVersion: 1;
  readonly targets: readonly UiTargetV1[];
}
```

Il totale è derivato da `targets.length` e non viene duplicato nel JSON. La posizione nell’array determina la numerazione usata dal formatter umano.

## Target

```ts
interface UiTargetV1 {
  readonly capturedAt: string;
  readonly location: UiLocationV1;
  readonly component?: UiComponentV1;
  readonly element: UiElementV1;
  readonly semantics?: UiSemanticsV1;
  readonly content?: UiContentV1;
  readonly geometry?: UiGeometryV1;
  readonly redactions?: readonly UiRedactionV1[];
}
```

`capturedAt` è un timestamp ISO 8601 UTC prodotto da un clock iniettabile nei test. Il target non contiene ID casuali: ordine e contenuto sono sufficienti per l’MVP.

## Posizione applicativa

```ts
interface UiLocationV1 {
  readonly pathname: string;
  readonly search?: string;
  readonly hash?: string;
}
```

`pathname` è incluso per default. `search` e `hash` sono opt-in e passano sempre dalla redazione.

## Componente

```ts
interface UiComponentV1 {
  readonly adapter: string;
  readonly name: string;
  readonly selector?: string;
  readonly ancestry?: readonly string[];
}
```

`ancestry`, quando presente, è ordinato dal componente più esterno al più interno e termina con `name`. Nessun riferimento a istanze o nodi DOM viene serializzato.

## Elemento

```ts
interface UiElementV1 {
  readonly tag: string;
  readonly signature: string;
  readonly domPath?: string;
}
```

- `tag` è minuscolo;
- `signature` combina tag, ID e classi significative secondo configurazione;
- `domPath` è relativo all’host restituito dal resolver più interno, altrimenti alla radice documentale consentita;
- `domPath` è diagnostico e non promette stabilità come selettore di test.

## Semantica

```ts
interface UiSemanticsV1 {
  readonly role?: string;
  readonly states?: readonly UiNameValueV1[];
}

interface UiNameValueV1 {
  readonly name: string;
  readonly value: string | boolean;
}
```

Gli stati usano un array ordinato invece di un oggetto arbitrario. Allowlist iniziale:

- `type`;
- `name`;
- `disabled`;
- `required`;
- `readonly`;
- `aria-checked`;
- `aria-expanded`;
- `aria-pressed`;
- `aria-selected`.

Il valore corrente del controllo non viene mai incluso.

## Contenuto

```ts
interface UiContentV1 {
  readonly text?: string;
  readonly references?: readonly UiNameValueV1[];
  readonly textTruncated?: true;
}
```

`text` viene normalizzato prima della memorizzazione. `textTruncated` viene emesso soltanto quando il limite ha realmente ridotto il testo. Allowlist iniziale dei riferimenti:

- `aria-label`;
- `title`;
- `placeholder`;
- `data-testid`.

## Geometria

```ts
interface UiGeometryV1 {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly scrollX?: number;
  readonly scrollY?: number;
}
```

I numeri sono pixel CSS arrotondati all’intero più vicino. `scrollX` e `scrollY` vengono omessi quando valgono zero.

## Redazioni

```ts
interface UiRedactionV1 {
  // CandidateField è esportato dal contratto API pubblico.
  readonly field: CandidateField;
  readonly action: "omitted" | "replaced" | "truncated";
  readonly reason:
    | "default-policy"
    | "sensitive-element"
    | "custom-policy"
    | "length-limit";
}
```

`field` è il percorso logico canonico definito nel contratto API e può riferirsi anche a una proprietà omessa dal JSON. Non è un JSON Pointer. La metadata indica che una trasformazione è avvenuta senza conservare il valore originale. Le redazioni sono ordinate per `field` e poi per `action`.

## Esempio JSON

```json
{
  "schema": "ui-target-picker/session",
  "schemaVersion": 1,
  "targets": [
    {
      "capturedAt": "2026-08-26T10:24:31.000Z",
      "location": {
        "pathname": "/orders/import"
      },
      "component": {
        "adapter": "angular",
        "name": "ImportProblems",
        "selector": "app-import-problems",
        "ancestry": ["App", "Shell", "ImportPage", "ImportProblems"]
      },
      "element": {
        "tag": "button",
        "signature": "button.rail__groupheader",
        "domPath": "[data-testid=\"group\"] > [data-testid=\"group-toggle\"]"
      },
      "semantics": {
        "role": "button",
        "states": [
          { "name": "type", "value": "button" },
          { "name": "aria-expanded", "value": "false" }
        ]
      },
      "content": {
        "text": "Brand non riconosciuto",
        "references": [
          { "name": "data-testid", "value": "group-toggle" }
        ]
      },
      "geometry": {
        "x": 413,
        "y": 588,
        "width": 353,
        "height": 54,
        "viewportWidth": 1920,
        "viewportHeight": 945
      },
      "redactions": [
        {
          "field": "location.search",
          "action": "omitted",
          "reason": "default-policy"
        }
      ]
    }
  ]
}
```

## Regole deterministiche

- proprietà serializzate nell’ordine definito dallo schema;
- target nell’ordine di cattura;
- `states` e `references` secondo allowlist, non secondo ordine DOM;
- `redactions` ordinate per `field` e `action`;
- spazi interni del testo collassati;
- stringhe normalizzate in Unicode NFC;
- campi opzionali senza valore omessi;
- nessun `undefined`, `NaN`, `Infinity` o stringa vuota;
- newline JSON `LF` e indentazione di due spazi;
- formatter text indipendente dalla locale del sistema;
- clock iniettabile per test riproducibili.

ID, classi, attributi e segmenti del percorso vengono sottoposti a escaping deterministico prima della composizione. I selettori usano `CSS.escape` dove applicabile e una funzione dedicata per i valori degli attributi; virgolette, backslash e caratteri di controllo sono coperti da test. Algoritmi e budget sono normativi in [`extraction-spec.md`](extraction-spec.md).

“Deterministico” significa che lo stesso modello sanificato produce gli stessi byte. A parità di DOM, configurazione, resolver e clock l’estrazione è stabile. La cattura reale include intenzionalmente `capturedAt`, quindi due eventi con clock diverso restano distinti.

## Evoluzione

- `schemaVersion` cambia quando cambia la forma del contratto;
- il consumer deve rifiutare versioni non comprese con errore esplicito;
- il package segue SemVer, ma versione package e versione schema sono indipendenti;
- lo schema v1 usa proprietà chiuse: nuovi campi richiedono una nuova schema version;
- migrazioni future producono un nuovo oggetto e non mutano l’input.
