# UI component plan

> **Superseded for visual decisions.** What the console looks like is defined by `UI_SOURCE_OF_TRUTH.md` (the reference app, Geist, navy primary). This document is kept as history; where it disagrees, that file wins.

What the Flexprice console is built from, surface by surface, with at least three
options for every element we do not already have.

Sources: the Ferry screenshots (visual reference), a read of `flexprice/ferry@v1`,
and a sweep of the ReUI registry against our `pro` licence.

**Verification note.** I read Ferry's source directly and checked `icon-tile`,
`filters` and `data-grid` against the live ReUI API. The individual `c-*` example
IDs come from a registry sweep and are not all personally verified: run
`get_component` before wiring props to any of them.

---

## 0. The product boundary

Ferry is a **contract-to-cash / AR product**. Flexprice is **billing
configuration and usage metering**. They share a stack and a visual language,
not a feature set.

**Take from Ferry:** density, layout, table patterns, toolbar and filter
placement, status treatment, pagination behaviour, information hierarchy, and
the theming architecture below.

**Do not take:** Chase and dunning flows, payment reconciliation, journal
preview, close checklists, AR-specific vocabulary. These are Ferry's product,
not ours. Where this document covers a reconciliation or journal surface it is
because it was asked for as an inventory, not because it is on our roadmap.

---

## 1. Ferry inventory: what it actually is

`flexprice/ferry@v1` is a **front-end prototype with no backend**: `core/` is a
health-only Go service, and `web/` runs entirely on ~1,300 lines of fixtures in
`src/mocks/`. Absent, deliberately: data fetching, auth, forms library,
server-side pagination, i18n wiring, toasts. Do not assume any of it exists.

What it *has* solved is design-system architecture, on the same stack as us:
React 19, Vite, Tailwind v4, Base UI, ReUI `base-nova`, TanStack Table **v9**,
lucide, Geist.

### The four things worth taking, ranked

**1. The three-file theme split.** `src/theme/` divides into `base.css`
(scales), `look.css` (house rules), `brand-ferry.css` (values). Only the brand
file changes per product.

`look.css` is the important one: 43 lines, and the best idea in the repo:

```css
@layer ferry-look {
  [data-slot='badge']     { border-radius: calc(infinity * 1px); font-weight: var(--font-weight-normal); }
  [data-slot='table-row'] { border-bottom-style: none; }
  [data-slot='card']      { --tw-shadow: 0 0 #0000; box-shadow: none; }
}
```

The layer is declared **after** Tailwind's utilities, so it beats both the
classes a vendor bakes into a component and a `className` at the call site.
Selectors are `data-slot` only: the vendor's public targeting contract: never
structural descendants. The consequence: a ReUI block installed next month
arrives already looking like ours, without anyone editing vendor source.

We currently do the equivalent with a `@layer components` block in `styles.css`
for button/badge radius. Same idea, less disciplined. Worth adopting the split.

**2. `--text-sm` redefined to 13px** in `base.css`, so every vendor component
written against `text-sm` inherits operational density without being patched.
Weights are 450/500/550 rather than 400/500/600.

**3. `check-vendor.sh` + `registry.json`**: a sha256 per vendored file, failing
CI on any edit. It makes "do not hand-edit vendored components" enforceable
rather than aspirational. We have the comment; they have the check.

**4. The `ledger-view` seam.** One generic collection component (118 lines) used
by six-plus screens, and the **only** module importing `data-grid` or `filters`.
It re-exports what screens need, so no screen ever names a vendor block:
swapping the grid stays a change in one file. Their ESLint forbids
`*-page.tsx` from importing block-grade primitives at all.

Also worth stealing: a Rollup plugin that **fails the build if any Radix module
lands in a chunk** (8 lines, guarantees Base-UI purity), and
`use-viewport-page-size.ts`, which measures the table and sets `pageSize` to fit
the window. ReUI does not ship that.

---

## 2. Screenshots → UI requirements

| Pattern | What the screenshots show |
|---|---|
| **Density** | 13px body; rows ~44px; no horizontal rules between rows: separation by rhythm alone |
| **Toolbar** | Borderless full-width search on the left; `Filter` and `Sort` as ghost buttons on the right |
| **Columns** | 6–9, sortable with up/down carets, right-aligned money with tabular figures |
| **Status** | Pill with a leading glyph; colour carried by the **icon**, fill stays neutral |
| **Warnings** | A small alert glyph beside the identifier; overdue dates in red text, not a badge |
| **Source** | A 16px brand mark per row, no label |
| **Pagination** | "Fit to window" · "Rows per page" · "1 – 18 of 64" · numbered pages with arrows |
| **Header** | 56px, one hairline, breadcrumb left, utilities right |
| **Currency** | € £ $ mixed in one column |

The status treatment is the one to copy deliberately. Ferry's own note: colour
is carried by the icon rather than a fill *"so a dense table does not turn into
a traffic light."* Our `StatusBadge` currently uses `-light` fills. At 18 rows
with five statuses, theirs reads better.

---

## 3. Already vendored: usable today

`data-grid` (+ `column-header`, `pagination`, `column-visibility`,
`scroll-area`, virtual and DnD variants) · `badge` · `stepper` · `frame` ·
`rating` · and the shadcn set: `avatar` `breadcrumb` `button` `button-group`
`card` `checkbox` `dialog` `dropdown-menu` `field` `input` `input-group` `item`
`kbd` `label` `popover` `progress` `radio-group` `scroll-area` `select`
`separator` `sheet` `sidebar` `skeleton` `spinner` `table` `tabs` `textarea`
`tooltip`.

Our own compositions: `Toolbar` · `EmptyState` · `States` · `Page` · `Section` ·
`Field` · `WorkflowStepper` · `AppFailure` · `StatusBadge` · `Money` · `Metric` ·
`UsageMeter` · `InvoiceGrid` · `FeatureGrid`.

**Already handled, worth not breaking:** `DataGridPagination` renders "Rows per
page", "1 – 18 of 64" and numbered pages with ellipsis out of the box: the
screenshot footer minus "Fit to window". And `InvoiceGrid` already passes
`rowCount` with `manualPagination`, which is what makes `getPageCount()` correct.
Omitting it is the single most likely thing to break a server-paginated grid: the
page buttons render as nothing, with no error.

---

## 4. Options per element

Three or more for everything not already solved. `pro` marks a premium block.

### 4.1 Status chips: *already available + customize*

1. **`@reui/badge` with a variant map** (installed): seven statuses to
   `success-light` / `warning-light` / `outline` / `destructive-light` etc.
   Cheapest; but seven tinted fills down 18 rows is the traffic-light problem.
2. **Ferry's treatment**: `variant="outline" radius="full"`, transparent fill,
   colour on the leading icon only. Best density; needs our `StatusBadge`
   rewritten (~20 lines).
3. **`c-badge-22`**: leading coloured dot instead of a glyph. Most uniform;
   a dot carries less meaning than a check or an alert, and is weaker without
   the text for colour-blind readers.

**Recommend 2.** It is the one the screenshots demonstrate working at density.

### 4.2 Filter + Sort in the toolbar: *add from ReUI*

1. **`@reui/filters`** (free): a real boolean query tree, designed to pair with
   `data-grid`. **Heavy: 25 registry deps, including the whole `cascader`
   family.** The value is one `FilterQuery` *tree* seeded by `createFilterQuery()`
   and read with `flattenFilterConditions`: the pre-rewrite `filters`/`onChange`
   props and `createFilter()` no longer exist.
2. **`c-button-group-50`**: a Filter + Sort + overflow cluster, free, almost no
   deps. Matches the screenshot exactly but the filtering is yours to build.
3. **`c-input-group-39`**: search plus a checkbox-facet popover; a working
   middle ground, hand-rolled rather than the filters engine.

**Recommend 2 now, 1 when filtering outgrows two facets.** Our list queries live
in URL search params; a nested AND/OR tree does not round-trip through those
without work. Start flat.

### 4.3 Sort control: *add from ReUI*

1. **`DropdownMenu` + two `DropdownMenuRadioGroup`s** (installed): column, then
   direction. Ferry's approach; nothing to install.
2. **`c-button-group-50`**: as above, ships the button shape too.
3. **Column-header carets only** (installed): no separate control. Fewest
   parts; poor on a narrow viewport where the header scrolls out of reach.

**Recommend 1.**

### 4.4 Source / integration marks: *custom*

**ReUI ships no brand SVGs, and Motion Icons are Ultimate-locked on our Pro key.**
The marks must be our own assets.

1. **`@reui/icon-tile`** (free, verified): a square surface that normalises
   glyph size across rows. `size` `xs`(24px)…`xl`, `variant`
   `outline|elevated|soft|solid|frame`. Solves the real problem: five vendor
   logos have five different natural aspect ratios.
2. **Bare 16px `<img>`** with `dark:invert` for monochrome marks: Ferry's
   approach, zero deps, needs per-logo size nudging.
3. **`Avatar` with a letter fallback**: handles unknown sources gracefully;
   implies a person and gives no `currentColor` tinting.

**Recommend 1** at `size="xs" variant="outline"`, wrapping our own SVGs, with
attribution recorded alongside as Ferry does.

### 4.5 "Fit to window": *custom*

1. **Port Ferry's `use-viewport-page-size.ts`** (~36 lines): measures the
   container, header and tallest row, sets `pageSize`, remaps page index on
   resize. `ResizeObserver` + `MutationObserver` + rAF coalescing.
2. **`c-toggle-group-8`**: the segmented control only; you still write the
   measurement.
3. **`data-grid-columns-3`** (`pro`): a Display popover with density, sticky
   header and column controls. More than asked for; 18 deps and a card-view
   shell to strip.

**Recommend 1.** ReUI has no equivalent and Ferry's is tested.

### 4.6 Detail / Inspect surface: *already available*

1. **`Sheet`** (installed): right drawer, keeps the list visible behind it.
2. **`c-sheet-4`**: adds a `ScrollArea` body for long records.
3. **`Dialog`** (installed): correct for a modal follow-up ("Resolve
   conflict"), wrong for a 9-field record.

**Recommend 1**, with 2's scroll pattern copied in.

### 4.7 Empty and loading: *already available*

Our `EmptyState` and `States` cover both. If we want more: `c-empty-10` (free,
message + reset action), `empty-state-2` (`pro`, no-results with suggestion
chips), `c-data-grid-21` (skeletons driven by the grid's own `isLoading`, so
skeleton and real column widths match). `DataGridPagination` also takes
`sizesSkeleton` / `infoSkeleton` so the footer does not pop in after the rows.

**Recommend: keep ours, add the pagination skeleton props.**

---

## 5. Invoice grid: *data/product work, not components*

Current: Invoice · Customer · Status · Total · Due · Issued.

Add **Balance due** and **Source**. Both are column definitions:

- `Balance due`: the domain `Invoice` already carries `amountDue` as `Money`,
  and the query layer maps `amount_due`. Renders through the existing `Money`
  component, right-aligned with `tabular-nums`.
- `Source`: needs a `source` field added to the domain model and the API
  mapping, then the icon-tile cell from 4.4.

**No new component.** One is pure presentation of a field we have; the other is
a model addition plus an asset set.

---

## 6. Revenue surfaces

**ReUI has no chart component of its own.** The `chart` category is shadcn's
`chart` + Recharts; ReUI contributes 25 free `c-chart-*` styling recipes. Three
of these surfaces have no real registry answer and must be composed.

| Surface | Visualisation | Option | Verdict |
|---|---|---|---|
| **ARR waterfall** | Bridge bars | `c-chart-5` (striped/solid fills) · `c-chart-2` (multi-series) · `c-chart-12` (horizontal) | **No ReUI answer.** Compose: two stacked `<Bar>`s, lower one `fill="transparent"` as the riser, plus a `toWaterfall()` transform emitting `{base, delta}` |
| **Cash forecast** | Actual vs projected | `c-chart-17` (striped forecast zone) · `c-chart-14` (dashed strokes) · `chart-20` (`pro`, `ReferenceLine` + money axis) | **Clean hit.** `c-chart-17` is purpose-built, free, 2 deps |
| **Aging** | Stacked bar + table | `stats-3` (`pro`, legend bar) · `c-chart-2` + `stackId` · `c-data-grid-24` (totals footer) | Free route works: stacked bars over a grid with a real `<tfoot>` total |
| **Recognition / deferred rollforward** | Period columns + totals | `c-data-grid-24` (footer) · `c-data-grid-16` (pin the label column) · `c-data-grid-30` (tree rows) | **No pivot builder in ReUI.** The grid supplies every primitive; the matrix logic is ours |
| **Days to pay** | Distribution + median | `c-chart-1` (histogram) · `c-chart-5` (highlight the median bucket) · `c-rating-6` (proportion rail) | **No box plot, no binning helper.** Histogram is a bar chart; binning is ours |

Every one needs the same four states we already have: loading (`c-data-grid-21`
or our `States`), empty, error, and a no-data-for-this-period case that is
distinct from an error.

Data requirements are **product work**, not UI: an ARR bridge needs
period-over-period movement classification, aging needs an as-of date and bucket
boundaries, rollforward needs opening/closing balances per period. None of that
is a component problem.

---

## 7. Theme and infrastructure

- **`next-themes` is already a dependency** of `@fp/ui`: it arrived with the
  app-shell-3 block. **No provider is mounted anywhere**, and the only
  `useTheme` call sits inside a vendored block we do not render.
- **Dark tokens exist**: two `.dark` blocks in `styles.css` (base + ReUI
  extended), and several of our own components already use `dark:` variants.
- **Missing:** the provider, a toggle in the shell, and any verification that
  vendored components behave in dark mode. We have never rendered it.

Work: mount `ThemeProvider`, add a toggle to the shell header (Ferry uses
`Button variant="ghost" size="icon-sm" aria-pressed={dark}`), then walk every
story in dark mode. Expect contrast failures: we have hit five in light mode
alone, and `--muted-foreground` has already been darkened twice.

---

## 8. Classification

| Requirement | Category | Note |
|---|---|---|
| Data grid, column headers, pagination, column visibility | **Already installed** | Keep passing `rowCount` |
| Badge, Sheet, Dialog, Skeleton, Tooltip, Popover, DropdownMenu | **Already installed** | |
| `EmptyState`, `States`, `Toolbar`, `Money`, `Metric`, `Page` | **Already installed** | Ours |
| Status chips | **Already available + customize** | Rewrite `StatusBadge` to icon-carried colour |
| Sort popover | **Already available + customize** | `DropdownMenu` + two radio groups |
| Detail drawer | **Already available + customize** | `Sheet` + scroll body |
| Table loading skeletons | **Already available + customize** | Add `sizesSkeleton`/`infoSkeleton` |
| Filter builder | **Add from ReUI** | `@reui/filters`, 25 deps: defer until needed |
| Icon tile for source marks | **Add from ReUI** | `@reui/icon-tile`, free, 3 deps |
| Charts | **Add from ReUI** | shadcn `chart` + Recharts + `c-chart-*` recipes |
| Source brand SVGs | **Custom** | Not in the registry; Motion Icons are Ultimate-locked |
| "Fit to window" page sizing | **Custom** | Port Ferry's hook |
| ARR waterfall | **Custom** | Compose from stacked bars; no registry answer |
| Days-to-pay distribution | **Custom** | No box plot, no binning helper |
| Rollforward matrix | **Custom** | No pivot builder |
| Reconciliation two-pane | **Custom** | *Out of scope: Ferry's product, not ours* |
| `Balance due` column | **Data/product work** | Field exists; add the column |
| `Source` column | **Data/product work** | Add to domain model + API mapping |
| Revenue metric definitions | **Data/product work** | Bridge classification, bucket boundaries, balances |
| Dark mode | **Infrastructure** | Dependency present, nothing wired |

---

## 9. Sequencing

1. **Free and immediate**: the `Balance due` column; `StatusBadge` rewritten to
   the icon-carried treatment; pagination skeleton props.
2. **Small installs**: `@reui/icon-tile`, the source-mark asset set, the domain
   `source` field.
3. **Theme**: mount `next-themes`, add the toggle, audit dark mode. Do this
   before charts: chart colours come from tokens, and fixing them twice is waste.
4. **Adopt Ferry's theme split**: `base.css` / `look.css` / `brand.css`, plus
   the vendor-hash check in CI.
5. **Charts**: shadcn `chart` + Recharts, starting with the cash forecast since
   `c-chart-17` makes it nearly free.
6. **Filters**: only when a flat conjunction stops being enough. It is 25
   dependencies and a query tree our URL codec cannot currently round-trip.
