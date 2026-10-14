// @vitest-environment jsdom

import { expect, it } from "vitest";
import { createSettingsRegistry } from "@foss-earth/ui/settings";
import { POSITION_PARAMETERS } from "../settings.js";
import { createStatusHud } from "./statusHud.js";

it("shows live sphere orientation and FOV at the picture's position, then restores globe distance", () => {
  const settings = createSettingsRegistry({ storage: null });
  settings.register(POSITION_PARAMETERS);
  const chip = document.createElement("button");
  const hud = createStatusHud(chip, settings);
  const picturePosition = { latDeg: 44.9778, lonDeg: -93.265 };
  const pictureAltitude = { altitudeMeters: 268, groundHeightMeters: 266, heightDatum: "geoid" as const };

  try {
    hud.update({ ...picturePosition, headingDeg: 17.2, pitchDeg: 5.4, verticalFovDeg: 74.6 }, pictureAltitude);
    expect(chip.textContent).toBe("44.9778°N 93.2650°W 268m ASL h017° p05° FOV 75°");

    hud.update({ ...picturePosition, headingDeg: -10, pitchDeg: -12, verticalFovDeg: 45.2 }, pictureAltitude);
    expect(chip.textContent).toBe("44.9778°N 93.2650°W 268m ASL h350° p-12° FOV 45°");

    hud.update({ latDeg: 45, lonDeg: -93, headingDeg: 90, pitchDeg: 71, zoomMeters: 600 }, {
      altitudeMeters: 1200,
      groundHeightMeters: 250,
      heightDatum: "geoid",
    });
    expect(chip.textContent).toBe("45.0000°N 93.0000°W 1200m ASL h090° p71° z600m");
  } finally {
    hud.destroy();
  }
});

it("replaces the globe altitude with an explicitly unknown picture height", () => {
  const settings = createSettingsRegistry({ storage: null });
  settings.register(POSITION_PARAMETERS);
  const chip = document.createElement("button");
  const hud = createStatusHud(chip, settings);
  const view = { latDeg: 44.9778, lonDeg: -93.265, headingDeg: 0, pitchDeg: 0, zoomMeters: 600 };

  try {
    hud.update(view, { altitudeMeters: 1200, groundHeightMeters: 250, heightDatum: "geoid" });
    hud.update({ ...view, verticalFovDeg: 75 }, { altitudeMeters: null, groundHeightMeters: null, heightDatum: "ellipsoid" });
    expect(chip.textContent).toBe("44.9778°N 93.2650°W —m ASL h000° p00° FOV 75°");
    expect(chip.querySelector<HTMLElement>('[data-position-part="altitude"]')!.title).toBe("Height is unknown.");
  } finally {
    hud.destroy();
  }
});

it("keeps picture and ground height datums distinct for sphere AGL", () => {
  const settings = createSettingsRegistry({ storage: null });
  settings.register(POSITION_PARAMETERS);
  settings.set("interface.position.altitude", "agl");
  const chip = document.createElement("button");
  const hud = createStatusHud(chip, settings, { seaLevel: { read: () => ({ baseMeters: -25 }) } });

  try {
    hud.update({ latDeg: 44.9778, lonDeg: -93.265, headingDeg: 17, pitchDeg: 5, verticalFovDeg: 75 }, {
      altitudeMeters: 275,
      heightDatum: "ellipsoid",
      groundHeightMeters: 250,
      groundHeightDatum: "geoid",
    });
    expect(chip.textContent).toBe("44.9778°N 93.2650°W 50m AGL h017° p05° FOV 75°");
  } finally {
    hud.destroy();
  }
});
