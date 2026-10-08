import { createElement as h, Fragment, useMemo, type ReactNode } from 'react'
import { AddonPanel } from 'storybook/internal/components'
import { addons, types, useStorybookApi, useStorybookState } from 'storybook/manager-api'
import anatomy from '../src/design-system/anatomy.generated.json'

/**
 * "Anatomy": the components the open story is built from, and the console pages
 * that use them. Data comes from `scripts/storybook-anatomy.mjs`, which reads the
 * source — so it cannot drift from what the story renders.
 *
 * Written with `createElement` rather than JSX: the manager bundle is built by
 * Storybook, not by the app's Vite config, and this keeps it independent of
 * whichever JSX transform that build uses.
 */

const PANEL_ID = 'flexprice/anatomy'
const MAX_DEPTH = 3

interface ComponentEntry {
  file: string
  layer: string
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
  component: string | null
  uses: string[]
}

const COMPONENTS = anatomy.components as Record<string, ComponentEntry>
const STORIES = anatomy.stories as Record<string, StoryEntry>
const PAGES = anatomy.pages as Record<string, PageEntry>

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

const border = '1px solid rgba(128, 128, 128, 0.28)'

function pagesUsing(names: string[]): { name: string; page: PageEntry; via: string[] }[] {
  const wanted = new Set(names)
  return Object.entries(PAGES)
    .map(([name, page]) => ({ name, page, via: page.uses.filter((u) => wanted.has(u)) }))
    .filter((r) => r.via.length > 0)
    .sort((a, b) => b.via.length - a.via.length || a.name.localeCompare(b.name))
}

function Anatomy() {
  const state = useStorybookState()
  const api = useStorybookApi()

  const entry = state.storyId
    ? (state.index?.[state.storyId] as { importPath?: string } | undefined)
    : undefined
  const importPath = entry?.importPath
  const story = importPath ? STORIES[importPath] : undefined

  // component name -> id of the first story that documents it
  const storyIdOf = useMemo(() => {
    const byPath = new Map<string, string>()
    for (const [id, e] of Object.entries(state.index ?? {})) {
      const x = e as { type?: string; importPath?: string }
      if (x.type === 'story' && x.importPath && !byPath.has(x.importPath))
        byPath.set(x.importPath, id)
    }
    return (name: string) => {
      const p = COMPONENTS[name]?.story
      return p ? byPath.get(p) : undefined
    }
  }, [state.index])

  if (!story) {
    return h(
      'p',
      { style: { padding: 16, opacity: 0.7, fontSize: 13 } },
      'No component data for this entry. Open a component or page story to see what it is built from.',
    )
  }

  const roots = story.uses.length > 0 ? story.uses : []

  const renderNode = (name: string, depth: number, trail: string[]): ReactNode => {
    const c = COMPONENTS[name]
    const id = storyIdOf(name)
    const children = c && depth < MAX_DEPTH ? c.composes.filter((n) => !trail.includes(n)) : []
    const label = h(
      'span',
      { style: { display: 'inline-flex', alignItems: 'center', gap: 8 } },
      id
        ? h(
            'button',
            {
              type: 'button',
              onClick: () => api.selectStory(id),
              style: {
                all: 'unset',
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: 2,
                fontSize: 13,
              },
            },
            name,
          )
        : h('span', { style: { fontSize: 13, opacity: c ? 0.75 : 0.5 } }, name),
      c
        ? h(
            'span',
            { style: { fontSize: 10, opacity: 0.6, border, borderRadius: 4, padding: '0 5px' } },
            LAYER_LABEL[c.layer] ?? c.layer,
          )
        : null,
      c && c.usedBy.length > 0
        ? h('span', { style: { fontSize: 10, opacity: 0.5 } }, `used by ${c.usedBy.length}`)
        : null,
    )
    if (children.length === 0) return h('li', { key: name, style: { margin: '3px 0' } }, label)
    return h(
      'li',
      { key: name, style: { margin: '3px 0' } },
      h(
        'details',
        { open: depth < 1 },
        h('summary', { style: { cursor: 'pointer' } }, label),
        h(
          'ul',
          { style: { listStyle: 'none', margin: '2px 0 0', paddingLeft: 18, borderLeft: border } },
          children.map((n) => renderNode(n, depth + 1, [...trail, name])),
        ),
      ),
    )
  }

  const usedOn = pagesUsing(roots)
  const total = new Set<string>()
  const collect = (n: string, depth: number, trail: string[]) => {
    total.add(n)
    const c = COMPONENTS[n]
    if (c && depth < MAX_DEPTH)
      for (const k of c.composes) if (!trail.includes(k)) collect(k, depth + 1, [...trail, n])
  }
  roots.forEach((r) => collect(r, 0, []))

  const section = (title: string, hint: string, body: ReactNode) =>
    h(
      'section',
      { style: { marginBottom: 20 } },
      h(
        'h3',
        {
          style: {
            margin: '0 0 2px',
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            opacity: 0.7,
          },
        },
        title,
      ),
      h('p', { style: { margin: '0 0 8px', fontSize: 12, opacity: 0.55 } }, hint),
      body,
    )

  return h(
    'div',
    { style: { padding: 16, fontSize: 13, lineHeight: 1.5 } },
    section(
      `Built from ${total.size} component${total.size === 1 ? '' : 's'}`,
      'Imports followed three levels down. Click a name to open its story.',
      roots.length === 0
        ? h('p', { style: { opacity: 0.6 } }, 'This story renders no kit components directly.')
        : h(
            'ul',
            { style: { listStyle: 'none', margin: 0, padding: 0 } },
            roots.map((r) => renderNode(r, 0, [])),
          ),
    ),
    section(
      'Used on console pages',
      'Pages that name one of the components above.',
      usedOn.length === 0
        ? h('p', { style: { opacity: 0.6, margin: 0 } }, 'No console page names these directly.')
        : h(
            'ul',
            { style: { listStyle: 'none', margin: 0, padding: 0 } },
            usedOn.map((r) =>
              h(
                'li',
                { key: r.name, style: { margin: '4px 0' } },
                h('span', { style: { fontWeight: 500 } }, r.name),
                r.page.route
                  ? h(Fragment, null, ' ', h('code', { style: { opacity: 0.6 } }, r.page.route))
                  : null,
                h('span', { style: { opacity: 0.55 } }, `  ·  ${r.via.join(', ')}`),
              ),
            ),
          ),
    ),
  )
}

addons.register(PANEL_ID, () => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: 'Anatomy',
    match: ({ viewMode }) => viewMode === 'story' || viewMode === 'docs',
    render: ({ active }) => h(AddonPanel, { active: Boolean(active) }, h(Anatomy)),
  })
})
