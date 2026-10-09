// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createHudBar, HUD_BAR_HEIGHT_PROPERTY } from "./hudBar.js";
describe("generic HUD construction", () => {
  it("mounts host launchers/readouts and publishes measured height", () => {
    const container = document.createElement("div");
    const hud = createHudBar(container, { items: [{ kind: "button", id: "settings", title: "Settings", ariaLabel: "Settings", text: "⚙" }, { kind: "slot", id: "host-reading", ariaLive: "polite" }] });
    expect(hud.getElement("settings")?.textContent).toBe("⚙");
    expect(hud.getElement("host-reading")?.getAttribute("aria-live")).toBe("polite");
    expect(document.documentElement.style.getPropertyValue(HUD_BAR_HEIGHT_PROPERTY)).toBe("0px");
    expect(hud.element.querySelector("[role='menu']")).toBeNull();
    hud.destroy();
    expect(container.children.length).toBe(0);
    expect(document.documentElement.style.getPropertyValue(HUD_BAR_HEIGHT_PROPERTY)).toBe("");
  });
});
