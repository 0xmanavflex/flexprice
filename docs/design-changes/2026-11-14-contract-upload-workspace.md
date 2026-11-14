Title: Contract upload: a file drop zone and a full-window document workspace

Old reference: none. The console had no way to pick a file (no file input in any page or composition) and no
layout that shows a source document beside the step being worked on.
New reference: the contract-upload wizard prototype (`prototype.html`, "Upload contract"): a drop area with
"Browse files", a file row, and a document preview on the left with the step panel on the right, under a
stepper header. Mapped onto kit parts rather than copied: its colours, `--paper` surface, radio styling and
footer bar are not adopted.

Revision (same day, after review against the prototype): the first build used the browser's PDF viewer and
the console shell, and read as a different screen. It now matches the prototype's frame and document pane:
full window without the sidebar, a bar with "Back to contracts · Upload contract" and named steps, and the
contract drawn as pages with pdf.js.

Why: step 1 of the contract-upload flow (`/contracts/upload`) needs both, and no kit part fits (design rule 7).

Affected:
[x] shared compositions: new `compositions/forms/FileDropzone.tsx` (`FileDropzone`, `FileRow`), built on
    the vendored ReUI `hooks/use-file-upload.ts` (not edited); new `compositions/layout/SplitWorkspace.tsx`
    (`SplitWorkspace`, `WorkspaceBar`); new `compositions/layout/DocumentViewer.tsx` (pdf.js pages, page
    rail of page miniatures; images as one sheet). `WorkflowStepper` gains `showTitles` for the header variant. All have stories.
[x] dependency: `pdfjs-dist` 6.4.299 in `@fp/ui`, loaded on first use only.
[x] console: a full-window layout route (`_focus`, same sign-in guard and access as the shell, no sidebar);
    `/contracts/upload` lives under it. The uploaded file is kept in this browser's IndexedDB (newest 5, 7
    days, cleared on sign-out) so a reload still shows the preview: the backend cannot hand the file back.
[x] pages: new `pages/contracts/upload/ContractUploadPage.tsx`; `SubscriptionGrid` gains an outline
    "Upload contract" button beside the filled "New contract".
[ ] tokens, typography, shell/sidebar: unchanged.
[ ] visual baselines: none yet; the new route has no baseline.

Deliberate differences from the prototype:
- Continue stays in the top bar (the staged-form rule), so `SplitWorkspace` has no footer bar.
- No term highlights on the pages yet: they belong to the steps that show terms; `DocumentViewer` is where
  they will be drawn, from each term's `boxes`.
- "Upload contract" on the list is outline; "New contract" stays the one filled button.
- Accepted files are the backend's real limits: "PDF, PNG or JPG · up to 20 MB" (not DOCX / 40 MB).
- No "Use sample" row and no "Customer: new / existing" choice (no bundled sample; `customer_match` is not
  populated yet).
- Reading shows one honest status line, not per-stage progress: the backend reports no stages.

Retired: the first build's `FilePreview` (the browser's PDF viewer in an iframe), replaced by
`DocumentViewer`. The prototype's footer action bar and its DOCX/40 MB copy are explicitly not adopted.

Decision: approved by the product owner in the implementation session, 2026-11-14. (Name to be filled in on
the PR.)

Migration: none. Steps 2–5 (Customer, Charges, Billing, Review) will compose the same `SplitWorkspace`.
