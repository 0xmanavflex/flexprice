import { Fragment, useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
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
import { cn } from '@ui/lib/cn'
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
 * Without `onSelect` there is no field at all.
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
  composes: ['ui/button', 'ui/dialog', 'ui/kbd', 'ui/input'],
  note: "The block's search-form, with the submit wired to a callback instead of a mock. Lineage: @reui/app-shell-3.",
})

export interface ShellSearchItem {
  id: string
  label: string
  /** The heading the row sits under: Pages, Actions, Customers… */
  group: string
  /** A quiet second line or trailing hint — an email, a status. */
  hint?: string
  icon?: ReactNode
  /** Extra words that should match without being shown. */
  keywords?: string
}

export interface ShellSearchProps {
  /** Always-available destinations and actions, filtered on the client. */
  items?: ShellSearchItem[]
  /** Records found on the server for the current term, shown beneath `items`. */
  results?: ShellSearchItem[]
  isSearching?: boolean
  /** Reports the typed term (empty when the dialog closes) so the app can query. */
  onTermChange?: (term: string) => void
  onSelect?: (item: ShellSearchItem) => void
  placeholder?: string
}

const MAX_STATIC = 8

// The default names the *scope*, not just "Search": the list toolbars each say
// "Search plans…", so the header's own search has to say it reaches wider.
export function ShellSearch({
  items = [],
  results = [],
  isSearching = false,
  onTermChange,
  onSelect,
  placeholder = 'Search everything',
}: ShellSearchProps) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [active, setActive] = useState(0)
  const available = onSelect !== undefined

  const changeTerm = (next: string) => {
    setTerm(next)
    setActive(0)
    onTermChange?.(next)
  }

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (!next) changeTerm('')
  }

  useEffect(() => {
    // Nothing to reach, so nothing is bound.
    if (!available) return

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen(true)
        return
      }

      // A bare `/` cannot be claimed while someone is typing in a field.
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

  const needle = term.trim().toLowerCase()
  const visible = useMemo(() => {
    const matched = needle
      ? items.filter((item) =>
          `${item.label} ${item.group} ${item.keywords ?? ''}`.toLowerCase().includes(needle),
        )
      : items.slice(0, MAX_STATIC)
    return [...matched, ...(needle ? results : [])]
  }, [items, results, needle])

  const groups = useMemo(() => {
    const order: string[] = []
    const byGroup = new Map<string, ShellSearchItem[]>()
    for (const item of visible) {
      if (!byGroup.has(item.group)) {
        byGroup.set(item.group, [])
        order.push(item.group)
      }
      byGroup.get(item.group)!.push(item)
    }
    return order.map((group) => ({ group, rows: byGroup.get(group)! }))
  }, [visible])

  const choose = (item: ShellSearchItem) => {
    onSelect?.(item)
    changeOpen(false)
  }

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (visible.length === 0 ? 0 : (index + 1) % visible.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) =>
        visible.length === 0 ? 0 : (index - 1 + visible.length) % visible.length,
      )
    } else if (event.key === 'Enter') {
      const item = visible[active]
      if (item) {
        event.preventDefault()
        choose(item)
      }
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Search"
        {...(available ? { 'aria-keyshortcuts': '/ Meta+K Control+K' } : {})}
        className="text-muted-foreground h-8 font-normal sm:w-56 sm:justify-start"
      >
        <SearchIcon aria-hidden />
        <span className="hidden sm:inline">{placeholder}</span>
        {available ? <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd> : null}
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-xl gap-0 p-0 **:data-[slot=dialog-close]:hidden">
          {available ? (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>Search</DialogTitle>
                <DialogDescription>
                  Search pages, customers, plans, features and invoices.
                </DialogDescription>
              </DialogHeader>
              <div role="search" className="flex items-center gap-3 border-b px-4">
                <SearchIcon aria-hidden className="pointer-events-none size-4 opacity-60" />
                <Input
                  type="text"
                  name="q"
                  autoFocus
                  autoComplete="off"
                  role="combobox"
                  aria-expanded
                  aria-controls="shell-search-list"
                  aria-activedescendant={
                    visible[active] ? `shell-search-${visible[active].id}` : undefined
                  }
                  aria-label="Search"
                  placeholder="Search pages, customers, plans, invoices…"
                  value={term}
                  onChange={(event) => changeTerm(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  className="h-12 border-none p-0 shadow-none outline-none focus-visible:ring-0"
                />
                <Kbd className="shrink-0">Esc</Kbd>
              </div>
              <div
                id="shell-search-list"
                role="listbox"
                aria-label="Results"
                className="max-h-80 overflow-y-auto p-2"
              >
                {visible.length === 0 ? (
                  <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                    {isSearching ? 'Searching…' : `No results for “${term.trim()}”.`}
                  </p>
                ) : (
                  groups.map(({ group, rows }) => (
                    <Fragment key={group}>
                      <div className="text-muted-foreground px-3 pt-2 pb-1 text-xs font-medium">
                        {group}
                      </div>
                      {rows.map((item) => {
                        const index = visible.indexOf(item)
                        return (
                          <div
                            key={`${group}-${item.id}`}
                            id={`shell-search-${item.id}`}
                            role="option"
                            aria-selected={index === active}
                            onMouseMove={() => setActive(index)}
                            onClick={() => choose(item)}
                            className={cn(
                              'flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm',
                              index === active && 'bg-muted',
                            )}
                          >
                            {item.icon ? (
                              <span className="text-muted-foreground flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
                                {item.icon}
                              </span>
                            ) : null}
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {item.hint ? (
                              <span className="text-muted-foreground max-w-[45%] truncate text-xs">
                                {item.hint}
                              </span>
                            ) : null}
                          </div>
                        )
                      })}
                    </Fragment>
                  ))
                )}
                {isSearching && visible.length > 0 ? (
                  <p className="text-muted-foreground px-3 py-2 text-xs">Searching…</p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3 p-4">
              <SearchIcon
                aria-hidden
                className="text-muted-foreground pointer-events-none mt-0.5 size-4 shrink-0 opacity-60"
              />
              <DialogHeader className="items-start gap-1 text-left">
                <DialogTitle className="text-sm font-medium">
                  Search isn&rsquo;t available yet
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm">
                  Each list has its own search box in its toolbar.
                </DialogDescription>
              </DialogHeader>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
