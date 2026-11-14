Title: Contract upload: term highlights on the document, and reading motion

Old reference: the contract-upload workspace (`2026-11-14-contract-upload-workspace.md`): the document drawn as
pages with no marks on them; while Flexprice AI read it, the only cue was a shimmering status line on the right.
New reference: the "highlight extracted terms in the contract preview" plan (product, 2026-11-14), and the product
owner's request in session for an AI-first reading state ("run scans and shimmers on the preview").

Why: each term the backend extracts carries the boxes it was read from. Drawing them on the page shows where every
value came from, which ones to check, and makes the wait while the contract is read visibly active.

Affected:
[x] shared compositions: `DocumentViewer` takes `source` (a `File` or a URL, so a backend download link can be
passed later), `highlights`, `activeId` / `onSelect`, `filter` / `onFilterChange`, `jumpTo` and `scanning`.
A toolbar holds the legend and the All / Needs review / Off filter. Page sizes are read before layout, so
scrolling to a term lands exactly.
[x] motion: `styles.css` gains `ai-scan` (a violet scan line down each page and miniature, staggered),
`ai-found` (a highlight drawn in left to right, in reading order) and `ai-focus` (one pulse on the selected
term), next to the existing `ai-sweep` / `ai-shimmer`. All are removed under `prefers-reduced-motion`.
[x] pages: `ContractUploadPage` gains page jumps from "Documents in this file", and sweeping placeholders for
the panel while reading. A "Things to check" list on step 1 was tried and removed at the product owner's
request: the terms to check are reviewed on steps 2–4, and on step 1 they show as yellow on the page.
[x] domain: `contractTermNeedsReview` mirrors the backend's `needsCheck` (threshold 90 in one constant);
`collectContractHighlights`, `contractTermLabel`, `contractTermStep`.
[ ] tokens, typography, shell: unchanged. Highlight colours are the `success` and `warning` tokens.
[ ] visual baselines: none for this route yet.

Deliberate differences from the plan:

- pdf.js is used directly (already in place), not `react-pdf`; the viewer stays in `compositions/layout`.
- The chosen file is also kept in this browser (IndexedDB, from the earlier revision), so the preview and its
  highlights survive a reload in the browser that uploaded it.
- No term rows on step 1: term rows with markers, and the model's free-text doubts, belong to steps 2–4.
- Highlights are painted like a highlighter, never stacked: several terms are often read from the same words, so
  each line is cut into side-by-side stretches (`compositions/layout/documentMarks.ts`). A stretch is yellow if
  any term on it needs review, selects the narrowest term (clicking again moves to the next), and lists them all
  in its tooltip. "Needs review" is a dashed underline rather than a dashed border, so stretches never nest.
- A term's boxes may sit on several pages (the backend returns one per place read), so a highlight has no single
  `page`; each box carries its own.

Retired: the reading state's lone status line as the only activity cue (it stays, with the scan beside it).

Decision: approved by the product owner in the implementation session, 2026-11-14. (Name to be filled in on
the PR.)

Migration: none.
