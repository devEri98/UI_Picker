# Uso della libreria

> Stato: **fatto**. Documenta l’API realmente implementata nei package `core` e `browser`. Overlay, pannello, clipboard e adapter Angular non sono ancora implementati.

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
| Overlay, selezione puntatore e scorciatoie | `browser` | Da fare |
| Pannello accessibile e clipboard | `browser` | Da fare |
| Adapter Angular | `angular` | Da fare |

## Esempio minimo

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

`createTargetExtractor` valida la configurazione una sola volta: un valore fuori contratto lancia `InvalidConfigurationError` invece di essere corretto in silenzio.

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
