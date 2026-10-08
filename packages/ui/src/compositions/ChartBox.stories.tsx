import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { Badge } from '@ui/components/reui/badge'
import { ChartBox, type ChartBoxProps } from './ChartBox'

type PlaygroundArgs = ChartBoxProps & {
  /** Number of bars in the sample plot; 0 shows the empty plot. */
  bars: number
  isLoading: boolean
  showActions: boolean
  showAdornment: boolean
}

/** Deterministic bar heights (percent), so the plot never changes between renders. */
const barHeight = (index: number) => 20 + ((index * 37) % 71)

function SamplePlot({ bars, isLoading }: { bars: number; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (bars === 0) {
    return (
      <p className="text-muted-foreground flex h-40 items-center justify-center text-sm">
        No usage in this period.
      </p>
    )
  }
  return (
    <div
      role="img"
      aria-label={`Usage bar chart with ${bars} bars`}
      className="flex h-40 items-end gap-1"
    >
      {Array.from({ length: bars }, (_, index) => (
        <span
          key={index}
          aria-hidden
          className="bg-primary/70 min-w-0 flex-1 rounded-sm"
          style={{ height: `${barHeight(index)}%` }}
        />
      ))}
    </div>
  )
}

function ChartBoxPlayground({
  bars,
  isLoading,
  showActions,
  showAdornment,
  ...props
}: PlaygroundArgs) {
  return (
    <div className="max-w-2xl">
      <ChartBox
        {...props}
        {...(showActions
          ? {
              actions: (
                <Button size="sm" variant="outline">
                  Last 30 days
                </Button>
              ),
            }
          : {})}
        {...(showAdornment ? { titleAdornment: <Badge variant="secondary">Beta</Badge> } : {})}
      >
        <SamplePlot bars={bars} isLoading={isLoading} />
      </ChartBox>
    </div>
  )
}

const meta = {
  title: 'Foundation/Compositions/ChartBox',
  component: ChartBox,
  parameters: { layout: 'padded' },
  argTypes: {
    title: { control: 'text' },
    titleId: { control: 'text' },
    className: { control: 'text' },
    innerClassName: { control: 'text' },
    actions: { control: false },
    titleAdornment: { control: false },
    children: { control: false },
    bars: { control: { type: 'number', min: 0, max: 60, step: 1 } },
    isLoading: { control: 'boolean' },
    showActions: { control: 'boolean' },
    showAdornment: { control: 'boolean' },
  },
  args: { title: 'API usage', children: null },
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

/** Every prop as a control: drag `bars` to 0 for the empty plot, toggle loading, actions and adornment. */
export const Playground: Story = {
  args: {
    title: 'API usage',
    titleId: 'api-usage-title',
    bars: 24,
    isLoading: false,
    showActions: true,
    showAdornment: false,
  },
  render: (args) => <ChartBoxPlayground {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'API usage' })).toBeVisible()
    await expect(canvas.getByRole('img', { name: /24 bars/ })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Last 30 days' })).toBeVisible()
  },
}

/** Title only, the plot padded inside the white surface. */
export const Default: Story = {
  args: { bars: 24, isLoading: false, showActions: false, showAdornment: false },
  render: (args) => <ChartBoxPlayground {...args} />,
}

/** Range controls on the header's right edge, an adornment beside the title. */
export const WithActionsAndAdornment: Story = {
  args: { bars: 18, isLoading: false, showActions: true, showAdornment: true },
  render: (args) => <ChartBoxPlayground {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Beta')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Last 30 days' })).toBeVisible()
  },
}

/** No data yet: the tray and title stay, the plot says why it is blank. */
export const Empty: Story = {
  args: { bars: 0, isLoading: false, showActions: true, showAdornment: false },
  render: (args) => <ChartBoxPlayground {...args} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No usage in this period.')).toBeVisible()
  },
}

/** While the series loads, a skeleton holds the plot's height so nothing jumps. */
export const Loading: Story = {
  args: { bars: 24, isLoading: true, showActions: true, showAdornment: false },
  render: (args) => <ChartBoxPlayground {...args} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('img')).not.toBeInTheDocument()
  },
}

/** No title: the tray carries only the plot. */
export const Untitled: Story = {
  args: { title: '', bars: 30, isLoading: false, showActions: false, showAdornment: false },
  render: (args) => <ChartBoxPlayground {...args} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('heading')).not.toBeInTheDocument()
  },
}
