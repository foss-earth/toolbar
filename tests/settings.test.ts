import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSettingsRegistry } from "@foss-earth/ui/settings";
import { createToolbarParameters, toolbarPriorityParameterId, TOOLBAR_EDIT_PRIORITIES_ID, type ToolbarItemDescriptor } from "../src/settings.js";
import { HUD_BUTTON_VISIBILITY_MIGRATION, HUD_BUTTON_VISIBILITY_STORAGE_KEY, loadHudButtonVisibility, saveHudButtonVisibility } from "../src/hudButtonVisibility.js";
import { PERFORMANCE_HUD_VISIBILITY_MIGRATION, PERFORMANCE_HUD_VISIBILITY_STORAGE_KEY } from "../src/performance.js";
const items: ToolbarItemDescriptor[] = JSON.parse(readFileSync(new URL("../fixtures/earth-toolbar.json", import.meta.url), "utf8"));
function setup(legacy?: string) {
  const records = new Map(legacy ? [[HUD_BUTTON_VISIBILITY_STORAGE_KEY, legacy]] : []);
  const settings = createSettingsRegistry({ storage: { getItem: key => records.get(key) ?? null, setItem: (key, value) => { records.set(key, value); } } });
  settings.register(createToolbarParameters(items));
  settings.migrateLegacy([HUD_BUTTON_VISIBILITY_MIGRATION]);
  return { settings, records };
}
describe("host toolbar catalog and retained choices", () => {
  it("preserves the Earth seventeen priorities and on/auto/off defaults in Interface", () => {
    const { settings } = setup();
    expect(items.map(item => settings.get(toolbarPriorityParameterId(item.id)))).toEqual(Array.from({ length: 17 }, (_, index) => index));
    expect(settings.get("interface.performanceHud.fps")).toBe("auto");
    expect(settings.get("interface.performanceHud.memory")).toBe("off");
    expect(settings.get(TOOLBAR_EDIT_PRIORITIES_ID)).toBe(false);
    expect(settings.list().every(spec => spec.home.tab === "interface" && spec.home.section === "toolbar")).toBe(true);
    expect(loadHudButtonVisibility(settings)).toEqual({ help: "auto", renderer: "auto", inputMode: "auto", theme: "auto", settings: "auto", bugReport: "auto", fullscreen: "auto", position: "auto" });
  });
  it("migrates only old false values or named user choices, once, without deleting legacy", () => {
    const { settings, records } = setup(JSON.stringify({ help: true, theme: false, renderer: "on", inputMode: "auto" }));
    expect(settings.get("interface.toolbar.help")).toBe("auto");
    expect(settings.get("interface.toolbar.theme")).toBe("off");
    expect(settings.get("interface.toolbar.renderer")).toBe("on");
    settings.set("interface.toolbar.theme", "on");
    settings.migrateLegacy([HUD_BUTTON_VISIBILITY_MIGRATION]);
    expect(settings.get("interface.toolbar.theme")).toBe("on");
    expect(records.has(HUD_BUTTON_VISIBILITY_STORAGE_KEY)).toBe(true);
    const values = { help: "off", renderer: "on", settings: "auto", bugReport: "off", theme: "on", inputMode: "off", fullscreen: "auto", position: "auto" } as const;
    saveHudButtonVisibility(settings, values);
    expect(loadHudButtonVisibility(settings)).toEqual(values);
  });
  it("ignores malformed legacy records and rejects ambiguous host descriptors", () => {
    expect(HUD_BUTTON_VISIBILITY_MIGRATION.migrate("{invalid")).toBeNull();
    expect(HUD_BUTTON_VISIBILITY_MIGRATION.migrate("[]")).toBeNull();
    expect(() => createToolbarParameters([items[0], items[0]])).toThrow(/Duplicate/);
    expect(() => createToolbarParameters([{ ...items[0], defaultPriority: 100 }])).toThrow(/priority/);
  });
  it("preserves the performance legacy transition without treating old defaults as edits", () => {
    const { settings, records } = setup();
    records.set(PERFORMANCE_HUD_VISIBILITY_STORAGE_KEY, JSON.stringify(["frame"]));
    settings.migrateLegacy([PERFORMANCE_HUD_VISIBILITY_MIGRATION]);
    expect(settings.get("interface.performanceHud.fps")).toBe("off");
    expect(settings.get("interface.performanceHud.frame")).toBe("on");
    expect(settings.get("interface.performanceHud.memory")).toBe("off");
    expect(records.has(PERFORMANCE_HUD_VISIBILITY_STORAGE_KEY)).toBe(true);
    settings.set("interface.performanceHud.frame", "auto");
    settings.migrateLegacy([PERFORMANCE_HUD_VISIBILITY_MIGRATION]);
    expect(settings.get("interface.performanceHud.frame")).toBe("auto");
    expect(PERFORMANCE_HUD_VISIBILITY_MIGRATION.migrate('["fps","memory","culling"]')).toEqual({ "interface.performanceHud.culling": "on" });
    expect(PERFORMANCE_HUD_VISIBILITY_MIGRATION.migrate('{}')).toBeNull();
  });
});
