import type { SettingsRegistry } from "@foss-earth/ui/settings";
import {
  POSITION_ALTITUDE_ID, POSITION_ALTITUDE_UNIT_ID, POSITION_COORDINATE_LABELS_ID, POSITION_SEA_LEVEL_GRID_ID,
  formatAltitude, type AltitudeReference, type AltitudeUnit, type CoordinateLabels, type PositionHeightDatum,
} from "../position.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface PositionReading {
  latDeg: number;
  lonDeg: number;
  /** The height, in metres, measured from `heightDatum`. Null shows an unknown height; left out, the readout shows no altitude. */
  altitudeMeters?: number | null;
  /** The height of the ground directly below, measured from `groundHeightDatum`; null while no terrain there has loaded. */
  groundHeightMeters?: number | null;
  /**
   * What the altitude is measured from.
   * Over the ellipsoid, the altitude above sea level takes the geoid's height
   * away. Sea level when left out.
   */
  heightDatum?: PositionHeightDatum;
  /** What the ground's height is measured from; `heightDatum` when omitted. */
  groundHeightDatum?: PositionHeightDatum;
  /** What follows the position, such as "h017° p71° z600m". */
  rest?: string;
}

export interface PositionReadoutHandle {
  update(reading: PositionReading): void;
  /** Whether the altitude shown needs `groundHeightMeters`: `interface.position.altitude` is above ground. */
  needsGroundHeight(): boolean;
  /** Latitude, longitude and altitude can be edited where they are drawn. */
  setEditable(editable: boolean): void;
  destroy(): void;
}

/** A committed edit of one reading. Altitude `value` is metres. */
export interface PositionCommit {
  part: "latitude" | "longitude" | "altitude";
  /** Signed degrees, or altitude in metres. Left out when that number did not change. */
  value?: number;
  /** Set when the altitude's ASL/AGL choice changed. */
  reference?: AltitudeReference;
}

/** Sea-level data/resources remain host-owned. Unknown data is explicit. */
export interface PositionSeaLevelPort {
  read(reading: PositionReading, grid: string | null): { baseMeters: number | null; note?: string };
  /** The host calls listeners after its data changes; no toolbar poller. */
  subscribe?(listener: () => void): () => void;
}
export interface PositionReadoutOptions {
  seaLevel?: PositionSeaLevelPort;
  document?: Document;
  onCommit?(commit: PositionCommit): void;
}

const METERS_PER_FOOT = 0.3048;

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
  let editable = false;
  let seaLevelNote = "";
  let editor: HTMLFormElement | null = null;
  let editorPart: Part | null = null;
  const editableParts = [latitude, longitude, altitude];
  function seaLevel(reading: PositionReading): number | null {
    seaLevelNote = "";
    if ((reading.heightDatum ?? "geoid") === "geoid") return 0;
    const grid = settings.has(POSITION_SEA_LEVEL_GRID_ID) ? settings.get<string>(POSITION_SEA_LEVEL_GRID_ID) : null;
    const value = options.seaLevel?.read(reading, grid);
    seaLevelNote = value?.note ?? "Sea level data is unavailable.";
    return value?.baseMeters ?? null;
  }

  function groundHeight(reading: PositionReading): number | null {
    const ground = reading.groundHeightMeters ?? null;
    const altitudeDatum = reading.heightDatum ?? "geoid";
    if (ground === null || (reading.groundHeightDatum ?? altitudeDatum) === altitudeDatum) return ground;
    // Sea level's ellipsoid height converts between ellipsoid and geoid heights.
    const offset = seaLevel({ ...reading, heightDatum: "ellipsoid" });
    if (offset === null) return null;
    return altitudeDatum === "ellipsoid" ? ground + offset : ground - offset;
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
      const heightUnknown = last.altitudeMeters === null;
      const base = heightUnknown ? null : reference === "agl" ? groundHeight(last) : seaLevel(last);
      setText(altitude, formatAltitude(last.altitudeMeters, base, reference, settings.get<AltitudeUnit>(POSITION_ALTITUDE_UNIT_ID)));
      // Why a dash, for whoever points at it.
      const note = heightUnknown ? "Height is unknown." : base !== null ? "" : reference === "agl" && last.groundHeightMeters == null ? "No terrain below has loaded yet."
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

  function relativeMeters(): number | null {
    if (!last || last.altitudeMeters == null) return null;
    const reference = settings.get<AltitudeReference>(POSITION_ALTITUDE_ID);
    const base = reference === "agl" ? groundHeight(last) : seaLevel(last);
    return base === null ? null : last.altitudeMeters - base;
  }

  function markEditable(): void {
    for (const part of editableParts) part.element.classList.toggle("hud-position__part--editable", editable);
  }

  let closingEditor = false;
  function closeEditor(): void {
    if (closingEditor) return;
    closingEditor = true;
    document.removeEventListener("pointerdown", onOutside, true);
    document.removeEventListener("keydown", onKey);
    const form = editor;
    editor = null;
    editorPart?.element.classList.remove("hud-position__part--editing");
    editorPart = null;
    form?.remove();
    closingEditor = false;
  }

  function onOutside(event: PointerEvent): void {
    const target = event.target;
    if (!(target instanceof Node) || editor?.contains(target) || editorPart?.element.contains(target)) return;
    commitEditor(true);
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === "Escape") closeEditor();
  }

  function placeEditor(): void {
    if (!editor || !editorPart) return;
    const rect = editorPart.element.getBoundingClientRect();
    const height = editor.offsetHeight;
    const above = rect.top - height - 6;
    editor.style.left = `${Math.max(4, rect.left)}px`;
    editor.style.top = `${above >= 4 ? above : rect.bottom + 6}px`;
  }

  function commitEditor(close: boolean): void {
    if (closingEditor || !editor || !editorPart || !last) return;
    const input = editor.querySelector("input");
    const select = editor.querySelector("select");
    if (!input || !select) return;
    const part = editorPart.element.dataset.positionPart;
    const typed = input.value.trim();
    if (part === "altitude") {
      const unit = settings.get<AltitudeUnit>(POSITION_ALTITUDE_UNIT_ID);
      const opened = input.dataset.opened ?? "";
      const reference = select.value === "agl" ? "agl" : "asl";
      const referenceChanged = reference !== settings.get<AltitudeReference>(POSITION_ALTITUDE_ID);
      let value: number | undefined;
      if (typed !== "" && typed !== opened) {
        const magnitude = Number(typed);
        if (!Number.isFinite(magnitude)) { if (close) closeEditor(); return; }
        value = unit === "ft" ? magnitude * METERS_PER_FOOT : magnitude;
      }
      if (value !== undefined || referenceChanged) options.onCommit?.({ part: "altitude", ...(value === undefined ? {} : { value }), ...(referenceChanged ? { reference } : {}) });
    } else if (part === "latitude" || part === "longitude") {
      const current = part === "latitude" ? last.latDeg : last.lonDeg;
      const limit = part === "latitude" ? 90 : 180;
      const magnitude = typed === "" ? Math.abs(current) : Math.abs(Number(typed));
      if (!Number.isFinite(magnitude) || magnitude > limit) { if (close) closeEditor(); return; }
      const negative = select.value === "S" || select.value === "W";
      const value = negative && magnitude !== 0 ? -magnitude : magnitude;
      if (value !== current) options.onCommit?.({ part, value });
    }
    if (close) closeEditor();
  }

  function openEditor(part: Part): void {
    if (!editable || !last || destroyed || editorPart === part) return;
    const name = part.element.dataset.positionPart;
    if (name !== "latitude" && name !== "longitude" && name !== "altitude") return;
    closeEditor();
    editorPart = part;
    part.element.classList.add("hud-position__part--editing");
    const form = document.createElement("form");
    form.className = "hud-position-editor";
    form.addEventListener("submit", (event) => { event.preventDefault(); commitEditor(true); });
    form.addEventListener("focusout", (event) => {
      const next = event.relatedTarget;
      if (next instanceof Node && form.contains(next)) return;
      commitEditor(true);
    });
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    const select = document.createElement("select");
    const addOption = (value: string, label: string): void => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    };
    if (name === "latitude") {
      input.setAttribute("aria-label", "Latitude");
      input.value = Math.abs(last.latDeg).toFixed(4);
      select.setAttribute("aria-label", "Latitude hemisphere");
      addOption("N", "N");
      addOption("S", "S");
      select.value = last.latDeg < 0 ? "S" : "N";
    } else if (name === "longitude") {
      input.setAttribute("aria-label", "Longitude");
      input.value = Math.abs(last.lonDeg).toFixed(4);
      select.setAttribute("aria-label", "Longitude hemisphere");
      addOption("E", "E");
      addOption("W", "W");
      select.value = last.lonDeg < 0 ? "W" : "E";
    } else {
      const unit = settings.get<AltitudeUnit>(POSITION_ALTITUDE_UNIT_ID);
      const relative = relativeMeters();
      input.setAttribute("aria-label", "Altitude");
      input.value = relative === null ? "" : unit === "ft" ? String(Math.round(relative / METERS_PER_FOOT)) : String(Math.round(relative));
      input.dataset.opened = input.value;
      select.setAttribute("aria-label", "Altitude reference");
      addOption("asl", "ASL");
      addOption("agl", "AGL");
      select.value = settings.get<AltitudeReference>(POSITION_ALTITUDE_ID);
    }
    input.addEventListener("input", () => {
      if (input.value.trim().startsWith("-")) {
        input.value = input.value.trim().replace(/^-/, "");
        const flip: Record<string, string> = { N: "S", S: "N", E: "W", W: "E" };
        if (flip[select.value]) select.value = flip[select.value];
      }
      input.style.width = `calc(${Math.max(input.value.length, 1)}ch + 8px)`;
    });
    input.style.width = `calc(${Math.max(input.value.length, 1)}ch + 8px)`;
    select.addEventListener("change", () => commitEditor(false));
    form.append(input, select);
    editor = form;
    document.body.append(form);
    placeEditor();
    input.focus();
    input.select();
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onKey);
  }

  function onPartPointerDown(event: PointerEvent): void {
    if (!editable) return;
    const part = editableParts.find(item => item.element === event.currentTarget);
    if (!part) return;
    event.preventDefault();
    event.stopPropagation();
    openEditor(part);
  }

  function onPartClick(event: MouseEvent): void {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
  }

  for (const part of editableParts) {
    part.element.addEventListener("pointerdown", onPartPointerDown);
    part.element.addEventListener("click", onPartClick);
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
      if (editor) placeEditor();
    },
    needsGroundHeight: () => settings.get<AltitudeReference>(POSITION_ALTITUDE_ID) === "agl",
    setEditable(next) {
      editable = next;
      markEditable();
      if (!next) closeEditor();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      closeEditor();
      stopSeaLevel?.();
      for (const stop of stopWatching) stop();
      for (const part of editableParts) {
        part.element.removeEventListener("pointerdown", onPartPointerDown);
        part.element.removeEventListener("click", onPartClick);
      }
      element.replaceChildren();
    },
  };
}
