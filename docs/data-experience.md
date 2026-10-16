# Data experience: loading, empty, error and freshness states

How the console presents data that is loading, missing, stale, failed or
provisional. This is the audit, the state model, the shared primitives and the
roll-out plan. The primitives live in `packages/ui/src/compositions/feedback/`.

The goal is not more animation. It is one coherent answer to "what is on this
screen, and can I trust it?" on every page.

## 1. Principles

1. **Data on screen beats a spinner or an error.** A background refresh keeps
   the rows, the chart and the numbers; it adds a quiet indicator and nothing else.
2. **With no data: error beats loading beats empty.** A failed request is never
   shown as "No results".
3. **Empty has two meanings.** First-run ("you have none yet") and filtered
   ("nothing matches") get different copy, art and actions. A search miss never
   offers a create button and never implies data was lost.
4. **Billing correctness beats speed.** Never show a speculative amount, status,
   revenue or balance as confirmed. Loading and unknown are never `0`, `$0.00`,
   `0%` or "No X". Stale and provisional values are marked.
5. **A skeleton must not hide a slow API.** Skeletons are for the 200ms to 8s
   window. Past that, the page says it is slow and offers retry. Root causes
   (waterfalls, duplicate requests, missing cancellation) are fixed in the
   query layer, not papered over.
6. **No layout shift.** Skeletons use the real column widths and row heights.
7. **Motion is optional.** Everything decorative is `aria-hidden` and stops
   under `prefers-reduced-motion`.

## 2. State model

`resolveDataState()` (`compositions/feedback/dataState.ts`) is the single
decision function. Input: `isPending`, `isError`, `hasData`, `isEmpty`,
`isFiltered`, `isFetching`, `isPlaceholderData`. Output: a `kind` plus three
flags.

| Kind       | Meaning                                       | Flags                                |
| ---------- | --------------------------------------------- | ------------------------------------ |
| `loading`  | No data yet, request in flight                | none                                 |
| `error`    | No data and the request failed                | none                                 |
| `empty`    | Loaded, nothing exists (first-run)            | none                                 |
| `filtered` | Loaded, filters or search excluded everything | none                                 |
| `ready`    | Data to show                                  | `refreshing`, `stale`, `provisional` |

The product states the brief asks for map onto this model:

| Product state              | Kind       | Flag or surface                                                      |
| -------------------------- | ---------- | -------------------------------------------------------------------- |
| Initial loading            | `loading`  | `LoadingGate` phases below                                           |
| Background refreshing      | `ready`    | `refreshing` -> `RefreshingIndicator`                                |
| First-time empty           | `empty`    | `EmptyState` + catalogue entry                                       |
| Filtered empty             | `filtered` | `EmptyState` (`filter` / `search`)                                   |
| Partial data               | `ready`    | `PartialDataNotice` for the failed section                           |
| Slow response              | `loading`  | `Deferred` message after 8s                                          |
| Recoverable error          | `error`    | `ErrorState` + `RetryAction`                                         |
| Permission / config        | `error`    | `ErrorState kind=denied`, or `setup` figure; no retry                |
| Stale data                 | `ready`    | `stale` -> `DataFreshness` "Couldn't refresh. Showing data from ..." |
| Successful update          | `ready`    | refetch replaces value; toast confirms                               |
| Destructive / transitional | `ready`    | `provisional` -> `DataRegion` dimmed + pending label                 |

### Transition matrix

| From \ Event | request starts  | succeeds with rows | succeeds, none   | fails | refetch starts     | refetch fails        | filter changes                               |
| ------------ | --------------- | ------------------ | ---------------- | ----- | ------------------ | -------------------- | -------------------------------------------- |
| idle         | loading (gated) |                    |                  |       |                    |                      |                                              |
| loading      |                 | ready              | empty / filtered | error |                    |                      | loading (keeps previous rows if placeholder) |
| ready        |                 |                    |                  |       | ready + refreshing | ready + stale        | ready + refreshing + provisional             |
| empty        |                 |                    |                  |       | empty + refreshing | empty (+ stale note) | filtered or loading                          |
| error        | loading (retry) |                    |                  |       |                    |                      |                                              |

`LoadingGate` (`loadingGate.ts`) keeps flicker out: **idle -> reserved**
(space held, nothing drawn) **-> visible** (after 200ms, held at least 400ms)
**-> slow** (after 8s). A request that finishes in under 200ms never shows a
skeleton.

## 3. Inventory of shared primitives

All exported from `@fp/ui/compositions`.

| Primitive                                                         | Brief name                         | File                                                                   |
| ----------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| `PageLoadingState`                                                | PageLoadingState                   | `Skeletons.tsx`                                                        |
| `TableSkeleton`                                                   | TableSkeleton                      | `Skeletons.tsx`                                                        |
| `ChartSkeleton`                                                   | ChartSkeleton                      | `Skeletons.tsx`                                                        |
| `MetricCardSkeleton`                                              | MetricCardSkeleton                 | `Skeletons.tsx`                                                        |
| `InlineLoadingState`                                              | InlineLoadingState                 | `Skeletons.tsx`                                                        |
| `ValuePlaceholder`                                                | stable money placeholder           | `Skeletons.tsx`                                                        |
| `RefreshingIndicator`                                             | RefreshingIndicator                | `DataBoundary.tsx`                                                     |
| `DataFreshness`                                                   | DataFreshnessIndicator             | `DataBoundary.tsx`                                                     |
| `PartialDataNotice`                                               | PartialDataState                   | `DataBoundary.tsx`                                                     |
| `Deferred`, `DataRegion`                                          | slow-load message, refresh wrapper | `DataBoundary.tsx`                                                     |
| `EmptyState` (+ `figure`, `motion`)                               | EmptyState / FilteredEmptyState    | `EmptyState.tsx`                                                       |
| `ErrorState` (+ `kind`, `variant`)                                | ErrorState                         | `States.tsx`                                                           |
| `RetryAction`                                                     | RetryAction                        | `RetryAction.tsx`                                                      |
| `ListState`                                                       | list orchestrator                  | `States.tsx`                                                           |
| `Figure`                                                          | hairline illustrations             | `Figures.tsx`                                                          |
| `EMPTY_CATALOGUE`                                                 | copy and art per kind              | `emptyCatalogue.ts`                                                    |
| `resolveDataState`, `LoadingGate`, `useLoadingPhase`, `formatAge` | logic                              | `dataState.ts`, `loadingGate.ts`, `useLoadingPhase.ts`, `freshness.ts` |

Page-side helper: `apps/console/src/pages/shared/listFailure.ts`
(`toListFailure`) maps an `ApiError` kind to message, retry judgement and
`ErrorState` kind, replacing ~17 per-page copies.

Vendored ReUI files (`skeleton`, `empty`, `icon-stack`) are composed, not edited.

## 4. Loading-pattern catalogue

| Pattern               | Use                                | Rules                                                                                                  |
| --------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Gated skeleton        | any first load                     | 200ms delay, 400ms minimum, so fast responses never flash                                              |
| `TableSkeleton`       | lists                              | pass the table's real column widths and row height (default 52px); no numbers                          |
| `MetricCardSkeleton`  | KPI tiles                          | label, value at `text-2xl` height, optional delta line                                                 |
| `ChartSkeleton`       | charts                             | gridlines and axis bones only. No curve, no bars: a drawn shape would read as the customer's own trend |
| `ValuePlaceholder`    | a figure inside a sentence or tile | a pulsing bar, never `0`, `-` or `$0.00`                                                               |
| `InlineLoadingState`  | a section or card that is working  | spinner + sentence, `role=status`                                                                      |
| `RefreshingIndicator` | background refetch                 | 300ms delay, thin top bar, polite live region; content stays                                           |
| `DataRegion`          | list or card wrapper               | `aria-busy`; dims at `opacity-60` only when `provisional`                                              |
| `Deferred`            | slow load                          | after 8s: "Still loading. This is taking longer than usual." + retry                                   |
| `RetryAction`         | any retry                          | ref guard against double click, "Retrying...", 429 cooldown "Try again in Ns"                          |

Accessibility: one `role=status` line per skeleton region; bones are
`aria-hidden`; `aria-busy` on the region; no repeated announcements.

## 5. Empty-state catalogue

Source of truth: `EMPTY_CATALOGUE` in `emptyCatalogue.ts` (title, description,
labels, figure, motion for each). The table is the contract.

| Kind           | Figure  | Motion      | Title                         | Primary             | Secondary      |
| -------------- | ------- | ----------- | ----------------------------- | ------------------- | -------------- |
| customers      | people  | interactive | No customers yet              | Add customer        | Read the guide |
| subscriptions  | rail    | interactive | No subscriptions yet          | Create subscription |                |
| plans          | stack   | interactive | No plans yet                  | Create plan         |                |
| features       | stack   | interactive | No features yet               | Create feature      |                |
| charges        | ledger  | ambient     | No charges on this plan       | Add charge          |                |
| entitlements   | padlock | ambient     | No entitlements yet           | Add entitlement     |                |
| events         | signal  | interactive | No events received yet        | Send a test event   | Read the guide |
| invoices       | ledger  | interactive | No invoices yet               | Create subscription |                |
| payments       | ledger  | ambient     | No payments yet               |                     |                |
| credits        | ledger  | ambient     | No credits yet                |                     |                |
| usage-period   | plot    | ambient     | No usage in this period       |                     |                |
| revenue-period | plot    | ambient     | No revenue in this period     |                     |                |
| integrations   | plug    | interactive | Nothing connected yet         | Browse integrations |                |
| environments   | drawer  | ambient     | No environments               | Create environment  |                |
| activity       | rail    | static      | No activity yet               |                     |                |
| chart          | plot    | ambient     | Nothing to chart              |                     |                |
| search         | loupe   | static      | No results                    |                     |                |
| filter         | sieve   | static      | No matches for these filters  | Clear filters       |                |
| permission     | padlock | ambient     | You don’t have access to this |                     |                |
| setup          | plug    | ambient     | Finish setting this up        | Continue setup      |                |
| unavailable    | drawer  | ambient     | Not available here            |                     |                |

Rows with no primary action are deliberate: payments and credits are produced by billing, the period-empty kinds are not first-run, and a search miss never offers to create anything (a filter miss only offers to clear).

Motion levels: `static` (a drawing, used inline and in table bodies),
`ambient` (the front layer drifts 1-2px), `interactive` (layers lean toward
the pointer; CSS variables only, no re-render). All off under reduced motion.

## 6. Data-presentation rules

| Case                         | Rule                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| Loading money                | `ValuePlaceholder` of the same width; never a zero                                 |
| Unavailable money            | "Unavailable" with retry; em dash only when genuinely empty                        |
| Mixed currencies             | never sum across currencies; show per-currency                                     |
| Invalid currency code        | `Money` falls back to code + number, never throws                                  |
| Long names, IDs, lookup keys | `min-w-0` + `truncate` + `title` with the full value                               |
| Null / undefined             | em dash, never `null`, `undefined` or `0`                                          |
| Percent near 100             | `UsageMeter` floors; 99.5% never displays as 100%                                  |
| Invalid dates                | omit or em dash, never "Invalid Date"                                              |
| Truncated sets               | say so: "Based on the latest 200 invoices"                                         |
| Page-local filters           | label "Filtered within this page"; never claim a global filtered-empty             |
| Chart gaps                   | missing points are gaps, not zeros                                                 |
| Out-of-order responses       | query keys carry every input; superseded responses are cancelled via `AbortSignal` |
| UTC windows                  | label the time zone                                                                |
| Demo data                    | never shown as real; empty or "Not available yet"                                  |

## 7. API and performance findings

Severity: H high, M medium, L low. Status is updated at the end of the work.

| #   | Sev | Finding                                                                                      | Where                                                                                                                                                                                 | Fix                                                          |
| --- | --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| A1  | H   | `throwOnError` for 5xx can blank the shell even on a background refetch; no `errorComponent` | `packages/query/src/client.ts:28`                                                                                                                                                     | throw only when the query has no data; route error component |
| A2  | H   | No `AbortSignal`, no request timeout                                                         | `packages/api/src/client.ts:100`                                                                                                                                                      | thread `signal`, 20s deadline, `Timeout` kind                |
| A3  | H   | List search not debounced; URL drives the input                                              | `GridToolbar.tsx`, `Toolbar.tsx`                                                                                                                                                      | local input state, 250ms debounce to URL                     |
| A4  | H   | Home fires 7+ requests; `useCustomers` twice; 100-row pages used only for counts             | `HomePage.tsx`                                                                                                                                                                        | share one call, derive counts from totals                    |
| A5  | M   | Query keys lack the environment id                                                           | `keys.ts`                                                                                                                                                                             | add env id                                                   |
| A6  | M   | No route preload, pending or loaders; detail not seeded from list cache                      | router                                                                                                                                                                                | follow-up                                                    |
| A7  | M   | Only `isPending` used; no refreshing/stale/provisional cues                                  | pages                                                                                                                                                                                 | `resolveDataState`, `describeFreshness`                      |
| A8  | M   | Missing `placeholderData` on paged hooks                                                     | `useCustomerInvoices`, `usePrices`, `usePlanSubscriptions`, entitlements, `useCustomerWallets`, `useWalletTransactions`, `useCustomerUsageSummary`, `useNavCounts`, `useCatalogStats` | `keepPreviousData`                                           |
| A9  | M   | `useFeatureLinkage` is N+1                                                                   | `featureLinkage.ts`                                                                                                                                                                   | bounded parallel / batch                                     |
| A10 | L   | 429 mapped to non-retryable `Invalid`; timeout and abort mapped to `Network`                 | `errors.ts`                                                                                                                                                                           | `RateLimited` + `retryAfterMs`, `Timeout` (done)             |
| A11 | L   | Broad invalidations; zero optimistic updates                                                 | mutations                                                                                                                                                                             | intentional: money and status are never optimistic           |
| A12 | L   | `onUnauthorized` not de-duplicated                                                           | `session`                                                                                                                                                                             | once per burst                                               |
| A13 | L   | 5xx retries show a spinner for ~7s                                                           | retry policy                                                                                                                                                                          | bounded backoff + visible "Retrying"                         |

Measurement plan: React Profiler on the invoice, event and customer lists with
1k+ rows; request waterfall from the browser Network panel on Home and customer
detail (count, duplicates, cancelled); Lighthouse/INP on the Home dashboard
under 4x CPU and Slow 4G throttling; chart aggregation cost on a 90-day usage
series. Baselines to be recorded before and after in the PR.

## 8. Current-state audit (by area)

**Dashboard, charts, billing.** Loading shown as zero on Home ("0 new
contracts", "Invoices 0" donut); Revenue Mix and Collections say "no
events/invoices" while loading; Revenue ignores invoice errors; the 200-invoice
cut is undisclosed; Payments hardcodes `$0.00` USD and picks the lead currency
by count; payment and derived-invoice filters are page-local against an
unfiltered total; Tabs show a dash for both loading and unavailable; "No
revenue in this period" beside a non-zero headline; panels have no retry.

**Entity pages.** Sub-tab errors render false empties (customer invoices,
entitlements, cost-sheet prices, wallet transactions, invoice payments/credit
notes). Several tabs present demo data as real (customer analytics, addon
contracts, coupon redemptions, group members, cost-sheet margin, activity
logs). Invoice list overwrites `total`, breaking pagination. Invoice actions
lack double-click guards. First-run empty keys off `rows.length`, wrong on
out-of-range pages. Detail 404 merges into "could not be loaded" and its
"Try again" navigates away.

**Settings, shell, events, webhooks.** Disabled queries show an infinite
skeleton (Profile, Portal, Onboarding, Wallet alerts, WebhookPortalGate).
`IntegrationListPage` shows "No integrations match these filters" on error.
Webhook catalog and activity errors render as an empty state without retry;
endpoint grid shows `0%` with no data. Event list renders two loaders and
ignores the date range in `isFiltered`. Dialogs can be dismissed mid-request.
Shell search swallows errors (looks like "No results") and is not announced.

## 9. Prioritised issue list

P0 (wrong or misleading billing data): fake zeros on Home/Revenue/Payments;
sub-tab false empties; demo data shown as real; hardcoded USD; page-local
filters with global totals; 5xx blanking the shell.

P1 (trust and recovery): infinite skeletons; errors presented as empty;
missing retry; dialogs dismissible mid-request; double-submit on invoice
actions; no timeout/abort; 429/timeout kinds.

P2 (polish and performance): search debounce; request fan-out on Home;
`placeholderData`; env id in keys; truncation and tooltips; arrow keys on tabs;
reduced motion on Recharts; announcements.

P3 (follow-up): route loaders and preload; list-to-detail cache seeding;
virtualised tables; server-side filters for derived statuses.

## 10. Component plan

Built (foundation): state model, loading gate, shaped skeletons, money-safe
placeholder, refresh/freshness/partial primitives, retry action, error kinds,
hairline figures, empty catalogue, `ListState` rework.

Applied incrementally in four disjoint slices: query/api layer; dashboard and
billing; entity pages; settings/integrations/shell/events/webhooks.

Provenance: new compositions declare `composes` for what they import;
`Figure` is `custom` (ReUI has no line-drawing illustrations).

## 11. Test strategy

| Layer                       | What                                                                                                                             | Where                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Unit                        | `resolveDataState` transitions, `LoadingGate` timing (fake timers), `formatAge`/`nextTickMs`                                     | `feedback/*.test.ts`             |
| Unit                        | retry policy per kind, timeout, abort, 429 `Retry-After`, throwOnError-only-without-data, unauthorized dedupe, env id in keys    | `packages/api`, `packages/query` |
| Component / Storybook       | every state story (Loading, Error kinds, Partial, Freshness, Deferred, Empty catalogue, Figures); a11y checks run in story tests | `*.stories.tsx`                  |
| API (MSW)                   | delayed, failed, malformed and 429 responses                                                                                     | mock handlers + e2e              |
| E2E (Playwright, mock mode) | background-refresh preservation, retry, empty vs filtered vs error, no layout shift on arrival                                   | `apps/console/e2e`               |
| A11y                        | single announcement per region, keyboard retry, reduced motion removes animation                                                 | story tests, e2e                 |
| Perf                        | no flicker under 200ms; slow-network (throttled) shows slow message at 8s; out-of-order responses never overwrite newer          | e2e with delayed mock handlers   |
| Visual regression           | CI baselines refreshed after the `ListState` wrapper change                                                                      | CI                               |

## 12. Roadmap

1. **Done:** state model, primitives, figures, catalogue, `ListState`/`ErrorState` upgrades, error kinds.
2. **Done in this change:** root-cause fixes in the query/api layer; the four page slices above.
3. **Next:** route loaders and preload; cache seeding from lists; server-side filters for derived invoice/payment statuses; table virtualisation; real data sources for the pages that currently have none (customer analytics, coupon redemptions, group members, cost-sheet margin); CI visual-baseline refresh; recorded perf baselines.
