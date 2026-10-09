/** Structural interface keeps the HUD independent of the rendering engine. */
export interface RenderActivitySource {
  isRendering(): boolean;
  onActiveRenderChange(listener: (active: boolean) => void): () => void;
}

/** Reflect scheduler activity directly; no polling or animation loop while idle. */
export function attachRendererActivity(button: HTMLElement, source: RenderActivitySource): () => void {
  const originalTitle = button.title;
  return bindActivity(
    listener => source.onActiveRenderChange(listener),
    () => source.isRendering(),
    active => {
      button.classList.toggle("is-rendering", active);
      button.dataset.renderState = active ? "rendering" : "idle";
      button.title = `${originalTitle} ${active ? "Rendering" : "Idle — rendering on demand"}.`;
    },
    () => {
      button.classList.remove("is-rendering");
      delete button.dataset.renderState;
      button.title = originalTitle;
    },
  );
}

export interface TileStreamingSource {
  isStreamingTiles(): boolean;
  onTilesStreamingChange(listener: (streaming: boolean) => void): () => void;
}

/** Bind tile loading independently of render activity, including loads already in progress. */
export function attachTileStreamingActivity(button: HTMLElement, source: TileStreamingSource): () => void {
  return bindActivity(
    listener => source.onTilesStreamingChange(listener),
    () => source.isStreamingTiles(),
    streaming => { button.classList.toggle("is-streaming", streaming); },
    () => { button.classList.remove("is-streaming"); },
  );
}

/** Own only this presentation subscription and the supplied element's activity state. */
function bindActivity(
  subscribe: (listener: (active: boolean) => void) => () => void,
  read: () => boolean,
  update: (active: boolean) => void,
  restore: () => void,
): () => void {
  let disposed = false;
  let unsubscribe: (() => void) | undefined;
  const listener = (active: boolean): void => { if (!disposed) update(active); };
  const detach = (): void => {
    if (disposed) return;
    disposed = true;
    try { unsubscribe?.(); } finally { restore(); }
  };
  try {
    unsubscribe = subscribe(listener);
    listener(read());
  } catch (error) {
    try { detach(); } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Toolbar activity startup and cleanup failed.");
    }
    throw error;
  }
  return detach;
}
