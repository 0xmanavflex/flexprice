import { useState } from 'react'
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  type CustomerDetail as CustomerDetailModel,
  type Invoice,
  InvoiceStatus,
  PaymentStatus,
  type Subscription,
  SubscriptionStatus,
  money,
} from '@fp/domain'
import { CustomerDetail, type CustomerTab } from './CustomerDetail'

const CUSTOMER: CustomerDetailModel = {
  id: 'cus_01M3H9ACME',
  name: 'Acme Robotics',
  email: 'billing@acme.com',
  externalId: 'acme-1000',
  addressCountry: 'CA',
  addressLine1: '100 Howard St',
  addressLine2: '',
  addressCity: 'San Francisco',
  addressState: 'CA',
  addressPostalCode: '94105',
  phone: '',
  timezone: 'America/Los_Angeles',
  taxTreatment: 'taxable',
  metadata: { segment: 'enterprise' },
  status: 'published',
  createdAt: new Date('2025-04-19T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
}

const SUBSCRIPTIONS: Subscription[] = [
  {
    id: 'sub_01',
    customerId: CUSTOMER.id,
    customerName: CUSTOMER.name,
    planId: 'plan_starter',
    planName: 'Starter',
    status: SubscriptionStatus.Active,
    currency: 'USD',
    billingPeriodLabel: 'Monthly',
    currentPeriodStart: new Date('2026-09-04T00:00:00Z'),
    currentPeriodEnd: new Date('2026-10-04T00:00:00Z'),
    startDate: new Date('2025-04-19T00:00:00Z'),
    createdAt: new Date('2025-04-19T00:00:00Z'),
  },
]

const INVOICES: Invoice[] = [
  {
    id: 'inv_draft',
    number: 'Draft',
    customerId: CUSTOMER.id,
    customerName: CUSTOMER.name,
    status: InvoiceStatus.Draft,
    paymentStatus: null,
    total: money('566.50', 'USD'),
    amountDue: money('566.50', 'USD'),
    amountRemaining: money('566.50', 'USD'),
    dueDate: new Date('2026-10-12T00:00:00Z'),
    issuedAt: null,
    periodStart: new Date('2026-08-28T00:00:00Z'),
    periodEnd: new Date('2026-09-27T00:00:00Z'),
  },
  {
    id: 'inv_1450',
    number: 'INV-2026-01450',
    customerId: CUSTOMER.id,
    customerName: CUSTOMER.name,
    status: InvoiceStatus.Paid,
    paymentStatus: PaymentStatus.Succeeded,
    total: money('279.00', 'USD'),
    amountDue: money('279.00', 'USD'),
    amountRemaining: money('0', 'USD'),
    dueDate: new Date('2026-08-15T00:00:00Z'),
    issuedAt: new Date('2026-07-01T00:00:00Z'),
    periodStart: new Date('2026-07-01T00:00:00Z'),
    periodEnd: new Date('2026-07-31T00:00:00Z'),
  },
]

function Harness({
  customer = CUSTOMER,
  subscriptions = SUBSCRIPTIONS,
  invoices = INVOICES,
  onCreateSubscription,
  onBack,
  onEdit,
  onUpdateField,
  initialTab = 'overview',
  creatingSubscription = false,
}: {
  customer?: CustomerDetailModel
  subscriptions?: Subscription[]
  invoices?: Invoice[]
  onCreateSubscription?: () => void
  onBack?: () => void
  onEdit?: () => void
  onUpdateField?: (patch: { name?: string; email?: string; phone?: string }) => Promise<unknown>
  initialTab?: CustomerTab
  creatingSubscription?: boolean
}) {
  const [tab, setTab] = useState<CustomerTab>(initialTab)
  const [creating, setCreating] = useState(creatingSubscription)
  return (
    <div className="bg-background flex h-screen flex-col">
      <CustomerDetail
        customer={customer}
        subscriptions={subscriptions}
        invoices={invoices}
        tab={tab}
        onTabChange={setTab}
        onBack={onBack ?? (() => {})}
        onCreateSubscription={() => {
          onCreateSubscription?.()
          setTab('subscriptions')
          setCreating(true)
        }}
        {...(onEdit ? { onEdit } : {})}
        {...(onUpdateField ? { onUpdateField } : {})}
        {...(creating
          ? {
              subscriptionForm: (
                <div role="group" aria-label="Subscription steps">
                  Subscription steps go here.
                </div>
              ),
              onCancelSubscriptionCreate: () => setCreating(false),
            }
          : {})}
      />
    </div>
  )
}

const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'Surfaces/CustomerDetail',
  component: Harness,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
} satisfies Meta<typeof Harness>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Acme Robotics' })).toBeVisible()
    // Overview is the opening section.
    await expect(canvas.getByRole('heading', { name: 'Subscription' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Recent invoices' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Details' })).toBeVisible()
  },
}

/** The section strip switches the whole content region. */
export const NavigatesSections: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Invoices/ }))
    // The Invoices section, with the full invoice number, is now on screen.
    await expect(canvas.getByRole('heading', { name: 'Invoices' })).toBeVisible()
    await expect(canvas.getByText('INV-2026-01450')).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Information' }))
    await expect(canvas.getByRole('heading', { name: 'Information' })).toBeVisible()
    await expect(canvas.getByText('America/Los_Angeles')).toBeInTheDocument()
  },
}

/**
 * The header's primary action opens the create form inside the Subscriptions
 * section: the customer and the tab stay, Cancel brings the table back.
 */
export const CreatesSubscription: Story = {
  args: { onCreateSubscription: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create subscription' }))
    await expect(args.onCreateSubscription).toHaveBeenCalledOnce()
    await expect(
      canvas.getByRole('heading', { level: 2, name: 'Create subscription' }),
    ).toBeVisible()
    await expect(canvas.getByRole('heading', { level: 1, name: 'Acme Robotics' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Subscriptions' }))
    await expect(canvas.getByRole('table')).toBeVisible()
  },
}

/** Name, email and phone edit where they are shown. */
export const EditsInline: Story = {
  args: { initialTab: 'information', onUpdateField: fn(async () => undefined), onEdit: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Phone' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'Phone' }), '+1 555 0100{Enter}')
    await expect(args.onUpdateField).toHaveBeenCalledWith({ phone: '+1 555 0100' })
    await userEvent.click(canvas.getByRole('button', { name: 'Edit customer' }))
    await expect(args.onEdit).toHaveBeenCalledOnce()
  },
}

/** A customer with nothing on them yet — every section states what will appear. */
export const Empty: Story = {
  args: { subscriptions: [], invoices: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No active subscription')).toBeVisible()
  },
}
