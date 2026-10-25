# UI polish review: verification of commit `63a9ae2`

> **Superseded for visual decisions.** What the console looks like is defined by `UI_SOURCE_OF_TRUTH.md` (the reference app, Geist, navy primary). This document is kept as history; where it disagrees, that file wins.

Read-only visual QA of the deployed-build "design polish" fixes, against the three
complaints the user raised: **dropdowns**, **page alignment**, **search bar**.
Captured at 1440×900 (desktop), mocks on, light + dark. Screenshots in this folder
(`polish-*.png`). Bar for "good" = Stripe / Orb / Lago.

---

## Verdict per complaint

**1. Dropdowns: PARTIALLY FIXED.** The two things the commit actually touched now
look good: form/`Select` controls are full-width and gain a hover wash
(`polish-form-select-open.png`, `polish-pagesize-select-open.png`), and the shell
menus (environment switcher, account) share one rounded, shadowed surface
(`polish-env-switcher-open.png`, `polish-account-menu-open.png`). But "all over the
application" is still not one dropdown: there are **four different menu surfaces**.
The shell menus use `rounded-3xl / p-2 / shadow-xl / py-2.5` rows; the **Sort** menu is
a separate hand-tuned `rounded-2xl / p-1.5 / rounded-xl py-2` surface; the **Filter**
popover is the flattest of all: a near-invisible shadow, tight radius and a
**borderless "Search attributes…" input** that reads as plain text
(`polish-plans-filter-open.png`); and the **Home** dashboard's own filter dropdowns
("Last 7 days", "Daily", "All agents") are a fifth family entirely
(`polish-home.png`). So a menu still changes shape depending on where it opens.

**2. Alignment: PARTIALLY FIXED (mostly good, one measurable defect).** Within the
body it's clean now: columns fill the width (`width:'auto'`), and the toolbar
(search left / Filter·Sort·CTA right) is identical between `/plans` and `/features`,
so the pages read as one app. The remaining defect is a **measured 8px gutter
mismatch between the shell header and the page content**: the header uses `px-4`
(16px) and `PageBody` uses `px-6` (24px), so the breadcrumb: which *is* the page
title here (the toolbar `<h1>` is `sr-only`): starts at **x=277** while the toolbar
and every table column below it start at **x=285**; on the right the header **Create**
button ends at **x=1415** while the toolbar's **New plan** CTA ends at **x=1407**. The
top bar overhangs the content column by 8px on both sides, so nothing in the header
shares an edge with the page under it. Detail pages are internally aligned
(`polish-plan-detail.png`) but carry two content nits (below).

**3. Search bar: LARGELY FIXED.** The primary complaint is resolved: the list
toolbar search is now a capped-width, bordered, icon-led field with a teal focus ring
and an on-demand clear ✕ (`polish-plans-search.png`): market-grade, no more
full-bleed empty bar. Two residual issues, both minor: (a) the header still shows a
"Search… /" button while the toolbar shows a "Search…" input: **two identical
"Search…" affordances on one screen**; (b) the global search dialog those open is a
bare floating input with no results/recents/groupings, so it reads unfinished
(`polish-global-search-dialog.png`).

---

## Ranked findings

| # | Sev | Element | File | Problem | Recommended fix |
|---|-----|---------|------|---------|-----------------|
| 1 | High | Dropdown surfaces don't match app-wide | `compositions/tables/SortMenu.tsx` (`rounded-2xl p-1.5`), `compositions/shell/menuSurface.ts` (`MENU_CONTENT rounded-3xl p-2`), `compositions/tables/FilterBar.tsx` (vendor default) | Four near-but-unequal menu surfaces (shell menus vs Sort vs Filter popover vs Home block). A menu changes radius/padding/shadow by location: the literal "dropdowns look poor all over" symptom. | Codify **one** dropdown/popover surface in `styles.css @layer components` targeting `[data-slot='dropdown-menu-content']`, `[data-slot='select-content']`, `[data-slot='popover-content']` (radius + padding + the house shadow already there), and drop the per-call `rounded-*/p-*` overrides in `SortMenu` and `menuSurface` so all inherit it. Pick ~12–16px radius (rounded-3xl/22px reads bubbly at this size). |
| 2 | High | Filter popover + its "Search attributes…" input | `compositions/tables/FilterBar.tsx` → `components/reui/filters/filters-advanced.tsx` (`PopoverContent`, `p-0`) | The popover has the weakest surface of all (faint hairline, near-zero shadow, tight radius) and the attribute-search input is **borderless/flat**: the popover reads as loose text on white, not a control. | Give this `PopoverContent` the shared surface from finding #1 (confirm the house `[data-slot='popover-content']` shadow actually lands on it: it's `p-0` and may render a different inner node), and style the inner search input with the `input`/`border` tokens the way `GridToolbar` styles its search. |
| 3 | Med | Header ↔ content gutter | `compositions/shell/AppShell.tsx:270` (`<header … px-4>`) vs `compositions/layout/Page.tsx` `PageBody` (`px-6`) & `DetailShell.tsx` (`px-6`) | Measured 8px offset both sides: breadcrumb left x=277 vs content left x=285; Create right x=1415 vs toolbar CTA right x=1407. Breadcrumb (the de-facto page title) doesn't share a left edge with the toolbar/grid; header actions overhang content on the right. | Set the shell header to `px-6` (or wrap its contents to the same gutter/`max-w` as `PageBody`) so breadcrumb↔content left edges and Create↔toolbar-CTA right edges line up. |
| 4 | Med | Duplicate search chrome | `compositions/shell/ShellSearch.tsx` (header button) + `compositions/tables/GridToolbar.tsx` (toolbar input); placeholder set in `flexprice/PlanGrid.tsx:207` (`"Search..."`) | Header "Search… /" button and toolbar "Search…" input coexist on every list page with the **same placeholder**: two search entry points, indistinguishable. | Scope the toolbar placeholder per entity (`"Search plans…"`, `"Search features…"`: the `placeholder` prop already exists, PlanGrid passes the generic `"Search..."`) and/or relabel the global one ("Search everything"). |
| 5 | Low-Med | Global search dialog | `compositions/shell/ShellSearch.tsx` | Opens to a bare floating input ("Type to search…") with no results, recents, or entity groupings: reads unfinished for a command palette. | Add a hint / recent-items / grouped-results scaffold, or gate the entry point until it can return results (an empty palette invites a dead search). |
| 6 | Low | Form `Select` triggers show raw enum values | `flexprice/ChargeForm.tsx` (`<SelectValue/>` for Billing period / Invoice timing) | Trigger renders **`MONTHLY`, `ADVANCE`** (raw uppercase constants) although `BILLING_PERIOD_LABEL`/`INVOICE_CADENCE_LABEL` humanize them to "Monthly" / "Advance: …". `SelectValue` is showing the value, not the selected item's label. | Make the trigger show the mapped label (pass an explicit `<SelectValue>` render or a `placeholder`/display map) so the collapsed select reads "Monthly" / "In advance", not a shouty constant. |
| 7 | Low | Detail metric rail | `compositions/detail/MetricRail.tsx` via `pages/plans/PlanDetailPage.tsx` | Rail shows an empty **"Currency —"** tile and mixes big-numeral KPIs with a type value ("Starts at: Usage-based"): violates the rail's own "money+counts only, omit rather than fake" rule. | Drop the Currency tile when unset; move "type / starts at" into the Information `DetailList`. |
| 8 | Low | Home dashboard is an unstyled vendor block | `flexprice/DashboardHome` (ReUI `dashboard-4`) → `pages/home/HomePage.tsx` | Home renders the block's own sample data ("Active Calls", "Docs Support Agent", OpenAI) and its own dropdown family: off-brand for a billing console and a fifth dropdown style. Out of this review's scope but visible if Home is the landing page. | Track separately: replace sample data with billing widgets and reconcile its controls to the app's dropdown surface (finding #1). |

---

## What is genuinely good now (don't regress)

- Toolbar search field: bordered, capped width, teal focus ring, on-demand clear ✕.
- `/plans` ↔ `/features` toolbar + column layout are identical (one app).
- Environment switcher & account menus share a clean rounded/shadowed surface.
- Form `Select`s are full-width and the open listbox matches the trigger width.
- Dark mode is fully realised: warm dark neutrals, teal brand, legible status badges,
  elevated menus (`polish-plans-dark.png`, `polish-sort-dark.png`).

## Method / notes

- Own dev server on `:4321` (`VITE_USE_MOCKS=true`), Playwright + chromium headless,
  session seeded via init script. Gutters measured with element `boundingBox()`.
- No column-header dropdown exists in practice: `columnsVisibility` doesn't set
  `hasControls`, so a header click just toggles sort (`polish-plans-column-menu.png`
  shows the active-sort "Status ↑" state). Sorting UI = the Sort menu + header click.
