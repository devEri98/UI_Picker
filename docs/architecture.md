# Architettura iniziale

> Stato: sintesi consolidata. I contratti normativi sono in [`technical-design.md`](technical-design.md), [`api-contract.md`](api-contract.md), [`extraction-spec.md`](extraction-spec.md), [`schema-v1.md`](schema-v1.md), [`quality-gates.md`](quality-gates.md) e negli ADR.

## Principi

- soluzione più semplice compatibile con correttezza ed evoluzione;
- dipendenze orientate verso il core;
- integrazioni framework isolate dietro contratti piccoli;
- comportamento development-only fail-safe;
- output e schema versionati;
- nessuna rete nel runtime predefinito;
- dipendenze runtime ridotte e giustificate.

## Confini proposti

```text
packages/
  core/       modello, redazione, sessione, schema e formatter
  browser/    estrazione DOM, overlay, eventi, pannello, clipboard e lifecycle
  angular/    resolver Angular e integrazione development-only
examples/
  angular-demo/
docs/
```

## Dipendenze

```mermaid
flowchart LR
    A[angular adapter] --> B[browser]
    B --> C[core]
    D[angular demo] --> A
    D --> B
```

`core` non deve conoscere DOM, globali browser, Angular, clipboard o pannello. `browser` usa contratti del core e riceve un resolver. L’adapter Angular implementa quel contratto senza spostare logica framework-specifica negli altri package.

## Contratto del resolver

```ts
interface ComponentResolver {
  resolve(element: Element): ComponentResolutionResult;
}
```

Il contratto completo, i risultati `resolved`/`unavailable`, i limiti e il trust boundary sono definiti in [`api-contract.md`](api-contract.md). L'adapter Angular dichiara `@angular/core: ^22.0.0` come peer dependency.

## Decisioni già approvate

- TypeScript;
- core indipendente dal framework;
- componente browser separato;
- primo adapter Angular;
- pacchetti npm come distribuzione iniziale;
- formati text e JSON versionato;
- sessione in memoria;
- licenza MIT;
- Chrome ed Edge Stable su Windows 11 come matrice inizialmente supportata.

## Decisioni consolidate nel technical design

- pnpm workspace senza orchestratore aggiuntivo;
- TypeScript project references e `tsc --build`;
- ESM ES2022;
- Node 24 LTS;
- Angular 22 per la demo;
- Vitest e Playwright;
- redazione prima della sessione;
- query string e hash esclusi per default;
- boot no-op e file replacement per la demo production;
- verifica production sul grafo dei moduli con mutation fixture;
- budget byte e collezioni definiti nella specifica di estrazione.

## Decisioni ancora aperte

- controllo effettivo dello scope npm `@ui-target-picker` prima della pubblicazione;

Il pannello usa uno Shadow DOM `open`. Shadow DOM dell’applicazione ospitante e iframe non vengono attraversati nell’MVP.

Queste decisioni devono essere registrate in ADR brevi prima dell’implementazione interessata.
