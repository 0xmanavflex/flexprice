import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/components/primitives/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/components/primitives/tabs'
import { DetailShell } from './DetailShell'

/**
 * The shared opening of every detail page: a large title with badges and an
 * identifier, an actions cluster, a metric rail, and the body.
 */
const meta = {
  title: 'Foundation/Compositions/DetailShell',
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
} satisfies Meta<typeof DetailShell>

export default meta
type Story = StoryObj<typeof meta>

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
    // Document order: primary action, then chip, then the id chip.
    await expect(edit.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await expect(chip.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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

/** A rail whose every tile is blank is dropped too — no fake instrument panel. */
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
 * them: "Information" — the only place a plan's ID and description live — was
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
