# Grid Calculator

A Figma plugin for designing responsive layout grids and exporting them as a complete set of Figma Variables, with one Mode per device breakpoint.

It lets you define multiple devices (e.g. Desktop / Tablet / Mobile) side-by-side, see live preview frames on the canvas as you tune values, and emit a `Responsive Tokens` collection that powers Layout Grids and component bindings throughout your file.

## Features

- **Multi-device grid editor.** Add as many devices as you need. Each device has its own Max Width, Columns, Gutter Width, and Margin Width.
- **Live divisibility check.** Per-device feedback shows Page Width and Column Width, coloured green when the column width is an exact integer and red otherwise. The Update button stays disabled until *every* device produces a clean integer.
- **Live preview frames.** Opening the plugin (with previews enabled) creates one frame per device on the canvas, side-by-side, each with its layout grid applied. Editing any input updates the corresponding frame in place — resize, grid, and name. Frame IDs are persisted in document plugin data, so reopening the plugin reuses the existing frames rather than duplicating them.
- **Hydration from existing variables.** If your file already contains a `Responsive Tokens` collection, the plugin reads its modes and seeds the device list from those values on open. Variable aliases (e.g. `grid/margin-inset` → `space/48`) are resolved through the alias chain, and several legacy variable names are accepted (`grid/margin-inset`, `grid/margin-default`, `grid/gutter-default`, etc.).
- **Variable upsert.** The Update Responsive Variables button reconciles the existing collection rather than creating a new one — modes, variables, and values are matched by name/index. Existing bindings on frames and components carry over because we update in place. Stale `col-span-N` / `col-start-N` variables beyond the new max column count are pruned.
- **Optional live variable updates.** A toggle pushes variable changes on every input change (debounced ~250ms), so any element bound to the collection updates in real time on the canvas. Off by default — toggle on for very tight feedback loops, off for heavier files.
- **Migration of legacy names.** Variables created by older versions of the plugin (`{N} col`, `column-push-N`, `col-push-N`) are renamed in place to the current names (`col-span-N`, `col-start-N`) when you next click Update — bindings are preserved.

## Variables produced

Collection: **Responsive Tokens**, with one Mode per device.

| Name | Type | Value per mode |
|---|---|---|
| `device` | STRING | The device name, lowercased |
| `displays/screen-width` | FLOAT | Max Width |
| `grid/column-count` | FLOAT | Columns |
| `grid/margin` | FLOAT | Margin Width |
| `grid/gutter` | FLOAT | Gutter Width |
| `grid/column-width` | FLOAT | Column Width (single column section size — bind to a Layout Grid) |
| `grid/column-widths/col-span-{i}` | FLOAT | `i*colWidth + (i-1)*gutter` — width of `i` columns |
| `grid/start/col-start-{i}` | FLOAT | `i*colWidth + i*gutter` — start offset of column `i+1` |

`col-span-{i}` and `col-start-{i}` are generated for `i` from `1` to `max(columns across all devices)`. For a device with fewer columns, indices beyond its own column count cap at the device's content width (`maxWidth - 2 * margin`) — so a 6-column mobile breakpoint still has values for `col-span-12`, equal to its full content width.

## Usage

1. Run the plugin in any Figma file (Plugins → Development → Import plugin from manifest, then point at `manifest.json`).
2. Edit the device cards. Use **+ Add Device** to add a breakpoint, or the small × on a card to remove one.
3. Watch the preview frames update on the canvas as you type.
4. When all cards are green, click **Update Responsive Variables** to write/refresh the `Responsive Tokens` collection.
5. Bind your Layout Grids and component dimensions to the variables. Switch a frame's mode to preview a different breakpoint without leaving the file.

### Toggles

- **Show preview frames** — default on. Turning it off deletes the preview frames and stops creating them.
- **Live update variables** — default off. When on, every input change debounces a variables upsert; when off, click the button explicitly.

## Files

- [`manifest.json`](manifest.json) — Figma plugin manifest.
- [`code.js`](code.js) — main plugin logic: preview reconciliation, variable upsert/migration, hydration.
- [`ui.html`](ui.html) — plugin UI: device card list, validation, debounced messaging.

## Notes

- The plugin only writes to the `Responsive Tokens` collection. Other collections (e.g. a units collection holding `space/48`) are read for hydration but never modified.
- Values bound through aliases are resolved up to 8 levels deep when hydrating defaults.
- Preview-frame positions persist after first creation — if you move them, the plugin keeps your placement and only updates size, name, and grid.
