import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { InvoiceStatus, PaymentStatus } from '@fp/domain'
import { InvoiceDetailView } from './InvoiceDetailView'
import { DEMO_INVOICE } from './invoiceDocument'

const meta = {
  title: 'Surfaces/InvoiceDetailView',
  component: InvoiceDetailView,
  parameters: { layout: 'fullscreen' },
  args: {
    invoice: DEMO_INVOICE,
    onDownload: fn(),
    onRecordPayment: fn(),
    onVoid: fn(),
    onIssueCreditNote: fn(),
    onSend: fn(),
    onRecalculate: fn(),
    onOpenCustomer: fn(),
    onOpenSubscription: fn(),
  },
  decorators: [
    (Story) => (
      <div className="bg-background flex h-[900px] flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InvoiceDetailView>

export default meta
type Story = StoryObj<typeof meta>

/** Plain "Invoice" title; status chips, ID chip and the two primary actions on the right. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Invoice' })).toBeVisible()
    // The chips sit in the header, not beside the name and not in a subtitle.
    const header = within(canvas.getByRole('banner'))
    await expect(header.getByText('Finalized')).toBeVisible()
    await expect(header.getByText('Payment failed')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Download PDF' })).toBeEnabled()
    // No hosted invoice page yet, so Copy link waits.
    await expect(canvas.getByRole('button', { name: 'Copy link' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: /^Copy ID / })).toHaveTextContent('ID')
    // Stripe wording on the document.
    await expect(canvas.getByText('Date of issue')).toBeVisible()
    await expect(canvas.getByText('Bill from')).toBeVisible()
    await expect(canvas.getByText('Unit price')).toBeVisible()
    // Only two tabs; the rail is Activity, Metadata, Related.
    await expect(canvas.getAllByRole('tab')).toHaveLength(2)
    await expect(canvas.getByRole('heading', { name: 'Activity' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Metadata' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Related' })).toBeVisible()
  },
}

/** Everything but the two primary actions lives in More. */
export const MoreMenu: Story = {
  parameters: { a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'More actions' }))
    await expect(
      await screen.findByRole('menuitem', { name: /Record payment/ }),
    ).toBeInTheDocument()
    await expect(screen.getByRole('menuitem', { name: /Issue credit note/ })).toBeInTheDocument()
    await expect(screen.getByRole('menuitem', { name: /Send invoice/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Void invoice' }))
    await expect(args.onVoid).toHaveBeenCalledOnce()
  },
}

/** Overdue reads as a subtle red chip beside Finalized. */
export const Overdue: Story = {
  args: {
    invoice: {
      ...DEMO_INVOICE,
      status: InvoiceStatus.Overdue,
      paymentStatus: PaymentStatus.Pending,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(within(canvas.getByRole('banner')).getByText('Overdue')).toBeVisible()
  },
}
