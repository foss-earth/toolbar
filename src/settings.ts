import type { ParameterSpec } from "@foss-earth/ui/settings";
import { POSITION_COORDINATE_LABELS_ID, POSITION_ALTITUDE_ID, POSITION_ALTITUDE_UNIT_ID } from "./position.js";
export type ToolbarVisibility = "on" | "auto" | "off";
export const INTERFACE_TAB = "interface";
export const MAP_SOURCE_HUD_LAYOUT_ID = "interface.mapHud.layout";
export const MAP_SOURCE_JOIN_ID = "interface.mapHud.join";
export type MapSourceJoin = "off" | "when-full" | "always";
/** Presentation only; host composition passes the choice to its map HUD. */
export const MAP_SOURCE_HUD_LAYOUT_PARAMETERS: readonly ParameterSpec[] = [{
  id: MAP_SOURCE_HUD_LAYOUT_ID,
  label: "Map controls",
  description: "Compact places a small detail rail beside the basemap at the bottom right. Expanded places a wider rail above the basemap for frequent detail adjustments.",
  unit: "none",
  kind: "choice",
  choices: [
    { id: "compact", label: "Compact", shortLabel: "Compact", description: "Small horizontal rail beside the basemap." },
    { id: "expanded", label: "Expanded", shortLabel: "Expanded", description: "Wider rail above the basemap." },
  ],
  default: "compact",
  defaultReason: "Keep the standard map controls compact; expand only when requested.",
  home: { tab: INTERFACE_TAB, section: "toolbar", level: "main" },
  appliesLive: true,
  source: "src/settings.ts",
}, {
  id: MAP_SOURCE_JOIN_ID,
  label: "Imagery in the toolbar",
  description: "Off leaves the imagery provider in the bottom-right corner, and the empty space stays between it and the toolbar. When the row is full moves the provider next to the last toolbar button once a wanted control is hidden or does not fit beside it. Always keeps the provider as the last toolbar button even when that corner has room.",
  unit: "none",
  kind: "choice",
  choices: [
    { id: "off", label: "Off", description: "Bottom-right corner. The empty space stays in the middle." },
    { id: "when-full", label: "When the row is full", description: "Next to the last toolbar button when a wanted control is hidden or does not fit." },
    { id: "always", label: "Always", description: "The last toolbar button, even when the corner has room." },
  ],
  default: "off",
  defaultReason: "The empty space stays in the middle and the imagery provider stays in the bottom-right corner.",
  home: { tab: INTERFACE_TAB, section: "toolbar", level: "main" },
  appliesLive: true,
  source: "src/settings.ts",
}];

export const TOOLBAR_BOTTOM_CLEARANCE_ID = "interface.toolbar.bottomClearance";
/** Off until a phone shows that the home gesture lands on the toolbar. */
export const TOOLBAR_BOTTOM_CLEARANCE_PARAMETERS: readonly ParameterSpec[] = [{
  id: TOOLBAR_BOTTOM_CLEARANCE_ID,
  label: "Home indicator clearance",
  description: "Lifts the bottom toolbar clear of a phone's home indicator, so a swipe that goes home does not press its buttons. Off sits the toolbar the same small distance from the bottom edge as from the sides. On adds that extra room, including the screen's own home-indicator inset, so it can be tried on a phone.",
  unit: "none",
  kind: "boolean",
  default: false,
  defaultReason: "The toolbar sits close to the bottom. The extra room stays off until a phone shows that the home gesture lands on the buttons.",
  home: { tab: INTERFACE_TAB, section: "toolbar", level: "main" },
  appliesLive: true,
  source: "src/settings.ts",
}];

export const TOOLBAR_ACTIVITY_OUTLINE_ID = "interface.toolbar.activityOutline";
export type ToolbarActivityOutline = "spinning" | "still";
/** Presentation only; the host marks the page's root with the choice, and the toolbar's styles follow it. */
export const TOOLBAR_ACTIVITY_OUTLINE_PARAMETERS: readonly ParameterSpec[] = [{
  id: TOOLBAR_ACTIVITY_OUTLINE_ID,
  label: "Activity outline",
  description: "How the chips that are at work are outlined: tiles loading, the GPU drawing, and the frame rate while frames are drawn. Spinning runs a light around the outline. Still draws the outline steady, as when the system asks for less motion, so the page does not restyle and repaint those chips every frame: a few percent of a phone's main thread while the view moves.",
  unit: "none",
  kind: "choice",
  choices: [
    { id: "spinning", label: "Spinning", description: "A light runs around the outline while the chip is at work." },
    { id: "still", label: "Still", description: "A steady outline, which the page does not redraw every frame." },
  ],
  default: "spinning",
  defaultReason: "The light running around the outline shows that work is going on.",
  home: { tab: INTERFACE_TAB, section: "toolbar", level: "main" },
  appliesLive: true,
  source: "src/settings.ts",
}];

export const TOOLBAR_EDIT_PRIORITIES_ID = "interface.toolbar.editPriorities";
export function toolbarPriorityParameterId(item: string): string { return `interface.toolbar.priority.${item}`; }

export function toolbarVisibility(id: string, label: string, description: string, fallback: ToolbarVisibility, reason: string, source: string, mark?: ParameterSpec["mark"]): ParameterSpec<ToolbarVisibility> {
  return {
    id,
    label,
    ...(mark ? { mark } : {}),
    description: `${description} On keeps it shown, wrapping if needed. Auto shows it when it fits in one row, in priority order. Off hides it.`,
    unit: "none",
    kind: "choice",
    // "[On / A / Off] Bug report" reads as a list of switches; the label alone would not line up.
    controlFirst: true,
    choices: [
      { id: "on", label: "On", icon: "line", description: "Always show, wrapping if needed." },
      { id: "auto", label: "Auto", shortLabel: "A", description: "Show when it fits in one row, in priority order." },
      { id: "off", label: "Off", icon: "circle", description: "Keep hidden." },
    ],
    legacyValues: [
      { value: true, replacement: "on" },
      { value: false, replacement: "off" },
    ],
    default: fallback,
    defaultReason: reason,
    persistDefault: true,
    home: { tab: INTERFACE_TAB, section: "toolbar", level: "main" },
    appliesLive: true,
    source,
  };
}

/** Descriptors are host-owned; toolbar never imports a feature catalogue. */
export interface ToolbarItemDescriptor {
  id: string;
  label: string;
  defaultPriority: number;
  description: string;
  defaultReason: string;
  /** Separate explanation for the default ordering when visibility has its own reason. */
  priorityDefaultReason?: string;
  /** Omit for an essential control that is always available. */
  visibilityId?: string;
  defaultVisibility?: ToolbarVisibility;
  /** Still reserve room when priorities change. */
  essential?: boolean;
  /** Drawn before the visibility label. Priority fields stay text. */
  mark?: ParameterSpec["mark"];
  source: string;
}

/** The host registers returned specs into its one registry, once. */
export function createToolbarParameters(items: readonly ToolbarItemDescriptor[]): readonly ParameterSpec[] {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Duplicate toolbar item "${item.id}".`);
    if (!Number.isInteger(item.defaultPriority) || item.defaultPriority < 0 || item.defaultPriority > 99) throw new Error(`Invalid default priority for "${item.id}".`);
    ids.add(item.id);
  }
  return [
    ...items.flatMap(item => item.visibilityId ? [toolbarVisibility(item.visibilityId, item.label, item.description, item.defaultVisibility ?? "auto", item.defaultReason, item.source, item.mark)] : []),
    {
      id: TOOLBAR_EDIT_PRIORITIES_ID, label: "Priorities",
      description: "Auto uses the default toolbar order. Custom shows priority numbers beside each toolbar control and uses them to decide the order and which automatic items fit first. Returning to Auto keeps your custom numbers for later.",
      unit: "none", kind: "boolean", default: false,
      defaultReason: "Auto uses the default order with priority numbers hidden.",
      home: { tab: INTERFACE_TAB, section: "toolbar", level: "main" }, appliesLive: true,
      booleanControl: "auto-custom", source: "src/settings.ts",
    },
    ...items.map((item): ParameterSpec<number> => ({
      id: toolbarPriorityParameterId(item.id), label: `${item.label} priority`,
      description: `Lower numbers place ${item.label} earlier and give it room before other automatic toolbar items. Items with equal priorities keep their default order.${item.essential ? ` ${item.label} stays available at every priority.` : ""}`,
      unit: "count", kind: "number", bounds: () => ({ min: 0, max: 99 }), step: 1, numberControl: "field",
      default: item.defaultPriority, defaultReason: item.priorityDefaultReason ?? item.defaultReason,
      home: { tab: INTERFACE_TAB, section: "toolbar", level: "main" },
      visibleWhen: { id: TOOLBAR_EDIT_PRIORITIES_ID, value: true }, inlineWith: item.visibilityId,
      appliesLive: true, source: item.source,
    })),
  ];
}

const POSITION_READOUT = { tab: INTERFACE_TAB, section: "position", level: "main" } as const;
/** Only presentation parameters. Sea-level resource/grid specs belong to the host/engine. */
export const POSITION_PARAMETERS: readonly ParameterSpec[] = [
  {
    id: POSITION_COORDINATE_LABELS_ID,
    label: "lat/lon",
    description: "How the toolbar's position readout says which number is which. None leaves it to the N or S and E or W after each number. Words writes lat and lon before them. Icons draws a globe with only its parallels before the latitude and one with only its meridians before the longitude.",
    unit: "none",
    kind: "choice",
    choices: [
      { id: "none", label: "None", description: "Only the N or S and E or W after each number." },
      { id: "words", label: "Words", description: "lat before the latitude, lon before the longitude." },
      { id: "icons", label: "Icons", description: "A globe of parallels before the latitude, a globe of meridians before the longitude." },
    ],
    default: "none",
    defaultReason: "N or S after the latitude and E or W after the longitude already say which is which, in the narrowest chip.",
    home: POSITION_READOUT,
    appliesLive: true,
    source: "@foss-earth/toolbar/src/browser/positionReadout.ts",
  },
  {
    id: POSITION_ALTITUDE_ID,
    label: "Altitude",
    description: "What the toolbar's altitude is measured from. Above sea level is the height over mean sea level, the EGM2008 geoid. Raster terrain's heights are already above its source's sea level; Google 3D Tiles are drawn at their heights above the WGS84 ellipsoid, so over them the geoid's height there, from the sea level grid below, is taken away. Above ground takes away the height of the drawn terrain directly below, so it reads zero on the ground and changes as the ground rises and falls; it needs the terrain below sampled each time it is drawn, and shows a dash until terrain there has loaded.",
    unit: "none",
    kind: "choice",
    choices: [
      { id: "asl", label: "Above sea level (ASL)", description: "Height over mean sea level." },
      { id: "agl", label: "Above ground (AGL)", description: "Height over the terrain directly below." },
    ],
    default: "asl",
    defaultReason: "It does not depend on which terrain has loaded, and is the altitude an altimeter and a chart give.",
    home: POSITION_READOUT,
    appliesLive: true,
    source: "@foss-earth/toolbar/src/browser/positionReadout.ts",
  },
  {
    id: POSITION_ALTITUDE_UNIT_ID,
    label: "Altitude unit",
    description: "The unit the toolbar's altitude is written in: metres or feet.",
    unit: "none",
    kind: "choice",
    choices: [
      { id: "m", label: "Metres (m)" },
      { id: "ft", label: "Feet (ft)" },
    ],
    default: "m",
    defaultReason: "The unit of the zoom distance beside it. An application that flies sets feet.",
    home: POSITION_READOUT,
    appliesLive: true,
    source: "@foss-earth/toolbar/src/browser/positionReadout.ts",
  },
];

/** Same interpretation as the current host toolbar, without its singleton. */
export function readToolbarPreference(settings: import("@foss-earth/ui/settings").SettingsRegistry, id: string): { wanted: boolean; pinned: boolean } {
  const mode = settings.get(id);
  return { wanted: mode === "on" || mode === "auto", pinned: mode === "on" };
}
export function toolbarSettingsIds(items: readonly ToolbarItemDescriptor[]): ReadonlySet<string> {
  return new Set([TOOLBAR_EDIT_PRIORITIES_ID, ...items.flatMap(item => item.visibilityId ? [item.visibilityId] : []), ...items.map(item => toolbarPriorityParameterId(item.id))]);
}
