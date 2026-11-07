import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { EntitlementEntityType, FeatureType } from '@fp/domain'
import { makeEntitlements } from '../product-catalog/plans/planDetailFixtures'
import { ContractBenefitsEditor } from './ContractBenefitsEditor'
const inherited = makeEntitlements(1)[0]!
const meta = {
  title: 'Pages/Contracts/Benefits editor',
  component: ContractBenefitsEditor,
  args: {
    currency: 'USD',
    spendingAllowancesEnabled: true,
    subscriptionId: 'contract',
    entitlements: [
      {
        featureId: inherited.featureId,
        name: inherited.featureName ?? 'Feature',
        enabled: true,
        usageLimit: 10000,
        softLimit: false,
        resetPeriodLabel: 'Monthly',
        featureType: inherited.featureType,
      },
    ],
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
    await userEvent.click(
      canvas.getByRole('button', { name: `Actions for ${inherited.featureName}` }),
    )
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Reset Contract override · Pro plan' }),
    )
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

/** Effective values and their sources share one row, with source-specific edits in its menu. */
export const OneFeatureOneRow: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText(inherited.featureName ?? 'Feature')).toHaveLength(1)
    await expect(canvas.queryByRole('table', { name: 'Entitlement sources table' })).toBeNull()
    await expect(canvas.getByText('10,000 / monthly')).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', { name: `Actions for ${inherited.featureName}` }),
    )
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit Pro plan' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Edit entitlement' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Save changes' }))
    await expect(args.onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: inherited.id, entityType: 'PLAN' }),
      expect.any(Object),
    )
  },
}

export const UnsupportedAllowancesHidden: Story = {
  args: { spendingAllowancesEnabled: false, records: [], entitlements: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('heading', { name: 'Spending allowances' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Add allowance' })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Add entitlement' })).toBeVisible()
  },
}

export const DisabledOverrideStillEditable: Story = {
  args: {
    entitlements: [],
    records: [
      {
        entitlement: {
          ...inherited,
          id: 'disabled',
          featureType: FeatureType.Boolean,
          isEnabled: false,
          entityType: EntitlementEntityType.Subscription,
          entityId: 'contract',
          parentEntitlementId: inherited.id,
        },
        name: 'Disabled feature',
        source: 'Contract',
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Disabled feature')).toBeVisible()
    await expect(canvas.queryByText('No features')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Disabled feature' }))
    await expect(
      await screen.findByRole('menuitem', { name: 'Reset to inherited value' }),
    ).toBeVisible()
  },
}
