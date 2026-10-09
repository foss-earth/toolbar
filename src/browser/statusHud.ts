import type { SettingsRegistry } from "@foss-earth/ui/settings";
import { formatDistance, type PositionHeightDatum } from "../position.js";
import { createPositionReadout, type PositionReadoutOptions } from "./positionReadout.js";
/** Drawn position and view readings supplied by the host; no camera control. */
export interface ToolbarViewReading { latDeg: number; lonDeg: number; headingDeg: number; pitchDeg: number; zoomMeters: number }

/** The camera's own height, as distinct from the point it looks at. */
export interface CameraAltitude {
  /** In metres, measured as the drawn world's heights are. */
  altitudeMeters: number;
  /** The ground's height directly below the camera; null while unknown or not asked for. */
  groundHeightMeters: number | null;
  /** What the drawn world's heights are measured from. */
  heightDatum: PositionHeightDatum;
}

export interface StatusHudHandle {
  update(state: ToolbarViewReading, camera?: CameraAltitude | null): void;
  /** Whether the altitude shown needs the ground's height below the camera. */
  needsGroundHeight(): boolean;
  destroy(): void;
}

export function createStatusHud(element: HTMLElement, settings: SettingsRegistry, options: PositionReadoutOptions = {}): StatusHudHandle {
  const readout = createPositionReadout(element, settings, options);

  function update(state: ToolbarViewReading, camera?: CameraAltitude | null): void {
    const { latDeg, lonDeg, headingDeg, pitchDeg, zoomMeters } = state;
    const hdgStr = `h${String(Math.round(((headingDeg % 360) + 360) % 360)).padStart(3, "0")}\u00B0`;
    const pitchStr = `p${String(Math.round(pitchDeg)).padStart(2, "0")}\u00B0`;
    const zoomStr = `z${formatDistance(zoomMeters)}`;
    readout.update({
      latDeg,
      lonDeg,
      altitudeMeters: camera?.altitudeMeters,
      groundHeightMeters: camera?.groundHeightMeters,
      heightDatum: camera?.heightDatum,
      rest: `${hdgStr} ${pitchStr} ${zoomStr}`,
    });
  }

  return { update, needsGroundHeight: readout.needsGroundHeight, destroy: readout.destroy };
}
