import type { LegacyMigration } from "@foss-earth/ui/settings";

/** Observations are supplied by the renderer/engine; this module collects none. */
export interface ToolbarPerformanceSnapshot {
  fps: number; frameMs: number; p95FrameMs: number; activeMeshes: number;
  drawCalls: number | null;
  tiles?: { visibleTiles: number; activeTiles: number } | null;
  culling: { visible: number; total: number };
  memoryMb: number | null;
}

export type PerformanceMetricId = "fps" | "frame" | "p95" | "activeMeshes" | "drawCalls" | "tiles" | "culling" | "memory";

/** How each toolbar reading is drawn; whether it is shown is `interface.performanceHud.<id>`. */
export interface PerformanceMetricDefinition {
  id: PerformanceMetricId;
  settingsLabel: string;
  tooltip: string;
  format(snapshot: ToolbarPerformanceSnapshot): string | null;
}

export const PERFORMANCE_METRIC_DEFINITIONS: readonly PerformanceMetricDefinition[] = [
  {
    id: "fps",
    settingsLabel: "FPS",
    tooltip: "Frames per second rendered by the map.",
    format: (snapshot) => String(Math.round(snapshot.fps)),
  },
  {
    id: "frame",
    settingsLabel: "Frame time",
    tooltip: "Average time spent rendering each frame.",
    format: (snapshot) => `${snapshot.frameMs.toFixed(1)}ms`,
  },
  {
    id: "p95",
    settingsLabel: "P95 frame time",
    tooltip: "95th percentile frame time over the recent sample window.",
    format: (snapshot) => `p95 ${snapshot.p95FrameMs.toFixed(1)}ms`,
  },
  {
    id: "activeMeshes",
    settingsLabel: "Active meshes (#⬟)",
    tooltip: "Babylon meshes currently active in the scene.",
    format: (snapshot) => `${snapshot.activeMeshes}⬟`,
  },
  {
    id: "drawCalls",
    settingsLabel: "Draw calls",
    tooltip: "GPU draw calls submitted for the current frame when the renderer exposes them.",
    format: (snapshot) => snapshot.drawCalls === null ? null : `d${snapshot.drawCalls}`,
  },
  {
    id: "tiles",
    settingsLabel: "Map tiles (#/#t)",
    tooltip: "Visible map tiles over active map tiles managed by the tile runtime.",
    format: (snapshot) => snapshot.tiles ? `${snapshot.tiles.visibleTiles}/${snapshot.tiles.activeTiles}t` : null,
  },
  {
    id: "culling",
    settingsLabel: "Culling",
    tooltip: "Visible tracked objects over total tracked objects after hemisphere culling.",
    format: (snapshot) => snapshot.culling.total > 0 ? `c${snapshot.culling.visible}/${snapshot.culling.total}` : null,
  },
  {
    id: "memory",
    settingsLabel: "Memory",
    tooltip: "Approximate JavaScript heap memory currently used by the page.",
    format: (snapshot) => snapshot.memoryMb === null ? null : `${Math.round(snapshot.memoryMb)}MB`,
  },
];

/** The legacy array before on/auto/off values entered the host registry. */
export const PERFORMANCE_HUD_VISIBILITY_STORAGE_KEY = "foss-earth.performanceMetricVisibility";

/** Preserves only edits from the former FPS+memory default, as the source migration did. */
export const PERFORMANCE_HUD_VISIBILITY_MIGRATION: LegacyMigration = {
  key: PERFORMANCE_HUD_VISIBILITY_STORAGE_KEY,
  migrate(raw) {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return null; }
    if (!Array.isArray(parsed)) return null;
    return Object.fromEntries(PERFORMANCE_METRIC_DEFINITIONS
      .filter(({ id }) => parsed.includes(id) !== (id === "fps" || id === "memory"))
      .map(({ id }) => [`interface.performanceHud.${id}`, parsed.includes(id) ? "on" : "off"]));
  },
};

