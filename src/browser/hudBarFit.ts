/** Where the bar's end sits. Off keeps the corner; the other two join the toolbar. */
export type HudBarEndPlace = "off" | "when-full" | "always";

export function hudBarEndPlace(value: unknown): HudBarEndPlace {
  return value === "when-full" || value === "always" ? value : "off";
}

export interface HudBarFitOptions {
  /** Read on each fit. Omitted means the end stays in the corner. */
  endPlace?: () => HudBarEndPlace;
}

export interface HudBarFitItem {
  element: HTMLElement;
  /** Lower numbers get the available space first. */
  priority: number;
  /** Essential controls and items the user explicitly enabled may wrap. */
  keepVisible?: boolean;
  /** Always reserve this control's room before credit, even after its priority changes. */
  essential?: boolean;
  /** Shorten credit text to leave room for this item before fitting the row. */
  reserveSpace?: boolean;
  onFit?(visible: boolean): void;
}

/** Borrow the host's scheduling, geometry and observation authorities. */
export interface HudBarLayoutPorts {
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(handle: number): void;
  computedStyle(element: HTMLElement): Pick<CSSStyleDeclaration, "columnGap"> & Partial<Pick<CSSStyleDeclaration, "paddingLeft" | "paddingRight" | "borderLeftWidth" | "borderRightWidth">>;
  createResizeObserver?(changed: () => void): Pick<ResizeObserver, "observe" | "unobserve" | "disconnect"> | null;
  observeMutations(element: HTMLElement, changed: () => void): () => void;
  subscribeResize(changed: () => void): () => void;
}

/** The app passes its own browser realm; this factory reads nothing on import. */
export function browserHudBarLayoutPorts(window: Window & typeof globalThis): HudBarLayoutPorts {
  return {
    requestFrame: callback => window.requestAnimationFrame(callback),
    cancelFrame: handle => window.cancelAnimationFrame(handle),
    computedStyle: element => window.getComputedStyle(element),
    createResizeObserver: changed => typeof window.ResizeObserver === "undefined" ? null : new window.ResizeObserver(changed),
    observeMutations(element, changed) {
      const observer = new window.MutationObserver(changed);
      observer.observe(element, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });
      return () => observer.disconnect();
    },
    subscribeResize(changed) { window.addEventListener("resize", changed); return () => window.removeEventListener("resize", changed); },
  };
}

function horizontalInset(style: Pick<CSSStyleDeclaration, "columnGap"> & Partial<Pick<CSSStyleDeclaration, "paddingLeft" | "paddingRight" | "borderLeftWidth" | "borderRightWidth">>): number {
  return [style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth]
    .reduce((sum, value) => sum + (Number.parseFloat(value ?? "") || 0), 0);
}

function defaultLayoutPorts(bar: HTMLElement): HudBarLayoutPorts {
  const window = bar.ownerDocument.defaultView;
  if (!window) throw new TypeError("HUD fitting without a browser realm requires explicit host layout ports.");
  return browserHudBarLayoutPorts(window as Window & typeof globalThis);
}

/**
 * Fit automatic items into one row before the bar's right end. Overflow items
 * remain measurable, but invisible and outside the flex layout, so a resize or
 * changing readout can bring them back without temporarily showing another row.
 * The end stays in the corner unless the host joins it to the toolbar. Joining
 * when the row is full puts it directly after the last item that fits. Always
 * joining keeps it there even when the corner has room. A pinned control that
 * does not fit takes the row off that edge, and the end stays on the first row.
 */
export function fitHudBar(bar: HTMLElement, end: HTMLElement, readItems: () => readonly HudBarFitItem[], ports: HudBarLayoutPorts = defaultLayoutPorts(bar), options: HudBarFitOptions = {}): { update(): void; destroy(): void } {
  bar.classList.add("hud-bar--fitted");
  let frame: number | null = null;
  let disposed = false;
  const observed = new Set<HTMLElement>();
  const managed = new Map<HTMLElement, string>();
  const originalEndMaxWidth = end.style.maxWidth;
  const originalEndOrder = end.style.order;
  const schedule = (): void => {
    if (!disposed && frame === null) frame = ports.requestFrame(() => {
      frame = null;
      update();
    });
  };
  const resize = ports.createResizeObserver?.(schedule) ?? null;
  resize?.observe(bar);
  resize?.observe(end);

  function update(): void {
    if (disposed) return;
    const items = [...readItems()].sort((a, b) => a.priority - b.priority);
    const current = new Set(items.map(item => item.element));
    for (const [element, order] of managed) {
      if (current.has(element)) continue;
      element.removeAttribute("data-hud-overflow-hidden");
      element.style.order = order;
      managed.delete(element);
    }
    for (const element of observed) {
      if (current.has(element)) continue;
      resize?.unobserve(element);
      observed.delete(element);
    }
    for (const [index, item] of items.entries()) {
      if (!managed.has(item.element)) managed.set(item.element, item.element.style.order);
      // Ranks preserve the caller's order on ties, even for nested flex items.
      item.element.style.order = String(index);
      if (!observed.has(item.element)) {
        resize?.observe(item.element);
        observed.add(item.element);
      }
    }
    const barStyle = ports.computedStyle(bar);
    // Flex lays items out in the content box. The border box includes the
    // split bar's padding, and counting that padding fits a provider that then wraps.
    const width = bar.getBoundingClientRect().width - horizontalInset(barStyle);
    // Unmounted tabs and DOM-only tests have no usable geometry yet.
    if (width <= 0) return;
    const gap = Number.parseFloat(barStyle.columnGap) || 0;
    const available = items.filter(item => !item.element.closest("[hidden]"));
    const widths = new Map(available.map(item => [item, item.element.getBoundingClientRect().width]));
    // Leave room for the core controls even when attribution text is long.
    // Manual extras still use their own widths and may wrap after fitting.
    const required = available.filter(item => item.essential);
    // Keep the existing helper contract for callers without an explicit anchor.
    if (required.length === 0) {
      const first = available.find(item => item.keepVisible);
      if (first) required.push(first);
    }
    const requiredSet = new Set(required);
    const reservationWidth = (entries: readonly HudBarFitItem[]): number =>
      entries.reduce((sum, item) => sum + widths.get(item)!, 0) + entries.length * gap;
    /** Place the toolbar. `includeEnd` keeps the provider on that same row; otherwise the row is the toolbar's alone. */
    const commit = (includeEnd: boolean): void => {
      let reserved = available.filter(item => item.reserveSpace || requiredSet.has(item));
      let reservedWidth = reservationWidth(reserved);
      // A newly high-ranked wide readout must not consume the credit's entire
      // allocation. Fall back to the mandatory controls and fit the rest normally.
      const reserveRequiredOnly = (): void => {
        reserved = required;
        reservedWidth = reservationWidth(reserved);
      };
      let endWidth = 0;
      if (includeEnd) {
        if (reservedWidth >= width) reserveRequiredOnly();
        const measureEnd = (): number => {
          end.style.maxWidth = `${Math.max(0, width - reservedWidth)}px`;
          const measured = end.getBoundingClientRect().width;
          // The detail rail and credit link cannot shrink as much as their text.
          // Count overflowing content; scrollWidth rounds to an integer, so allow
          // its rounding error before treating it as actual overflow.
          return end.scrollWidth > measured + 1 ? end.scrollWidth : measured;
        };
        endWidth = measureEnd();
        if (endWidth + reservedWidth > width && reserved.some(item => !requiredSet.has(item))) {
          reserveRequiredOnly();
          endWidth = measureEnd();
        }
      } else {
        end.style.maxWidth = "";
      }
      // A manual extra may need another row. Keep the core row's controls when
      // they fit beside the credit on their own, rather than spending their
      // budget on the extra and hiding them just because it wraps.
      const reservedFit = !includeEnd || endWidth + reservedWidth <= width;
      const reservedSet = new Set(reserved);
      const fixed = available.filter(item => item.keepVisible || item.essential || (reservedSet.has(item) && reservedFit));
      const alwaysVisible = new Set(fixed);
      let used = endWidth + fixed.reduce((sum, item) => sum + widths.get(item)!, 0);
      let count = fixed.length + (endWidth > 0 ? 1 : 0);
      used += Math.max(0, count - 1) * gap;
      let full = false;
      for (const item of available) {
        let visible = alwaysVisible.has(item);
        if (!visible && !full) {
          const next = used + widths.get(item)! + (count > 0 ? gap : 0);
          visible = next <= width;
          if (visible) { used = next; count++; }
          else full = true;
        }
        item.element.toggleAttribute("data-hud-overflow-hidden", !visible);
        item.onFit?.(visible);
      }
      // The provider stays on the first row. Off keeps the corner and the gap.
      // When the row is full, or always, it is the last toolbar item instead.
      const visible = available.filter(item => !item.element.hasAttribute("data-hud-overflow-hidden"));
      const endLayoutWidth = includeEnd ? end.getBoundingClientRect().width : 0;
      let rowUsed = endLayoutWidth;
      let rowCount = endLayoutWidth > 0 ? 1 : 0;
      let fitted = 0;
      for (const item of visible) {
        const next = rowUsed + widths.get(item)! + (rowCount > 0 ? gap : 0);
        if (next <= width) {
          rowUsed = next;
          rowCount += 1;
          fitted += 1;
        } else break;
      }
      const overflows = fitted < visible.length;
      const place = hudBarEndPlace(options.endPlace?.());
      const join = place === "always" || (place === "when-full" && (overflows || available.some(item => item.element.hasAttribute("data-hud-overflow-hidden"))));
      bar.classList.toggle("hud-bar--end-attached", join);
      if (!overflows) {
        end.style.order = originalEndOrder;
        return;
      }
      const lastOrder = fitted > 0 ? Number(visible[fitted - 1]!.element.style.order) : -1;
      end.style.order = String(lastOrder + 1);
      for (const item of items) {
        const order = Number(item.element.style.order);
        if (order > lastOrder) item.element.style.order = String(order + 1);
      }
    };
    // The detail rail and provider stay in this row. A full-width break would put them under it.
    bar.classList.remove("hud-bar--end-joined");
    commit(true);
  }

  const stopMutations = ports.observeMutations(bar, schedule);
  const stopResize = ports.subscribeResize(schedule);
  update();
  return {
    update: schedule,
    destroy() {
      disposed = true;
      if (frame !== null) ports.cancelFrame(frame);
      resize?.disconnect();
      stopMutations();
      stopResize();
      for (const [element, order] of managed) {
        element.removeAttribute("data-hud-overflow-hidden");
        element.style.order = order;
      }
      end.style.maxWidth = originalEndMaxWidth;
      end.style.order = originalEndOrder;
      bar.classList.remove("hud-bar--fitted", "hud-bar--end-joined", "hud-bar--end-attached");
    },
  };
}
