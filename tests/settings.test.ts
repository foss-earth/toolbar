import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSettingsRegistry } from "@foss-earth/ui/settings";
import { createToolbarParameters, toolbarPriorityParameterId, TOOLBAR_EDIT_PRIORITIES_ID, MAP_SOURCE_HUD_LAYOUT_ID, MAP_SOURCE_HUD_LAYOUT_PARAMETERS, MAP_SOURCE_JOIN_ID, TOOLBAR_ACTIVITY_OUTLINE_ID, TOOLBAR_ACTIVITY_OUTLINE_PARAMETERS, TOOLBAR_BOTTOM_CLEARANCE_ID, TOOLBAR_BOTTOM_CLEARANCE_PARAMETERS, type ToolbarItemDescriptor } from "../src/settings.js";
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
  it("draws each visibility row with its segments before its label", () => {
    const { settings } = setup();
    const visibility = items.flatMap(item => item.visibilityId ? [settings.spec(item.visibilityId)!] : []);
    expect(visibility.length).toBeGreaterThan(0);
    expect(visibility.every(spec => spec.controlFirst === true)).toBe(true);
    expect(settings.spec(TOOLBAR_EDIT_PRIORITIES_ID)!.controlFirst).toBeUndefined();
  });
  it("keeps map controls compact until explicitly expanded and retains that choice on reload", () => {
    const records = new Map<string, string>();
    const storage = { getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => { records.set(key, value); } };
    const create = () => {
      const registry = createSettingsRegistry({ storage });
      registry.register(MAP_SOURCE_HUD_LAYOUT_PARAMETERS);
      return registry;
    };
    const settings = create();
    expect(settings.inspect(MAP_SOURCE_HUD_LAYOUT_ID)).toMatchObject({ value: "compact", provenance: "default" });
    expect(settings.inspect(MAP_SOURCE_JOIN_ID)).toMatchObject({ value: "off", provenance: "default" });
    expect(settings.set(MAP_SOURCE_JOIN_ID, "when-full")).toEqual({ ok: true });
    expect(settings.set(MAP_SOURCE_JOIN_ID, "always")).toEqual({ ok: true });
    expect(settings.set(MAP_SOURCE_JOIN_ID, "beside").ok).toBe(false);
    expect(settings.get(MAP_SOURCE_JOIN_ID)).toBe("always");
    settings.reset(MAP_SOURCE_JOIN_ID);
    expect(settings.get(MAP_SOURCE_JOIN_ID)).toBe("off");
    expect(settings.list()[0].home).toEqual({ tab: "interface", section: "toolbar", level: "main" });
    expect(settings.set(MAP_SOURCE_HUD_LAYOUT_ID, "expanded")).toEqual({ ok: true });
    expect(create().inspect(MAP_SOURCE_HUD_LAYOUT_ID)).toMatchObject({ value: "expanded", provenance: "user" });
    expect(settings.set(MAP_SOURCE_HUD_LAYOUT_ID, "vertical").ok).toBe(false);
    expect(settings.get(MAP_SOURCE_HUD_LAYOUT_ID)).toBe("expanded");
    settings.reset(MAP_SOURCE_HUD_LAYOUT_ID);
    expect(create().get(MAP_SOURCE_HUD_LAYOUT_ID)).toBe("compact");
  });

  it("leaves the home-indicator clearance off until it is chosen", () => {
    const records = new Map<string, string>();
    const storage = { getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => { records.set(key, value); } };
    const create = () => {
      const registry = createSettingsRegistry({ storage });
      registry.register(TOOLBAR_BOTTOM_CLEARANCE_PARAMETERS);
      return registry;
    };
    const settings = create();
    expect(settings.inspect(TOOLBAR_BOTTOM_CLEARANCE_ID)).toMatchObject({ value: false, provenance: "default" });
    expect(settings.list()[0].home).toEqual({ tab: "interface", section: "toolbar", level: "main" });
    expect(settings.set(TOOLBAR_BOTTOM_CLEARANCE_ID, true)).toEqual({ ok: true });
    expect(create().get(TOOLBAR_BOTTOM_CLEARANCE_ID)).toBe(true);
    settings.reset(TOOLBAR_BOTTOM_CLEARANCE_ID);
    expect(create().get(TOOLBAR_BOTTOM_CLEARANCE_ID)).toBe(false);
  });

  it("spins the activity outline until a still one is chosen", () => {
    const records = new Map<string, string>();
    const storage = { getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => { records.set(key, value); } };
    const create = () => {
      const registry = createSettingsRegistry({ storage });
      registry.register(TOOLBAR_ACTIVITY_OUTLINE_PARAMETERS);
      return registry;
    };
    const settings = create();
    expect(settings.inspect(TOOLBAR_ACTIVITY_OUTLINE_ID)).toMatchObject({ value: "spinning", provenance: "default" });
    expect(settings.list()[0].home).toEqual({ tab: "interface", section: "toolbar", level: "main" });
    expect(settings.set(TOOLBAR_ACTIVITY_OUTLINE_ID, "still")).toEqual({ ok: true });
    expect(create().get(TOOLBAR_ACTIVITY_OUTLINE_ID)).toBe("still");
    expect(settings.set(TOOLBAR_ACTIVITY_OUTLINE_ID, "off").ok).toBe(false);
    settings.reset(TOOLBAR_ACTIVITY_OUTLINE_ID);
    expect(create().get(TOOLBAR_ACTIVITY_OUTLINE_ID)).toBe("spinning");
  });

  it("draws the still activity outline as the reduced-motion one, on the chips the comet runs on and at its specificity", () => {
    const css = readFileSync(new URL("../src/styles/toolbar.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = (list: string) => list.split(",").map(each => each.trim());
    const declarations = (body: string) => body.split(";").map(each => each.trim()).filter(Boolean);
    const comet = /\n([^{}]+)\{[^}]*animation: hud-chip-spin[^}]*\}/.exec(css)!;
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{\s*([^{}]*\.hud-chip\.is-streaming[^{}]*)\{([^}]*)\}/.exec(css)!;
    const still = /\n([^{}]*:where\(:root\[data-hud-activity="still"\]\)[^{}]*)\{([^}]*)\}/.exec(css)!;
    expect(selectors(reduced[1])).toEqual(selectors(comet[1]));
    expect(selectors(still[1])).toEqual(selectors(comet[1]).map(selector => `:where(:root[data-hud-activity="still"]) ${selector}`));
    expect(declarations(still[2])).toEqual(declarations(reduced[2]));
  });

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
