export interface NorthButtonHandle {
  update(headingDeg: number): void;
  destroy(): void;
}

/** Still north-up: a fraction of a degree, so a resting camera does not flicker the press outline. */
const NORTH_RELEASE_DEG = 0.5;

/** Shortest turn away from north, in degrees. 0 and 360 are the same heading. */
function degreesFromNorth(headingDeg: number): number {
  const wrapped = ((headingDeg % 360) + 360) % 360;
  return Math.min(wrapped, 360 - wrapped);
}

/**
 * Attaches a heading-tracking rotation to the north button's inner SVG.
 * Uses shortest-path angular interpolation to avoid snapping at the 0/360 boundary.
 *
 * A tap leaves the button focused, and Firefox on Android keeps that focus
 * outline after the finger lifts. The outline means "this press put the view
 * north-up", so it goes once the heading leaves north. Keyboard focus is left
 * alone until the button is actually pressed.
 */
export function createNorthButton(svg: SVGElement): NorthButtonHandle {
  const button = svg.closest("button");
  let currentAngle = 0;
  let releaseFocusWhenTurned = false;

  const armFocusRelease = (): void => { releaseFocusWhenTurned = true; };
  button?.addEventListener("click", armFocusRelease);

  function update(headingDeg: number): void {
    const target = -headingDeg;
    let delta = target - currentAngle;
    // Wrap delta into [-180, 180] for the shortest rotation path
    delta = ((delta + 180) % 360 + 360) % 360 - 180;
    currentAngle += delta;
    svg.style.transform = `rotate(${currentAngle}deg)`;

    if (!releaseFocusWhenTurned || !button || degreesFromNorth(headingDeg) <= NORTH_RELEASE_DEG) return;
    releaseFocusWhenTurned = false;
    if (button.ownerDocument.activeElement === button) button.blur();
  }

  function destroy(): void {
    button?.removeEventListener("click", armFocusRelease);
    svg.style.transform = "";
  }

  return { update, destroy };
}
