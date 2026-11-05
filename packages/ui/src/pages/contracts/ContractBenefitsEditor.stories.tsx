import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { EntitlementEntityType } from '@fp/domain'
import { makeEntitlements } from '../product-catalog/plans/planDetailFixtures'
import { ContractBenefitsEditor } from './ContractBenefitsEditor'
const inherited = makeEntitlements(1)[0]!
const meta = {
  title: 'Pages/Contracts/Benefits editor',
  component: ContractBenefitsEditor,
  args: {
    subscriptionId: 'contract',
    entitlements: [],
    records: [
      { entitlement: inherited, name: inherited.featureName ?? 'Feature', source: 'Pro plan' },
      {
        entitlement: {
          ...inherited,
          id: 'override',
          entityType: EntitlementEntityType.Subscription,
          entityId: 'contract',
          parentEntitlementId: inherited.id,
        },
        name: inherited.featureName ?? 'Feature',
        source: 'Pro plan',
      },
      {
        entitlement: {
          ...inherited,
          id: 'allowance',
          entityType: EntitlementEntityType.Subscription,
          entityId: 'contract',
          featureId: '',
          grantQuota: '250',
          grantDurationUnit: 'subscription_period',
        },
        name: 'All usage charges',
        source: 'Contract',
      },
    ],
    features: [],
    onCreate: fn().mockResolvedValue(undefined),
    onCreateAllowance: fn().mockResolvedValue(undefined),
    onEdit: fn().mockResolvedValue(undefined),
    onReset: fn().mockResolvedValue(undefined),
  },
} satisfies Meta<typeof ContractBenefitsEditor>
export default meta
type Story = StoryObj<typeof meta>
export const SourcesAndOverrides: Story = {}
export const ReadOnly: Story = { args: { readOnly: true } }
export const Failed: Story = {
  args: { error: 'The API did not return the entitlement sources.', onRetry: fn() },
}

/** Reset uses the contract override's identity, never its plan source. */
export const ResetsOnlyTheOverride: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const row = canvas.getByText('Contract override · Pro plan').closest('tr')!
    await userEvent.click(within(row).getByRole('button', { name: /^Actions for/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Reset to inherited value' }))
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Reset entitlement to its inherited value?' }),
    )
    await expect(args.onReset).not.toHaveBeenCalled()
    await userEvent.click(dialog.getByRole('button', { name: 'Reset entitlement' }))
    await expect(args.onReset).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'override', entityId: 'contract' }),
    )
  },
}
