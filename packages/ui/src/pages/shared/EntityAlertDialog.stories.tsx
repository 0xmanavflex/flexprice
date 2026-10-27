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
    await userEvent.click(dialog.getByRole('switch', { name: 'Critical alert' }))
    await userEvent.type(dialog.getByRole('textbox', { name: /^Critical threshold/ }), '95')
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
    await expect(dialog.getByRole('switch', { name: 'Info alert' })).toBeChecked()
    await userEvent.click(dialog.getByRole('button', { name: 'Save alerts' }))
    await waitFor(() => expect(args.onSave).toHaveBeenCalledOnce())
  },
}

export const Loading: Story = { args: { isLoading: true } }

export const LoadFailed: Story = { args: { loadFailed: true, onRetry: fn() } }

/** Info, warning and critical are separated by a rule, and each threshold row's buttons match its input's height. */
export const LevelsAreSeparated: Story = {
  play: async () => {
    const body = await screen.findByRole('dialog')
    const dialog = within(body)
    // Three levels, two rules between them.
    await expect(dialog.getAllByTestId('alert-level-rule')).toHaveLength(2)
    const input = dialog.getByRole('textbox', { name: /^Warning threshold/ })
    const condition = within(dialog.getByRole('group', { name: 'Warning condition' })).getByRole(
      'button',
      { name: 'Rises above' },
    )
    const unit = dialog.getByRole('button', { name: 'Percentage' })
    const height = input.getBoundingClientRect().height
    await expect(condition.getBoundingClientRect().height).toBe(height)
    await expect(unit.getBoundingClientRect().height).toBe(height)
  },
}
