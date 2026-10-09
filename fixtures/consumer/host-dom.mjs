import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createSettingsRegistry } from "@foss-earth/ui/settings";
import { createParameterSection, createExternalLinkIcon } from "@foss-earth/ui/browser";
import { POSITION_PARAMETERS, createToolbarParameters } from "@foss-earth/toolbar";
import { createToolbarInterfaceSection, createPositionInterfaceSection, createHudBar, createPositionReadout, createLatitudeIcon, createLongitudeIcon, renderPerformanceChips, fitHudBar, bindToolbarLauncher, attachRendererActivity, attachTileStreamingActivity, attachMapDownloadSpeed, setMapSourceLabel, createHelpModal, createSceneHud } from "@foss-earth/toolbar/browser";

const dom = new JSDOM("<!doctype html><main></main>");
const globals = new Map();
for (const name of ["window", "document", "Node", "Element", "HTMLElement", "HTMLAnchorElement", "HTMLInputElement", "HTMLSelectElement"]) {
  globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
const settings = createSettingsRegistry({ storage: null }), handles = [], stops = [], listeners = [], activityDisposers = [];
try {
  settings.register(POSITION_PARAMETERS);
  settings.register(createToolbarParameters([{ id: "host", label: "Host", defaultPriority: 0, visibilityId: "interface.toolbar.host", description: "Host launcher.", defaultReason: "Existing host default.", source: "host.ts" }]));
  const refresh = { subscribe(listener) { listeners.push(listener); const stop = { calls: 0 }; stops.push(stop); return () => { stop.calls += 1; }; } };
  for (const create of [createToolbarInterfaceSection, createPositionInterfaceSection]) {
    const handle = create(settings, { createParameterSection, document: dom.window.document, panelStorage: null, refresh });
    handles.push(handle); dom.window.document.querySelector("main").append(handle.element);
  }
  assert.equal(listeners.length, 2);
  assert.match(handles[0].element.textContent, /Hiding a button never hides its tab/);
  assert.equal(handles[0].element.dataset.settingsSection, "interface/toolbar");
  assert.equal(handles[1].element.dataset.settingsSection, "interface/position");
  assert.ok(handles[0].element.querySelector("input"));
  for (const listener of listeners) listener();
  const button = dom.window.document.createElement("button"), parent = dom.window.document.createElement("div"); parent.append(button);
  const toggles = []; let wheels = 0; parent.addEventListener("wheel", () => { wheels += 1; });
  const detach = bindToolbarLauncher(button, { tabId: "host", toggleTab: id => toggles.push(id) });
  try { button.click(); assert.deepEqual(toggles, ["host"]); button.dispatchEvent(new dom.window.Event("wheel", { bubbles: true })); assert.equal(wheels, 1); } finally { detach(); }
  button.click(); assert.deepEqual(toggles, ["host"]);
  button.title = "Host renderer.";
  let renderActivity = () => {}, tileActivity = () => {}, renderStops = 0, tileStops = 0;
  const detachRender = attachRendererActivity(button, { isRendering: () => false, onActiveRenderChange(listener) { renderActivity = listener; return () => { renderStops += 1; }; } });
  activityDisposers.push(detachRender);
  const detachTiles = attachTileStreamingActivity(button, { isStreamingTiles: () => true, onTilesStreamingChange(listener) { tileActivity = listener; return () => { tileStops += 1; }; } });
  activityDisposers.push(detachTiles);
  assert.equal(button.ownerDocument, dom.window.document);
  assert.equal(button.dataset.renderState, "idle"); assert.equal(button.classList.contains("is-streaming"), true);
  renderActivity(true); tileActivity(false);
  assert.equal(button.dataset.renderState, "rendering"); assert.equal(button.classList.contains("is-streaming"), false);
  detachTiles(); detachTiles(); tileActivity(true);
  assert.equal(tileStops, 1); assert.equal(button.classList.contains("is-streaming"), false);
  assert.equal(button.dataset.renderState, "rendering");
  detachRender(); detachRender(); renderActivity(true);
  assert.equal(renderStops, 1); assert.equal(button.dataset.renderState, undefined);
  assert.equal(button.classList.contains("is-rendering"), false); assert.equal(button.title, "Host renderer.");
  // The installed public presentations allocate in a supplied element's Document,
  // independently of the ambient document used by the existing UI section fixture.
  const ownDocument = dom.window.document.implementation.createHTMLDocument("Host readouts");
  // Exercise the actual installed public code with no ambient browser fallback.
  const ambientDocument = Object.getOwnPropertyDescriptor(globalThis, "document"), ambientWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "document", { configurable: true, get() { throw new Error("Toolbar read ambient document"); } });
  Object.defineProperty(globalThis, "window", { configurable: true, get() { throw new Error("Toolbar read ambient window"); } });
  try {
    const hostContainer = ownDocument.createElement("div");
    let heightStop = 0;
    const bar = createHudBar(hostContainer, { document: ownDocument, observeHeight: () => () => { heightStop += 1; }, items: [{ kind: "slot", id: "host-end" }] });
    const end = bar.getElement("host-end");
    const positionButton = ownDocument.createElement("button");
    settings.set("interface.position.coordinateLabels", "icons");
    const positionReadout = createPositionReadout(positionButton, settings, { document: ownDocument });
    positionReadout.update({ latDeg: 45, lonDeg: -93 });
    assert.equal(positionButton.querySelectorAll("svg").length, 2);
    assert.equal(createLatitudeIcon(ownDocument).ownerDocument, ownDocument); assert.equal(createLongitudeIcon(ownDocument).ownerDocument, ownDocument);
    renderPerformanceChips(end, { fps: 60, frameMs: 1, p95FrameMs: 2, activeMeshes: 3, drawCalls: null, culling: { visible: 0, total: 0 }, memoryMb: null }, new Set(["fps"]), ownDocument);
    assert.equal(end.textContent, "60fps"); assert.equal(end.firstElementChild.ownerDocument, ownDocument);
    let requestCount = 0, pending, cancelCount = 0, mutationStop = 0, resizeStop = 0;
    const fitting = fitHudBar(bar.element, end, () => [], { requestFrame(callback) { requestCount += 1; pending = callback; return 1; }, cancelFrame() { cancelCount += 1; }, computedStyle: () => ({ columnGap: "0px" }), observeMutations: () => () => { mutationStop += 1; }, subscribeResize: () => () => { resizeStop += 1; } });
    fitting.update(); fitting.update(); assert.equal(requestCount, 1); pending(0);
    fitting.update(); fitting.destroy(); assert.equal(cancelCount, 1); assert.equal(mutationStop, 1); assert.equal(resizeStop, 1);
    positionReadout.destroy(); bar.destroy(); assert.equal(heightStop, 1);
  } finally {
    if (ambientDocument) Object.defineProperty(globalThis, "document", ambientDocument); else delete globalThis.document;
    if (ambientWindow) Object.defineProperty(globalThis, "window", ambientWindow); else delete globalThis.window;
  }
  const mapButton = ownDocument.createElement("button"); mapButton.textContent = "USGS Imagery";
  let rate = () => {}, rateStops = 0, downloadClosed = false;
  const detachDownload = attachMapDownloadSpeed(mapButton, {
    getMapDownloadBytesPerSecond: () => 12_000_000,
    onMapDownloadRateChange(listener) { rate = listener; return () => { rateStops += 1; }; },
  });
  activityDisposers.push(() => { if (!downloadClosed) { downloadClosed = true; detachDownload(); } });
  const speed = mapButton.querySelector(".map-download-speed");
  assert.equal(speed.ownerDocument, ownDocument); assert.equal(speed.textContent, "012MB/s");
  assert.equal(speed.getAttribute("aria-label"), speed.title);
  setMapSourceLabel(mapButton, "Google 3D Tiles"); assert.equal(mapButton.querySelector(".map-download-speed"), speed);
  rate(1_000_000_000); assert.equal(speed.textContent, "+++MB/s");
  rate(Number.NaN); assert.equal(speed.textContent, "000MB/s");
  downloadClosed = true; detachDownload(); assert.equal(rateStops, 1); assert.equal(mapButton.textContent, "Google 3D Tiles");
  const modal = ownDocument.createElement("div"), dismiss = ownDocument.createElement("button"), child = ownDocument.createElement("span");
  dismiss.id = "helpModalDismiss"; modal.append(dismiss, child);
  const help = createHelpModal(modal); let helpClosed = false;
  activityDisposers.push(() => { if (!helpClosed) { helpClosed = true; help.destroy(); } });
  help.show(); child.click(); assert.equal(modal.hidden, false); dismiss.click(); assert.equal(modal.hidden, true);
  help.show(); modal.click(); assert.equal(modal.hidden, true); help.hide(); assert.equal(modal.hidden, true);
  helpClosed = true; help.destroy(); help.show(); dismiss.click(); assert.equal(modal.hidden, false);
  const slot = ownDocument.createElement("span"), mapSource = ownDocument.createElement("span"), position = ownDocument.createElement("button");
  slot.append(mapSource); let sceneState = () => {}, sceneStops = 0, sceneClosed = false;
  const hud = createSceneHud({ container: slot, mapSource, mapOnly: [position], createExternalLinkIcon,
    controller: { subscribe(listener) { sceneState = listener; listener({ status: null }); return () => { sceneStops += 1; }; } },
  });
  activityDisposers.push(() => { if (!sceneClosed) { sceneClosed = true; hud.destroy(); } });
  const credit = { text: "Host photographer", license: "CC0", url: "https://example.org/source" };
  sceneState({ status: { phase: "immersive", credits: [credit, { text: "Host source" }] } });
  assert.equal(hud.element.ownerDocument, ownDocument); assert.equal(slot.firstElementChild, hud.element);
  assert.equal(mapSource.hidden, true); assert.equal(position.hidden, true); assert.equal(hud.element.querySelector("button"), null);
  const link = hud.element.querySelector("a.scene-credit-chip");
  assert.equal(link.textContent, "Host photographer · CC0"); assert.equal(link.href, credit.url);
  assert.equal(link.rel, "noopener noreferrer"); assert.equal(link.querySelector("svg").ownerDocument, ownDocument);
  assert.equal(hud.element.querySelectorAll(".scene-credit-chip").length, 2);
  sceneState({ status: { phase: "immersive", credits: [{ ...credit }, { text: "Host source" }] } });
  assert.equal(hud.element.querySelector("a.scene-credit-chip"), link);
  sceneState({ status: { phase: "entering", credits: [credit] } });
  assert.equal(hud.element.hidden, true); assert.equal(mapSource.hidden, false); assert.equal(position.hidden, false);
  sceneClosed = true; hud.destroy(); assert.equal(sceneStops, 1); assert.equal(hud.element.parentElement, null);
  for (const handle of handles) { handle.destroy(); handle.destroy(); }
  assert.deepEqual(stops.map(stop => stop.calls), [1, 1]);
  for (const listener of listeners) listener();
  assert.equal(dom.window.document.querySelector("main").children.length, 0);
  process.stdout.write("Actual installed Toolbar/UI sections share the host refresh; activity subscriptions, map rate, help visibility, supplied scene-credit presentation, disposal and launcher input propagation passed.\n");
} finally {
  for (const detach of activityDisposers) detach();
  for (const handle of handles) handle.destroy();
  for (const [name, descriptor] of globals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  dom.window.close();
}
