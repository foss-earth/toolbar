// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { attachRendererActivity, attachTileStreamingActivity, type RenderActivitySource, type TileStreamingSource } from "../src/browser/rendererActivity.js";

describe("injected toolbar activity lifecycle", () => {
  it("shows an existing tile load independently of rendering and detaches once", () => {
    const button = document.createElement("button"); button.title = "Renderer.";
    let render: (active: boolean) => void = () => {}; let stream: (active: boolean) => void = () => {};
    const stopRender = vi.fn(), stopStream = vi.fn();
    const detachRender = attachRendererActivity(button, { isRendering: () => false, onActiveRenderChange: listener => { render = listener; return stopRender; } });
    const detachStream = attachTileStreamingActivity(button, { isStreamingTiles: () => true, onTilesStreamingChange: listener => { stream = listener; return stopStream; } });
    expect(button.classList.contains("is-streaming")).toBe(true);
    expect(button.dataset.renderState).toBe("idle");
    render(true); stream(false);
    expect(button.classList.contains("is-rendering")).toBe(true);
    expect(button.classList.contains("is-streaming")).toBe(false);
    detachStream(); detachStream(); stream(true);
    expect(stopStream).toHaveBeenCalledOnce();
    expect(button.classList.contains("is-streaming")).toBe(false);
    expect(button.dataset.renderState).toBe("rendering");
    detachRender(); detachRender(); render(true);
    expect(stopRender).toHaveBeenCalledOnce();
    expect(button.classList.contains("is-rendering")).toBe(false);
    expect(button.dataset.renderState).toBeUndefined();
    expect(button.title).toBe("Renderer.");
  });

  it("ignores a synchronous stale render callback during unsubscribe and afterward", () => {
    const button = document.createElement("button"); button.title = "Host title.";
    let notify: (active: boolean) => void = () => {};
    const stop = vi.fn(() => { notify(true); });
    const detach = attachRendererActivity(button, { isRendering: () => true, onActiveRenderChange: listener => { notify = listener; return stop; } });
    detach(); notify(true); detach();
    expect(stop).toHaveBeenCalledOnce();
    expect(button.dataset.renderState).toBeUndefined();
    expect(button.classList.contains("is-rendering")).toBe(false);
    expect(button.title).toBe("Host title.");
  });

  it("restores render presentation even when the host unsubscribe throws", () => {
    const button = document.createElement("button"); button.title = "Host title.";
    let notify: (active: boolean) => void = () => {};
    const stop = vi.fn(() => { throw new Error("host stop"); });
    const detach = attachRendererActivity(button, { isRendering: () => true, onActiveRenderChange: listener => { notify = listener; return stop; } });
    expect(detach).toThrow("host stop");
    expect(detach).not.toThrow(); notify(true);
    expect(stop).toHaveBeenCalledOnce();
    expect(button.dataset.renderState).toBeUndefined();
    expect(button.classList.contains("is-rendering")).toBe(false);
    expect(button.title).toBe("Host title.");
  });

  it("restores tile presentation and ignores late callbacks if unsubscribe throws", () => {
    const button = document.createElement("button");
    let notify: (active: boolean) => void = () => {};
    const stop = vi.fn(() => { throw new Error("tile stop"); });
    const detach = attachTileStreamingActivity(button, { isStreamingTiles: () => true, onTilesStreamingChange: listener => { notify = listener; return stop; } });
    expect(detach).toThrow("tile stop");
    expect(detach).not.toThrow(); notify(true);
    expect(stop).toHaveBeenCalledOnce();
    expect(button.classList.contains("is-streaming")).toBe(false);
  });

  it("rolls back an acquired render subscription when its initial state read fails", () => {
    const button = document.createElement("button"); button.title = "Host title.";
    let notify: (active: boolean) => void = () => {};
    const stop = vi.fn();
    const source: RenderActivitySource = {
      isRendering: () => { throw new Error("read failed"); },
      onActiveRenderChange: listener => { notify = listener; listener(true); return stop; },
    };
    expect(() => attachRendererActivity(button, source)).toThrow("read failed"); notify(true);
    expect(stop).toHaveBeenCalledOnce();
    expect(button.dataset.renderState).toBeUndefined();
    expect(button.classList.contains("is-rendering")).toBe(false);
    expect(button.title).toBe("Host title.");
  });

  it("rolls back an acquired tile subscription when its initial state read fails", () => {
    const button = document.createElement("button"); let notify: (active: boolean) => void = () => {};
    const stop = vi.fn();
    const source: TileStreamingSource = {
      isStreamingTiles: () => { throw new Error("tile read failed"); },
      onTilesStreamingChange: listener => { notify = listener; listener(true); return stop; },
    };
    expect(() => attachTileStreamingActivity(button, source)).toThrow("tile read failed"); notify(true);
    expect(stop).toHaveBeenCalledOnce();
    expect(button.classList.contains("is-streaming")).toBe(false);
  });

  it("retains the startup error and cleanup error without leaving active presentation", () => {
    const button = document.createElement("button"); button.title = "Host title.";
    const failure = new Error("read failed"), cleanup = new Error("stop failed");
    const source: RenderActivitySource = { isRendering: () => { throw failure; }, onActiveRenderChange: listener => { listener(true); return () => { throw cleanup; }; } };
    let error: unknown;
    try { attachRendererActivity(button, source); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([failure, cleanup]);
    expect(button.classList.contains("is-rendering")).toBe(false);
    expect(button.dataset.renderState).toBeUndefined();
    expect(button.title).toBe("Host title.");
  });

  it("uses only the supplied element's realm and no ambient Document", () => {
    const ownDocument = document.implementation.createHTMLDocument("Host");
    const button = ownDocument.createElement("button"); button.title = "Host title.";
    vi.stubGlobal("document", undefined);
    try {
      const detach = attachRendererActivity(button, { isRendering: () => true, onActiveRenderChange: () => () => {} });
      expect(button.ownerDocument).toBe(ownDocument);
      expect(button.dataset.renderState).toBe("rendering");
      detach(); expect(button.title).toBe("Host title.");
    } finally { vi.unstubAllGlobals(); }
  });
});
