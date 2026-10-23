import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { AlertCondition, AlertThresholdType, emptyAlertSettingConfig } from '@fp/domain'
import { EntityAlertDialog } from './EntityAlertDialog'

const meta = {
  title: 'Building blocks/Feedback/EntityAlertDialog',
  component: EntityAlertDialog,
  args: {
    open: true,
    onOpenChange: fn(),
    noun: 'Contract',
    isLoading: false,
    loadFailed: false,
    isNew: true,
    initial: emptyAlertSettingConfig(),
    onSave: fn(async () => undefined),
  },
} satisfies Meta<typeof EntityAlertDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Nothing watches the entity yet: severities can be switched on, and saving creates the setting. */
export const CreatesAnAlert: Story = {
  play: async ({ args }) => {
    const dialog = within(await screen.findByRole('dialog'))
    await expect(dialog.getByText(/Nothing watches this contract yet/)).toBeVisible()
    await userEvent.click(dialog.getByRole('switch', { name: 'Critical' }))
    await userEvent.type(
      dialog.getByLabelText('Threshold', { selector: '#charge-alert-critical-value' }),
      '95',
    )
    await userEvent.click(dialog.getByRole('button', { name: 'Create alert' }))
    await waitFor(() =>
      expect(args.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          warning: { condition: AlertCondition.Above, threshold: '80' },
          critical: { condition: AlertCondition.Above, threshold: '95' },
        }),
      ),
    )
  },
}

/** An existing setting starts on its own values and is updated. */
export const EditsAnAlert: Story = {
  args: {
    isNew: false,
    initial: {
      alertEnabled: true,
      thresholdType: AlertThresholdType.Absolute,
      info: { condition: AlertCondition.Above, threshold: '1000' },
    },
  },
  play: async ({ args }) => {
    const dialog = within(await screen.findByRole('dialog'))
    await expect(dialog.getByRole('switch', { name: 'Info' })).toBeChecked()
    await userEvent.click(dialog.getByRole('button', { name: 'Save alerts' }))
    await waitFor(() => expect(args.onSave).toHaveBeenCalledOnce())
  },
}

export const Loading: Story = { args: { isLoading: true } }

export const LoadFailed: Story = { args: { loadFailed: true, onRetry: fn() } }
