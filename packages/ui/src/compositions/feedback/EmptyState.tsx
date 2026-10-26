import { createContext, useContext, type ReactNode } from 'react'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@ui/components/primitives/empty'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { Figure, type FigureMotion, type FigureName } from './Figures'
import { SceneIllustration, type EmptyScene } from './SceneIllustration'

/**
 * Nothing here: and what to do about it.
 *
 * Two situations get confused constantly, so they are separate props rather
 * than one message: a surface with no data *yet* wants an invitation to create
 * the first one; a filter matching nothing wants an offer to clear it. Showing
 * "Create your first feature" to someone who just typed a search is the
 * failure this exists to prevent.
 *
 * Built on `Empty`, following `@reui/empty-state-1`: media, title,
 * description, actions, and an optional row of guides underneath. The media is
 * always a drawing: a named `figure` when the emptiness has a specific meaning
 * (a search that found nothing, an error), otherwise the hairline `scene` for
 * the area of the product the reader is in.
 *
 * `size` is the real decision. A whole blank page earns an illustration and
 * space; an empty table body inside a page that already has a heading and a
 * toolbar does not, and giving it one pushes the toolbar off screen.
 *
 * Which is why a list's first run is rendered *here*, in the grid's own empty
 * body, rather than by swapping the grid out for a page-sized empty state: see
 * `ListOffer` below. A `size="page"` block fills the height it is given and
 * centres in it, so a page with nothing on it reads as deliberate rather than
 * as a table that failed to load.
 *
 * `role="status"` so the change is announced when a filter empties a list: a
 * sighted user watches the rows vanish, and nobody else is told.
 */
export const EmptyStateProvenance = provenance({
  source: 'composition',
  composes: ['ui/empty'],
  note: 'Empty with a drawing, after empty-state-1. Distinguishes "none yet" from "none matching".',
})

/**
 * What a list offers: the create action, and the copy for its first run.
 *
 * Published by `ListState` and read in two places: `GridToolbar` pins the
 * action at the end of the toolbar (its only place), and this component swaps
 * a grid's filtered-miss copy for the first-run copy when the list is empty
 * because nothing has been created yet.
 *
 * It is a context rather than a prop because the empty body belongs to the
 * *grid*, several components below the page that knows what creating one
 * means. Threading `createAction` and the first-run sentence through twelve
 * grids would put the same four props on every one of them and still leave a
 * grid free to forget one. The page states its offer once; the two places that
 * can act on it pick it up.
 */
export interface ListOffer {
  /**
   * The list is empty, and no filter is responsible.
   *
   * The distinction the whole file exists for, decided by the page: a grid
   * cannot tell "nothing matched your search" from "nothing exists yet",
   * because from inside the table both are zero rows.
   */
  isFirstRun: boolean
  title: string
  description?: string | undefined
  /** Usually "New thing". Only the toolbar draws it, at its end; the empty body never does. */
  action?: ReactNode
  secondaryAction?: ReactNode
}

const ListOfferContext = createContext<ListOffer | null>(null)

export function ListOfferProvider({ value, children }: { value: ListOffer; children: ReactNode }) {
  return <ListOfferContext.Provider value={value}>{children}</ListOfferContext.Provider>
}

/** The surrounding list's offer, or `null` outside one. */
export function useListOffer(): ListOffer | null {
  return useContext(ListOfferContext)
}

export interface EmptyStateProps {
  title: string
  description?: string
  /** Primary action: usually "create the first one". */
  action?: ReactNode
  /** Beside the primary. An import, a link to the docs. */
  secondaryAction?: ReactNode
  /** Shown instead when a filter is responsible for the emptiness. */
  isFiltered?: boolean
  onClearFilters?: ReactNode
  /** Which area of the product this is in; picks the hairline drawing. Defaults to `table`. */
  scene?: EmptyScene
  /**
   * `page` fills a blank screen: illustration, room to breathe.
   * `inline` sits inside a table body that already has a heading above it.
   */
  size?: 'page' | 'inline'
  /** A short row of links under the actions, as `empty-state-1` has it. */
  guides?: ReactNode
  /**
   * A line drawing in place of the layered glyph. See `EMPTY_CATALOGUE` for
   * which figure and motion each kind of emptiness uses.
   */
  figure?: FigureName
  /** Defaults to `interactive` on a page and `static` inline. */
  motion?: FigureMotion
}

export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  isFiltered = false,
  onClearFilters,
  scene = 'table',
  size = 'page',
  guides,
  figure,
  motion,
}: EmptyStateProps) {
  const isPage = size === 'page'

  /*
   * A grid's empty body is written for a filtered miss, because that is the
   * only emptiness a grid can describe. When the page says the list is empty
   * for the first time instead, its own copy takes that slot: in place, so
   * the toolbar above and the pagination below stay where they are. Replacing the whole grid with a page-sized empty state is what
   * used to happen, and it took the search box and the create button with it.
   */
  const offer = useListOffer()
  const firstRun = isFiltered && offer?.isFirstRun ? offer : null

  const shown = firstRun ?? { title, description, action, secondaryAction }
  /* A first-run offer is not a filtered miss, whatever slot it renders in. */
  const showsFilterMiss = isFiltered && firstRun === null
  /*
   * A first run says what is missing, not how to fix it: the create action
   * is the toolbar's, top right, and a second copy in the middle of the table
   * is the duplicate the console no longer draws.
   */
  const actions = showsFilterMiss ? onClearFilters : firstRun ? null : shown.action

  return (
    <Empty
      role="status"
      className={cn(
        'border-0 bg-transparent',
        // `flex-1` with the primitive's own `justify-center`: the block sits in
        // the middle of the space it is given rather than pinned to the top of
        // it, which reads as a table that failed to load.
        isPage
          ? 'flex-1 justify-center gap-6 px-6 py-14'
          : // A table body is as wide as the *table*, which on a narrow screen
            // is wider than the screen: centring in it puts half the sentence
            // past the right edge, reachable only by scrolling the columns.
            // Sticky at the left of the scroll port, never wider than the
            // viewport: the message stays where the reader is.
            'sticky left-0 w-full max-w-[calc(100vw-3.5rem)] flex-none gap-3 px-6 py-10',
        // Inside a table body there is no flex parent to stretch into: a `td`
        // is a `td`, and a table is only as tall as its rows: so the room to
        // be centred in is asked for directly. The subtraction is the chrome
        // above and below a list: header, toolbar, column headings, footer.
        // Measured at 272px on the tightest of them (390px wide, where the
        // toolbar takes two rows), so it never overflows into a scroll.
        firstRun ? 'min-h-[calc(100vh-17rem)] justify-center py-12' : null,
      )}
    >
      <EmptyHeader className={cn('max-w-[27rem]', isPage ? 'gap-4' : 'gap-2')}>
        <EmptyMedia className="mb-0">
          {figure ? (
            <Figure
              name={figure}
              motion={motion ?? (isPage ? 'interactive' : 'static')}
              className={isPage ? 'w-40' : 'w-24'}
            />
          ) : (
            <SceneIllustration scene={scene} size="sm" className={cn(!isPage && 'w-32')} />
          )}
        </EmptyMedia>

        <div className="flex flex-col items-center gap-1.5">
          <EmptyTitle
            className={cn('tracking-tight', isPage ? 'text-lg font-medium' : 'text-sm font-medium')}
          >
            {shown.title}
          </EmptyTitle>
          {shown.description ? (
            <EmptyDescription
              className={cn(
                'max-w-[24rem]',
                isPage || firstRun ? 'text-sm/relaxed text-balance' : 'text-xs',
              )}
            >
              {shown.description}
            </EmptyDescription>
          ) : null}
        </div>
      </EmptyHeader>

      {actions || shown.secondaryAction ? (
        <EmptyContent className="max-w-none gap-0">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {actions}
            {/* Only on the first-run state: a filtered miss has one way out. */}
            {showsFilterMiss ? null : shown.secondaryAction}
          </div>
        </EmptyContent>
      ) : null}

      {guides && isPage && !showsFilterMiss ? (
        <div className="w-full max-w-[34rem] space-y-3 pt-4">
          <p className="text-muted-foreground text-sm">Quick guides</p>
          {guides}
        </div>
      ) : null}
    </Empty>
  )
}
