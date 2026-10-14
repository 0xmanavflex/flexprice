import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import { RegionField, type RegionId } from './RegionField'
import { SignInScreen } from './SignInScreen'

const REGIONS = [
  { id: 'in' as const, label: 'India' },
  { id: 'us' as const, label: 'United States' },
]

function Harness({ onChange }: { onChange: (region: RegionId) => void }) {
  const [value, setValue] = useState<RegionId>('in')
  return (
    <div className="w-[400px]">
      <RegionField
        regions={REGIONS}
        value={value}
        onChange={(next) => {
          setValue(next)
          onChange(next)
        }}
      />
    </div>
  )
}

/** The data-region picker the hosted sign-in and sign-up forms show. */
const meta = {
  title: 'App/Sign-in/Region field',
  component: Harness,
  parameters: { layout: 'centered' },
  args: { onChange: fn() },
} satisfies Meta<typeof Harness>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('India')).toBeInTheDocument()
  },
}

export const PicksARegion: Story = {
  parameters: { a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } } },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('combobox', { name: 'Data region' }))
    await userEvent.click(await screen.findByRole('option', { name: 'United States' }))
    await expect(args.onChange).toHaveBeenCalledWith('us')
  },
}

export const ExplainsRegions: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Learn more about regions' }),
    )
    await expect(
      await screen.findByRole('dialog', { name: 'Which region would you like to choose?' }),
    ).toBeInTheDocument()
    await expect(screen.getByText('Hosted in Mumbai, India (ap-south-1)')).toBeInTheDocument()
  },
}

/** The whole sign-in page with the picker in place, as a hosted build shows it. */
export const OnSignIn: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <SignInScreen
      onSubmit={fn()}
      onSignUp={fn()}
      region={<RegionField regions={REGIONS} value="in" onChange={fn()} />}
    />
  ),
}
