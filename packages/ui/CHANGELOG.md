# @fp/ui changelog

Every material change to the shared UI — look, API, or provenance — gets a line
the commit it lands, so component drift is visible from the start rather than
reconstructed at the end. See `docs/component-guardrails.md` for the policy.

Format: `- <date> — <area>: <what changed> (<why / provenance>)`.

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
