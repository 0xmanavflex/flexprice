# Design change process

Changing what the console looks like is a design change, not an implementation tweak. A new reference, a new
colour, a new component pattern: all of them go through this page before any code moves. The drift this
prevents is documented in the divergence report: three design targets in thirteen days, none retired.

Copy the template below into the PR description (or `docs/design-changes/YYYY-MM-DD-title.md` for large ones).

```text
Title:

Old reference:            (what the page looks like today, with link or screenshot)
New reference:            (what it should look like, with link or screenshot)

Why:

Affected:
  [ ] tokens (styles.css)
  [ ] typography
  [ ] shell / sidebar
  [ ] a shared composition: ...
  [ ] pages: ...
  [ ] visual baselines: ...

Retired:                  (the old guidance, component or token that is deleted in this change)

Decision:                 approved by <name>, <date>

Migration:                (order of work; what is frozen until it lands)
```

Rules:

1. Nothing visual changes without an approver named in "Decision".
2. "Retired" must not be empty. If the change adds a look without removing one, two systems now exist.
3. `UI_SOURCE_OF_TRUTH.md` is updated in the same change.
4. Visual baselines are updated in the same change, and the PR shows the before/after screenshots.
5. Changes to `styles.css`, shared compositions, `vendor.lock.json` and baselines need design-system review
   (`.github/CODEOWNERS`).
