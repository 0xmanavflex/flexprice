import { type ComponentProps, useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { DEFAULT_USAGE_SYNC_QUERY, type UsageSync, type UsageSyncQuery, money } from '@fp/domain'
import { UsageSyncGrid } from './UsageSyncGrid'

function fixtures(): UsageSync[] {
  const base = {
    planId: 'plan_pro',
    periodStart: new Date('2026-08-01T00:00:00Z'),
    periodEnd: new Date('2026-09-01T00:00:00Z'),
  }
  return [
    {
      ...base,
      id: 'ur_01',
      customerId: 'cust_1',
      customerExternalId: 'acme-corp',
      subscriptionId: 'sub_01',
      amount: money('120.00', 'USD'),
      syncs: [
        {
          provider: 'aws_marketplace',
          skipped: false,
          skipReason: '',
          syncedAt: new Date('2026-09-02T00:00:00Z'),
          reportingId: 'rep_1',
          agreementId: 'agr_1',
          connectionId: 'conn_1',
        },
      ],
    },
    {
      ...base,
      id: 'ur_02',
      customerId: 'cust_2',
      customerExternalId: 'globex',
      subscriptionId: 'sub_02',
      amount: money('45.50', 'USD'),
      syncs: [],
    },
    {
      ...base,
      id: 'ur_03',
      customerId: 'cust_3',
      customerExternalId: 'initech',
      subscriptionId: 'sub_03',
      amount: money('10.00', 'USD'),
      syncs: [
        {
          provider: 'gcp_marketplace',
          skipped: true,
          skipReason: 'no agreement',
          syncedAt: null,
          reportingId: '',
          agreementId: '',
          connectionId: 'conn_2',
        },
      ],
    },
  ]
}

/** A deterministic page-worth of usage records: the fixtures, cycled with unique ids. */
function manyUsageSyncs(count: number): UsageSync[] {
  const base = fixtures()
  return Array.from({ length: count }, (_, index) => {
    const item = base[index % base.length] as UsageSync
    return {
      ...item,
      id: `ur_page_${index}`,
      customerExternalId: `${item.customerExternalId}-${index}`,
    }
  })
}

const meta = {
  title: 'App/Developers/Usage sync/Usage sync table',
  component: UsageSyncGrid,
  parameters: { layout: 'padded' },
  args: {
    usageSyncs: fixtures(),
    total: 3,
    query: { ...DEFAULT_USAGE_SYNC_QUERY },
    onQueryChange: fn(),
    onRefresh: fn(),
    onUsageSyncClick: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof UsageSyncGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('acme-corp')).toBeInTheDocument()
    await expect(canvas.getByText('AWS Marketplace')).toBeInTheDocument()
    await expect(canvas.getByText('Not synced')).toBeInTheDocument()
  },
}

export const Empty: Story = { args: { usageSyncs: [], total: 0 } }

export const Searching: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByLabelText('Search usage syncs'), 'glo')
    await waitFor(() =>
      expect(args.onQueryChange).toHaveBeenCalledWith(
        expect.objectContaining({ search: expect.stringContaining('g') }),
      ),
    )
  },
}

export const OpeningARow: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByText('globex'))
    await expect(args.onUsageSyncClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ur_02' }),
    )
  },
}

type PlaygroundArgs = Omit<
  ComponentProps<typeof UsageSyncGrid>,
  'usageSyncs' | 'total' | 'query' | 'onQueryChange' | 'error'
> & {
  /** How many records the server holds, 0 to 60. */
  rows: number
  /** The page shown, 1-based. */
  page: number
  pageSize: number
  /** Shows the error state instead of the list. */
  hasError: boolean
}

function UsageSyncGridPlayground({ rows, page, pageSize, hasError, ...rest }: PlaygroundArgs) {
  const [query, setQuery] = useState<UsageSyncQuery>({
    ...DEFAULT_USAGE_SYNC_QUERY,
    page,
    pageSize,
  })
  const generated = useMemo(() => manyUsageSyncs(rows), [rows])
  const all = generated.filter((item) =>
    query.state === 'all'
      ? true
      : query.state === 'synced'
        ? item.syncs.length > 0
        : item.syncs.length === 0,
  )
  const lastPage = Math.max(1, Math.ceil(all.length / query.pageSize))
  const current = Math.min(query.page, lastPage)
  const start = (current - 1) * query.pageSize
  return (
    <UsageSyncGrid
      locale="en-US"
      {...rest}
      usageSyncs={all.slice(start, start + query.pageSize)}
      total={all.length}
      query={{ ...query, page: current }}
      onQueryChange={setQuery}
      error={hasError ? 'You do not have access to usage syncs in this environment.' : null}
    />
  )
}

/** Drag rows from 0 to 60 to walk empty, one page, and a long list; flip loading and error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  parameters: { controls: { exclude: /^(usageSyncs|total|query|error|on[A-Z].*)$/ } },
  args: {
    rows: 30,
    page: 1,
    pageSize: 10,
    isLoading: false,
    hasError: false,
    onRetry: fn(),
    onRefresh: fn(),
    onUsageSyncClick: fn(),
  },
  argTypes: {
    rows: { control: { type: 'number', min: 0, max: 60, step: 1 } },
    page: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    pageSize: { control: 'select', options: [10, 25, 50] },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
  },
  render: (args) => <UsageSyncGridPlayground key={`${args.page}-${args.pageSize}`} {...args} />,
}
