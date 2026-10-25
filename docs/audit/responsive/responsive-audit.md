# Responsive-design audit: flexprice-console V2

**Date:** 2026-09-29
**Method:** Playwright + Chromium, seeded demo session, mock server on `:4322`. 6 key pages × 7 viewport widths = 42 screenshots in this folder. Per-page element measurements in `measurements.json` / `measurements-recapture.json`.
**Pages:** `/` (home), `/plans` (list), `/features` (list), a plan detail (`/plans/plan_synth_0011`), the add-charge stepper (`/plans/<id>/charges`), `/sign-in` (fresh, unseeded).
**Viewports:** 360×740, 768×1024, 1024×768, 1280×800, 1440×900, 1920×1080, 2560×1440.

## Headline

**There is NO horizontal page overflow anywhere.** At every page × viewport, `document.documentElement.scrollWidth === window.innerWidth`: the page never scrolls sideways. Data tables that are wider than the screen (on phones) scroll *inside their own bounded scroll region*, never the document.

The user's "does not fit on bigger screen sizes" complaint is **big-screen stretch/waste, not overflow.** The layout has **no maximum content width**: a `max-w-[1440px]` cap was deliberately removed from `PageBody` (see the comment in `Page.tsx`). So above ~1440px every surface keeps growing edge-to-edge. On list pages this is worst: a 5-column table is stretched to **2270px at 2560** and **1630px at 1920**, marooning each cell's value in its own zone (a plan's name on the far left, its "Updated" date ~2000px away on the right: unreadable ultra-wide rows). Detail pages and sign-in sprawl the same way, just less severely.

## Per-viewport verdict: does the app fit?

| Width | Verdict | Notes |
|---|---|---|
| **360** | **Partial** | Genuinely good: sidebar collapses to a hamburger sheet, toolbar wraps, tables scroll inside their region, dashboard metrics stack. Minor: breadcrumb text wraps ("Pla/ns", "Hom/e"); plan-detail tab row clips "Information"; metric rail shows a blank 4th cell. |
| **768** | **Yes** | Fully usable. Sidebar pinned (528px content is a little tight but fine). Tables scroll internally. |
| **1024 / 1280** | **Yes** | Clean. |
| **1440** | **Yes** | The sweet spot: everything reads as intentional (this is where the old cap sat). |
| **1920** | **Partial** | List tables stretch to ~1630px with big inter-cell gaps; detail metric tiles get wide/sparse. Usable but loose. |
| **2560** | **No** | List tables stretch to 2270px → unreadable ultra-wide rows. Detail metric rail + content balloon. Sign-in becomes a small island in a sea of white. This is the reported problem. |

## Ranked issues (horizontal-overflow first, then severity)

| # | Sev | Page(s) | Viewport(s) | Symptom | Likely file + class | Recommended fix |
|---|---|---|---|---|---|---|
|: |: | ALL | ALL | **No horizontal document overflow found** (scrollWidth === innerWidth everywhere). Recorded so a fix does not chase a phantom. |: |: |
| 1 | **High** | `/plans`, `/features` (all list/grid pages) | 1920, 2560 | Few-column data table is `w-full` and auto-distributes columns, so on wide screens rows become ultra-wide with huge empty gaps between cells (Plan name ↔ Updated date span ~2270px at 2560, ~1630px at 1920). Hard to associate a row's values. | Root: `packages/ui/src/compositions/layout/Page.tsx` L90: `width==='wide'` → `'w-full'` (the removed `max-w-[1440px]`). Table itself: `packages/ui/src/components/reui/data-grid/data-grid-table.tsx` (`w-full min-w-full table-auto`). | Reinstate a content cap for the `wide` branch, e.g. `mx-auto w-full max-w-[1600px]` (or a token like `max-w-screen-2xl`). Optionally set explicit `size`/`maxSize` on columns and left-align content so cells don't drift apart. Keep the grid's own horizontal scroll for narrow screens. |
| 2 | **High** | plan detail (Overview) | 2560 (loose at 1920) | Metric rail (`MetricRail`) spans the full width: 3 tiles each ~770px at 2560 with the number hugging the left and vast empty space per tile. Overview left column (`minmax(0,1fr)`) balloons to ~1490px; empty-state text floats in the middle of a huge card. | `apps/console/src/pages/plans/PlanDetailPage.tsx` L309 `grid ... lg:grid-cols-[minmax(0,1fr)_360px]`; `packages/ui/src/compositions/detail/DetailShell.tsx` (header/body only `px-6`, no max-width); `MetricRail.tsx`. | Apply the same content cap in `DetailShell` (wrap header + body in `mx-auto w-full max-w-[1600px]`), or cap the detail grid's main column with a `max-w`. Caps the metric rail at the same time. |
| 3 | **Medium** | `/sign-in` | 2560 (fine ≤1920) | Split is `grid-cols-[minmax(0,1fr)_620px]`: the form (left) column grows unbounded while the marketing aside is a fixed 620px sliver. At 2560 the ~560px form is a small centered island with ~700px dead bands and the aside's logos float in emptiness. | `packages/ui/src/flexprice/SignInScreen.tsx` L107 `w-full lg:grid lg:grid-cols-[minmax(0,1fr)_620px]`. | Cap the whole split (`mx-auto max-w-[1600px]`) or make both columns `1fr` so they stay balanced as width grows. |
| 4 | **Low** | add-charge stepper | 1920, 2560 | `ChargeEditor` card is correctly capped at `max-w-3xl` (768px) but **not centered**: inside `PageBody`'s `w-full` it sits hard-left with a large dead band to its right on wide screens. | `packages/ui/src/flexprice/ChargeEditor.tsx` L177 `w-full max-w-3xl` (no `mx-auto`). Consider setting the page to `PageBody width="narrow"` in `PlanChargesPage.tsx` (currently default `wide`). | Add `mx-auto` to center the editor, or mount the page with `<PageBody width="narrow">`. |
| 5 | **Low** | top header bar (all pages) | 360 | Breadcrumb text wraps to two lines ("Pla/ns", "Hom/e") in the fixed `h-12` header because breadcrumb + env switcher + search + Create compete for width with no truncation. | `packages/ui/src/compositions/shell/AppShell.tsx` L274 `<header className="flex h-12 ... gap-2 px-6">` + breadcrumb. | Let the breadcrumb `min-w-0 truncate`, and/or collapse the search to an icon under `sm`. |
| 6 | **Low** | plan detail | 360, 768 | Tab row (`role=tablist`, width 373 > 360) slightly clips "Information" and scrolls inside the detail body; 3-metric rail renders a blank 4th grid cell at `<sm` (`grid-cols-2` for 3 items). | `MetricRail.tsx` L44 `COLUMNS[3]='grid-cols-2 sm:grid-cols-3'`; tabs in `PlanDetailPage.tsx`. | For 3 metrics use `grid-cols-1 sm:grid-cols-3` (or `grid-cols-3` from the start) to avoid the empty cell; allow the tablist to scroll or wrap without clipping the last label. |

## What is genuinely fine (don't regress it)

- **Mobile (360/768)** is well built: sidebar → sheet, wrapping toolbars, internally-scrolling tables, stacking dashboard. Any big-screen cap must not remove the tables' own horizontal scroll on phones.
- **Home dashboard** handles width best: its 6-tile metric strip and 2-column card grid fill 1920 sensibly (charts *want* the width). It only gets mildly sparse at 2560.
- **1024–1440** all look intentional.

## Bottom line for the fix

One change fixes ~80% of the complaint: **put the removed max-width back**, but as a generous cap (~1600px, not 1440) applied in the two shared shells: `Page.tsx` `PageBody` (`wide` branch) and `DetailShell.tsx`: plus center the capped content (`mx-auto`). That reins in the list tables, the detail metric rail, and wide bodies at 1920/2560 in one place, without touching the mobile behavior that already works.
