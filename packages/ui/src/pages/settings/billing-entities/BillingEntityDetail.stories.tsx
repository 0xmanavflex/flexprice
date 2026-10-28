import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { defaultInvoiceConfig, entityInvoicePreview } from '@fp/domain'
import { BillingEntityDetail, type BillingEntityTab } from './BillingEntityDetail'
import { BillingEntityForm } from './BillingEntityForm'
import { billingEntityFixtures } from './billingEntityFixtures'

const [defaultEntity, secondEntity] = billingEntityFixtures()
const preview = (prefix: string) => entityInvoicePreview(defaultInvoiceConfig(), prefix)

const meta = {
  title: 'App/Settings/Billing entities/Billing entity detail',
  component: BillingEntityDetail,
  parameters: { layout: 'fullscreen' },
  args: {
    entity: secondEntity!,
    tab: 'details',
    onTabChange: fn(),
    onBack: fn(),
    details: null,
  },
} satisfies Meta<typeof BillingEntityDetail>

export default meta
type Story = StoryObj<typeof meta>

function DetailsHarness({ onSubmit }: { onSubmit: () => void }) {
  const [tab, setTab] = useState<BillingEntityTab>('details')
  const entity = secondEntity!
  return (
    <BillingEntityDetail
      entity={entity}
      tab={tab}
      onTabChange={setTab}
      onBack={fn()}
      details={
        <BillingEntityForm
          mode="edit"
          defaultValue={{
            name: entity.name,
            legalName: entity.legalName,
            invoiceNumberPrefix: entity.invoiceNumberPrefix,
            seller: entity.seller,
            taxIdentifiers: entity.taxIdentifiers,
          }}
          preview={preview}
          onSubmit={onSubmit}
        />
      }
      taxes={<p>Taxes tab body</p>}
    />
  )
}

export const Details: Story = {
  render: () => <DetailsHarness onSubmit={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Acme Deutschland GmbH')).toBeInTheDocument()
    await expect(canvas.getByTestId('invoice-number-example').textContent).toMatch(/^ACME-DE-/)
    const prefix = canvas.getByRole('textbox', { name: /invoice prefix/i })
    await userEvent.clear(prefix)
    await userEvent.type(prefix, 'NWIN')
    await expect(canvas.getByTestId('invoice-number-example').textContent).toMatch(/^NWIN-/)
    await userEvent.click(canvas.getByRole('tab', { name: 'Taxes' }))
    await expect(await canvas.findByText('Taxes tab body')).toBeInTheDocument()
  },
}

export const DefaultEntity: Story = {
  args: { entity: defaultEntity! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Default')).toBeInTheDocument()
    await expect(canvas.queryByRole('tab', { name: 'Integrations' })).toBeNull()
  },
}
