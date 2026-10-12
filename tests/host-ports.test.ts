// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createSettingsRegistry } from "@foss-earth/ui/settings";
import { POSITION_PARAMETERS, createToolbarParameters, type ToolbarItemDescriptor } from "../src/settings.js";
import { POSITION_SEA_LEVEL_GRID_ID } from "../src/position.js";
import { createPositionReadout } from "../src/browser/positionReadout.js";
import { bindToolbarLauncher } from "../src/browser/launcher.js";
import { attachFullscreenButton, EVERY_VISIT_PREFERENCE_KEY, readFullscreenEveryVisit, writeFullscreenEveryVisit } from "../src/browser/fullscreen.js";
import { createToolbarInterfaceSection, createPositionInterfaceSection } from "../src/browser/interfaceSection.js";
import { createStatusHud } from "../src/browser/statusHud.js";
import { renderPerformanceChips } from "../src/browser/performanceChips.js";
import { readToolbarFitItems } from "../src/browser/fitting.js";
import { createHudBar, HUD_BAR_HEIGHT_PROPERTY } from "../src/browser/hudBar.js";
import { createLatitudeIcon, createLongitudeIcon } from "../src/browser/positionReadout.js";
import { fitHudBar, type HudBarLayoutPorts } from "../src/browser/hudBarFit.js";
const reading = { latDeg: 44.9778, lonDeg: -93.265, altitudeMeters: 1000, heightDatum: "ellipsoid" as const };
function registry() {
  const settings = createSettingsRegistry({ storage: null }); settings.register(POSITION_PARAMETERS);
  settings.register([{ id: POSITION_SEA_LEVEL_GRID_ID, label: "Host grid", description: "Host acquisition choice.", unit: "none", kind: "choice", choices: [{ id: "15", label: "15" }, { id: "60", label: "60" }], default: "15", defaultReason: "Host choice.", home: { tab: "interface", section: "position", level: "main" }, appliesLive: true, source: "host/geoid.ts" }]);
  return settings;
}
describe("toolbar explicit host ports", () => {
  it("allocates HUD, performance and coordinate nodes without an ambient document", () => {
    const ownDocument = document.implementation.createHTMLDocument("Host realm");
    const settings = registry(); settings.set("interface.position.coordinateLabels", "icons");
    const container = ownDocument.createElement("div"), chip = ownDocument.createElement("button"), performance = ownDocument.createElement("div");
    const ambient = document;
    vi.stubGlobal("document", undefined); vi.stubGlobal("window", undefined);
    try {
      const hud = createHudBar(container, { document: ownDocument, items: [{ kind: "button", id: "host", title: "Host", ariaLabel: "Host", text: "Host" }, { kind: "slot", id: "reading" }] });
      const readout = createPositionReadout(chip, settings); readout.update({ latDeg: 45, lonDeg: -93 });
      renderPerformanceChips(performance, { fps: 60, frameMs: 1, p95FrameMs: 2, activeMeshes: 3, drawCalls: null, culling: { visible: 0, total: 0 }, memoryMb: null }, new Set(["fps"]));
      expect(hud.element.ownerDocument).toBe(ownDocument);
      expect(ownDocument.documentElement.style.getPropertyValue(HUD_BAR_HEIGHT_PROPERTY)).toBe("0px");
      expect(ambient.documentElement.style.getPropertyValue(HUD_BAR_HEIGHT_PROPERTY)).toBe("");
      expect([...chip.querySelectorAll("svg, path, circle, ellipse")].every(node => node.ownerDocument === ownDocument)).toBe(true);
      expect(chip.querySelectorAll("svg")).toHaveLength(2); expect(performance.textContent).toBe("60fps");
      expect(createLatitudeIcon(ownDocument).ownerDocument).toBe(ownDocument); expect(createLongitudeIcon(ownDocument).ownerDocument).toBe(ownDocument);
      hud.destroy(); readout.destroy(); expect(ownDocument.documentElement.style.getPropertyValue(HUD_BAR_HEIGHT_PROPERTY)).toBe("");
    } finally { vi.unstubAllGlobals(); }
  });
  it("fits with only host layout authorities and cancels their pending work", () => {
    const ownDocument = document.implementation.createHTMLDocument("Detached host");
    const bar = ownDocument.createElement("div"), end = ownDocument.createElement("span"), item = ownDocument.createElement("button");
    bar.append(item, end); item.style.order = "7";
    const rect = (width: number) => ({ width, height: 28, top: 0, left: 0, right: width, bottom: 28, x: 0, y: 0, toJSON() {} });
    bar.getBoundingClientRect = () => rect(150); end.getBoundingClientRect = () => rect(40); item.getBoundingClientRect = () => rect(30);
    let pending: FrameRequestCallback | null = null, resize = () => {}, mutated = () => {};
    const cancel = vi.fn(), stopResize = vi.fn(), stopMutations = vi.fn();
    const request = vi.fn((callback: FrameRequestCallback) => { pending = callback; return 1; });
    const ports: HudBarLayoutPorts = { requestFrame: request, cancelFrame: cancel, computedStyle: () => ({ columnGap: "3px" }),
      observeMutations: (_element, changed) => { mutated = changed; return stopMutations; }, subscribeResize: changed => { resize = changed; return stopResize; } };
    vi.stubGlobal("window", undefined); vi.stubGlobal("document", undefined); vi.stubGlobal("requestAnimationFrame", undefined); vi.stubGlobal("getComputedStyle", undefined); vi.stubGlobal("MutationObserver", undefined);
    try {
      const fitting = fitHudBar(bar, end, () => [{ element: item, priority: 0, keepVisible: true }], ports);
      expect(item.hasAttribute("data-hud-overflow-hidden")).toBe(false); expect(item.style.order).toBe("0");
      resize(); mutated(); fitting.update(); expect(request).toHaveBeenCalledOnce();
      const frame = pending as FrameRequestCallback | null; frame?.(0);
      fitting.update(); fitting.destroy(); expect(cancel).toHaveBeenCalledWith(1); expect(stopResize).toHaveBeenCalledOnce(); expect(stopMutations).toHaveBeenCalledOnce();
      expect(item.style.order).toBe("7"); expect(bar.classList.contains("hud-bar--fitted")).toBe(false);
      resize(); mutated(); expect(request).toHaveBeenCalledTimes(2);
    } finally { vi.unstubAllGlobals(); }
  });
  it("keeps automatic/custom order, essential controls and first-two reservations host-neutral", () => {
    const settings = registry();
    const items: ToolbarItemDescriptor[] = ["north", "one", "two", "three"].map((id, index) => ({ id, label: id, description: id, defaultPriority: index, defaultReason: "Host order.", source: "host.ts", ...(index === 0 ? { essential: true } : { visibilityId: `interface.toolbar.${id}` }) }));
    settings.register(createToolbarParameters(items)); const elements = new Map(items.map(item => [item.id, document.createElement("button")])); const get = (id: string) => elements.get(id) ?? null;
    let fit = readToolbarFitItems(settings, items, get); expect(fit.filter(item => item.reserveSpace).map(item => item.element)).toEqual([get("north"), get("one"), get("two")]);
    settings.set("interface.toolbar.priority.three", 0); settings.set("interface.toolbar.editPriorities", true); settings.set("interface.toolbar.one", "off"); settings.set("interface.toolbar.two", "on");
    fit = readToolbarFitItems(settings, items, get); expect(fit.map(item => item.element)).not.toContain(get("one")); expect(fit.find(item => item.element === get("two"))?.keepVisible).toBe(true); expect(fit.find(item => item.element === get("three"))?.priority).toBe(0); expect(fit.find(item => item.element === get("north"))?.essential).toBe(true);
    get("three")!.hidden = true; fit = readToolbarFitItems(settings, items, get); expect(fit.find(item => item.element === get("three"))?.reserveSpace).toBeUndefined();
  });
  it("draws host sea-level readiness/errors and ignores notifications after disposal", () => {
    const settings = registry(); const chip = document.createElement("button");
    let notify = () => {}; let value: { baseMeters: number | null; note?: string } = { baseMeters: null, note: "Loading the sea level grid." };
    const stop = vi.fn(); const read = vi.fn(() => value);
    const handle = createPositionReadout(chip, settings, { seaLevel: { read, subscribe: listener => { notify = listener; return stop; } } });
    handle.update(reading); expect(chip.textContent).toContain("—m ASL"); expect(chip.querySelector<HTMLElement>("[data-position-part='altitude']")?.title).toBe(value.note);
    expect(read.mock.calls[0]).toEqual([reading, "15"]);
    value = { baseMeters: -27.3 }; notify(); expect(chip.textContent).toContain("1027m ASL");
    settings.set(POSITION_SEA_LEVEL_GRID_ID, "60"); expect(read.mock.calls.at(-1)).toEqual([reading, "60"]);
    value = { baseMeters: null, note: "The sea level grid could not load: HTTP 404" }; notify(); expect(chip.querySelector<HTMLElement>("[data-position-part='altitude']")?.title).toBe(value.note);
    handle.destroy(); handle.destroy(); notify(); handle.update(reading); expect(chip.childNodes).toHaveLength(0); expect(stop).toHaveBeenCalledOnce();
  });
  it("never asks sea-level data for geoid ASL or same-datum AGL and keeps missing data explicit", () => {
    const settings = registry(); const chip = document.createElement("button"); const read = vi.fn(() => ({ baseMeters: -27.3 }));
    const handle = createPositionReadout(chip, settings, { seaLevel: { read } });
    handle.update({ ...reading, heightDatum: "geoid" }); expect(chip.textContent).toContain("1000m ASL");
    settings.set("interface.position.altitude", "agl"); handle.update({ ...reading, groundHeightMeters: 230 }); expect(chip.textContent).toContain("770m AGL"); expect(read).not.toHaveBeenCalled(); handle.destroy();
    const noPort = createPositionReadout(chip, registry()); noPort.update(reading); expect(chip.textContent).toContain("—m ASL"); expect(chip.querySelector<HTMLElement>("[data-position-part='altitude']")?.title).toBe("Sea level data is unavailable."); noPort.destroy();
  });
  it("toggles only the host tab, leaves unused input propagating and detaches subscriptions", () => {
    const parent = document.createElement("div"); const button = document.createElement("button"); parent.append(button); let notify = () => {}; let open = false; const stop = vi.fn();
    const toggle = vi.fn(() => { open = !open; notify(); });
    const detach = bindToolbarLauncher(button, { tabId: "settings", toggleTab: toggle, isTabOpen: () => open, subscribe: listener => { notify = listener; return stop; } });
    button.click(); expect(toggle).toHaveBeenCalledWith("settings"); expect(button.getAttribute("aria-pressed")).toBe("true");
    const events: string[] = []; for (const type of ["wheel", "keydown", "pointermove"]) parent.addEventListener(type, () => events.push(type));
    for (const type of ["wheel", "keydown", "pointermove"]) expect(button.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }))).toBe(true);
    expect(events).toEqual(["wheel", "keydown", "pointermove"]); detach(); detach(); button.click(); expect(toggle).toHaveBeenCalledOnce(); expect(stop).toHaveBeenCalledOnce();
  });
  it("runs fullscreen in the click gesture using injected actions and keeps old preference keys", async () => {
    const button = document.createElement("button"); let on = false; let notify = () => {}; const stop = vi.fn(); const toggle = vi.fn(async () => { on = !on; notify(); });
    const detach = attachFullscreenButton(button, { canRequest: () => true, isFullscreen: () => on, toggle, subscribe: listener => { notify = listener; return stop; } });
    button.click(); expect(toggle).toHaveBeenCalledOnce(); await Promise.resolve(); expect(button.getAttribute("aria-pressed")).toBe("true"); detach(); button.click(); expect(toggle).toHaveBeenCalledOnce(); expect(stop).toHaveBeenCalledOnce();
    const records = new Map<string, string>(); const storage = { getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => { records.set(key, value); }, removeItem: (key: string) => { records.delete(key); } };
    writeFullscreenEveryVisit(true, storage); expect(records.get(EVERY_VISIT_PREFERENCE_KEY)).toBe("1"); expect(readFullscreenEveryVisit(storage)).toBe(true); writeFullscreenEveryVisit(false, storage); expect(records.has(EVERY_VISIT_PREFERENCE_KEY)).toBe(false);
  });
  it("hands Interface sections the one registry and supplied UI factory", () => {
    const settings = registry(); const create = vi.fn(() => ({ element: document.createElement("div"), destroy: () => {} }));
    const refresh = { subscribe: vi.fn(() => () => {}) };
    createToolbarInterfaceSection(settings, { createParameterSection: create, panelStorage: null, document, refresh }); createPositionInterfaceSection(settings, { createParameterSection: create, panelStorage: null, document, refresh });
    expect(create.mock.calls[0][0]).toBe(settings); expect(create.mock.calls[0][1]).toMatchObject({ tab: "interface", section: "toolbar", panelStorage: null }); expect(create.mock.calls[0][1].footer).toBeUndefined(); expect(create.mock.calls[1][1].section).toBe("position");
    expect(create.mock.calls[0][1].refresh).toBe(refresh); expect(create.mock.calls[1][1].refresh).toBe(refresh); expect(refresh.subscribe).not.toHaveBeenCalled();
    expect(create.mock.calls[0][1].document).toBe(document); expect(create.mock.calls[1][1].document).toBe(document);
  });
  it("refuses missing host ports before creating UI or DOM", () => {
    const create = vi.fn(); const ownDocument = { createElement: vi.fn() } as unknown as Document;
    expect(() => createToolbarInterfaceSection(registry(), { createParameterSection: create, document: ownDocument } as never)).toThrow(/refresh port/);
    expect(create).not.toHaveBeenCalled(); expect(ownDocument.createElement).not.toHaveBeenCalled();
  });
  it("adds no toolbar note", () => {
    const ownDocument = document.implementation.createHTMLDocument("Host");
    const create = vi.fn(() => ({ element: ownDocument.createElement("div"), destroy() {} }));
    createToolbarInterfaceSection(registry(), { createParameterSection: create, document: ownDocument, refresh: { subscribe: () => () => {} } });
    expect(create.mock.calls[0][1].footer).toBeUndefined();
  });
  it("formats view/readout values and retains performance chip nodes across host updates", () => {
    const chip = document.createElement("button"); const hud = createStatusHud(chip, registry()); hud.update({ latDeg: 45, lonDeg: -93, headingDeg: -1, pitchDeg: 5, zoomMeters: 1234 }); expect(chip.textContent).toBe("45.0000°N 93.0000°W h359° p05° z1km"); hud.destroy();
    const element = document.createElement("div"); const snapshot = { fps: 60, frameMs: 1.5, p95FrameMs: 3, activeMeshes: 4, drawCalls: null, culling: { visible: 0, total: 0 }, memoryMb: null };
    renderPerformanceChips(element, snapshot, new Set(["fps", "drawCalls"])); const node = element.firstChild; renderPerformanceChips(element, { ...snapshot, fps: 59 }, new Set(["fps", "drawCalls"])); expect(element.firstChild).toBe(node); expect(element.textContent).toBe("59fps");
  });
});
