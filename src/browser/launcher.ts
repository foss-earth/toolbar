/** Workspace/context policy is supplied by the host; no tab list is copied. */
export interface ToolbarLauncherPort<TabId extends string = string> {
  tabId: TabId;
  toggleTab(id: TabId): void;
  isTabOpen?(id: TabId): boolean;
  subscribe?(listener: () => void): () => void;
}
/** Native button keys are left to the browser; unused keys/gestures propagate. */
export function bindToolbarLauncher<TabId extends string>(button: HTMLButtonElement, port: ToolbarLauncherPort<TabId>): () => void {
  let disposed = false;
  const sync = (): void => { if (!disposed && port.isTabOpen) button.setAttribute("aria-pressed", String(port.isTabOpen(port.tabId))); };
  const click = (): void => { if (!disposed) port.toggleTab(port.tabId); };
  sync();
  const stop = port.subscribe?.(sync);
  button.addEventListener("click", click);
  return () => {
    if (disposed) return;
    disposed = true;
    button.removeEventListener("click", click);
    stop?.();
  };
}
