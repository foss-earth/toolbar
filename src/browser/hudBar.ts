export interface HudBarButtonItem {
  kind: "button";
  id: string;
  title: string;
  ariaLabel: string;
  /** For a readout that is also a button, such as the position that toggles Location. */
  ariaLive?: "off" | "polite" | "assertive";
  appearance?: "circle" | "chip";
  className?: string;
  text?: string;
  content?: () => Node;
}

export interface HudBarSlotItem {
  kind: "slot";
  id: string;
  className?: string;
  ariaLabel?: string;
  ariaLive?: "off" | "polite" | "assertive";
  title?: string;
}

export type HudBarItem = HudBarButtonItem | HudBarSlotItem;

export interface HudBarOptions {
  /** Defaults to the supplied container's Document; no ambient DOM allocation. */
  document?: Document;
  /** The host may reuse its existing height observation authority. */
  observeHeight?(element: HTMLElement, changed: () => void): () => void;
  items: readonly HudBarItem[];
  className?: string;
  ariaLabel?: string;
}

export interface HudBarHandle {
  element: HTMLElement;
  getElement<T extends HTMLElement = HTMLElement>(id: string): T | null;
  destroy(): void;
}

function applyClassNames(element: HTMLElement, ...classNames: Array<string | undefined>): void {
  element.className = classNames.filter(Boolean).join(" ");
}

function createButton(item: HudBarButtonItem, document: Document): HTMLButtonElement {
  const button = document.createElement("button");
  button.id = item.id;
  button.type = "button";
  button.title = item.title;
  button.setAttribute("aria-label", item.ariaLabel);
  if (item.ariaLive) button.setAttribute("aria-live", item.ariaLive);
  applyClassNames(button, item.appearance === "chip" ? "hud-chip" : "hud-circle-button", item.className);
  if (item.content) {
    button.append(item.content());
  } else {
    button.textContent = item.text ?? "";
  }
  return button;
}

function createSlot(item: HudBarSlotItem, document: Document): HTMLElement {
  const slot = document.createElement("span");
  slot.id = item.id;
  applyClassNames(slot, item.className);
  if (item.ariaLabel) slot.setAttribute("aria-label", item.ariaLabel);
  if (item.ariaLive) slot.setAttribute("aria-live", item.ariaLive);
  if (item.title) slot.title = item.title;
  return slot;
}

/**
 * Set on the root while a HUD bar is mounted: the bar's height, which grows as
 * it wraps on a narrow screen. Hosts lift anything anchored above the bar by it.
 */
export const HUD_BAR_HEIGHT_PROPERTY = "--foss-hud-bar-height";

export function createHudBar(container: HTMLElement, options: HudBarOptions): HudBarHandle {
  const document = options.document ?? container.ownerDocument;
  const element = document.createElement("div");
  const elementsById = new Map<string, HTMLElement>();
  applyClassNames(element, "hud-bar", options.className);
  element.setAttribute("aria-label", options.ariaLabel ?? "Application controls");

  for (const item of options.items) {
    const itemElement = item.kind === "button"
      ? createButton(item, document)
      : createSlot(item, document);
    element.append(itemElement);
    for (const identifiedElement of [itemElement, ...itemElement.querySelectorAll<HTMLElement>("[id]")]) {
      elementsById.set(identifiedElement.id, identifiedElement);
    }
  }

  container.replaceChildren(element);
  const root = document.documentElement;
  const publishHeight = (): void => {
    root.style.setProperty(HUD_BAR_HEIGHT_PROPERTY, `${Math.ceil(element.getBoundingClientRect().height)}px`);
  };
  const Resize = (document.defaultView as (Window & typeof globalThis) | null)?.ResizeObserver;
  const stopHeight = options.observeHeight ? options.observeHeight(element, publishHeight) : (() => {
    const observer = typeof Resize === "undefined" ? null : new Resize(publishHeight);
    observer?.observe(element);
    return () => observer?.disconnect();
  })();
  publishHeight();

  return {
    element,
    getElement<T extends HTMLElement = HTMLElement>(id: string): T | null {
      return (elementsById.get(id) as T | undefined) ?? null;
    },
    destroy(): void {
      stopHeight();
      root.style.removeProperty(HUD_BAR_HEIGHT_PROPERTY);
      element.remove();
    },
  };
}
