export type CoordinateLabels = "none" | "words" | "icons";
export type AltitudeReference = "asl" | "agl";
export type AltitudeUnit = "m" | "ft";
export type PositionHeightDatum = "geoid" | "ellipsoid";
export const POSITION_COORDINATE_LABELS_ID = "interface.position.coordinateLabels";
export const POSITION_ALTITUDE_ID = "interface.position.altitude";
export const POSITION_ALTITUDE_UNIT_ID = "interface.position.altitudeUnit";
/** Host/engine parameter; the toolbar consumes the selected identity only. */
export const POSITION_SEA_LEVEL_GRID_ID = "interface.position.seaLevelGrid";
const METERS_PER_FOOT = 0.3048;

/** The altitude as a whole number of metres or feet, before the readout shortens large heights. */
export function roundAltitude(meters: number, unit: AltitudeUnit): number {
  return Math.round(unit === "ft" ? meters / METERS_PER_FOOT : meters);
}

/** A typed metres or feet amount, back in metres. */
export function altitudeMetersFromAmount(amount: number, unit: AltitudeUnit): number {
  return unit === "ft" ? amount * METERS_PER_FOOT : amount;
}

/** A length as the toolbar writes it: whole metres, then km and Mm as it grows. */
export function formatDistance(meters: number): string {
  if (meters >= 1_000_000) return `${(meters / 1_000_000).toFixed(1)}Mm`;
  if (meters >= 1_000) return `${(meters / 1_000).toFixed(0)}km`;
  return `${meters.toFixed(0)}m`;
}

/**
 * The altitude as the readout writes it, such as "1250m ASL" or "410ft AGL":
 * `altitudeMeters` less `baseMeters`, the height of sea level or of the ground
 * there, or a dash while that is not known. Metres stay whole to 100 km, the
 * range a height is read to the metre in.
 */
export function formatAltitude(altitudeMeters: number | null, baseMeters: number | null, reference: AltitudeReference, unit: AltitudeUnit): string {
  const suffix = reference === "asl" ? "ASL" : "AGL";
  if (altitudeMeters === null || baseMeters === null) return `\u2014${unit} ${suffix}`;
  const meters = altitudeMeters - baseMeters;
  const rounded = roundAltitude(meters, unit);
  const value = unit === "ft" ? `${rounded}ft`
    : Math.abs(meters) < 100_000 ? `${rounded}m` : formatDistance(meters);
  return `${value} ${suffix}`;
}

