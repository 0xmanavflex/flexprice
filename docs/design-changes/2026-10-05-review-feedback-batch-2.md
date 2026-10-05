Title: Review feedback, batch 2: no status dropdown, no toolbar on an empty list, full-viewport forms, full-width sidebar rows

Old reference: a "Status" dropdown (with counts) in the toolbar of every list; the search, filter and sort bar over
the first-run empty state; create and edit forms as a card centred in the page; sidebar child rows as wide as their
label.
New reference: lists have search, filter, sort and the table menu only; a list with no records shows the guided
empty state alone; a form card fills the viewport under the header with its actions at the foot; a sidebar child row
runs to the end of the sidebar.

Why: product review on 2026-10-05. Status is already a column and a filter-builder entry, so the dropdown was a
third place for the same control; a toolbar over nothing offers controls that cannot do anything; short forms floated
in empty space; the narrow hover and active fill on child rows looked unfinished.

Affected:
[x] shared compositions: `FormPage` (card `flex-1`, footer `mt-auto`; `narrow` now caps the fields, not the surface),
    `ShellNav` (child row `w-full`)
[x] list surface: `EntityList` loses its `status` prop and its `EntityStatusSelect` / `EntityStatusOption` types; the
    toolbar is not rendered on the first-run empty state
[x] pages: every `*Grid` drops its status block; plan, feature, add-on and coupon list pages stop fetching the
    per-status counts (`useCatalogStats` is now unused)
[x] stories: the status-dropdown stories are removed; new assertions for the empty toolbar and the child-row width
[x] visual baselines: list, empty-state and form routes, plus any route showing the sidebar sub-menu
[ ] tokens, typography: unchanged

Retired: the status dropdown; the status counts on plan, feature, add-on and coupon lists.

Decision: design owner, 2026-10-05. Dialog forms (`FormDialog`) are unchanged: they are not full-page create forms.

Migration: callers drop `status` from `EntityList` (and `statusCounts` from the four grids that took it). `?statuses=`
in the URL still filters; there is just no dropdown to set it.
