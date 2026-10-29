import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { OnboardingScreen } from './OnboardingScreen'

/** Tenant onboarding: three questions after sign-up, before Home. */
const meta = {
  title: 'App/Sign-in/Onboarding screen',
  component: OnboardingScreen,
  parameters: { layout: 'fullscreen' },
  args: { onSubmit: fn() },
  argTypes: {
    isSubmitting: { control: 'boolean' },
    error: { control: 'text', description: 'Empty means no error.' },
    defaultOrgName: { control: 'text' },
    onSubmit: { control: false },
  },
} satisfies Meta<typeof OnboardingScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Welcome to Flexprice',
    )
    await expect(canvas.getAllByRole('radio')).toHaveLength(7)
    await expect(canvasElement.querySelector('aside')).not.toBeNull()
  },
}

/** Every answer is required; nothing is sent until all three are given. */
export const ValidatesBeforeSending: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Get started' }))
    await expect(await canvas.findByText('Enter your organization name')).toBeInTheDocument()
    await expect(canvas.getByText("Enter your organization's website")).toBeInTheDocument()
    await expect(canvas.getByText('Pick where you found us')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** V1's name rules: not Flexprice, and none of the banned whole words. */
export const RefusesReservedNames: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Organization name'), 'Flexprice')
    await userEvent.click(canvas.getByRole('button', { name: 'Get started' }))
    await expect(await canvas.findByText(/That's us/)).toBeInTheDocument()
    await userEvent.clear(canvas.getByLabelText('Organization name'))
    await userEvent.type(canvas.getByLabelText('Organization name'), 'Acme demo')
    await expect(await canvas.findByText(/can't include the word “demo”/)).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** A complete answer is sent trimmed, with the referral source's stored value. */
export const SendsTheAnswers: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Organization name'), '  Acme Robotics ')
    await userEvent.type(canvas.getByLabelText('Website'), 'https://acme.com')
    await userEvent.click(canvas.getByRole('radio', { name: 'X (Formerly Twitter)' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Get started' }))
    await expect(args.onSubmit).toHaveBeenCalledWith({
      orgName: 'Acme Robotics',
      orgUrl: 'https://acme.com',
      referralSource: 'X',
    })
  },
}

/** While the tenant saves, the form gives way to a status line. */
export const SettingUp: Story = {
  args: { isSubmitting: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Setting up your workspace…')
  },
}

export const SaveFailed: Story = {
  args: { error: "We couldn't save your workspace. Try again." },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent("We couldn't save your workspace")
  },
}
