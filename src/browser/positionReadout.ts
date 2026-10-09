import type { SettingsRegistry } from "@foss-earth/ui/settings";
import {
  POSITION_ALTITUDE_ID, POSITION_ALTITUDE_UNIT_ID, POSITION_COORDINATE_LABELS_ID, POSITION_SEA_LEVEL_GRID_ID,
  formatAltitude, type AltitudeReference, type AltitudeUnit, type CoordinateLabels, type PositionHeightDatum,
} from "../position.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface PositionReading {
  latDeg: number;
  lonDeg: number;
  /** The height, in metres, measured as the drawn world's heights are (`heightDatum`). Left out, the readout shows no altitude. */
  altitudeMeters?: number;
  /** The height of the ground directly below, measured the same way; null while no terrain there has loaded. */
  groundHeightMeters?: number | null;
  /**
   * What the drawn world's heights are measured from (`surfaceHeightDatum`).
   * Over the ellipsoid, the altitude above sea level takes the geoid's height
   * away. Sea level when left out.
   */
  heightDatum?: PositionHeightDatum;
  /** What follows the position, such as "h017° p71° z600m". */
  rest?: string;
}

export interface PositionReadoutHandle {
  update(reading: PositionReading): void;
  /** Whether the altitude shown needs `groundHeightMeters`: `interface.position.altitude` is above ground. */
  needsGroundHeight(): boolean;
  destroy(): void;
}

/** Sea-level data/resources remain host-owned. Unknown data is explicit. */
export interface PositionSeaLevelPort {
  read(reading: PositionReading, grid: string | null): { baseMeters: number | null; note?: string };
  /** The host calls listeners after its data changes; no toolbar poller. */
  subscribe?(listener: () => void): () => void;
}
export interface PositionReadoutOptions { seaLevel?: PositionSeaLevelPort; document?: Document }

function createIcon(document: Document, build: (svg: SVGSVGElement) => void): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "hud-position__icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("aria-hidden", "true");
  const globe = document.createElementNS(SVG_NS, "circle");
  globe.setAttribute("cx", "12");
  globe.setAttribute("cy", "12");
  globe.setAttribute("r", "10");
  svg.append(globe);
  build(svg);
  return svg;
}

/** A globe with only its parallels: the equator and the circles 30° either side of it. */
export function createLatitudeIcon(document: Document = globalThis.document): SVGSVGElement {
  return createIcon(document, svg => {
    const parallels = document.createElementNS(SVG_NS, "path");
    parallels.setAttribute("d", "M2 12h20M3.34 7h17.32M3.34 17h17.32");
    svg.append(parallels);
  });
}

/** A globe with only its meridians: the one facing the viewer and the pair 30° either side of it. */
export function createLongitudeIcon(document: Document = globalThis.document): SVGSVGElement {
  return createIcon(document, svg => {
    const central = document.createElementNS(SVG_NS, "path");
    central.setAttribute("d", "M12 2v20");
    const pair = document.createElementNS(SVG_NS, "ellipse");
    pair.setAttribute("cx", "12");
    pair.setAttribute("cy", "12");
    pair.setAttribute("rx", "5");
    pair.setAttribute("ry", "10");
    svg.append(central, pair);
  });
}

interface Part {
  element: HTMLSpanElement;
  text: Text;
}

function createPart(name: string, document: Document): Part {
  const element = document.createElement("span");
  element.className = "hud-position__part";
  element.dataset.positionPart = name;
  const text = document.createTextNode("");
  element.append(text);
  return { element, text };
}

function setText(part: Part, value: string): void {
  if (part.text.data !== value) part.text.data = value;
}

/**
 * The toolbar's position: latitude, longitude, altitude, then whatever the host
 * adds. How the first two are marked, and what the altitude is measured from
 * and written in, are the `interface.position.*` parameters, followed live.
 */
export function createPositionReadout(element: HTMLElement, settings: SettingsRegistry, options: PositionReadoutOptions = {}): PositionReadoutHandle {
  const document = options.document ?? element.ownerDocument;
  const latitude = createPart("latitude", document);
  const longitude = createPart("longitude", document);
  const altitude = createPart("altitude", document);
  const rest = createPart("rest", document);
  // One line of text inside the chip, so the spaces between readings are the font's own.
  const line = document.createElement("span");
  line.className = "hud-position";
  element.replaceChildren(line);
  let last: PositionReading | null = null;
  let drawnLabels: CoordinateLabels | null = null;
  let drawnParts = "";
  let destroyed = false;
  let seaLevelNote = "";
  function seaLevel(reading: PositionReading): number | null {
    seaLevelNote = "";
    if ((reading.heightDatum ?? "geoid") === "geoid") return 0;
    const grid = settings.has(POSITION_SEA_LEVEL_GRID_ID) ? settings.get<string>(POSITION_SEA_LEVEL_GRID_ID) : null;
    const value = options.seaLevel?.read(reading, grid);
    seaLevelNote = value?.note ?? "Sea level data is unavailable.";
    return value?.baseMeters ?? null;
  }

  function draw(): void {
    if (destroyed || !last) return;
    const labels = settings.get<CoordinateLabels>(POSITION_COORDINATE_LABELS_ID);
    if (labels !== drawnLabels) {
      drawnLabels = labels;
      latitude.element.replaceChildren(...(labels === "icons" ? [createLatitudeIcon(document)] : []), latitude.text);
      longitude.element.replaceChildren(...(labels === "icons" ? [createLongitudeIcon(document)] : []), longitude.text);
    }
    const { latDeg, lonDeg } = last;
    setText(latitude, `${labels === "words" ? "lat " : ""}${Math.abs(latDeg).toFixed(4)}°${latDeg >= 0 ? "N" : "S"}`);
    setText(longitude, `${labels === "words" ? "lon " : ""}${Math.abs(lonDeg).toFixed(4)}°${lonDeg >= 0 ? "E" : "W"}`);
    const shown = [latitude, longitude];
    if (last.altitudeMeters !== undefined) {
      const reference = settings.get<AltitudeReference>(POSITION_ALTITUDE_ID);
      const base = reference === "agl" ? last.groundHeightMeters ?? null : seaLevel(last);
      setText(altitude, formatAltitude(last.altitudeMeters, base, reference, settings.get<AltitudeUnit>(POSITION_ALTITUDE_UNIT_ID)));
      // Why a dash, for whoever points at it.
      const note = base !== null ? "" : reference === "agl" ? "No terrain below has loaded yet."
        : seaLevelNote;
      if (altitude.element.title !== note) altitude.element.title = note;
      shown.push(altitude);
    }
    if (last.rest) {
      setText(rest, last.rest);
      shown.push(rest);
    }
    const parts = shown.map(part => part.element.dataset.positionPart).join(" ");
    if (parts !== drawnParts) {
      drawnParts = parts;
      line.replaceChildren(...shown.flatMap((part, index) => index === 0 ? [part.element] : [" ", part.element]));
    }
  }

  const stopWatching = [POSITION_COORDINATE_LABELS_ID, POSITION_ALTITUDE_ID, POSITION_ALTITUDE_UNIT_ID, POSITION_SEA_LEVEL_GRID_ID]
    .filter(id => settings.has(id))
    .map(id => settings.watch(id, draw));
  const stopSeaLevel = options.seaLevel?.subscribe?.(draw);

  return {
    update(reading) {
      if (destroyed) return;
      last = reading;
      draw();
    },
    needsGroundHeight: () => settings.get<AltitudeReference>(POSITION_ALTITUDE_ID) === "agl",
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopSeaLevel?.();
      for (const stop of stopWatching) stop();
      element.replaceChildren();
    },
  };
}
