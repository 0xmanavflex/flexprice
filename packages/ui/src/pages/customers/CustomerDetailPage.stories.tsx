import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
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
import { ErrorState, PageBody, PageLoadingState } from '@ui/compositions'
import { Button } from '@ui/components/primitives/button'
import { CUSTOMER_TABS, CustomerDetail, type CustomerTab } from '@ui/pages/customers/CustomerDetail'
import { PAGE_STORY_PARAMETERS, PageShell } from '../shared/shellFixtures'

const DAY_MS = 86_400_000

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

/** Deterministic: the same count and status always give the same contracts. */
function makeSubscriptions(count: number, status: SubscriptionStatus): Subscription[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `sub_${index + 1}`,
    customerId: CUSTOMER.id,
    customerName: CUSTOMER.name,
    planId: `plan_${index}`,
    planName: `${['Starter', 'Growth', 'Scale', 'Enterprise'][index % 4]} ${index + 1}`,
    status,
    currency: 'USD',
    billingPeriodLabel: 'Monthly',
    currentPeriodStart: new Date('2026-09-04T00:00:00Z'),
    currentPeriodEnd: new Date('2026-10-04T00:00:00Z'),
    startDate: new Date('2025-04-19T00:00:00Z'),
    createdAt: new Date('2025-04-19T00:00:00Z'),
  }))
}

/** Deterministic: amounts and dates are derived from the index. */
function makeInvoices(count: number, status: InvoiceStatus): Invoice[] {
  const base = new Date('2026-09-01T00:00:00Z').getTime()
  return Array.from({ length: count }, (_, index) => {
    const amount = (((index * 137) % 900) + 50).toFixed(2)
    const paid = status === InvoiceStatus.Paid
    return {
      id: `inv_${index + 1}`,
      number: `INV-2026-${String(1000 + index).padStart(5, '0')}`,
      customerId: CUSTOMER.id,
      customerName: CUSTOMER.name,
      status,
      paymentStatus: paid ? PaymentStatus.Succeeded : null,
      total: money(amount, 'USD'),
      amountDue: money(amount, 'USD'),
      amountRemaining: money(paid ? '0' : amount, 'USD'),
      dueDate: new Date(base - index * 30 * DAY_MS),
      issuedAt:
        status === InvoiceStatus.Draft ? null : new Date(base - index * 30 * DAY_MS - 14 * DAY_MS),
      periodStart: new Date(base - (index + 1) * 30 * DAY_MS),
      periodEnd: new Date(base - index * 30 * DAY_MS),
    }
  })
}

interface CustomerDetailPageProps {
  /** The tab the page opens on (`?tab=`). */
  activeTab: CustomerTab
  customerName: string
  subscriptionCount: number
  subscriptionStatus: SubscriptionStatus
  invoiceCount: number
  invoiceStatus: InvoiceStatus
  /** The customer itself is still loading. */
  isLoading: boolean
  /** The customer request failed. */
  hasError: boolean
  /** The customer does not exist (a 404): not found with a way back, never a retry. */
  notFound: boolean
  /** The contracts and invoices sections are still loading. */
  sectionsLoading: boolean
  /** Wires the inline edit and billing-details actions. */
  editable: boolean
}

/** The customer route as the console composes it: shell, then the detail view or its load and failure states. */
function CustomerDetailPage({
  activeTab,
  customerName,
  subscriptionCount,
  subscriptionStatus,
  invoiceCount,
  invoiceStatus,
  isLoading,
  hasError,
  notFound,
  sectionsLoading,
  editable,
}: CustomerDetailPageProps) {
  const [tab, setTab] = useState<CustomerTab>(activeTab)
  // The tab strip is the page's own state; the control only re-seeds it.
  useEffect(() => setTab(activeTab), [activeTab])

  return (
    <PageShell activeItemId="customers" trail={['Customers', customerName]}>
      {isLoading ? (
        <PageBody>
          <PageLoadingState variant="detail" label="Loading this customer" />
        </PageBody>
      ) : notFound ? (
        <PageBody>
          <ErrorState
            variant="page"
            kind="unavailable"
            title="Customer not found"
            description="It may have been deleted, or the link may be wrong."
            action={
              <Button variant="outline" size="sm" onClick={fn()}>
                Back to customers
              </Button>
            }
          />
        </PageBody>
      ) : hasError ? (
        <PageBody>
          <ErrorState
            variant="page"
            kind="server"
            title="Flexprice had a problem loading this customer."
            onRetry={fn()}
          />
        </PageBody>
      ) : (
        <CustomerDetail
          customer={{ ...CUSTOMER, name: customerName }}
          subscriptions={makeSubscriptions(subscriptionCount, subscriptionStatus)}
          invoices={makeInvoices(invoiceCount, invoiceStatus)}
          tab={tab}
          onTabChange={setTab}
          subscriptionsLoading={sectionsLoading}
          invoicesLoading={sectionsLoading}
          onBack={fn()}
          onCreateInvoice={fn()}
          onCreateContract={fn()}
          onOpenInvoice={fn()}
          onOpenPlan={fn()}
          {...(editable ? { onEdit: fn(), onUpdateField: fn(async () => undefined) } : {})}
          locale="en-US"
        />
      )}
    </PageShell>
  )
}

const meta = {
  title: 'App/Customers/Customer detail',
  component: CustomerDetailPage,
  tags: ['!autodocs'],
  parameters: PAGE_STORY_PARAMETERS,
  args: {
    activeTab: 'overview',
    customerName: 'Acme Robotics',
    subscriptionCount: 2,
    subscriptionStatus: SubscriptionStatus.Active,
    invoiceCount: 6,
    invoiceStatus: InvoiceStatus.Paid,
    isLoading: false,
    hasError: false,
    notFound: false,
    sectionsLoading: false,
    editable: true,
  },
  argTypes: {
    activeTab: { control: 'select', options: CUSTOMER_TABS },
    customerName: { control: 'text' },
    subscriptionCount: { control: { type: 'range', min: 0, max: 12, step: 1 } },
    subscriptionStatus: { control: 'select', options: Object.values(SubscriptionStatus) },
    invoiceCount: { control: { type: 'range', min: 0, max: 40, step: 1 } },
    invoiceStatus: { control: 'select', options: Object.values(InvoiceStatus) },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
    notFound: { control: 'boolean' },
    sectionsLoading: { control: 'boolean' },
    editable: { control: 'boolean' },
  },
} satisfies Meta<typeof CustomerDetailPage>

export default meta
type Story = StoryObj<typeof meta>

/** `/customers/$customerId` with every control live: pick the tab, counts and statuses. */
export const Playground: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole('heading', { level: 1, name: 'Acme Robotics' }),
    ).toBeVisible()
  },
}

/** `/customers/$customerId?tab=invoices`, switched to from the tab strip. */
export const InvoicesTab: Story = {
  args: { activeTab: 'overview' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('tab', { name: /Invoices/ }))
    await expect(await canvas.findByText('INV-2026-01000')).toBeInTheDocument()
  },
}

/** `/customers/$customerId?tab=information`, the editable details and billing address. */
export const InformationTab: Story = {
  args: { activeTab: 'information' },
}

/** `/customers/$customerId` for a customer with no contracts or invoices yet. */
export const Empty: Story = {
  args: { subscriptionCount: 0, invoiceCount: 0 },
}

/** `/customers/$customerId` while the customer is loading. */
export const Loading: Story = {
  args: { isLoading: true },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('Loading this customer'),
    ).toBeInTheDocument()
  },
}

/** `/customers/$customerId` for a customer that does not exist: not found, with a way back and no retry. */
export const NotFound: Story = {
  args: { notFound: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Customer not found')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Back to customers' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /try again/i })).toBeNull()
    await expect(canvas.queryByText(/could not be loaded/i)).toBeNull()
  },
}

/** `/customers/$customerId` when the customer request failed. */
export const Failed: Story = {
  args: { hasError: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('alert')).toBeVisible()
    await expect(canvas.getByRole('button', { name: /try again/i })).toBeVisible()
  },
}
