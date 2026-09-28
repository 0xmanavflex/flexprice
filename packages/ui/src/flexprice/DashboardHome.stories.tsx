import type { Meta, StoryObj } from '@storybook/react-vite'
import { DashboardHome } from './DashboardHome'

/**
 * The Home dashboard — the vendored ReUI premium block `dashboard-4`, mounted as
 * installed with the block's own sample data. It has no props.
 *
 * a11y is set to `todo` rather than `error`: the block is third-party/vendored,
 * so its accessibility is out of our control and not something these stories fix.
 */
const meta = {
  title: 'Surfaces/DashboardHome',
  component: DashboardHome,
  parameters: { layout: 'fullscreen', a11y: { test: 'todo' } },
} satisfies Meta<typeof DashboardHome>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
