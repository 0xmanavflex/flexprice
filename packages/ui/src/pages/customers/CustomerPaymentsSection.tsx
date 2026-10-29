import { Field, OptionSelect, Section } from '../../compositions'

const AUTOMATIC = 'automatic'

export interface PaymentGatewayOption {
  id: string
  name: string
}

export interface CustomerPaymentsSectionProps {
  /** The connections the customer can prefer. */
  gateways: readonly PaymentGatewayOption[]
  /** The preferred connection; null is Automatic. */
  value: string | null
  /** A connection id, or null for Automatic. */
  onChange: (connectionId: string | null) => void
  disabled?: boolean | undefined
}

/** The customer's preferred payment gateway: Automatic or one of their payment connections. */
export function CustomerPaymentsSection({
  gateways,
  value,
  onChange,
  disabled,
}: CustomerPaymentsSectionProps) {
  return (
    <Section
      title="Payments"
      description="Used for payment links, checkout and auto-charge. If it can't be used, Flexprice picks automatically."
    >
      <Field label="Preferred payment gateway">
        {(field) => (
          <OptionSelect
            {...field}
            value={value ?? AUTOMATIC}
            onValueChange={(next) => onChange(next === AUTOMATIC ? null : next)}
            options={[
              { value: AUTOMATIC, label: 'Automatic' },
              ...gateways.map((gateway) => ({ value: gateway.id, label: gateway.name })),
            ]}
            {...(disabled !== undefined ? { disabled } : {})}
          />
        )}
      </Field>
    </Section>
  )
}
