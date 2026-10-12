// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createExternalLinkIcon } from "@foss-earth/ui/browser";
import { createSceneHud, type SceneHudState, type SceneHudSource, type SceneHudCredit } from "./sceneHud.js";

afterEach(() => document.body.replaceChildren());

function mount() {
  const slot = document.createElement("span");
  const mapSource = document.createElement("span");
  slot.append(mapSource);
  document.body.append(slot);
  let listener: (state: SceneHudState) => void = () => {};
  const controller = {
    subscribe(next: (state: SceneHudState) => void) { listener = next; next({ status: null }); return () => {}; },
  } as SceneHudSource;
  const position = document.createElement("button");
  document.body.append(position);
  const hud = createSceneHud({ controller, container: slot, mapSource, mapOnly: [position], createExternalLinkIcon });
  const show = (phase: string, credits: readonly SceneHudCredit[] = []) =>
    listener({ status: { phase, credits } });
  return { slot, mapSource, position, hud, show };
}

const CREDIT = { assetId: "a", text: "Greg Zaal", license: "CC0", url: "https://polyhaven.com/a/buikslotermeerplein" };

describe("the panorama's end of the HUD bar", () => {
  it("replaces the map's group with the panorama's credit while entered, with no close button", () => {
    const { slot, mapSource, position, hud, show } = mount();
    expect(hud.element.hidden).toBe(true);
    expect(slot.firstElementChild).toBe(hud.element);

    show("immersive", [CREDIT]);
    expect(hud.element.hidden).toBe(false);
    expect(mapSource.hidden).toBe(true);
    expect(position.hidden).toBe(true);
    expect(hud.element.querySelector("button")).toBeNull();
    const credit = hud.element.querySelector<HTMLAnchorElement>("#sceneCreditsSlot a.scene-credit-chip")!;
    expect(credit.textContent).toBe("Greg Zaal · CC0");
    expect(credit.href).toBe(CREDIT.url);
    expect(credit.rel).toBe("noopener noreferrer");
    expect(credit.querySelector("svg.foss-earth-external-link-icon")).not.toBeNull();

    show("overview", [CREDIT]);
    expect(hud.element.hidden).toBe(true);
    expect(mapSource.hidden).toBe(false);
    expect(position.hidden).toBe(false);
  });

  it("shows the University of Minnesota's mark in place of the Regents copyright line", () => {
    const { hud, show } = mount();
    show("immersive", [{ text: "\u00a9 Regents of the University of Minnesota" }]);
    const chip = hud.element.querySelector<HTMLElement>("#sceneCreditsSlot .scene-credit-chip")!;
    const images = [...chip.querySelectorAll("img")];
    expect(images.map(image => image.alt)).toEqual([
      "\u00a9 Regents of the University of Minnesota",
      "\u00a9 Regents of the University of Minnesota",
    ]);
    expect(images.map(image => image.getAttribute("src"))).toEqual([
      expect.stringContaining("FFCC33"),
      expect.stringContaining("7A0019"),
    ]);
    expect(chip.textContent).toBe("");
    expect(chip.title).toBe("\u00a9 Regents of the University of Minnesota");
    hud.destroy();
  });

  it("leaves the map's group alone while a panorama is prepared or entered, when the map still shows", () => {
    const { mapSource, hud, show } = mount();
    show("entering", [CREDIT]);
    expect(hud.element.hidden).toBe(true);
    expect(mapSource.hidden).toBe(false);
    hud.destroy();
    expect(hud.element.isConnected).toBe(false);
    expect(mapSource.hidden).toBe(false);
  });
});
