// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { createHudBar } from "./hudBar";

describe("createHudBar", () => {
  it("renders buttons, menus, and status slots from configuration", () => {
    const root = document.createElement("div");
    const handle = createHudBar(root, {
      items: [
        { kind: "button", id: "controls", title: "Controls", ariaLabel: "Controls", text: "?" },
        {
          kind: "menu",
          id: "maps",
          className: "map-source-control",
          button: {
            kind: "button",
            id: "mapButton",
            title: "Map source",
            ariaLabel: "Map source",
            className: "hud-chip hud-chip-button",
            text: "Map",
          },
          menuId: "mapMenu",
          menuClassName: "map-source-menu",
          optionClassName: "map-source-option",
          optionDataAttribute: "mapSource",
          options: [{ id: "osm", label: "OpenStreetMap" }],
        },
        { kind: "slot", id: "status", className: "hud-chip", ariaLive: "polite" },
      ],
    });

    expect(handle.element.classList.contains("hud-bar")).toBe(true);
    expect(handle.getElement("controls")?.textContent).toBe("?");
    expect(handle.getElement("mapMenu")?.hidden).toBe(true);
    expect(handle.element.querySelector("[data-map-source='osm']")?.textContent).toBe("OpenStreetMap");
    expect(handle.getElement("status")?.getAttribute("aria-live")).toBe("polite");
  });

  it("supports custom button content and cleanup", () => {
    const root = document.createElement("div");
    const content = vi.fn(() => document.createElement("svg"));
    const handle = createHudBar(root, {
      items: [{ kind: "button", id: "north", title: "North", ariaLabel: "North", content }],
    });

    expect(content).toHaveBeenCalledOnce();
    expect(handle.getElement("north")?.querySelector("svg")).not.toBeNull();
    handle.destroy();
    expect(root.children).toHaveLength(0);
  });
});