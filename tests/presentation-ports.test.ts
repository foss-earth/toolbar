// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createExternalLinkIcon } from "@foss-earth/ui/browser";
import { attachMapDownloadSpeed, setMapSourceLabel } from "../src/browser/mapDownloadHud.js";
import { createHelpModal } from "../src/browser/helpModal.js";
import { createSceneHud, type SceneHudState } from "../src/browser/sceneHud.js";

describe("toolbar presentation host ports", () => {
  it("allocates map and scene readouts in the supplied element's Document", () => {
    const ownDocument = document.implementation.createHTMLDocument("Host");
    const map = ownDocument.createElement("button"); map.textContent = "Host map";
    const offRate = vi.fn();
    const detach = attachMapDownloadSpeed(map, { getMapDownloadBytesPerSecond: () => 2_000_000, onMapDownloadRateChange: () => offRate });
    const speed = map.querySelector(".map-download-speed");
    expect(speed?.ownerDocument).toBe(ownDocument);
    expect(speed?.textContent).toBe("002MB/s");
    setMapSourceLabel(map, "Next map"); expect(map.querySelector(".map-download-speed")).toBe(speed);
    let push: (state: SceneHudState) => void = () => {};
    const offScene = vi.fn(), icon = vi.fn(createExternalLinkIcon);
    const hud = createSceneHud({ container: ownDocument.createElement("span"), mapSource: map, createExternalLinkIcon: icon,
      controller: { subscribe(listener) { push = listener; listener({ status: null }); return offScene; } },
    });
    push({ status: { phase: "immersive", credits: [{ text: "Host source", url: "https://example.org/source" }] } });
    expect(hud.element.ownerDocument).toBe(ownDocument); expect(icon).toHaveBeenCalledWith(ownDocument);
    expect(hud.element.querySelector("svg")?.ownerDocument).toBe(ownDocument);
    expect(map.hidden).toBe(true); hud.destroy(); expect(map.hidden).toBe(false); expect(offScene).toHaveBeenCalledOnce();
    detach(); expect(offRate).toHaveBeenCalledOnce();
  });

  it("keeps help visibility and dismiss actions on the supplied modal and detaches handlers", () => {
    const modal = document.createElement("div"), dismiss = document.createElement("button"), child = document.createElement("span");
    dismiss.id = "helpModalDismiss"; modal.append(dismiss, child);
    const help = createHelpModal(modal);
    help.show(); child.click(); expect(modal.hidden).toBe(false);
    dismiss.click(); expect(modal.hidden).toBe(true);
    help.show(); modal.click(); expect(modal.hidden).toBe(true);
    help.show(); help.hide(); expect(modal.hidden).toBe(true);
    help.destroy(); help.show(); dismiss.click(); modal.click(); expect(modal.hidden).toBe(false);
  });
});
