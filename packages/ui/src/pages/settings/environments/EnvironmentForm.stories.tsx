import { type ComponentProps, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { EnvironmentType } from '@fp/domain'
import { EnvironmentForm } from './EnvironmentForm'

/** The dialog portals to the document, so the play functions read from there. */
const meta = {
  title: 'App/Settings/Environments/Environment form',
  component: EnvironmentForm,
  args: {
    open: true,
    onOpenChange: fn(),
    onSubmit: fn(),
  },
  argTypes: {
    open: { control: 'boolean' },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text', description: 'Server-side failure; empty means none.' },
    canCreateProduction: { control: 'boolean' },
    contact: {
      control: 'object',
      description: 'Slack, email and call shown when production is withheld.',
    },
    defaultValue: { control: false },
    onOpenChange: { control: false },
    onSubmit: { control: false },
  },
} satisfies Meta<typeof EnvironmentForm>

export default meta
type Story = StoryObj<typeof meta>

const dialog = () => within(document.body)

type PlaygroundArgs = ComponentProps<typeof EnvironmentForm> & {
  startName: string
  startType: EnvironmentType
}

function PlaygroundDialog({ startName, startType, submitError, ...args }: PlaygroundArgs) {
  const [open, setOpen] = useState(args.open)
  return (
    <EnvironmentForm
      {...args}
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        args.onOpenChange(next)
      }}
      defaultValue={{ name: startName, type: startType }}
      submitError={submitError || null}
    />
  )
}

/** Open or close the dialog, pick the starting type, withhold production (select it to see the contact note), submit or fail. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    open: true,
    startName: '',
    startType: EnvironmentType.Sandbox,
    isSubmitting: false,
    submitError: '',
    canCreateProduction: true,
    contact: {
      slackUrl: 'https://example.com/slack',
      email: 'support@example.com',
      bookCallUrl: 'https://example.com/call',
    },
  },
  argTypes: {
    startName: { control: 'text' },
    startType: { control: 'inline-radio', options: Object.values(EnvironmentType) },
  },
  render: (args) => (
    <PlaygroundDialog key={`${args.open}-${args.startName}-${args.startType}`} {...args} />
  ),
}

export const Default: Story = {}

/**
 * Sandbox is the default, because the safe one should be what you get by not
 * choosing.
 */
export const SandboxIsPreselected: Story = {
  play: async () => {
    await expect(dialog().getByRole('radio', { name: /sandbox/i })).toBeChecked()
  },
}

export const RequiresAName: Story = {
  play: async ({ args }) => {
    const canvas = dialog()
    await userEvent.click(canvas.getByRole('button', { name: 'Create environment' }))
    const message = await canvas.findByText('Enter a name')
    await waitFor(() => expect(message).toBeVisible())
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const SubmitsAValidEnvironment: Story = {
  play: async ({ args }) => {
    const canvas = dialog()
    await userEvent.type(canvas.getByRole('textbox', { name: /name/i }), 'EU staging')
    await userEvent.click(canvas.getByRole('button', { name: 'Create environment' }))
    await expect(args.onSubmit).toHaveBeenCalledWith({
      name: 'EU staging',
      type: 'development',
    })
  },
}

/**
 * Sandbox and Production sit side by side as two small cards, each with its
 * explainer.
 */
export const SideBySideCards: Story = {
  play: async () => {
    const canvas = dialog()
    await expect(canvas.getByRole('radio', { name: /sandbox/i })).toBeInTheDocument()
    await expect(canvas.getByRole('radio', { name: /production/i })).toBeInTheDocument()
    await expect(canvas.getByText(/nothing is charged/i)).toBeInTheDocument()
    await expect(canvas.getByText(/real customers/i)).toBeInTheDocument()
  },
}

/** V1's sandbox warning: its subscriptions are cancelled after 45 days. */
export const SandboxWarning: Story = {
  play: async () => {
    await waitFor(() =>
      expect(
        dialog().getByText(/sandbox subscriptions are automatically cancelled after 45 days/i),
      ).toBeVisible(),
    )
  },
}

/**
 * Production withheld: still selectable, but create is disabled.
 *
 * Choosing Production is how someone asks for it, so the card is not greyed
 * out. What changes is the way forward — "Create environment" is disabled and
 * V1's approval note takes its place, with Slack, email and a booked call.
 */
export const ProductionUnavailable: Story = {
  args: {
    canCreateProduction: false,
    contact: {
      slackUrl: 'https://example.com/slack',
      email: 'support@example.com',
      bookCallUrl: 'https://example.com/call',
    },
  },
  play: async () => {
    const canvas = dialog()
    const production = canvas.getByRole('radio', { name: /production/i })
    await expect(production).not.toHaveAttribute('aria-disabled', 'true')
    await expect(canvas.getByRole('button', { name: 'Create environment' })).toBeEnabled()

    await userEvent.click(production)
    await waitFor(() => expect(production).toBeChecked())
    await expect(canvas.getByRole('button', { name: 'Create environment' })).toBeDisabled()
    // Waited for, not asserted once: the dialog fades in, and `toBeVisible`
    // correctly says no while its panel is still at opacity 0.
    await waitFor(() => expect(canvas.getByText(/require an approval/i)).toBeVisible())
    await expect(canvas.getByRole('link', { name: /slack/i })).toHaveAttribute(
      'href',
      'https://example.com/slack',
    )
    await expect(canvas.getByRole('link', { name: /email/i })).toHaveAttribute(
      'href',
      'mailto:support@example.com',
    )
    await expect(canvas.getByRole('link', { name: /book a call/i })).toHaveAttribute(
      'href',
      'https://example.com/call',
    )
    // The sandbox warning belongs to Sandbox only.
    await expect(canvas.queryByText(/automatically cancelled/i)).toBeNull()

    // Back to Sandbox, and create is available again.
    await userEvent.click(canvas.getByRole('radio', { name: /sandbox/i }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Create environment' })).toBeEnabled(),
    )
  },
}

/**
 * Self-billing, in the trial: Production is the upgrade. Choosing it shows what
 * the upgrade costs and brings, drops the name (paying creates "Production"),
 * and the button becomes Upgrade.
 */
export const ProductionIsTheUpgrade: Story = {
  args: {
    canCreateProduction: false,
    production: { kind: 'upgrade', eventCap: 50_000, onUpgrade: fn() },
  },
  play: async ({ args }) => {
    const canvas = dialog()
    await userEvent.click(canvas.getByRole('radio', { name: /production/i }))
    await waitFor(() => expect(canvas.getByText('Production comes with an upgrade')).toBeVisible())
    await expect(
      canvas.getByText('$199.00 a month + 0.5% of what you bill through Flexprice in production.'),
    ).toBeVisible()
    await expect(canvas.getByText('The 50,000 event limit is lifted')).toBeVisible()
    await expect(canvas.queryByRole('textbox', { name: /name/i })).toBeNull()
    await expect(canvas.queryByText(/require an approval/i)).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Upgrade' }))
    const offer = args.production as { onUpgrade: () => void }
    await expect(offer.onUpgrade).toHaveBeenCalled()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** Live, with production already there: choosing it says so and offers to switch. */
export const ProductionAlreadyExists: Story = {
  args: {
    canCreateProduction: false,
    production: { kind: 'exists', name: 'Production', onSwitch: fn() },
    contact: {
      slackUrl: 'https://example.com/slack',
      email: 'support@example.com',
      bookCallUrl: 'https://example.com/call',
    },
  },
  play: async ({ args }) => {
    const canvas = dialog()
    await userEvent.click(canvas.getByRole('radio', { name: /production/i }))
    await waitFor(() =>
      expect(canvas.getByText('You already have a production environment.')).toBeVisible(),
    )
    await expect(canvas.getByRole('button', { name: 'Create environment' })).toBeDisabled()
    await userEvent.click(canvas.getByRole('button', { name: /Switch to Production/ }))
    const offer = args.production as { onSwitch: () => void }
    await expect(offer.onSwitch).toHaveBeenCalled()
    await expect(args.onOpenChange).toHaveBeenCalledWith(false)
  },
}

/** Submitting disables the fields. */
export const Submitting: Story = {
  args: { isSubmitting: true },
  play: async () => {
    await expect(dialog().getByRole('textbox', { name: /name/i })).toBeDisabled()
  },
}

export const Failed: Story = {
  args: { submitError: 'An environment with that name already exists.' },
  play: async () => {
    // The sandbox warning is an alert too; the failure is the one that says so.
    const failure = dialog()
      .getAllByRole('alert')
      .find((alert) => /already exists/i.test(alert.textContent ?? ''))
    await expect(failure).toBeDefined()
  },
}

/**
 * The form refuses what the button only discourages.
 *
 * A submit can also arrive by Enter in the name field, so the refusal is in the
 * submit handler too, not only on the disabled button.
 */
export const ProductionCannotBeSubmittedWhenWithheld: Story = {
  args: {
    canCreateProduction: false,
    defaultValue: { name: 'Sneaky', type: 'production' },
  },
  play: async ({ args }) => {
    const canvas = dialog()
    await userEvent.type(canvas.getByRole('textbox', { name: /name/i }), '{Enter}')
    await expect(args.onSubmit).not.toHaveBeenCalled()
    await expect(canvas.getByRole('button', { name: 'Create environment' })).toBeDisabled()
  },
}
