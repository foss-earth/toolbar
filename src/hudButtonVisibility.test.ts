// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { createSettingsRegistry } from "@foss-earth/ui/settings";
import { createToolbarParameters, type ToolbarItemDescriptor } from "./settings.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HUD_BUTTON_VISIBILITY_MIGRATION, HUD_BUTTON_VISIBILITY_STORAGE_KEY, loadHudButtonVisibility, saveHudButtonVisibility } from "./hudButtonVisibility.js";

// The current host registers its catalogue and opts into legacy migration explicitly.
const items: ToolbarItemDescriptor[] = JSON.parse(readFileSync(new URL("../fixtures/earth-toolbar.json", import.meta.url), "utf8"));
function createHostSettings() {
  const settings = createSettingsRegistry({ storage: localStorage });
  settings.register(createToolbarParameters(items));
  settings.migrateLegacy([HUD_BUTTON_VISIBILITY_MIGRATION]);
  return settings;
}

let values: Map<string, string>;

beforeEach(() => {
  values = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("toolbar button visibility", () => {
  it("shows every button on a first visit", () => {
    expect(loadHudButtonVisibility(createHostSettings())).toEqual({ help: "auto", renderer: "auto", settings: "auto", bugReport: "auto", theme: "auto", inputMode: "auto", fullscreen: "auto", position: "auto" });
  });

  it("keeps a hidden button hidden, and shows one it has never heard of", () => {
    values.set(HUD_BUTTON_VISIBILITY_STORAGE_KEY, JSON.stringify({ theme: false }));
    expect(loadHudButtonVisibility(createHostSettings())).toEqual({ help: "auto", renderer: "auto", settings: "auto", bugReport: "auto", theme: "off", inputMode: "auto", fullscreen: "auto", position: "auto" });
  });

  it("round-trips a choice", () => {
    saveHudButtonVisibility(createHostSettings(), { help: "off", renderer: "on", settings: "auto", bugReport: "off", theme: "on", inputMode: "off", fullscreen: "auto", position: "auto" });
    expect(loadHudButtonVisibility(createHostSettings())).toEqual({ help: "off", renderer: "on", settings: "auto", bugReport: "off", theme: "on", inputMode: "off", fullscreen: "auto", position: "auto" });
  });

  it("shows everything rather than throwing on unreadable storage", () => {
    values.set(HUD_BUTTON_VISIBILITY_STORAGE_KEY, "{not json");
    expect(loadHudButtonVisibility(createHostSettings()).help).toBe("auto");
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("private browsing"); },
      setItem: () => { throw new Error("private browsing"); },
    });
    expect(loadHudButtonVisibility(createHostSettings()).settings).toBe("auto");
    expect(() => saveHudButtonVisibility(createHostSettings(), { help: "off", renderer: "off", settings: "off", bugReport: "off", theme: "off", inputMode: "off", fullscreen: "auto", position: "off" })).not.toThrow();
  });
});
