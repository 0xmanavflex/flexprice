import { useEffect, useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { Toolbar } from './Toolbar'

function Controlled(args: ComponentProps<typeof Toolbar>) {
  const [search, setSearch] = useState(args.search)
  // Follow the `search` control; typing in the box still works in between.
  useEffect(() => setSearch(args.search), [args.search])
  return (
    <Toolbar
      {...args}
      search={search}
      onSearchChange={(value) => {
        setSearch(value)
        args.onSearchChange(value)
      }}
    />
  )
}

const meta = {
  title: 'Foundation/Compositions/Toolbar',
  component: Toolbar,
  parameters: { layout: 'padded' },
  args: {
    search: '',
    onSearchChange: fn(),
    searchPlaceholder: 'Search features…',
    actions: <Button size="sm">New feature</Button>,
  },
  argTypes: {
    search: { control: 'text' },
    searchPlaceholder: { control: 'text' },
    searchLabel: { control: 'text', description: 'Accessible name of the search box.' },
    activeFilterCount: {
      control: { type: 'number', min: 0, max: 9 },
      description: 'Shows the clear button with the count.',
    },
    onSearchChange: { control: false },
    onClear: { control: false },
    filters: { control: false },
    actions: { control: false },
  },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof Toolbar>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = ComponentProps<typeof Toolbar> & {
  showFilters: boolean
  showActions: boolean
}

/** Type to search, set an active-filter count to reveal Clear, and toggle the filter and action slots. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    search: '',
    searchPlaceholder: 'Search features…',
    searchLabel: 'Search',
    activeFilterCount: 0,
    showFilters: true,
    showActions: true,
    onSearchChange: fn(),
    onClear: fn(),
  },
  argTypes: { showFilters: { control: 'boolean' }, showActions: { control: 'boolean' } },
  render: ({ showFilters, showActions, actions, ...args }) => (
    <Controlled
      {...args}
      {...(showFilters
        ? {
            filters: (
              <Button size="sm" variant="outline">
                Status
              </Button>
            ),
          }
        : {})}
      {...(showActions && actions ? { actions } : {})}
    />
  ),
}

export const Default: Story = {}

export const WithActiveFilters: Story = {
  args: { search: 'api', activeFilterCount: 2, onClear: fn() },
  play: async ({ canvasElement }) => {
    // The count is in the accessible name, not only in a dimmed glyph.
    await expect(
      within(canvasElement).getByRole('button', { name: /clear filters.*2 active/i }),
    ).toBeInTheDocument()
  },
}

/** Controlled: it reports intent and renders what it is given. */
export const ReportsSearchUpward: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.type(within(canvasElement).getByRole('searchbox', { name: 'Search' }), 'api')
    await expect(args.onSearchChange).toHaveBeenCalled()
  },
}

/** A search landmark, reachable without tabbing through the page. */
export const IsASearchLandmark: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('search')).toBeInTheDocument()
  },
}
