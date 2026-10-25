import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { MoreHorizontalIcon } from '@ui/icons'
import { expect, within } from 'storybook/test'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/components/primitives/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/components/primitives/tabs'
import { DetailShell } from './DetailShell'
import type { DetailMetric } from './MetricRail'

/**
 * The shared opening of every detail page: a large title with a right-hand cluster
 * (primary action, status chips, id copy chip, More menu), a metric rail, and the body.
 */
const meta = {
  title: 'Building blocks/Detail pages/DetailShell',
  component: DetailShell,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Scale',
    identifier: 'plan_scale_monthly',
    badges: <Badge variant="success-light">Published</Badge>,
    primary: <Button variant="outline">Edit</Button>,
    metrics: [
      {
        label: 'Active contracts',
        value: '128',
        hint: '+12 this month',
        sentiment: 'positive',
      },
      { label: 'Starts at', value: '$29', hint: 'per month' },
      { label: 'Charges', value: '3' },
      { label: 'Currency', value: 'USD' },
    ],
    children: <p className="text-muted-foreground text-sm">The tabbed body goes here.</p>,
  },
  argTypes: {
    title: { control: 'text' },
    identifier: { control: 'text', description: 'The record id, shown as a copy button.' },
    id: { control: 'text' },
    email: { control: 'text', description: 'A mail-icon copy chip beside the id.' },
    primary: { control: false },
    metrics: { control: 'object', description: 'The metric rail; empty or all-blank drops it.' },
    trail: { control: 'object' },
    icon: { control: false },
    badges: { control: false },
    actions: { control: false },
    breadcrumb: { control: false },
    children: { control: false },
    className: { control: false },
  },
} satisfies Meta<typeof DetailShell>

export default meta
type Story = StoryObj<typeof meta>

const METRIC_POOL: DetailMetric[] = [
  { label: 'Active contracts', value: '128', hint: '+12 this month', sentiment: 'positive' },
  { label: 'MRR', value: '$4,210', hint: '-3% vs last month', sentiment: 'negative' },
  { label: 'Starts at', value: '$29', hint: 'per month' },
  { label: 'Charges', value: '3' },
  { label: 'Currency', value: 'USD', sentiment: 'muted' },
  { label: 'Entitlements', value: '9' },
]

const BADGE_VARIANTS = [
  'success-light',
  'warning-light',
  'destructive-light',
  'info-light',
  'primary-light',
  'invert-light',
  'secondary',
  'outline',
] as const

type PlaygroundArgs = Omit<ComponentProps<typeof DetailShell>, 'badges' | 'actions' | 'metrics'> & {
  badgeLabel: string
  badgeVariant: (typeof BADGE_VARIANTS)[number]
  showActions: boolean
  metricCount: number
  blankMetrics: boolean
}

/** Retitle the page, change the badge, show or hide actions, and drag `metricCount` 0 to 6 (or blank them all to see the rail dropped). */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    title: 'Scale',
    identifier: 'plan_scale_monthly',
    email: 'billing@scale.example',
    children: <p className="text-muted-foreground text-sm">The tabbed body goes here.</p>,
    badgeLabel: 'Published',
    badgeVariant: 'success-light',
    showActions: true,
    metricCount: 4,
    blankMetrics: false,
  },
  argTypes: {
    badgeLabel: { control: 'text', description: 'Empty hides the badge.' },
    badgeVariant: { control: 'select', options: BADGE_VARIANTS },
    showActions: { control: 'boolean' },
    metricCount: { control: { type: 'range', min: 0, max: 6, step: 1 } },
    blankMetrics: {
      control: 'boolean',
      description: 'Zero/dash values: the whole rail is omitted.',
    },
  },
  render: ({ badgeLabel, badgeVariant, showActions, metricCount, blankMetrics, ...args }) => {
    const metrics = METRIC_POOL.slice(0, metricCount).map((metric): DetailMetric =>
      blankMetrics ? { label: metric.label, value: '—' } : metric,
    )
    return (
      <DetailShell
        {...args}
        badges={badgeLabel ? <Badge variant={badgeVariant}>{badgeLabel}</Badge> : undefined}
        actions={
          showActions ? (
            <Button size="icon" variant="outline" aria-label="More actions">
              <MoreHorizontalIcon aria-hidden />
            </Button>
          ) : undefined
        }
        metrics={metrics}
      />
    )
  },
}

export const Default: Story = {}

/**
 * The right-hand cluster: primary action first, then chips, then the "ID" copy
 * chip. The full id is never printed; it is the copy chip's tooltip.
 */
export const HeaderCluster: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const copy = canvas.getByRole('button', { name: 'Copy ID plan_scale_monthly' })
    await expect(copy).toHaveTextContent('ID')
    await expect(canvas.queryByText('plan_scale_monthly')).not.toBeInTheDocument()
    const edit = canvas.getByRole('button', { name: 'Edit' })
    const chip = canvas.getByText('Published')
    // Document order: the status pill under the title, then the primary action, then the id chip.
    await expect(chip.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await expect(edit.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  },
}

/** No metrics: the rail is omitted, not rendered empty. */
export const WithoutMetrics: Story = {
  args: { metrics: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Scale' })).toBeInTheDocument()
    await expect(canvas.queryByText('Active contracts')).not.toBeInTheDocument()
  },
}

/** A rail whose every tile is blank is dropped too: no fake instrument panel. */
export const WithBlankMetrics: Story = {
  args: {
    metrics: [
      { label: 'Charges', value: '0' },
      { label: 'Starts at', value: '—' },
      { label: 'Currency', value: '—' },
      { label: 'Entitlements', value: '0' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Scale' })).toBeInTheDocument()
    await expect(canvas.queryByText('Charges')).not.toBeInTheDocument()
  },
}

const TABS = ['Overview', 'Entitlements', 'Credit Grants', 'Information']

/**
 * The tab strip at phone width.
 *
 * The vendored `TabsList` leaves its overflow visible, so a four-tab strip
 * painted its later children outside the strip, where the viewport clipped
 * them: "Information": the only place a plan's ID and description live: was
 * unreachable by touch scroll. The shell now makes any tab strip in its body
 * scroll, so the last tab can be reached at 390.
 */
export const TabsScrollAtPhoneWidth: Story = {
  args: {
    metrics: [],
    children: (
      <Tabs defaultValue="overview">
        <TabsList>
          {TABS.map((label) => (
            <TabsTrigger key={label} value={label.toLowerCase()}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="pt-4">
          <p className="text-muted-foreground text-sm">Overview body.</p>
        </TabsContent>
      </Tabs>
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const list = canvasElement.querySelector<HTMLElement>('[data-slot="tabs-list"]')
    await expect(list).not.toBeNull()
    if (!list) return

    // The strip scrolls rather than painting outside itself…
    await expect(getComputedStyle(list).overflowX).toBe('auto')
    await expect(list.scrollWidth).toBeGreaterThan(list.clientWidth)

    // …so the last tab can actually be brought into view, which is the whole
    // point: "Information" was previously off-screen and unreachable.
    const last = within(list).getByRole('tab', { name: 'Information' })
    last.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    await expect(list.scrollLeft).toBeGreaterThan(0)

    const strip = list.getBoundingClientRect()
    const tab = last.getBoundingClientRect()
    await expect(tab.left).toBeLessThan(strip.right)
    await expect(tab.right).toBeGreaterThan(strip.left)
  },
}
