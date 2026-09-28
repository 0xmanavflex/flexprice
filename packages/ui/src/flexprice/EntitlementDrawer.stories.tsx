import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { FeatureType } from '@fp/domain'
import { EntitlementDrawer } from './EntitlementDrawer'

/**
 * The add-entitlement drawer. The chosen feature's type decides the fields; a
 * validated `CreateEntitlement` comes out. Open by default here so the surface
 * is visible; no provider, no network.
 */
const meta = {
  title: 'Surfaces/EntitlementDrawer',
  component: EntitlementDrawer,
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    onOpenChange: fn(),
    onSubmit: fn(),
    features: [
      { id: 'feat_api', name: 'API calls', type: FeatureType.Metered, unit: 'calls' },
      { id: 'feat_sso', name: 'Single sign-on', type: FeatureType.Boolean },
      { id: 'feat_seats', name: 'Seats', type: FeatureType.Static },
      { id: 'feat_config', name: 'Retention window', type: FeatureType.Config },
    ],
  },
} satisfies Meta<typeof EntitlementDrawer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Choosing a metered feature reveals the limit and reset fields. */
export const MeteredRevealsLimit: Story = {
  play: async ({ canvasElement }) => {
    // The drawer renders in a portal, so query the whole document body.
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.click(await screen.findByRole('combobox'))
    await userEvent.click(await screen.findByRole('option', { name: 'API calls' }))
    await expect(await screen.findByText('Unlimited — no cap on usage')).toBeInTheDocument()
  },
}

export const SubmitError: Story = {
  args: { submitError: 'That feature is already entitled on this plan.' },
}
