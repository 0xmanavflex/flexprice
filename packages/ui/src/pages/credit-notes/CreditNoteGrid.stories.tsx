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

const meta = {
  title: 'Surfaces/CreditNoteGrid',
  component: CreditNoteGrid,
  parameters: { layout: 'padded' },
  args: {
    creditNotes: fixtures(),
    total: 3,
    query: { ...DEFAULT_CREDIT_NOTE_QUERY },
    onQueryChange: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof CreditNoteGrid>

export default meta
type Story = StoryObj<typeof meta>

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
