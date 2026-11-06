import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { ContractHierarchyEditor } from './ContractHierarchyEditor'
import { SubscriptionStatus, money, type SubscriptionDetail } from '@fp/domain'
const date = (value: string) => new Date(`${value}T00:00:00Z`)
const SUBSCRIPTION: SubscriptionDetail = {
  id: 'subs_01JK3M8Q4T',
  customerId: 'cust_acme',
  customerName: 'Acme Robotics',
  planId: 'plan_scale',
  planName: 'Scale',
  status: SubscriptionStatus.Active,
  currency: 'USD',
  billingPeriodLabel: 'Monthly',
  currentPeriodStart: date('2026-10-01'),
  currentPeriodEnd: date('2026-11-01'),
  startDate: date('2026-03-01'),
  createdAt: date('2026-02-27'),
  billingPeriod: 'MONTHLY',
  billingPeriodCount: 1,
  cancelAt: null,
  cancelAtPeriodEnd: false,
  cancelledAt: null,
  endDate: null,
  trialStart: null,
  trialEnd: null,
  paymentTerms: 'NET_30',
  collectionMethod: 'send_invoice',
  metadata: { account_manager: 'Priya N', region: 'eu-west' },
  timezone: 'UTC',
  lookupKey: 'acme-scale-2026',
  commitment: {
    amount: money('2500', 'USD'),
    period: 'MONTHLY',
    periodCount: 1,
    overageFactor: 1,
    trueUp: false,
  },
  latestInvoice: { id: 'inv_0922', number: 'INV-0922' },
  subscriptionType: 'standalone',
  parentSubscriptionId: null,
  invoicingCustomerId: null,
}
const meta = {
  title: 'Pages/Contracts/Hierarchy editor',
  component: ContractHierarchyEditor,
  args: {
    subscription: SUBSCRIPTION,
    inherited: [],
    customers: [{ id: 'child', name: 'Customer past page one', externalId: 'external-child' }],
    parents: [
      {
        id: 'parent',
        customerId: 'parent-customer',
        customerName: 'Parent company',
        planName: 'Enterprise',
      },
    ],
    onParent: fn().mockResolvedValue(undefined),
    onInherit: fn().mockResolvedValue(undefined),
  },
} satisfies Meta<typeof ContractHierarchyEditor>
export default meta
type Story = StoryObj<typeof meta>
export const Editable: Story = {}
export const Loading: Story = { args: { loading: true } }

/** The association mutation receives the external customer ID, not the record ID. */
export const AddsAnInheritedCustomer: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add inherited customer' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Add inherited customer' }))
    await userEvent.click(dialog.getByRole('combobox', { name: 'Customer' }))
    await userEvent.click(await screen.findByRole('option', { name: /Customer past page one/ }))
    await userEvent.click(dialog.getByRole('button', { name: 'Add inherited customer' }))
    await expect(args.onInherit).toHaveBeenCalledWith('add', ['external-child'])
  },
}

/** The lists to pick from are asked for when a dialog opens, and the dialog waits on them. */
export const LoadsChoicesOnOpen: Story = {
  args: { onLoadOptions: fn(), optionsLoading: true, customers: [], parents: [] },
  play: async ({ args, canvasElement }) => {
    await expect(args.onLoadOptions).not.toHaveBeenCalled()
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Change parent' }))
    await expect(args.onLoadOptions).toHaveBeenCalledTimes(1)
    const dialog = within(await screen.findByRole('dialog'))
    await expect(dialog.getByRole('status')).toHaveTextContent('Loading choices…')
    await expect(dialog.getByRole('button', { name: 'Save parent' })).toBeDisabled()
  },
}

/** An inherited contract's own customer id is enough to remove it: no customer list needed. */
export const RemovesWithoutTheCustomerList: Story = {
  args: {
    customers: [],
    subscription: { ...SUBSCRIPTION, subscriptionType: 'parent' },
    inherited: [
      {
        id: 'subs_child',
        customerId: 'cust_child',
        customerName: 'Child company',
        customerExternalId: 'external-child',
        planId: 'plan_scale',
        planName: 'Scale',
        status: SubscriptionStatus.Active,
        currency: 'USD',
        billingPeriodLabel: 'Monthly',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        startDate: null,
        createdAt: null,
      },
    ],
  },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Child company/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Remove inheritance/ }))
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Remove inheritance',
      }),
    )
    await expect(args.onInherit).toHaveBeenCalledWith('remove', ['external-child'])
  },
}
