import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { GaugeIcon } from 'lucide-react'
import { FeatureType, InvoiceStatus } from '@fp/domain'
import { CatalogStatusBadge, FeatureTypeBadge, GlyphBadge, InvoiceStatusBadge } from './StatusBadge'
import type { CatalogStatus } from './StatusBadge'

const meta = {
  title: 'Foundation/Flexprice/InvoiceStatusBadge',
  component: InvoiceStatusBadge,
  parameters: { layout: 'centered' },
  args: { status: InvoiceStatus.Open },
  argTypes: {
    status: { control: 'select', options: Object.values(InvoiceStatus) },
  },
} satisfies Meta<typeof InvoiceStatusBadge>

export default meta
type Story = StoryObj<typeof meta>

/** Pick any invoice status; statuses that need action also announce it to screen readers. */
export const Playground: Story = {
  args: { status: InvoiceStatus.Overdue },
}

interface OtherBadgesArgs {
  catalogStatus: CatalogStatus
  featureType: FeatureType
  glyphTone:
    'text-success' | 'text-info' | 'text-warning' | 'text-destructive' | 'text-muted-foreground'
  glyphLabel: string
}

/** The sibling badges that share the dot-pill shape: catalogue status, feature type and the generic glyph badge. */
export const OtherBadges = {
  args: {
    catalogStatus: 'published',
    featureType: FeatureType.Metered,
    glyphTone: 'text-warning',
    glyphLabel: 'Trialing',
  },
  argTypes: {
    catalogStatus: { control: 'inline-radio', options: ['published', 'archived'] },
    featureType: { control: 'select', options: Object.values(FeatureType) },
    glyphTone: {
      control: 'select',
      options: [
        'text-success',
        'text-info',
        'text-warning',
        'text-destructive',
        'text-muted-foreground',
      ],
    },
    glyphLabel: { control: 'text' },
  },
  render: ({ catalogStatus, featureType, glyphTone, glyphLabel }) => (
    <div className="flex flex-wrap items-center gap-2">
      <CatalogStatusBadge status={catalogStatus} />
      <FeatureTypeBadge type={featureType} />
      <GlyphBadge icon={GaugeIcon} tone={glyphTone} label={glyphLabel} />
    </div>
  ),
} satisfies StoryObj<OtherBadgesArgs>

/** Only the status needing action is destructive. */
export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {Object.values(InvoiceStatus).map((status) => (
        <InvoiceStatusBadge key={status} status={status} />
      ))}
    </div>
  ),
}

export const Overdue: Story = {
  args: { status: InvoiceStatus.Overdue },
  play: async ({ canvasElement }) => {
    // Colour alone cannot carry "this one needs you".
    await expect(within(canvasElement).getByText(/needs attention/)).toBeInTheDocument()
  },
}
