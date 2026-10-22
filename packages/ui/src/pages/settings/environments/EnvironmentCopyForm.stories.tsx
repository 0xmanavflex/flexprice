import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { EnvironmentCopyForm, type CopyableEnvironment } from './EnvironmentCopyForm'

const SANDBOX: CopyableEnvironment = { id: 'env_sandbox', name: 'Sandbox', kind: 'sandbox' }
const PRODUCTION: CopyableEnvironment = { id: 'env_prod', name: 'Production', kind: 'production' }
const STAGING: CopyableEnvironment = { id: 'env_staging', name: 'EU staging', kind: 'sandbox' }

/** The dialog portals to the document, so the play functions read from there. */
const meta = {
  title: 'App/Settings/Environments/Copy environment form',
  component: EnvironmentCopyForm,
  args: {
    open: true,
    source: SANDBOX,
    environments: [SANDBOX, PRODUCTION, STAGING],
    onOpenChange: fn(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof EnvironmentCopyForm>

export default meta
type Story = StoryObj<typeof meta>

const dialog = () => within(document.body)

/** From a sandbox, the target starts on Production: promoting is one confirm. */
export const PromotesToProduction: Story = {
  play: async ({ args }) => {
    const canvas = dialog()
    await expect(canvas.getByText(/go live in Production/)).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Copy plans and features' }))
    await expect(args.onSubmit).toHaveBeenCalledWith({ targetEnvironmentId: 'env_prod' })
  },
}

/** A new sandbox needs a name, and sends it. */
export const IntoANewSandbox: Story = {
  play: async ({ args }) => {
    const canvas = dialog()
    await userEvent.click(canvas.getByRole('combobox', { name: /Copy to/ }))
    await userEvent.click(await canvas.findByRole('option', { name: 'New sandbox' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Copy plans and features' }))
    await expect(canvas.getByText('Name the new sandbox.')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
    await userEvent.type(canvas.getByRole('textbox', { name: /Name/ }), 'Demo')
    await userEvent.click(canvas.getByRole('button', { name: 'Copy plans and features' }))
    await expect(args.onSubmit).toHaveBeenCalledWith({ name: 'Demo' })
  },
}

/** From production, there is nothing to promote: the first other environment is the target. */
export const FromProduction: Story = {
  args: { source: PRODUCTION },
  play: async () => {
    const canvas = dialog()
    await expect(canvas.getByRole('combobox', { name: /Copy to/ })).toHaveTextContent('Sandbox')
    await expect(canvas.queryByText(/go live in/)).toBeNull()
  },
}

/** The API's refusal (a tenant's environment quota) stays in the dialog. */
export const Failed: Story = {
  args: { submitError: 'You have reached the maximum limit of 2 development environment(s)' },
  play: async () => {
    await expect(dialog().getByText(/maximum limit of 2 development/)).toBeInTheDocument()
  },
}
