import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { PriceUnitGrid } from './PriceUnitGrid'
import { fixturePriceUnitQuery, manyPriceUnits, priceUnitFixtures } from './priceUnitFixtures'

const meta = {
  title: 'Surfaces/PriceUnitGrid',
  component: PriceUnitGrid,
  parameters: { layout: 'padded' },
  args: {
    priceUnits: priceUnitFixtures,
    total: priceUnitFixtures.length,
    query: fixturePriceUnitQuery,
    onQueryChange: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof PriceUnitGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Credits')).toBeInTheDocument()
    await expect(canvas.getByText('CRD')).toBeInTheDocument()
    // A tiny rate keeps its decimals rather than rounding to zero.
    await expect(canvas.getByText('0.0000025')).toBeInTheDocument()
    // Base currency reads uppercased.
    await expect(canvas.getAllByText('USD').length).toBeGreaterThan(0)
    await expect(canvas.getAllByText('Published').length).toBeGreaterThan(0)
    await expect(canvas.getByText('Archived')).toBeInTheDocument()
  },
}

export const Loading: Story = { args: { priceUnits: [], total: 0, isLoading: true } }

export const Cards: Story = {
  args: { query: { ...fixturePriceUnitQuery, view: 'cards' } },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Euro credits')).toBeInTheDocument()
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
  args: { priceUnits: [], total: 0 },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no price units match these filters/i),
    ).toBeInTheDocument()
  },
}

export const Error: Story = {
  args: {
    priceUnits: [],
    total: 0,
    error: 'You do not have access to price units in this environment.',
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
  args: { priceUnits: manyPriceUnits(25), total: 120, query: { ...fixturePriceUnitQuery, page: 1 } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /next|go to next page/i }))
    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    const reported = spy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(reported).toMatchObject({ page: 2 })
    expect(Object.keys(reported).sort()).toEqual(Object.keys(fixturePriceUnitQuery).sort())
  },
}
