import { type ComponentProps, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import {
  type CreditNote,
  CreditNoteStatus,
  CreditNoteType,
  DEFAULT_CREDIT_NOTE_QUERY,
  money,
} from '@fp/domain'
import { CreditNoteGrid } from './CreditNoteGrid'

function fixtures(): CreditNote[] {
  return [
    {
      id: 'cn_01',
      number: 'CN-0001',
      status: CreditNoteStatus.Finalized,
      type: CreditNoteType.Refund,
      amount: money('120.00', 'USD'),
      invoiceNumber: 'INV-1041',
      customerName: 'Acme Corp',
      createdAt: new Date('2026-02-03T00:00:00Z'),
    },
    {
      id: 'cn_02',
      number: 'CN-0002',
      status: CreditNoteStatus.Draft,
      type: CreditNoteType.Adjustment,
      amount: money('45.50', 'USD'),
      invoiceNumber: 'INV-1042',
      customerName: 'Globex',
      createdAt: new Date('2026-03-02T00:00:00Z'),
    },
    {
      id: 'cn_03',
      number: 'CN-0003',
      status: CreditNoteStatus.Voided,
      type: null,
      amount: money('10.00', 'EUR'),
      invoiceNumber: '',
      customerName: '',
      createdAt: null,
    },
  ]
}

function manyCreditNotes(count: number): CreditNote[] {
  const base = fixtures()
  return Array.from({ length: count }, (_, index) => {
    const note = base[index % base.length] as CreditNote
    return {
      ...note,
      id: `cn_page_${index}`,
      number: `CN-${String(index + 1).padStart(4, '0')}`,
    }
  })
}

const meta = {
  title: 'App/Billing/Credit notes/Credit note table',
  component: CreditNoteGrid,
  parameters: { layout: 'padded' },
  args: {
    creditNotes: fixtures(),
    total: 3,
    query: { ...DEFAULT_CREDIT_NOTE_QUERY },
    onQueryChange: fn(),
    locale: 'en-US',
  },
  argTypes: {
    creditNotes: { control: false },
    total: { control: false },
    query: { control: false },
    isLoading: { control: 'boolean' },
    error: { control: false },
    locale: { control: 'select', options: ['en-US', 'en-GB', 'de-DE'] },
    onQueryChange: { control: false },
    onRetry: { control: false },
    onCreditNoteClick: { control: false },
    onCreate: { control: false },
    onClearFilters: { control: false },
  },
} satisfies Meta<typeof CreditNoteGrid>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = ComponentProps<typeof CreditNoteGrid> & {
  rows: number
  hasError: boolean
  page: number
  pageSize: number
}

function CreditNoteGridPlayground({ rows, hasError, page, pageSize, ...args }: PlaygroundArgs) {
  const [query, setQuery] = useState(() => ({ ...DEFAULT_CREDIT_NOTE_QUERY, page, pageSize }))
  const start = (query.page - 1) * query.pageSize
  return (
    <CreditNoteGrid
      {...args}
      creditNotes={manyCreditNotes(rows).slice(start, start + query.pageSize)}
      total={rows}
      query={query}
      onQueryChange={(next) => {
        setQuery(next)
        args.onQueryChange(next)
      }}
      error={hasError ? 'You do not have access to credit notes in this environment.' : null}
    />
  )
}

/** Drag `rows` from 0 to 60 to see first-run, a short list and paging; toggle loading and error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: { rows: 30, hasError: false, page: 1, pageSize: 10, isLoading: false },
  argTypes: {
    rows: { control: { type: 'range', min: 0, max: 60, step: 1 } },
    hasError: { control: 'boolean' },
    page: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    pageSize: { control: 'select', options: [10, 25, 50] },
  },
  render: (args) => <CreditNoteGridPlayground key={`${args.page}-${args.pageSize}`} {...args} />,
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('CN-0001')).toBeInTheDocument()
    await expect(canvas.getByText('INV-1042')).toBeInTheDocument()
  },
}

export const Empty: Story = { args: { creditNotes: [], total: 0 } }

export const Searching: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByLabelText('Search credit notes'), 'glob')
    await waitFor(() =>
      expect(args.onQueryChange).toHaveBeenCalledWith(
        expect.objectContaining({ search: expect.stringContaining('g') }),
      ),
    )
  },
}
