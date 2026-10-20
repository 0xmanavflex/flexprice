import { useState, type ReactNode } from 'react'
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
import { CUSTOMER_TABS, CustomerDetail, type CustomerTab } from './CustomerDetail'

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
  integrations: [{ id: 'stripe', name: 'Stripe', providerType: 'stripe' }],
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
    number: '',
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
  onCreateInvoice,
  onCreateContract,
  onOpenContract,
  onOpenPlan,
  onBack,
  onEdit,
  onStreamEvents,
  onUpdateField,
  subscriptionsLoading = false,
  subscriptionsError = false,
  invoicesLoading = false,
  invoicesError = false,
  onRetryInvoices,
  onRetrySubscriptions,
  events,
  initialTab = 'overview',
}: {
  customer?: CustomerDetailModel
  subscriptions?: Subscription[]
  invoices?: Invoice[]
  onCreateInvoice?: () => void
  onCreateContract?: () => void
  onOpenContract?: (subscriptionId: string) => void
  onOpenPlan?: (planId: string) => void
  onBack?: () => void
  onEdit?: () => void
  onStreamEvents?: () => void
  onUpdateField?: (patch: { name?: string; email?: string; phone?: string }) => Promise<unknown>
  subscriptionsLoading?: boolean
  subscriptionsError?: boolean
  invoicesLoading?: boolean
  invoicesError?: boolean
  onRetryInvoices?: () => void
  onRetrySubscriptions?: () => void
  events?: ReactNode
  initialTab?: CustomerTab
}) {
  const [tab, setTab] = useState<CustomerTab>(initialTab)
  return (
    <div className="bg-background flex h-screen flex-col">
      <CustomerDetail
        customer={customer}
        subscriptions={subscriptions}
        invoices={invoices}
        tab={tab}
        onTabChange={setTab}
        subscriptionsLoading={subscriptionsLoading}
        subscriptionsError={subscriptionsError}
        invoicesLoading={invoicesLoading}
        invoicesError={invoicesError}
        {...(onRetryInvoices ? { onRetryInvoices } : {})}
        {...(onRetrySubscriptions ? { onRetrySubscriptions } : {})}
        {...(events ? { events } : {})}
        onBack={onBack ?? (() => {})}
        onCreateInvoice={() => onCreateInvoice?.()}
        onCreateContract={() => onCreateContract?.()}
        {...(onOpenContract ? { onOpenContract } : {})}
        {...(onOpenPlan ? { onOpenPlan } : {})}
        {...(onEdit ? { onEdit } : {})}
        {...(onStreamEvents ? { onStreamEvents } : {})}
        {...(onUpdateField ? { onUpdateField } : {})}
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
  title: 'App/Customers/Customer detail view',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    a11y: {
      // Base UI's portal focus guards — see AppShell.stories.tsx.
      config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] },
    },
  },
  decorators: [withHeight],
  argTypes: {
    initialTab: { control: 'select', options: CUSTOMER_TABS },
    subscriptionsLoading: { control: 'boolean' },
    invoicesLoading: { control: 'boolean' },
    customer: { control: false },
    subscriptions: { control: false },
    invoices: { control: false },
    onCreateInvoice: { control: false },
    onCreateContract: { control: false },
    onOpenContract: { control: false },
    onOpenPlan: { control: false },
    onBack: { control: false },
    onEdit: { control: false },
    onUpdateField: { control: false },
  },
} satisfies Meta<typeof Harness>

export default meta
type Story = StoryObj<typeof meta>

const DAY_MS = 86_400_000

/** Deterministic: the same count and status always give the same list. */
function makeSubscriptions(count: number, status: SubscriptionStatus): Subscription[] {
  const base = SUBSCRIPTIONS[0] as Subscription
  return Array.from({ length: count }, (_, index) => ({
    ...base,
    id: `sub_gen_${index}`,
    planId: `plan_${index}`,
    planName: `${['Starter', 'Growth', 'Scale', 'Enterprise'][index % 4]} ${index + 1}`,
    status,
  }))
}

/** Deterministic: amounts and dates are derived from the index. */
function makeInvoices(count: number, status: InvoiceStatus): Invoice[] {
  const base = new Date('2026-09-01T00:00:00Z').getTime()
  return Array.from({ length: count }, (_, index) => {
    const amount = (((index * 137) % 900) + 50).toFixed(2)
    const paid = status === InvoiceStatus.Paid
    return {
      id: `inv_gen_${index}`,
      number:
        status === InvoiceStatus.Draft ? '' : `INV-2026-${String(1000 + index).padStart(5, '0')}`,
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

interface PlaygroundArgs {
  initialTab: CustomerTab
  customerName: string
  subscriptionCount: number
  subscriptionStatus: SubscriptionStatus
  invoiceCount: number
  invoiceStatus: InvoiceStatus
  subscriptionsLoading: boolean
  invoicesLoading: boolean
  editable: boolean
}

/** Pick the tab, the customer, how many contracts and invoices they have and in which status. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    initialTab: 'overview',
    customerName: 'Acme Robotics',
    subscriptionCount: 2,
    subscriptionStatus: SubscriptionStatus.Active,
    invoiceCount: 8,
    invoiceStatus: InvoiceStatus.Paid,
    subscriptionsLoading: false,
    invoicesLoading: false,
    editable: true,
  },
  argTypes: {
    initialTab: { control: 'select', options: CUSTOMER_TABS },
    customerName: { control: 'text' },
    subscriptionCount: { control: { type: 'range', min: 0, max: 12, step: 1 } },
    subscriptionStatus: { control: 'select', options: Object.values(SubscriptionStatus) },
    invoiceCount: { control: { type: 'range', min: 0, max: 40, step: 1 } },
    invoiceStatus: { control: 'select', options: Object.values(InvoiceStatus) },
    subscriptionsLoading: { control: 'boolean' },
    invoicesLoading: { control: 'boolean' },
    editable: {
      control: 'boolean',
      description: 'Wires the inline edit and billing-details actions.',
    },
  },
  render: (a) => (
    <Harness
      key={a.initialTab}
      customer={{ ...CUSTOMER, name: a.customerName }}
      subscriptions={makeSubscriptions(a.subscriptionCount, a.subscriptionStatus)}
      invoices={makeInvoices(a.invoiceCount, a.invoiceStatus)}
      subscriptionsLoading={a.subscriptionsLoading}
      invoicesLoading={a.invoicesLoading}
      initialTab={a.initialTab}
      {...(a.editable ? { onEdit: fn(), onUpdateField: fn(async () => undefined) } : {})}
    />
  ),
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Acme Robotics' })).toBeVisible()
    // Overview opens on the invoices table. Its title is for assistive tech; the table is what is on screen.
    await expect(canvas.getByRole('region', { name: 'Invoices table' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Activity' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Contracts' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Recent invoices' })).toBeVisible()
    await expect(canvas.queryByRole('tab', { name: /Contracts/ })).toBeNull()
  },
}

/** The tab strip switches the whole content region. */
export const NavigatesSections: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Create contract' })).toBeVisible()

    await userEvent.click(canvas.getByRole('tab', { name: /Invoices/ }))
    // The Invoices tab, with the full invoice number, is now on screen.
    await expect(canvas.getByText('INV-2026-01450')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'New invoice' })).toBeVisible()

    await userEvent.click(canvas.getByRole('tab', { name: 'Information' }))
    await expect(canvas.getByRole('heading', { name: 'Billing address' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Metadata' })).toBeVisible()
    await expect(canvas.getByText('America/Los_Angeles')).toBeInTheDocument()
  },
}

/** The Overview Contracts table carries its own Create contract action; the detail view only hands off. */
export const CreatesContractFromTable: Story = {
  args: { onCreateContract: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create contract' }))
    await expect(args.onCreateContract).toHaveBeenCalledOnce()
  },
}

/** The table leads with the contract, and the contract (not the plan) is what a row opens. */
export const OpensContractFromTable: Story = {
  args: { onOpenContract: fn(), onOpenPlan: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const headers = canvas.getAllByRole('columnheader').map((header) => header.textContent)
    await expect(headers.indexOf('Contract')).toBeLessThan(headers.indexOf('Plan'))
    await userEvent.click(canvas.getByRole('button', { name: SUBSCRIPTIONS[0]?.id ?? '' }))
    await expect(args.onOpenContract).toHaveBeenCalledWith(SUBSCRIPTIONS[0]?.id)
    await expect(args.onOpenPlan).not.toHaveBeenCalled()
  },
}

/** Create invoice is a More-menu item, not an inline header button. The detail view only hands off. */
export const CreatesInvoiceFromMenu: Story = {
  args: { onCreateInvoice: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Create invoice' })).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Customer actions' }))
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('menuitem', { name: 'Create invoice' }))
    await expect(args.onCreateInvoice).toHaveBeenCalledOnce()
    await expect(canvas.getByRole('heading', { level: 1, name: 'Acme Robotics' })).toBeVisible()
  },
}

/** "Stream sample events" is in the actions menu only when the page offers it. */
export const StreamsSampleEventsFromMenu: Story = {
  args: { onStreamEvents: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Customer actions' }))
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('menuitem', { name: 'Stream sample events' }))
    await expect(args.onStreamEvents).toHaveBeenCalledOnce()
  },
}

/** Without `onStreamEvents` (production, or no live subscription) the item is absent. */
export const NoSampleEventsWithoutHandler: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Customer actions' }))
    const body = within(canvasElement.ownerDocument.body)
    await body.findByRole('menuitem', { name: 'Top up wallet' })
    await expect(body.queryByRole('menuitem', { name: 'Stream sample events' })).toBeNull()
  },
}

/**
 * The header shows the ids and email as copy chips, never as text under the
 * name. The external id leads — it is what the customer's systems use — and
 * the internal id has its own chip beside it.
 */
export const HeaderCopyChips: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /^Copy External ID / })).toHaveTextContent(
      'External ID',
    )
    await expect(canvas.getByRole('button', { name: /^Copy ID / })).toHaveTextContent('ID')
    await expect(canvas.getByRole('button', { name: /^Copy email / })).toBeVisible()
  },
}

/** Name, email and phone edit where they are shown. */
export const EditsInline: Story = {
  args: { initialTab: 'information', onUpdateField: fn(async () => undefined), onEdit: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit customer details' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'Phone' }), '+1 555 0100{Enter}')
    await expect(args.onUpdateField).toHaveBeenCalledWith({ phone: '+1 555 0100' })
    await expect(args.onEdit).not.toHaveBeenCalled()
  },
}

/** The customer card edits in place with one Save; billing details stays the stepped page. */
export const HeaderEditInPlace: Story = {
  args: {
    initialTab: 'information',
    onUpdateField: fn(async () => undefined),
    onEdit: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit customer details' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'Phone' }), '1')
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(args.onUpdateField).toHaveBeenCalledOnce()
    await expect(args.onEdit).not.toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: 'Edit billing details' }))
    await expect(args.onEdit).toHaveBeenCalledOnce()
  },
}

/** A customer with nothing on them yet — every section states what will appear. */
export const Empty: Story = {
  args: { subscriptions: [], invoices: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/No invoices yet/)).toBeVisible()
    await expect(canvas.queryByRole('heading', { name: /Active contracts/ })).toBeNull()
  },
}

/** With no contracts the Overview table says what a contract is and keeps Create contract in its header. */
export const EmptyContracts: Story = {
  args: { subscriptions: [], onCreateContract: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No contracts yet')).toBeVisible()
    await expect(canvas.getByText(/puts this customer on a plan/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Create contract' }))
    await expect(args.onCreateContract).toHaveBeenCalledOnce()
  },
}

/** A failed contracts read says so; it must never read as "no contracts". */
export const ContractsLoadFailed: Story = {
  args: { subscriptions: [], subscriptionsError: true, onCreateContract: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Contracts couldn't be loaded")).toBeVisible()
    await expect(canvas.queryByText('No contracts yet')).toBeNull()
  },
}

/** A failed contracts read offers Try again, which calls the page's refetch. */
export const ContractsRetry: Story = {
  args: { subscriptions: [], subscriptionsError: true, onRetrySubscriptions: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /try again/i }))
    await expect(args.onRetrySubscriptions).toHaveBeenCalledOnce()
  },
}

/** Overview tiles and the Invoices tab count do not count what has not arrived. */
export const InvoicesLoading: Story = {
  args: { invoices: [], invoicesLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Loading invoices…')).toBeVisible()
    await expect(canvas.queryByText('No invoices issued yet')).toBeNull()
    await expect(canvas.queryByText(/No invoices yet/)).toBeNull()
    await expect(canvas.getByRole('tab', { name: 'Invoices' })).toBeVisible()
  },
}

/** A failed invoices read is an error with retry on the tab, never "No invoices yet" or a 0 count. */
export const InvoicesLoadFailed: Story = {
  args: {
    invoices: [],
    invoicesError: true,
    initialTab: 'invoices',
    onRetryInvoices: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("Invoices couldn't be loaded")).toBeVisible()
    await expect(canvas.queryByText(/No invoices yet/)).toBeNull()
    await expect(canvas.getByRole('tab', { name: 'Invoices' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetryInvoices).toHaveBeenCalledOnce()
  },
}

/** With no events slot the tab says it has nothing to show, rather than sample events. */
export const EventsNotAvailable: Story = {
  args: { initialTab: 'events' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Events not available here')).toBeVisible()
    await expect(canvas.queryByText('api_call')).toBeNull()
  },
}
