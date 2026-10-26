import { useEffect, useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { ListOfferProvider } from '../feedback/EmptyState'
import { GridToolbar } from './GridToolbar'

/**
 * The bar above a grid: a compact table heading and a bordered search on the
 * left, filter/sort controls next, and the primary create CTA at the very end.
 * Controlled: the route owns the query, so the toolbar and grid cannot
 * disagree about what is shown.
 */
const meta = {
  title: 'Building blocks/Tables & lists/GridToolbar',
  component: GridToolbar,
  parameters: { layout: 'padded' },
  args: {
    search: '',
    onSearchChange: fn(),
    placeholder: 'Search…',
    label: 'Search coupons',
    heading: 'Coupons',
    children: (
      <Button size="sm" variant="outline">
        Filter
      </Button>
    ),
    action: <Button size="sm">New coupon</Button>,
  },
  argTypes: {
    search: {
      control: 'text',
      description: 'The controlled query; a clear button appears once it is non-empty.',
    },
    placeholder: { control: 'text' },
    label: { control: 'text', description: 'Accessible name of the search field.' },
    heading: { control: 'text', description: 'Compact table heading; empty hides it.' },
    onSearchChange: { control: false },
    children: { control: false },
    action: { control: false },
  },
} satisfies Meta<typeof GridToolbar>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = Omit<ComponentProps<typeof GridToolbar>, 'children' | 'action'> & {
  showFilter: boolean
  showAction: boolean
  actionLabel: string
  width: number
}

function LiveToolbar({ showFilter, showAction, actionLabel, width, ...args }: PlaygroundArgs) {
  const [search, setSearch] = useState(args.search)
  useEffect(() => setSearch(args.search), [args.search])
  return (
    <div style={{ width }}>
      <GridToolbar
        {...args}
        search={search}
        onSearchChange={(value) => {
          setSearch(value)
          args.onSearchChange(value)
        }}
        {...(showAction ? { action: <Button size="sm">{actionLabel}</Button> } : {})}
      >
        {showFilter ? (
          <Button size="sm" variant="outline">
            Filter
          </Button>
        ) : null}
      </GridToolbar>
    </div>
  )
}

/** Type in the search (it is live), resize `width` from phone to desktop, and show or hide the filter and create action. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    search: '',
    placeholder: 'Search…',
    label: 'Search coupons',
    heading: 'Coupons',
    showFilter: true,
    showAction: true,
    actionLabel: 'New coupon',
    width: 900,
    onSearchChange: fn(),
  },
  argTypes: {
    showFilter: { control: 'boolean' },
    showAction: { control: 'boolean' },
    actionLabel: { control: 'text' },
    width: { control: { type: 'range', min: 280, max: 1200, step: 10 } },
  },
  render: (args) => <LiveToolbar {...args} />,
}

export const Default: Story = {}

/**
 * The full toolbar: a compact heading over the table, the search, then the
 * filter/sort controls, and the create CTA pinned to the end.
 */
export const WithHeadingAndCreate: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Coupons' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'New coupon' })).toBeInTheDocument()
  },
}

/** A search landmark, reachable without tabbing through the page. */
export const IsASearchLandmark: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('search')).toBeInTheDocument()
  },
}

/** It reports what was typed once typing pauses, not once per keystroke. */
export const ReportsSearchUpward: Story = {
  play: async ({ canvasElement, args }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Search coupons' })
    await userEvent.type(input, 'acme')
    await expect(input).toHaveValue('acme')
    await waitFor(() => expect(args.onSearchChange).toHaveBeenCalledWith('acme'))
    await expect(args.onSearchChange).toHaveBeenCalledTimes(1)
  },
}

/** Enter pushes the query at once, without waiting for the pause. */
export const EnterFlushesImmediately: Story = {
  play: async ({ canvasElement, args }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Search coupons' })
    await userEvent.type(input, 'acme{Enter}')
    await expect(args.onSearchChange).toHaveBeenCalledWith('acme')
    await expect(args.onSearchChange).toHaveBeenCalledTimes(1)
  },
}

function ExternalReset(args: ComponentProps<typeof GridToolbar>) {
  const [search, setSearch] = useState('')
  return (
    <>
      <GridToolbar
        {...args}
        search={search}
        onSearchChange={(value) => {
          setSearch(value)
          args.onSearchChange(value)
        }}
      />
      <Button variant="outline" size="sm" onClick={() => setSearch('')}>
        Clear filters
      </Button>
    </>
  )
}

/** A change from outside the field (Clear filters, back/forward) replaces what is typed. */
export const FollowsExternalChanges: Story = {
  render: (args) => <ExternalReset {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox', { name: 'Search coupons' })
    await userEvent.type(input, 'acme{Enter}')
    await expect(input).toHaveValue('acme')
    await userEvent.click(canvas.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(input).toHaveValue(''))
  },
}

/**
 * The clear button exists only once there is something to clear.
 *
 * A permanent ✕ on an empty field is a control that does nothing most of the
 * time: and it is the one thing people misread as "close this".
 */
export const WithQueryClears: Story = {
  args: { search: 'acme' },
  play: async ({ canvasElement, args }) => {
    const clear = within(canvasElement).getByRole('button', { name: 'Clear search' })
    await userEvent.click(clear)
    await expect(args.onSearchChange).toHaveBeenCalledWith('')
  },
}

/**
 * Narrow: the search keeps a whole row, and its width.
 *
 * On one unwrapping row the search is the only item that can give up space,
 * so it absorbed every shortfall: 163px at a 768px viewport and 53px at
 * 390px, which renders the placeholder as "Sear". It now has a floor, and the
 * controls drop to a row of their own rather than squeezing it.
 */
export const NarrowWrapsInsteadOfSqueezing: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox', { name: 'Search coupons' })
    const create = canvas.getByRole('button', { name: 'New coupon' })

    // Wide enough to read what it is for, at a width where it used to be 53px.
    await expect(input.getBoundingClientRect().width).toBeGreaterThan(180)
    // The floor holds even when the row is tighter than the field wants.
    const group = input.closest('[data-slot="input-group"]') as HTMLElement
    await expect(group.getBoundingClientRect().width).toBeGreaterThanOrEqual(180)

    // And the controls are on the row beneath it, not beside it.
    await expect(create.getBoundingClientRect().top).toBeGreaterThan(
      input.getBoundingClientRect().bottom - 1,
    )
  },
}

/** Wide: one row, search left and capped, controls and CTA pinned right. */
export const WideStaysOnOneRow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 1100 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox', { name: 'Search coupons' })
    const create = canvas.getByRole('button', { name: 'New coupon' })

    const inputBox = input.getBoundingClientRect()
    const createBox = create.getBoundingClientRect()

    // Same row.
    await expect(createBox.top).toBeLessThan(inputBox.bottom)
    // Search on the left and capped; the CTA at the far end.
    await expect(inputBox.width).toBeLessThanOrEqual(320)
    await expect(createBox.left).toBeGreaterThan(inputBox.right)
  },
}

/**
 * The create action can come from the list rather than the grid.
 *
 * A list states what creating one means once, on `ListState`; the toolbar
 * pins it and the empty table body offers it. Twelve grids do not each need
 * a prop for it, and none of them can forget it.
 */
export const TakesTheCreateActionFromTheList: Story = {
  args: { action: undefined },
  decorators: [
    (Story) => (
      <ListOfferProvider
        value={{
          isFirstRun: true,
          title: 'No coupons yet',
          action: <Button size="sm">New coupon</Button>,
        }}
      >
        <Story />
      </ListOfferProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'New coupon' })).toBeVisible()
  },
}
