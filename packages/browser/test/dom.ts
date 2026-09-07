/** Replace the document body and return a query helper bound to it. */
export function mount(html: string): (selector: string) => Element {
  document.body.innerHTML = html;
  return (selector: string): Element => {
    const element = document.body.querySelector(selector);
    if (element === null) {
      throw new Error(`No element matches ${selector}`);
    }
    return element;
  };
}

export const FIXED_CLOCK = (): Date => new Date("2026-08-26T10:24:31.000Z");
