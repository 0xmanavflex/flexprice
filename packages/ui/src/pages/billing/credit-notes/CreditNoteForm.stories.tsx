import { useState } from 'react'
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import {
  CreditNoteForm,
  type CreditNoteFormProps,
  type CreditNoteInvoiceLine,
} from './CreditNoteForm'

const trail = [{ label: 'Credit memos' }, { label: 'New credit memo' }]

const INVOICES = [
  { value: 'inv_1450', label: 'INV-2026-01450', hint: 'Acme Robotics' },
  { value: 'inv_1451', label: 'INV-2026-01451', hint: 'Globex AI' },
  { value: 'inv_1452', label: 'INV-2026-01452', hint: 'Initech Cloud' },
]

const LINE_NAMES = [
  'Platform fee',
  'API calls (120K)',
  'AI tokens (203K)',
  'Extra seats',
  'Priority support',
  'Storage (12 GB)',
]

/** Deterministic invoice lines: the same count always gives the same list. */
function makeLines(count: number): CreditNoteInvoiceLine[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `line_${i + 1}`,
    description: `${LINE_NAMES[i % LINE_NAMES.length]}${i >= LINE_NAMES.length ? ` ${Math.floor(i / LINE_NAMES.length) + 1}` : ''}`,
    amount: `$${(((i * 53) % 400) + 20).toFixed(2)}`,
  }))
}

const withHeight: Decorator = (Story) => (
  <div className="flex h-[860px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'App/Billing/Credit memos/Credit memo form',
  component: CreditNoteForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: {
    invoices: INVOICES,
    invoiceLines: [],
    trail,
    onInvoiceChange: fn(),
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof CreditNoteForm>

export default meta
type Story = StoryObj<typeof meta>

/** Picking an invoice loads its lines, like the container does. */
function Controlled({
  lineCount,
  ...props
}: Omit<CreditNoteFormProps, 'invoiceLines' | 'onInvoiceChange'> & {
  lineCount: number
  onInvoiceChange?: (id: string) => void
}) {
  const [picked, setPicked] = useState(false)
  return (
    <CreditNoteForm
      {...props}
      invoiceLines={picked ? makeLines(lineCount) : []}
      onInvoiceChange={(id) => {
        setPicked(id !== '')
        props.onInvoiceChange?.(id)
      }}
    />
  )
}

interface PlaygroundArgs {
  invoices: number
  lineCount: number
  linesLoading: boolean
  isSubmitting: boolean
  submitError: string
}

/** Choose an invoice to load `lineCount` lines; toggle loading, submitting and an error banner. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: { invoices: 3, lineCount: 4, linesLoading: false, isSubmitting: false, submitError: '' },
  argTypes: {
    invoices: { control: { type: 'range', min: 0, max: 3, step: 1 } },
    lineCount: { control: { type: 'range', min: 0, max: 12, step: 1 } },
    linesLoading: {
      control: 'boolean',
      description: 'Shows "Loading lines…" while no lines exist.',
    },
    isSubmitting: { control: 'boolean', description: 'Disables every field and the toolbar.' },
    submitError: { control: 'text' },
  },
  render: (a) => (
    <Controlled
      invoices={INVOICES.slice(0, a.invoices)}
      lineCount={a.lineCount}
      linesLoading={a.linesLoading}
      isSubmitting={a.isSubmitting}
      submitError={a.submitError || null}
      trail={trail}
      onSubmit={fn()}
      onCancel={fn()}
    />
  ),
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Choose an invoice to see its lines.'),
    ).toBeInTheDocument()
  },
}

export const LoadingLines: Story = { args: { linesLoading: true } }

/** The invoice's lines are listed with one credit amount field each. */
export const WithLines: Story = {
  args: { invoiceLines: makeLines(4) },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('textbox', { name: 'Credit for Platform fee' }),
    ).toBeInTheDocument()
  },
}

export const ManyLines: Story = { args: { invoiceLines: makeLines(12) } }

export const Submitting: Story = { args: { invoiceLines: makeLines(3), isSubmitting: true } }

export const SubmitError: Story = {
  args: { submitError: 'Could not create the credit memo. Try again.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

/** Submitting without an invoice is rejected by the domain schema and nothing is sent. */
export const ValidatesInvoice: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /create credit memo/i }))
    await waitFor(() => {
      const error = canvasElement.querySelector('[id$="-error"]')
      expect(error).not.toBeNull()
      expect(error).toHaveTextContent('Choose an invoice')
    })
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** "Refund to" shows the option chosen, the default included, and submits it. */
export const ChoosesRefundTarget: Story = {
  args: { invoiceLines: makeLines(2) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    const refundTo = canvas.getByRole('combobox', { name: 'Refund to' })
    // The default is a real choice, not an empty field.
    await expect(refundTo).toHaveTextContent('Let Flexprice decide')
    await userEvent.click(refundTo)
    await userEvent.click(await page.findByRole('option', { name: 'Prepaid wallet' }))
    await waitFor(() => expect(refundTo).toHaveTextContent('Prepaid wallet'))
    await userEvent.click(refundTo)
    await userEvent.click(
      await page.findByRole('option', { name: 'Back to the original payment method' }),
    )
    await waitFor(() => expect(refundTo).toHaveTextContent('Back to the original payment method'))
    await userEvent.click(refundTo)
    await userEvent.click(await page.findByRole('option', { name: 'Let Flexprice decide' }))
    await waitFor(() => expect(refundTo).toHaveTextContent('Let Flexprice decide'))
  },
}
