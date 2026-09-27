import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { AddonGrid } from './AddonGrid'
import { addonFixtures, fixtureAddonQuery, manyAddons } from './addonFixtures'

const meta = {
  title: 'Surfaces/AddonGrid',
  component: AddonGrid,
  parameters: { layout: 'padded' },
  args: {
    addons: addonFixtures,
    total: addonFixtures.length,
    query: fixtureAddonQuery,
    onQueryChange: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof AddonGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Priority support')).toBeInTheDocument()
    await expect(canvas.getByText('priority_support')).toBeInTheDocument()
    await expect(canvas.getAllByText('Published').length).toBeGreaterThan(0)
    await expect(canvas.getByText('Archived')).toBeInTheDocument()
  },
}

export const Loading: Story = { args: { addons: [], total: 0, isLoading: true } }

export const Cards: Story = {
  args: { query: { ...fixtureAddonQuery, view: 'cards' } },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Advanced analytics')).toBeInTheDocument()
  },
}

export const ViewToggle: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('tab', { name: /card view/i }))
    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    const reported = spy.mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(reported).toMatchObject({ view: 'cards' })
  },
}

export const Empty: Story = {
  args: { addons: [], total: 0 },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no add-ons match these filters/i),
    ).toBeInTheDocument()
  },
}

export const Error: Story = {
  args: {
    addons: [],
    total: 0,
    error: 'You do not have access to add-ons in this environment.',
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

export const PaginationReportsDomainQuery: Story = {
  args: { addons: manyAddons(25), total: 120, query: { ...fixtureAddonQuery, page: 1 } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /next|go to next page/i }))
    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    const reported = spy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(reported).toMatchObject({ page: 2 })
    expect(Object.keys(reported).sort()).toEqual(Object.keys(fixtureAddonQuery).sort())
  },
}
