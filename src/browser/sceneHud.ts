/** Credits presentation only. Scene ownership, navigation and viewer state remain supplied by the host. */
export interface SceneHudCredit {
  text: string;
  license?: string | null;
  url?: string | null;
}

export interface SceneHudState {
  status: { phase: string; credits: readonly SceneHudCredit[] } | null;
}

export interface SceneHudSource {
  subscribe(listener: (state: SceneHudState) => void): () => void;
}

export interface SceneHudHandle {
  element: HTMLElement;
  destroy(): void;
}

/**
 * The HUD bar's right end while a panorama is entered: its credit where the
 * basemap's is. The map is not drawn then, so `mapSource` (the basemap's
 * group) is hidden, and so is whatever else is in `mapOnly`, such as other
 * basemap controls. The host's picture/view readout can remain visible. There is no close
 * button: the panorama's tab and Escape are the ways out.
 */
export function createSceneHud(options: {
  controller: SceneHudSource;
  container: HTMLElement;
  /** The host supplies UI's public icon factory in this element's Document. */
  createExternalLinkIcon(document: Document): SVGSVGElement;
  mapSource?: HTMLElement | null;
  /** More of the bar that is about the map, hidden with it. */
  mapOnly?: readonly HTMLElement[];
}): SceneHudHandle {
  const { controller, container, createExternalLinkIcon } = options;
  const document = container.ownerDocument;
  function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  const mapElements = [...(options.mapSource ? [options.mapSource] : []), ...(options.mapOnly ?? [])];
  const element = el("span", "scene-hud");
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", "Panorama");
  element.hidden = true;
  const credits = el("span", "hud-chip-group scene-credits-slot");
  credits.id = "sceneCreditsSlot";
  credits.setAttribute("aria-label", "Panorama credits");
  element.append(credits);
  container.prepend(element);

  let shownCredits = "";
  const off = controller.subscribe(state => {
    const inside = state.status?.phase === "immersive";
    for (const mapElement of mapElements) mapElement.hidden = inside;
    const shown = inside ? state.status?.credits ?? [] : [];
    element.hidden = shown.length === 0;
    const key = JSON.stringify(shown);
    if (key === shownCredits) return;
    shownCredits = key;
    credits.replaceChildren(...shown.map(credit => {
      const text = credit.license ? `${credit.text} \u00b7 ${credit.license}` : credit.text;
      const label = el("span", "scene-credit-chip__text", text);
      if (!credit.url) {
        const chip = el("span", "hud-chip scene-credit-chip");
        chip.title = text;
        chip.append(label);
        return chip;
      }
      const link = el("a", "hud-chip hud-chip-button scene-credit-chip");
      link.href = credit.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.title = `Panorama: ${text}. Opens its source.`;
      link.append(label, createExternalLinkIcon(document));
      return link;
    }));
  });

  return {
    element,
    destroy() {
      off();
      for (const mapElement of mapElements) mapElement.hidden = false;
      element.remove();
    },
  };
}
