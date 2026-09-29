import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { EmptyState } from '@ui/compositions/EmptyState'
import { cn } from '@ui/lib/cn'
import { TabsContent, TabsList, TabsTrigger } from '@ui/primitives/tabs'
import { Source, provenance } from '@ui/provenance'

/**
 * Settings, on two levels: a section rail and a tab strip inside it.
 *
 * Settings is the one surface where a flat list of tabs stops working — there
 * are more sections than fit across a screen, and several of them have their
 * own sub-views. So the navigation is two levels, and both come from the
 * registry rather than being invented here:
 *
 *   - **Outer — the section rail.** `settings-7`'s `SettingsNavigation` is one
 *     `Tabs` whose `TabsList` is `flex-col items-stretch` on desktop (a
 *     vertical rail) and a horizontally scrolling row on a phone. That shape is
 *     reproduced here; the block itself is a demo wired to its own `data.ts`,
 *     so there is nothing importable in it.
 *   - **Inner — the tab strip.** `settings-11`'s `<TabsList variant="line">`,
 *     the underlined horizontal strip, above the section's content.
 *
 * The two levels are **sibling `Tabs` roots, not nested ones**, and that is
 * deliberate. The vendored primitive styles a trigger through
 * `group-data-vertical/tabs:*`, which Tailwind compiles to a plain descendant
 * selector — `:where(.group/tabs):where([data-orientation=vertical]) *`. Put
 * the horizontal strip *inside* the vertical rail's root and the rules for both
 * orientations match the inner triggers at once: the line variant's underline
 * turns into a 2px bar down the right-hand side and the triggers go full width.
 * Two roots side by side keep each level's orientation to itself. A `Tabs` root
 * with a list and no panel is fine — Base UI only emits `aria-controls` when a
 * panel with that value is registered, so nothing dangles.
 *
 * Presentation only, and fully controlled. Every surface in this app is
 * URL-backed, so the page owns `sectionId`/`tabId` and this holds no selection
 * state of its own. Note that **changing section does not change tab**: the
 * shell reports `onSectionChange` and nothing else, because only the page knows
 * which tab a section should open on and how to write both into one history
 * entry.
 */
export const SettingsShellProvenance = provenance({
  source: Source.COMPOSITION,
  composes: ['@reui/settings-7', '@reui/settings-11', 'ui/tabs'],
  note: "settings-7's vertical section rail over settings-11's variant=\"line\" strip, reproduced rather than imported — both blocks are demos bound to their own data.ts. Labelled a composition, not `reui`, because it deviates on every axis guardrail §1 cares about: the rail switches at lg (the sidebar's breakpoint) rather than settings-7's md; both strips scroll, snap and fade at their edges instead of clipping their last tab; labels truncate; focus rings are ring-2 ring-ring; inactive tab text is raised from /60 to /70 because the vendored value measures 4.27:1 against a 4.5:1 floor. It also reproduces the Tabs ROOT locally: the vendored wrapper destructures `orientation` for a data-attribute and never forwards it to Base UI, so a vertical rail would otherwise carry no aria-orientation and answer Left/Right instead of Up/Down.",
})
export interface SettingsTab {
  id: string
  label: string
  /** Render an unavailable state instead of content. */
  unavailable?: boolean
  /**
   * Why it is unavailable, in the caller's own words.
   *
   * There is no safe default here, which is the point. "Unavailable" covers a
   * plan the tenant is not on, a permission they do not hold, and a capability
   * whose API does not exist yet — and telling someone the wrong one of those
   * sends them to the wrong place. A caller that knows the reason should say
   * it; one that does not gets a sentence that claims nothing.
   */
  unavailableReason?: string
}

export interface SettingsSection {
  id: string
  label: string
  icon?: ReactNode
  tabs: SettingsTab[]
}

export interface SettingsShellProps {
  sections: SettingsSection[]
  sectionId: string
  tabId: string
  onSectionChange: (sectionId: string) => void
  onTabChange: (tabId: string) => void
  /** The active tab's content, chosen by the caller. */
  children: ReactNode
}

/**
 * The registry's `Tabs` root, with the one line it drops put back.
 *
 * ReUI's wrapper destructures `orientation` to write its own `data-orientation`
 * attribute and then never forwards it to Base UI, so the primitive stays
 * horizontal however the tabs are drawn. A vertical rail therefore shipped with
 * no `aria-orientation` — a screen reader announced a horizontal tab list — and
 * its arrow keys answered Left/Right instead of the Up/Down the APG specifies
 * and a column of items invites.
 *
 * The wrapper is vendored and not ours to patch, so the root is reproduced here
 * (same `data-slot`, same classes; Base UI writes `data-orientation` itself
 * from state, which is what the registry's `group-data-vertical/tabs:*` rules
 * read) with `orientation` passed to the primitive that acts on it. `TabsList`,
 * `TabsTrigger` and `TabsContent` are the registry's, untouched.
 */
function TabsRoot({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('group/tabs flex gap-2 data-horizontal:flex-col', className)}
      {...props}
    />
  )
}

/**
 * `lg`, not `md`.
 *
 * `settings-7` switches on `useIsMobile` (768). This app's sidebar switches at
 * `lg` — at exactly 768 the sidebar is still a 260px push panel, so a rail that
 * had already gone wide at `md` would leave the content column around 400px on
 * the one width where that is least affordable. Settings follows the shell.
 */
const RAIL_QUERY = '(min-width: 64rem)'

function useIsWide(): boolean {
  // A Vite SPA, never server-rendered, so the first render can already be
  // right. `useIsMobile`'s `undefined` start is what makes the vendored block
  // flash its phone layout on a desktop load.
  const [isWide, setIsWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(RAIL_QUERY).matches,
  )

  useEffect(() => {
    const query = window.matchMedia(RAIL_QUERY)
    const onChange = () => setIsWide(query.matches)
    onChange()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return isWide
}

/**
 * A strip that scrolls rather than painting its last tab where nobody can
 * reach it.
 *
 * The same recipe as `DetailShell`'s `TAB_STRIP`, applied directly because this
 * component owns its lists rather than hosting somebody else's. The vendored
 * `TabsList` is `inline-flex w-fit` with overflow left visible, so at 390 a
 * five-tab strip lays its later children outside the strip and the viewport
 * clips them — on the plan page that made a whole tab unreachable by touch.
 * Here it scrolls, snaps to whole tabs, and hides the scrollbar, which inside a
 * 32px strip reads as damage.
 *
 * `overflow-x: auto` also computes `overflow-y` to `auto`, which would clip the
 * line variant's underline (it sits at `bottom: -5px`, outside the content
 * box). The strips' padding is what keeps that indicator inside the scroll box,
 * and its horizontal half keeps a focus ring off the clip edge.
 */
const SCROLL_STRIP = [
  'flex w-full max-w-full justify-start overflow-x-auto overscroll-x-contain snap-x',
  '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
  '[&>*]:snap-start',
].join(' ')

/** Wide enough to read as a fade rather than as a rendering fault. */
const FADE = '24px'

interface Edges {
  start: boolean
  end: boolean
}

const NO_EDGES: Edges = { start: false, end: false }

/**
 * Which edge is hiding something.
 *
 * The fade is measured rather than declared, because a mask over a strip that
 * fits dims its first and last label for no reason — `DetailShell` dodged that
 * by only fading below `sm`, which is a guess about how much content there is.
 * This asks the element instead, so the signal appears exactly when there is
 * something off-screen to signal.
 */
function useEdgeFade(
  enabled: boolean,
  signature: string,
): { ref: RefObject<HTMLDivElement | null>; edges: Edges } {
  const ref = useRef<HTMLDivElement | null>(null)
  const [edges, setEdges] = useState<Edges>(NO_EDGES)

  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) {
      setEdges(NO_EDGES)
      return
    }

    const measure = () => {
      const max = element.scrollWidth - element.clientWidth
      const next: Edges = {
        start: element.scrollLeft > 1,
        end: max > 1 && element.scrollLeft < max - 1,
      }
      setEdges((previous) =>
        previous.start === next.start && previous.end === next.end ? previous : next,
      )
    }

    measure()
    element.addEventListener('scroll', measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    for (const child of Array.from(element.children)) observer.observe(child)

    return () => {
      element.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [enabled, signature])

  return { ref, edges }
}

function fadeStyle(edges: Edges): CSSProperties | undefined {
  if (!edges.start && !edges.end) return undefined
  const from = edges.start ? `transparent 0, #000 ${FADE}` : '#000 0'
  const to = edges.end ? `#000 calc(100% - ${FADE}), transparent 100%` : '#000 100%'
  const image = `linear-gradient(to right, ${from}, ${to})`
  return { maskImage: image, WebkitMaskImage: image }
}

/**
 * A visible focus ring, in the ring token — which is teal here, and is the one
 * thing a keyboard user has to follow along a strip whose end they cannot see.
 * The primitive ships `ring-[3px] ring-ring/50`; a half-transparent ring over a
 * muted strip is the one that disappears.
 */
const FOCUS_RING = 'focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-2'

/**
 * The same contrast raise `DetailShell` had to make, for the same reason.
 *
 * Stock paints an inactive trigger `text-foreground/60`, which measures 4.27:1
 * on this surface — under the 4.5:1 floor, on the only control that says what
 * else is on the page. `/70` clears it; hover still resolves to full
 * foreground, and dark keeps the vendor's `muted-foreground`, so only the
 * failing state moves.
 */
const TAB_CONTRAST = '[&:not([data-active])]:text-foreground/70 hover:text-foreground'

/** Long labels truncate. They never wrap mid-word and never widen the page. */
const LABEL = 'truncate whitespace-nowrap'

export function SettingsShell({
  sections,
  sectionId,
  tabId,
  onSectionChange,
  onTabChange,
  children,
}: SettingsShellProps) {
  const isWide = useIsWide()

  const section = sections.find((candidate) => candidate.id === sectionId) ?? sections[0]
  const tabs = section?.tabs ?? []
  const activeTab = tabs.find((candidate) => candidate.id === tabId)

  const rail = useEdgeFade(!isWide, sections.map((entry) => entry.id).join())
  const strip = useEdgeFade(true, tabs.map((entry) => entry.id).join())

  const railStyle = fadeStyle(rail.edges)
  const stripStyle = fadeStyle(strip.edges)

  // A section can be entirely unavailable and still has to be reachable — the
  // rail never hides or disables it, because "you cannot get there" and "there
  // is nothing there for you" look identical from outside and only one of them
  // is true.
  const sectionUnavailable = tabs.length > 0 && tabs.every((tab) => tab.unavailable)
  const tabUnavailable = activeTab?.unavailable ?? false

  return (
    <div className={cn('flex w-full min-w-0', isWide ? 'flex-row gap-8' : 'flex-col gap-4')}>
      <TabsRoot
        value={section?.id ?? ''}
        onValueChange={(value) => onSectionChange(String(value))}
        orientation={isWide ? 'vertical' : 'horizontal'}
        className={cn('min-w-0', isWide ? 'w-52 shrink-0' : 'w-full')}
      >
        <TabsList
          ref={rail.ref}
          aria-label="Settings sections"
          className={cn(
            'text-muted-foreground h-auto gap-1 bg-transparent p-0',
            isWide
              ? 'w-full flex-col items-stretch'
              : cn(SCROLL_STRIP, 'flex-row items-center px-0.5 py-0.5'),
          )}
          {...(railStyle ? { style: railStyle } : {})}
        >
          {sections.map((entry) => (
            <TabsTrigger
              key={entry.id}
              value={entry.id}
              className={cn(
                'h-auto gap-2.5 px-3 py-1.5 shadow-none',
                'data-active:bg-muted dark:data-active:bg-muted dark:data-active:border-transparent',
                FOCUS_RING,
                TAB_CONTRAST,
                isWide ? 'w-full flex-none justify-start' : 'w-auto flex-none justify-center',
              )}
            >
              {entry.icon}
              <span className={LABEL}>{entry.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </TabsRoot>

      <div className="min-w-0 flex-1">
        {tabs.length > 0 ? (
          <TabsRoot
            value={tabId}
            onValueChange={(value) => onTabChange(String(value))}
            orientation="horizontal"
            className="w-full min-w-0 gap-0"
          >
            <TabsList
              ref={strip.ref}
              variant="line"
              aria-label={section ? `${section.label} tabs` : 'Settings tabs'}
              className={cn(SCROLL_STRIP, 'mb-3.5 h-auto rounded-none px-0.5 pt-0.5 pb-2')}
              {...(stripStyle ? { style: stripStyle } : {})}
            >
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    'h-auto max-w-56 flex-none px-2.5 py-1.5',
                    FOCUS_RING,
                    TAB_CONTRAST,
                  )}
                >
                  <span className={LABEL}>{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={tabId} className="min-w-0">
              {sectionUnavailable || tabUnavailable ? (
                <Unavailable
                  title={
                    sectionUnavailable && section
                      ? `${section.label} is unavailable`
                      : `${activeTab?.label ?? 'This tab'} is unavailable`
                  }
                  {...(activeTab?.unavailableReason
                    ? { reason: activeTab.unavailableReason }
                    : {})}
                />
              ) : (
                children
              )}
            </TabsContent>
          </TabsRoot>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

/**
 * Says so, rather than showing an empty panel.
 *
 * `EmptyState` carries `role="status"`, so arriving at a section with nothing
 * in it is announced rather than only looking blank.
 */
function Unavailable({ title, reason }: { title: string; reason?: string }) {
  return (
    <EmptyState
      size="inline"
      title={title}
      /*
       * The fallback deliberately does not explain. The previous default said
       * this was "not part of this account or environment", which reads as a
       * plan or permission boundary — a confident, specific claim that is
       * simply false when the real cause is an API that does not exist yet. A
       * caller with the reason passes `unavailableReason`; one without gets a
       * sentence that asserts nothing rather than the wrong thing.
       */
      description={reason ?? 'It cannot be opened from here yet.'}
    />
  )
}
