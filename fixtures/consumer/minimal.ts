import { createToolbarParameters, formatAltitude, type ToolbarItemDescriptor, type PositionReading, type ToolbarViewReading, type CameraAltitude, type RenderActivitySource, type TileStreamingSource, type MapDownloadSource, type SceneHudSource, type SceneHudCredit, type HelpModalHandle, type SceneHudHandle } from "@foss-earth/toolbar";
import { createSettingsRegistry } from "@foss-earth/ui/settings";
import { createPositionReadout, createLatitudeIcon, createLongitudeIcon, createHudBar, renderPerformanceChips, fitHudBar, browserHudBarLayoutPorts, bindToolbarLauncher, createToolbarInterfaceSection, attachRendererActivity, attachTileStreamingActivity, attachMapDownloadSpeed, setMapSourceLabel, createHelpModal, createSceneHud } from "@foss-earth/toolbar/browser";
import type { HudBarLayoutPorts } from "@foss-earth/toolbar";
import { createParameterSection, createExternalLinkIcon } from "@foss-earth/ui/browser";
const items: ToolbarItemDescriptor[] = [{ id: "host", label: "Host", defaultPriority: 0, visibilityId: "interface.toolbar.host", description: "Shows the host launcher.", defaultReason: "Host default.", source: "host/toolbar.ts" }];
const settings = createSettingsRegistry({ storage: null }); settings.register(createToolbarParameters(items));
formatAltitude(1000, 0, "asl", "m");
formatAltitude(null, 0, "asl", "m");
const reading: PositionReading = { latDeg: 45, lonDeg: -93, heightDatum: "ellipsoid", groundHeightDatum: "geoid" };
void reading;
const pictureView: ToolbarViewReading = { latDeg: 45, lonDeg: -93, headingDeg: 17, pitchDeg: 5, zoomMeters: 600, verticalFovDeg: 75 };
const pictureAltitude: CameraAltitude = { altitudeMeters: null, groundHeightMeters: null, heightDatum: "ellipsoid", groundHeightDatum: "geoid" };
void pictureView; void pictureAltitude;
function mount(element: HTMLButtonElement) {
  const launcher = bindToolbarLauncher(element, { tabId: "host-tab", toggleTab: (id: "host-tab") => { void id; } });
  const readout = createPositionReadout(element, settings, { seaLevel: { read: () => ({ baseMeters: null, note: "Host data pending." }) } });
  const section = createToolbarInterfaceSection(settings, { createParameterSection, panelStorage: null, document: element.ownerDocument, refresh: { subscribe: () => () => {} } });
  return () => { launcher(); readout.destroy(); section.destroy(); };
}
void mount;
function mountActivity(element: HTMLElement, render: RenderActivitySource, tiles: TileStreamingSource) {
  const detachRender = attachRendererActivity(element, render);
  const detachTiles = attachTileStreamingActivity(element, tiles);
  return () => { detachTiles(); detachRender(); };
}
void mountActivity;

function mountPresentation(element: HTMLElement, download: MapDownloadSource, controller: SceneHudSource) {
  setMapSourceLabel(element, "Host map");
  const detachDownload = attachMapDownloadSpeed(element, download);
  const help: HelpModalHandle = createHelpModal(element);
  const hud: SceneHudHandle = createSceneHud({ controller, container: element, createExternalLinkIcon });
  return () => { detachDownload(); help.destroy(); hud.destroy(); };
}
const credit: SceneHudCredit = { text: "Host credit", license: null, url: null };
void credit;
void mountPresentation;
function mountHostRealm(element: HTMLElement, window: Window & typeof globalThis) {
  const document = element.ownerDocument;
  const ports: HudBarLayoutPorts = browserHudBarLayoutPorts(window);
  const bar = createHudBar(element, { document, items: [{ kind: "slot", id: "host-end" }] });
  const end = bar.getElement("host-end")!;
  const fitting = fitHudBar(bar.element, end, () => [], ports);
  createLatitudeIcon(document); createLongitudeIcon(document);
  renderPerformanceChips(end, { fps: 60, frameMs: 1, p95FrameMs: 2, activeMeshes: 3, drawCalls: null, memoryMb: null, culling: { visible: 0, total: 0 } }, new Set(["fps"]), document);
  return () => { fitting.destroy(); bar.destroy(); };
}
void mountHostRealm;
