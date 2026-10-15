import type { SettingsRegistry } from "@foss-earth/ui/settings";
import { MAP_SOURCE_JOIN_ID, readToolbarPreference, toolbarPriorityParameterId, toolbarSettingsIds, TOOLBAR_EDIT_PRIORITIES_ID, type ToolbarItemDescriptor } from "../settings.js";
import { fitHudBar, hudBarEndPlace, type HudBarFitItem, type HudBarLayoutPorts } from "./hudBarFit.js";
export interface ToolbarFitPorts {
  /** Forward the host's existing layout authorities to the presentation fitter. */
  layout?: HudBarLayoutPorts;
  /** Host returns its existing launcher/readout element, or null while absent. */
  getElement(id: string): HTMLElement | null;
  /** A host may update supplied readout DOM after visibility choices change. */
  onChoicesChanged?(): void;
}
/** Policy extracted from app composition; scene/context [hidden] stays host-owned. */
export function readToolbarFitItems(settings: SettingsRegistry, descriptors: readonly ToolbarItemDescriptor[], getElement: ToolbarFitPorts["getElement"]): HudBarFitItem[] {
  const custom = settings.get(TOOLBAR_EDIT_PRIORITIES_ID) === true;
  const items = descriptors.flatMap((item): HudBarFitItem[] => {
    const element = getElement(item.id); if (!element) return [];
    const priority = custom ? settings.get<number>(toolbarPriorityParameterId(item.id)) : item.defaultPriority;
    if (item.essential) return [{ element, priority, keepVisible: true, reserveSpace: true, essential: true }];
    const choice = item.visibilityId ? readToolbarPreference(settings, item.visibilityId) : { wanted: true, pinned: false };
    return choice.wanted ? [{ element, priority, keepVisible: choice.pinned }] : [];
  });
  // Same first-two reservation as the current Earth app; host ordering and
  // priorities select those controls, with hidden contexts excluded.
  const core = items.filter(item => !item.reserveSpace && !item.element.closest("[hidden]")).sort((a, b) => a.priority - b.priority);
  for (const item of core.slice(0, 2)) item.reserveSpace = true;
  return items;
}
export function bindToolbarFit(bar: HTMLElement, end: HTMLElement, settings: SettingsRegistry, descriptors: readonly ToolbarItemDescriptor[], ports: ToolbarFitPorts): { update(): void; destroy(): void } {
  const originals = new Map<HTMLElement, boolean>();
  const applyChoices = (): void => {
    for (const item of descriptors) {
      if (!item.visibilityId) continue;
      const element = ports.getElement(item.id); if (!element) continue;
      if (!originals.has(element)) originals.set(element, element.hasAttribute("data-hud-choice-hidden"));
      element.toggleAttribute("data-hud-choice-hidden", !readToolbarPreference(settings, item.visibilityId).wanted);
    }
  };
  applyChoices();
  const fit = fitHudBar(bar, end, () => readToolbarFitItems(settings, descriptors, ports.getElement), ports.layout, {
    endPlace: () => settings.has(MAP_SOURCE_JOIN_ID) ? hudBarEndPlace(settings.get(MAP_SOURCE_JOIN_ID)) : "off",
  });
  const ids = new Set<string>(toolbarSettingsIds(descriptors));
  if (settings.has(MAP_SOURCE_JOIN_ID)) ids.add(MAP_SOURCE_JOIN_ID);
  const stop = settings.subscribe(changed => {
    if (![...changed].some(id => ids.has(id))) return;
    applyChoices(); ports.onChoicesChanged?.(); fit.update();
  });
  let disposed = false;
  return {
    update() { if (disposed) return; applyChoices(); fit.update(); },
    destroy() { if (disposed) return; disposed = true; stop(); fit.destroy(); for (const [element, hidden] of originals) element.toggleAttribute("data-hud-choice-hidden", hidden); },
  };
}
