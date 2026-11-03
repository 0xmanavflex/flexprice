import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { type TaxAssociation, TaxBehavior } from '@fp/domain'
import {
  CustomerTaxSection,
  TaxAssociationSection,
  type CustomerTaxSectionProps,
} from './CustomerTaxSection'

const RATES = [
  { code: 'us_ca_sales', name: 'California sales tax', percentage: '7.25' },
  { code: 'gb_vat', name: 'UK VAT', percentage: '20' },
  { code: 'de_vat', name: 'German VAT', percentage: '19' },
  { code: 'in_gst', name: 'India GST', percentage: '18' },
  { code: 'au_gst', name: 'Australian GST', percentage: '10' },
  { code: 'ca_gst', name: 'Canadian GST', percentage: '5' },
]

const TAX_RATES = RATES.map((rate) => ({
  code: rate.code,
  label: `${rate.name} (${rate.percentage}%)`,
}))

/** Deterministic associations: the same count always gives the same table. */
function makeAssociations(count: number): TaxAssociation[] {
  return Array.from({ length: count }, (_, i) => {
    const rate = RATES[i % RATES.length] ?? RATES[0]!
    return {
      id: `taxassoc_${i + 1}`,
      taxRateId: `taxrate_${i + 1}`,
      taxRateName: rate.name,
      taxRateCode:
        i >= RATES.length ? `${rate.code}_${Math.floor(i / RATES.length) + 1}` : rate.code,
      percentage: rate.percentage,
      taxBehavior: i % 3 === 0 ? TaxBehavior.Inclusive : TaxBehavior.Exclusive,
      priority: 100 + i * 10,
      autoApply: i % 2 === 0,
    }
  })
}

const meta = {
  title: 'App/Customers/Customer tax section',
  component: CustomerTaxSection,
  parameters: { layout: 'padded' },
  args: {
    associations: makeAssociations(3),
    taxRates: TAX_RATES,
    isLoading: false,
    failed: false,
    error: null,
    onRetry: fn(),
    onCreate: fn(async () => undefined),
    onUpdate: fn(async () => undefined),
    onRemove: fn(async () => undefined),
    onResetError: fn(),
  },
  argTypes: {
    associations: { control: false },
    taxRates: { control: false },
    isLoading: { control: 'boolean' },
    failed: { control: 'boolean' },
    error: { control: 'text' },
    onRetry: { control: false },
    onCreate: { control: false },
    onUpdate: { control: false },
    onRemove: { control: false },
    onResetError: { control: false },
  },
} satisfies Meta<typeof CustomerTaxSection>

export default meta
type Story = StoryObj<typeof meta>

/** Keeps the list in state so adding, editing and removing a rate actually changes the table. */
function Live({
  initial,
  ...props
}: Omit<CustomerTaxSectionProps, 'associations' | 'onCreate' | 'onUpdate' | 'onRemove'> & {
  initial: TaxAssociation[]
}) {
  const [rows, setRows] = useState(initial)
  return (
    <CustomerTaxSection
      {...props}
      associations={rows}
      onCreate={async (draft) => {
        const rate = RATES.find((r) => r.code === draft.taxRateCode)
        setRows((current) => [
          ...current,
          {
            id: `taxassoc_new_${current.length + 1}`,
            taxRateId: `taxrate_new_${current.length + 1}`,
            taxRateName: rate?.name ?? draft.taxRateCode,
            taxRateCode: draft.taxRateCode,
            percentage: rate?.percentage ?? '',
            taxBehavior: draft.taxBehavior,
            priority: Number(draft.priority),
            autoApply: draft.autoApply,
          },
        ])
      }}
      onUpdate={async (id, draft) =>
        setRows((current) =>
          current.map((row) =>
            row.id === id
              ? {
                  ...row,
                  taxBehavior: draft.taxBehavior,
                  priority: Number(draft.priority),
                  autoApply: draft.autoApply,
                }
              : row,
          ),
        )
      }
      onRemove={async (id) => setRows((current) => current.filter((row) => row.id !== id))}
    />
  )
}

interface PlaygroundArgs {
  rows: number
  isLoading: boolean
  failed: boolean
  error: string
}

/** Drag rows from 0 to 15 and flip loading / failed. Add, edit and remove really change the list. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: { rows: 3, isLoading: false, failed: false, error: '' },
  argTypes: {
    rows: { control: { type: 'range', min: 0, max: 15, step: 1 } },
    isLoading: { control: 'boolean' },
    failed: { control: 'boolean' },
    error: { control: 'text', description: 'Shown inside an open dialog.' },
  },
  render: ({ rows, isLoading, failed, error }) => (
    <Live
      key={rows}
      initial={makeAssociations(rows)}
      taxRates={TAX_RATES}
      isLoading={isLoading}
      failed={failed}
      error={error || null}
      onRetry={fn()}
      onResetError={fn()}
    />
  ),
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('California sales tax')).toBeInTheDocument()
  },
}

export const Loading: Story = { args: { isLoading: true } }

export const Empty: Story = {
  args: { associations: [] },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('No tax rates attached'),
    ).toBeInTheDocument()
  },
}

export const Failed: Story = {
  args: { failed: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Taxes could not be loaded')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /try again|retry/i }))
    await expect(args.onRetry).toHaveBeenCalled()
  },
}

export const LongList: Story = { args: { associations: makeAssociations(14) } }

/** The add dialog opens from the section header. */
export const OpensAddDialog: Story = {
  args: { associations: [] },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /add tax rate/i }))
    await expect(await screen.findByRole('dialog')).toBeInTheDocument()
  },
}

/**
 * With no rates yet, the picker offers Create tax rate. While that create is in
 * flight the dialog cannot be cancelled or dismissed: closing would not stop
 * the request, and the rate would be saved anyway.
 */
export const CreateRateCannotBeAbandoned: Story = {
  args: {
    associations: [],
    taxRates: [],
    // Never settles, so the create stays in flight for the assertions.
    onCreateTaxRate: fn(() => new Promise<never>(() => undefined)),
  },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /add tax rate/i }))
    await userEvent.click(await screen.findByRole('combobox', { name: /^Tax rate/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Create tax rate' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create tax rate' })
    const form = within(dialog)
    await userEvent.type(form.getByLabelText(/^Name/), 'UK VAT')
    await userEvent.type(form.getByLabelText(/^Rate/), '20')
    await userEvent.click(form.getByRole('button', { name: 'Create tax rate' }))
    await expect(args.onCreateTaxRate).toHaveBeenCalled()
    await expect(form.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    await expect(screen.getByRole('dialog', { name: 'Create tax rate' })).toBeInTheDocument()
  },
}

/** Removing asks for confirmation first. */
export const ConfirmsRemove: Story = {
  parameters: {
    // The destructive confirm button uses a vendored tint with 3.82:1 contrast; a design-token gap, not this section's.
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Remove us_ca_sales' }))
    await expect(await screen.findByText('Remove this tax rate?')).toBeInTheDocument()
  },
}

/** A server error shows inside the confirm dialog. */
export const RemoveError: Story = {
  parameters: {
    // The destructive confirm button uses a vendored tint with 3.82:1 contrast; a design-token gap, not this section's.
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } },
  },
  args: { error: 'Could not remove the tax rate. Try again.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Remove us_ca_sales' }))
    await expect(
      await screen.findByText('Could not remove the tax rate. Try again.'),
    ).toBeInTheDocument()
  },
}

/** A billing entity's default taxes: a description under the title and no auto-apply switch. */
export const BillingEntityDefaults: Story = {
  render: (args) => (
    <TaxAssociationSection
      {...args}
      description="Added automatically to new customers of this entity. Existing customers keep their taxes."
      subject="billing entity"
      alwaysAutoApply
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText(/Added automatically to new customers of this entity/),
    ).toBeInTheDocument()
    await expect(canvas.queryByText('Auto-apply')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: /add tax rate/i }))
    const dialog = await screen.findByRole('dialog')
    await expect(within(dialog).queryByText('Apply automatically to new invoices')).toBeNull()
  },
}
