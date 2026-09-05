/** Structural interface keeps the HUD independent of the rendering engine. */
export interface RenderActivitySource {
  isRendering(): boolean;
  onActiveRenderChange(listener: (active: boolean) => void): () => void;
}

/** Reflect scheduler activity directly; no polling or animation loop while idle. */
export function attachRendererActivity(button: HTMLElement, source: RenderActivitySource): () => void {
  const originalTitle = button.title;
  const update = (active: boolean): void => {
    button.classList.toggle("is-rendering", active);
    button.dataset.renderState = active ? "rendering" : "idle";
    button.title = `${originalTitle} ${active ? "Rendering" : "Idle — rendering on demand"}.`;
  };
  const unsubscribe = source.onActiveRenderChange(update);
  update(source.isRendering());
  return () => {
    unsubscribe();
    button.classList.remove("is-rendering");
    delete button.dataset.renderState;
    button.title = originalTitle;
  };
}
