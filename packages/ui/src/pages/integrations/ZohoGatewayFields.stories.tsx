import type { Meta, StoryObj } from '@storybook/react-vite'
import { useForm } from 'react-hook-form'
import { connectionSpecFor, defaultConnectionValues, type ConnectionFormValues } from '@fp/domain'
import { ZohoGatewayFields } from './ZohoGatewayFields'
function GatewayExample() {
  const form = useForm<ConnectionFormValues>({
    defaultValues: {
      ...defaultConnectionValues(connectionSpecFor('zoho_books')!, 'Zoho Books'),
      zohoPaymentGateways: {
        enabled: true,
        gateways: ['paypal', 'stripe', 'future_gateway'],
        paypalPaymentMethod: 'adaptive',
      },
    },
  })
  return <ZohoGatewayFields control={form.control} />
}

const meta = {
  title: 'Pages/Integrations/Zoho gateway fields',
  component: GatewayExample,
} satisfies Meta<typeof GatewayExample>
export default meta
type Story = StoryObj<typeof meta>
export const Gateways: Story = {}
