import { useEffect, useState } from 'react'
import { SearchIcon } from 'lucide-react'
import { Button } from '@ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ui/primitives/dialog'
import { Input } from '@ui/primitives/input'
import { Kbd } from '@ui/primitives/kbd'
import { SidebarGroup, SidebarGroupContent } from '@ui/primitives/sidebar'
import { provenance } from '@ui/provenance'

/**
 * Search, as `@reui/app-shell-3` has it: a button in the sidebar that opens a
 * dialog, not a field that sits there collecting focus.
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

export function ShellSearch({ onSearch, placeholder = 'Search...' }: ShellSearchProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
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
  }, [])

  return (
    <>
      <SidebarGroup className="py-0">
        <SidebarGroupContent className="relative flex items-center">
          {/*
            Flux's search, as written. The icon is laid out inline rather than
            positioned absolutely, which is what lets the whole control shrink
            to a 32px circle in the rail without the icon drifting off-centre.
            The label is *hidden* when collapsed, not made transparent — the
            transparent version left a ghost of the word inside the circle.
          */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(true)}
            aria-label="Search"
            aria-keyshortcuts="/ Meta+K Control+K"
            className="border-border/60 hover:bg-sidebar-accent/80! h-8 w-full justify-start gap-1.5 overflow-hidden rounded-full pl-2 font-normal shadow-none transition-[width,padding] duration-200 ease-linear in-data-[state=collapsed]:mx-auto in-data-[state=collapsed]:w-8! in-data-[state=collapsed]:justify-center in-data-[state=collapsed]:gap-0 in-data-[state=collapsed]:px-0!"
          >
            <SearchIcon
              aria-hidden
              className="pointer-events-none size-3.5 shrink-0 opacity-50 select-none"
            />
            <span className="in-data-[state=collapsed]:hidden">{placeholder}</span>
          </Button>
          <Kbd className="absolute top-1/2 right-2 -translate-y-1/2 in-data-[state=collapsed]:hidden">
            /
          </Kbd>
        </SidebarGroupContent>
      </SidebarGroup>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md px-4 py-2 **:data-[slot=dialog-close]:top-1/2 **:data-[slot=dialog-close]:right-3 **:data-[slot=dialog-close]:-translate-y-1/2 **:data-[slot=dialog-close]:opacity-60">
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
              onSearch?.(term)
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
        </DialogContent>
      </Dialog>
    </>
  )
}
