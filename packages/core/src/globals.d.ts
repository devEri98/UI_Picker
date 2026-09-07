// `core` must not depend on the DOM or on Node.js typings. `TextEncoder` is a
// WHATWG global available in every supported runtime, so it is declared here
// with the minimal surface this package uses instead of pulling in `lib.dom` or
// `@types/node`.
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
