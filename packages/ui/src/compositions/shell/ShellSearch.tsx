import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  ActivityIcon,
  BarChart3Icon,
  LinkIcon,
  BookOpenIcon,
  BotIcon,
  BoxIcon,
  CalculatorIcon,
  CirclePlusIcon,
  CodeXmlIcon,
  CoinsIcon,
  CreditCardIcon,
  DownloadIcon,
  FileMinusIcon,
  FileSignatureIcon,
  FileTextIcon,
  GalleryHorizontalEndIcon,
  HandCoinsIcon,
  HouseIcon,
  KeyRoundIcon,
  LandmarkIcon,
  LayersIcon,
  PercentIcon,
  PlusIcon,
  ReceiptIcon,
  RefreshCwIcon,
  RepeatIcon,
  SearchIcon,
  SettingsIcon,
  TagIcon,
  TicketPercentIcon,
  UserPlusIcon,
  UsersIcon,
  WebhookIcon,
  WorkflowIcon,
  type IconComponent,
} from '@ui/icons'
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
 * reaches for from any screen: find, and start: sit together rather than one
 * in the chrome and one in the sidebar.
 *
 * The distinction matters. An always-present input is a tab stop on every
 * screen and a commitment to filtering *something*: but what it searches
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
 * rather than absent: so the unavailable state says so in words, points at
 * the per-list search boxes that do work, and the shortcuts and the hint are
 * not advertised: the honest empty state, until the endpoint exists.
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
  /** A quiet second line under the label: an email, a parent, a status. */
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
  /**
   * The server lookup failed. Shown as "Search is unavailable" rather than "No
   * results", because an empty list and a broken lookup are different news.
   */
  hasError?: boolean
  /** Reports the typed term (empty when the dialog closes) so the app can query. */
  onTermChange?: (term: string) => void
  onSelect?: (item: ShellSearchItem) => void
  placeholder?: string
}

/** How many destinations to show before anyone has typed. Enough to fill the palette. */
const MAX_STATIC = 12

/** The mark on a row. Pages use the rail glyphs; a record uses the glyph of its list. */
const PAGE_GLYPHS: Record<string, IconComponent> = {
  home: HouseIcon,
  customers: UsersIcon,
  features: BoxIcon,
  plans: LayersIcon,
  addons: CirclePlusIcon,
  'pricing-widget': GalleryHorizontalEndIcon,
  subscriptions: FileSignatureIcon,
  invoices: ReceiptIcon,
  'credit-notes': FileMinusIcon,
  payments: HandCoinsIcon,
  revenue: BarChart3Icon,
  'api-keys': KeyRoundIcon,
  'service-accounts': BotIcon,
  events: ActivityIcon,
  webhooks: WebhookIcon,
  'usage-syncs': RefreshCwIcon,
  exports: DownloadIcon,
  workflows: WorkflowIcon,
  developers: CodeXmlIcon,
  billing: LandmarkIcon,
  integrations: LinkIcon,
  docs: BookOpenIcon,
  settings: SettingsIcon,
  'settings-discounts': TicketPercentIcon,
  'settings-taxes': PercentIcon,
  'settings-cost-tracking': CalculatorIcon,
  'settings-tags': TagIcon,
  'price-units': CoinsIcon,
  groups: UsersIcon,
}

const ACTION_GLYPHS: Record<string, IconComponent> = {
  subscription: RepeatIcon,
  customer: UserPlusIcon,
  invoice: ReceiptIcon,
  payment: CreditCardIcon,
}

const RECORD_GLYPHS: Record<string, IconComponent> = {
  customer: UsersIcon,
  plan: LayersIcon,
  feature: BoxIcon,
  invoice: ReceiptIcon,
}

function glyphFor(item: ShellSearchItem): IconComponent {
  if (item.id.startsWith('page:')) return PAGE_GLYPHS[item.id.slice('page:'.length)] ?? FileTextIcon
  if (item.id.startsWith('action:')) {
    return ACTION_GLYPHS[item.id.slice('action:'.length)] ?? PlusIcon
  }
  const kind = item.id.split(':')[0] ?? ''
  return RECORD_GLYPHS[kind] ?? FileTextIcon
}

function SearchGlyph({ item }: { item: ShellSearchItem }) {
  const Glyph = glyphFor(item)
  return <Glyph />
}

// The default names the *scope*, not just "Search": the list toolbars each say
// "Search plans…", so the header's own search has to say it reaches wider.
export function ShellSearch({
  items = [],
  results = [],
  isSearching = false,
  hasError = false,
  onTermChange,
  onSelect,
  placeholder = 'Search everything',
}: ShellSearchProps) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
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
      // Autofill and some extensions dispatch keydown events with no `key`.
      if (
        (event.key as string | undefined)?.toLowerCase() === 'k' &&
        (event.metaKey || event.ctrlKey)
      ) {
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

  // Announced politely so a screen reader hears the outcome of typing without
  // focus leaving the field. Empty until there is a term to report on.
  const announcement = !needle
    ? ''
    : isSearching
      ? 'Searching'
      : hasError && visible.length === 0
        ? 'Search is unavailable.'
        : `${visible.length} ${visible.length === 1 ? 'result' : 'results'}${
            hasError ? '. Some results could not be loaded.' : ''
          }`

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

  useEffect(() => {
    const node = listRef.current?.querySelector('[aria-selected="true"]')
    if (node instanceof HTMLElement) node.scrollIntoView({ block: 'nearest' })
  }, [active, visible])

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
        {/*
         * The shared dialog caps every popup at `sm:max-w-sm`. A search that
         * wide is a menu, not a place to look through pages and records, so
         * this one overrides it: a wide panel, set high on the page the way a
         * command palette sits, with room for a two-line row.
         */}
        <DialogContent className="top-[10vh] w-[calc(100%-2rem)] max-w-none translate-y-0 gap-0 overflow-hidden p-0 shadow-2xl **:data-[slot=dialog-close]:hidden sm:max-w-3xl">
          {available ? (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>Search</DialogTitle>
                <DialogDescription>
                  Search pages, customers, plans, features and invoices.
                </DialogDescription>
              </DialogHeader>
              <div role="search" className="flex items-center gap-3 border-b px-5">
                <SearchIcon
                  aria-hidden
                  className="text-muted-foreground pointer-events-none size-5"
                />
                <Input
                  type="text"
                  name="q"
                  autoFocus
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={visible.length > 0}
                  {...(visible.length > 0 ? { 'aria-controls': 'shell-search-list' } : {})}
                  aria-activedescendant={
                    visible[active] ? `shell-search-${visible[active].id}` : undefined
                  }
                  aria-label="Search"
                  placeholder="Search pages, customers, plans, invoices…"
                  value={term}
                  onChange={(event) => changeTerm(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  className="h-14 border-none p-0 text-base shadow-none outline-none focus-visible:ring-0"
                />
                <Kbd className="shrink-0">esc</Kbd>
              </div>
              <p role="status" aria-live="polite" className="sr-only">
                {announcement}
              </p>
              <div
                ref={listRef}
                className="max-h-[min(32rem,calc(100dvh-16rem))] overflow-y-auto p-2"
              >
                {/* The listbox holds options only; status messages sit outside it. */}
                <div
                  {...(visible.length > 0
                    ? { id: 'shell-search-list', role: 'listbox', 'aria-label': 'Results' }
                    : {})}
                >
                  {visible.length === 0 ? (
                    isSearching ? (
                      <p className="text-muted-foreground px-3 py-16 text-center text-sm">
                        Searching…
                      </p>
                    ) : hasError ? (
                      <p className="text-muted-foreground px-3 py-16 text-center text-sm">
                        Search is unavailable.
                      </p>
                    ) : (
                      <p className="text-muted-foreground px-3 py-16 text-center text-sm">
                        No results for “{term.trim()}”.
                      </p>
                    )
                  ) : (
                    groups.map(({ group, rows }) => (
                      <Fragment key={group}>
                        <div className="text-muted-foreground px-3 pt-3 pb-1.5 text-xs font-medium">
                          {group}
                        </div>
                        {rows.map((item) => {
                          const index = visible.indexOf(item)
                          const selected = index === active
                          return (
                            <div
                              key={`${group}-${item.id}`}
                              id={`shell-search-${item.id}`}
                              role="option"
                              aria-selected={selected}
                              onMouseMove={() => setActive(index)}
                              onClick={() => choose(item)}
                              className={cn(
                                'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5',
                                selected && 'bg-accent',
                              )}
                            >
                              <span
                                aria-hidden
                                className={cn(
                                  'text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-4',
                                  selected ? 'bg-background' : 'bg-muted',
                                )}
                              >
                                {item.icon ?? <SearchGlyph item={item} />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm">{item.label}</span>
                                {item.hint ? (
                                  <span className="text-muted-foreground block truncate text-xs">
                                    {item.hint}
                                  </span>
                                ) : null}
                              </span>
                              {selected ? (
                                <Kbd aria-hidden className="shrink-0">
                                  ↵
                                </Kbd>
                              ) : null}
                            </div>
                          )
                        })}
                      </Fragment>
                    ))
                  )}
                </div>
                {isSearching && visible.length > 0 ? (
                  <p className="text-muted-foreground px-3 py-2 text-xs">Searching…</p>
                ) : null}
                {hasError && !isSearching && visible.length > 0 ? (
                  <p className="text-muted-foreground px-3 py-2 text-xs">
                    Some results could not be loaded.
                  </p>
                ) : null}
              </div>
              <div className="text-muted-foreground flex items-center gap-4 border-t px-5 py-2.5 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  Move
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Kbd>↵</Kbd>
                  Open
                </span>
                <span className="ml-auto inline-flex items-center gap-1.5">
                  <Kbd>esc</Kbd>
                  Close
                </span>
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
