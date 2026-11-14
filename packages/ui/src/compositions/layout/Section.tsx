import { createContext, useState, type ReactNode } from 'react'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * A detail table portals its filter and sort here, so they sit in the section
 * header beside the action on every detail page, not inside one page's table.
 */
export const SectionToolsContext = createContext<{
  el: HTMLElement | null
  /** The section shows its own title, so the table's search stays off and its filter and sort sit beside that title. */
  titled: boolean
} | null>(null)

/**
 * A titled, bordered surface on a detail or settings page.
 *
 * Resolution (UI_REVAMP rule 4 vs the Card-like look): pages never use the
 * `Card` primitive for sections; they compose `Section` / DetailKit parts, and
 * the reference app's Section markup wins: `bg-background rounded-xl border`,
 * a `border-b px-6 py-4` header, and a body that is `p-6` unless `flush`
 * (tables and lists that run edge to edge). Side-by-side sections stretch to
 * equal height because the body is `flex-1`.
 *
 * The title is a real heading and `aria-labelledby` points the region at it.
 */
export const SectionProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'Reference Section: bordered panel with header rule, action slot, padded or flush body. Not the Card primitive.',
})

export interface SectionProps {
  title: string
  /** Buttons scoped to this section, in the header. */
  actions?: ReactNode
  /** Reference name for `actions`; either works. */
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  /** No inner padding: for tables and lists that run edge to edge. */
  flush?: boolean
  /** No header band: the title stays as a screen-reader heading and the body (a table) leads with its own search. */
  bare?: boolean
  /**
   * For a table: title and actions stay above the bordered body.
   * Empty, loading and populated content share that same frame.
   */
  table?: boolean
  /**
   * With `table`: defaults to a visible title and action above the box.
   * Set false only when the surrounding context already supplies the heading.
   */
  showTitle?: boolean
  /** With `table` and `showTitle`: sits on the title's line, right after it ("View all"). */
  titleAction?: ReactNode
  /** A line under the title. With `table`, needs `showTitle` to be visible. */
  description?: string
  /** Heading level, so a page's outline stays correct. */
  as?: 'h1' | 'h2' | 'h3'
}

export function Section({
  title,
  actions,
  action,
  children,
  className,
  bodyClassName,
  flush,
  bare,
  table,
  showTitle = true,
  titleAction,
  description,
  as: Heading = 'h2',
}: SectionProps) {
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const headerAction = actions ?? action
  const [toolsEl, setToolsEl] = useState<HTMLDivElement | null>(null)
  const toolsSlot = { el: toolsEl, titled: !bare && (!table || showTitle) }
  const tools = <div ref={setToolsEl} className="flex items-center gap-2 empty:hidden" />

  if (table) {
    return (
      <SectionToolsContext.Provider value={toolsSlot}>
        <section
          aria-labelledby={id}
          className={cn('bg-background flex flex-col overflow-hidden rounded-xl border', className)}
        >
          {showTitle ? (
            <div className="flex items-center justify-between gap-4 border-b px-6 py-4">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-3">
                  <Heading id={id} className="text-sm font-medium">
                    {title}
                  </Heading>
                  {titleAction}
                </div>
                {description ? (
                  <p className="text-muted-foreground mt-0.5 text-[13px]">{description}</p>
                ) : null}
              </div>
              <div className="-my-1.5 flex shrink-0 items-center gap-2">
                {tools}
                {headerAction}
              </div>
            </div>
          ) : headerAction ? (
            <div className="flex items-center justify-end gap-2 border-b px-6 py-3">
              <Heading id={id} className="sr-only">
                {title}
              </Heading>
              {headerAction}
            </div>
          ) : (
            <Heading id={id} className="sr-only">
              {title}
            </Heading>
          )}
          <div className={cn('min-w-0', bodyClassName)}>{children}</div>
        </section>
      </SectionToolsContext.Provider>
    )
  }

  return (
    <SectionToolsContext.Provider value={toolsSlot}>
      <section
        aria-labelledby={id}
        className={cn('bg-background flex flex-col rounded-xl border', className)}
      >
        {bare ? (
          <Heading id={id} className="sr-only">
            {title}
          </Heading>
        ) : (
          <div className="flex items-center justify-between gap-4 border-b px-6 py-4">
            <div className="min-w-0 space-y-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <Heading id={id} className="text-sm font-medium">
                  {title}
                </Heading>
                {titleAction}
              </div>
              {description ? (
                <p className="text-muted-foreground text-[13px]">{description}</p>
              ) : null}
            </div>
            {/* `-my-1.5` takes back the button's extra height over the title's line,
              so a header is the same height with or without an action and its
              button sits centred on the title. */}
            <div className="-my-1.5 flex shrink-0 items-center gap-2">
              {tools}
              {headerAction}
            </div>
          </div>
        )}
        <div className={cn('flex-1', !flush && 'p-6', bodyClassName)}>{children}</div>
      </section>
    </SectionToolsContext.Provider>
  )
}

export const PanelProvenance = provenance({
  source: 'composition',
  composes: ['ui/tooltip'],
  note: 'Reference Panel: soft outer tray, title row with optional hint, white inner surface.',
})

export interface PanelProps {
  title?: string
  action?: ReactNode
  /** Sits beside the title (anything richer than `hint`). */
  titleAdornment?: ReactNode
  /** Id for the heading, so a wrapper can `aria-labelledby` it. */
  titleId?: string
  /** Heading level, so the page outline stays correct (default `h2`: a page's `h1` then its panels). */
  as?: 'h2' | 'h3'
  className?: string
  /** Extra classes for the inner white surface (the reference leaves it unpadded). */
  innerClassName?: string
  children: ReactNode
}

/** Console panel: soft outer tray, title row, white inner surface. */
export function Panel({
  title,
  action,
  titleAdornment,
  titleId,
  as: Heading = 'h2',
  className,
  innerClassName,
  children,
}: PanelProps) {
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={cn('bg-muted/40 flex flex-col rounded-xl border p-1', className)}
    >
      {title || action ? (
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-4">
          <div className="space-y-0.5">
            {title ? (
              <Heading id={titleId} className="flex items-center gap-1.5 text-sm font-medium">
                {title}
                {titleAdornment}
              </Heading>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={cn('bg-background flex flex-1 flex-col rounded-lg border', innerClassName)}>
        {children}
      </div>
    </section>
  )
}
