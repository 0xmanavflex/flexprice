import type { Meta, StoryObj } from '@storybook/react-vite'
import { InvoiceBillingDetailBlock } from './InvoiceBillingDetailBlock'

const meta = {
  title: 'Surfaces/InvoiceBillingDetailBlock',
  component: InvoiceBillingDetailBlock,
  parameters: {
    layout: 'fullscreen',
    // The vendored block renders its payment-method chips at opacity-75 (3.23:1); a token gap in locked code.
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: false }] } },
  },
} satisfies Meta<typeof InvoiceBillingDetailBlock>

export default meta
type Story = StoryObj<typeof meta>

/** The vendored solution-billing-4 block, rendered unmodified with its toaster. */
export const Default: Story = {}
