# @foss-earth/toolbar

Private staging candidate 0.1.0 for `foss-earth/toolbar`, extracted from committed
Earth `90e23b3ee96f53ec5900afc5991a21fffa58649d`. It owns bottom HUD layout,
launcher/readout presentation and Interface sections. World camera/navigation,
map/terrain/geoid calculations, input interpretation, renderer measurements,
feature state and the host's thirteen tab/context rules remain with their owners.

| Entry | Public contract |
| --- | --- |
| `@foss-earth/toolbar` | Pure settings schemas, stable parameter identifiers, visibility/migration, coordinate/altitude/performance formatting and browser-port types. |
| `@foss-earth/toolbar/browser` | `createHudBar`, `fitHudBar`, `bindToolbarLauncher`, position/status/performance/north readout presentation, renderer/tile-streaming activity bindings, map download readout, help visibility, supplied scene-credit HUD, fullscreen and Interface section factories. |
| `@foss-earth/toolbar/legacy` | Deprecated static menu construction for old import compatibility only; no popup/open actions. Normal toolbar items are buttons and slots. |
| `@foss-earth/toolbar/styles.css` | Generic bottom offsets, paragraph flex wrapping, chip/button/position/theme styles. Host end slot uses `.hud-bar-end`. |

Pure imports have no runtime dependency on UI, React, DOM globals or renderer
initialization. Browser modules initialize only when the host calls them. UI's
public `SettingsRegistry`, `ParameterSpec` and panel-factory types are consumed
through type-only imports. The exact optional UI peer is 0.1.0. The current
Interface factories require UI's new explicit refresh contract, so the earlier
frozen foundation archive is prior evidence only; a newly checked exact UI
archive is required before current consumers can qualify.

The host supplies `createHudBar(container, { items, document, observeHeight? })` configuration. Each button
has a stable ID and accessible label; readout slots accept host-written values.
DOM allocation and the height property use the supplied document, defaulting to
`container.ownerDocument`. Optional height observation borrows the host's
existing observer; the compatible default uses that document's browser realm.
`fitHudBar(bar, hostEnd, readItems, layoutPorts)` retains the current essential/reserved-space,
stable-priority, auto single-row and explicitly enabled wrapping behavior.
`browserHudBarLayoutPorts(window)` adapts an explicitly supplied browser realm;
custom `HudBarLayoutPorts` inject frame scheduling, style measurements,
resize/mutation observation and resize notifications. The compatible three-argument
call derives the realm from `bar.ownerDocument.defaultView`; a detached document
requires explicit ports. No second renderer or frame authority is created.
`readToolbarFitItems` and `bindToolbarFit` also retain the current on/auto/off,
Auto/Custom priority and first-two reserved-control policy with supplied element
lookups. They keep scene/context `[hidden]` independent of user choice and
restore owned choice-hidden attributes on disposal. Fitting uses requestAnimationFrame only to coalesce DOM layout updates, never for world
rendering. `destroy()` disconnects observers/listeners, cancels pending layout,
restores original CSS order/end width and removes the bar height variable.

Bind launchers with `bindToolbarLauncher(button, { tabId, toggleTab,
isTabOpen?, subscribe? })`. The host decides tab availability, workspace
placement and context actions. Each button toggles the existing tab, never a
second settings menu. Native buttons retain their own activation keys. Toolbar
installs no global key handler and cancels no unused key, swipe, pinch or wheel;
the host retains its existing `controlTakesKey`/world propagation adapter.
Hiding a button never hides its tab, available through the host + launcher.

`createToolbarParameters(hostItems)` returns visibility and priority specs for
registration into the host's one registry. Every spec keeps its Interface /
Toolbar home, on/auto/off choices, true/false legacy normalization, 0–99 priority
bounds and Auto/Custom switch. Host descriptors supply feature labels, IDs,
default priorities and reasons; `fixtures/earth-toolbar.json` preserves the
current seventeen priorities and eight button/eight metric visibility IDs.
`loadHudButtonVisibility(settings)` / `saveHudButtonVisibility(settings, values)`
require the supplied registry. Register then explicitly call
`settings.migrateLegacy([HUD_BUTTON_VISIBILITY_MIGRATION, PERFORMANCE_HUD_VISIBILITY_MIGRATION])`; the unchanged
`foss-earth.hudButtons` key migrates false→off and named choices, leaves old
true/default intent automatic, and never deletes rollback records. The performance
migration preserves only differences from the old FPS and memory defaults;
the `foss-earth.performanceMetricVisibility` array key is retained for rollback.

`POSITION_PARAMETERS` contains the unchanged coordinate labels, ASL/AGL and
metres/feet presentation specs. The host owns `interface.position.seaLevelGrid`
and terrain resource policy. Supply sea-level data through:

```ts
createPositionReadout(element, settings, {
  document: element.ownerDocument,
  seaLevel: {
    read: (reading, selectedGrid) => ({ baseMeters: null, note: "Loading the sea level grid." }),
    subscribe: listener => hostSeaLevel.subscribe(listener),
  },
});
```

Position/status helpers default to the supplied element's document. Standalone
`createLatitudeIcon(document)` and `createLongitudeIcon(document)` accept an
explicit document; their old zero-argument browser calls remain compatible.
`renderPerformanceChips(element, snapshot, visibleMetrics, document?)` allocates
in the supplied document or `element.ownerDocument` and retains existing chip
nodes. These new host-realm cases and installed fixtures are prepared but unrun.

The port returns base height in the reading's datum, or null while unavailable.
Only ellipsoid ASL readings use it; geoid heights use zero and AGL uses the
host's ground height. The host owns acquisition, generation checks, caches,
errors and notifications. Formatting is unchanged, including minus geoid
height, feet conversion, coordinate icons, dash/readiness notes and retained DOM
nodes. Destroy detaches settings and host subscriptions and ignores late pushes.
`createStatusHud` consumes structural host view/camera readings;
`renderPerformanceChips` formats supplied snapshots without collecting metrics
or starting timers. `createNorthButton` rotates a supplied SVG and owns no camera
action. Input method controls/sensitivity/gestures remain engine-owned.

`attachRendererActivity(element, source)` retains the existing `is-rendering`
class, `data-render-state` and Rendering/Idle title, using the host's structural
`RenderActivitySource` (`isRendering`, `onActiveRenderChange`). Adapt the existing
renderer scheduler explicitly; no scheduler is created or stopped:

```ts
const detachActivity = attachRendererActivity(rendererButton, {
  isRendering: () => scheduler.isActive(),
  onActiveRenderChange: listener => scheduler.onActiveChange(listener),
});
const detachStreaming = attachTileStreamingActivity(mapButton, globeRuntime);
```

`TileStreamingSource` requires `isStreamingTiles` and `onTilesStreamingChange`,
matching the supplied globe runtime. It retains `is-streaming` independently of
render activity and shows loads already in progress. Both bindings mutate only
the supplied element in its own Document, subscribe once, read current state,
and create no element, polling timer, renderer or frame request. Detach is
idempotent, ignores late/reentrant notifications and restores the original render
title even if host unsubscribe throws. Failed initial state reads release the
acquired subscription and restore presentation. A source that throws before
returning its disposer must roll back its own partial subscription; the stale
listener is still inert. Avoid multiple bindings owning the same activity class
or render title on one element. HUD activity CSS retains the existing compositor
animation and reduced-motion rules, with no JavaScript animation clock.

`attachMapDownloadSpeed(button, source)` and `setMapSourceLabel(button, text)`
retain the existing three-digit decimal MB/s readout, explicit `+++` overflow,
accessible rate description and provider-label updates without replacing the
speed node. `MapDownloadSource` supplies `getMapDownloadBytesPerSecond` and
`onMapDownloadRateChange`; subscriptions remain host-owned. New spans use the
supplied button's `ownerDocument`. These signatures directly satisfy engine's
public Map-source HUD UI ports.

`createHelpModal(modal)` retains `show`, `hide` and `destroy`, the existing dismiss
button ID and overlay-only click dismissal. It creates no modal or navigation.
The host supplies the existing modal content and launch action.

`createSceneHud({ controller, container, createExternalLinkIcon, mapSource?,
mapOnly? })` presents supplied `status.phase` and `status.credits` only. Its
structural source has `subscribe(listener) => unsubscribe`; there is no Scenes,
360, navigation or renderer dependency. Pass UI's public
`createExternalLinkIcon(document)` factory. Every element is created in
`container.ownerDocument`. The existing immersive-only map-group hiding,
credit/source links, labels, classes and unchanged-credit node retention are
preserved. Scenes owns envelopes/placements/navigation; the host passes its
controller as structural data. Disposal restores map elements as in the prior
app. These presentations start no timer, renderer or frame request.

Fullscreen keeps the old `osfs.fullscreen-every-visit` and
`osfs.fullscreen-prompt-dismissed` keys. Preference helpers optionally accept
explicit storage; omitted storage preserves browser behavior. Hosts may inject
`FullscreenLauncherPort` into `attachFullscreenButton`; browser defaults retain
standard/WebKit capability and user-gesture request behavior. No automatic
fullscreen prompt or navigation is added.

`createToolbarInterfaceSection(settings, { createParameterSection, refresh,
document, main?, covers?, panelStorage? })` receives UI's public factory and the
host's existing reading-refresh subscription and Document explicitly. It starts
no timer, creates its note in that Document and forwards the same Document to
UI's factory and controls. The prepared installed fixture uses one JSDOM realm;
this source preparation is not cross-realm qualification. It creates
Interface → Toolbar with the current hidden-button note and host-owned theme
controls. `createPositionInterfaceSection` composes the position home the same
way; the host registers and contributes its resource specs there. UI owns generic
widgets/section persistence. CSS does not import feature/map/scene/log styles or
set page overscroll policy; those stay with their owners.

For migration, adapt singleton visibility calls to require settings, add the
host sea-level port instead of `loadGeoid`, supply host descriptors and the UI
factory, and mark the existing arbitrary attribution slot `.hud-bar-end`.
Mixed CSS is split by responsibility; map/scene attribution/detail/content and
provider/content-specific resource styles must remain in their owner stylesheet. Compatibility
facades must resolve one settings implementation and one renderer authority.
Old records can still be read by the prior app; no prior source or evidence is
removed. Coordinator lineage/provenance records preserve source authorship;
source copying alone does not meet publication/history acceptance.

Run checks only in the coordinator's assigned window:

```sh
npm run ci
```

The scripts use incremental `node_modules/.tmp` caches, cached lint and exact
Vitest 4.1.6 with at most 50% workers. Set `TOOLBAR_CONSUMER_ARCHIVES` to an
explicit complete archive-closure JSON: `{version:1,packages:[{name,version,
archive,sha256,bytes}]}`. Paths resolve relative to that JSON. Supply actual
Toolbar/UI0.1.0, TypeScript5.9.3, jsdom29.1.1 and every runtime/type transitive
archive with exact versions, digests and sizes. The harness packs no source or
ancestor tooling. It installs offline with scripts disabled, verifies installed
versions, rejects realpath runtime/declaration escapes, checks negative isolation
and pure-peer controls, imports every entry with forbidden browser-global
getters, verifies CSS, exercises actual public Toolbar/UI section refresh and
disposal plus launcher input propagation, and compiles strict public declarations.
Logs and
artifacts stay under dated build/checks and build/consumer paths. A source
migration/performance/readout/launcher fixture suite supplements retained
HUD-fit/fullscreen/coordinate tests. No server, GPU/native/WASM build or benchmark
is authorized here. Checks have not run yet; no Node/OS support range is claimed.

The shared CI source/caller is pinned to reviewed
9e046dd482e0229dc7c7b2d71b079d5905664656; installation and actual common
conformance/full intended-ref checks remain queued. Metadata checks include
docs-only changes. Coordinator
source lineage, exact public export/revision pins, cleaned selected-ref audit,
remote admission and consumer application adoption are outstanding. No flight,
campus, platform destinations, root app/barrels/catalogues/lockfile are edited.


## Project policies

- [Code of conduct](CODE_OF_CONDUCT.md)
- [Contributing](CONTRIBUTING.md)
- [AGPL-3.0 license](LICENSE)
- [Security](SECURITY.md)

The community documents now use the user's sentence-case contribution policy
in a later CONTRIBUTING section, with the vendor-advertising rationale and human
responsibility. The frozen common-CI pin above still describes the earlier
uppercase policy bytes. Its prior checks cannot qualify the changed rule;
Platform must deliver the next checked exact shared pin and this owner must run
that common conformance before acceptance. No checker or digest is bypassed.
