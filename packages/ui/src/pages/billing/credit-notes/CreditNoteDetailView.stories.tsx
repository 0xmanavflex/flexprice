import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CreditNoteStatus } from '@fp/domain'
import { CreditNoteDetailView } from './CreditNoteDetailView'
import { CreditSettlement, type CreditNoteDocument } from './creditNoteDocument'

/**
 * A credit memo as a document: amount credited, the invoice it credits, each
 * line invoiced beside credited, and a footer saying how it settled.
 * Presentational — the document goes in, intent comes out. No network.
 */
const meta = {
  title: 'App/Billing/Credit memos/Credit memo detail',
  component: CreditNoteDetailView,
  parameters: { layout: 'fullscreen' },
  args: { onBack: fn(), locale: 'en-US' },
  argTypes: { document: { control: false } },
} satisfies Meta<typeof CreditNoteDetailView>

export default meta
type Story = StoryObj<typeof meta>

const BASE: CreditNoteDocument = {
  id: 'cn_01HQ',
  number: 'CM-1042',
  status: CreditNoteStatus.Finalized,
  currency: 'usd',
  amount: 320,
  issuedAt: 'Sep 28, 2026',
  creditTo: {
    name: 'Northwind Logistics',
    email: 'billing@northwindlogistics.com',
    address: ['14 Harbour Road', 'Rotterdam', 'Netherlands'],
  },
  customerId: 'cus_01',
  invoiceId: 'inv_01',
  invoiceNumber: 'INV-2048',
  reason: 'Billing error',
  memo: 'Double-charged for the September seat uplift.',
  settlement: CreditSettlement.Adjusted,
  lines: [
    { id: 'l1', description: 'Platform fee — September', invoiced: 1800, credited: 200 },
    { id: 'l2', description: 'Additional seats (4)', invoiced: 480, credited: 120 },
  ],
  metadata: { raised_by: 'support' },
  events: [
    { id: 1, title: 'Finalized', at: 'Sep 28, 2026, 10:14 AM', status: 'completed', summary: '' },
    { id: 2, title: 'Created', at: 'Sep 27, 2026, 4:02 PM', status: 'completed', summary: '' },
  ],
}

/**
 * The comparison the old page could not make: what each line was invoiced,
 * beside what is being taken back, and what is still owed on it.
 */
export const Adjusted: Story = {
  args: { document: BASE, onOpenInvoice: fn(), onOpenCustomer: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    // The figure appears in the header and again in the footer sentence, which
    // is the point of the footer — so scope to the one being asserted.
    await expect(await canvas.findByText('Amount credited')).toBeVisible()
    await expect(canvas.getAllByText('$320.00').length).toBeGreaterThan(0)

    const lines = within(canvas.getByRole('table', { name: 'Credited lines' }))
    await expect(lines.getByText('$1,800.00')).toBeVisible()
    await expect(lines.getByText('$200.00')).toBeVisible()

    // Totals: invoiced, credited, and what the invoice still carries.
    await expect(canvas.getByText('$2,280.00')).toBeVisible()
    await expect(canvas.getByText('Still invoiced')).toBeVisible()
    await expect(canvas.getByText('$1,960.00')).toBeVisible()

    await expect(
      canvas.getByText('$320.00 came off invoice INV-2048; nothing was refunded.'),
    ).toBeVisible()

    // The invoice is reachable from the document and again from Related; this
    // asserts the one on the document.
    const document = within(canvas.getByRole('article'))
    await userEvent.click(document.getByRole('button', { name: 'INV-2048' }))
    await expect(args.onOpenInvoice).toHaveBeenCalledWith('inv_01')
  },
}

/** Refunded instead: the footer says where the money went. */
export const Refunded: Story = {
  args: { document: { ...BASE, settlement: CreditSettlement.Refunded } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText('$320.00 was refunded to the payment method on file.'),
    ).toBeVisible()
    await expect(canvas.getByText('Refunded')).toBeVisible()
  },
}

/** A draft credits nothing yet, and the footer says what finalizing would do. */
export const Draft: Story = {
  args: {
    document: {
      ...BASE,
      status: CreditNoteStatus.Draft,
      settlement: CreditSettlement.Pending,
      issuedAt: null,
    },
    onFinalize: fn(),
    onVoid: fn(),
  },
  parameters: { a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('On finalize')).toBeVisible()
    await expect(
      canvas.getByText(
        'A draft credits nothing yet. Finalizing applies $320.00 to invoice INV-2048.',
      ),
    ).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'More actions' }))
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Finalize memo' }))
    await expect(args.onFinalize).toHaveBeenCalled()
  },
}

/** Voided: it credits nothing and says so, and finalizing is no longer offered. */
export const Voided: Story = {
  args: {
    document: { ...BASE, status: CreditNoteStatus.Voided, settlement: CreditSettlement.Void },
    onVoid: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText(
        'This memo was voided. It credits nothing and the invoice is unchanged.',
      ),
    ).toBeVisible()
    await expect(canvas.getByText('Voided')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'More actions' })).toBeNull()
  },
}

/**
 * A line the invoice no longer has.
 *
 * One unmatched line makes the invoiced total a guess, so it is withheld
 * rather than quietly summing the lines that did match — an em dash says "we
 * do not know", where a figure would have said "this is all of it".
 */
export const UnmatchedLine: Story = {
  args: {
    document: {
      ...BASE,
      lines: [
        { id: 'l1', description: 'Platform fee — September', invoiced: 1800, credited: 200 },
        { id: 'l2', description: 'A line since removed', invoiced: null, credited: 120 },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const lines = within(await canvas.findByRole('table', { name: 'Credited lines' }))
    await expect(lines.getByText('—')).toBeVisible()
    // Credited is still known and still totalled; "Invoiced" is not, so the
    // totals row drops both it and what would be left.
    await expect(canvas.queryByText('Still invoiced')).toBeNull()
    // "Invoiced" survives as the column header and nowhere else: with a line
    // unmatched there is no honest total to put under it.
    await expect(canvas.getAllByText('Invoiced')).toHaveLength(1)
  },
}
