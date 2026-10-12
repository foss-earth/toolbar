// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { createNorthButton } from "./northButton.js";

function mount(): { button: HTMLButtonElement; svg: SVGSVGElement } {
  const button = document.createElement("button");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  button.append(svg);
  document.body.append(button);
  return { button, svg };
}

describe("north button", () => {
  const handles: Array<{ destroy(): void }> = [];
  afterEach(() => {
    for (const handle of handles) handle.destroy();
    handles.length = 0;
    document.body.replaceChildren();
  });

  it("drops the press outline once the view leaves north", () => {
    const { button, svg } = mount();
    const north = createNorthButton(svg);
    handles.push(north);
    button.focus();
    button.click();
    north.update(0);
    expect(document.activeElement).toBe(button);

    north.update(0.4);
    expect(document.activeElement).toBe(button);
    north.update(359.7);
    expect(document.activeElement).toBe(button);

    north.update(2);
    expect(document.activeElement).not.toBe(button);
  });

  it("keeps keyboard focus while the view is turned", () => {
    const { button, svg } = mount();
    const north = createNorthButton(svg);
    handles.push(north);
    button.focus();
    north.update(40);
    expect(document.activeElement).toBe(button);
  });
});
