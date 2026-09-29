# @fp/ui changelog

Every material change to the shared UI — look, API, or provenance — gets a line
the commit it lands, so component drift is visible from the start rather than
reconstructed at the end. See `docs/component-guardrails.md` for the policy.

Format: `- <date> — <area>: <what changed> (<why / provenance>)`.

## 2026-09-29

From a live-data UI audit run against production at five viewports (1920 / 1440
/ 1280 / 768 / 390). Findings and measurements in `docs/audit/`.

- 2026-09-29 — flexprice/SettingsShell: new. Two-level settings navigation — a vertical section rail (`@reui/settings-7`) over a horizontal `variant="line"` strip (`@reui/settings-11`). Provenance is **composition**, not `reui`: it reproduces both blocks rather than importing them (each is a demo bound to its own `data.ts`) and deviates on breakpoint, scroll/fade, truncation, focus ring and tab contrast.
- 2026-09-29 — primitives/tabs — **KNOWN BUG, not fixed**: the vendored wrapper destructures `orientation` to write `data-orientation` and never forwards it to Base UI. Base UI's `TabsList` is what derives `aria-orientation` and feeds its composite key handler, so **every vertical `Tabs` in this repo is horizontal to assistive tech and answers Left/Right instead of Up/Down**, however it is drawn. `SettingsShell` reproduces the root locally to work around it; the registry file is untouched because vendored code is not hand-edited. Worth reporting upstream.
- 2026-09-29 — tooling: `src/hooks/**` added to the vendored lists in BOTH `packages/ui/scripts/vendor-suppress.mjs` and `packages/eslint-config/src/index.js`. They had drifted — the directory was in neither, so installing a block that pulled in `use-file-upload` broke typecheck, and adding it to only the suppress list then broke lint on the very `@ts-nocheck` that fixed it. The two lists must stay in step.
- 2026-09-29 — primitives/sheet: `side="right"` width ladder adapted — `w-full` below `sm`, then `sm:max-w-md lg:max-w-xl 2xl:max-w-2xl` (was `w-3/4` capped at `max-w-sm`). Stock was wrong at both ends: 292px on a 390 phone behind a dead 98px strip, and a fixed 384px on desktop — 20% of a 1920 screen for the multi-field plan and coupon editors. **This is a hand-edit of a vendored file, against `component-guardrails.md` §2**: the house-rule route (`styles.css` `data-slot`) cannot win here, because `@layer components` loses to the stock `data-[side=right]:sm:max-w-sm` utility. Declared, not discovered — the file carries an `ADAPTED` header, and a `pnpm ui:add sheet --overwrite` will silently revert it.
- 2026-09-29 — compositions/DetailShell: the tab strip scrolls (`overflow-x: auto` + scroll-snap + a `max-sm` edge fade) instead of clipping. At 390 the last tab — Information, the only place a plan's ID and description live — painted outside the strip and was unreachable by touch. Also raised inactive tab text from `text-foreground/60` (4.14:1, below the 4.5:1 floor) to `/70` (5.65:1) in light mode.
- 2026-09-29 — compositions/MetricRail: renders `null` when every tile is empty or zero. Add-on detail was showing Charges `0` / Starts at `—` / Currency `—` / Entitlements `0` — four tiles of nothing eating ~310px of the first screen on a phone — which the rail's own rule already forbade.
- 2026-09-29 — compositions/shell: mobile-sheet breakpoint `md` → `lg`. At exactly 768 the hamburger was `md:hidden` while the 260px push sidebar was still mounted, so a tablet had neither affordance and lost 34% of its width. Moved in all four places (sidebar primitive, `SidebarTrigger`, `SidebarInset`, rail handle) — a half-move is the bug.
- 2026-09-29 — compositions/shell/ShellBreadcrumb: crumb labels `truncate whitespace-nowrap`; a crumb that hides its label now hides its separator too (orphan `› ›` at 390); crumbs carrying content get `min-w-20` so the environment name wins the shrink race — it was truncating to "Sa…" on a billing console.
- 2026-09-29 — compositions/shell/ShellSearch: with no `onSearch`, the dialog states that search is unavailable and binds **no** shortcuts, instead of offering an input that silently discarded the query. API unchanged when `onSearch` is supplied.
- 2026-09-29 — compositions/shell/ShellNav, ShellAccount, ShellRailHandle: the mobile drawer closes on navigation; the account menu stops printing the same email twice; the rail handle gains a visible focus ring and returns `null` on mobile (its subtree was painting a stray 2×16 tick over the content card on every page).
- 2026-09-29 — compositions/GridToolbar, States, EmptyState: search no longer collapses to 53px at 390 (the row wraps below `sm` and search carries a floor); the first-run empty state keeps the toolbar mounted rather than replacing the whole surface; empty blocks centre in the available height instead of pinning to the top.
- 2026-09-29 — flexprice/InvoiceGrid, PaymentGrid: the invoice number truncates like `Money` does. With no invoice number the API returns `""`, so the cell fell back to a 30-char ULID and painted over the customer name — measured 136px of overrun at 1280.
- 2026-09-29 — flexprice/InvoiceFilters: new. Status facet for the invoice list, which had none. Offers only `STORED_INVOICE_STATUSES` — `Paid` and `Overdue` are derived by `deriveInvoiceStatus`, so filtering by them sent no status at all and returned every invoice under a chip claiming otherwise.
- 2026-09-29 — flexprice/ChargeTable: `emptyDescription` is a prop. The default copy said "**A plan** bills nothing until it has a charge" on the add-on page, and instructed the reader to add a charge on a surface with no add flow.

## 2026-09-28

- 2026-09-28 — theme: rebranded from indigo (~274°) to Ferry's deep-teal (`#07383e` light / `#81cec4` dark) on warm-neutral surfaces; background is a warm off-white (pure white read as harsh); focus ring, active nav and hover are all the one teal tone, never blue; status set retuned (calmer green, warmer/brighter yellow). Font switched to Inter. One rebrand knob remains `--brand` in `styles.css`.
- 2026-09-28 — compositions/DetailShell, MetricRail: new — the shared detail-page shell (header + badges + identifier + actions + optional metric rail + body) and a big-numeral KPI rail. Provenance: composition. Replaces per-page `DetailHeader`/`DetailStats` use on detail pages.
- 2026-09-28 — grids: table-only (card/table view toggle removed — no user-facing view customization in v1); toolbar reworked (search left with a light border, primary Add on the right, fit-to-window as an icon); filter/sort buttons restored to library default border + weight (a prior custom strip made them look worse); record counts removed.
- 2026-09-28 — compositions/shell: environment selector moved out of the sidebar into the top-bar breadcrumb as a dropdown; global search moved next to the Create button (still opens on `/` and ⌘/Ctrl-K).
- 2026-09-28 — testing: every `flexprice/**` and `compositions/**` component now ships a Storybook story (browser + a11y + interaction test via `@vitest/browser-playwright`); added a Design System section (Introduction/Colors/Typography) and autodocs.

## Earlier (V2 foundation)

- 2026-09 — compositions/DetailList, ConfirmDialog: added for the catalog detail pages.
- 2026-09 — flexprice grids (Coupon/Addon/Feature/Plan/Invoice/PriceUnit/Group/CostSheet): `tableLayout.width: 'auto'` fill; pagination footer pinned via the flex wrapper.
- 2026-09 — flexprice: ChargeEditor/ChargeForm/TierTable/PlanPreviewCard, EntitlementDrawer/Table, CreditGrantDialog/Table — the plan charges + entitlements + credit-grant surfaces.
- 2026-09 — theme: brand tokens introduced on top of the base `base-nova` (nova) theme; depth (soft shadows on overlay surfaces + card) and table-row hover added as `data-slot` house rules.
