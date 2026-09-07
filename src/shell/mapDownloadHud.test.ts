// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { attachMapDownloadSpeed, setMapSourceLabel } from "./mapDownloadHud";

describe("map download readout", () => {
  it("stacks a fixed three-digit value above the unit and survives provider-label updates without replacing its element", () => {
    const button = document.createElement("button");
    button.textContent = "USGS Imagery";
    let change: (bytes: number) => void = () => {};
    const off = vi.fn();
    const detach = attachMapDownloadSpeed(button, {
      getMapDownloadBytesPerSecond: () => 0,
      onMapDownloadRateChange: (listener) => { change = listener; return off; },
    });
    const speed = button.querySelector(".map-download-speed");
    expect(speed?.textContent).toBe("000MB/s");
    expect(speed?.querySelector(".map-download-value")?.textContent).toBe("000");
    expect(speed?.querySelector(".map-download-unit")?.textContent).toBe("MB/s");
    change(12_000_000);
    expect(speed?.textContent).toBe("012MB/s");
    setMapSourceLabel(button, "Google 3D Tiles");
    expect(button.querySelector(".map-download-speed")).toBe(speed);
    expect(button.firstElementChild?.textContent).toBe("Google 3D Tiles");
    expect(button.lastElementChild).toBe(speed);
    change(123_000_000);
    expect(speed?.textContent).toBe("123MB/s");
    change(1_000_000_000);
    expect(speed?.textContent).toBe("+++MB/s");
    change(0);
    expect(speed?.textContent).toBe("000MB/s");
    detach();
    expect(off).toHaveBeenCalledOnce();
    expect(button.textContent).toBe("Google 3D Tiles");
  });
});
