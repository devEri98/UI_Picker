# Uso della libreria

> Stato: **fatto**. Documenta l’API realmente implementata nei package `core` e `browser`. Pannello, clipboard e adapter Angular non sono ancora implementati.

## Cosa è disponibile oggi

| Capacità | Package | Stato |
|---|---|---|
| Modello `UiTargetSessionV1` e type guard | `core` | Implementato |
| Normalizzazione stringhe (NFC, whitespace, code point) | `core` | Implementato |
| Policy privacy `balanced` / `strict` e redazione custom | `core` | Implementato |
| Session store con limite, budget byte e undo singolo | `core` | Implementato |
| Formatter testo e JSON deterministici | `core` | Implementato |
| Estrazione DOM (firma, percorso, semantica, testo, geometria) | `browser` | Implementato |
| Contratto e validazione del resolver di componente | `browser` | Implementato |
| Controller con lifecycle, stato e subscriber | `browser` | Implementato |
| Overlay in Shadow DOM e selezione con puntatore | `browser` | Implementato |
| Scorciatoie configurabili e cattura da tastiera | `browser` | Implementato |
| Copia negli appunti (`copy`) | `browser` | Da fare |
| Pannello accessibile | `browser` | Da fare |
| Adapter Angular | `angular` | Da fare |

## Picker completo

```ts
import { createUiTargetPicker } from "@ui-target-picker/browser";
import { formatSession } from "@ui-target-picker/core";

const picker = createUiTargetPicker({ maxTargets: 20 });

picker.subscribe((state) => {
  console.log(state.selectionMode, `${String(state.targetCount)}/${String(state.maxTargets)}`);
  if (state.lastError !== undefined) {
    console.warn(state.lastError.code);
  }
});

picker.enable();

// Su richiesta esplicita dell'utente:
const output = formatSession(picker.getSession(), "text");

// Alla chiusura dell'ambiente di sviluppo:
picker.destroy();
```

`createUiTargetPicker` non installa nessun listener finché non chiami `enable`, e l’import del modulo non ha side effect. `enable`, `disable` e `destroy` sono idempotenti; dopo `destroy` il controller non è riattivabile, la sessione è vuota e i subscriber sono rimossi.

Il metodo `copy` previsto dal contratto API arriverà con lo slice clipboard: per ora l’output si ottiene passando `getSession()` a `formatSession`.

### Scorciatoie

| Azione | Default | Comportamento |
|---|---|---|
| Selezione temporanea | tieni premuto `Alt` | Vale finché il tasto resta premuto; la prima cattura disarma. |
| Selezione continua | `Ctrl+Shift+E` | Toggle; ogni click valido cattura. |
| Cattura elemento focalizzato | `Ctrl+Shift+Invio` | Cattura `document.activeElement` se selezionabile. |
| Esci dalla selezione | `Esc` | Non cancella la sessione. |

Le scorciatoie sono configurabili tramite `options.shortcuts`; una combinazione invalida o duplicata rende invalida l’inizializzazione. Non si attivano durante una composizione IME né quando l’evento arriva da un campo editabile.

La selezione temporanea torna sempre a `inactive` al rilascio del tasto, su `window.blur`, su documento nascosto e su `destroy`, e non viene mai riarmata automaticamente.

### Selezione e click applicativo

Durante la cattura, la sequenza `pointerdown` → `pointerup` → `click` viene soppressa in fase capture su `window`: l’azione nativa e i listener applicativi sul target non vengono eseguiti. Il limite dichiarato è che un listener capture registrato su `window` **prima** dell’abilitazione del picker non può essere annullato.

Overlay e pannello vivono in uno Shadow DOM `open` con `pointer-events: none` e non sono mai selezionabili.

## Estrazione singola

```ts
import { createTargetExtractor } from "@ui-target-picker/browser";
import { createSessionStore, formatSession } from "@ui-target-picker/core";

const extractor = createTargetExtractor({ privacy: { preset: "balanced" } });
const session = createSessionStore({ maxTargets: 20 });

function capture(element: Element): void {
  const result = extractor.extract(element);

  if (!result.ok) {
    console.warn(result.error.code); // TARGET_NOT_SELECTABLE
    return;
  }

  const added = session.add(result.value);
  if (!added.ok) {
    console.warn(added.error.code); // TARGET_LIMIT_REACHED, TARGET_TOO_LARGE, ...
  }
}

// Più tardi, su richiesta esplicita dell'utente:
const output = formatSession(session.getSession(), "text");
```

Usa l’estrattore direttamente quando ti serve la cattura senza UI. `createTargetExtractor` valida la configurazione una sola volta: un valore fuori contratto lancia `InvalidConfigurationError` invece di essere corretto in silenzio.

## Opzioni di estrazione

```ts
interface ExtractionOptions {
  privacy?: Partial<PrivacyPolicy>;
  resolver?: ComponentResolver;
  now?: () => Date;
  pickerRoot?: Node;
  excludedClassPrefixes?: readonly string[];
  sensitiveSelectors?: readonly string[];
  includeGeometry?: boolean;
}
```

- `pickerRoot` esclude l’intera UI del picker da selezione, testo e percorso;
- `sensitiveSelectors` aggiunge boundary applicativi oltre a quelli normativi;
- `now` rende la cattura riproducibile nei test;
- `excludedClassPrefixes` sostituisce l’elenco predefinito `ng-`, `cdk-`, `_ngcontent`, `_nghost`.

## Preset privacy

| | `balanced` | `strict` |
|---|---|---|
| `location.pathname` | conservato | `[redacted]` |
| `location.search` / `hash` | esclusi salvo opt-in | esclusi |
| `element.id` / `element.class` | conservati | omessi |
| `element.signature` | `tag#id.class1.class2` | solo `tag` |
| `element.domPath` | conservato | omesso |
| `content.text` | massimo 80 code point | escluso |
| `content.references` | allowlist attributi | esclusi |
| `component.*`, `semantics.*`, `geometry` | conservati dopo validazione | conservati dopo validazione |

`maxTextLength` accetta interi da 0 a 80; `0` disabilita il testo anche nel preset `balanced`.

## Redattore personalizzato

Il redattore è codice privilegiato del consumer. Riceve una stringa grezza per volta e mai un `Element`, `Window`, cookie, storage o istanza di framework.

```ts
const extractor = createTargetExtractor({
  privacy: {
    redact: (candidate) =>
      candidate.field === "content.text" && /\d{6,}/u.test(candidate.value)
        ? { action: "replace", value: "[numero]" }
        : { action: "keep" },
  },
});
```

Il redattore built-in viene sempre eseguito per primo e il custom non può riabilitare un valore che la policy ha già rimosso. Una callback che lancia, restituisce un valore non conforme, vuoto o oltre budget fallisce chiusa e produce metadata con `reason: "custom-policy"`.

## Resolver di componente

```ts
const resolver: ComponentResolver = {
  adapter: "angular",
  resolve: (element) => {
    const host = element.closest("app-import-problems");
    return host === null
      ? { status: "unavailable", reason: "NO_COMPONENT" }
      : { status: "resolved", value: { host, name: "ImportProblems" } };
  },
};
```

L’output è trattato come non fidato: un `host` scollegato, di un altro documento o non antenato del target, un nome mancante o un throw producono `RESOLVER_FAILED` fra i `warnings` e la cattura DOM prosegue senza componente. Un esito `unavailable` non è un errore e viene riportato in `resolverUnavailableReason`.

## Invarianti che la configurazione non può disattivare

- nessuna lettura di `value` o `defaultValue`;
- l’intero subtree di `input`, `textarea`, `select`, `option`, contenuti editabili, `[role="textbox"]` e `[role="searchbox"]` viene saltato anche catturando un antenato;
- nessuna richiesta di rete e nessuna telemetria;
- nessun candidato grezzo entra nella sessione, nei formatter o negli snapshot pubblici.
