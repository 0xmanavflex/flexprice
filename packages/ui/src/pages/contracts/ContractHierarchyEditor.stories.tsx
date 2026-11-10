import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
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
    const dialog = within(await screen.findByRole('dialog', { name: 'Add inherited customers' }))
    await userEvent.click(dialog.getByRole('combobox', { name: 'Customers' }))
    await userEvent.click(await screen.findByRole('option', { name: /Customer past page one/ }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(dialog.getByRole('button', { name: 'Add 1 inherited customer' }))
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
    onDetach: fn().mockResolvedValue(undefined),
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
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Actions for Child company' }),
    )
    await userEvent.click(await screen.findByRole('menuitem', { name: /Remove inheritance/ }))
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Remove inheritance',
      }),
    )
    await expect(args.onDetach).toHaveBeenCalledWith('subs_child')
    await expect(args.onInherit).not.toHaveBeenCalled()
  },
}

export const AddsMultipleCustomersTogether: Story = {
  args: {
    customers: [
      { id: 'first', name: 'Acme US', externalId: 'acme-us' },
      { id: 'second', name: 'Acme EU', externalId: 'acme-eu' },
    ],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add inherited customer' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Add inherited customers' }))
    await userEvent.click(dialog.getByRole('combobox', { name: 'Customers' }))
    await userEvent.click(await screen.findByRole('option', { name: /Acme US/ }))
    await userEvent.click(await screen.findByRole('option', { name: /Acme EU/ }))
    await userEvent.keyboard('{Escape}')
    await expect(args.onInherit).not.toHaveBeenCalled()
    await userEvent.click(dialog.getByRole('button', { name: 'Add 2 inherited customers' }))
    await expect(args.onInherit).toHaveBeenCalledWith('add', ['acme-us', 'acme-eu'])
  },
}

export const DetachesWithoutExternalId: Story = {
  args: {
    ...RemovesWithoutTheCustomerList.args,
    inherited: RemovesWithoutTheCustomerList.args!.inherited!.map((row) => ({
      ...row,
      customerExternalId: '',
    })),
    onDetach: fn().mockResolvedValue(undefined),
  },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Actions for Child company' }),
    )
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove inheritance' }))
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove inheritance' }),
    )
    await expect(args.onDetach).toHaveBeenCalledWith('subs_child')
    await expect(args.onInherit).not.toHaveBeenCalled()
  },
}

export const IndependentChildActions: Story = {
  args: {
    ...RemovesWithoutTheCustomerList.args,
    onOpenContract: fn(),
    onOpenCustomer: fn(),
    onDetach: fn().mockResolvedValue(undefined),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Child company' }))
    await expect(args.onOpenCustomer).toHaveBeenCalledWith('cust_child')
    await userEvent.click(canvas.getByRole('button', { name: 'Scale · subs_child' }))
    await expect(args.onOpenContract).toHaveBeenCalledWith('subs_child')
    const trigger = canvas.getByRole('button', { name: 'Actions for Child company' })
    await userEvent.click(trigger)
    await expect(await screen.findByRole('menu')).toBeVisible()
    await userEvent.keyboard('{Escape}')
    // The menu animates out: wait for it to leave rather than assert mid-exit.
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('menuitem', { name: 'View customer' }))
    await expect(args.onOpenCustomer).toHaveBeenCalledTimes(2)
    await expect(args.onOpenContract).toHaveBeenCalledTimes(1)
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('menuitem', { name: 'View child contract' }))
    await expect(args.onOpenContract).toHaveBeenCalledTimes(2)
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove inheritance' }))
    const dialog = within(await screen.findByRole('dialog'))
    await expect(dialog.getByText(/Scale \(subs_child\)/)).toBeVisible()
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    await expect(args.onDetach).not.toHaveBeenCalled()
    await expect(args.onOpenContract).toHaveBeenCalledTimes(2)
    await expect(args.onOpenCustomer).toHaveBeenCalledTimes(2)
  },
}

export const RemovalFailure: Story = {
  args: {
    ...IndependentChildActions.args,
    onDetach: async () => {
      throw new Error('Could not remove inheritance. Try again.')
    },
  },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Actions for Child company' }),
    )
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove inheritance' }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.click(dialog.getByRole('button', { name: 'Remove inheritance' }))
    await expect(await dialog.findByRole('alert')).toHaveTextContent(
      'Could not remove inheritance. Try again.',
    )
    await expect(args.onOpenContract).not.toHaveBeenCalled()
    await expect(args.onOpenCustomer).not.toHaveBeenCalled()
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
  },
}

export const LongNamesAndInactiveChildren: Story = {
  args: {
    ...IndependentChildActions.args,
    inherited: [SubscriptionStatus.Active, SubscriptionStatus.Cancelled].map((status, index) => ({
      ...RemovesWithoutTheCustomerList.args!.inherited![0]!,
      id: `subs_very_long_child_contract_identifier_${index}_01JK3M8Q4T123456789`,
      customerId: `cust_${index}`,
      customerName: `International Customer Research and Development Operations Division ${index + 1}`,
      planName: 'Enterprise worldwide usage agreement',
      status,
    })),
  },
}

/** Model the refreshed query result after a successful child-specific detach. */
export const RefreshAfterRemoval: Story = {
  args: { ...IndependentChildActions.args },
  render: function RefreshedHierarchy(args) {
    const [children, setChildren] = useState(args.inherited)
    return (
      <ContractHierarchyEditor
        {...args}
        inherited={children}
        onDetach={async (id) => {
          await args.onDetach?.(id)
          setChildren((rows) => rows.filter((row) => row.id !== id))
        }}
      />
    )
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Child company' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove inheritance' }))
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.click(dialog.getByRole('button', { name: 'Remove inheritance' }))
    await expect(await canvas.findByText('No customers inherit this contract')).toBeVisible()
    await expect(args.onDetach).toHaveBeenCalledWith('subs_child')
    await expect(args.onOpenContract).not.toHaveBeenCalled()
  },
}

export const NarrowHierarchy: Story = {
  args: { ...LongNamesAndInactiveChildren.args },
  decorators: [
    (Story) => (
      <div style={{ width: 360, maxWidth: '100%' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('list', {
      name: 'Customers inheriting this contract',
    })
    await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth)
    await expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  },
}
