import type { SettingsRegistry } from "@foss-earth/ui/settings";
import type { ParameterSectionOptions, ParameterSectionHandle } from "@foss-earth/ui/browser";

export type ToolbarParameterSectionFactory = (settings: SettingsRegistry, options: ParameterSectionOptions) => ParameterSectionHandle;
export interface ToolbarInterfaceOptions {
  /** Supply @foss-earth/ui/browser's factory; this optional entry initializes no UI singleton. */
  createParameterSection: ToolbarParameterSectionFactory;
  /** The host's existing readings pulse; sections create no timer of their own. */
  refresh: ParameterSectionOptions["refresh"];
  /** The host Document used by this section and the supplied UI factory. */
  document: Document;
  /** Host-owned theme control or other first controls, if present. */
  main?: HTMLElement;
  covers?: readonly string[];
  panelStorage?: ParameterSectionOptions["panelStorage"];
}
/** Interface → Toolbar; theme/feature controls and the containing tab remain host-owned. */
export function createToolbarInterfaceSection(settings: SettingsRegistry, options: ToolbarInterfaceOptions): ParameterSectionHandle {
  requireHostPorts(options);
  return options.createParameterSection(settings, { tab: "interface", section: "toolbar", main: options.main, covers: options.covers, panelStorage: options.panelStorage, refresh: options.refresh, document: options.document });
}
export function createPositionInterfaceSection(settings: SettingsRegistry, options: ToolbarInterfaceOptions): ParameterSectionHandle {
  requireHostPorts(options);
  return options.createParameterSection(settings, { tab: "interface", section: "position", main: options.main, covers: options.covers, panelStorage: options.panelStorage, refresh: options.refresh, document: options.document });
}

function requireHostPorts(options: ToolbarInterfaceOptions): void {
  if (!options.refresh || typeof options.refresh.subscribe !== "function") throw new TypeError("Toolbar Interface sections require the host refresh port.");
  if (!options.document || typeof options.document.createElement !== "function") throw new TypeError("Toolbar Interface sections require the host Document.");
}
