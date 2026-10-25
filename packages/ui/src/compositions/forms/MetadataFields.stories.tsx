import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { MetadataFields } from './MetadataFields'

const meta = {
  title: 'Building blocks/Forms/MetadataFields',
  component: MetadataFields,
  parameters: { layout: 'padded' },
  args: { onChange: fn(), label: 'Plan metadata' },
} satisfies Meta<typeof MetadataFields>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/** Empty: only Add field, so a form with no metadata stays quiet. */
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Add field' })).toBeVisible()
    await expect(canvas.queryByRole('textbox')).toBeNull()
  },
}

export const WithValues: Story = {
  args: { defaultValue: { region: 'eu', tier: 'gold' } },
}

/** Rows become the map; a blank row is ignored. */
export const AddsAField: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add field' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'Key 1' }), 'region')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Value 1' }), 'eu')
    await userEvent.click(canvas.getByRole('button', { name: 'Add field' }))
    await expect(args.onChange).toHaveBeenLastCalledWith({ region: 'eu' }, null)
  },
}

/** A key used twice is said under the rows and reported to the form. */
export const DuplicateKey: Story = {
  args: { defaultValue: { region: 'eu' } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add field' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'Key 2' }), 'region')
    await expect(canvas.getByRole('alert')).toHaveTextContent('The key "region" is used twice.')
    await expect(args.onChange).toHaveBeenLastCalledWith(
      { region: 'eu' },
      'The key "region" is used twice.',
    )
  },
}

/** Removing a row takes it out of the map. */
export const RemovesAField: Story = {
  args: { defaultValue: { region: 'eu', tier: 'gold' } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Remove region' }))
    await expect(args.onChange).toHaveBeenLastCalledWith({ tier: 'gold' }, null)
  },
}

export const Disabled: Story = { args: { defaultValue: { region: 'eu' }, disabled: true } }
