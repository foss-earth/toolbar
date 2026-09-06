// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { attachRendererActivity, type RenderActivitySource } from "./rendererActivity";

describe("attachRendererActivity", () => {
  it("reflects scheduler activity and restores the button on cleanup", () => {
    let listener: ((active: boolean) => void) | null = null;
    const unsubscribe = vi.fn();
    const source: RenderActivitySource = {
      isRendering: () => false,
      onActiveRenderChange: (nextListener) => {
        listener = nextListener;
        return unsubscribe;
      },
    };
    const button = document.createElement("button");
    button.title = "WebGPU renderer.";

    const detach = attachRendererActivity(button, source);

    expect(button.classList.contains("is-rendering")).toBe(false);
    expect(button.dataset.renderState).toBe("idle");
    expect(button.title).toContain("Idle");

    listener?.(true);
    expect(button.classList.contains("is-rendering")).toBe(true);
    expect(button.dataset.renderState).toBe("rendering");
    expect(button.title).toContain("Rendering");

    detach();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(button.classList.contains("is-rendering")).toBe(false);
    expect(button.dataset.renderState).toBeUndefined();
    expect(button.title).toBe("WebGPU renderer.");
  });
});