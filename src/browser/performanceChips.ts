import { PERFORMANCE_METRIC_DEFINITIONS, type PerformanceMetricId, type ToolbarPerformanceSnapshot } from "../performance.js";

/** One polygon, the mark for a mesh: a single drawn surface. */
function polygonIcon(document: Document): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "perf-chip__icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("d", "M12 3.5 20 9.1 17 20H7L4 9.1Z");
  svg.append(path);
  return svg;
}

export function renderPerformanceChips(
  element: HTMLElement,
  snapshot: ToolbarPerformanceSnapshot,
  visibleMetrics: ReadonlySet<PerformanceMetricId>,
  document: Document = element.ownerDocument,
): void {
  const existing = new Map(Array.from(element.children, (child) => [
    (child as HTMLElement).dataset.perfMetric, child as HTMLElement,
  ]));
  const chips = PERFORMANCE_METRIC_DEFINITIONS.flatMap((metric) => {
    if (!visibleMetrics.has(metric.id)) return [];
    const value = metric.format(snapshot);
    if (value === null) return [];

    const chip = existing.get(metric.id) ?? document.createElement("span");
    chip.className = `hud-chip perf-chip${metric.id === "fps" ? " perf-chip--fps" : ""}`;
    chip.dataset.perfMetric = metric.id;
    chip.title = metric.tooltip;
    chip.setAttribute("aria-label", `${metric.settingsLabel}: ${value}`);
    if (metric.id === "fps") {
      let number = chip.querySelector<HTMLElement>(".perf-chip__value");
      if (!number) {
        number = document.createElement("span");
        number.className = "perf-chip__value";
        const unit = document.createElement("span");
        unit.className = "perf-chip__unit";
        unit.textContent = "fps";
        chip.append(number, unit);
      }
      if (number.textContent !== value) number.textContent = value;
    } else if (metric.mark === "polygon") {
      let number = chip.querySelector<HTMLElement>(".perf-chip__value");
      if (!number) {
        number = document.createElement("span");
        number.className = "perf-chip__value";
        chip.replaceChildren(polygonIcon(document), number);
      }
      if (number.textContent !== value) number.textContent = value;
    } else if (chip.textContent !== value) chip.textContent = value;
    return chip;
  });

  // Keep retained chips mounted so CSS animations are not restarted each frame.
  const retained = new Set(chips);
  for (const child of existing.values()) {
    if (!retained.has(child)) child.remove();
  }
  let cursor = element.firstChild;
  for (const chip of chips) {
    if (chip === cursor) cursor = cursor.nextSibling;
    else element.insertBefore(chip, cursor);
  }
}
