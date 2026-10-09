import type { LegacyMigration, SettingsRegistry } from "@foss-earth/ui/settings";
import type { ToolbarVisibility } from "./settings.js";

/**
 * Which of the globe's toolbar buttons are shown: the `interface.toolbar.*`
 * parameters. Auto fits in one row by priority, On stays shown and may wrap,
 * and Off stays hidden. The tabs remain available under +.
 */
export type HudButtonId = "help" | "renderer" | "inputMode" | "theme" | "settings" | "bugReport" | "fullscreen" | "position";
export type HudVisibilityMode = ToolbarVisibility;
export type HudButtonVisibility = Record<HudButtonId, HudVisibilityMode>;

export const HUD_BUTTON_IDS: readonly HudButtonId[] = ["help", "renderer", "inputMode", "theme", "settings", "bugReport", "fullscreen", "position"];

/** @deprecated The record key before the settings registry; migrated into `interface.toolbar.*`. */
export const HUD_BUTTON_VISIBILITY_STORAGE_KEY = "foss-earth.hudButtons";

export function hudButtonParameterId(id: HudButtonId): string {
  return `interface.toolbar.${id}`;
}

export function loadHudButtonVisibility(settings: SettingsRegistry): HudButtonVisibility {
  return Object.fromEntries(HUD_BUTTON_IDS.map(id => [id, settings.get(hudButtonParameterId(id))])) as HudButtonVisibility;
}

export function saveHudButtonVisibility(settings: SettingsRegistry, visibility: HudButtonVisibility): void {
  settings.setMany(Object.fromEntries(HUD_BUTTON_IDS.map(id => [hudButtonParameterId(id), visibility[id]])));
}

/** Called explicitly by the host after it registers the button parameters. */
export const HUD_BUTTON_VISIBILITY_MIGRATION: LegacyMigration = {
  key: HUD_BUTTON_VISIBILITY_STORAGE_KEY,
  migrate(raw) {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return null; }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    return Object.fromEntries(HUD_BUTTON_IDS.flatMap(id => {
      const value = record[id];
      if (value === false) return [[hudButtonParameterId(id), "off"]];
      return value === "on" || value === "auto" || value === "off" ? [[hudButtonParameterId(id), value]] : [];
    }));
  },
};
