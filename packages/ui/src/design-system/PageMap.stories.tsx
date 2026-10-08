import { useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import anatomy from './anatomy.generated.json'

type Layer = string
interface ComponentEntry {
  file: string
  layer: Layer
  composes: string[]
  usedBy: string[]
  story: string | null
}
interface PageEntry {
  file: string
  pattern: string
  route: string | null
  uses: string[]
}
interface StoryEntry {
  title: string | null
}

const COMPONENTS = anatomy.components as Record<string, ComponentEntry>
const STORIES = anatomy.stories as Record<string, StoryEntry>
const PAGES = anatomy.pages as Record<string, PageEntry>

/** Storybook's own id sanitiser, so a title becomes the id the sidebar uses. */
function sanitize(title: string): string {
  return title
    .toLowerCase()
    .replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

function storyHref(component: string): string | null {
  const importPath = COMPONENTS[component]?.story
  const title = importPath ? STORIES[importPath]?.title : null
  if (!title) return null
  let base = '/'
  try {
    base = window.parent.location.pathname
  } catch {
    // Cross-origin embed: fall back to the site root.
  }
  return `${base}?path=/docs/${sanitize(title)}--docs`
}

const LAYER_LABEL: Record<string, string> = {
  'vendor/primitives': 'primitive',
  'vendor/reui': 'reui',
  'vendor/blocks': 'block',
  'vendor/examples': 'example',
  'vendor/ui': 'ui',
  composition: 'composition',
  surface: 'surface',
  other: 'other',
}

function Chip({ name }: { name: string }) {
  const entry = COMPONENTS[name]
  const href = storyHref(name)
  const layer = entry ? (LAYER_LABEL[entry.layer] ?? entry.layer) : ''
  const body = (
    <>
      <span>{name}</span>
      {layer ? <span className="text-muted-foreground text-[10px]">{layer}</span> : null}
    </>
  )
  const cls = 'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs'
  return href ? (
    <a href={href} target="_top" className={`${cls} hover:bg-muted text-foreground`}>
      {body}
    </a>
  ) : (
    <span className={`${cls} text-muted-foreground border-dashed`} title="No story yet">
      {body}
    </span>
  )
}

type View = 'pages' | 'components'

interface PageMapProps {
  view: View
  query: string
  /** Hide the kit pieces every page uses (layout and loading chrome). */
  hideCommon: boolean
}

const COMMON = new Set(['PageBody', 'LoadingRows', 'AppFailure', 'Section', 'EmptyState'])

function PageMap({ view: initialView, query: initialQuery, hideCommon }: PageMapProps) {
  const [view, setView] = useState<View>(initialView)
  const [query, setQuery] = useState(initialQuery)
  const q = query.trim().toLowerCase()

  const pages = useMemo(
    () =>
      Object.entries(PAGES).filter(
        ([name, p]) =>
          !q ||
          name.toLowerCase().includes(q) ||
          (p.route ?? '').toLowerCase().includes(q) ||
          p.uses.some((u) => u.toLowerCase().includes(q)),
      ),
    [q],
  )

  const components = useMemo(() => {
    const used = new Map<string, string[]>()
    for (const [pageName, p] of Object.entries(PAGES))
      for (const u of p.uses) used.set(u, [...(used.get(u) ?? []), pageName])
    return [...used.entries()]
      .filter(([name]) => !q || name.toLowerCase().includes(q))
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  }, [q])

  return (
    <div className="bg-background text-foreground mx-auto flex max-w-6xl flex-col gap-6 p-8">
      <header className="flex max-w-3xl flex-col gap-2">
        <h1 className="text-2xl font-medium">Page map</h1>
        <p className="text-muted-foreground text-sm">
          Which kit components each console page is built from. Generated from the source by{' '}
          <code>scripts/storybook-anatomy.mjs</code>; open any story and use the Anatomy panel to
          see the same for that one component. Dashed chips have no story yet.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="View" className="flex gap-1">
          {(['pages', 'components'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`rounded-md border px-3 py-1 text-sm ${view === v ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
            >
              {v === 'pages' ? 'By page' : 'By component'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filter</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="page, route or component"
            className="bg-background w-64 rounded-md border px-2 py-1 text-sm"
          />
        </label>
      </div>

      {view === 'pages' ? (
        <ul className="flex flex-col divide-y rounded-lg border">
          {pages.map(([name, p]) => (
            <li key={name} className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-medium">{name}</span>
                <span className="text-muted-foreground text-xs">{p.pattern}</span>
                {p.route ? <code className="text-muted-foreground text-xs">{p.route}</code> : null}
                <code className="text-muted-foreground ml-auto text-[11px]">{p.file}</code>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.uses
                  .filter((u) => !(hideCommon && COMMON.has(u)))
                  .map((u) => (
                    <Chip key={u} name={u} />
                  ))}
                {p.uses.length === 0 ? (
                  <span className="text-muted-foreground text-xs">
                    No kit components named directly.
                  </span>
                ) : null}
              </div>
            </li>
          ))}
          {pages.length === 0 ? (
            <li className="text-muted-foreground p-4 text-sm">No match.</li>
          ) : null}
        </ul>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {components.map(([name, usedOn]) => (
            <li key={name} className="flex flex-col gap-2 p-4">
              <div className="flex items-center gap-3">
                <Chip name={name} />
                <span className="text-muted-foreground text-xs">
                  {usedOn.length} page{usedOn.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {usedOn.map((p) => (
                  <span key={p}>{p}</span>
                ))}
              </div>
            </li>
          ))}
          {components.length === 0 ? (
            <li className="text-muted-foreground p-4 text-sm">No match.</li>
          ) : null}
        </ul>
      )}
    </div>
  )
}

const meta = {
  title: 'Design System/Page map',
  component: PageMap,
  tags: ['!autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { view: 'pages', query: '', hideCommon: false },
  argTypes: {
    view: { control: 'inline-radio', options: ['pages', 'components'] },
    query: { control: 'text' },
    hideCommon: { control: 'boolean' },
  },
} satisfies Meta<typeof PageMap>

export default meta
type Story = StoryObj<typeof meta>

/** Every console page and the kit it names. Flip the view or filter by any term. */
export const ByPage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('CustomerDetailPage')).toBeInTheDocument()
    await userEvent.type(canvas.getByLabelText('Filter'), 'invoice')
    await expect(canvas.queryByText('CustomerDetailPage')).not.toBeInTheDocument()
  },
}

/** The same data inverted: how widely each kit component is used. */
export const ByComponent: Story = {
  args: { view: 'components' },
}
