import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { emptyCheckoutDetails } from '@fp/domain'
import { UpgradeView } from './UpgradeView'
import { TODAY } from './fixtures'

const ORGANIZATION = {
  name: 'Acme Inc',
  email: 'billing@acme.io',
  country: 'US',
  line1: '548 Market St',
  line2: '',
  city: 'San Francisco',
  state: 'CA',
  postalCode: '94104',
  taxId: '',
}

const meta = {
  title: 'App/Self-billing/Upgrade',
  component: UpgradeView,
  tags: ['!autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    state: 'trialing',
    eventCap: 50_000,
    defaultValues: { ...emptyCheckoutDetails(), email: 'ola@flexprice.io' },
    fromOrganization: false,
    today: TODAY,
    submitting: false,
    onBack: fn(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof UpgradeView>

export default meta
type Story = StoryObj<typeof meta>

/** First time: only the billing email is filled; Continue says what is missing under each field. */
export const FirstTime: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Upgrade Flexprice')).toBeVisible()
    await expect(canvas.getByText('The 50,000 event limit is lifted')).toBeVisible()
    await expect(canvas.queryByText('Your account can be edited again')).toBeNull()
    await expect(canvas.getByLabelText(/^Billing email/)).toHaveValue('ola@flexprice.io')
    await userEvent.click(canvas.getByRole('button', { name: 'Continue to payment' }))
    await expect(await canvas.findByText('Enter your company name')).toBeVisible()
    await expect(canvas.getByText('Choose your country')).toBeVisible()
    await expect(args.onSubmit).not.toHaveBeenCalled()

    await userEvent.type(canvas.getByLabelText(/^Company name/), 'Acme Inc')
    await userEvent.click(canvas.getByRole('combobox', { name: /^Address/ }))
    await userEvent.type(canvas.getByRole('combobox', { name: /^Address/ }), 'United States')
    await userEvent.click(await screen.findByRole('option', { name: 'United States (US)' }))
    await userEvent.type(canvas.getByLabelText('Street'), '548 Market St')
    // State and city are lists for the chosen country, the city for the chosen state.
    await userEvent.type(canvas.getByRole('combobox', { name: 'State' }), 'California')
    await userEvent.click(
      await screen.findByRole('option', { name: 'California' }, { timeout: 5000 }),
    )
    await userEvent.type(canvas.getByRole('combobox', { name: 'City' }), 'San Francisco')
    await userEvent.click(
      await screen.findByRole('option', { name: 'San Francisco' }, { timeout: 5000 }),
    )
    await userEvent.type(canvas.getByLabelText('Postal code'), '94104')
    await userEvent.click(canvas.getByRole('button', { name: 'Continue to payment' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Acme Inc',
          country: 'US',
          state: 'California',
          city: 'San Francisco',
          postalCode: '94104',
        }),
      ),
    )
  },
}

/** Filled in from Organization. */
export const FromOrganization: Story = {
  args: { state: 'trialing', defaultValues: ORGANIZATION, fromOrganization: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText(/^Company name/)).toHaveValue('Acme Inc')
    await expect(canvas.getByLabelText('Street')).toHaveValue('548 Market St')
  },
}

/** From a locked account: only the line above the price, and one more benefit. */
export const FromALockedAccount: Story = {
  args: { state: 'suspended', defaultValues: ORGANIZATION, fromOrganization: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Upgrade to unlock your account')).toBeVisible()
    await expect(canvas.getByText('Your account can be edited again')).toBeVisible()
  },
}

/** Opening checkout: the button spins and waits. */
export const OpeningCheckout: Story = {
  args: { defaultValues: ORGANIZATION, fromOrganization: true, submitting: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: /Opening checkout…/ }),
    ).toBeDisabled()
  },
}
