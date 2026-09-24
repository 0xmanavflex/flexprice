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
 * The shortcut is bound at the window, because the whole point is that it works
 * without first clicking into the sidebar.
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

export function ShellSearch({ onSearch, placeholder = 'Search…' }: ShellSearchProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
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
        <SidebarGroupContent className="relative">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(true)}
            aria-label="Search"
            aria-keyshortcuts="Meta+K Control+K"
            className="hover:bg-background h-8 w-full justify-start pl-7 font-normal transition-[width] duration-200 ease-linear in-data-[state=collapsed]:w-8! in-data-[state=collapsed]:pl-4! in-data-[state=collapsed]:text-transparent"
          >
            {placeholder}
          </Button>
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 opacity-50 select-none"
          />
          <Kbd className="absolute top-1/2 right-2 -translate-y-1/2 in-data-[state=collapsed]:hidden">
            ⌘K
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
