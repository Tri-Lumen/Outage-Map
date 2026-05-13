# Dashboard Customization — Improvement Plan

Targeted enhancements to the board, tiles, theming, and persistence layer
that make up the dashboard's customization surface. Scope is limited to
customization UX; data-source and alerting work lives in `ROADMAP.md`.

## Current State (for reference)

- `src/components/Dashboard.tsx` hosts the board toolbar, edit-mode toggle,
  add-tile popover, import slide-over, and tweaks panel.
- `src/hooks/useBoard.ts` owns the tile array, persisted under
  `outage-board-v3` in `localStorage`. Tile actions: `updateTile`,
  `removeTile`, `cycleResize`, `toggleDataPoint`, `addTile`, `swapTiles`,
  `resetBoard`.
- `src/components/TileGrid.tsx` renders a 6-column CSS grid; drag-and-drop
  is implemented as a pure swap (`onSwapTiles`) — there is no free
  positioning or collision resolution.
- `src/hooks/useTweaks.ts` persists `accent`, `density`, `showGridLines`,
  `tileRadius` under `outage-board-tweaks`. Six fixed accent swatches.
- `src/components/TweaksPanel.tsx` exposes the tweaks UI; theme list comes
  from `ThemeProvider`.
- `src/components/AddTilePopover.tsx` lists 7 buildable tile types plus an
  Import CTA.

## Gaps Identified

- Resize is a 6-preset cycle button — no freeform width/height.
- Drag-and-drop only swaps two tiles, so gaps in the grid stay forever.
- One global layout only — no named boards, no per-screen layouts.
- No undo/redo; one misclick on "Remove" in edit mode is permanent.
- No way to share a board with a teammate (no export/import of layout).
- Refresh interval is global; status-page and RSS tiles can't poll faster
  or slower than the rest.
- Six fixed accent swatches; no custom hex, no per-tile color, no auto
  (system) theme.
- No keyboard shortcuts and no `?` help.
- No tile-level filtering (Incident Feed can't filter by severity; Service
  Grid can't hide healthy services).
- No bulk operations in edit mode.

---

## Wave 1 — Quality-of-life wins (low risk, high value)

### 1. Undo / Redo for board edits
A single accidental "Remove" in edit mode is unrecoverable today.
- Wrap `useBoard` state in a history stack (capped at 50 snapshots).
- New actions: `undo()`, `redo()`. Bind to `Cmd/Ctrl+Z` and
  `Cmd/Ctrl+Shift+Z`.
- Toolbar buttons in `Dashboard.tsx` show enabled/disabled state.
- Touches: `src/hooks/useBoard.ts`, `src/components/Dashboard.tsx`.

### 2. Export / Import board layout
Round-trip the saved layout as JSON so users can share or back up.
- "Export" button in the Tweaks panel: downloads
  `outage-board.json` (board + tweaks).
- "Import" reads a file (or paste-from-clipboard fallback) and merges
  via `useBoard.setBoard` + `useTweaks.setTweak`.
- Validate with a tiny zod-like guard; refuse silently on bad shape.
- Touches: `src/hooks/useBoard.ts`, `src/hooks/useTweaks.ts`,
  `src/components/TweaksPanel.tsx`.

### 3. Keyboard shortcuts + `?` overlay
Power users want hands-on-keyboard navigation.
- `E` toggles edit, `A` opens Add Tile, `I` opens Import, `T` toggles
  Tweaks, `?` opens a shortcut cheat-sheet, `Esc` closes overlays.
- When edit mode is on: arrow keys move the focused tile by one cell,
  `Backspace` removes, `Cmd/Ctrl+D` duplicates.
- New `src/components/ShortcutsOverlay.tsx`; hook
  `src/hooks/useShortcuts.ts` wires `keydown` once on `Dashboard.tsx`.

### 4. Duplicate tile + rename tile
Two of the most-requested missing actions.
- `duplicateTile(id)` clones config/size and places below original;
  `renameTile(id, label)` writes `config.label` (or `null` to revert).
- Rename inline in edit mode (double-click the title) and via tile menu.
- Touches: `src/hooks/useBoard.ts`, `src/components/tiles/TileChrome.tsx`.

---

## Wave 2 — Layout engine

### 5. Free drag-to-position with auto-flow
Replace pure swap with collision-aware drag.
- Compute a new `(x, y)` from drag pointer; shift overlapping tiles
  down using the same compaction strategy as react-grid-layout.
- Keep swap-on-drop as a modifier (hold `Shift` to swap instead of
  reflow), preserving today's behavior.
- Touches: `src/components/TileGrid.tsx`; consider extracting a
  pure `src/lib/board/layout.ts` so logic is testable.

### 6. Freeform tile resize (corner / edge handles)
Drop the 6-preset cycle; let users drag corners.
- Resize handles rendered only in edit mode (bottom-right is enough for
  v1, all corners for v2). Snap to 1-cell increments, min `1x1`, max
  `6 × current-content-aware`.
- Keep `cycleResize` as a secondary right-click shortcut for muscle
  memory.
- Touches: `src/components/TileGrid.tsx`, CSS in `globals.css`.

### 7. "Tidy" / auto-arrange button
Single-click compaction to remove gaps left by deleted tiles.
- Implement a top-down bin-pack on `(x, y, w, h)`.
- Toolbar button next to "Edit board"; tooltip shows row delta saved.
- Touches: `src/lib/board/layout.ts` (shared with #5),
  `src/components/Dashboard.tsx`.

### 8. Responsive breakpoint layouts
Today a 6-column grid is forced on phones. Add a stored
mobile/tablet/desktop layout per board.
- Extend `TileConfig` with `layouts: { mobile?, tablet?, desktop? }`
  where each entry is `{ x, y, w, h }`. Falls back to base coords.
- Auto-generate a mobile layout (1-column stack) on first render and
  let the user tweak from there.
- Touches: `src/hooks/useBoard.ts`, `src/components/TileGrid.tsx`.

---

## Wave 3 — Multi-board and presentation

### 9. Named boards with tabs ("Exec", "SRE", "On-call")
One layout doesn't fit every viewer.
- Storage shape moves from `outage-board-v3` →
  `outage-boards-v4: { active: id, boards: [{ id, name, tiles }] }`.
  Provide a one-shot migration from v3.
- Tabs row above the toolbar with rename / duplicate / delete; star one
  as default.
- Touches: `src/hooks/useBoard.ts`, `src/components/Dashboard.tsx`,
  new `src/components/BoardTabs.tsx`.

### 10. Starter layout templates
Reduce time-to-first-useful-board for new users.
- Ship templates: "Microsoft 365 focus", "Identity & SSO", "Cloud
  infra", "Developer tooling", "Default". Each is a board JSON in
  `src/lib/board/templates/`.
- "Save current board as template" writes to `localStorage` and
  surfaces alongside the built-ins.
- Touches: `src/lib/board/templates/*.ts`,
  `src/components/AddTilePopover.tsx` (new "Templates" tab).

### 11. Presentation / kiosk mode
Optimized for NOC TVs and shared screens.
- `?present=1` query param hides toolbar, chrome, and edit affordances;
  enables auto-rotation between boards every N seconds.
- New "Present" button on the toolbar; `F` toggles fullscreen.
- Touches: `src/components/Dashboard.tsx`,
  `src/components/AppShell.tsx`.

---

## Wave 4 — Tile-level customization

### 12. Per-tile refresh override
Critical tiles (e.g. a status-page tile for a flaky vendor) should poll
faster than the global cadence.
- Add `config.refreshMs?` to any data-bound tile; SWR keys already exist
  per resource, so plumb through `useStatus.ts` variants that accept an
  override.
- UI: refresh-rate selector inside the tile's edit drawer.
- Touches: `src/hooks/useStatus.ts`, all `src/components/tiles/*`.

### 13. Tile-level filters
Make the existing tiles do more without adding new tile types.
- Incident Feed: filter by severity, service, status.
- Service Grid: hide-operational toggle, filter by tag/group.
- Uptime Chart: range picker (7 / 30 / 90 days).
- Filters live in `tile.config.filters` and persist with the board.
- Touches: `src/components/tiles/IncidentFeedTile.tsx`,
  `ServiceGridTile.tsx`, `UptimeChartTile.tsx`.

### 14. Inline tile config drawer
Today config is scattered across `dataPoints` toggles and inline `<select>`
elements. Consolidate into a right-side drawer like Tweaks.
- Opens via a gear on the tile chrome in edit mode.
- Each tile registers its `<TileConfigForm/>`; common fields (label,
  color, refresh, size) are generic.
- Touches: `src/components/tiles/TileChrome.tsx`, new
  `src/components/TileConfigDrawer.tsx`.

### 15. Bulk select + bulk actions in edit mode
Shift-click to multi-select tiles; act on them as a group.
- Bulk delete, bulk duplicate, bulk move (arrow keys move all),
  bulk-set color.
- Selection state lives in `Dashboard.tsx` (transient, not persisted).
- Touches: `src/components/TileGrid.tsx`, `src/components/Dashboard.tsx`.

---

## Wave 5 — Theming polish

### 16. Custom accent picker + recents
The six fixed swatches are limiting.
- Hex input + native color picker; remember last 8 in
  `localStorage`.
- Optional EyeDropper API where supported (Chromium).
- Touches: `src/components/TweaksPanel.tsx`, `src/hooks/useTweaks.ts`.

### 17. Auto (system) theme + custom theme builder
Add `auto` to the theme list, listen to
`prefers-color-scheme`. Allow a "Custom" theme that lets users override
`--background`, `--surface`, `--foreground`, `--muted` via the panel.
- Touches: `src/components/ThemeProvider.tsx`,
  `src/components/TweaksPanel.tsx`.

### 18. Per-tile accent / icon / tag
Visually group tiles by team, environment, or vendor.
- Add `config.accent?`, `config.icon?`, `config.tag?` (free-text 12-char
  badge) to all tile types via `TileChrome`.
- Default falls back to the global accent so existing boards look
  unchanged.
- Touches: `src/components/tiles/TileChrome.tsx`.

---

## Cross-cutting concerns

- **Migrations**: every storage-shape change (#9, #8) needs a one-shot
  migration in `useBoard`/`useTweaks` that reads the old key, transforms,
  writes the new key, then deletes the old. Wrap in `try/catch` so a bad
  migration never bricks the app.
- **Tests** (depends on `ROADMAP.md` item #3 landing): add Vitest cases
  for `src/lib/board/layout.ts` (compaction, collision, bin-pack) and
  for the storage migrations.
- **Accessibility**: shortcuts (#3) and bulk select (#15) must keep a
  visible focus ring and announce changes via `aria-live` on the
  toolbar's status line.
- **Perf**: the board re-renders on every drag tick today because state
  lives in `useBoard`. When introducing #5/#6, move transient drag/resize
  state into a `useRef` and only commit on drop.

## Suggested sequencing

1. Wave 1 first — pure UX wins, no schema changes, individually mergeable.
2. Wave 2 (#5–#7) together — they all touch the layout engine; extracting
   `src/lib/board/layout.ts` once pays back for all three.
3. Wave 3 (#9) before Wave 4 (#13–#15), so per-board filters land on top
   of the new multi-board storage shape.
4. Wave 5 anytime — fully isolated to the theming files.

## Out of scope (intentionally)

- Server-side persistence of boards / cloud sync — depends on auth, which
  is tracked in `ROADMAP.md` #11.
- New tile types — covered by `ROADMAP.md`.
- Notification routing per tile — that's an alerting concern, not a
  customization one.
