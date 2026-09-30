import { useEffect, useState } from 'react'
import { SearchIcon } from 'lucide-react'
import { Button } from '@ui/components/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ui/components/primitives/dialog'
import { Input } from '@ui/components/primitives/input'
import { Kbd } from '@ui/components/primitives/kbd'
import { provenance } from '@ui/provenance'

/**
 * Search, as `@reui/app-shell-3` has it: a button that opens a dialog, not a
 * field that sits there collecting focus.
 *
 * It rides in the top bar beside Create, top-right, so the two things a person
 * reaches for from any screen — find, and start — sit together rather than one
 * in the chrome and one in the sidebar.
 *
 * The distinction matters. An always-present input is a tab stop on every
 * screen and a commitment to filtering *something* — but what it searches
 * changes by page, which is how the current dashboard ends up with a search box
 * that sometimes does nothing. A button opens a deliberate surface, and the
 * shortcut is the way most people will reach it anyway.
 *
 * Two shortcuts are bound at the window, because the whole point is that they
 * work without first clicking into the sidebar. `/` is shown, since it is the
 * one worth learning; ⌘K is bound as well because it is what everyone reaches
 * for first and failing silently would teach the wrong thing.
 *
 * Without `onSearch` there is no field at all.
 *
 * The console has no global search endpoint yet, and the shell was rendering
 * the full control anyway: a `/` hint, two bound shortcuts, and an input that
 * took a query, closed the dialog and dropped it. An input that eats what you
 * typed is worse than no input, because it teaches that search is broken
 * rather than absent — so the unavailable state says so in words, points at
 * the per-list search boxes that do work, and the shortcuts and the hint are
 * not advertised. This is the same choice as `notifications={[]}` beside it:
 * the honest empty state, until the endpoint exists.
 */
export const ShellSearchProvenance = provenance({
  source: 'composition',
  composes: ['@reui/app-shell-3', 'ui/button', 'ui/dialog', 'ui/kbd', 'ui/input'],
  note: "The block's search-form, with the submit wired to a callback instead of a mock.",
})

export interface ShellSearchProps {
  /** Called on submit. Absent means search is not available yet. */
  onSearch?: (term: string) => void
  placeholder?: string
}

// The default names the *scope*, not just "Search": the list toolbars each say
// "Search plans…"/"Search features…", so the header's own search has to say it
// reaches wider, or the two read as the same box twice.
export function ShellSearch({ onSearch, placeholder = 'Search everything' }: ShellSearchProps) {
  const [open, setOpen] = useState(false)
  const available = onSearch !== undefined

  useEffect(() => {
    // Nothing to reach, so nothing is bound: a shortcut that opens an
    // apology is still a shortcut that interrupted what you were typing.
    if (!available) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen(true)
        return
      }

      // `/` is the hint Flux shows, and it is the faster of the two — but a
      // bare character cannot be claimed globally, or typing a path into any
      // field on the page opens a dialog on top of it.
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement | null
        const typing =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          target?.isContentEditable === true
        if (typing) return

        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [available])

  return (
    <>
      {/*
        A compact control for the header, sized to sit beside the Create button.
        The hint and label fold away first as the bar narrows, leaving the icon
        alone on a phone where the breadcrumb and Create need the room; the
        button keeps its name for anything reading the tree.
      */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Search"
        {...(available ? { 'aria-keyshortcuts': '/ Meta+K Control+K' } : {})}
        className="text-muted-foreground gap-1.5 font-normal"
      >
        <SearchIcon
          aria-hidden
          className="pointer-events-none size-4 shrink-0 opacity-60 select-none"
        />
        <span className="hidden sm:inline">{placeholder}</span>
        {available ? <Kbd className="ml-1 hidden sm:inline-flex">/</Kbd> : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        {/*
          `w-[calc(100%-2rem)]`, because `max-w-md` alone never engages below
          448px: on a 390px phone the dialog was exactly 390 wide at x=0, its
          rounded corners flush against both edges of the screen.
        */}
        <DialogContent className="w-[calc(100%-2rem)] max-w-md px-4 py-2 **:data-[slot=dialog-close]:top-1/2 **:data-[slot=dialog-close]:right-3 **:data-[slot=dialog-close]:-translate-y-1/2 **:data-[slot=dialog-close]:opacity-60">
          {available ? (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>Search</DialogTitle>
                <DialogDescription>
                  Search customers, invoices, plans and features.
                </DialogDescription>
              </DialogHeader>
              <form
                role="search"
                className="relative flex items-center gap-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  const term = new FormData(event.currentTarget).get('q')?.toString() ?? ''
                  onSearch(term)
                  setOpen(false)
                }}
              >
                <SearchIcon aria-hidden className="pointer-events-none size-4 opacity-60" />
                <Input
                  type="search"
                  name="q"
                  autoFocus
                  aria-label="Search"
                  placeholder="Type to search…"
                  className="h-10 border-none p-0 shadow-none outline-none focus-visible:ring-0"
                />
              </form>
            </>
          ) : (
            <div className="flex items-start gap-3 py-2 pr-6">
              <SearchIcon
                aria-hidden
                className="text-muted-foreground pointer-events-none mt-0.5 size-4 shrink-0 opacity-60"
              />
              <DialogHeader className="items-start gap-1 text-left">
                <DialogTitle className="text-sm font-medium">
                  Search isn&rsquo;t available yet
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm">
                  There is nothing to search across the whole console for now. Each list —
                  customers, invoices, plans, features — has its own search box in its toolbar.
                </DialogDescription>
              </DialogHeader>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
