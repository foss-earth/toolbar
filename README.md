# @foss-earth/toolbar

The bottom HUD for FOSS Earth: bar layout, launcher buttons, readouts and the Interface settings sections. It is part of [FOSS Earth](https://github.com/foss-earth), a browser globe app built with TypeScript, React and Babylon.js.

This package owns presentation only. Camera and navigation, map/terrain/geoid calculations, input handling, renderer measurements, feature state and the host's tab and context rules stay with the host and its other libraries. The host passes in everything the toolbar shows or acts on.

## Entry points

| Entry | What it provides |
| --- | --- |
| `@foss-earth/toolbar` | Settings schemas, stable parameter IDs, visibility settings and migrations, coordinate/altitude/performance formatting, and the types for the browser ports. |
| `@foss-earth/toolbar/browser` | `createHudBar`, `fitHudBar`, `bindToolbarLauncher`, position, status, performance and north readouts, renderer and tile-streaming activity bindings, map download readout, help modal, scene-credit HUD, fullscreen helpers and the Interface section factories. |
| `@foss-earth/toolbar/legacy` | Deprecated static menu construction, kept for old imports. It has no popup or open actions. |
| `@foss-earth/toolbar/styles.css` | Bottom offsets, flex wrapping, and chip, button, position and theme styles. The host's end slot uses `.hud-bar-end`. |

The root entry has no dependency on React, DOM globals or renderer initialization. Browser modules do nothing until the host calls them. Types from [`@foss-earth/ui`](https://github.com/foss-earth/ui) (`SettingsRegistry`, `ParameterSpec`, the panel factories) are imported as types only, and the UI package is an optional peer dependency.

## Using it

### HUD bar and fitting

`createHudBar(container, { items, document, observeHeight? })` builds the bar. Each button has a stable ID and an accessible label, and readout slots take values written by the host. DOM nodes and the bar height CSS variable use the supplied document, which defaults to `container.ownerDocument`. `observeHeight` lets the host reuse an existing observer.

`fitHudBar(bar, hostEnd, readItems, layoutPorts)` decides what fits: essential and reserved space, stable priority order, automatic single-row layout, and wrapping when enabled. `browserHudBarLayoutPorts(window)` builds layout ports for a browser window. Custom `HudBarLayoutPorts` inject frame scheduling, style measurement, resize and mutation observation, and resize notifications. Called with three arguments, `fitHudBar` takes the window from `bar.ownerDocument.defaultView`; a detached document needs explicit ports.

`readToolbarFitItems` and `bindToolbarFit` apply the on/auto/off choice, the Auto/Custom priority and the rule that the first two controls are reserved. Scene and context `[hidden]` state is independent of the user's choice. Fitting uses `requestAnimationFrame` only to batch layout updates, never for world rendering. `destroy()` disconnects observers and listeners, cancels pending layout, restores the original CSS order and end width, and removes the height variable.

### Launchers

```ts
bindToolbarLauncher(button, { tabId, toggleTab, isTabOpen?, subscribe? });
```

The host decides which tabs exist, where they go and what context actions apply. Each launcher toggles an existing tab. The toolbar installs no global key handler and cancels no key, swipe, pinch or wheel input. Hiding a button does not hide its tab, which stays reachable by other means.

### Visibility and priority settings

`createToolbarParameters(hostItems)` returns the visibility and priority specs to register in the host's settings registry. Each spec lives under Interface / Toolbar and has on/auto/off choices, a 0 to 99 priority and an Auto/Custom switch. Old true/false values are normalized. The host's descriptors supply labels, IDs, default priorities and reasons. `fixtures/earth-toolbar.json` holds the values used by FOSS Earth: seventeen priorities, eight button and eight metric visibility IDs.

`loadHudButtonVisibility(settings)` and `saveHudButtonVisibility(settings, values)` need the registry passed in. After registering, call:

```ts
settings.migrateLegacy([HUD_BUTTON_VISIBILITY_MIGRATION, PERFORMANCE_HUD_VISIBILITY_MIGRATION]);
```

The `foss-earth.hudButtons` key migrates false to off and named choices; old true or default values become automatic. Rollback records are never deleted. The performance migration keeps only differences from the old FPS and memory defaults, and the `foss-earth.performanceMetricVisibility` array key is kept for rollback.

### Position, status and performance readouts

`POSITION_PARAMETERS` holds the coordinate labels, ASL/AGL and metres/feet specs. The host owns `interface.position.seaLevelGrid` and terrain resource policy, and supplies sea-level data through a port:

```ts
createPositionReadout(element, settings, {
  document: element.ownerDocument,
  seaLevel: {
    read: (reading, selectedGrid) => ({ baseMeters: null, note: "Loading the sea level grid." }),
    subscribe: listener => hostSeaLevel.subscribe(listener),
  },
});
```

`read` returns the base height in the reading's datum, or null while unavailable. Ellipsoid ASL readings use it; geoid ASL heights use zero. AGL uses the host's ground height, with optional `groundHeightDatum` defaulting to the altitude's `heightDatum`. When their datums differ, the readout asks the sea-level port for the ellipsoid-geoid offset and converts the ground height before subtracting; a missing offset shows a dash until the host subscription reports readiness. The host handles acquisition, caching, errors and change notification. An `altitudeMeters` of null shows an unknown height as a dash and needs no sea-level lookup; leaving it out hides the altitude. The readout keeps its DOM nodes between updates and formats the minus-geoid height, feet conversion, coordinate icons and dash/readiness notes. `destroy` detaches settings and host subscriptions and ignores later pushes.

- `createStatusHud` reads structural view and camera readings from the host. A view reading with `verticalFovDeg` shows `FOV` in degrees instead of the globe's `z` distance; the host supplies the picture's position and altitude and the live sphere heading, pitch and field of view.
- `renderPerformanceChips(element, snapshot, visibleMetrics, document?)` formats a supplied snapshot and reuses existing chip nodes. It collects no metrics and starts no timers.
- `createNorthButton` rotates a supplied SVG. The camera action belongs to the host.
- `createLatitudeIcon(document)` and `createLongitudeIcon(document)` take an explicit document; calling them with no argument still works.

### Renderer and tile activity

`attachRendererActivity(element, source)` sets the `is-rendering` class, `data-render-state` and a Rendering/Idle title from a `RenderActivitySource` (`isRendering`, `onActiveRenderChange`). `attachTileStreamingActivity` does the same with `is-streaming` for a `TileStreamingSource` (`isStreamingTiles`, `onTilesStreamingChange`), independent of render activity.

```ts
const detachActivity = attachRendererActivity(rendererButton, {
  isRendering: () => scheduler.isActive(),
  onActiveRenderChange: listener => scheduler.onActiveChange(listener),
});
const detachStreaming = attachTileStreamingActivity(mapButton, globeRuntime);
```

Both bindings change only the supplied element, subscribe once, read the current state and create no elements, timers, renderers or frame requests. Detaching is idempotent, ignores late or reentrant notifications, and restores the original title even if the host's unsubscribe throws. A failed initial read releases its subscription. A source that throws before returning its disposer must roll back its own partial subscription. Don't bind two activity bindings to the same class or title on one element. The CSS animation runs on the compositor and respects reduced motion; there is no JavaScript animation clock.

### Map download readout

`attachMapDownloadSpeed(button, source)` shows a three-digit decimal MB/s rate, `+++` on overflow and an accessible description. `setMapSourceLabel(button, text)` updates the provider label without replacing the speed node. `MapDownloadSource` supplies `getMapDownloadBytesPerSecond` and `onMapDownloadRateChange`. New spans are created in the button's `ownerDocument`.

### Help modal

`createHelpModal(modal)` returns `show`, `hide` and `destroy`. Only a click on the overlay or the dismiss button closes it. The host supplies the modal content and the action that opens it.

### Scene credits

`createSceneHud({ controller, container, createExternalLinkIcon, mapSource?, mapOnly? })` shows the `status.phase` and `status.credits` the host controller supplies. The controller needs only `subscribe(listener) => unsubscribe`. Pass the UI package's `createExternalLinkIcon(document)`. Elements are created in `container.ownerDocument`. The HUD hides map groups in immersive mode, renders credit and source links, and keeps unchanged credit nodes. Disposal restores the map elements. It starts no timers, renderers or frame requests.

### Fullscreen

The fullscreen preferences use the `osfs.fullscreen-every-visit` and `osfs.fullscreen-prompt-dismissed` storage keys. The helpers accept an explicit storage object and otherwise use the browser's. `attachFullscreenButton` accepts a `FullscreenLauncherPort`; the default handles standard and WebKit fullscreen and requires a user gesture. Nothing prompts for fullscreen or navigates on its own.

### Interface sections

```ts
createToolbarInterfaceSection(settings, { createParameterSection, refresh, document, main?, covers?, panelStorage? });
```

The host passes the UI package's panel factory, its reading-refresh subscription and a document. The section is Interface / Toolbar, with the note about hidden buttons and the host's theme controls. It starts no timers and creates its note in the supplied document. `createPositionInterfaceSection` builds the position section the same way, and the host registers and contributes its resource specs there. Generic widgets and section persistence belong to the UI package. The CSS imports no feature, map, scene or log styles and sets no page overscroll policy.

## Development

This package's own `npm install`, tests and build don't work on their own yet, because it names `@foss-earth/ui` by a version that isn't published. Libraries are normally developed through the app, which uses them straight from their checkouts. See [local source](https://github.com/foss-earth/app#local-source).

## License

AGPL-3.0-only. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Third-party packages, map and terrain data, online services and trademarks have their own notices and terms.

## Project policies

- [Code of conduct](https://github.com/foss-earth/.github/blob/main/CODE_OF_CONDUCT.md)
- [Contributing](https://github.com/foss-earth/.github/blob/main/CONTRIBUTING.md)
- [AGPL-3.0 license](LICENSE)
- [Security](https://github.com/foss-earth/.github/blob/main/SECURITY.md)
