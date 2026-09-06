export interface MapDownloadSource {
  getMapDownloadBytesPerSecond(): number;
  onMapDownloadRateChange(listener: (bytesPerSecond: number) => void): () => void;
}

/** Update provider text without replacing the speed readout or animated button. */
export function setMapSourceLabel(button: HTMLElement, text: string): void {
  let label = button.querySelector<HTMLElement>(".map-source-label");
  if (!label) {
    label = document.createElement("span");
    label.className = "map-source-label";
    button.replaceChildren(label);
  }
  if (label.textContent !== text) label.textContent = text;
}

export function attachMapDownloadSpeed(button: HTMLElement, source: MapDownloadSource): () => void {
  if (!button.querySelector(".map-source-label")) setMapSourceLabel(button, button.textContent ?? "");
  const speed = document.createElement("span");
  speed.className = "map-download-speed";
  button.append(speed);
  const update = (bytes: number) => {
    const mb = Math.max(0, Number.isFinite(bytes) ? bytes / 1_000_000 : 0);
    // Three character numeric field; overflow is explicit rather than a false capped rate.
    const value = mb >= 1000 ? "+++" : String(Math.min(999, Math.round(mb))).padStart(3, "0");
    speed.textContent = `${value}\nMB/s`;
    speed.title = `Map data received: ${mb.toFixed(2)} MB/s (last second; browser cache may contribute)`;
    speed.setAttribute("aria-label", speed.title);
  };
  const unsubscribe = source.onMapDownloadRateChange(update);
  update(source.getMapDownloadBytesPerSecond());
  return () => { unsubscribe(); speed.remove(); };
}
