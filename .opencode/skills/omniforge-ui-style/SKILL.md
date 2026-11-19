---
name: OmniForge Interface Style
description: Use when building or changing OmniForge's Electron UI, adding a view, panel, control, icon, or copy so it matches the warm paper theme and the renderer's vanilla-JS conventions.
---

# OmniForge interface style

OmniForge is a local-first file and media workbench. The interface should feel
like a well-kept paper desk: warm cream surfaces, ink-dark type, hairline rules,
and one quiet accent per tool. It is not a marketing site and not a dashboard
full of chrome.

Read `AGENTS.md`, then `src/renderer/index.html`, `src/renderer/styles.css`, and
the nearest existing view in `src/renderer/app.js` before editing.

## Design language

- Warm paper palette. Every color comes from a CSS custom property; never
  introduce a raw hex or `rgba()` value when a token fits.
- Flat surfaces with 1px borders. Depth comes from `--shadow` and
  `--shadow-soft`, not from large blurs or dark backdrops.
- The page backdrop may use the existing soft radial washes and grain overlay.
  Components stay flat; no decorative gradients, glows, or sheen on panels,
  buttons, or cards.
- Primary actions are ink-on-cream (`.primary-button`). Color is reserved for
  tool icons, status pills, and small accent details.
- Type is small and dense: 13px body, 11-13.5px panel headings, 10-11px helper
  text. Use `var(--mono)` only for timestamps, hashes, technical values.
- Radii are 8-14px (`--radius-sm` … `--radius-xl`). Nothing pill-shaped except
  badges and counts.
- Motion is minimal and never decorative. Entrance animations are disabled.
  Honor `prefers-reduced-motion`.

## Tokens

```css
--bg #f4efe4        --bg-soft #ece5d6    --panel #fbf8f1
--panel-raised #fffdf8                   --line #ddd3c1
--line-strong #c8bca6                    --text #211e19
--text-soft #3e382f  --muted #6d6658     --muted-2 #7b7364
--lime #211e19       --lime-soft #3e382f --mint #2e7650
--cyan #2f6b84       --blue #3b5f9e      --violet #6b5194
--danger #a23c36     --warning #8a641f   --success #2e7650
--radius-sm 8px      --radius-md 10px    --radius-lg 12px
--radius-xl 14px     --font "Segoe UI Variable Display", ...
```

`--lime` and `--lime-soft` are aliases for ink, not green. Use them for
selected states, never as a highlight color.

## Page structure

The shell is fixed: 236px sidebar, top bar, global legal warning, and the
scrolling `.view` container. Every view is one template string returned by a
`renderX()` function and injected with `viewEl.innerHTML`.

Standard tool page:

```js
return `<div class="tool-layout">
  <div style="display:grid;gap:14px">
    <div class="panel">
      <div class="panel-head"><div><h2>Title</h2><p>One sentence about the input.</p></div><span class="status-pill">${status}</span></div>
      <div class="panel-body">
        ${renderDropzone(tool, 'Drop …', 'Formats and hints')}
        ${renderFileList(tool)}
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><div><h2>Settings</h2><p>What the job will do.</p></div></div>
      <div class="panel-body">
        <div class="form-grid">…fields…</div>
        ${renderStartBar(tool, 'Action label', 'Result sentence.', disabled)}
      </div>
    </div>
  </div>
  ${renderGuide(tool)}
</div>`;
```

- The left column stacks panels with a 14px gap. The right column is the
  296px guide (`.side-panel`) built by `renderGuide`, which reads `GUIDES[tool]`.
- Use `.tool-layout.single` only for a full-width single-purpose view.
- Use `.form-grid` (2 columns) or `.form-grid.three` (3 columns) with
  `.field` wrappers. Labels are short nouns; helper text goes in `.field-note`.
- Use `.panel-body.tight` for dense lists.
- Breakpoints (1280, 1160, 980) already collapse the grid and sidebar. Reuse
  them; do not invent new ones for a single page.

## Reusable pieces

| Need | Use |
| --- | --- |
| Primary action + note | `renderStartBar(tool, label, note, disabled)` |
| File input | `dropzone` markup via `renderDropzone(tool, heading, subheading)` |
| Selected files | `renderFileList(tool)` |
| Select with labels/hints | `selectOptions(items, selected)` |
| Quality choice | `qualityPicker(tool, selected)` |
| Right-hand explainer | `GUIDES[tool]` + `renderGuide(tool)` |
| Empty state | `.empty-state` with a muted tool icon |
| Transient feedback | `showToast(message, 'success' | 'error', timeout)` |
| Status chip | `.status-pill` (`succeeded`, `failed`, `running`, …) |

Icons are inline SVG strings in `ICONS` (24×24 viewBox, `fill="none"`,
`stroke="currentColor"`, `stroke-width="1.7"`, round caps). Add one entry and
call `icon('name')`; never import an icon library or a font. Pick an existing
name when the meaning is close enough.

## Copy

- Sentence case, plain, concrete. Say what the result is.
- Labels name the outcome: "Remove audio", not "Go".
- Helper text explains the tradeoff in one short sentence.
- Errors start with the fix: "Add one video and one audio track first."
- No exclamation marks, no marketing adjectives, no emoji.
- Escape every dynamic string with `escapeHtml`, including attributes and
  titles.

## Renderer rules

- No frameworks, no bundler, no new dependencies. ES modules only where the
  file already uses them.
- Templates are pure functions of `state`. Do not read the DOM while rendering.
- Events are delegated: `data-action="…"` with `handleAction`, `data-view="…"`
  for navigation, `data-tool` / `data-option` for fields handled by
  `handleViewInput` and `handleViewChange`.
- Never add `onclick` attributes or per-element listeners inside templates.
- Keep new UI state under an existing namespace (`state.files`, `state.options`,
  `state.studio`, …) and seed defaults in the `state` literal at the top of
  `app.js`.
- Add nav entries to `src/renderer/index.html`; add view metadata to
  `VIEW_META`. The command palette, page title, and active nav state are
  derived from those automatically.
- Icon-only buttons need `aria-label` and a `title`. Keep focus styles intact.
- Verify with `node --check src/renderer/app.js` and `npm run smoke` for shell
  changes.

## Do not

- Do not add a CSS framework, component library, web font, or dark theme.
- Do not restyle the sidebar, top bar, queue drawer, or legal gate as part of a
  tool change.
- Do not use raw colors, hard-coded pixel radii, or one-off shadows.
- Do not animate page entrances or add hover glow to panels.
