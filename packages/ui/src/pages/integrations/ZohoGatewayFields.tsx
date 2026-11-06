import { Controller, useFormState, type Control } from 'react-hook-form'
import type { ConnectionFormValues } from '@fp/domain'
import { Field } from '@ui/compositions/forms/Field'
import { CheckboxRow } from '@ui/compositions/forms/CheckboxRow'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'

export const ZohoGatewayFieldsProvenance = provenance({
  source: 'composition',
  composes: ['compositions/Field', 'compositions/CheckboxRow', 'compositions/OptionSelect'],
  note: 'Zoho invoice payment gateways, preserving unrecognised saved gateways and settings.',
})
const GATEWAYS = [
  { value: 'paypal', label: 'PayPal' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'authorize_net', label: 'Authorize.Net' },
  { value: 'payflow_pro', label: 'PayPal Payflow Pro' },
  { value: 'braintree', label: 'Braintree' },
  { value: '2checkout', label: '2Checkout' },
]

export function ZohoGatewayFields({ control }: { control: Control<ConnectionFormValues> }) {
  const { errors } = useFormState({ control, name: 'zohoPaymentGateways' })
  return (
    <Controller
      control={control}
      name="zohoPaymentGateways"
      render={({ field, fieldState }) => {
        const value = field.value ?? {
          enabled: false,
          gateways: [],
          paypalPaymentMethod: 'standard',
        }
        const choices = [
          ...GATEWAYS,
          ...value.gateways
            .filter((gateway) => !GATEWAYS.some((item) => item.value === gateway))
            .map((gateway) => ({ value: gateway, label: gateway })),
        ]
        return (
          <Field
            label="Invoice payment gateways"
            hint="Offer these payment methods on invoices created in Zoho Books."
            error={errors.zohoPaymentGateways?.gateways?.message ?? fieldState.error?.message}
          >
            {() => (
              <div className="flex flex-col gap-3">
                <CheckboxRow
                  checked={value.enabled}
                  onCheckedChange={(enabled) => field.onChange({ ...value, enabled })}
                >
                  Enable payment gateways
                </CheckboxRow>
                {value.enabled ? (
                  <>
                    {choices.map((gateway) => (
                      <CheckboxRow
                        key={gateway.value}
                        checked={value.gateways.includes(gateway.value)}
                        onCheckedChange={(checked) =>
                          field.onChange({
                            ...value,
                            gateways: checked
                              ? [...value.gateways, gateway.value]
                              : value.gateways.filter((item) => item !== gateway.value),
                          })
                        }
                      >
                        {gateway.label}
                      </CheckboxRow>
                    ))}
                    {value.gateways.includes('paypal') ? (
                      <Field label="PayPal payment method">
                        {({ id }) => (
                          <OptionSelect
                            id={id}
                            value={value.paypalPaymentMethod}
                            onValueChange={(paypalPaymentMethod) =>
                              field.onChange({ ...value, paypalPaymentMethod })
                            }
                            options={[
                              { value: 'standard', label: 'Standard' },
                              { value: 'adaptive', label: 'Adaptive' },
                            ]}
                          />
                        )}
                      </Field>
                    ) : null}
                  </>
                ) : null}
              </div>
            )}
          </Field>
        )
      }}
    />
  )
}
